#!/usr/bin/env node

/**
 * Script de test pour Replicate Kokoro TTS
 * Génère des audios de test dans les 3 langues (FR, EN, ZH)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generateAudio, testConnection } = require('./services/replicate-kokoro-tts');

// Textes de test pour chaque langue
const testTexts = {
  fr: "Bonjour et bienvenue dans votre résumé d'actualités du Gabon. Aujourd'hui, nous faisons le point sur l'actualité politique et économique du pays.",
  en: "Hello and welcome to your Gabon news summary. Today, we cover the latest political and economic developments in the country.",
  zh: "您好，欢迎收听加蓬新闻摘要。今天，我们将报道该国最新的政治和经济发展。"
};

async function testVoice(language, text) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎙️  TEST VOIX ${language.toUpperCase()}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const startTime = Date.now();
  
  try {
    console.log(`📝 Texte: "${text}"`);
    console.log(`⏳ Génération audio en cours...\n`);
    
    const audioBuffer = await generateAudio(text, language, 'normal');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const sizeKB = (audioBuffer.length / 1024).toFixed(2);
    
    // Sauvegarder dans un fichier
    const outputDir = path.join(__dirname, 'test-audio-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `test-${language}-${Date.now()}.mp3`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, audioBuffer);
    
    console.log(`✅ Audio généré avec succès!`);
    console.log(`   Fichier: ${filename}`);
    console.log(`   Taille: ${sizeKB} KB`);
    console.log(`   Durée génération: ${duration}s`);
    console.log(`   Chemin: ${filepath}`);
    
    return { success: true, language, sizeKB, duration, filepath };
    
  } catch (error) {
    console.error(`❌ Erreur génération ${language}:`, error.message);
    return { success: false, language, error: error.message };
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🔊 TEST REPLICATE KOKORO TTS - 3 LANGUES');
  console.log('═'.repeat(60));
  
  // 1. Test connexion
  console.log('\n📡 Étape 1: Test connexion Replicate API...\n');
  
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ REPLICATE_API_TOKEN manquant dans .env');
    console.error('   Configurez cette variable dans Railway ou .env local\n');
    process.exit(1);
  }
  
  console.log('✅ REPLICATE_API_TOKEN configuré');
  console.log(`   Longueur: ${process.env.REPLICATE_API_TOKEN.length} caractères`);
  
  const connected = await testConnection();
  if (!connected) {
    console.error('\n❌ Connexion Replicate échouée');
    process.exit(1);
  }
  
  // 2. Générer les 3 audios
  console.log('\n📡 Étape 2: Génération des audios de test...\n');
  
  const results = [];
  
  for (const [language, text] of Object.entries(testTexts)) {
    const result = await testVoice(language, text);
    results.push(result);
    
    // Pause entre les requêtes
    if (language !== 'zh') {
      console.log('\n⏸️  Pause 3 secondes...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // 3. Résumé final
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('═'.repeat(60) + '\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Réussis: ${successful.length}/3`);
  console.log(`❌ Échoués: ${failed.length}/3\n`);
  
  if (successful.length > 0) {
    console.log('Audios générés:');
    successful.forEach(r => {
      console.log(`  • ${r.language.toUpperCase()}: ${r.sizeKB} KB (${r.duration}s)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nErreurs:');
    failed.forEach(r => {
      console.log(`  • ${r.language.toUpperCase()}: ${r.error}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  if (successful.length === 3) {
    console.log('🎉 SUCCÈS TOTAL! Les 3 voix fonctionnent parfaitement!\n');
  } else {
    console.log('⚠️  Certaines voix ont échoué. Vérifiez les logs ci-dessus.\n');
  }
}

// Exécuter le test
main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
