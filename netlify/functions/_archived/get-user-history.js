const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!supabaseServiceKey
  });
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'application/json'
  };

  // Gestion des requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Méthode non autorisée'
      })
    };
  }

  try {
    // Récupérer les paramètres de requête
    const { user_id, limit = 20, offset = 0, source, category } = event.queryStringParameters || {};

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'ID utilisateur requis'
        })
      };
    }

    console.log(`📊 Récupération historique pour utilisateur: ${user_id}`);

    // Récupérer l'historique des vues d'abord
    const { data: viewsData, error: viewsError } = await supabase
      .from('article_views')
      .select('id, article_id, article_title, article_url, source, viewed_at')
      .eq('user_id', user_id)
      .order('viewed_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (viewsError) {
      console.error('❌ Erreur récupération vues:', viewsError);
      throw viewsError;
    }

    if (!viewsData || viewsData.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          history: [],
          stats: {
            total_articles_read: 0,
            articles_this_week: 0,
            articles_this_month: 0,
            favorite_articles: 0,
            bookmarked_articles: 0,
            total_reading_time: 0,
            most_read_source: null,
            most_read_category: null
          },
          total: 0,
          hasMore: false
        })
      };
    }

    // Récupérer les détails des articles correspondants
    const articleIds = viewsData.map(view => view.article_id);
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        summary,
        ai_summary,
        content,
        url,
        author,
        published_at,
        category,
        keywords,
        sentiment,
        view_count,
        share_count,
        image_url,
        feed_id,
        rss_feeds (
          name
        )
      `)
      .in('id', articleIds);

    if (articlesError) {
      console.error('❌ Erreur récupération articles:', articlesError);
      throw articlesError;
    }

    // Créer un map des articles pour un accès rapide
    const articlesMap = {};
    if (articlesData) {
      articlesData.forEach(article => {
        articlesMap[article.id] = article;
      });
    }

    // Combiner les données de vues avec les articles
    const historyData = viewsData.map(view => ({
      ...view,
      articles: articlesMap[view.article_id] || null
    })).filter(item => item.articles !== null);

    // Récupérer toutes les vues pour les statistiques
    const { data: allViewsData, error: statsError } = await supabase
      .from('article_views')
      .select('id, viewed_at, article_id')
      .eq('user_id', user_id);

    let statsData = [];
    if (allViewsData && !statsError) {
      // Récupérer les articles pour les statistiques
      const allArticleIds = allViewsData.map(view => view.article_id);
      const { data: allArticlesData } = await supabase
        .from('articles')
        .select(`
          id,
          category,
          rss_feeds (
            name
          )
        `)
        .in('id', allArticleIds);

      // Combiner pour les stats
      if (allArticlesData) {
        const allArticlesMap = {};
        allArticlesData.forEach(article => {
          allArticlesMap[article.id] = article;
        });

        statsData = allViewsData.map(view => ({
          ...view,
          articles: allArticlesMap[view.article_id]
        })).filter(item => item.articles);
      }
    }

    if (statsError) {
      console.warn('⚠️ Erreur récupération stats:', statsError);
    }

    // Calculer les statistiques
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total_articles_read: statsData?.length || 0,
      articles_this_week: statsData?.filter(item => 
        new Date(item.viewed_at) >= oneWeekAgo
      ).length || 0,
      articles_this_month: statsData?.filter(item => 
        new Date(item.viewed_at) >= oneMonthAgo
      ).length || 0,
      favorite_articles: 0, // À implémenter avec une table favorites
      bookmarked_articles: 0, // À implémenter avec une table bookmarks
      total_reading_time: 0, // À calculer si on a des données de durée
      most_read_source: null,
      most_read_category: null
    };

    // Calculer la source la plus lue
    if (statsData && statsData.length > 0) {
      const sourceCounts = {};
      const categoryCounts = {};

      statsData.forEach(item => {
        const source = item.articles?.rss_feeds?.name;
        const category = item.articles?.category;

        if (source) {
          sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        }
        if (category) {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      });

      if (Object.keys(sourceCounts).length > 0) {
        stats.most_read_source = Object.keys(sourceCounts).reduce((a, b) => 
          sourceCounts[a] > sourceCounts[b] ? a : b
        );
      }
      if (Object.keys(categoryCounts).length > 0) {
        stats.most_read_category = Object.keys(categoryCounts).reduce((a, b) => 
          categoryCounts[a] > categoryCounts[b] ? a : b
        );
      }
    }

    // Formater les données d'historique
    const formattedHistory = historyData?.map(item => ({
      id: item.id,
      article_id: item.article_id,
      article_title: item.articles?.title || item.article_title || 'Titre non disponible',
      article_content: item.articles?.content,
      article_summary: item.articles?.ai_summary || item.articles?.summary,
      article_url: item.articles?.url || item.article_url,
      article_source: item.articles?.rss_feeds?.name || item.source || 'Source inconnue',
      article_category: item.articles?.category,
      article_published_at: item.articles?.published_at,
      read_at: item.viewed_at,
      reading_duration: null, // À calculer si on a des données de durée
      is_favorite: false, // À implémenter avec une table favorites
      is_bookmarked: false, // À implémenter avec une table bookmarks
      reading_progress: 100, // Considéré comme lu complètement
      device_type: null, // Pas de données user_agent disponibles
      view_count: item.articles?.view_count || 0,
      image_url: item.articles?.image_url
    })) || [];

    console.log(`✅ ${formattedHistory.length} articles récupérés pour l'historique`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        history: formattedHistory,
        stats: stats,
        total: statsData?.length || 0,
        hasMore: formattedHistory.length === parseInt(limit)
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans get-user-history function:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur serveur',
        message: error.message
      })
    };
  }
};
