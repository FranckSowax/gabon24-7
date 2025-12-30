const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🕷️ Scraper une page d'article pour extraire l'image principale
async function scrapeArticleImage(articleUrl) {
  try {
    // Import dynamique de node-fetch
    const { default: fetch } = await import('node-fetch');
    
    console.log(`🕷️ Scraping: ${articleUrl}`);
    
    // Headers pour simuler un navigateur réel
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      timeout: 15000
    });
    
    if (!response.ok) {
      console.warn(`⚠️ HTTP ${response.status} pour ${articleUrl}`);
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 🎯 Priorité 1: Meta Open Graph image (la plus fiable)
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl) {
      console.log(`📷 [OG:IMAGE] Trouvée: ${imageUrl.substring(0, 60)}...`);
      return makeAbsoluteUrl(imageUrl, articleUrl);
    }
    
    // 🎯 Priorité 2: Meta Twitter image
    imageUrl = $('meta[name="twitter:image"]').attr('content');
    if (imageUrl) {
      console.log(`📷 [TWITTER:IMAGE] Trouvée: ${imageUrl.substring(0, 60)}...`);
      return makeAbsoluteUrl(imageUrl, articleUrl);
    }
    
    // 🎯 Priorité 3: Première image dans l'article (content, article, main)
    const contentSelectors = [
      'article img:first',
      '.content img:first',
      '.post-content img:first',
      '.entry-content img:first',
      '.article-content img:first',
      'main img:first',
      '.post img:first'
    ];
    
    for (const selector of contentSelectors) {
      const img = $(selector);
      if (img.length > 0) {
        imageUrl = img.attr('src') || img.attr('data-src');
        if (imageUrl && !imageUrl.includes('avatar') && !imageUrl.includes('logo')) {
          console.log(`📷 [CONTENT] Trouvée: ${imageUrl.substring(0, 60)}...`);
          return makeAbsoluteUrl(imageUrl, articleUrl);
        }
      }
    }
    
    // 🎯 Priorité 4: Première image valide de la page (en évitant logos/avatars)
    const allImages = $('img');
    for (let i = 0; i < allImages.length; i++) {
      const img = $(allImages[i]);
      imageUrl = img.attr('src') || img.attr('data-src');
      
      if (imageUrl && 
          !imageUrl.includes('logo') && 
          !imageUrl.includes('avatar') && 
          !imageUrl.includes('icon') &&
          !imageUrl.includes('placeholder') &&
          (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg') || imageUrl.includes('.png') || imageUrl.includes('.webp'))) {
        
        console.log(`📷 [FIRST-IMG] Trouvée: ${imageUrl.substring(0, 60)}...`);
        return makeAbsoluteUrl(imageUrl, articleUrl);
      }
    }
    
    console.log(`❌ Aucune image trouvée pour ${articleUrl}`);
    return null;
    
  } catch (error) {
    console.error(`❌ Erreur scraping ${articleUrl}:`, error.message);
    return null;
  }
}

// 🔗 Convertir URL relative en URL absolue
function makeAbsoluteUrl(imageUrl, baseUrl) {
  if (!imageUrl) return null;
  
  // Déjà absolue
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }
  
  try {
    const base = new URL(baseUrl);
    
    // URL relative commençant par /
    if (imageUrl.startsWith('/')) {
      return `${base.protocol}//${base.hostname}${imageUrl}`;
    }
    
    // URL relative
    return new URL(imageUrl, baseUrl).href;
  } catch (error) {
    console.warn(`⚠️ Erreur URL absolue:`, error.message);
    return imageUrl;
  }
}

// 🚀 Fonction principale
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
    console.log('🕷️ [SCRAPE-IMAGES] Début scraping des images d\'articles');
    
    // Paramètres
    const { limit = 20, force = false } = event.queryStringParameters || {};
    const maxArticles = Math.min(parseInt(limit), 50); // Max 50 pour éviter timeout
    
    // 1. Récupérer les articles sans images des 7 derniers jours
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    let query = supabase
      .from('articles')
      .select('id, title, url')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(maxArticles);
    
    // Si force=false, ne prendre que les articles sans images
    if (force !== 'true') {
      query = query.is('image_url', null);
    }
    
    const { data: articles, error: fetchError } = await query;
    
    if (fetchError) {
      throw new Error(`Erreur récupération articles: ${fetchError.message}`);
    }
    
    console.log(`📊 ${articles.length} articles à traiter`);
    
    let stats = {
      processed: 0,
      found: 0,
      updated: 0,
      failed: 0,
      errors: 0
    };
    
    // 2. Scraper chaque article
    for (const article of articles) {
      try {
        stats.processed++;
        
        if (!article.url) {
          stats.failed++;
          continue;
        }
        
        console.log(`🔍 [${stats.processed}/${articles.length}] ${article.title?.substring(0, 50)}...`);
        
        // Scraper l'image
        const imageUrl = await scrapeArticleImage(article.url);
        
        if (imageUrl) {
          // Sauvegarder l'image dans Supabase
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: imageUrl })
            .eq('id', article.id);
          
          if (updateError) {
            console.error(`❌ Erreur mise à jour ${article.id}:`, updateError);
            stats.errors++;
          } else {
            stats.found++;
            stats.updated++;
            console.log(`✅ Image sauvegardée: ${imageUrl.substring(0, 60)}...`);
          }
        } else {
          stats.failed++;
        }
        
        // Pause entre requêtes pour éviter d'être bloqué
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (articleError) {
        console.error(`❌ Erreur article ${article.id}:`, articleError);
        stats.errors++;
      }
    }
    
    // 3. Logs finaux
    console.log(`✅ [SCRAPE-IMAGES] Scraping terminé:`);
    console.log(`📊 Articles traités: ${stats.processed}`);
    console.log(`🖼️ Images trouvées: ${stats.found}`);
    console.log(`💾 Articles mis à jour: ${stats.updated}`);
    console.log(`❌ Échecs: ${stats.failed}`);
    console.log(`⚠️ Erreurs: ${stats.errors}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Scraping des images terminé',
        stats: stats,
        processed_articles: articles.length
      })
    };
    
  } catch (error) {
    console.error('❌ [SCRAPE-IMAGES] Erreur générale:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        function: 'scrape-article-images'
      })
    };
  }
};
