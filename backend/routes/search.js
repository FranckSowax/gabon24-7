/**
 * 🔍 ROUTES RECHERCHE INTELLIGENTE
 * Utilise les métadonnées IA pour recherche avancée
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');

/**
 * POST /api/search - Recherche intelligente avec IA
 * 
 * Utilise:
 * - keywords pour matching amélioré
 * - category pour filtrage
 * - importance pour scoring
 * - sentiment_score pour filtrage avancé
 * - Full-text search sur titre + summary + summary_ai
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
      limit = 20,
      offset = 0
    } = req.body;

    console.log('🔍 Recherche intelligente:', { query, category, source, minImportance });

    // Construction de la requête de base
    let dbQuery = supabaseService.supabase
      .from('articles')
      .select(`
        id,
        title,
        summary,
        summary_ai,
        url,
        image_url,
        image_urls,
        author,
        published_at,
        category,
        keywords,
        sentiment_score,
        importance,
        is_breaking,
        view_count,
        share_count,
        created_at,
        rss_feeds!inner(name)
      `, { count: 'exact' })
      .eq('is_published', true);

    // 1. Recherche textuelle si query fourni
    if (query && query.trim().length > 0) {
      const searchTerm = query.trim();
      
      // Recherche multiple: titre, summary, summary_ai, keywords
      dbQuery = dbQuery.or(
        `title.ilike.%${searchTerm}%,` +
        `summary.ilike.%${searchTerm}%,` +
        `summary_ai.ilike.%${searchTerm}%,` +
        `keywords.cs.{${searchTerm}}`  // Contains dans array
      );
    }

    // 2. Filtre par catégorie
    if (category !== 'all') {
      dbQuery = dbQuery.ilike('category', `%${category}%`);
    }

    // 3. Filtre par source (via rss_feeds)
    if (source !== 'all') {
      dbQuery = dbQuery.eq('rss_feeds.name', source);
    }

    // 4. Filtre par sentiment
    if (sentiment !== 'all') {
      if (sentiment === 'positive') {
        dbQuery = dbQuery.gte('sentiment_score', 0.3);
      } else if (sentiment === 'negative') {
        dbQuery = dbQuery.lte('sentiment_score', -0.3);
      } else if (sentiment === 'neutral') {
        dbQuery = dbQuery.gte('sentiment_score', -0.3).lte('sentiment_score', 0.3);
      }
    }

    // 5. Filtre par importance minimale
    if (minImportance > 0) {
      dbQuery = dbQuery.gte('importance', minImportance);
    }

    // 6. Filtre breaking news uniquement
    if (onlyBreaking) {
      dbQuery = dbQuery.eq('is_breaking', true);
    }

    // Tri: d'abord par importance, puis par date
    dbQuery = dbQuery
      .order('importance', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Exécution
    const { data: articles, error, count } = await dbQuery;

    if (error) {
      console.error('❌ Erreur recherche:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    // Scoring intelligent pour tri final
    const scoredArticles = (articles || []).map(article => {
      let score = 0;

      // Score de base sur importance
      score += (article.importance || 5) * 10;

      // Bonus breaking news
      if (article.is_breaking) {
        score += 50;
      }

      // Bonus si query match dans titre
      if (query && article.title && article.title.toLowerCase().includes(query.toLowerCase())) {
        score += 30;
      }

      // Bonus si query match dans keywords
      if (query && article.keywords && article.keywords.some(kw => 
        kw.toLowerCase().includes(query.toLowerCase())
      )) {
        score += 20;
      }

      // Bonus récence (dernières 24h)
      const hoursSincePublished = article.published_at 
        ? (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60)
        : 999;
      
      if (hoursSincePublished < 24) {
        score += 10;
      }

      return {
        ...article,
        search_score: Math.round(score)
      };
    });

    // Tri final par score
    scoredArticles.sort((a, b) => b.search_score - a.search_score);

    console.log(`✅ ${scoredArticles.length} articles trouvés (total: ${count})`);

    res.json({
      success: true,
      articles: scoredArticles,
      total: count,
      query: query,
      filters: {
        category,
        source,
        sentiment,
        minImportance,
        onlyBreaking
      }
    });

  } catch (error) {
    console.error('❌ Erreur recherche intelligente:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/search/suggestions - Auto-complétion intelligente
 * Utilise ai_keywords pour suggestions pertinentes
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
      .order('created_at', { ascending: false })
      .limit(100);

    if (!articles) {
      return res.json({ success: true, suggestions: [] });
    }

    // Extraire keywords uniques qui matchent la query
    const keywordsSet = new Set();
    const categoriesSet = new Set();
    const titlesMatching = [];

    articles.forEach(article => {
      // Keywords
      if (article.keywords) {
        article.keywords.forEach(kw => {
          if (kw.toLowerCase().includes(query.toLowerCase())) {
            keywordsSet.add(kw);
          }
        });
      }

      // Catégories
      if (article.category && 
          article.category.toLowerCase().includes(query.toLowerCase())) {
        categoriesSet.add(article.category);
      }

      // Titres
      if (article.title && 
          article.title.toLowerCase().includes(query.toLowerCase())) {
        titlesMatching.push(article.title);
      }
    });

    // Construire suggestions
    const suggestions = [
      ...Array.from(keywordsSet).slice(0, 5).map(kw => ({
        type: 'keyword',
        text: kw,
        label: `🔑 ${kw}`
      })),
      ...Array.from(categoriesSet).slice(0, 3).map(cat => ({
        type: 'category',
        text: cat,
        label: `📂 ${cat}`
      })),
      ...titlesMatching.slice(0, 3).map(title => ({
        type: 'article',
        text: title.substring(0, 60) + (title.length > 60 ? '...' : ''),
        label: `📰 ${title.substring(0, 60)}...`
      }))
    ].slice(0, 8); // Max 8 suggestions

    res.json({
      success: true,
      suggestions
    });

  } catch (error) {
    console.error('❌ Erreur suggestions:', error);
    res.json({ success: true, suggestions: [] });
  }
});

/**
 * GET /api/search/trending - Recherches tendances
 * Basé sur ai_keywords des articles populaires
 */
router.get('/trending', async (req, res) => {
  try {
    // Récupérer articles populaires des dernières 48h
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

    // Compter fréquence des keywords avec pondération
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

    // Trier et prendre top 10
    const trending = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, score]) => ({
        keyword,
        score: Math.round(score)
      }));

    res.json({
      success: true,
      trending
    });

  } catch (error) {
    console.error('❌ Erreur trending:', error);
    res.json({ success: true, trending: [] });
  }
});

module.exports = router;
