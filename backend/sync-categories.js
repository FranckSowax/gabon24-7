/**
 * 🔄 SYNCHRONISATION CATÉGORIES: ai_category → category
 * 
 * Synchronise la colonne category avec ai_category pour tous les articles enrichis
 */

const supabaseService = require('./supabase-config');

async function syncCategories() {
  console.log('\n🔄 SYNCHRONISATION DES CATÉGORIES');
  console.log('='.repeat(80));
  
  try {
    // Récupérer tous les articles avec ai_category mais différente de category
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, category, ai_category')
      .not('ai_category', 'is', null)
      .neq('category', 'ai_category') // Seulement ceux où category != ai_category
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }
    
    if (!articles || articles.length === 0) {
      console.log('\n✅ Toutes les catégories sont déjà synchronisées !');
      return;
    }
    
    console.log(`\n📋 Articles à synchroniser: ${articles.length}`);
    console.log(`⏱️  Temps estimé: ~${Math.ceil(articles.length / 10)} secondes\n`);
    
    let updated = 0;
    let errors = 0;
    
    // Traiter par batch de 10
    for (let i = 0; i < articles.length; i += 10) {
      const batch = articles.slice(i, i + 10);
      
      for (const article of batch) {
        try {
          const { error: updateError } = await supabaseService.supabase
            .from('articles')
            .update({ category: article.ai_category })
            .eq('id', article.id);
          
          if (updateError) {
            console.error(`❌ Erreur: ${article.title.substring(0, 50)}...`);
            errors++;
          } else {
            updated++;
            console.log(`✅ [${updated}/${articles.length}] "${article.category}" → "${article.ai_category}" | ${article.title.substring(0, 50)}...`);
          }
        } catch (err) {
          console.error(`❌ Erreur: ${err.message}`);
          errors++;
        }
      }
      
      // Petite pause entre chaque batch
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ SYNCHRONISATION TERMINÉE !');
    console.log(`   Synchronisés: ${updated}`);
    console.log(`   Erreurs: ${errors}`);
    console.log('');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

syncCategories()
  .then(() => {
    console.log('🎉 Terminé !\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌', error);
    process.exit(1);
  });
