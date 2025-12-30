/**
 * Test du nouveau système audio avec analyse IA et Replicate Kokoro
 */

const fetch = require('node-fetch');

const API_URL = 'http://localhost:3001';
const TEST_USER_ID = '9bb0138d-a587-4b46-a541-a309048bf97a';

async function testDailyAudio() {
  console.log('🧪 Test du système audio quotidien avec analyse IA\n');
  
  try {
    console.log('1️⃣  Génération du résumé quotidien...');
    console.log('   - Analyse de tous les articles des 24h');
    console.log('   - Résumé politique généré par IA (max 2 min)');
    console.log('   - TTS via Replicate Kokoro\n');
    
    const startTime = Date.now();
    
    const response = await fetch(`${API_URL}/api/audio/generate-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'daily',
        userId: TEST_USER_ID,
        language: 'fr',
        pace: 'normal',
        optimize: true,
        sendWhatsApp: false
      })
    });

    const data = await response.json();
    
    if (!data.success) {
      console.log('❌ Erreur:', data.error);
      process.exit(1);
    }

    console.log('✅ Résumé créé:', data.summaryId);
    console.log('   Traitement en arrière-plan démarré...\n');

    // Suivre la progression
    console.log('📊 Suivi de la progression:');
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const checkRes = await fetch(`${API_URL}/api/audio/history/${TEST_USER_ID}`);
      const checkData = await checkRes.json();
      
      if (checkData.success) {
        const summary = checkData.summaries.find(s => s.id === data.summaryId);
        
        if (summary) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          
          // Afficher le statut avec symboles
          const statusSymbols = {
            'processing': '⏳',
            'synthesizing_audio': '🔊',
            'uploading_audio': '☁️',
            'completed': '✅',
            'failed': '❌'
          };
          
          const symbol = statusSymbols[summary.status] || '⏳';
          process.stdout.write(`\r${symbol} ${summary.status} (${elapsed}s)          `);
          
          if (summary.status === 'completed') {
            console.log('\n\n✅ Résumé audio terminé!\n');
            
            console.log('📄 Détails:');
            console.log(`   Articles analysés: ${summary.articles_count}`);
            console.log(`   Durée estimée: ${summary.audio_duration_seconds || 'N/A'} secondes`);
            
            if (summary.text_summary) {
              console.log(`\n📝 Script généré (${summary.text_summary.length} caractères):`);
              console.log('   ' + summary.text_summary.substring(0, 200) + '...\n');
            }
            
            if (summary.audio_url) {
              console.log(`🔊 Audio URL:`);
              console.log(`   ${summary.audio_url}\n`);
            } else {
              console.log('⚠️  Pas d\'audio généré (REPLICATE_API_TOKEN manquant?)\n');
            }
            
            console.log(`⏱️  Temps total: ${elapsed} secondes`);
            
            process.exit(0);
          }
          
          if (summary.status === 'failed') {
            console.log('\n\n❌ La génération a échoué');
            process.exit(1);
          }
        }
      }
      
      attempts++;
    }

    console.log('\n\n⏱️  Timeout atteint (2 minutes)');
    console.log('Le traitement continue en arrière-plan');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erreur test:', error.message);
    process.exit(1);
  }
}

// Vérifier la configuration
console.log('🔍 Vérification configuration:\n');

const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasReplicate = !!process.env.REPLICATE_API_TOKEN;

console.log(`   OPENAI_API_KEY: ${hasOpenAI ? '✅' : '❌ manquant'}`);
console.log(`   REPLICATE_API_TOKEN: ${hasReplicate ? '✅' : '❌ manquant'}\n`);

if (!hasOpenAI) {
  console.log('⚠️  Sans OPENAI_API_KEY, un résumé basique sera généré');
}

if (!hasReplicate) {
  console.log('⚠️  Sans REPLICATE_API_TOKEN, l\'audio ne sera pas généré');
}

console.log('\n' + '='.repeat(60) + '\n');

testDailyAudio();
