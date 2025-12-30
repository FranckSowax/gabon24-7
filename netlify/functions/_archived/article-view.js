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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Extraire l'ID de l'article depuis le body de la requête
    const requestBody = JSON.parse(event.body || '{}');
    const articleId = requestBody.articleId;

    if (!articleId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'ID article manquant dans la requête' 
        })
      };
    }

    console.log(`👁️ Incrémentation des vues pour l'article: ${articleId}`);

    // Récupérer l'article pour obtenir le view_count actuel
    const { data: currentArticle, error: fetchError } = await supabase
      .from('articles')
      .select('view_count')
      .eq('id', articleId)
      .single();

    if (fetchError) {
      console.error('❌ Erreur récupération article:', fetchError);
      throw fetchError;
    }

    const newViewCount = (currentArticle?.view_count || 0) + 1;

    // Incrémenter le compteur de vues
    const { data, error } = await supabase
      .from('articles')
      .update({ 
        view_count: newViewCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', articleId)
      .select('view_count')
      .single();

    if (error) {
      console.error('❌ Erreur incrémentation vues:', error);
      throw error;
    }

    console.log(`✅ Vues incrémentées: ${data?.view_count || newViewCount}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        view_count: data?.view_count || newViewCount,
        message: 'Vue comptabilisée avec succès'
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans article-view:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la comptabilisation de la vue'
      })
    };
  }
};
