/**
 * 📘 SCRIPT DE CORRECTION DES IMAGES FACEBOOK
 * Utilise le proxy backend pour contourner CORS et récupérer les vraies images
 */

const supabaseService = require('./supabase-config');
const axios = require('axios');

const PROXY_URL = 'http://localhost:3002/api/image-proxy/facebook-og';

async function fixFacebookImages() {
  console.log('📘 Correction des images Facebook...\n');
  
  try {
    // Récupérer tous les articles Facebook sans image
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, url, image_url, image_urls, source')
      .ilike('url', '%facebook.com%')
      .limit(1000);
    
    if (error) {
      console.error('❌ Erreur récupération:', error);
      return;
    }
    
    console.log(`📊 Articles Facebook trouvés: ${articles.length}\n`);
    
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    let notFound = 0;
    
    // Filtrer les articles qui ont déjà une image
    const articlesNeedingImage = articles.filter(art => {
      const hasImageUrl = art.image_url && art.image_url.trim() !== '';
      const hasImageUrls = art.image_urls && Array.isArray(art.image_urls) && art.image_urls.length > 0;
      return !hasImageUrl && !hasImageUrls;
    });
    
    console.log(`📊 Articles sans image: ${articlesNeedingImage.length}/${articles.length}\n`);
    
    // Traiter les articles un par un (éviter surcharge proxy)
    for (let i = 0; i < articlesNeedingImage.length; i++) {
      const article = articlesNeedingImage[i];
      
      try {
        console.log(`[${i + 1}/${articlesNeedingImage.length}] ${article.title.substring(0, 50)}...`);
        
        // Appel au proxy pour récupérer l'image
        const proxyResponse = await axios.get(PROXY_URL, {
          params: { url: article.url },
          timeout: 30000
        });
        
        if (proxyResponse.data.success && proxyResponse.data.imageUrl) {
          const imageUrl = proxyResponse.data.imageUrl;
          
          // Mettre à jour l'article avec l'image récupérée
          const { error: updateError } = await supabaseService.supabase
            .from('articles')
            .update({ 
              image_url: imageUrl,
              image_urls: [imageUrl]
            })
            .eq('id', article.id);
          
          if (updateError) {
            console.error(`  ❌ Erreur update DB: ${updateError.message}`);
            errors++;
          } else {
            console.log(`  ✅ Image trouvée et sauvegardée: ${imageUrl.substring(0, 60)}...`);
            updated++;
          }
        } else {
          console.log(`  ⚠️ Aucune image trouvée par le proxy`);
          notFound++;
        }
        
      } catch (err) {
        console.error(`  ❌ Erreur: ${err.message}`);
        errors++;
      }
      
      // Pause entre chaque requête pour éviter rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    skipped = articles.length - articlesNeedingImage.length;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 STATISTIQUES:');
    console.log(`  Total articles Facebook: ${articles.length}`);
    console.log(`  Avaient déjà une image: ${skipped}`);
    console.log(`  ✅ Images trouvées et sauvegardées: ${updated}`);
    console.log(`  ⚠️ Images non trouvées: ${notFound}`);
    console.log(`  ❌ Erreurs: ${errors}`);
    console.log(`  📈 Taux de succès: ${updated > 0 ? Math.round((updated / articlesNeedingImage.length) * 100) : 0}%`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

// Lancer le script
fixFacebookImages()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur script:', error);
    process.exit(1);
  });
