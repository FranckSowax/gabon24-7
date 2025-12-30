/**
 * 🔄 SCRIPT DE SYNCHRONISATION image_url → image_urls
 * Copie image_url dans image_urls array pour articles Facebook
 */

const supabaseService = require('./supabase-config');

async function syncImageUrlsArray() {
  console.log('🔄 Synchronisation image_url → image_urls...\n');
  
  try {
    // Récupérer articles Facebook avec image_url mais sans image_urls
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, image_url, image_urls')
      .ilike('image_url', '%fbcdn.net%')
      .limit(1000);
    
    if (error) {
      console.error('❌ Erreur récupération:', error);
      return;
    }
    
    // Filtrer ceux qui n'ont pas image_urls
    const needsSync = articles.filter(art => {
      return art.image_url && 
             art.image_url.trim() !== '' &&
             (!art.image_urls || art.image_urls.length === 0);
    });
    
    console.log(`📊 Total articles Facebook: ${articles.length}`);
    console.log(`📊 Besoin synchronisation: ${needsSync.length}\n`);
    
    if (needsSync.length === 0) {
      console.log('✅ Tous les articles sont déjà synchronisés!');
      return;
    }
    
    let updated = 0;
    let errors = 0;
    
    // Traiter par lots de 100
    for (let i = 0; i < needsSync.length; i += 100) {
      const batch = needsSync.slice(i, i + 100);
      
      for (const article of batch) {
        try {
          const { error: updateError } = await supabaseService.supabase
            .from('articles')
            .update({ 
              image_urls: [article.image_url]
            })
            .eq('id', article.id);
          
          if (updateError) {
            console.error(`❌ ${article.id}: ${updateError.message}`);
            errors++;
          } else {
            console.log(`✅ ${article.id}: ${article.title.substring(0, 50)}...`);
            updated++;
          }
        } catch (err) {
          console.error(`❌ Erreur ${article.id}:`, err.message);
          errors++;
        }
      }
      
      console.log(`\n📊 Progression: ${Math.min(i + 100, needsSync.length)}/${needsSync.length}\n`);
      
      // Pause entre les lots
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 STATISTIQUES:');
    console.log(`  Articles à synchroniser: ${needsSync.length}`);
    console.log(`  ✅ Synchronisés: ${updated}`);
    console.log(`  ❌ Erreurs: ${errors}`);
    console.log(`  📈 Taux de succès: ${Math.round((updated / needsSync.length) * 100)}%`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

// Lancer le script
syncImageUrlsArray()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur script:', error);
    process.exit(1);
  });
