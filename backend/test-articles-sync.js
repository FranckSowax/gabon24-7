const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function testArticlesSync() {
  console.log('🔍 DIAGNOSTIC ARTICLES HOME\n');

  // 1. Test connexion
  console.log('1️⃣ Test connexion Supabase...');
  const { error: connError } = await supabase.from('articles').select('count', { count: 'exact', head: true });
  if (connError) {
    console.error('❌ Erreur connexion:', connError);
    return;
  }
  console.log('✅ Connexion OK\n');

  // 2. Nombre total d'articles
  console.log('2️⃣ Nombre total d\'articles...');
  const { count: totalCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true });
  console.log(`📊 Total articles en BDD: ${totalCount}\n`);

  // 3. Articles des dernières 36h (comme la route home)
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 36 * 60 * 60 * 1000);
  
  console.log('3️⃣ Articles des dernières 36h...');
  console.log(`⏰ Date actuelle: ${now.toISOString()}`);
  console.log(`⏰ Cutoff (36h): ${cutoffTime.toISOString()}\n`);

  const { data: recentArticles, error: recentError } = await supabase
    .from('articles')
    .select('*')
    .eq('is_published', true)
    .gte('published_at', cutoffTime.toISOString())
    .order('published_at', { ascending: false })
    .limit(10);

  if (recentError) {
    console.error('❌ Erreur récupération:', recentError);
    return;
  }

  console.log(`📰 Articles récents (< 36h): ${recentArticles.length}`);
  
  if (recentArticles.length > 0) {
    console.log('\n📋 Aperçu des 5 premiers articles:');
    recentArticles.slice(0, 5).forEach((article, i) => {
      console.log(`\n${i + 1}. ${article.title}`);
      console.log(`   📅 Publié: ${article.published_at}`);
      console.log(`   📍 Source: ${article.source || 'N/A'}`);
      console.log(`   ✅ Published: ${article.is_published}`);
    });
  } else {
    console.log('⚠️ AUCUN article récent trouvé !');
    
    // Vérifier les articles les plus récents en BDD
    console.log('\n4️⃣ Vérification des articles les plus récents en BDD...');
    const { data: latestArticles } = await supabase
      .from('articles')
      .select('title, published_at, is_published')
      .order('published_at', { ascending: false })
      .limit(5);
    
    console.log('\n📋 Les 5 articles les plus récents en BDD:');
    latestArticles.forEach((article, i) => {
      const publishedDate = new Date(article.published_at);
      const hoursAgo = Math.round((now - publishedDate) / (1000 * 60 * 60));
      
      console.log(`\n${i + 1}. ${article.title}`);
      console.log(`   📅 Publié: ${article.published_at} (il y a ${hoursAgo}h)`);
      console.log(`   ✅ Published: ${article.is_published}`);
    });
  }

  // 5. Articles non publiés
  console.log('\n5️⃣ Articles non publiés (is_published = false)...');
  const { count: unpublishedCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .eq('is_published', false);
  console.log(`🔒 Articles non publiés: ${unpublishedCount}`);

  // 6. Test processeur RSS
  console.log('\n6️⃣ Vérification dernière exécution RSS...');
  const { data: feeds } = await supabase
    .from('rss_feeds')
    .select('name, is_active, last_fetch, error_count')
    .limit(5);
  
  if (feeds && feeds.length > 0) {
    console.log('\n📡 État des flux RSS:');
    feeds.forEach(feed => {
      console.log(`\n- ${feed.name}`);
      console.log(`  Active: ${feed.is_active}`);
      console.log(`  Last fetch: ${feed.last_fetch || 'Jamais'}`);
      console.log(`  Erreurs: ${feed.error_count || 0}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 RECOMMANDATIONS:');
  console.log('='.repeat(60));
  
  if (recentArticles.length === 0) {
    console.log('⚠️ PROBLÈME: Aucun article des dernières 36h');
    console.log('📝 SOLUTIONS:');
    console.log('   1. Lancer le processeur RSS: npm run process-rss');
    console.log('   2. Vérifier que les flux RSS sont actifs');
    console.log('   3. Vérifier la connexion internet');
  } else {
    console.log('✅ Tout semble OK - Articles disponibles');
  }
  
  console.log('\n' + '='.repeat(60));
}

testArticlesSync().catch(console.error);
