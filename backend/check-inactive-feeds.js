const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function checkInactiveFeeds() {
  console.log('🔍 VÉRIFICATION STATUS DES FLUX\n');

  // Compter par status
  const { data: allFeeds } = await supabase
    .from('rss_feeds')
    .select('name, status');

  const statusCount = {};
  allFeeds.forEach(feed => {
    const status = feed.status || 'unknown';
    statusCount[status] = (statusCount[status] || 0) + 1;
  });

  console.log('📊 Répartition par status:\n');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`   ${status}: ${count} flux`);
  });

  // Flux inactifs
  const inactiveFeeds = allFeeds.filter(f => f.status !== 'active');
  
  if (inactiveFeeds.length > 0) {
    console.log(`\n⚠️ ${inactiveFeeds.length} flux inactifs:\n`);
    inactiveFeeds.forEach((feed, i) => {
      console.log(`${i + 1}. ${feed.name} (${feed.status})`);
    });
    
    console.log('\n💡 Action: Réactiver ces flux avec status = "active"');
  } else {
    console.log('\n✅ Tous les flux sont actifs !');
  }
}

checkInactiveFeeds().catch(console.error);
