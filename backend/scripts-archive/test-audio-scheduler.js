/**
 * Test du planificateur de résumés audio automatiques
 */

const { generateManualSummary, getPublicSummaries, SCHEDULED_TIMES } = require('./services/audio-scheduler');

async function testScheduler() {
  console.log('🧪 Test du planificateur de résumés audio\n');
  
  try {
    // Afficher les horaires configurés
    console.log('⏰ Horaires planifiés:');
    console.log(`   - Matin: ${SCHEDULED_TIMES.MORNING}`);
    console.log(`   - Après-midi: ${SCHEDULED_TIMES.AFTERNOON}`);
    console.log(`   - Soir: ${SCHEDULED_TIMES.EVENING}\n`);

    // Générer un résumé test
    console.log('1️⃣  Génération manuelle d\'un résumé test...');
    const summaryId = await generateManualSummary('test');
    
    if (summaryId) {
      console.log(`✅ Résumé créé: ${summaryId}`);
      console.log('   Le traitement continue en arrière-plan...\n');
    } else {
      console.log('❌ Échec de la génération\n');
      process.exit(1);
    }

    // Attendre un peu pour voir la progression
    console.log('⏳ Attente de 5 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Récupérer les résumés publics
    console.log('2️⃣  Récupération des résumés publics...');
    const summaries = await getPublicSummaries(5);
    
    console.log(`✅ ${summaries.length} résumé(s) trouvé(s)\n`);

    if (summaries.length > 0) {
      console.log('📋 Liste des résumés:');
      summaries.forEach((s, idx) => {
        const timeSlotEmoji = {
          morning: '🌅',
          afternoon: '☀️',
          evening: '🌙',
          test: '🧪',
          manual: '🔧'
        }[s.time_slot || 'manual'] || '📻';

        console.log(`\n   ${idx + 1}. ${timeSlotEmoji} ${s.time_slot || 'unknown'} - ${new Date(s.created_at).toLocaleString('fr-FR')}`);
        console.log(`      ID: ${s.id}`);
        console.log(`      Statut: ${s.status}`);
        console.log(`      Articles: ${s.articles_count}`);
        if (s.audio_url) {
          console.log(`      Audio: ${s.audio_url.substring(0, 60)}...`);
        }
        if (s.text_summary) {
          console.log(`      Script: ${s.text_summary.substring(0, 100)}...`);
        }
      });
    }

    console.log('\n✅ Tests terminés !');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Les résumés seront générés automatiquement à 7h, 13h et 20h');
    console.log('   2. Vérifiez les logs backend pour suivre la progression');
    console.log('   3. Les résumés publics sont accessibles via /api/audio/public');
    console.log('   4. Le dernier résumé est visible sur la page d\'accueil');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur test:', error);
    process.exit(1);
  }
}

// Vérifier configuration
console.log('🔍 Vérification configuration:\n');

const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasReplicate = !!process.env.REPLICATE_API_TOKEN;

console.log(`   OPENAI_API_KEY: ${hasOpenAI ? '✅' : '❌ manquant (résumé basique sera utilisé)'}`);
console.log(`   REPLICATE_API_TOKEN: ${hasReplicate ? '✅' : '❌ manquant (pas d\'audio)'}\n`);

if (!hasOpenAI && !hasReplicate) {
  console.log('⚠️  Attention: Sans les clés API, seuls les résumés basiques textuels seront générés\n');
}

console.log('='.repeat(70) + '\n');

testScheduler();
