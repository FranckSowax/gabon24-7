const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function checkFeeds() {
  console.log('📡 VÉRIFICATION FLUX RSS\n');

  const { data: feeds, error } = await supabase
    .from('rss_feeds')
    .select('*')
    .order('name');

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  if (!feeds || feeds.length === 0) {
    console.log('❌ AUCUN FLUX RSS CONFIGURÉ EN BDD !');
    console.log('\n💡 Il faut ajouter des flux RSS dans la table rss_feeds');
    return;
  }

  console.log(`✅ ${feeds.length} flux RSS configurés:\n`);
  
  feeds.forEach((feed, i) => {
    console.log(`${i + 1}. ${feed.name}`);
    console.log(`   URL: ${feed.url}`);
    console.log(`   Actif: ${feed.is_active ? '✅' : '❌'}`);
    console.log(`   Dernière synchro: ${feed.last_fetch || 'Jamais'}`);
    console.log(`   Erreurs: ${feed.error_count || 0}\n`);
  });

  const activeFeeds = feeds.filter(f => f.is_active);
  console.log(`\n📊 Résumé: ${activeFeeds.length}/${feeds.length} flux actifs`);
}

checkFeeds().catch(console.error);
