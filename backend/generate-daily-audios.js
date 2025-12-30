#!/usr/bin/env node

/**
 * Générer les résumés audio quotidiens pour les 3 langues
 * À exécuter manuellement ou via cron
 */

require('dotenv').config();
const supabaseService = require('./supabase-config');
const { generateDailySummary } = require('./services/daily-news-analyzer');
const { generateAudio } = require('./services/replicate-kokoro-tts');

const LANGUAGES = ['fr', 'en', 'zh'];

async function generateDailyAudioForLanguage(language) {
  const languageLabels = { fr: 'Français', en: 'English', zh: '中文' };
  const label = languageLabels[language] || language;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎙️  GÉNÉRATION RÉSUMÉ AUDIO - ${label}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // 1. Récupérer les articles des dernières 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    console.log(`📅 Récupération articles depuis: ${new Date(twentyFourHoursAgo).toLocaleString('fr-FR')}`);
    
    const { data: articles, error: fetchError } = await supabaseService.supabase
      .from('articles')
      .select('id,title,summary,summary_ai,content,source,url,category,created_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });
    
    if (fetchError || !articles || articles.length === 0) {
      console.log(`⚠️  Aucun article trouvé pour ${label}`);
      return { success: false, language, reason: 'no_articles' };
    }
    
    console.log(`✅ ${articles.length} articles trouvés`);
    
    // 2. Générer le résumé textuel
    console.log(`\n🤖 Génération du résumé IA...`);
    const fullScript = await generateDailySummary(articles, language);
    console.log(`✅ Résumé généré: ${fullScript.length} caractères`);
    
    // 3. Créer l'entrée dans audio_summaries
    console.log(`\n💾 Création de l'entrée dans la base...`);
    const { data: savedSummary, error: insertError } = await supabaseService.supabase
      .from('audio_summaries')
      .insert({
        user_id: null, // NULL = résumé public
        summary_type: 'daily',
        article_ids: articles.map(a => a.id),
        articles_count: articles.length,
        text_summary: fullScript,
        status: 'processing',
        whatsapp_sent: false,
        time_slot: 'manual',
        language: language,
        voice_used: language === 'fr' ? 'onyx' : (language === 'en' ? 'alloy' : 'nova')
      })
      .select('id')
      .single();
    
    if (insertError || !savedSummary) {
      console.error(`❌ Erreur création résumé:`, insertError);
      return { success: false, language, reason: 'db_error' };
    }
    
    const summaryId = savedSummary.id;
    console.log(`✅ Résumé créé: ${summaryId}`);
    
    // 4. Générer l'audio
    if (process.env.OPENAI_API_KEY) {
      console.log(`\n🔊 Génération de l'audio avec OpenAI TTS...`);
      const startTime = Date.now();
      
      const audioBuffer = await generateAudio(fullScript, language, 'normal');
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const sizeKB = (audioBuffer.length / 1024).toFixed(2);
      
      console.log(`✅ Audio généré: ${sizeKB} KB en ${duration}s`);
      
      // 5. Upload vers Supabase Storage
      console.log(`\n☁️  Upload vers Supabase Storage...`);
      const filename = `daily-${language}-${Date.now()}.mp3`;
      
      const { error: uploadError } = await supabaseService.supabase.storage
        .from('audio-summaries')
        .upload(filename, audioBuffer, {
          contentType: 'audio/mpeg',
          upsert: false
        });
      
      if (uploadError) {
        console.error(`❌ Erreur upload:`, uploadError);
        await supabaseService.supabase
          .from('audio_summaries')
          .update({ status: 'failed', error_message: uploadError.message })
          .eq('id', summaryId);
        return { success: false, language, reason: 'upload_error' };
      }
      
      // 6. Récupérer l'URL publique
      const { data: urlData } = supabaseService.supabase.storage
        .from('audio-summaries')
        .getPublicUrl(filename);
      
      const audioUrl = urlData.publicUrl;
      console.log(`✅ URL publique: ${audioUrl}`);
      
      // 7. Mettre à jour avec l'URL audio
      await supabaseService.supabase
        .from('audio_summaries')
        .update({
          audio_url: audioUrl,
          audio_duration_seconds: Math.ceil(fullScript.length / 15), // Estimation
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', summaryId);
      
      console.log(`\n✅ SUCCÈS COMPLET pour ${label}!`);
      return { success: true, language, summaryId, audioUrl, sizeKB, duration };
      
    } else {
      console.log(`\n⚠️  OPENAI_API_KEY manquant - audio non généré`);
      await supabaseService.supabase
        .from('audio_summaries')
        .update({ status: 'completed' })
        .eq('id', summaryId);
      
      return { success: true, language, summaryId, audioGenerated: false };
    }
    
  } catch (error) {
    console.error(`❌ Erreur pour ${label}:`, error.message);
    return { success: false, language, error: error.message };
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🌍 GÉNÉRATION RÉSUMÉS AUDIO QUOTIDIENS - 3 LANGUES');
  console.log('═'.repeat(60));
  console.log(`⏰ ${new Date().toLocaleString('fr-FR')}\n`);
  
  const results = [];
  
  for (const language of LANGUAGES) {
    const result = await generateDailyAudioForLanguage(language);
    results.push(result);
    
    // Pause entre langues
    if (language !== 'zh') {
      console.log(`\n⏸️  Pause 5 secondes avant langue suivante...\n`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Résumé final
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ FINAL');
  console.log('═'.repeat(60) + '\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Réussis: ${successful.length}/3`);
  console.log(`❌ Échoués: ${failed.length}/3\n`);
  
  if (successful.length > 0) {
    console.log('Résumés créés:');
    successful.forEach(r => {
      const status = r.audioUrl ? `🔊 Audio: ${r.sizeKB}KB (${r.duration}s)` : '📝 Texte seulement';
      console.log(`  • ${r.language.toUpperCase()}: ${r.summaryId} - ${status}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\nÉchecs:');
    failed.forEach(r => {
      console.log(`  • ${r.language.toUpperCase()}: ${r.reason || r.error}`);
    });
  }
  
  console.log('\n' + '═'.repeat(60) + '\n');
  
  if (successful.length === 3) {
    console.log('🎉 TOUS LES RÉSUMÉS ONT ÉTÉ GÉNÉRÉS AVEC SUCCÈS!\n');
  }
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
