const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  }

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
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    }
  }

  try {
    // Récupérer tous les trajets actifs, triés par ordre d'affichage
    const { data: routes, error } = await supabase
      .from('map_routes')
      .select('id, title, subtitle, google_maps_url, embed_url, html_content, display_order, is_active, created_at, updated_at, category')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Erreur Supabase:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la récupération des trajets' 
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        routes: routes || []
      })
    }

  } catch (error) {
    console.error('Erreur:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Erreur serveur interne' 
      })
    }
  }
}
