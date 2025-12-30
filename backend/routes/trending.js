/**
 * Routes pour les tendances (articles les plus vus/partages)
 * Endpoints:
 *   - GET /api/stats/trending/:period/:metric (daily/weekly/monthly, views/shares)
 *   - POST /api/articles/:id/view - Tracker une vue
 *   - POST /api/articles/:id/share - Tracker un partage
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const crypto = require('crypto');

const { supabase } = supabaseService;

// Helper pour formater le nombre de vues
function formatViewCount(count) {
  if (!count || count === 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

// Helper pour formater le temps relatif
function formatTimeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return past.toLocaleDateString('fr-FR');
}

// Helper pour obtenir le nom du media depuis l'URL
function getMediaNameFromUrl(url, fallbackSource) {
  if (!url) return fallbackSource || 'Source inconnue';
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    const mediaNames = {
      'gabonreview.com': 'Gabon Review',
      'lenouveaugabon.com': 'Le Nouveau Gabon',
      'gabonmediatime.com': 'Gabon Media Time',
      'agpgabon.ga': 'AGP',
      'union.sonapresse.com': "L'Union",
      'bdpmodwo.com': 'BDP Modwo',
      'gabonactu.com': 'Gabon Actu',
      'direct-infos.com': 'Direct Infos',
      'infos241.com': 'Infos 241',
      'gabonenerveur.com': 'Gabon en Erveur',
      'mediaguinee.org': 'Media Guinee'
    };
    return mediaNames[hostname] || fallbackSource || hostname;
  } catch {
    return fallbackSource || 'Source inconnue';
  }
}

/**
 * GET /api/stats/trending/:period/:metric
 * Recupere les articles trending
 * @param period: daily | weekly | monthly
 * @param metric: views | shares
 */
router.get('/:period/:metric', async (req, res) => {
  try {
    const { period, metric } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📊 Recuperation tendances: period=${period}, metric=${metric}, limit=${limit}`);

    // Valider les parametres
    const validPeriods = ['daily', 'weekly', 'monthly'];
    const validMetrics = ['views', 'shares'];

    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        error: `Periode invalide. Utiliser: ${validPeriods.join(', ')}`
      });
    }

    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        error: `Metrique invalide. Utiliser: ${validMetrics.join(', ')}`
      });
    }

    // Calculer la date de debut selon la periode
    const now = new Date();
    let startDate;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Utiliser les fonctions RPC si disponibles, sinon fallback sur requete directe
    let articles = [];
    let rpcError = null;

    if (metric === 'views') {
      // Essayer d'abord la fonction RPC
      const { data: rpcData, error } = await supabase.rpc('get_trending_articles_by_views', {
        p_period: period,
        p_limit: limit
      });

      if (!error && rpcData && rpcData.length > 0) {
        articles = rpcData;
      } else {
        rpcError = error;
        // Fallback: requete directe
        const { data, error: queryError } = await supabase
          .from('articles')
          .select('id, title, summary, ai_summary, category, published_at, image_url, image_urls, source, url, view_count, share_count')
          .eq('is_published', true)
          .gte('published_at', startDate.toISOString())
          .order('view_count', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (queryError) {
          console.error('❌ Erreur requete trending views:', queryError);
          throw queryError;
        }
        articles = data || [];
      }
    } else {
      // metric === 'shares'
      const { data: rpcData, error } = await supabase.rpc('get_trending_articles_by_shares', {
        p_period: period,
        p_limit: limit
      });

      if (!error && rpcData && rpcData.length > 0) {
        articles = rpcData;
      } else {
        rpcError = error;
        // Fallback: requete directe
        const { data, error: queryError } = await supabase
          .from('articles')
          .select('id, title, summary, ai_summary, category, published_at, image_url, image_urls, source, url, view_count, share_count')
          .eq('is_published', true)
          .gte('published_at', startDate.toISOString())
          .order('share_count', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (queryError) {
          console.error('❌ Erreur requete trending shares:', queryError);
          throw queryError;
        }
        articles = data || [];
      }
    }

    // Transformer les articles pour le frontend
    const transformedArticles = articles.map((article, index) => ({
      id: article.article_id || article.id,
      title: article.title,
      summary: article.summary || article.ai_summary || 'Resume non disponible',
      category: article.category || 'Actualites',
      published_at: article.published_at,
      publishedAt: formatTimeAgo(article.published_at),
      imageUrl: article.image_url || (article.image_urls && article.image_urls[0]) || null,
      source: getMediaNameFromUrl(article.url, article.source),
      url: article.url,
      view_count: article.view_count || article.period_views || 0,
      viewCount: formatViewCount(article.view_count || article.period_views || 0),
      share_count: article.share_count || article.period_shares || 0,
      shareCount: formatViewCount(article.share_count || article.period_shares || 0),
      rank: index + 1,
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances (${period}/${metric}) recuperes`);

    res.json({
      success: true,
      articles: transformedArticles,
      period,
      metric,
      count: transformedArticles.length,
      startDate: startDate.toISOString(),
      usedRpc: !rpcError
    });

  } catch (error) {
    console.error('❌ Erreur endpoint tendances:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des tendances',
      articles: []
    });
  }
});

/**
 * POST /api/articles/:id/view
 * Enregistre une vue d'article
 */
router.post('/articles/:id/view', async (req, res) => {
  try {
    const { id: articleId } = req.params;
    const { userId, sessionId } = req.body;

    // Hash de l'IP pour l'anonymisation
    const ip = req.ip || req.connection?.remoteAddress || '';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);

    const userAgent = req.headers['user-agent'] || '';
    const referrer = req.headers['referer'] || '';

    console.log(`👁️ Vue article: ${articleId} (user: ${userId || 'anonymous'})`);

    // Essayer d'utiliser la fonction RPC
    const { data, error } = await supabase.rpc('record_article_view', {
      p_article_id: articleId,
      p_user_id: userId || null,
      p_session_id: sessionId || null,
      p_ip_hash: ipHash,
      p_user_agent: userAgent.substring(0, 500),
      p_referrer: referrer.substring(0, 500),
      p_source: 'web'
    });

    if (error) {
      console.error('❌ Erreur RPC record_article_view:', error);

      // Fallback: increment direct
      const { error: updateError } = await supabase
        .from('articles')
        .update({ view_count: supabase.raw('COALESCE(view_count, 0) + 1') })
        .eq('id', articleId);

      if (updateError) {
        // Dernier fallback: simple update
        await supabase.rpc('increment_view_count', { article_uuid: articleId });
      }
    }

    res.json({
      success: true,
      recorded: data !== false,
      articleId
    });

  } catch (error) {
    console.error('❌ Erreur enregistrement vue:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement de la vue'
    });
  }
});

/**
 * POST /api/articles/:id/share
 * Enregistre un partage d'article
 */
router.post('/articles/:id/share', async (req, res) => {
  try {
    const { id: articleId } = req.params;
    const { userId, platform = 'unknown' } = req.body;

    console.log(`📤 Partage article: ${articleId} sur ${platform}`);

    // Essayer d'utiliser la fonction RPC
    const { data, error } = await supabase.rpc('record_article_share', {
      p_article_id: articleId,
      p_user_id: userId || null,
      p_platform: platform
    });

    if (error) {
      console.error('❌ Erreur RPC record_article_share:', error);

      // Fallback: increment direct
      await supabase
        .from('articles')
        .update({ share_count: supabase.raw('COALESCE(share_count, 0) + 1') })
        .eq('id', articleId);
    }

    res.json({
      success: true,
      recorded: true,
      articleId,
      platform
    });

  } catch (error) {
    console.error('❌ Erreur enregistrement partage:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement du partage'
    });
  }
});

module.exports = router;
