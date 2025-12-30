const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    console.log('🔍 Test structure table articles...');
    
    // 1. Tenter d'insérer un article de test minimal
    const testArticle = {
      id: 'test-structure-' + Date.now(),
      title: 'Test Structure',
      summary: 'Test',
      url: 'https://test.com',
      author: 'Test',
      source: 'Test',
      category: 'actualités',
      published_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('articles')
      .insert([testArticle])
      .select();
    
    if (error) {
      console.error('❌ Erreur insertion test:', error);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: error,
          message: 'Erreur structure table articles',
          details: error.details || error.message
        })
      };
    }
    
    // Nettoyer le test
    await supabase
      .from('articles')
      .delete()
      .eq('id', testArticle.id);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Structure table articles OK',
        inserted: data
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur test structure:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
