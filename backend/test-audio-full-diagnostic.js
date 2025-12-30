/**
 * 🔍 DIAGNOSTIC COMPLET AUDIO SUMMARIES
 * Test de toute la chaîne : Replicate API + Supabase Storage
 */

require('dotenv').config();
const { generateAudio } = require('./services/replicate-kokoro-tts');
const supabaseService = require('./supabase-config');

async function runDiagnostic() {
  console.log('\n🔍 === DIAGNOSTIC AUDIO SUMMARIES ===\n');
  
  // 1. Vérifier les variables d'environnement
  console.log('1️⃣ Variables d\'environnement:\n');
  const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
  const hasSupabaseUrl = !!process.env.SUPABASE_URL;
  const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log(`   REPLICATE_API_TOKEN: ${hasReplicate ? '✅ Présent' : '❌ Manquant'}`);
  if (hasReplicate) {
    console.log(`      → Longueur: ${process.env.REPLICATE_API_TOKEN.length} caractères`);
    console.log(`      → Préfixe: ${process.env.REPLICATE_API_TOKEN.substring(0, 5)}...`);
  }
  console.log(`   SUPABASE_URL: ${hasSupabaseUrl ? '✅' : '❌'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${hasSupabaseKey ? '✅' : '❌'}\n`);
  
  if (!hasReplicate) {
    console.log('❌ Impossible de continuer sans REPLICATE_API_TOKEN\n');
    process.exit(1);
  }
  
  // 2. Tester l'API Replicate
  console.log('2️⃣ Test API Replicate Kokoro:\n');
  try {
    const testText = "Bonjour, ceci est un test de génération audio.";
    console.log(`   📝 Texte test: "${testText}"`);
    console.log('   🔊 Génération en cours...');
    
    const startTime = Date.now();
    const audioBuffer = await generateAudio(testText, 'fr', 'normal');
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`   ✅ Audio généré: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024).toFixed(2)} KB)`);
    console.log(`   ⏱️  Temps: ${duration}s\n`);
  } catch (error) {
    console.error('   ❌ Erreur génération audio:', error.message);
    console.error('      Stack:', error.stack);
    console.log('\n💡 Solutions possibles:');
    console.log('   - Vérifier que le token Replicate est valide');
    console.log('   - Vérifier les crédits Replicate sur https://replicate.com/account');
    console.log('   - Tester manuellement: https://replicate.com/jaaari/kokoro-82m\n');
    process.exit(1);
  }
  
  // 3. Vérifier le bucket Supabase Storage
  console.log('3️⃣ Test Supabase Storage (bucket audio-summaries):\n');
  try {
    // Lister les fichiers du bucket
    const { data: files, error: listError } = await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .list('', { limit: 5 });
    
    if (listError) {
      if (listError.message.includes('not found') || listError.message.includes('does not exist')) {
        console.log('   ❌ Bucket "audio-summaries" n\'existe pas\n');
        console.log('💡 Solution: Créer le bucket dans Supabase Dashboard:');
        console.log('   1. Aller sur https://supabase.com/dashboard');
        console.log('   2. Projet → Storage → Create bucket');
        console.log('   3. Nom: audio-summaries');
        console.log('   4. Public: OUI (cocher "Public bucket")');
        console.log('   5. Allowed MIME types: audio/mpeg, audio/mp3\n');
        process.exit(1);
      }
      throw listError;
    }
    
    console.log(`   ✅ Bucket "audio-summaries" existe`);
    console.log(`   📊 Fichiers présents: ${files?.length || 0}\n`);
    
    // Test upload
    console.log('   🔄 Test upload fichier...');
    const testFileName = `diagnostic-test-${Date.now()}.txt`;
    const testContent = 'Test upload diagnostic';
    
    const { error: uploadError } = await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .upload(testFileName, testContent, {
        contentType: 'text/plain',
        upsert: false
      });
    
    if (uploadError) {
      console.error('   ❌ Erreur upload:', uploadError.message);
      console.log('\n💡 Vérifier les permissions du bucket dans Supabase Dashboard\n');
      process.exit(1);
    }
    
    console.log('   ✅ Upload test réussi');
    
    // Récupérer l'URL publique
    const { data: urlData } = supabaseService.supabase
      .storage
      .from('audio-summaries')
      .getPublicUrl(testFileName);
    
    console.log(`   🔗 URL publique: ${urlData.publicUrl}`);
    
    // Nettoyer
    await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .remove([testFileName]);
    
    console.log('   🧹 Fichier test nettoyé\n');
    
  } catch (error) {
    console.error('   ❌ Erreur Storage:', error.message);
    console.error('      Stack:', error.stack);
    process.exit(1);
  }
  
  // 4. Test complet end-to-end
  console.log('4️⃣ Test complet génération + upload:\n');
  try {
    const fullText = "Ceci est un test complet de la chaîne audio. Le texte est généré, converti en audio, puis uploadé sur Supabase Storage.";
    console.log(`   📝 Génération audio...`);
    
    const audioBuffer = await generateAudio(fullText, 'fr', 'normal');
    console.log(`   ✅ Audio généré: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    
    console.log('   📤 Upload vers Supabase...');
    const fileName = `test-complete-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Upload error: ${uploadError.message}`);
    }
    
    const { data: urlData } = supabaseService.supabase
      .storage
      .from('audio-summaries')
      .getPublicUrl(fileName);
    
    console.log(`   ✅ Upload réussi!`);
    console.log(`   🎵 URL audio: ${urlData.publicUrl}`);
    
    // Nettoyer
    await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .remove([fileName]);
    
    console.log('   🧹 Fichier test nettoyé\n');
    
  } catch (error) {
    console.error('   ❌ Erreur test complet:', error.message);
    console.error('      Stack:', error.stack);
    process.exit(1);
  }
  
  console.log('✅ === DIAGNOSTIC TERMINÉ : TOUT FONCTIONNE ! ===\n');
  console.log('💡 Si les résumés audio ne se génèrent toujours pas:');
  console.log('   1. Vérifier les logs Railway pour voir les erreurs exactes');
  console.log('   2. Forcer un nouveau résumé avec: POST /api/audio/generate-test-summary');
  console.log('   3. Vérifier la table audio_summaries pour le champ error_message\n');
  
  process.exit(0);
}

runDiagnostic().catch(error => {
  console.error('\n❌ Erreur diagnostic:', error);
  process.exit(1);
});
