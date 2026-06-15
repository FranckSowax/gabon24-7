/**
 * Générer l'audio pour un résumé existant avec OpenAI TTS
 * Usage: node generate-audio-for-summary.js <summaryId>
 */

require('dotenv').config();
const { generateAudio } = require('./services/replicate-kokoro-tts'); // Note: Utilise OpenAI maintenant malgré le nom
const supabaseService = require('./supabase-config');

async function generateAudioForSummary(summaryId) {
  try {
    console.log(`\n🎬 Génération audio pour résumé ${summaryId}...\n`);

    // Récupérer le résumé
    const { data: summary, error } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();

    if (error || !summary) {
      throw new Error(`Résumé non trouvé: ${error?.message || 'inconnu'}`);
    }

    console.log(`📝 Résumé trouvé:`);
    console.log(`   Langue: ${summary.language}`);
    console.log(`   Articles: ${summary.articles_count}`);
    console.log(`   Texte: ${summary.text_summary?.length || 0} caractères`);
    console.log(`   Status: ${summary.status}\n`);

    if (!summary.text_summary) {
      throw new Error('Le résumé ne contient pas de texte');
    }

    // Générer l'audio avec OpenAI
    console.log('🔊 Génération audio avec OpenAI TTS...');
    const audioBuffer = await generateAudio(
      summary.text_summary,
      summary.language || 'fr',
      'normal'
    );

    console.log(`✅ Audio généré: ${audioBuffer.length} bytes`);

    // Uploader sur Supabase Storage
    console.log('☁️  Upload vers Supabase Storage...');
    const fileName = `manual-${summary.language || 'fr'}-${Date.now()}.mp3`;

    const { error: uploadError } = await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Erreur upload Storage: ${uploadError.message}`);
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabaseService.supabase
      .storage
      .from('audio-summaries')
      .getPublicUrl(fileName);
    
    const audioUrl = urlData.publicUrl;
    
    // Calculer la durée estimée
    const wordCount = summary.text_summary.split(/\s+/).length;
    const duration = Math.ceil((wordCount / 150) * 60);

    console.log(`✅ Audio uploadé: ${audioUrl}`);
    console.log(`⏱️  Durée estimée: ${duration} secondes\n`);

    // Mettre à jour le résumé avec l'URL audio
    const { error: updateError } = await supabaseService.supabase
      .from('audio_summaries')
      .update({
        audio_url: audioUrl,
        audio_duration_seconds: duration,
        voice_used: summary.language === 'fr' ? 'onyx' : 'alloy', // OpenAI voices - onyx = voix masculine journaliste
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', summaryId);

    if (updateError) {
      throw new Error(`Erreur mise à jour DB: ${updateError.message}`);
    }

    console.log('✅ Résumé mis à jour avec succès!\n');
    console.log('🎵 URLs:');
    console.log(`   Audio: ${audioUrl}`);
    console.log(`   API: https://gabon-insight-production.up.railway.app/api/audio/latest-public?language=${summary.language}`);
    console.log(`   Frontend: https://gabon-insight.netlify.app/audio/daily\n`);

    return { success: true, audioUrl, duration };

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

// Exécution
const summaryId = process.argv[2];

if (!summaryId) {
  console.error('❌ Usage: node generate-audio-for-summary.js <summaryId>');
  process.exit(1);
}

generateAudioForSummary(summaryId)
  .then(() => {
    console.log('✅ Terminé!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Échec:', error.message);
    process.exit(1);
  });
