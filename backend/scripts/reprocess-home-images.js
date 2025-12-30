/**
 * 🖼️ SCRIPT DE RETRAITEMENT DES IMAGES - ARTICLES HOME
 * 
 * Retraite les images des articles récents (dernières 24h) en utilisant:
 * - Web scraping
 * - Proxy Facebook si nécessaire
 * - Extraction Open Graph
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

// Configuration
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000;

// Initialisation Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Statistiques
const stats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now()
};

/**
 * Vérifier si une URL d'image est valide
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  if (url.includes('base64')) return false;
  if (url.length > 2000) return false;
  return true;
}

/**
 * Extraire image depuis une page web
 */
async function scrapeImageFromWebPage(url) {
  try {
    console.log(`  🔍 Scraping: ${url.substring(0, 80)}...`);
    
    const response = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });

    const $ = cheerio.load(response.data);
    
    // 1. Open Graph
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && isValidImageUrl(imageUrl)) {
      console.log('  ✅ Image OG trouvée');
      return imageUrl;
    }
    
    // 2. Twitter Card
    imageUrl = $('meta[name="twitter:image"]').attr('content');
    if (imageUrl && isValidImageUrl(imageUrl)) {
      console.log('  ✅ Image Twitter trouvée');
      return imageUrl;
    }
    
    // 3. Première image de contenu significative
    const images = [];
    $('img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      const width = parseInt($(elem).attr('width') || '0');
      const height = parseInt($(elem).attr('height') || '0');
      
      if (src && isValidImageUrl(src)) {
        // Filtrer les petites images (icônes, avatars)
        if ((width === 0 || width > 200) && (height === 0 || height > 200)) {
          const lowerSrc = src.toLowerCase();
          if (!lowerSrc.includes('logo') && 
              !lowerSrc.includes('icon') && 
              !lowerSrc.includes('avatar') &&
              !lowerSrc.includes('profile')) {
            images.push(src);
          }
        }
      }
    });
    
    if (images.length > 0) {
      console.log(`  ✅ ${images.length} images de contenu trouvées`);
      return images[0];
    }
    
    return null;
  } catch (error) {
    console.error(`  ❌ Erreur scraping: ${error.message}`);
    return null;
  }
}

/**
 * Extraire image Facebook avec User-Agent spécial
 */
async function scrapeFacebookImage(url) {
  try {
    console.log(`  📘 Facebook: ${url.substring(0, 80)}...`);
    
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Referer': 'https://www.facebook.com/'
      }
    });
    
    const $ = cheerio.load(response.data);
    const imageUrl = $('meta[property="og:image"]').attr('content');
    
    if (imageUrl && isValidImageUrl(imageUrl)) {
      console.log('  ✅ Image Facebook trouvée');
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error(`  ❌ Erreur Facebook: ${error.message}`);
    return null;
  }
}

/**
 * Retraiter un article
 */
async function reprocessArticle(article) {
  try {
    console.log(`\n📰 Article: ${article.title.substring(0, 60)}...`);
    
    // Vérifier si l'article a déjà une image valide
    if (article.image_urls && article.image_urls.length > 0) {
      const hasValidImage = article.image_urls.some(url => isValidImageUrl(url));
      if (hasValidImage) {
        console.log('  ⏭️  Image déjà présente, skip');
        stats.skipped++;
        return { success: true, skipped: true };
      }
    }
    
    let imageUrl = null;
    
    // Stratégie 1: Facebook
    if (article.url && article.url.includes('facebook.com')) {
      imageUrl = await scrapeFacebookImage(article.url);
    }
    
    // Stratégie 2: Web scraping général
    if (!imageUrl && article.url) {
      imageUrl = await scrapeImageFromWebPage(article.url);
    }
    
    if (imageUrl) {
      // Mettre à jour dans Supabase
      const { error } = await supabase
        .from('articles')
        .update({
          image_urls: [imageUrl],
          updated_at: new Date().toISOString()
        })
        .eq('id', article.id);
      
      if (error) throw error;
      
      console.log('  ✅ Image mise à jour dans Supabase');
      stats.success++;
      return { success: true, imageUrl };
    } else {
      console.log('  ❌ Aucune image trouvée');
      stats.failed++;
      return { success: false };
    }
    
  } catch (error) {
    console.error(`  ❌ Erreur: ${error.message}`);
    stats.failed++;
    return { success: false, error: error.message };
  }
}

/**
 * Traiter un batch d'articles
 */
async function processBatch(articles) {
  const promises = articles.map(article => reprocessArticle(article));
  const results = await Promise.allSettled(promises);
  
  stats.processed += articles.length;
  
  return results.map((r, i) => ({
    article_id: articles[i].id,
    result: r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }
  }));
}

/**
 * Afficher les statistiques
 */
function displayStats() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const rate = stats.processed > 0 ? Math.round(stats.processed / (elapsed || 1)) : 0;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 STATISTIQUES');
  console.log('='.repeat(60));
  console.log(`Total: ${stats.total}`);
  console.log(`Traités: ${stats.processed} / ${stats.total} (${Math.round(stats.processed / stats.total * 100)}%)`);
  console.log(`✅ Succès: ${stats.success}`);
  console.log(`⏭️  Ignorés: ${stats.skipped}`);
  console.log(`❌ Échecs: ${stats.failed}`);
  console.log(`⏱️  Temps: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`⚡ Vitesse: ${rate} articles/seconde`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n🚀 RETRAITEMENT DES IMAGES - ARTICLES HOME\n');
  
  try {
    // 1. Récupérer les articles récents (dernières 24h) sans images ou avec images invalides
    console.log('📥 Récupération des articles récents...\n');
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, url, image_urls')
      .gte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('published_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    if (!articles || articles.length === 0) {
      console.log('✅ Aucun article à traiter');
      return;
    }
    
    stats.total = articles.length;
    console.log(`📝 ${stats.total} articles à vérifier\n`);
    
    // 2. Traiter par batch
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)}`);
      
      await processBatch(batch);
      
      // Pause entre les batches
      if (i + BATCH_SIZE < articles.length) {
        console.log(`\n⏸️  Pause ${DELAY_BETWEEN_BATCHES}ms...\n`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    // 3. Afficher les stats finales
    console.log('\n' + '='.repeat(60));
    console.log('🎉 RETRAITEMENT TERMINÉ !');
    console.log('='.repeat(60));
    displayStats();
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    process.exit(1);
  }
}

// Gestion interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interruption détectée');
  displayStats();
  process.exit(0);
});

// Lancement
main();
