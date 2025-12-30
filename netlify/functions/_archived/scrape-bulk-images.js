const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🕷️ Scraper rapide une page d'article pour extraire l'image principale
async function scrapeArticleImageFast(articleUrl, fetch) {
  try {
    console.log(`🕷️ Scraping: ${articleUrl.substring(0, 50)}...`);
    
    // Headers optimisés pour vitesse
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Gabon24Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: 8000 // Timeout plus court
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 🎯 Extraction ultra-rapide - priorité aux meta tags
    let imageUrl = $('meta[property="og:image"]').attr('content') ||
                   $('meta[name="twitter:image"]').attr('content') ||
                   $('article img:first').attr('src') ||
                   $('.content img:first').attr('src') ||
                   $('.post-content img:first').attr('src') ||
                   $('img:first').attr('src');
    
    if (imageUrl) {
      // Convertir en URL absolue si nécessaire
      if (!imageUrl.startsWith('http')) {
        const base = new URL(articleUrl);
        imageUrl = imageUrl.startsWith('/') 
          ? `${base.protocol}//${base.hostname}${imageUrl}`
          : new URL(imageUrl, articleUrl).href;
      }
      
      console.log(`📷 Image trouvée: ${imageUrl.substring(0, 50)}...`);
      return imageUrl;
    }
    
    return null;
    
  } catch (error) {
    console.warn(`⚠️ Erreur scraping ${articleUrl.substring(0, 30)}: ${error.message}`);
    return null;
  }
}

// 🚀 Traitement en parallèle avec limite de concurrence
async function processBatch(articles, fetch, concurrency = 5) {
  const results = [];
  
  for (let i = 0; i < articles.length; i += concurrency) {
    const batch = articles.slice(i, i + concurrency);
    
    const promises = batch.map(async (article) => {
      if (!article.url) return { id: article.id, imageUrl: null, success: false };
      
      const imageUrl = await scrapeArticleImageFast(article.url, fetch);
      return {
        id: article.id,
        title: article.title,
        imageUrl: imageUrl,
        success: !!imageUrl
      };
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // Pause courte entre batches
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

// 🚀 Fonction principale optimisée
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
    // Import dynamique de node-fetch
    const { default: fetch } = await import('node-fetch');
    
    console.log('🕷️ [SCRAPE-BULK] Début scraping en masse des images');
    
    // Paramètres
    const { limit = 100, days = 7, force = false } = event.queryStringParameters || {};
    const maxArticles = Math.min(parseInt(limit), 200); // Max 200 pour éviter timeout
    const daysBack = parseInt(days);
    
    // 1. Récupérer les articles des X derniers jours
    const daysAgo = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    let query = supabase
      .from('articles')
      .select('id, title, url, image_url')
      .gte('created_at', daysAgo.toISOString())
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
    
    console.log(`📊 ${articles.length} articles à scraper (${daysBack} derniers jours)`);
    
    if (articles.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Aucun article à traiter',
          stats: { processed: 0, found: 0, updated: 0, failed: 0 }
        })
      };
    }
    
    // 2. Traitement en parallèle par batches
    const results = await processBatch(articles, fetch, 3); // 3 articles en parallèle
    
    let stats = {
      processed: results.length,
      found: 0,
      updated: 0,
      failed: 0,
      errors: 0
    };
    
    // 3. Mise à jour en masse dans Supabase
    const updates = [];
    
    for (const result of results) {
      if (result.success && result.imageUrl) {
        updates.push({
          id: result.id,
          image_url: result.imageUrl
        });
        stats.found++;
      } else {
        stats.failed++;
      }
    }
    
    // 4. Exécuter les mises à jour par batches
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        
        for (const update of batch) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({ image_url: update.image_url })
            .eq('id', update.id);
          
          if (updateError) {
            console.error(`❌ Erreur mise à jour ${update.id}:`, updateError);
            stats.errors++;
          } else {
            stats.updated++;
          }
        }
      }
    }
    
    // 5. Logs finaux
    console.log(`✅ [SCRAPE-BULK] Scraping terminé:`);
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
        message: `Scraping en masse terminé (${daysBack} derniers jours)`,
        stats: stats,
        processed_articles: articles.length
      })
    };
    
  } catch (error) {
    console.error('❌ [SCRAPE-BULK] Erreur générale:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        function: 'scrape-bulk-images'
      })
    };
  }
};
