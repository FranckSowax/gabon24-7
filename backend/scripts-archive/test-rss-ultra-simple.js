#!/usr/bin/env node

console.log('🔍 TEST RSS ULTRA SIMPLE\n');

const RSSParser = require('rss-parser');
const parser = new RSSParser();

async function test() {
  try {
    console.log('1️⃣ Parsing RSS feed...');
    const feed = await parser.parseURL('https://rss.app/feeds/YZrtbmX63sgyaGU6.xml'); // Gabon Media Time
    
    console.log(`✅ Feed parsé: ${feed.title}`);
    console.log(`📰 ${feed.items.length} articles trouvés\n`);
    
    if (feed.items.length > 0) {
      console.log('📋 Premier article:');
      const item = feed.items[0];
      console.log(`   Titre: ${item.title}`);
      console.log(`   Date: ${item.pubDate || item.isoDate}`);
      console.log(`   URL: ${item.link}`);
    }
    
    console.log('\n✅ TEST RÉUSSI !');
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error(error.stack);
  }
}

test();
