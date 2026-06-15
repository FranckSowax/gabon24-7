/**
 * 📘 SCRIPT DE RESCAN DES VRAIES IMAGES FACEBOOK
 * Scrape les vraies images Facebook via proxy avec User-Agent spécial
 */

const supabaseService = require('./supabase-config');
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeFacebookImage(url) {
  try {
    console.log(`📘 Scraping: ${url.substring(0, 80)}...`);
    
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Referer': 'https://www.facebook.com/',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Open Graph
    let imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl && imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    // Twitter Card
    imageUrl = $('meta[name="twitter:image"]').attr('content');
    if (imageUrl && imageUrl.startsWith('http')) {
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error(`  ❌ ${error.message}`);
    return null;
  }
}

async function rescanFacebookImages() {
  console.log('📘 RESCAN DES IMAGES FACEBOOK\n');
  console.log('='.repeat(60));
  
  try {
    // Récupérer articles Facebook (limiter pour test)
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, url, image_url')
      .or('url.ilike.%facebook.com%,source.ilike.%facebook%')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(50); // Limiter à 50 pour test
    
    if (error) {
      console.error('❌ Erreur:', error);
      return;
    }
    
    console.log(`📊 Articles Facebook trouvés: ${articles.length}\n`);
    
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const article of articles) {
      // Skip si URL ne contient pas facebook.com
      if (!article.url || !article.url.includes('facebook.com')) {
        skipped++;
        continue;
      }
      
      console.log(`\n🔍 ${article.title.substring(0, 50)}...`);
      
      const imageUrl = await scrapeFacebookImage(article.url);
      
      if (imageUrl) {
        // Mettre à jour
        const { error: updateError } = await supabaseService.supabase
          .from('articles')
          .update({ image_url: imageUrl })
          .eq('id', article.id);
        
        if (updateError) {
          console.error(`  ❌ Erreur update: ${updateError.message}`);
          failed++;
        } else {
          console.log(`  ✅ Image trouvée: ${imageUrl.substring(0, 60)}...`);
          updated++;
        }
      } else {
        console.log(`  ⚠️ Aucune image trouvée`);
        failed++;
      }
      
      // Pause entre requêtes
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSULTATS:');
    console.log(`  Total: ${articles.length}`);
    console.log(`  ✅ Mis à jour: ${updated}`);
    console.log(`  ❌ Échecs: ${failed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  📈 Taux succès: ${((updated / (articles.length - skipped)) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

// Lancer
rescanFacebookImages()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
