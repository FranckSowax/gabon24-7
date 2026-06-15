#!/usr/bin/env node

/**
 * 🧪 TEST ROUTE /api/articles/home
 */

const supabaseService = require('./supabase-config');

async function testHomeRoute() {
  console.log('\n🧪 === TEST ROUTE /api/articles/home ===\n');
  
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36h
  
  console.log(`📅 Période: ${cutoffTime.toISOString()} → ${now.toISOString()}\n`);
  
  try {
    // Test 1: Sans jointure
    console.log('1️⃣ Test SANS jointure rss_feeds:');
    const { data: articles1, error: error1 } = await supabaseService.supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .gte('published_at', cutoffTime.toISOString())
      .order('published_at', { ascending: false })
      .limit(5);
    
    if (error1) {
      console.error('❌ Erreur:', error1);
    } else {
      console.log(`✅ ${articles1?.length || 0} articles trouvés`);
      articles1?.forEach((a, i) => {
        console.log(`   ${i+1}. ${a.title.substring(0, 50)}...`);
        console.log(`      - feed_id: ${a.feed_id || 'NULL'}`);
        console.log(`      - source: ${a.source}`);
      });
    }
    
    // Test 2: Avec jointure
    console.log('\n2️⃣ Test AVEC jointure rss_feeds:feed_id:');
    const { data: articles2, error: error2 } = await supabaseService.supabase
      .from('articles')
      .select(`
        *,
        rss_feeds:feed_id (
          media_name
        )
      `)
      .eq('is_published', true)
      .gte('published_at', cutoffTime.toISOString())
      .order('published_at', { ascending: false })
      .limit(5);
    
    if (error2) {
      console.error('❌ Erreur:', error2);
    } else {
      console.log(`✅ ${articles2?.length || 0} articles trouvés`);
      articles2?.forEach((a, i) => {
        console.log(`   ${i+1}. ${a.title.substring(0, 50)}...`);
        console.log(`      - feed_id: ${a.feed_id || 'NULL'}`);
        console.log(`      - rss_feeds: ${JSON.stringify(a.rss_feeds)}`);
      });
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    process.exit(1);
  }
}

testHomeRoute();
