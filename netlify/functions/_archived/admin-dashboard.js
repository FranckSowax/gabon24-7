const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    console.log('📊 Récupération des statistiques dashboard...');

    // Récupérer les statistiques depuis Supabase
    const [articlesCount, feedsCount, todayArticles] = await Promise.all([
      // Nombre total d'articles
      supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .eq('is_published', true),
      
      // Nombre de flux RSS actifs
      supabase
        .from('feeds')
        .select('id', { count: 'exact' })
        .eq('is_active', true),
      
      // Articles d'aujourd'hui
      supabase
        .from('articles')
        .select('id', { count: 'exact' })
        .eq('is_published', true)
        .gte('created_at', new Date().toISOString().split('T')[0])
    ]);

    const stats = {
      total_articles: articlesCount.count || 0,
      active_feeds: feedsCount.count || 0,
      articles_today: todayArticles.count || 0,
      total_views: 0 // À calculer si nécessaire
    };

    console.log('✅ Statistiques récupérées:', stats);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          stats,
          queues: {
            rss: { waiting: 0, active: 0, completed: stats.total_articles },
            messages: { waiting: 0, active: 0, completed: 0 }
          },
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans admin-dashboard:', error);
    
    // Statistiques de fallback
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          stats: {
            total_articles: 0,
            active_feeds: 0,
            articles_today: 0,
            total_views: 0
          },
          queues: {
            rss: { waiting: 0, active: 0, completed: 0 },
            messages: { waiting: 0, active: 0, completed: 0 }
          },
          fallback: true
        }
      })
    };
  }
};
