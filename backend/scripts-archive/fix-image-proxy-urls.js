/**
 * Script pour corriger les URLs du proxy d'images dans la base de données
 * Remplace localhost:3002 par localhost:3001
 */

const supabaseService = require('./supabase-config');

async function fixImageProxyUrls() {
  console.log('🔧 Correction des URLs du proxy d\'images...\n');

  try {
    // 1. Récupérer tous les articles avec des URLs contenant localhost:3002
    const { data: articles, error: fetchError } = await supabaseService.supabase
      .from('articles')
      .select('id, title, image_url')
      .ilike('image_url', '%localhost:3002%');

    if (fetchError) {
      console.error('❌ Erreur lors de la récupération:', fetchError);
      return;
    }

    console.log(`📊 ${articles.length} articles trouvés avec localhost:3002\n`);

    if (articles.length === 0) {
      console.log('✅ Aucune correction nécessaire !');
      return;
    }

    // 2. Corriger chaque article
    let corrected = 0;
    let errors = 0;

    for (const article of articles) {
      const oldUrl = article.image_url;
      const newUrl = oldUrl.replace(/localhost:3002/g, 'localhost:3001');

      console.log(`📝 ${article.title.substring(0, 50)}...`);
      console.log(`   Ancien: ${oldUrl}`);
      console.log(`   Nouveau: ${newUrl}`);

      const { error: updateError } = await supabaseService.supabase
        .from('articles')
        .update({ image_url: newUrl })
        .eq('id', article.id);

      if (updateError) {
        console.error(`   ❌ Erreur: ${updateError.message}`);
        errors++;
      } else {
        console.log(`   ✅ Corrigé`);
        corrected++;
      }
      console.log('');
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Corrigés: ${corrected}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📝 Total: ${articles.length}`);

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Exécuter le script
fixImageProxyUrls()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erreur fatale:', error);
    process.exit(1);
  });
