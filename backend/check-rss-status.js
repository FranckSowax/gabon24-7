const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function checkRSSStatus() {
  console.log('🔍 DIAGNOSTIC PROCESSEUR RSS\n');
  console.log('='.repeat(60));

  // 1. Derniers articles créés
  console.log('\n1️⃣ DERNIERS ARTICLES CRÉÉS EN BDD:');
  const { data: recentArticles } = await supabase
    .from('articles')
    .select('title, created_at, published_at, source')
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentArticles && recentArticles.length > 0) {
    console.log(`\n📰 ${recentArticles.length} derniers articles:\n`);
    recentArticles.forEach((article, i) => {
      const createdDate = new Date(article.created_at);
      const now = new Date();
      const hoursAgo = Math.round((now - createdDate) / (1000 * 60 * 60));
      
      console.log(`${i + 1}. ${article.title.substring(0, 60)}...`);
      console.log(`   ⏰ Créé: ${article.created_at} (il y a ${hoursAgo}h)`);
      console.log(`   📅 Publié: ${article.published_at}`);
      console.log(`   📍 Source: ${article.source}\n`);
    });
  } else {
    console.log('❌ AUCUN ARTICLE EN BDD !');
  }

  // 2. État des flux RSS
  console.log('\n2️⃣ ÉTAT DES FLUX RSS:');
  const { data: feeds } = await supabase
    .from('rss_feeds')
    .select('*')
    .order('last_fetch', { ascending: false });

  if (feeds && feeds.length > 0) {
    console.log(`\n📡 ${feeds.length} flux RSS configurés:\n`);
    feeds.forEach((feed, i) => {
      const lastFetch = feed.last_fetch ? new Date(feed.last_fetch) : null;
      const now = new Date();
      const hoursAgo = lastFetch ? Math.round((now - lastFetch) / (1000 * 60 * 60)) : null;
      
      const status = feed.is_active ? '✅ ACTIF' : '❌ INACTIF';
      const fetchInfo = lastFetch 
        ? `il y a ${hoursAgo}h (${feed.last_fetch})`
        : '❌ JAMAIS';
      
      console.log(`${i + 1}. ${feed.name}`);
      console.log(`   Status: ${status}`);
      console.log(`   Dernière synchro: ${fetchInfo}`);
      console.log(`   Erreurs: ${feed.error_count || 0}`);
      console.log(`   URL: ${feed.url}\n`);
    });
  }

  // 3. Vérifier si des articles ont été créés dans les dernières 24h
  console.log('\n3️⃣ ARTICLES DES DERNIÈRES 24H:');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count: recentCount } = await supabase
    .from('articles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday.toISOString());

  console.log(`📊 Articles créés depuis ${yesterday.toISOString()}: ${recentCount || 0}`);

  // 4. Vérifier les erreurs dans les logs (si disponible)
  console.log('\n4️⃣ FLUX AVEC ERREURS:');
  const { data: errorFeeds } = await supabase
    .from('rss_feeds')
    .select('name, error_count, last_error, last_fetch')
    .gt('error_count', 0);

  if (errorFeeds && errorFeeds.length > 0) {
    console.log(`\n⚠️ ${errorFeeds.length} flux avec erreurs:\n`);
    errorFeeds.forEach((feed, i) => {
      console.log(`${i + 1}. ${feed.name}`);
      console.log(`   Erreurs: ${feed.error_count}`);
      console.log(`   Dernière erreur: ${feed.last_error || 'N/A'}`);
      console.log(`   Dernière synchro: ${feed.last_fetch || 'Jamais'}\n`);
    });
  } else {
    console.log('✅ Aucun flux avec erreur');
  }

  // 5. Recommandations
  console.log('\n' + '='.repeat(60));
  console.log('🎯 DIAGNOSTIC:');
  console.log('='.repeat(60));

  if (!recentCount || recentCount === 0) {
    console.log('\n❌ PROBLÈME CRITIQUE: Aucun article créé depuis 24h');
    console.log('\n📝 ACTIONS RECOMMANDÉES:');
    console.log('   1. Lancer manuellement le processeur RSS:');
    console.log('      → cd backend');
    console.log('      → npm run process-rss\n');
    console.log('   2. Vérifier la connexion internet');
    console.log('   3. Vérifier que les flux RSS sont accessibles');
    console.log('   4. Vérifier les erreurs dans les logs\n');
  } else {
    console.log(`\n✅ ${recentCount} articles créés dans les dernières 24h`);
  }

  // Vérifier si le dernier article est vraiment récent (< 2h)
  if (recentArticles && recentArticles.length > 0) {
    const lastArticle = recentArticles[0];
    const lastCreated = new Date(lastArticle.created_at);
    const hoursAgo = Math.round((Date.now() - lastCreated.getTime()) / (1000 * 60 * 60));
    
    if (hoursAgo > 2) {
      console.log(`\n⚠️ ATTENTION: Le dernier article a été créé il y a ${hoursAgo}h`);
      console.log('   Le processeur RSS ne semble pas tourner régulièrement\n');
      console.log('💡 SOLUTION:');
      console.log('   Configurer un cron job pour exécuter le processeur RSS toutes les heures');
      console.log('   → npm run process-rss\n');
    }
  }

  console.log('='.repeat(60));
}

checkRSSStatus().catch(console.error);
