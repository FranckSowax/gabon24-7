/**
 * Planificateur automatique de résumés audio
 * Génère des résumés à 7h, 13h et 20h automatiquement
 */

const cron = require('node-cron');
const supabaseService = require('../supabase-config');
const { generateJournalisticSummary } = require('./gpt5-nano-analyzer');
const { generateAudio } = require('./replicate-kokoro-tts');
const { prioritizeArticles } = require('./article-prioritizer');

const SCHEDULED_TIMES = {
  MORNING: '7:00',    // 7h WAT (Libreville - Afrique Centrale)
  AFTERNOON: '13:00', // 13h WAT (Libreville - Afrique Centrale)
  EVENING: '20:00'    // 20h WAT (Libreville - Afrique Centrale)
};

/**
 * Générer un résumé audio public automatique
 * @param {string} timeSlot - 'morning', 'afternoon', 'evening'
 * @param {string} language - Langue du résumé
 */
async function generatePublicAudioSummary(timeSlot, language = 'fr') {
  try {
    const languageLabel = { fr: 'Français', en: 'English', zh: '中文' }[language] || language;
    console.log(`\n🤖 [${new Date().toLocaleString('fr-FR')}] Génération ${timeSlot} [${languageLabel}]`);
    
    // Récupérer les 30 derniers articles avec scores d'enrichissement + importance
    const { data: articles, error: articlesError } = await supabaseService.supabase
      .from('articles')
      .select(`
        id, title, summary, summary_ai, content, source, category,
        created_at, published_at, view_count,
        sentiment, keywords, entities,
        enrichment_score, relevance_score, quality_score,
        importance
      `)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (articlesError || !articles || articles.length === 0) {
      console.log(`⚠️  Aucun article trouvé pour ${timeSlot} [${languageLabel}]`);
      return null;
    }

    console.log(`📰 ${articles.length} articles récupérés [${languageLabel}]`);

    // Prioriser les articles (sujets récurrents + scores d'enrichissement)
    const prioritizedArticles = prioritizeArticles(articles);
    console.log(`✅ ${prioritizedArticles.length} articles priorisés pour le résumé [${languageLabel}]`);

    // Créer l'entrée audio_summaries (user_id NULL = public)
    const { data: savedSummary, error: insertError } = await supabaseService.supabase
      .from('audio_summaries')
      .insert({
        user_id: null, // NULL = résumé public automatique
        summary_type: 'daily',
        article_ids: articles.map(a => a.id),
        articles_count: articles.length,
        status: 'processing',
        whatsapp_sent: false,
        time_slot: timeSlot,
        language: language // Langue du résumé
      })
      .select('id')
      .single();

    if (insertError || !savedSummary) {
      console.error(`❌ Erreur création audio_summary [${languageLabel}]:`, insertError);
      return null;
    }

    const summaryId = savedSummary.id;
    console.log(`✅ Résumé créé [${languageLabel}]: ${summaryId}`);

    // Traiter le résumé de manière asynchrone avec articles priorisés
    processPublicAudioSummary(savedSummary.id, prioritizedArticles, language, timeSlot);
    
    return savedSummary.id;

  } catch (error) {
    console.error(`❌ Erreur génération ${timeSlot} [${language}]:`, error);
    return null;
  }
}

/**
 * Traitement asynchrone du résumé public
 */
async function processPublicAudioSummary(summaryId, articles, language, timeSlot) {
  try {
    console.log(`🎬 Traitement ${summaryId}...`);
    
    // Générer le résumé IA
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ status: 'processing' })
      .eq('id', summaryId);

    console.log('📊 Analyse IA des articles avec GPT-5 Nano...');
    const fullScript = await generateJournalisticSummary(articles, language);
    console.log(`📝 Résumé journalistique généré: ${fullScript.length} caractères`);

    // Sauvegarder le script
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ text_summary: fullScript })
      .eq('id', summaryId);

    // Générer l'audio avec OpenAI
    console.log('🔊 Génération audio OpenAI...');
    
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ status: 'synthesizing_audio' })
      .eq('id', summaryId);

    let audioUrl = null;
    let audioDuration = null;

    if (process.env.OPENAI_API_KEY) {
      try {
        const audioBuffer = await generateAudio(fullScript, language, 'normal');
        
        await supabaseService.supabase
          .from('audio_summaries')
          .update({ status: 'uploading_audio' })
          .eq('id', summaryId);

        const fileName = `auto-${timeSlot}-${Date.now()}.mp3`;

        const { error: uploadError } = await supabaseService.supabase
          .storage
          .from('audio-summaries')
          .upload(fileName, audioBuffer, {
            contentType: 'audio/mpeg',
            upsert: false
          });

        if (!uploadError) {
          const { data: urlData } = supabaseService.supabase
            .storage
            .from('audio-summaries')
            .getPublicUrl(fileName);
          
          audioUrl = urlData.publicUrl;

          const wordCount = fullScript.split(/\s+/).length;
          audioDuration = Math.ceil((wordCount / 150) * 60);
          
          console.log(`✅ Audio uploadé: ${audioUrl}`);
        }
      } catch (audioError) {
        console.error('❌ Erreur génération audio:', audioError.message);
        console.error('   Stack:', audioError.stack);
        console.error('   Token présent:', !!process.env.OPENAI_API_KEY);
      }
    } else {
      console.log('⚠️  Pas de OPENAI_API_KEY, saut de la génération audio');
    }

    // Finaliser
    await supabaseService.supabase
      .from('audio_summaries')
      .update({
        audio_url: audioUrl,
        audio_duration_seconds: audioDuration,
        status: 'completed'
      })
      .eq('id', summaryId);

    console.log(`✅ Résumé ${timeSlot} terminé: ${summaryId}`);

    // 📊 GÉNÉRATION AUTOMATIQUE DES SONDAGES
    // Si c'est un résumé en français et que c'est le premier résumé du jour
    if (language === 'fr' && timeSlot === 'morning') {
      console.log('\n📊 Génération automatique des sondages depuis le résumé...');
      try {
        const { generatePollQuestionsFromSummary, savePollQuestions, deactivateOldAutoPpolls } = require('./poll-generator-from-audio');
        
        // Désactiver les vieux sondages
        await deactivateOldAutoPpolls();
        
        // Générer les questions
        const questions = await generatePollQuestionsFromSummary(fullScript, articles);
        
        if (questions && questions.length > 0) {
          // Sauvegarder les sondages
          const pollResult = await savePollQuestions(questions, summaryId);
          console.log(`✅ ${pollResult.created} sondages créés automatiquement`);
        } else {
          console.log('⚠️  Aucune question de sondage générée');
        }
      } catch (pollError) {
        console.error('❌ Erreur génération sondages automatiques:', pollError.message);
      }
    }

  } catch (error) {
    console.error(`❌ Erreur traitement ${summaryId}:`, error);
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ status: 'failed' })
      .eq('id', summaryId);
  }
}

/**
 * Générer résumés dans toutes les langues pour un créneau
 * @param {string} timeSlot - 'morning', 'afternoon', 'evening'
 */
async function generateMultilingualSummaries(timeSlot) {
  const languages = ['fr', 'en', 'zh'];
  const summaryIds = [];
  
  for (const lang of languages) {
    const summaryId = await generatePublicAudioSummary(timeSlot, lang);
    if (summaryId) {
      summaryIds.push({ language: lang, id: summaryId });
    }
    // Petite pause entre les générations pour éviter de surcharger
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n✅ ${summaryIds.length} résumé(s) créé(s) pour ${timeSlot}`);
  return summaryIds;
}

/**
 * Démarrer le planificateur
 * Horaires: 7h, 13h, 20h - Heure de Libreville (Africa/Libreville - WAT/UTC+1)
 */
function startScheduler() {
  console.log('\n⏰ Démarrage du planificateur de résumés audio automatiques');
  console.log('   🕖 7h00 WAT (Libreville): Résumés du matin (FR, EN, ZH)');
  console.log('   🕐 13h00 WAT (Libreville): Résumés de l\'après-midi (FR, EN, ZH)');
  console.log('   🕗 20h00 WAT (Libreville): Résumés du soir (FR, EN, ZH)\n');

  // Génération à 7h00 WAT (Libreville) - 3 langues
  cron.schedule('0 7 * * *', () => {
    console.log('\n🌅 Déclenchement résumés du matin (7h WAT Libreville) - Multilingue');
    generateMultilingualSummaries('morning');
  }, {
    timezone: "Africa/Libreville" // WAT (West Africa Time) - UTC+1
  });

  // Génération à 13h00 WAT (Libreville) - 3 langues
  cron.schedule('0 13 * * *', () => {
    console.log('\n☀️  Déclenchement résumés de l\'après-midi (13h WAT Libreville) - Multilingue');
    generateMultilingualSummaries('afternoon');
  }, {
    timezone: "Africa/Libreville" // WAT (West Africa Time) - UTC+1
  });

  // Génération à 20h00 WAT (Libreville) - 3 langues
  cron.schedule('0 20 * * *', () => {
    console.log('\n🌙 Déclenchement résumés du soir (20h WAT Libreville) - Multilingue');
    generateMultilingualSummaries('evening');
  }, {
    timezone: "Africa/Libreville" // WAT (West Africa Time) - UTC+1
  });

  console.log('✅ Planificateur actif - Mode multilingue (FR/EN/ZH)');
}

/**
 * Générer manuellement un résumé (pour tests)
 */
async function generateManualSummary(timeSlot = 'test') {
  console.log(`\n🧪 Génération manuelle: ${timeSlot}`);
  const summaryId = await generatePublicAudioSummary(timeSlot, 'fr');
  return summaryId;
}

/**
 * Récupérer les résumés publics récents
 */
async function getPublicSummaries(limit = 10) {
  try {
    const { data, error } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .is('user_id', null) // Résumés publics uniquement
      .eq('summary_type', 'daily')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ Erreur récupération résumés publics:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('❌ Erreur getPublicSummaries:', error);
    return [];
  }
}

module.exports = {
  startScheduler,
  generateManualSummary,
  generatePublicAudioSummary,
  getPublicSummaries,
  generateMultilingualSummaries,
  SCHEDULED_TIMES
};
