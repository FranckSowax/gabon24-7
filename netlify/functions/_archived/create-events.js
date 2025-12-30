const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    console.log('🎉 Création des événements réels...')

    // Supprimer les anciens événements de démo
    await supabase
      .from('events')
      .delete()
      .like('title', '%Gabon 24/7%')

    // Créer des événements réalistes
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const events = [
      {
        title: 'Conférence Économique Gabon 2024',
        description: 'Grande conférence sur le développement économique du Gabon avec la participation des ministres et experts internationaux.',
        event_date: tomorrow.toISOString(),
        location: 'Centre de Conférences de Libreville',
        url: 'https://gabon24-7.netlify.app/events/conference-economique-2024',
        image_url: '/369309819_1696052364152294_5673051963922538250_n.jpg',
        category: 'Économie',
        organizer: 'Ministère de l\'Économie',
        is_active: true
      },
      {
        title: 'Festival de la Culture Gabonaise',
        description: 'Célébration de la richesse culturelle du Gabon avec spectacles, expositions et dégustations.',
        event_date: nextWeek.toISOString(),
        location: 'Stade Omnisports Omar Bongo',
        url: 'https://gabon24-7.netlify.app/events/festival-culture-2024',
        image_url: '/MOOV-PLAY-FACEBOOK-SITE-GT•1903X574.jpg',
        category: 'Culture',
        organizer: 'Ministère de la Culture',
        is_active: true
      },
      {
        title: 'Sommet de l\'Innovation Technologique',
        description: 'Rencontre des acteurs de la tech gabonaise pour discuter des enjeux de la transformation digitale.',
        event_date: nextMonth.toISOString(),
        location: 'Université Omar Bongo',
        url: 'https://gabon24-7.netlify.app/events/sommet-innovation-2024',
        image_url: '/banner-Studia-2100x-900.jpg',
        category: 'Technologie',
        organizer: 'Gabon Digital',
        is_active: true
      },
      {
        title: 'Forum des Investisseurs Africains',
        description: 'Plateforme d\'échanges entre investisseurs africains et entrepreneurs gabonais.',
        event_date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Hôtel Hilton Libreville',
        url: 'https://gabon24-7.netlify.app/events/forum-investisseurs-2024',
        image_url: '/369309819_1696052364152294_5673051963922538250_n.jpg',
        category: 'Business',
        organizer: 'Chambre de Commerce du Gabon',
        is_active: true
      },
      {
        title: 'Journée Mondiale de l\'Environnement',
        description: 'Sensibilisation à la protection de l\'environnement avec plantation d\'arbres et conférences.',
        event_date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Parc National de la Lopé',
        url: 'https://gabon24-7.netlify.app/events/journee-environnement-2024',
        image_url: '/MOOV-PLAY-FACEBOOK-SITE-GT•1903X574.jpg',
        category: 'Environnement',
        organizer: 'Ministère de l\'Environnement',
        is_active: true
      }
    ]

    // Insérer les événements
    const { data: insertedEvents, error } = await supabase
      .from('events')
      .insert(events)
      .select()

    if (error) {
      throw error
    }

    console.log(`✅ ${insertedEvents.length} événements créés avec succès`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `${insertedEvents.length} événements créés avec succès`,
        events: insertedEvents
      })
    }
  } catch (error) {
    console.error('❌ Erreur création événements:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }
}
