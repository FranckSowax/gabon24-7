/**
 * 🔍 ROUTES RECHERCHE INTELLIGENTE
 * Utilise PostgreSQL Full-Text Search (français) + métadonnées IA
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');

/**
 * Convertit une query utilisateur en tsquery PostgreSQL compatible
 * Ex: "route nationale" → "route & nationale"
 * Ex: "Ali Bongo" → "Ali & Bongo"
 * Gère les mots courts (< 2 chars) en les filtrant
 */
function buildTsQuery(query) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .map(w => w.replace(/[^a-zA-ZÀ-ÿ0-9]/g, '')) // nettoyer caractères spéciaux
    .filter(w => w.length >= 2);

  if (words.length === 0) return null;
  return words.join(' & ');
}

/**
 * POST /api/search - Recherche intelligente avec Full-Text Search PostgreSQL
 *
 * Utilise:
 * - search_vector (tsvector) pour FTS français avec stemming et accents
 * - ts_rank_cd pour scoring par pertinence
 * - Fallback ILIKE pour queries courtes (< 3 chars)
 * - Filtres: category, source, sentiment, importance, breaking, dateFrom, dateTo
 */
router.post('/', async (req, res) => {
  try {
    const {
      query = '',
      category = 'all',
      source = 'all',
      sentiment = 'all',
      minImportance = 0,
      onlyBreaking = false,
      dateFrom = null,
      dateTo = null,
      limit = 20,
      offset = 0
    } = req.body;

    console.log('🔍 Recherche intelligente:', { query, category, source, dateFrom, dateTo });

    const searchTerm = query.trim();
    const tsQueryStr = searchTerm ? buildTsQuery(searchTerm) : null;
    const useFTS = tsQueryStr && searchTerm.length >= 3;

    // Si FTS disponible, utiliser RPC pour ts_rank scoring
    if (useFTS) {
      // Construire les filtres pour la requête RPC
      let rpcQuery = supabaseService.supabase
        .rpc('search_articles_fts', {
          search_query: tsQueryStr,
          result_limit: limit,
          result_offset: offset
        });

      const { data: ftsResults, error: ftsError } = await rpcQuery;

      if (!ftsError && ftsResults && ftsResults.length > 0) {
        // FTS a retourné des résultats - appliquer filtres supplémentaires côté JS
        let filtered = ftsResults;

        if (category !== 'all') {
          filtered = filtered.filter(a => a.category && a.category.toLowerCase().includes(category.toLowerCase()));
        }
        if (source !== 'all') {
          filtered = filtered.filter(a => a.source && a.source.toLowerCase().includes(source.toLowerCase()));
        }
        if (sentiment !== 'all') {
          filtered = filtered.filter(a => {
            const s = a.sentiment_score;
            if (s === null || s === undefined) return false;
            if (sentiment === 'positive') return s >= 0.3;
            if (sentiment === 'negative') return s <= -0.3;
            if (sentiment === 'neutral') return s > -0.3 && s < 0.3;
            return true;
          });
        }
        if (minImportance > 0) {
          filtered = filtered.filter(a => (a.importance || 0) >= minImportance);
        }
        if (onlyBreaking) {
          filtered = filtered.filter(a => a.is_breaking);
        }
        if (dateFrom) {
          filtered = filtered.filter(a => a.published_at && a.published_at >= dateFrom);
        }
        if (dateTo) {
          filtered = filtered.filter(a => a.published_at && a.published_at <= dateTo);
        }

        console.log(`✅ FTS: ${filtered.length} résultats (${ftsResults.length} bruts)`);

        return res.json({
          success: true,
          articles: filtered,
          total: filtered.length,
          query: searchTerm,
          searchMethod: 'fts',
          filters: { category, source, sentiment, minImportance, onlyBreaking, dateFrom, dateTo }
        });
      }

      // FTS n'a rien trouvé ou erreur → fallback ILIKE
      if (ftsError) {
        console.warn('⚠️ FTS error, fallback ILIKE:', ftsError.message);
      }
    }

    // Fallback: ILIKE (queries courtes ou FTS indisponible)
    let dbQuery = supabaseService.supabase
      .from('articles')
      .select(`
        id, title, summary, summary_ai, url, image_url, image_urls,
        author, published_at, category, keywords, sentiment_score,
        importance, is_breaking, view_count, share_count, created_at,
        source, rss_feeds!left(name)
      `, { count: 'exact' })
      .eq('is_published', true);

    // Recherche textuelle ILIKE
    if (searchTerm.length > 0) {
      dbQuery = dbQuery.or(
        `title.ilike.%${searchTerm}%,` +
        `summary.ilike.%${searchTerm}%,` +
        `summary_ai.ilike.%${searchTerm}%,` +
        `keywords.cs.{${searchTerm}}`
      );
    }

    // Filtres
    if (category !== 'all') {
      dbQuery = dbQuery.ilike('category', `%${category}%`);
    }
    if (source !== 'all') {
      dbQuery = dbQuery.ilike('source', `%${source}%`);
    }
    if (sentiment !== 'all') {
      if (sentiment === 'positive') dbQuery = dbQuery.gte('sentiment_score', 0.3);
      else if (sentiment === 'negative') dbQuery = dbQuery.lte('sentiment_score', -0.3);
      else if (sentiment === 'neutral') dbQuery = dbQuery.gte('sentiment_score', -0.3).lte('sentiment_score', 0.3);
    }
    if (minImportance > 0) {
      dbQuery = dbQuery.gte('importance', minImportance);
    }
    if (onlyBreaking) {
      dbQuery = dbQuery.eq('is_breaking', true);
    }
    if (dateFrom) {
      dbQuery = dbQuery.gte('published_at', dateFrom);
    }
    if (dateTo) {
      dbQuery = dbQuery.lte('published_at', dateTo);
    }

    dbQuery = dbQuery
      .order('importance', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: articles, error, count } = await dbQuery;

    if (error) {
      console.error('❌ Erreur recherche:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Scoring intelligent pour tri final
    const scoredArticles = (articles || []).map(article => {
      let score = 0;
      score += (article.importance || 5) * 10;
      if (article.is_breaking) score += 50;
      if (searchTerm && article.title && article.title.toLowerCase().includes(searchTerm.toLowerCase())) score += 30;
      if (searchTerm && article.keywords && article.keywords.some(kw => kw.toLowerCase().includes(searchTerm.toLowerCase()))) score += 20;
      const hoursSincePublished = article.published_at
        ? (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60)
        : 999;
      if (hoursSincePublished < 24) score += 10;
      return { ...article, search_score: Math.round(score) };
    });

    scoredArticles.sort((a, b) => b.search_score - a.search_score);

    console.log(`✅ ILIKE: ${scoredArticles.length} articles trouvés (total: ${count})`);

    res.json({
      success: true,
      articles: scoredArticles,
      total: count,
      query: searchTerm,
      searchMethod: 'ilike',
      filters: { category, source, sentiment, minImportance, onlyBreaking, dateFrom, dateTo }
    });

  } catch (error) {
    console.error('❌ Erreur recherche intelligente:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/search/suggestions - Auto-complétion intelligente
 * Utilise FTS pour des suggestions plus pertinentes
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { query = '' } = req.query;

    if (!query || query.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    // Récupérer les articles récents avec keywords qui matchent
    const { data: articles } = await supabaseService.supabase
      .from('articles')
      .select('title, keywords, category')
      .eq('is_published', true)
      .not('keywords', 'is', null)
      .or(`title.ilike.%${query}%,keywords.cs.{${query}}`)
      .order('published_at', { ascending: false })
      .limit(50);

    if (!articles) {
      return res.json({ success: true, suggestions: [] });
    }

    // Extraire keywords uniques qui matchent la query
    const keywordsSet = new Set();
    const categoriesSet = new Set();
    const titlesMatching = [];

    articles.forEach(article => {
      if (article.keywords) {
        article.keywords.forEach(kw => {
          if (kw.toLowerCase().includes(query.toLowerCase())) {
            keywordsSet.add(kw);
          }
        });
      }
      if (article.category && article.category.toLowerCase().includes(query.toLowerCase())) {
        categoriesSet.add(article.category);
      }
      if (article.title && article.title.toLowerCase().includes(query.toLowerCase())) {
        titlesMatching.push(article.title);
      }
    });

    const suggestions = [
      ...Array.from(keywordsSet).slice(0, 5).map(kw => ({
        type: 'keyword', text: kw, label: `🔑 ${kw}`
      })),
      ...Array.from(categoriesSet).slice(0, 3).map(cat => ({
        type: 'category', text: cat, label: `📂 ${cat}`
      })),
      ...titlesMatching.slice(0, 3).map(title => ({
        type: 'article',
        text: title.substring(0, 60) + (title.length > 60 ? '...' : ''),
        label: `📰 ${title.substring(0, 60)}...`
      }))
    ].slice(0, 8);

    res.json({ success: true, suggestions });

  } catch (error) {
    console.error('❌ Erreur suggestions:', error);
    res.json({ success: true, suggestions: [] });
  }
});

/**
 * GET /api/search/trending - Recherches tendances
 */
router.get('/trending', async (req, res) => {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: articles } = await supabaseService.supabase
      .from('articles')
      .select('keywords, view_count, importance, is_breaking')
      .eq('is_published', true)
      .not('keywords', 'is', null)
      .gte('created_at', twoDaysAgo)
      .order('view_count', { ascending: false })
      .limit(50);

    if (!articles) {
      return res.json({ success: true, trending: [] });
    }

    const keywordFreq = {};
    articles.forEach(article => {
      const weight =
        (article.view_count || 0) * 0.01 +
        (article.importance || 0) +
        (article.is_breaking ? 20 : 0);
      article.keywords.forEach(kw => {
        keywordFreq[kw] = (keywordFreq[kw] || 0) + weight;
      });
    });

    const trending = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, score]) => ({ keyword, score: Math.round(score) }));

    res.json({ success: true, trending });

  } catch (error) {
    console.error('❌ Erreur trending:', error);
    res.json({ success: true, trending: [] });
  }
});

module.exports = router;
