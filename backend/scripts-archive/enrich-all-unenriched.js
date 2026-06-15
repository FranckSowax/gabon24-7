/**
 * 🚀 ENRICHISSEMENT MASSIF DE TOUS LES ARTICLES NON ENRICHIS
 * 
 * ⚠️  ATTENTION: Ce script peut prendre du temps et consommer du quota OpenAI
 * - Traite TOUS les articles sans enrichissement (pas de limite de temps)
 * - Traitement par batch de 50 articles à la fois
 * - Pause adaptative entre les batches
 */

const supabaseService = require('./supabase-config');
const ArticleAIEnrichment = require('./services/article-ai-enrichment');

async function enrichAllUnenriched() {
  console.log('\n🚀 ENRICHISSEMENT MASSIF DE TOUS LES ARTICLES NON ENRICHIS');
  console.log('='.repeat(80));
  
  const enrichmentService = new ArticleAIEnrichment();
  
  if (!enrichmentService.isConfigured) {
    console.log('\n❌ ERREUR: OPENAI_API_KEY non configurée');
    console.log('   Vérifiez votre fichier .env');
    process.exit(1);
  }
  
  try {
    // Compter le total d'articles à enrichir
    const { count: totalCount } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .is('enrichment_status', null);
    
    console.log(`\n📊 Articles à enrichir: ${totalCount}`);
    
    if (!totalCount || totalCount === 0) {
      console.log('\n✅ Aucun article à enrichir !');
      console.log('   Tous les articles sont déjà enrichis.');
      process.exit(0);
    }
    
    // Estimation du coût et du temps
    const estimatedCost = (totalCount * 0.00015).toFixed(2);
    const estimatedMinutes = Math.ceil(totalCount * 2 / 60);
    
    console.log(`\n💰 ESTIMATION:`);
    console.log(`   💵 Coût OpenAI: ~$${estimatedCost}`);
    console.log(`   ⏱️  Temps: ~${estimatedMinutes} minutes`);
    console.log(`   🔄 Batch size: 50 articles à la fois`);
    
    // Demander confirmation
    console.log('\n⚠️  ATTENTION: Ce processus peut prendre du temps.');
    console.log('   Assurez-vous d\'avoir suffisamment de quota OpenAI.');
    console.log('\n   Pour enrichir seulement les articles récents (48h), utilisez:');
    console.log('   → node enrich-latest-unenriched.js');
    
    console.log('\n📋 Appuyez sur Ctrl+C pour annuler...');
    console.log('   Démarrage dans 5 secondes...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('🚀 Démarrage de l\'enrichissement massif...\n');
    
    let totalEnriched = 0;
    let totalErrors = 0;
    const startTime = Date.now();
    const BATCH_SIZE = 50;
    
    // Traitement par batches
    while (true) {
      // Récupérer le prochain batch
      const { data: articles } = await supabaseService.supabase
        .from('articles')
        .select('id, title, content, summary, summary_ai, category')
        .is('enrichment_status', null)
        .order('created_at', { ascending: false })
        .limit(BATCH_SIZE);
      
      if (!articles || articles.length === 0) {
        break; // Plus d'articles à traiter
      }
      
      console.log(`\n📦 BATCH ${Math.floor(totalEnriched / BATCH_SIZE) + 1} - ${articles.length} articles`);
      console.log(`   Progression: ${totalEnriched + totalErrors}/${totalCount} (${Math.round((totalEnriched + totalErrors) / totalCount * 100)}%)`);
      
      for (const article of articles) {
        try {
          const enrichment = await enrichmentService.enrichArticle(
            article.title,
            article.content || '',
            article.summary || article.summary_ai || ''
          );
          
          await supabaseService.supabase
            .from('articles')
            .update({
              summary_ai: enrichment.ai_summary,
              category: enrichment.ai_category,
              sentiment_score: enrichment.ai_sentiment,
              importance: enrichment.ai_importance ? Math.max(1, Math.round(enrichment.ai_importance * 10)) : null,
              is_breaking: enrichment.ai_is_breaking,
              keywords: enrichment.ai_keywords,
              enrichment_status: 'completed',
              enriched_at: new Date().toISOString()
            })
            .eq('id', article.id);
          
          totalEnriched++;
          
          if (totalEnriched % 10 === 0) {
            const elapsed = Math.ceil((Date.now() - startTime) / 1000);
            const remaining = Math.ceil((totalCount - totalEnriched - totalErrors) * elapsed / (totalEnriched + totalErrors));
            console.log(`   ✅ ${totalEnriched}/${totalCount} | ${enrichment.ai_category} | ~${Math.floor(remaining / 60)}min restantes`);
          }
          
          // Pause entre articles
          await new Promise(resolve => setTimeout(resolve, 1500));
          
        } catch (err) {
          totalErrors++;
          if (totalErrors % 5 === 0) {
            console.log(`   ⚠️  ${totalErrors} erreurs jusqu'à présent`);
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      // Pause entre batches
      console.log('   💤 Pause de 10 secondes entre les batches...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
    const duration = Math.ceil((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ENRICHISSEMENT MASSIF TERMINÉ !');
    console.log(`   ⏱️  Durée totale: ${Math.floor(duration / 60)} minutes ${duration % 60} secondes`);
    console.log(`   ✅ Articles enrichis: ${totalEnriched}`);
    console.log(`   ❌ Erreurs: ${totalErrors}`);
    console.log(`   📊 Taux de réussite: ${Math.round(totalEnriched / totalCount * 100)}%`);
    
    if (totalErrors > 0) {
      console.log('\n⚠️  Quelques erreurs sont survenues.');
      console.log('   💡 Relancez le script pour traiter les articles échoués.');
    }
    
    console.log('\n✅ Tous vos articles devraient maintenant avoir des catégories IA précises !\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

enrichAllUnenriched()
  .then(() => {
    console.log('🎉 Terminé !\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌', error);
    process.exit(1);
  });
