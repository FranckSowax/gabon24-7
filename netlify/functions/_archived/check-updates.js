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
    const { lastCheck } = event.queryStringParameters || {};
    
    console.log(`🔄 Vérification des nouveaux articles depuis: ${lastCheck}`);
    
    // Pour la production, toujours indiquer qu'il y a de nouveaux articles
    // car la synchronisation RSS est continue
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        hasNewArticles: true,
        lastUpdate: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Erreur dans check-updates function:', error);
    
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
