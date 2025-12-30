const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  try {
    // GET - Récupérer tous les trajets (actifs et inactifs)
    if (event.httpMethod === 'GET') {
      const { data: routes, error } = await supabase
        .from('map_routes')
        .select('*')
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
    }

    // POST - Créer un nouveau trajet
    if (event.httpMethod === 'POST') {
      const { title, subtitle, google_maps_url, html_content, display_order, is_active, category } = JSON.parse(event.body || '{}')

      if (!title) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Le titre est requis' 
          })
        }
      }

      // Validation : soit google_maps_url soit html_content doit être fourni
      if (!google_maps_url && !html_content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'URL Google Maps ou contenu HTML requis' 
          })
        }
      }

      // Générer embed_url si google_maps_url est fourni
      let embed_url = null
      if (google_maps_url) {
        embed_url = convertToEmbedUrl(google_maps_url)
      }

      const { data: route, error } = await supabase
        .from('map_routes')
        .insert([{
          title,
          subtitle: subtitle || null,
          google_maps_url: google_maps_url || null,
          embed_url,
          html_content: html_content || null,
          display_order: display_order || 0,
          is_active: is_active !== undefined ? is_active : true,
          category: category || null
        }])
        .select()
        .single()

      if (error) {
        console.error('Erreur création trajet:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Erreur lors de la création du trajet' 
          })
        }
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Trajet créé avec succès',
          route
        })
      }
    }

    // PUT - Mettre à jour un trajet
    if (event.httpMethod === 'PUT') {
      const pathParts = event.path.split('/')
      const routeId = pathParts[pathParts.length - 1]

      if (!routeId || routeId === 'admin-routes') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'ID du trajet requis' 
          })
        }
      }

      const { title, subtitle, google_maps_url, html_content, display_order, is_active, category } = JSON.parse(event.body || '{}')

      if (!title) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Le titre est requis' 
          })
        }
      }

      // Générer embed_url si google_maps_url est fourni
      let embed_url = null
      if (google_maps_url) {
        embed_url = convertToEmbedUrl(google_maps_url)
      }

      const updateData = {
        title,
        subtitle: subtitle || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true,
        category: category || null,
        updated_at: new Date().toISOString()
      }

      // Ajouter les champs conditionnels
      if (google_maps_url) {
        updateData.google_maps_url = google_maps_url
        updateData.embed_url = embed_url
      }
      
      if (html_content) {
        updateData.html_content = html_content
      }

      const { data: route, error } = await supabase
        .from('map_routes')
        .update(updateData)
        .eq('id', routeId)
        .select()
        .single()

      if (error) {
        console.error('Erreur mise à jour trajet:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Erreur lors de la mise à jour du trajet' 
          })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Trajet mis à jour avec succès',
          route
        })
      }
    }

    // DELETE - Supprimer un trajet
    if (event.httpMethod === 'DELETE') {
      const pathParts = event.path.split('/')
      const routeId = pathParts[pathParts.length - 1]

      if (!routeId || routeId === 'admin-routes') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'ID du trajet requis' 
          })
        }
      }

      const { error } = await supabase
        .from('map_routes')
        .delete()
        .eq('id', routeId)

      if (error) {
        console.error('Erreur suppression trajet:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'Erreur lors de la suppression du trajet' 
          })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Trajet supprimé avec succès'
        })
      }
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
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

function convertToEmbedUrl(url) {
  // Si c'est déjà une URL embed, la retourner telle quelle
  if (url.includes('embed')) {
    return url
  }

  try {
    // Cas 1: URL de partage Google Maps (https://maps.app.goo.gl/...)
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
      // Générer une URL embed basique
      const timestamp = Date.now()
      return `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v${timestamp}!5m2!1sfr!2sga`
    }

    // Cas 2: URL avec directions/itinéraire
    if (url.includes('/dir/') || url.includes('directions')) {
      // Générer une URL embed pour les directions
      const timestamp = Date.now()
      return `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v${timestamp}!5m2!1sfr!2sga`
    }

    // Fallback: retourner l'URL originale
    return url

  } catch (error) {
    console.error('Erreur conversion URL:', error)
    return url
  }
}
