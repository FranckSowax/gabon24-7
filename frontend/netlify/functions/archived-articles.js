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
    console.log('📚 Récupération des articles archivés...');
    
    // Calculer la date limite (20h la veille)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(20, 0, 0, 0); // 20h00 la veille
    
    const archiveCutoff = yesterday.toISOString();
    console.log(`📅 Date limite archives: ${archiveCutoff}`);

    // Récupérer les articles archivés (plus anciens que 20h la veille)
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        id,
        title,
        summary,
        ai_summary,
        url,
        image_urls,
        author,
        published_at,
        created_at,
        category,
        view_count,
        sentiment,
        keywords,
        read_time_minutes,
        is_published,
        feeds!inner(
          name,
          media_name,
          category
        )
      `)
      .eq('is_published', true)
      .lt('published_at', archiveCutoff)
      .order('published_at', { ascending: false })
      .limit(200); // Limite pour éviter les timeouts

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    console.log(`✅ ${articles?.length || 0} articles archivés récupérés`);

    // Transformation des articles pour le frontend
    const transformedArticles = articles?.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.ai_summary || 'Résumé non disponible',
      content: article.summary || article.ai_summary || '',
      url: article.url,
      imageUrl: article.image_urls?.[0] || `https://picsum.photos/800/400?random=${article.id}`,
      author: article.author || 'Rédaction',
      publishedAt: article.published_at,
      source: article.feeds?.media_name || article.feeds?.name || 'GabonNews',
      category: article.category || article.feeds?.category || 'actualités',
      viewCount: `${article.view_count || 0} vue${(article.view_count || 0) > 1 ? 's' : ''}`,
      view_count: article.view_count || 0,
      sentiment: article.sentiment || 'neutre',
      keywords: article.keywords || [],
      readTime: `${article.read_time_minutes || 2} min`
    })) || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        articles: transformedArticles,
        total: transformedArticles.length,
        archive_cutoff: archiveCutoff,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans archived-articles:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la récupération des articles archivés',
        articles: [],
        total: 0
      })
    };
  }
};
