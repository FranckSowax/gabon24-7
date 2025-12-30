// Configuration Unsplash
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || 'demo';
const UNSPLASH_API_URL = 'https://api.unsplash.com/photos/random';

// Mots-clés pour Unsplash selon le contexte gabonais
const getUnsplashKeywords = (articleTitle = '') => {
  const title = articleTitle.toLowerCase();
  
  if (title.includes('politique') || title.includes('gouvernement') || title.includes('président')) {
    return 'government,politics,meeting';
  }
  if (title.includes('économie') || title.includes('business') || title.includes('entreprise')) {
    return 'business,economy,office';
  }
  if (title.includes('sport') || title.includes('football') || title.includes('panthères')) {
    return 'football,sports,stadium';
  }
  if (title.includes('santé') || title.includes('hôpital') || title.includes('médecin')) {
    return 'healthcare,hospital,medical';
  }
  if (title.includes('éducation') || title.includes('école') || title.includes('université')) {
    return 'education,school,students';
  }
  if (title.includes('culture') || title.includes('musique') || title.includes('art')) {
    return 'culture,music,art';
  }
  if (title.includes('transport') || title.includes('route') || title.includes('aéroport')) {
    return 'transportation,road,infrastructure';
  }
  
  // Fallback général pour le Gabon
  return 'africa,tropical,city,people';
};

// Fonction pour obtenir une image Unsplash
const getUnsplashImage = async (fetch, query = 'africa,gabon', width = 800, height = 400) => {
  try {
    const params = new URLSearchParams({
      query,
      orientation: 'landscape',
      w: width,
      h: height,
      fit: 'crop',
      client_id: UNSPLASH_ACCESS_KEY
    });
    
    const response = await fetch(`${UNSPLASH_API_URL}?${params}`);
    
    if (response.ok) {
      const data = await response.json();
      return data.urls.regular || data.urls.small;
    }
    
    // Fallback vers Picsum si Unsplash échoue
    return `https://picsum.photos/${width}/${height}?random=${Date.now()}`;
  } catch (error) {
    console.error('Erreur Unsplash:', error);
    return `https://picsum.photos/${width}/${height}?random=${Date.now()}`;
  }
};

exports.handler = async (event, context) => {
  // Import dynamique de node-fetch pour éviter l'erreur ES Module
  const { default: fetch } = await import('node-fetch');
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const { url, title, fallback } = event.queryStringParameters || {};
    
    // Si fallback=true, retourner directement une image Unsplash (pas besoin d'URL)
    if (fallback === 'true') {
      const keywords = getUnsplashKeywords(title || 'Facebook Social Media');
      const fallbackImageUrl = await getUnsplashImage(fetch, keywords);
      
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': fallbackImageUrl,
          'Cache-Control': 'public, max-age=86400' // Cache 24h pour les fallbacks
        }
      };
    }
    
    // Pour les autres cas, URL est requis
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL parameter is required' })
      };
    }

    // Décoder l'URL et convertir HTTP en HTTPS pour éviter Mixed Content
    let imageUrl = decodeURIComponent(url);
    if (imageUrl.startsWith('http://')) {
      imageUrl = imageUrl.replace('http://', 'https://');
      console.log(`🔒 Conversion HTTP → HTTPS: ${imageUrl}`);
    }
    
    // Validation élargie des URLs d'images - Tous domaines gabonais autorisés
    const isValidImageUrl = (
      imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i) ||
      imageUrl.includes('gabonmediatime.com') ||
      imageUrl.includes('fbcdn.net') ||
      imageUrl.includes('scontent') ||
      imageUrl.includes('facebook.com') ||
      imageUrl.includes('infosgabon.com') ||
      imageUrl.includes('directinfosgabon.com') ||
      imageUrl.includes('g9infos.com') ||
      imageUrl.includes('gabon24') ||
      imageUrl.includes('tvgabon24') ||
      imageUrl.includes('gabonactu.com') ||
      imageUrl.includes('leconfidentiel.ga') ||
      imageUrl.includes('echosdeleco.com') ||
      imageUrl.includes('gabonreview.com') ||
      imageUrl.includes('alibreville.com') ||
      imageUrl.includes('lenouveaugabon.com') ||
      imageUrl.includes('gaboneco.com') ||
      imageUrl.includes('union.sonapresse.com') ||
      imageUrl.includes('gabonclic.info') ||
      imageUrl.includes('depeches241.com') ||
      imageUrl.includes('courrierdesjournalistes.net') ||
      imageUrl.includes('focusgroupemedia.com') ||
      imageUrl.includes('gabonmailinfos.com') ||
      imageUrl.includes('unsplash.com') ||
      imageUrl.includes('picsum.photos') ||
      imageUrl.includes('images.unsplash.com')
    );
    
    if (!isValidImageUrl) {
      // Retourner une image Unsplash au lieu d'une erreur
      const keywords = getUnsplashKeywords(title);
      const fallbackImageUrl = await getUnsplashImage(fetch, keywords);
      
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': fallbackImageUrl
        }
      };
    }

    // FORCER LE PROXY POUR LES IMAGES FACEBOOK (ne pas rediriger vers Unsplash)
    const isFacebookImage = imageUrl.includes('fbcdn.net') || imageUrl.includes('scontent') || imageUrl.includes('facebook.com');
    if (isFacebookImage) {
      console.log(`🔄 [FACEBOOK-PROXY] Proxification forcée pour: ${imageUrl}`);
    }

    // Headers optimisés pour contourner les protections anti-hotlinking
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    // Configuration des referrers et headers spécifiques par domaine
    const domainConfigs = {
      'gabonmediatime.com': { referer: 'https://gabonmediatime.com/' },
      'fbcdn.net': { 
        referer: 'https://www.facebook.com/',
        origin: 'https://www.facebook.com',
        connection: 'keep-alive',
        upgradeInsecureRequests: '1'
      },
      'scontent': { 
        referer: 'https://www.facebook.com/',
        origin: 'https://www.facebook.com'
      },
      'facebook.com': { 
        referer: 'https://www.facebook.com/',
        origin: 'https://www.facebook.com'
      },
      'infosgabon.com': { referer: 'https://infosgabon.com/' },
      'directinfosgabon.com': { referer: 'https://directinfosgabon.com/' },
      'g9infos.com': { referer: 'https://g9infos.com/' },
      'gabon24': { referer: 'https://www.facebook.com/tvgabon24/' },
      'tvgabon24': { referer: 'https://www.facebook.com/tvgabon24/' },
      'gabonactu.com': { referer: 'https://gabonactu.com/' },
      'leconfidentiel.ga': { referer: 'https://www.leconfidentiel.ga/' },
      'echosdeleco.com': { referer: 'https://echosdeleco.com/' },
      'gabonreview.com': { referer: 'https://gabonreview.com/' },
      'alibreville.com': { referer: 'https://alibreville.com/' },
      'lenouveaugabon.com': { referer: 'https://lenouveaugabon.com/' },
      'gaboneco.com': { referer: 'https://gaboneco.com/' },
      'union.sonapresse.com': { referer: 'https://union.sonapresse.com/' },
      'gabonclic.info': { referer: 'https://gabonclic.info/' },
      'depeches241.com': { referer: 'https://depeches241.com/' },
      'courrierdesjournalistes.net': { referer: 'https://courrierdesjournalistes.net/' },
      'focusgroupemedia.com': { referer: 'https://www.focusgroupemedia.com/' },
      'gabonmailinfos.com': { referer: 'https://gabonmailinfos.com/' }
    };
    
    // Appliquer la configuration du domaine correspondant
    for (const [domain, config] of Object.entries(domainConfigs)) {
      if (imageUrl.includes(domain)) {
        if (config.referer) fetchHeaders['Referer'] = config.referer;
        if (config.origin) fetchHeaders['Origin'] = config.origin;
        if (config.connection) fetchHeaders['Connection'] = config.connection;
        if (config.upgradeInsecureRequests) fetchHeaders['Upgrade-Insecure-Requests'] = config.upgradeInsecureRequests;
        break;
      }
    }

    console.log(`Fetching image: ${imageUrl}`);
    
    const response = await fetch(imageUrl, {
      headers: fetchHeaders,
      timeout: 10000
    });

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      
      // POUR LES IMAGES FACEBOOK, NE PAS REDIRIGER VERS UNSPLASH
      if (isFacebookImage) {
        console.log(`❌ [FACEBOOK-PROXY] Échec du proxy Facebook, retour d'une image par défaut`);
        // Retourner une image par défaut ou une erreur 404 plutôt qu'Unsplash
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Image Facebook non accessible' })
        };
      }
      
      // Pour les autres images, retourner une image Unsplash contextuelle
      const keywords = getUnsplashKeywords(title);
      const fallbackImageUrl = await getUnsplashImage(fetch, keywords);
      
      console.log(`Returning Unsplash fallback for failed image: ${imageUrl}`);
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': fallbackImageUrl,
          'Cache-Control': 'public, max-age=3600'
        }
      };
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await response.buffer();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache pendant 1 heure
      },
      body: imageBuffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Error in image proxy:', error);
    
    // POUR LES IMAGES FACEBOOK, NE PAS REDIRIGER VERS UNSPLASH
    const imageUrl = event.queryStringParameters?.url;
    const isFacebookImage = imageUrl && (imageUrl.includes('fbcdn.net') || imageUrl.includes('scontent') || imageUrl.includes('facebook.com'));
    
    if (isFacebookImage) {
      console.log(`❌ [FACEBOOK-PROXY] Erreur générale pour image Facebook`);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Image Facebook non accessible' })
      };
    }
    
    // En cas d'erreur pour les autres images, retourner une image Unsplash
    try {
      const keywords = getUnsplashKeywords(event.queryStringParameters?.title);
      const fallbackImageUrl = await getUnsplashImage(fetch, keywords);
      
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': fallbackImageUrl
        }
      };
    } catch (fallbackError) {
      // Dernier recours: image Picsum
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': `https://picsum.photos/800/400?random=${Date.now()}`
        }
      };
    }
  }
};
