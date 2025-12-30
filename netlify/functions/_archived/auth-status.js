exports.handler = async (event, context) => {
  // Configuration CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }

  // Gérer les requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Pour l'instant, simuler que l'utilisateur n'est pas connecté
    // Dans une vraie implémentation, vous vérifieriez les cookies/tokens d'authentification
    const isLoggedIn = false

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        isLoggedIn: isLoggedIn
      })
    }
  } catch (error) {
    console.error('Erreur auth-status:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur serveur'
      })
    }
  }
}
