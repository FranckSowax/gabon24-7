const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function activateAllFeeds() {
  console.log('🔄 ACTIVATION DE TOUS LES FLUX RSS\n');

  // Réactiver tous les flux
  const { data, error } = await supabase
    .from('rss_feeds')
    .update({ is_active: true })
    .eq('is_active', false)
    .select();

  if (error) {
    console.error('❌ Erreur:', error);
    return;
  }

  console.log(`✅ ${data.length} flux RSS ont été réactivés !\n`);
  
  data.forEach((feed, i) => {
    console.log(`${i + 1}. ${feed.name} → ACTIVÉ ✅`);
  });

  console.log('\n🎯 Prochaines étapes:');
  console.log('   1. Lancer le processeur RSS: node rss-processor.js');
  console.log('   2. Les nouveaux articles seront ajoutés automatiquement\n');
}

activateAllFeeds().catch(console.error);
