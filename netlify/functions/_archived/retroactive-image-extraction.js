const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// 🛡️ Validation ultra-simple d'URL d'image
function isValidImageUrl(url) {
  if (!url) return false;
  
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  if (url.includes('safe_image')) {
    return false;
  }
  
  return true;
}

// 🔄 Proxy d'image UNIQUEMENT pour CORS
function processImageUrl(imageUrl) {
  if (!imageUrl || !isValidImageUrl(imageUrl)) {
    return null;
  }
  
  const needsProxy = [
    'gabonews.com', 'infogabon.ga', 'gabon24.com', 'union.sonapresse.com', 'gabonactu.com',
    'facebook.com', 'fbcdn.net', 'fbsbx.com', 'scontent.xx.fbcdn.net', 'scontent-', 'external.xx.fbcdn.net'
  ];
  
  const needsProxyCheck = needsProxy.some(domain => imageUrl.includes(domain));
  
  if (needsProxyCheck) {
    if (imageUrl.includes('facebook.com') || imageUrl.includes('fbcdn.net') || imageUrl.includes('fbsbx.com')) {
      console.log(`📘 [RETROACTIVE-FACEBOOK] Image proxifiée: ${imageUrl.substring(0, 80)}...`);
    }
    return `/.netlify/functions/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }
  
  return imageUrl;
}

// 🎯 Extraction d'image depuis URL d'article
function extractImageFromUrl(articleUrl) {
  if (!articleUrl) return null;
  
  try {
    const url = new URL(articleUrl);
    const domain = url.hostname.replace('www.', '');
    
    const patterns = {
      'gabonmediatime.com': () => `${url.protocol}//${url.hostname}/wp-content/uploads/2025/09/default-article.jpg`,
      'gabon-info.com': () => `${url.protocol}//${url.hostname}/wp-content/uploads/2025/09/default.jpg`,
      'depeches241.com': () => `${url.protocol}//${url.hostname}/wp-content/themes/depeches/images/logo.png`,
      'agpgabon.ga': () => `${url.protocol}//${url.hostname}/wp-content/uploads/2025/09/agp-default.jpg`
    };
    
    const extractor = patterns[domain];
    if (extractor) {
      const imageUrl = extractor();
      console.log(`🎯 [RETROACTIVE] Pattern URL pour ${domain}`);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// 🎨 Image par défaut basée sur la source
function getDefaultImageBySource(source) {
  if (!source) return null;
  
  const sourceLower = source.toLowerCase();
  
  if (sourceLower.includes('gabon 24')) return '/images/sources/gabon-24-logo.jpg';
  if (sourceLower.includes('gabon actu')) return '/images/sources/gabon-actu-logo.jpg';
  if (sourceLower.includes('agp')) return '/images/sources/agp-logo.jpg';
  if (sourceLower.includes('gabon media time')) return '/images/sources/gabon-media-time-logo.jpg';
  if (sourceLower.includes('gabon review')) return '/images/sources/gabon-review-logo.jpg';
  if (sourceLower.includes('union')) return '/images/sources/union-logo.jpg';
  if (sourceLower.includes('libreville')) return '/images/sources/libreville-logo.jpg';
  
  return null;
}

// 📍 Extraction de source depuis URL
function extractSourceFromLink(link) {
  try {
    const url = new URL(link);
    const domain = url.hostname.replace('www.', '');
    
    const sourceMap = {
      'gabonews.com': 'Gabon News',
      'infogabon.ga': 'Info Gabon',
      'gabon24.com': 'Gabon 24',
      'union.sonapresse.com': 'L\'Union',
      'gabonactu.com': 'Gabon Actu',
      'agpgabon.ga': 'AGP',
      'gabonmediatime.com': 'Gabon Media Time',
      'gabon-info.com': 'Gabon Info',
      'depeches241.com': 'Dépêches 241'
    };
    
    return sourceMap[domain] || domain;
  } catch (error) {
    return 'Source inconnue';
  }
}

// 🔍 Extraction d'image depuis contenu
function extractImageFromContent(content) {
  if (!content) return null;
  
  const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
  if (imgMatch && imgMatch[1] && isValidImageUrl(imgMatch[1])) {
    return imgMatch[1];
  }
  
  return null;
}

// 🚀 Fonction principale de traitement rétroactif
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Supabase non configuré'
      })
    };
  }

  try {
    console.log('🔄 [RETROACTIVE] Début du traitement rétroactif des images (TOUS les articles des 7 derniers jours)');
    
    // 1. Calculer la date limite (7 jours)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    console.log(`📅 [RETROACTIVE] Période: ${sevenDaysAgo.toISOString()} à ${now.toISOString()}`);
    
    // 2. Récupérer les articles des 7 derniers jours sans image_url
    const { data: articlesWithoutImages, error: fetchError } = await supabase
      .from('articles')
      .select('id, title, url, content, summary, rss_feeds(name)')
      .is('image_url', null)
      .gte('created_at', sevenDaysAgo.toISOString())
      .lte('created_at', now.toISOString())
      .order('created_at', { ascending: false })
; // Traiter TOUS les articles des 7 derniers jours sans limite
    
    if (fetchError) {
      throw new Error(`Erreur récupération articles: ${fetchError.message}`);
    }
    
    console.log(`📊 [RETROACTIVE] ${articlesWithoutImages.length} articles sans image trouvés (7 derniers jours)`);
    
    let stats = {
      processed: 0,
      found: 0,
      updated: 0,
      facebook_proxied: 0,
      pattern_matched: 0,
      content_extracted: 0,
      default_assigned: 0,
      errors: 0
    };
    
    // 3. Traiter chaque article
    for (const article of articlesWithoutImages) {
      try {
        stats.processed++;
        let finalImageUrl = null;
        
        console.log(`🔍 [RETROACTIVE] Traitement: ${article.title?.substring(0, 50)}...`);
        
        // Priorité 1: Extraction depuis content/summary
        const contentToSearch = article.content || article.summary || '';
        if (contentToSearch) {
          const contentImage = extractImageFromContent(contentToSearch);
          if (contentImage) {
            finalImageUrl = processImageUrl(contentImage);
            stats.content_extracted++;
            console.log(`📄 [RETROACTIVE] Image extraite du contenu`);
          }
        }
        
        // Priorité 2: Patterns depuis URL
        if (!finalImageUrl && article.url) {
          const urlBasedImage = extractImageFromUrl(article.url);
          if (urlBasedImage) {
            finalImageUrl = processImageUrl(urlBasedImage);
            stats.pattern_matched++;
            console.log(` [RETROACTIVE] Image pattern URL`);
          }
        }
        
        // Priorité 4: Traitement spécial pour URLs Facebook Supabase
        if (article.url && (article.url.includes('facebook.com') || article.url.includes('fb.com'))) {
          console.log(` [SUPABASE-FACEBOOK] URL Facebook détectée (sans contenu): ${article.url.substring(0, 80)}...`);
          // Pour Facebook sans contenu, utiliser fallback Unsplash
          finalImageUrl = `/.netlify/functions/image-proxy?fallback=true&title=Facebook Social Media`;
          stats.found++;
          stats.facebook_proxied++;
        }
        
        // Priorité 3: Traitement spécial Facebook - Extraction vraie image
        if (!finalImageUrl && article.url && (article.url.includes('facebook.com') || article.url.includes('fb.com'))) {
          console.log(` [RETROACTIVE-FACEBOOK] URL Facebook détectée: ${article.url.substring(0, 80)}...`);
          
          // Essayer d'extraire l'image depuis le contenu Facebook
          try {
            // Si on a du contenu, chercher les images Facebook
            if (contentToSearch) {
              const fbImageMatch = contentToSearch.match(/https:\/\/[^"'\s]*(?:fbcdn\.net|scontent[^"'\s]*)[^"'\s]*\.(?:jpg|jpeg|png|gif|webp)/i);
              if (fbImageMatch && fbImageMatch[0]) {
                finalImageUrl = `/.netlify/functions/image-proxy?url=${encodeURIComponent(fbImageMatch[0])}`;
                stats.facebook_proxied++;
                console.log(` [RETROACTIVE-FACEBOOK] Image extraite: ${fbImageMatch[0].substring(0, 60)}...`);
              }
            }
            
            // Si pas d'image trouvée, utiliser une image générique Facebook via Unsplash
            if (!finalImageUrl) {
              finalImageUrl = `/.netlify/functions/image-proxy?fallback=true&title=Facebook Social Media`;
              stats.facebook_proxied++;
              console.log(`📘 [RETROACTIVE-FACEBOOK] Fallback Unsplash pour Facebook`);
            }
          } catch (fbError) {
            console.warn(`⚠️ Erreur extraction Facebook:`, fbError.message);
            finalImageUrl = `/.netlify/functions/image-proxy?fallback=true&title=Facebook Social Media`;
            stats.facebook_proxied++;
          }
        }
        
        // Priorité 4: Image par défaut basée sur la source
        if (!finalImageUrl) {
          const source = article.rss_feeds?.name || extractSourceFromLink(article.url || '#');
          finalImageUrl = getDefaultImageBySource(source);
          if (finalImageUrl) {
            stats.default_assigned++;
            console.log(`🎨 [RETROACTIVE] Image par défaut: ${source}`);
          }
        }
        
        // 4. Sauvegarder l'image trouvée
        if (finalImageUrl) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: finalImageUrl })
            .eq('id', article.id);
          
          if (updateError) {
            console.error(`❌ [RETROACTIVE] Erreur mise à jour article ${article.id}:`, updateError);
            stats.errors++;
          } else {
            stats.found++;
            stats.updated++;
            console.log(`✅ [RETROACTIVE] Image sauvegardée pour: ${article.title?.substring(0, 30)}...`);
          }
        }
        
      } catch (articleError) {
        console.error(`❌ [RETROACTIVE] Erreur traitement article ${article.id}:`, articleError);
        stats.errors++;
      }
    }
    
    // 5. Logs finaux
    console.log(`✅ [RETROACTIVE] Traitement terminé:`);
    console.log(`📊 Articles traités: ${stats.processed}`);
    console.log(`🖼️ Images trouvées: ${stats.found}`);
    console.log(`💾 Articles mis à jour: ${stats.updated}`);
    console.log(`📄 Images extraites du contenu: ${stats.content_extracted}`);
    console.log(`🎯 Images pattern URL: ${stats.pattern_matched}`);
    console.log(`📘 Images Facebook proxifiées: ${stats.facebook_proxied}`);
    console.log(`🎨 Images par défaut: ${stats.default_assigned}`);
    console.log(`❌ Erreurs: ${stats.errors}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Traitement rétroactif terminé',
        period: '7 derniers jours',
        stats: stats,
        processed_articles: articlesWithoutImages.length
      })
    };
    
  } catch (error) {
    console.error('❌ [RETROACTIVE] Erreur générale:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        function: 'retroactive-image-extraction'
      })
    };
  }
};
