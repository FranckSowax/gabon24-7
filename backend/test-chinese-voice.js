#!/usr/bin/env node

/**
 * Test rapide de la voix chinoise Kokoro
 */

require('dotenv').config();
const { generateAudio } = require('./services/replicate-kokoro-tts');

async function testChineseVoice() {
  console.log('\n🧪 === TEST VOIX CHINOISE KOKORO ===\n');
  
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ REPLICATE_API_TOKEN manquant');
    process.exit(1);
  }
  
  const testText = "您好，欢迎收听加蓬新闻摘要。今天，我们将报道该国最新的政治和经济发展。";
  
  console.log('📝 Texte test:', testText);
  console.log('🎙️  Voix: af_nicole (Mandarin féminine)');
  console.log('⏳ Génération en cours...\n');
  
  try {
    const startTime = Date.now();
    const audioBuffer = await generateAudio(testText, 'zh', 'normal');
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const sizeKB = (audioBuffer.length / 1024).toFixed(2);
    
    console.log('✅ SUCCÈS !');
    console.log(`   Taille: ${sizeKB} KB`);
    console.log(`   Durée: ${duration}s`);
    console.log(`   Buffer: ${audioBuffer.length} bytes\n`);
    
    console.log('🎉 La voix chinoise fonctionne correctement !\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
    console.error('\nDétails:', error);
    
    console.log('\n💡 Solutions possibles:');
    console.log('   1. Vérifier que REPLICATE_API_TOKEN est valide');
    console.log('   2. Essayer une autre voix chinoise (zm_yunxi, af_sky)');
    console.log('   3. Vérifier les logs Replicate pour plus de détails\n');
    
    process.exit(1);
  }
}

testChineseVoice();
