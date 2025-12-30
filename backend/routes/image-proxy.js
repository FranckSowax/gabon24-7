/**
 * 🖼️ PROXY D'IMAGES - Contournement CORS
 * Récupère les images depuis Facebook/sites externes sans restrictions CORS
 *
 * ⚠️ SÉCURITÉ: Protection contre SSRF (Server-Side Request Forgery)
 * - Blocage des IPs privées/locales
 * - Liste blanche de domaines autorisés
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// ==================== SÉCURITÉ SSRF ====================

/**
 * Liste blanche des domaines autorisés pour le proxy d'images
 * MISE À JOUR: 2025-12-30 - Liste étendue pour couvrir tous les médias gabonais
 */
const ALLOWED_DOMAINS = [
  // Facebook & Meta
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'fbcdn.net', 'scontent.xx.fbcdn.net', 'external.xx.fbcdn.net',
  'scontent-cdg4-2.xx.fbcdn.net', 'scontent-cdg4-1.xx.fbcdn.net',
  'scontent-cdt1-1.xx.fbcdn.net', 'scontent.flbv1-1.fna.fbcdn.net',
  'lookaside.fbsbx.com', 'platform-lookaside.fbsbx.com',
  'instagram.com', 'cdninstagram.com', 'scontent.cdninstagram.com',

  // Médias gabonais - Liste complète
  'gabonactu.com', 'www.gabonactu.com',
  'gabonreview.com', 'www.gabonreview.com',
  'directinfosgabon.com', 'www.directinfosgabon.com',
  'gabonmediatime.com', 'www.gabonmediatime.com',
  'gabonmailinfos.com', 'www.gabonmailinfos.com',
  'focusgroupemedia.com', 'www.focusgroupemedia.com',
  'insidenews241.com', 'www.insidenews241.com',
  'kongossanews.info', 'www.kongossanews.info',
  'vxp241.com', 'www.vxp241.com',
  'lunion.ga', 'www.lunion.ga', 'union.sonapresse.com',
  'gaboneco.com', 'www.gaboneco.com', 'gabon-eco.com',
  'gabonallsport.com', 'www.gabonallsport.com',
  'sport241.com', 'www.sport241.com',
  'gaboma.info', 'www.gaboma.info',
  'gabon-info.com', 'www.gabon-info.com',
  'gabonclic.info', 'www.gabonclic.info',
  'infogabon.com', 'www.infogabon.com', 'infogabon.ga', 'fr.infosgabon.com',
  'depeches241.com', 'www.depeches241.com',
  'gabon-newsroom.com', 'www.gabon-newsroom.com',
  'journaldugabon.com', 'www.journaldugabon.com',
  'mediapostegabon.com', 'www.mediapostegabon.com',
  'echosdeleco.com', 'www.echosdeleco.com',
  'lenouveaugabon.com', 'www.lenouveaugabon.com',
  '7joursinfo.com', 'www.7joursinfo.com',
  'g9infos.com', 'www.g9infos.com',
  'leconfidentiel.net', 'www.leconfidentiel.net', 'leconfidentiel.ga',
  'agenceequateur.com', 'www.agenceequateur.com',
  'courrierdesjournalistes.net', 'www.courrierdesjournalistes.net',
  'letouracovert.com', 'www.letouracovert.com',
  'peupleinfos.com', 'www.peupleinfos.com',
  'relaisinfosgabon.com', 'www.relaisinfosgabon.com',
  'biba241.com', 'www.biba241.com',
  'agpgabon.ga', 'www.agpgabon.ga',
  'sonapresse.com', 'www.sonapresse.com',
  'gabonews.com', 'www.gabonews.com',
  'gabon24.com', 'www.gabon24.com', 'gabon24.tv',
  'lalibreville.com', 'www.lalibreville.com',
  'actualite-gabon.com', 'www.actualite-gabon.com',
  'bdpmodwo.com', 'www.bdpmodwo.com',
  'infos241.com', 'www.infos241.com',
  'gabonenerveur.com', 'www.gabonenerveur.com',
  'direct-infos.com', 'www.direct-infos.com',
  'mediaguinee.org', 'www.mediaguinee.org',

  // Médias internationaux Afrique
  'rfi.fr', 'www.rfi.fr',
  'latribune-afrique.com', 'www.latribune-afrique.com',
  'africaintelligence.fr', 'www.africaintelligence.fr',
  'jeuneafrique.com', 'www.jeuneafrique.com',
  'afrik.com', 'www.afrik.com',
  'lemonde.fr', 'www.lemonde.fr',
  'france24.com', 'www.france24.com',
  'tv5monde.com', 'www.tv5monde.com',

  // CDN et images courantes
  'cloudinary.com', 'res.cloudinary.com',
  'imgur.com', 'i.imgur.com',
  'wp.com', 'i0.wp.com', 'i1.wp.com', 'i2.wp.com', 'i3.wp.com',
  'googleusercontent.com', 'lh3.googleusercontent.com',
  'twimg.com', 'pbs.twimg.com', 'abs.twimg.com',
  'supabase.co', 'ykytsadwfqoyusleoflf.supabase.co',

  // CDN WordPress et hébergeurs courants
  'wordpress.com', 's0.wp.com', 's1.wp.com', 's2.wp.com',
  'secure.gravatar.com', 'gravatar.com',
  'staticflickr.com', 'live.staticflickr.com',
  'unsplash.com', 'images.unsplash.com',
  'pexels.com', 'images.pexels.com',

  // Services RSS
  'rss.app', 'rss2json.com', 'feedburner.com'
];

/**
 * Vérifie si une IP est privée/locale (protection SSRF)
 */
function isPrivateIP(hostname) {
  // Patterns d'IPs privées
  const privatePatterns = [
    /^127\./,                      // Localhost
    /^10\./,                       // Classe A privée
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Classe B privée
    /^192\.168\./,                 // Classe C privée
    /^169\.254\./,                 // Link-local
    /^0\./,                        // Réseau local
    /^::1$/,                       // IPv6 localhost
    /^fc00:/,                      // IPv6 privée
    /^fe80:/,                      // IPv6 link-local
  ];

  return privatePatterns.some(pattern => pattern.test(hostname));
}

/**
 * Vérifie si l'URL est sûre (pas de SSRF)
 */
function isUrlSafe(urlString) {
  try {
    const parsed = new URL(urlString);
    const hostname = parsed.hostname.toLowerCase();

    // Bloquer les protocoles non-HTTP
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      console.warn('🚫 SSRF Protection: Protocole non autorisé:', parsed.protocol);
      return false;
    }

    // Bloquer localhost et variantes
    if (hostname === 'localhost' || hostname === '0.0.0.0') {
      console.warn('🚫 SSRF Protection: Localhost bloqué');
      return false;
    }

    // Bloquer les IPs privées
    if (isPrivateIP(hostname)) {
      console.warn('🚫 SSRF Protection: IP privée bloquée:', hostname);
      return false;
    }

    // Vérifier la liste blanche des domaines
    const isAllowed = ALLOWED_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.warn('🚫 SSRF Protection: Domaine non autorisé:', hostname);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('🚫 SSRF Protection: URL invalide:', urlString);
    return false;
  }
}

/**
 * GET /api/image-proxy/facebook-og
 * Récupère l'image Open Graph d'une URL Facebook
 */
router.get('/facebook-og', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL manquante' });
    }

    // 🔒 Vérification SSRF
    if (!isUrlSafe(url)) {
      return res.status(403).json({ success: false, error: 'URL non autorisée' });
    }

    console.log('🔍 Proxy: Récupération image Facebook depuis:', url);
    
    // Plusieurs stratégies en cascade
    
    // 1. Essayer avec User-Agent Facebook crawler
    let imageUrl = await tryFacebookCrawler(url);
    
    // 2. Fallback: Essayer avec User-Agent mobile
    if (!imageUrl) {
      imageUrl = await tryMobileScraping(url);
    }
    
    // 3. Fallback: Essayer d'extraire depuis l'URL du post
    if (!imageUrl) {
      imageUrl = await tryExtractFromPostId(url);
    }
    
    if (imageUrl) {
      console.log('✅ Image trouvée:', imageUrl);
      return res.json({ success: true, imageUrl });
    }
    
    console.log('❌ Aucune image trouvée');
    return res.json({ success: false, error: 'Image non trouvée' });
    
  } catch (error) {
    console.error('❌ Erreur proxy Facebook:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-proxy/facebook-image
 * Résout l'image d'un post Facebook (og:image) et la renvoie en binaire (stream)
 */
router.get('/facebook-image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL manquante' });
    }

    // 🔒 Vérification SSRF
    if (!isUrlSafe(url)) {
      return res.status(403).json({ success: false, error: 'URL non autorisée' });
    }

    // 1) Tenter d'obtenir l'URL de l'image via nos stratégies
    let imageUrl = await tryFacebookCrawler(url);
    if (!imageUrl) imageUrl = await tryMobileScraping(url);
    if (!imageUrl) imageUrl = await tryExtractFromPostId(url);

    if (!imageUrl) {
      return res.status(404).json({ success: false, error: 'Image Facebook introuvable' });
    }

    // 2) Récupérer l'image et la streamer
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      maxRedirects: 8,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.facebook.com/'
      }
    });

    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Image-Source', 'facebook-resolved');
    return res.send(Buffer.from(response.data));

  } catch (error) {
    console.error('❌ Erreur facebook-image:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-proxy (endpoint par défaut)
 * Proxy général pour récupérer n'importe quelle image (contournement CORS)
 * Appelé par ArticleCard avec ?url=...
 * 🔒 SÉCURISÉ: Protection SSRF avec liste blanche de domaines
 */
router.get('/', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL manquante' });
    }

    // 🔒 Vérification SSRF - CRITIQUE pour ce endpoint générique
    if (!isUrlSafe(url)) {
      console.warn('🚫 Image proxy: URL non autorisée:', url);
      return res.status(403).json({
        success: false,
        error: 'URL non autorisée'
      });
    }

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });

    // Retourner l'image directement
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(response.data);

  } catch (error) {
    console.error('❌ Erreur proxy image (/):', error.message);
    // Retourner une image placeholder transparente en cas d'erreur
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/image-proxy/fetch-image
 * Proxy général pour récupérer n'importe quelle image (contournement CORS)
 * 🔒 SÉCURISÉ: Protection SSRF avec liste blanche de domaines
 */
router.get('/fetch-image', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL manquante' });
    }

    // 🔒 Vérification SSRF - CRITIQUE pour ce endpoint générique
    if (!isUrlSafe(url)) {
      return res.status(403).json({
        success: false,
        error: 'URL non autorisée. Seuls les domaines de médias gabonais et CDN connus sont acceptés.'
      });
    }

    console.log('🖼️ Proxy: Récupération image depuis:', url);

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*'
      }
    });
    
    // Retourner l'image directement
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache 24h
    res.send(response.data);
    
  } catch (error) {
    console.error('❌ Erreur proxy image:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/image-proxy/batch-facebook
 * Récupérer les images de plusieurs URLs Facebook en batch
 * 🔒 SÉCURISÉ: Vérification SSRF pour chaque URL
 */
router.post('/batch-facebook', async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ success: false, error: 'URLs array manquant' });
    }

    // Limiter le nombre d'URLs par requête
    if (urls.length > 20) {
      return res.status(400).json({ success: false, error: 'Maximum 20 URLs par requête' });
    }

    console.log(`📦 Batch: Traitement de ${urls.length} URLs Facebook`);

    const results = await Promise.allSettled(
      urls.map(async (url) => {
        try {
          // 🔒 Vérification SSRF pour chaque URL
          if (!isUrlSafe(url)) {
            return { url, imageUrl: null, success: false, error: 'URL non autorisée' };
          }

          let imageUrl = await tryFacebookCrawler(url);
          if (!imageUrl) imageUrl = await tryMobileScraping(url);
          if (!imageUrl) imageUrl = await tryExtractFromPostId(url);

          return { url, imageUrl, success: !!imageUrl };
        } catch (error) {
          return { url, imageUrl: null, success: false, error: error.message };
        }
      })
    );
    
    const processed = results.map(r => r.status === 'fulfilled' ? r.value : r.reason);
    const successful = processed.filter(p => p.success).length;
    
    console.log(`✅ Batch terminé: ${successful}/${urls.length} images trouvées`);
    
    res.json({ success: true, results: processed, stats: { total: urls.length, successful } });
    
  } catch (error) {
    console.error('❌ Erreur batch:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== HELPERS ====================

/**
 * Stratégie 1: User-Agent Facebook Crawler
 */
async function tryFacebookCrawler(url) {
  try {
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Open Graph
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && isValidImageUrl(imageUrl)) {
      console.log('  ✅ Stratégie 1 (FB Crawler): Image trouvée');
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.log('  ⚠️ Stratégie 1 échouée:', error.message);
    return null;
  }
}

/**
 * Stratégie 2: User-Agent Mobile + Scraping avancé
 */
async function tryMobileScraping(url) {
  try {
    // Convertir l'URL desktop en mobile
    const mobileUrl = url.replace('www.facebook.com', 'm.facebook.com');
    
    const response = await axios.get(mobileUrl, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://m.facebook.com/'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Chercher les images dans le contenu mobile
    let imageUrl = null;
    
    // Meta tags
    imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && isValidImageUrl(imageUrl)) {
      console.log('  ✅ Stratégie 2 (Mobile): Image OG trouvée');
      return imageUrl;
    }
    
    // Images dans le contenu (format mobile)
    const images = [];
    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && isValidImageUrl(src) && !isIconOrAvatar(src)) {
        images.push(src);
      }
    });
    
    if (images.length > 0) {
      // Prendre la plus grande image
      const largestImage = images.sort((a, b) => b.length - a.length)[0];
      console.log('  ✅ Stratégie 2 (Mobile): Image contenu trouvée');
      return largestImage;
    }
    
    return null;
  } catch (error) {
    console.log('  ⚠️ Stratégie 2 échouée:', error.message);
    return null;
  }
}

/**
 * Stratégie 3: Extraction depuis l'ID du post
 */
async function tryExtractFromPostId(url) {
  try {
    // Extraire l'ID du post depuis l'URL
    const postIdMatch = url.match(/\/posts\/([^/?]+)/);
    if (!postIdMatch) {
      return null;
    }
    
    const postId = postIdMatch[1];
    
    // Essayer avec l'URL de l'API Graph (publique, limitée)
    // Note: Ceci peut nécessiter un access token pour certains posts
    const graphUrl = `https://graph.facebook.com/v18.0/${postId}?fields=full_picture,picture&access_token=`;
    
    // Pour l'instant, on essaie juste de récupérer via scraping de la page directe
    const directUrl = `https://www.facebook.com/${postId}`;
    
    const response = await axios.get(directUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const imageUrl = $('meta[property="og:image"]').attr('content');
    
    if (imageUrl && isValidImageUrl(imageUrl)) {
      console.log('  ✅ Stratégie 3 (Post ID): Image trouvée');
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.log('  ⚠️ Stratégie 3 échouée:', error.message);
    return null;
  }
}

/**
 * Validation URL image
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Vérifier que c'est une URL valide
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  
  // Exclure les URLs suspectes
  if (url.includes('base64')) return false;
  if (url.length > 2000) return false;
  
  return true;
}

/**
 * Filtrer les icônes/avatars
 */
function isIconOrAvatar(url) {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('icon') ||
         lowerUrl.includes('avatar') ||
         lowerUrl.includes('profile') ||
         lowerUrl.includes('logo') ||
         lowerUrl.includes('emoji') ||
         url.includes('_s.') || // Small size
         url.includes('_n.'); // Thumbnail
}

module.exports = router;
