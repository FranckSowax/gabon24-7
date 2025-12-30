#!/usr/bin/env node

console.log('='.repeat(60));
console.log('TEST RSS PROCESSOR - Simple');
console.log('='.repeat(60));

const supabaseService = require('./supabase-config');
const { supabase } = supabaseService;

async function test() {
  try {
    console.log('\n1️⃣ Test connexion Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('rss_feeds')
      .select('count', { count: 'exact', head: true });
    
    if (testError) {
      console.error('❌ Erreur connexion:', testError);
      return;
    }
    console.log('✅ Connexion OK');

    console.log('\n2️⃣ Récupération flux actifs...');
    const { data: feeds, error } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('status', 'active');

    if (error) {
      console.error('❌ Erreur getRSSFeeds:', error);
      return;
    }

    console.log(`✅ ${feeds.length} flux actifs trouvés\n`);
    
    if (feeds.length > 0) {
      console.log('📋 Premiers flux:');
      feeds.slice(0, 5).forEach((f, i) => {
        console.log(`${i + 1}. ${f.name} - ${f.url}`);
      });
    }

    console.log('\n3️⃣ Test import RSSProcessor...');
    const RSSProcessor = require('./rss-processor');
    console.log('✅ Module chargé');

    console.log('\n4️⃣ Création instance...');
    const processor = new RSSProcessor();
    console.log('✅ Instance créée');

    console.log('\n5️⃣ Lancement processAllFeeds()...');
    console.log('⏰ Ceci peut prendre plusieurs minutes...\n');
    
    await processor.processAllFeeds();
    
    console.log('\n✅ TEST TERMINÉ');

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.error('\nStack:', error.stack);
  }
}

test();
