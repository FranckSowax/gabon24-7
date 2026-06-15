const axios = require('axios')
const xml2js = require('xml2js')
const supabaseService = require('./supabase-config')

// Utiliser la configuration Supabase existante
const supabase = supabaseService.supabase

// URL du flux RSS des événements
const EVENTS_RSS_URL = 'https://rss.app/feeds/S4lUk8j474PjWeYr.xml';

/**
 * Parse une date depuis différents formats possibles
 */
function parseEventDate(dateString) {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date.toISOString();
  } catch (error) {
    console.warn('Erreur parsing date:', dateString, error.message);
    return null;
  }
}

/**
 * Extrait l'image depuis plusieurs sources possibles dans un item RSS
 */
function extractImageFromRssItem(item, description) {
  // 1. media:content (format standard RSS/Atom)
  const mediaContent = item['media:content']?.[0];
  if (mediaContent) {
    const url = mediaContent.$?.url || mediaContent.url;
    if (url && isValidImageUrl(url)) {
      console.log('📷 Image trouvée via media:content');
      return url;
    }
  }

  // 2. media:thumbnail
  const mediaThumbnail = item['media:thumbnail']?.[0];
  if (mediaThumbnail) {
    const url = mediaThumbnail.$?.url || mediaThumbnail.url;
    if (url && isValidImageUrl(url)) {
      console.log('📷 Image trouvée via media:thumbnail');
      return url;
    }
  }

  // 3. enclosure (podcasts et certains flux)
  const enclosure = item.enclosure?.[0];
  if (enclosure) {
    const url = enclosure.$?.url || enclosure.url;
    const type = enclosure.$?.type || enclosure.type || '';
    if (url && (type.startsWith('image/') || isValidImageUrl(url))) {
      console.log('📷 Image trouvée via enclosure');
      return url;
    }
  }

  // 4. image (certains flux RSS custom)
  const image = item.image?.[0];
  if (image) {
    const url = typeof image === 'string' ? image : (image.url?.[0] || image.$?.url);
    if (url && isValidImageUrl(url)) {
      console.log('📷 Image trouvée via image tag');
      return url;
    }
  }

  // 5. Recherche dans la description HTML
  if (description) {
    // Format <img src="...">
    const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && isValidImageUrl(imgMatch[1])) {
      console.log('📷 Image trouvée via <img> dans description');
      return imgMatch[1];
    }

    // Format background-image: url(...)
    const bgMatch = description.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (bgMatch && isValidImageUrl(bgMatch[1])) {
      console.log('📷 Image trouvée via background-image');
      return bgMatch[1];
    }

    // URLs d'images directes dans le texte
    const urlMatch = description.match(/(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif))/i);
    if (urlMatch && isValidImageUrl(urlMatch[1])) {
      console.log('📷 Image trouvée via URL directe');
      return urlMatch[1];
    }
  }

  // 6. content:encoded (souvent contient du HTML riche)
  const contentEncoded = item['content:encoded']?.[0];
  if (contentEncoded && contentEncoded !== description) {
    const imgMatch = contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch && isValidImageUrl(imgMatch[1])) {
      console.log('📷 Image trouvée via content:encoded');
      return imgMatch[1];
    }
  }

  return null;
}

/**
 * Vérifie si une URL est une image valide
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;

  // Vérifier que c'est une URL valide
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  // Exclure les images trop petites (icônes, pixels de tracking)
  const excludePatterns = [
    /1x1\./i,
    /pixel\./i,
    /tracker/i,
    /spacer/i,
    /blank\./i,
    /favicon/i,
    /icon/i,
    /logo.*small/i
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }

  return true;
}

/**
 * Extrait les informations d'un événement depuis un item RSS
 */
function extractEventInfo(item) {
  const title = item.title?.[0] || 'Événement sans titre';
  const description = item.description?.[0] || item['content:encoded']?.[0] || '';
  const link = item.link?.[0] || item.guid?.[0] || '';
  const pubDate = item.pubDate?.[0] || item['dc:date']?.[0] || '';

  // Extraction d'informations supplémentaires depuis la description
  let location = '';
  let organizer = '';
  let category = 'Événement';

  // Extraction d'image améliorée (multi-sources)
  const imageUrl = extractImageFromRssItem(item, description);

  // Recherche de lieu dans la description
  const locationMatch = description.match(/lieu\s*:?\s*([^\n<]+)/i) ||
                       description.match(/adresse\s*:?\s*([^\n<]+)/i) ||
                       description.match(/où\s*:?\s*([^\n<]+)/i);
  if (locationMatch) {
    location = locationMatch[1].trim();
  }

  // Recherche d'organisateur
  const organizerMatch = description.match(/organisé?\s+par\s*:?\s*([^\n<]+)/i) ||
                        description.match(/organisateur\s*:?\s*([^\n<]+)/i);
  if (organizerMatch) {
    organizer = organizerMatch[1].trim();
  }

  // Détection de catégorie basée sur le titre/description
  const content = (title + ' ' + description).toLowerCase();
  if (content.includes('concert') || content.includes('musique')) {
    category = 'Concert';
  } else if (content.includes('conférence') || content.includes('séminaire')) {
    category = 'Conférence';
  } else if (content.includes('sport') || content.includes('match')) {
    category = 'Sport';
  } else if (content.includes('exposition') || content.includes('art')) {
    category = 'Culture';
  } else if (content.includes('formation') || content.includes('atelier')) {
    category = 'Formation';
  }

  return {
    title: title.substring(0, 255), // Limiter la longueur
    description: description.replace(/<[^>]*>/g, '').substring(0, 1000), // Nettoyer HTML et limiter
    event_date: parseEventDate(pubDate),
    location: location.substring(0, 255),
    url: link,
    image_url: imageUrl || null,
    category,
    organizer: organizer.substring(0, 255),
    is_active: true
  };
}

/**
 * Récupère et traite le flux RSS des événements
 */
async function fetchEvents() {
  try {
    console.log('🎉 Récupération du flux RSS des événements...');
    
    // Récupérer le flux RSS
    const response = await axios.get(EVENTS_RSS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Gabon Insight Events Fetcher'
      }
    });
    
    console.log('✅ Flux RSS récupéré, parsing...');
    
    // Parser le XML
    const parser = new xml2js.Parser({
      explicitArray: true,
      ignoreAttrs: false
    });
    
    const result = await parser.parseStringPromise(response.data);
    const items = result.rss?.channel?.[0]?.item || [];
    
    console.log(`📋 ${items.length} événements trouvés dans le flux RSS`);
    
    if (items.length === 0) {
      console.log('⚠️ Aucun événement trouvé dans le flux RSS');
      return;
    }
    
    // Traiter chaque événement
    const events = items.map(extractEventInfo).filter(event => event.url);
    
    console.log(`🔄 ${events.length} événements valides à traiter`);
    
    // Insérer/mettre à jour les événements dans Supabase
    for (const event of events) {
      try {
        // Vérifier si l'événement existe déjà
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('url', event.url)
          .single();
        
        if (existing) {
          // Mettre à jour l'événement existant
          const { error } = await supabase
            .from('events')
            .update(event)
            .eq('url', event.url);
          
          if (error) {
            console.error('❌ Erreur mise à jour événement:', event.title, error.message);
          } else {
            console.log('🔄 Événement mis à jour:', event.title);
          }
        } else {
          // Insérer nouvel événement
          const { error } = await supabase
            .from('events')
            .insert([event]);
          
          if (error) {
            console.error('❌ Erreur insertion événement:', event.title, error.message);
          } else {
            console.log('✅ Nouvel événement ajouté:', event.title);
          }
        }
      } catch (error) {
        console.error('❌ Erreur traitement événement:', event.title, error.message);
      }
    }
    
    // Désactiver les anciens événements (plus de 7 jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { error: deactivateError } = await supabase
      .from('events')
      .update({ is_active: false })
      .lt('event_date', sevenDaysAgo.toISOString());
    
    if (deactivateError) {
      console.error('❌ Erreur désactivation anciens événements:', deactivateError.message);
    } else {
      console.log('🗑️ Anciens événements désactivés');
    }
    
    console.log('🎉 Synchronisation des événements terminée');
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des événements:', error.message);
    throw error;
  }
}

// Exporter la fonction pour utilisation dans d'autres modules
module.exports = { fetchEvents };

// Exécuter si appelé directement
if (require.main === module) {
  fetchEvents()
    .then(() => {
      console.log('✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script terminé avec erreur:', error.message);
      process.exit(1);
    });
}
