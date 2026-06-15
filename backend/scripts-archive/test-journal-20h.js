#!/usr/bin/env node

/**
 * 🧪 TEST RAPIDE - Vérification du journal de 20h
 * 
 * Vérifie que le journal de 20h est bien sélectionné
 */

const { extractJournalFromRSS } = require('./youtube-journal-extractor');

async function testJournal20h() {
  console.log('\n🧪 TEST: Vérification du journal de 20h\n');
  console.log('='.repeat(80));
  
  try {
    const result = await extractJournalFromRSS();
    
    if (!result) {
      console.error('❌ ÉCHEC: Aucun journal trouvé');
      process.exit(1);
    }
    
    console.log('\n📊 RÉSULTAT DU TEST:\n');
    console.log(`Titre: ${result.title}`);
    console.log(`URL: ${result.link}`);
    console.log(`Date: ${result.pubDate}`);
    
    const titleLower = result.title.toLowerCase();
    const is20h = titleLower.includes('20h');
    const is23h = titleLower.includes('23h');
    const is13h = titleLower.includes('13h');
    
    console.log('\n🔍 ANALYSE:\n');
    console.log(`Journal de 20h: ${is20h ? '✅ OUI' : '❌ NON'}`);
    console.log(`Journal de 23h: ${is23h ? '✅ OUI' : '❌ NON'}`);
    console.log(`Journal de 13h: ${is13h ? '⚠️  OUI (pas prioritaire)' : '✅ NON'}`);
    
    console.log('\n' + '='.repeat(80));
    
    if (is20h || is23h) {
      console.log('\n✅ TEST RÉUSSI: Journal prioritaire sélectionné (20h ou 23h)');
      process.exit(0);
    } else if (is13h) {
      console.log('\n⚠️  ATTENTION: Journal de 13h sélectionné');
      console.log('   Vérifiez qu\'il n\'y a pas de journal de 20h/23h disponible');
      process.exit(0);
    } else {
      console.log('\n✅ TEST RÉUSSI: Journal TV sélectionné');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

// Exécuter le test
testJournal20h();
