/**
 * 🤖 ENRICHISSEMENT DES ARTICLES D'AUJOURD'HUI UNIQUEMENT
 * 
 * Enrichit tous les articles créés aujourd'hui qui n'ont pas d'enrichissement IA
 */

const supabaseService = require('./supabase-config');
const ArticleAIEnrichment = require('./services/article-ai-enrichment');

async function enrichTodayArticles() {
  console.log('\n🤖 ENRICHISSEMENT DES ARTICLES D\'AUJOURD\'HUI');
  console.log('='.repeat(80));
  
  const enrichmentService = new ArticleAIEnrichment();
  
  if (!enrichmentService.isConfigured) {
    console.log('\n❌ ERREUR: OPENAI_API_KEY non configurée');
    console.log('   Vérifiez votre fichier .env');
    process.exit(1);
  }
  
  try {
    // Date d'aujourd'hui à minuit (début de journée)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    
    console.log(`\n📅 Date de référence: ${today.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`);
    console.log(`   (depuis ${today.toLocaleString('fr-FR')})`);
    
    // Récupérer les articles d'aujourd'hui sans enrichissement IA
    console.log(`\n🔍 Recherche des articles d'aujourd'hui sans enrichissement IA...`);
    
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, content, summary, summary_ai, category, created_at')
      .is('enrichment_status', null)
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur Supabase:', error.message);
      process.exit(1);
    }
    
    if (!articles || articles.length === 0) {
      console.log('\n✅ AUCUN ARTICLE À ENRICHIR !');
      console.log('   Tous les articles d\'aujourd\'hui sont déjà enrichis par l\'IA.');
      console.log('\n📊 Statistiques:');
      
      // Compter les articles enrichis d'aujourd'hui
      const { count: enrichedToday } = await supabaseService.supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('enrichment_status', 'completed')
        .gte('created_at', todayISO);
      
      console.log(`   ✅ Articles enrichis aujourd'hui: ${enrichedToday || 0}`);
      
      process.exit(0);
    }
    
    console.log(`\n📊 ARTICLES À ENRICHIR: ${articles.length}`);
    console.log(`⏱️  Temps estimé: ~${Math.ceil(articles.length * 2)} secondes`);
    console.log('\n' + '='.repeat(80));
    
    let enriched = 0;
    let errors = 0;
    const startTime = Date.now();
    
    for (const article of articles) {
      try {
        const articleTime = new Date(article.created_at).toLocaleTimeString('fr-FR');
        
        console.log(`\n[${enriched + errors + 1}/${articles.length}] 🤖 Enrichissement en cours...`);
        console.log(`   ⏰ Créé à: ${articleTime}`);
        console.log(`   📰 "${article.title.substring(0, 70)}..."`);
        
        // Enrichissement IA complet
        const enrichment = await enrichmentService.enrichArticle(
          article.title,
          article.content || '',
          article.summary || article.summary_ai || ''
        );
        
        // Mise à jour dans Supabase
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
          const oldCat = article.category || 'NULL';
          console.log(`   ✅ ${oldCat} → ${enrichment.ai_category}`);
          console.log(`   📝 Résumé IA: "${enrichment.ai_summary?.substring(0, 80)}..."`); // Note: enrichment.ai_summary vient du service, summary_ai va en BDD
          console.log(`   📊 Sentiment: ${enrichment.ai_sentiment.toFixed(2)} | Importance: ${enrichment.ai_importance.toFixed(2)} | Breaking: ${enrichment.ai_is_breaking ? '🔥 OUI' : 'Non'}`);
          console.log(`   🏷️  Keywords: ${enrichment.ai_keywords.slice(0, 3).join(', ')}...`);
          enriched++;
        }
        
        // Pause pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (err) {
        console.error(`   ❌ Erreur: ${err.message}`);
        errors++;
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    const duration = Math.ceil((Date.now() - startTime) / 1000);
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ENRICHISSEMENT TERMINÉ !');
    console.log(`   ⏱️  Durée: ${Math.floor(duration / 60)}min ${duration % 60}s`);
    console.log(`   ✅ Enrichis: ${enriched}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📊 Taux de réussite: ${Math.round(enriched / articles.length * 100)}%`);
    
    // Statistiques finales
    console.log('\n📈 STATISTIQUES DU JOUR:');
    
    const { count: totalToday } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);
    
    const { count: enrichedToday } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'completed')
      .gte('created_at', todayISO);
    
    console.log(`   📰 Total articles aujourd'hui: ${totalToday || 0}`);
    console.log(`   ✅ Articles enrichis: ${enrichedToday || 0}`);
    console.log(`   ❌ Articles non enrichis: ${(totalToday || 0) - (enrichedToday || 0)}`);
    
    if (errors > 0) {
      console.log('\n⚠️  Quelques erreurs sont survenues.');
      console.log('   💡 Relancez le script pour réessayer les articles échoués.');
    }
    
    console.log('\n💡 PROCHAINES ÉTAPES:');
    console.log('   1. Les nouveaux articles seront enrichis automatiquement');
    console.log('   2. Le cron horaire rattrape les articles manqués');
    console.log('   3. Rafraîchissez le frontend pour voir les changements\n');
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

enrichTodayArticles()
  .then(() => {
    console.log('✅ Terminé !\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌', error);
    process.exit(1);
  });
