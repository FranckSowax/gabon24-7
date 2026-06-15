/**
 * 🧪 TEST - Générateur de sondages depuis résumés audio
 */

const { generatePollsFromLatestAudioSummary } = require('./services/poll-generator-from-audio');

console.log('🧪 TEST GÉNÉRATEUR DE SONDAGES');
console.log('='.repeat(80));
console.log('');

generatePollsFromLatestAudioSummary()
  .then((result) => {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RÉSULTAT FINAL:\n');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n✅ Test terminé !\n');
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error);
    process.exit(1);
  });
