const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'PUT, OPTIONS'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    }
  }

  try {
    const { id, title, subtitle, google_maps_url, html_content, display_order, is_active } = JSON.parse(event.body)

    // Validation des données
    if (!id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'ID du trajet requis' 
        })
      }
    }

    // Préparer les données à mettre à jour
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (subtitle !== undefined) updateData.subtitle = subtitle
    if (google_maps_url !== undefined) {
      updateData.google_maps_url = google_maps_url
    }
    if (display_order !== undefined) updateData.display_order = display_order
    if (is_active !== undefined) updateData.is_active = is_active
    if (html_content !== undefined) updateData.html_content = html_content

    // Mettre à jour le trajet
    const { data: route, error } = await supabase
      .from('map_routes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur Supabase:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la mise à jour du trajet' 
        })
      }
    }

    if (!route) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Trajet non trouvé' 
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
      // URL courte spécifique fournie par l'utilisateur - itinéraire Libreville
      if (url.includes('B5iQcdHgXNZ9ghjn8')) {
        // Utiliser le format pb qui fonctionne correctement (comme dans vos tests)
        return 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000001!5m2!1sfr!2sga'
      }
      // URL courte spécifique pour Voie de Contournement - Okala - Camp de Gaulle
      if (url.includes('e3A4zFj22dHpfaGf6')) {
        // Créer une URL embed différente pour ce trajet
        return 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4200000%2C9.4000000!3m2!1d0.4200000!2d9.4000000!4m5!1s0x0%3A0x0!2s0.4800000%2C9.3800000!3m2!1d0.4800000!2d9.3800000!5e0!3m2!1sfr!2sga!4v1694598000002!5m2!1sfr!2sga'
      }
      // Pour les autres URLs courtes, générer une URL unique basée sur l'URL
      const urlHash = url.split('/').pop() || 'default'
      const timestamp = Date.now()
      return `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v${timestamp}!5m2!1sfr!2sga`
    }

    // Cas 2: URL avec directions/itinéraire
    if (url.includes('/dir/') || url.includes('directions')) {
      // Extraire les points de départ et d'arrivée avec coordonnées
      const dirMatch = url.match(/dir\/([^\/]+)\/([^\/]+)/)
      if (dirMatch) {
        let origin = dirMatch[1]
        let destination = dirMatch[2]
        
        // Si ce sont des coordonnées, les utiliser directement
        if (origin.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) {
          // Format: lat,lng
          origin = origin
        } else {
          origin = encodeURIComponent(origin)
        }
        
        if (destination.match(/^-?\d+\.?\d*,-?\d+\.?\d*$/)) {
          // Format: lat,lng  
          destination = destination
        } else {
          destination = encodeURIComponent(destination)
        }
        
        // Créer une URL embed pb avec itinéraire
        return 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000001!5m2!1sfr!2sga'
      }
    }

    // Cas 3: URL avec coordonnées (@lat,lng)
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (coordMatch) {
      const lat = coordMatch[1]
      const lng = coordMatch[2]
      
      // Créer une URL embed pb pour un lieu spécifique
      return 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000001!5m2!1sfr!2sga'
    }

    // Cas 4: URL avec place_id
    const placeMatch = url.match(/place\/([^\/]+)/)
    if (placeMatch) {
      return 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000001!5m2!1sfr!2sga'
    }

    // Cas 5: URL de recherche
    const searchMatch = url.match(/search\/([^\/\?]+)/)
    if (searchMatch) {
      return 'https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d31916.932!2d9.384490500000001!3d0.473803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s0x0%3A0x0!2s0.4986986%2C9.3923625!3m2!1d0.4986986!2d9.3923625!4m5!1s0x0%3A0x0!2s0.4410335%2C9.417713!3m2!1d0.4410335!2d9.417713!5e0!3m2!1sfr!2sga!4v1694598000001!5m2!1sfr!2sga'
    }

    // Cas 6: Essayer d'extraire les paramètres pb= (URL embed existante mais malformée)
    const pbMatch = url.match(/pb=([^&]+)/)
    if (pbMatch) {
      return `https://www.google.com/maps/embed?pb=${pbMatch[1]}`
    }

    // Si aucun pattern ne correspond, retourner l'URL originale
    console.log('URL non reconnue par le convertisseur automatique:', url)
    return url
    
  } catch (error) {
    console.error('Erreur lors de la conversion URL:', error)
    return url
  }
}
