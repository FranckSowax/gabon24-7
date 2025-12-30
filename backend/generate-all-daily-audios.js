#!/usr/bin/env node

/**
 * Générer TOUS les résumés audio quotidiens
 * 9 résumés au total: 3 langues × 3 créneaux horaires
 */

require('dotenv').config();
const { generateMultilingualSummaries } = require('./services/audio-scheduler');

const TIME_SLOTS = [
  { slot: 'morning', emoji: '🌅', label: 'Matin (7h)' },
  { slot: 'afternoon', emoji: '☀️', label: 'Après-midi (13h)' },
  { slot: 'evening', emoji: '🌙', label: 'Soir (20h)' }
];

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('🌍 GÉNÉRATION COMPLÈTE DES RÉSUMÉS AUDIO QUOTIDIENS');
  console.log('═'.repeat(70));
  console.log(`⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })}`);
  console.log('\n📊 Plan de génération:');
  console.log('   • 9 résumés au total');
  console.log('   • 3 créneaux horaires (Matin, Après-midi, Soir)');
  console.log('   • 3 langues par créneau (🇫🇷 FR, 🇺🇸 EN, 🇨🇳 ZH)');
  console.log('═'.repeat(70) + '\n');

  const allResults = [];
  let totalGenerated = 0;

  for (const timeSlot of TIME_SLOTS) {
    console.log(`\n${timeSlot.emoji} ━━━━━ ${timeSlot.label.toUpperCase()} ━━━━━\n`);
    
    try {
      const summaryIds = await generateMultilingualSummaries(timeSlot.slot);
      allResults.push({
        timeSlot: timeSlot.slot,
        label: timeSlot.label,
        emoji: timeSlot.emoji,
        summaries: summaryIds,
        success: true
      });
      totalGenerated += summaryIds.length;
      
      console.log(`\n✅ ${timeSlot.label}: ${summaryIds.length}/3 résumés créés`);
      summaryIds.forEach(s => {
        const flag = s.language === 'fr' ? '🇫🇷' : (s.language === 'en' ? '🇺🇸' : '🇨🇳');
        console.log(`   ${flag} ${s.language.toUpperCase()}: ${s.id}`);
      });
      
    } catch (error) {
      console.error(`\n❌ Erreur ${timeSlot.label}:`, error.message);
      allResults.push({
        timeSlot: timeSlot.slot,
        label: timeSlot.label,
        emoji: timeSlot.emoji,
        success: false,
        error: error.message
      });
    }
    
    // Pause entre créneaux
    if (timeSlot.slot !== 'evening') {
      console.log('\n⏸️  Pause 10 secondes avant le créneau suivant...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  // Résumé final
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RÉSUMÉ FINAL DE LA GÉNÉRATION');
  console.log('═'.repeat(70) + '\n');
  
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  
  console.log(`✅ Créneaux réussis: ${successful.length}/3`);
  console.log(`📝 Résumés générés: ${totalGenerated}/9\n`);
  
  if (successful.length > 0) {
    console.log('Résumés créés par créneau:');
    successful.forEach(r => {
      console.log(`  ${r.emoji} ${r.label}: ${r.summaries.length} résumés`);
      r.summaries.forEach(s => {
        const flag = s.language === 'fr' ? '🇫🇷' : (s.language === 'en' ? '🇺🇸' : '🇨🇳');
        console.log(`     ${flag} ${s.language.toUpperCase()}`);
      });
    });
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  Créneaux échoués:');
    failed.forEach(r => {
      console.log(`  ${r.emoji} ${r.label}: ${r.error}`);
    });
  }
  
  console.log('\n' + '═'.repeat(70));
  
  if (totalGenerated === 9) {
    console.log('🎉 SUCCÈS TOTAL! Les 9 résumés audio ont été créés!');
  } else if (totalGenerated > 0) {
    console.log(`⚠️  ${totalGenerated}/9 résumés créés (certains ont échoué)`);
  } else {
    console.log('❌ Aucun résumé créé');
  }
  
  console.log('\n💡 Les résumés sont en cours de traitement asynchrone:');
  console.log('   1. Génération du texte (IA)');
  console.log('   2. Génération de l\'audio (Kokoro TTS)');
  console.log('   3. Upload vers Supabase Storage');
  console.log('   4. Mise à jour du statut → "completed"');
  console.log('\n⏱️  Attendez 2-5 minutes puis consultez:');
  console.log('   https://gabon-insight.netlify.app/audio/daily');
  console.log('\n' + '═'.repeat(70) + '\n');
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
