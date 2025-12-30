#!/usr/bin/env node

/**
 * Script de test pour générer un résumé audio
 */

const API_URL = process.env.API_URL || 'https://gabon-insight-production.up.railway.app';

async function testGenerateSummary(language = 'fr') {
  console.log(`\n🧪 Test génération résumé audio [${language}]...`);
  console.log(`📍 URL: ${API_URL}/api/audio/generate-test-summary\n`);

  try {
    const response = await fetch(`${API_URL}/api/audio/generate-test-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ language })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Résumé en cours de génération!');
      console.log(`   ID: ${data.summaryId}`);
      console.log(`   Articles: ${data.articlesCount}`);
      console.log(`   Message: ${data.message}`);
      
      console.log('\n⏳ Attente de 10 secondes pour la génération...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Récupérer le résumé généré
      console.log('🔍 Récupération du résumé...\n');
      const latestResponse = await fetch(`${API_URL}/api/audio/latest-public?language=${language}`);
      const latestData = await latestResponse.json();
      
      if (latestData.success && latestData.summary) {
        console.log('✅ RÉSUMÉ RÉCUPÉRÉ:');
        console.log(`   Langue: ${latestData.summary.language}`);
        console.log(`   Articles: ${latestData.summary.articles_count}`);
        console.log(`   Status: ${latestData.summary.status}`);
        console.log(`   Créé: ${latestData.summary.created_at}\n`);
        
        if (latestData.summary.text_summary) {
          console.log('📝 CONTENU DU RÉSUMÉ:');
          console.log('─'.repeat(80));
          console.log(latestData.summary.text_summary);
          console.log('─'.repeat(80));
          console.log(`\n✅ Longueur: ${latestData.summary.text_summary.length} caractères\n`);
        } else {
          console.log('⚠️  Pas de text_summary dans le résumé\n');
        }
        
        if (latestData.summary.audio_url) {
          console.log(`🔊 URL audio: ${latestData.summary.audio_url}\n`);
        } else {
          console.log('ℹ️  Pas d\'audio généré (normal pour test)\n');
        }
      } else {
        console.log('⚠️  Aucun résumé trouvé');
        console.log('   Peut-être que le résumé n\'est pas encore complété\n');
      }
      
    } else {
      console.error('❌ Erreur:', data.error);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Test pour toutes les langues
async function testAllLanguages() {
  const languages = ['fr', 'en', 'zh'];
  
  for (const lang of languages) {
    await testGenerateSummary(lang);
    console.log('\n' + '='.repeat(80) + '\n');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Lancer le test
const language = process.argv[2] || 'fr';

if (language === 'all') {
  testAllLanguages();
} else {
  testGenerateSummary(language);
}
