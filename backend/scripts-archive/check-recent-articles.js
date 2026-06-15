const supabaseService = require('./supabase-config');

async function checkRecentArticles() {
  console.log('\n🔍 Vérification des articles récents...\n');
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  
  console.log('📅 Période de recherche:');
  console.log(`   Depuis: ${new Date(twentyFourHoursAgo).toLocaleString('fr-FR')}`);
  console.log(`   Jusqu'à: ${new Date(now).toLocaleString('fr-FR')}`);
  console.log('');
  
  // Test 1: Compter TOUS les articles
  const { data: allArticles, error: allError } = await supabaseService.supabase
    .from('articles')
    .select('id, title, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (allError) {
    console.error('❌ Erreur récupération tous les articles:', allError);
  } else {
    console.log(`📊 Total articles dans la BDD: ${allArticles?.length || 0}`);
    if (allArticles && allArticles.length > 0) {
      console.log('\n📰 Les 10 derniers articles (par created_at):');
      allArticles.forEach((a, i) => {
        const age = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60));
        console.log(`   ${i+1}. [${age}h] ${a.title.substring(0, 60)}...`);
      });
    }
  }
  
  // Test 2: Articles des dernières 24h
  const { data: recentArticles, error: recentError } = await supabaseService.supabase
    .from('articles')
    .select('id, title, created_at')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false });
  
  console.log('\n⏰ Articles des dernières 24h (created_at >= 24h ago):');
  if (recentError) {
    console.error('❌ Erreur:', recentError);
  } else if (!recentArticles || recentArticles.length === 0) {
    console.log('   ❌ AUCUN article trouvé dans les dernières 24h');
    console.log('   💡 Solution: Les articles sont trop vieux');
  } else {
    console.log(`   ✅ ${recentArticles.length} articles trouvés`);
    recentArticles.slice(0, 5).forEach((a, i) => {
      const age = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60));
      console.log(`   ${i+1}. [${age}h] ${a.title.substring(0, 60)}...`);
    });
  }
  
  // Test 3: Vérifier si SERVICE_ROLE est utilisée
  console.log('\n🔐 Vérification clé Supabase:');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && serviceKey.length > 50) {
    console.log('   ✅ SERVICE_ROLE_KEY configurée (bypass RLS)');
  } else {
    console.log('   ⚠️  SERVICE_ROLE_KEY non configurée (utilise ANON - RLS actif)');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 DIAGNOSTIC:');
  
  if (!recentArticles || recentArticles.length === 0) {
    console.log('\n❌ PROBLÈME: Aucun article dans les dernières 24h');
    console.log('\n💡 SOLUTIONS:');
    console.log('   1. Lancer le processeur RSS pour ajouter de nouveaux articles');
    console.log('   2. Modifier le code pour utiliser created_at au lieu de published_at');
    console.log('   3. Augmenter la fenêtre de temps (48h au lieu de 24h)');
  } else {
    console.log(`\n✅ OK: ${recentArticles.length} articles disponibles`);
    console.log('\n💡 L\'endpoint /api/audio/generate-test-summary devrait fonctionner');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkRecentArticles().catch(console.error);
