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
    console.log('🏠 Récupération des articles pour la page d\'accueil...');
    
    // Récupérer les articles réels depuis Supabase
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
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    console.log(`✅ ${articles?.length || 0} articles récupérés depuis Supabase`);

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
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans homepage-articles:', error);
    
    // Articles de fallback en cas d'erreur
    const fallbackArticles = [
      {
        id: 'fallback-1',
        title: 'Service temporairement indisponible',
        summary: 'Nous travaillons à rétablir le service. Veuillez réessayer dans quelques instants.',
        content: 'Service en maintenance',
        url: '#',
        imageUrl: 'https://picsum.photos/800/400?random=1',
        author: 'Équipe technique',
        publishedAt: new Date().toISOString(),
        source: 'GabonNews',
        category: 'système',
        viewCount: '0 vue',
        view_count: 0,
        sentiment: 'neutre',
        keywords: ['maintenance'],
        readTime: '1 min'
      }
    ];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        articles: fallbackArticles,
        total: fallbackArticles.length,
        fallback: true
      })
    };
  }
};
