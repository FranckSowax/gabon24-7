require('dotenv').config();
const geminiService = require('../services/gemini-service');

async function testGemini() {
  console.log('🧪 TEST: Google Gemini 3 Integration');
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ ERREUR: GEMINI_API_KEY manquant dans .env');
    process.exit(1);
  }

  // Test 1: Texte
  try {
    console.log('\n1. Test Génération Texte (Reasoning)...');
    const text = await geminiService.generateText('Explique en une phrase pourquoi le Gabon est un pays unique.', {
      temperature: 0.7
    });
    console.log('✅ Réponse Texte:', text);
  } catch (error) {
    console.error('❌ ECHEC TEXTE:', error.message);
  }

  // Test 2: JSON
  try {
    console.log('\n2. Test Génération JSON...');
    const json = await geminiService.generateJSON('Génère un profil utilisateur fictif gabonais (nom, age, ville) en JSON.', {
      temperature: 0.5
    });
    console.log('✅ Réponse JSON:', JSON.stringify(json, null, 2));
  } catch (error) {
    console.error('❌ ECHEC JSON:', error.message);
  }

  // Test 3: Image
  try {
    console.log('\n3. Test Génération Image...');
    // Note: Image generation might be slower
    const imageBase64 = await geminiService.generateImage('Beautiful landscape of Libreville, Gabon, sunset, photorealistic', {
      aspectRatio: '16:9'
    });
    console.log('✅ Image générée (Base64 length):', imageBase64.length);
  } catch (error) {
    console.error('❌ ECHEC IMAGE:', error.message);
    if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
      console.warn('⚠️ Limite de quota atteinte (Normal pour une clé gratuite)');
    }
  }

  console.log('\n🏁 FIN DES TESTS');
}

testGemini();
