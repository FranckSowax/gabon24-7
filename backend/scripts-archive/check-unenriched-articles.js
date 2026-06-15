/**
 * 🔍 DIAGNOSTIC: Articles non enrichis par l'IA
 * 
 * Vérifie combien d'articles n'ont pas d'enrichissement IA
 * et pourquoi (fallback utilisé vs erreur)
 */

const supabaseService = require('./supabase-config');

async function checkUnenrichedArticles() {
  console.log('\n🔍 DIAGNOSTIC DES ARTICLES NON ENRICHIS IA');
  console.log('='.repeat(80));
  
  try {
    // 1. Total des articles
    const { count: totalCount } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Total des articles: ${totalCount}`);
    
    // 2. Articles avec enrichissement IA complet
    const { count: enrichedCount } = await supabaseService.supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .not('ai_category', 'is', null)
      .not('ai_sentiment', 'is', null)
      .not('ai_importance', 'is', null);
    
    console.log(`✅ Articles enrichis IA: ${enrichedCount}`);
    
    // 3. Articles sans enrichissement IA
    const unenrichedCount = totalCount - enrichedCount;
    console.log(`❌ Articles NON enrichis: ${unenrichedCount}`);
    
    // 4. Articles récents (dernières 24h) sans enrichissement
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentUnenriched } = await supabaseService.supabase
      .from('articles')
      .select('id, title, created_at, ai_category')
      .is('ai_category', null)
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log(`\n📅 Articles récents (24h) sans enrichissement IA: ${recentUnenriched?.length || 0}`);
    
    if (recentUnenriched && recentUnenriched.length > 0) {
      console.log('\n🔴 Exemples d\'articles non enrichis:');
      recentUnenriched.forEach((article, i) => {
        console.log(`\n${i + 1}. ${article.title.substring(0, 60)}...`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Créé: ${new Date(article.created_at).toLocaleString('fr-FR')}`);
        console.log(`   ai_category: ${article.ai_category || 'NULL'}`);
      });
    }
    
    // 5. Distribution des catégories
    const { data: categoryDist } = await supabaseService.supabase
      .from('articles')
      .select('category')
      .not('category', 'is', null);
    
    if (categoryDist) {
      const catCount = {};
      categoryDist.forEach(a => {
        catCount[a.category] = (catCount[a.category] || 0) + 1;
      });
      
      console.log('\n\n📈 DISTRIBUTION DES CATÉGORIES:');
      Object.entries(catCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, count]) => {
          const bar = '█'.repeat(Math.ceil(count / 5));
          console.log(`   ${cat.padEnd(20)} ${count.toString().padStart(4)} ${bar}`);
        });
    }
    
    // 6. Recommandations
    console.log('\n\n💡 RECOMMANDATIONS:');
    console.log('='.repeat(80));
    
    if (unenrichedCount > 0) {
      console.log(`\n⚠️  ${unenrichedCount} articles ne sont pas enrichis par l'IA`);
      console.log('\nCauses possibles:');
      console.log('   1. ❌ Quota OpenAI atteint → Articles utilisent le fallback');
      console.log('   2. ❌ Erreur réseau temporaire lors de l\'import');
      console.log('   3. ❌ OPENAI_API_KEY non configurée');
      console.log('   4. ❌ Articles importés avant activation de l\'enrichissement');
      
      console.log('\n🔧 Solutions:');
      console.log('   1. Vérifier le quota OpenAI: https://platform.openai.com/usage');
      console.log('   2. Lancer l\'enrichissement manuel:');
      console.log('      node enrich-recent-articles.js');
      console.log('   3. Le cron automatique s\'exécute toutes les heures');
      console.log('   4. Vérifier les logs du serveur pour voir les erreurs OpenAI');
    } else {
      console.log('\n✅ Tous les articles sont enrichis par l\'IA !');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

checkUnenrichedArticles()
  .then(() => {
    console.log('\n✅ Diagnostic terminé !\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌', error);
    process.exit(1);
  });
