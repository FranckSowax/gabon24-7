/**
 * 🤖 ENRICHISSEMENT DES DERNIERS ARTICLES NON ENRICHIS
 * 
 * Rattrapage rapide des articles récents qui n'ont pas été enrichis par l'IA
 * - Traite les articles des dernières 48h sans enrichissement
 * - Met à jour category, sentiment_score, importance, is_breaking, keywords
 * - Enrichissement complet : sentiment, importance, breaking, keywords
 */

const supabaseService = require('./supabase-config');
const ArticleAIEnrichment = require('./services/article-ai-enrichment');

async function enrichLatestUnenriched() {
  console.log('\n🤖 ENRICHISSEMENT DES DERNIERS ARTICLES NON ENRICHIS');
  console.log('='.repeat(80));
  
  const enrichmentService = new ArticleAIEnrichment();
  
  if (!enrichmentService.isConfigured) {
    console.log('\n❌ ERREUR: OPENAI_API_KEY non configurée');
    console.log('   Vérifiez votre fichier .env');
    process.exit(1);
  }
  
  try {
    // Récupérer les articles récents (48h) sans enrichissement IA
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    console.log(`\n📅 Recherche des articles récents (depuis ${new Date(twoDaysAgo).toLocaleString('fr-FR')})...`);
    
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, content, summary, summary_ai, category')
      .is('enrichment_status', null)
      .gte('created_at', twoDaysAgo)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('❌ Erreur Supabase:', error.message);
      process.exit(1);
    }
    
    if (!articles || articles.length === 0) {
      console.log('\n✅ Aucun article récent à enrichir !');
      console.log('   Tous les articles des 48 dernières heures sont déjà enrichis.');
      process.exit(0);
    }
    
    console.log(`\n📊 Articles à enrichir: ${articles.length}`);
    console.log(`⏱️  Temps estimé: ~${Math.ceil(articles.length * 2)} secondes\n`);
    
    let enriched = 0;
    let errors = 0;
    const startTime = Date.now();
    
    for (const article of articles) {
      try {
        console.log(`\n[${enriched + errors + 1}/${articles.length}] 🤖 Enrichissement...`);
        console.log(`   📰 "${article.title.substring(0, 60)}..."`);
        
        // Enrichissement IA complet
        const enrichment = await enrichmentService.enrichArticle(
          article.title,
          article.content || '',
          article.summary || article.ai_summary || ''
        );
        
        // Mise à jour dans Supabase avec colonnes DB réelles
        const { error: updateError } = await supabaseService.supabase
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
        
        if (updateError) {
          console.log(`   ❌ Erreur sauvegarde: ${updateError.message}`);
          errors++;
        } else {
          console.log(`   ✅ Enrichi: ${article.category || 'NULL'} → ${enrichment.ai_category}`);
          console.log(`   📊 Sentiment: ${enrichment.ai_sentiment.toFixed(2)} | Importance: ${enrichment.ai_importance.toFixed(2)} | Breaking: ${enrichment.ai_is_breaking}`);
          enriched++;
        }
        
        // Petite pause pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (err) {
        console.error(`   ❌ Erreur: ${err.message}`);
        errors++;
        
        // Pause plus longue en cas d'erreur
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    const duration = Math.ceil((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ ENRICHISSEMENT TERMINÉ !');
    console.log(`   ⏱️  Durée: ${duration} secondes`);
    console.log(`   ✅ Enrichis: ${enriched}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📊 Taux de réussite: ${Math.round(enriched / articles.length * 100)}%`);
    
    if (errors > 0) {
      console.log('\n⚠️  Quelques erreurs sont survenues.');
      console.log('   Causes possibles:');
      console.log('   - Quota OpenAI temporairement atteint');
      console.log('   - Contenu d\'article trop court ou invalide');
      console.log('   - Erreur réseau temporaire');
      console.log('\n   💡 Relancez le script pour réessayer les articles échoués.');
    }
    
    console.log('\n💡 PROCHAINES ÉTAPES:');
    console.log('   1. Vérifier: node check-unenriched-articles.js');
    console.log('   2. Le cron automatique continuera d\'enrichir les nouveaux articles');
    console.log('   3. Rafraîchir le frontend pour voir les changements\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

enrichLatestUnenriched()
  .then(() => {
    console.log('🎉 Terminé !\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌', error);
    process.exit(1);
  });
