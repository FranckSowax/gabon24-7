const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fonction pour extraire les images depuis le contenu HTML d'un article
async function extractImagesFromArticle(url, content = null) {
  const images = [];
  
  try {
    let htmlContent = content;
    
    // Si pas de contenu, essayer de récupérer la page
    if (!htmlContent && url) {
      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
          }
        });
        htmlContent = response.data;
      } catch (fetchError) {
        console.warn(`Impossible de récupérer le contenu de ${url}:`, fetchError.message);
        return images;
      }
    }
    
    if (!htmlContent) return images;
    
    // Expressions régulières pour extraire différents types d'images
    const imagePatterns = [
      // Images Facebook CDN
      /https:\/\/scontent[^"'\s]+\.fbcdn\.net\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi,
      // Images Open Graph
      /<meta\s+property="og:image"\s+content="([^"]+)"/gi,
      // Images Twitter Card
      /<meta\s+name="twitter:image"\s+content="([^"]+)"/gi,
      // Balises img standard
      /<img[^>]+src="([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"[^>]*>/gi,
      // Images dans le contenu JSON-LD
      /"image":\s*"([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/gi,
      // Images dans les données structurées
      /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?"image":\s*"([^"]+)"[\s\S]*?<\/script>/gi,
      // Images Gabon 24 spécifiques
      /https:\/\/[^"'\s]*gabon[^"'\s]*\.(jpg|jpeg|png|gif|webp)/gi,
      // Images WordPress/CMS
      /wp-content\/uploads\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/gi
    ];
    
    // Extraire toutes les images trouvées
    imagePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(htmlContent)) !== null) {
        let imageUrl = match[1] || match[0];
        
        // Nettoyer l'URL
        imageUrl = imageUrl.split('?')[0]; // Supprimer les paramètres de requête
        
        // Vérifier que l'URL est valide
        if (isValidImageUrl(imageUrl)) {
          images.push({
            url: imageUrl,
            type: getImageType(imageUrl),
            source: getImageSource(imageUrl)
          });
        }
      }
    });
    
    // Dédupliquer et trier par priorité
    const uniqueImages = deduplicateImages(images);
    return prioritizeImages(uniqueImages);
    
  } catch (error) {
    console.error('Erreur extraction images:', error);
    return images;
  }
}

// Vérifier si une URL d'image est valide
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Vérifier le format de base
  const urlRegex = /^https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)$/i;
  if (!urlRegex.test(url)) {
    // Exceptions pour certains domaines
    const exceptions = [
      'fbcdn.net',
      'facebook.com',
      'scontent',
      'gabon24',
      'gabonmediatime'
    ];
    
    if (!exceptions.some(exception => url.includes(exception))) {
      return false;
    }
  }
  
  // Exclure les images de petite taille ou placeholder
  const excludePatterns = [
    /1x1\./,
    /blank\./,
    /placeholder/i,
    /avatar/i,
    /profile/i,
    /icon/i,
    /logo/i
  ];
  
  return !excludePatterns.some(pattern => pattern.test(url));
}

// Déterminer le type d'image
function getImageType(url) {
  if (url.includes('fbcdn.net') || url.includes('facebook.com')) return 'facebook';
  if (url.includes('og:image') || url.includes('twitter:image')) return 'social';
  if (url.includes('wp-content')) return 'wordpress';
  if (url.includes('gabon')) return 'gabon_media';
  return 'article';
}

// Déterminer la source de l'image
function getImageSource(url) {
  try {
    const domain = new URL(url).hostname;
    return domain;
  } catch {
    return 'unknown';
  }
}

// Dédupliquer les images
function deduplicateImages(images) {
  const seen = new Set();
  return images.filter(img => {
    const key = img.url.split('?')[0]; // Ignorer les paramètres
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Prioriser les images par qualité/pertinence
function prioritizeImages(images) {
  return images.sort((a, b) => {
    const priorities = {
      'social': 3,      // Open Graph, Twitter Card
      'facebook': 2,    // Images Facebook
      'gabon_media': 2, // Médias gabonais
      'wordpress': 1,   // Images CMS
      'article': 1      // Images d'article
    };
    
    return (priorities[b.type] || 0) - (priorities[a.type] || 0);
  });
}

// Fonction principale pour traiter les articles récents
async function processRecentImages() {
  // Initialiser Supabase à l'intérieur de la fonction
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const startTime = Date.now();
  let mainStats = {
    success: true,
    totalArticles: 0,
    articlesProcessed: 0,
    imagesFound: 0,
    imagesUpdated: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Calculer la date limite (24h en arrière)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Récupérer les articles récents sans images ou avec des images cassées
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, url, title, content, summary, image_url, created_at')
      .gte('created_at', twentyFourHoursAgo)
      .or('image_url.is.null,image_url.eq.')
      .order('created_at', { ascending: false })
      .limit(20); // Limiter pour éviter les timeouts

    if (error) {
      console.error('❌ Erreur récupération articles:', error);
      return { success: false, error: error.message };
    }

    if (!articles || articles.length === 0) {
      return { 
        success: true, 
        message: 'Aucun article récent sans image trouvé',
        processed: 0,
        updated: 0 
      };
    }

    console.log(`📰 ${articles.length} articles sans images à traiter`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    const results = [];
    const detailedStats = {
      bySource: {},
      imageTypes: {
        facebook: 0,
        social: 0,
        gabon_media: 0,
        wordpress: 0,
        article: 0
      }
    };

    for (const article of articles) {
      try {
        console.log(`🔍 Extraction images: ${article.title?.substring(0, 60)}...`);
        
        // Extraire les images de l'article
        const extractedImages = await extractImagesFromArticle(
          article.url,
          article.content || article.summary
        );
        
        if (extractedImages.length > 0) {
          // Prendre la meilleure image
          const bestImage = extractedImages[0];
          let finalImageUrl = bestImage.url;
          
          // Utiliser le proxy pour les images problématiques
          if (needsProxy(bestImage.url)) {
            const encodedUrl = encodeURIComponent(bestImage.url);
            finalImageUrl = `/.netlify/functions/image-proxy?url=${encodedUrl}`;
          }
          
          // Mettre à jour l'article
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: finalImageUrl })
            .eq('id', article.id);
            
          if (!updateError) {
            updated++;
            
            // Statistiques
            const sourceName = 'Extracted'; // Simplified since source column doesn't exist
            if (!detailedStats.bySource[sourceName]) {
              detailedStats.bySource[sourceName] = 0;
            }
            detailedStats.bySource[sourceName]++;
            detailedStats.imageTypes[bestImage.type]++;
            
            console.log(`✅ Image ajoutée: ${bestImage.type} (${bestImage.source})`);
            
            results.push({
              id: article.id,
              title: article.title?.substring(0, 50) + '...',
              url: article.url,
              imageUrl: finalImageUrl,
              imageType: bestImage.type,
              imageSource: bestImage.source,
              status: 'updated',
              totalImagesFound: extractedImages.length
            });
          } else {
            console.error(`❌ Erreur mise à jour ${article.id}:`, updateError);
            errors++;
          }
        } else {
          console.log(`⚠️ Aucune image trouvée pour: ${article.title?.substring(0, 50)}...`);
          results.push({
            id: article.id,
            status: 'no_image_found',
            reason: 'Aucune image extractible trouvée'
          });
        }
        
        processed++;
        
        // Pause entre articles pour éviter la surcharge
        if (processed % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (articleError) {
        console.error(`❌ Erreur traitement article ${article.id}:`, articleError);
        errors++;
        results.push({
          id: article.id,
          status: 'error',
          error: articleError.message
        });
        processed++;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`🎉 Extraction terminée: ${updated}/${processed} images ajoutées en ${duration}s`);
    
    // Log des résultats
    try {
      await supabase
        .from('sync_logs')
        .insert({
          sync_type: 'recent_images_extraction',
          total_articles: updated,
          errors: errors,
          duration_ms: Date.now() - startTime,
          status: errors === 0 ? 'success' : 'partial_success',
          details: { processed, updated, errors, detailedStats }
        });
    } catch (logError) {
      console.warn('Erreur log:', logError);
    }
    
    return {
      success: true,
      processed,
      updated,
      errors,
      duration,
      results: results.slice(0, 15), // Limiter pour la réponse
      detailedStats,
      message: `${updated} images extraites sur ${processed} articles récents (${duration}s)`
    };

  } catch (error) {
    console.error('❌ Erreur extraction images récentes:', error);
    return {
      success: false,
      error: error.message,
      processed: 0,
      updated: 0
    };
  }
}

// Déterminer si une image a besoin du proxy
function needsProxy(imageUrl) {
  const proxyDomains = [
    'fbcdn.net',
    'facebook.com',
    'infosgabon.com',
    'directinfosgabon.com',
    'gabonmediatime.com'
  ];
  
  return proxyDomains.some(domain => imageUrl.includes(domain));
}

// Handler Netlify
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Configuration Supabase manquante'
        })
      };
    }
    
    console.log('🚀 Lancement extraction images articles récents (24h)');
    
    // Traitement avec timeout de 8 minutes
    const result = await Promise.race([
      processRecentImages(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout fonction (8min)')), 480000)
      )
    ]);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...result,
        timestamp: new Date().toISOString(),
        timeframe: '24h'
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur handler:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur extraction images récentes',
        message: error.message
      })
    };
  }
};

// Export des fonctions utilitaires pour tests
exports.processRecentImages = processRecentImages;
exports.extractImagesFromArticle = extractImagesFromArticle;
