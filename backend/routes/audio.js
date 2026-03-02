/**
 * 🔊 ROUTES AUDIO (TTS) - Migration depuis Netlify
 * Génération de résumés audio via Replicate Kokoro
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { generateJournalisticSummary } = require('../services/gpt5-nano-analyzer');
const { generateAudio } = require('../services/replicate-kokoro-tts');
const { checkUserCredits, deductCredits, refundServiceCredits } = require('../middleware/ai-validation');
const { requireAuth } = require('../middleware/auth');
const pricingService = require('../services/pricing-service');

// POST /api/audio/generate-summary - Générer résumé audio (daily ou custom)
router.post('/generate-summary', requireAuth, async (req, res) => {
  try {
    const {
      action,
      userId,
      articleIds = [],
      optimize = true,
      sendWhatsApp = true,
      language = 'fr',
      languages = ['fr', 'en', 'zh'],
      pace = 'normal'
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId requis' });
    }

    if (!action || !['daily', 'custom'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action doit être "daily" ou "custom"' });
    }

    // Vérifier les crédits de l'utilisateur avec le nouveau système
    const serviceName = 'audio_summary';
    const creditCheck = await checkUserCredits(userId, serviceName);

    if (!creditCheck.allowed) {
      return res.status(402).json({
        success: false,
        error: creditCheck.message || 'Crédits insuffisants',
        code: 'INSUFFICIENT_CREDITS',
        balance: creditCheck.details?.available || 0,
        required: creditCheck.requiredCredits || await pricingService.getServiceCost(serviceName),
        missing: creditCheck.details?.missing || 0
      });
    }

    console.log(`✅ Crédits OK: ${creditCheck.credits} crédits disponibles, ${creditCheck.requiredCredits} requis`);
    
    let articles = [];
    let summaryType = action;

    // Récupérer les articles selon le type
    if (action === 'daily') {
      // Pour daily: prendre TOUS les articles des dernières 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { data } = await supabaseService.supabase
        .from('articles')
        .select('id,title,summary,summary_ai,content,source,url,category,published_at')
        .gte('published_at', twentyFourHoursAgo)
        .order('published_at', { ascending: false });
      
      articles = data || [];
      console.log(`📰 ${articles.length} articles trouvés dans les dernières 24h`);
      
      if (articles.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Aucun article trouvé dans les dernières 24 heures' 
        });
      }
    } else if (action === 'custom') {
      // Pour custom: utiliser les articles sélectionnés (max 10)
      if (!Array.isArray(articleIds) || articleIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Aucun article sélectionné' });
      }
      if (articleIds.length > 10) {
        return res.status(400).json({ success: false, error: 'Maximum 10 articles autorisés' });
      }
      const { data } = await supabaseService.supabase
        .from('articles')
        .select('id,title,summary,summary_ai,content,source,url')
        .in('id', articleIds)
        .limit(10);
      articles = data || [];
    }

    if (!articles || articles.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun article trouvé' });
    }

    // Créer l'entrée audio_summaries avec status 'processing'
    const { data: savedSummary, error: insertError } = await supabaseService.supabase
      .from('audio_summaries')
      .insert({
        user_id: userId,
        summary_type: summaryType,
        article_ids: articles.map(a => a.id),
        articles_count: articles.length,
        language: language, // Sauvegarder la langue sélectionnée
        status: 'processing',
        whatsapp_sent: false
      })
      .select('id')
      .single();

    if (insertError || !savedSummary) {
      console.error('❌ Erreur création audio_summary:', insertError);
      return res.status(500).json({ success: false, error: 'Erreur création résumé' });
    }

    const summaryId = savedSummary.id;

    // Consommer les crédits AVANT de lancer le traitement avec le nouveau système
    const deductResult = await deductCredits(
      userId,
      serviceName,
      summaryId,
      { action, articles_count: articles.length, language }
    );

    if (!deductResult.success) {
      // Supprimer le résumé créé si la consommation échoue
      await supabaseService.supabase
        .from('audio_summaries')
        .delete()
        .eq('id', summaryId);

      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la consommation des crédits',
        details: deductResult.error
      });
    }

    console.log(`💰 ${deductResult.deducted} crédits consommés. Nouveau solde: ${deductResult.newBalance}`);

    // Répondre immédiatement au client
    res.json({
      success: true,
      summaryId: summaryId,
      creditsConsumed: deductResult.deducted,
      newBalance: deductResult.newBalance
    });

    // Traitement asynchrone en arrière-plan
    processAudioSummary(summaryId, articles, language, pace, sendWhatsApp, action, userId, deductResult.transaction_id).catch(err => {
      console.error('❌ Erreur traitement audio:', err);
    });

  } catch (error) {
    console.error('❌ Erreur generate audio:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fonction de traitement asynchrone de l'audio
async function processAudioSummary(summaryId, articles, language, pace, sendWhatsApp, action, userId, transactionId) {
  try {
    console.log(`🎬 Début traitement audio ${summaryId}: ${action} mode, ${articles.length} articles`);
    
    // Mettre à jour status: processing
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ status: 'processing' })
      .eq('id', summaryId);

    // Générer le script texte selon le mode
    let fullScript = '';
    
    // Générer résumé journalistique avec GPT-5 Nano (daily ou custom)
    console.log(`📊 Génération résumé journalistique avec GPT-5 Nano (${language})...`);
    fullScript = await generateJournalisticSummary(articles, language);
    console.log(`✅ Résumé journalistique généré: ${fullScript.length} caractères`);

    // Sauvegarder le script texte
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ text_summary: fullScript })
      .eq('id', summaryId);

    // Générer l'audio avec OpenAI TTS
    console.log('🔊 Génération audio avec OpenAI TTS...');
    
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ status: 'synthesizing_audio' })
      .eq('id', summaryId);

    let audioUrl = null;
    let audioDuration = null;

    try {
      const audioBuffer = await generateAudio(fullScript, language, pace);
      
      // Upload vers Supabase Storage
      await supabaseService.supabase
        .from('audio_summaries')
        .update({ status: 'uploading_audio' })
        .eq('id', summaryId);

      const fileName = `audio-${summaryId}-${Date.now()}.mp3`;

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
      
      audioUrl = urlData.publicUrl;

      // Estimer durée (approximatif: 150 mots/minute)
      const wordCount = fullScript.split(/\s+/).length;
      audioDuration = Math.ceil((wordCount / 150) * 60);
      
      console.log(`✅ Audio uploadé: ${audioUrl}`);

    } catch (audioError) {
      console.error('❌ Erreur génération/upload audio:', audioError.message);
      console.error('   Stack:', audioError.stack);
      
      // Sauvegarder l'erreur dans la BDD pour diagnostic
      await supabaseService.supabase
        .from('audio_summaries')
        .update({ 
          error_message: `Audio generation failed: ${audioError.message}`,
          status: 'completed_without_audio'
        })
        .eq('id', summaryId);
      
      // Continuer sans audio (script texte disponible)
    }

    // Mettre à jour avec l'URL audio
    await supabaseService.supabase
      .from('audio_summaries')
      .update({
        audio_url: audioUrl,
        audio_duration_seconds: audioDuration,
        status: 'completed'
      })
      .eq('id', summaryId);

    console.log(`✅ Audio summary ${summaryId} terminé`);

  } catch (error) {
    console.error(`❌ Erreur traitement audio ${summaryId}:`, error);
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ 
        status: 'failed',
        error_message: error.message 
      })
      .eq('id', summaryId);
    
    // Rembourser les crédits en cas d'échec total avec le nouveau système
    if (userId) {
      console.log(`💸 Remboursement des crédits pour l'utilisateur ${userId}`);
      const refundResult = await refundServiceCredits(
        userId,
        'audio_summary',
        `Échec génération résumé audio ${summaryId}`
      );

      if (refundResult.success) {
        console.log(`✅ Crédits remboursés: ${refundResult.refunded}. Nouveau solde: ${refundResult.newBalance}`);
      } else {
        console.error(`❌ Erreur remboursement crédits:`, refundResult.error);
      }
    }
  }
}

// GET /api/audio/settings/:userId - Récupérer paramètres audio
router.get('/settings/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: settings } = await supabaseService.supabase
      .from('audio_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    res.json({
      success: true,
      settings: settings || {
        voice: 'alloy',
        speed: 1.0,
        auto_play: false
      }
    });

  } catch (error) {
    res.json({
      success: true,
      settings: {
        voice: 'alloy',
        speed: 1.0,
        auto_play: false
      }
    });
  }
});

// PUT /api/audio/settings - Mettre à jour paramètres audio
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const {
      userId,
      voice = 'alloy',
      speed = 1.0,
      auto_play = false
    } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    const { data: saved } = await supabaseService.supabase
      .from('audio_settings')
      .upsert({
        user_id: userId,
        voice,
        speed,
        auto_play
      })
      .select()
      .single();

    res.json({
      success: true,
      settings: saved
    });

  } catch (error) {
    console.error('❌ Erreur update audio settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audio/history/:userId - Récupérer historique des résumés audio
router.get('/history/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId manquant' });
    }

    const { data: summaries, error } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Erreur récupération historique audio:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      summaries: summaries || []
    });

  } catch (error) {
    console.error('❌ Erreur get audio history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audio/public - Récupérer résumés publics automatiques
router.get('/public', async (req, res) => {
  try {
    const { limit = 10, timeSlot, language } = req.query;

    let query = supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .is('user_id', null) // Résumés publics uniquement
      .eq('summary_type', 'daily')
      .eq('status', 'completed'); // Seulement les résumés terminés

    if (timeSlot) {
      query = query.eq('time_slot', timeSlot);
    }

    if (language) {
      query = query.eq('language', language);
    }

    const { data: summaries, error } = await query
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('❌ Erreur récupération résumés publics:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      summaries: summaries || []
    });

  } catch (error) {
    console.error('❌ Erreur get public summaries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audio/latest-public - Récupérer le dernier résumé public (par langue)
router.get('/latest-public', async (req, res) => {
  try {
    const { language = 'fr' } = req.query;

    const { data: summary, error } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .is('user_id', null)
      .eq('summary_type', 'daily')
      .eq('status', 'completed')
      .eq('language', language)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('❌ Erreur récupération dernier résumé:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      summary: summary || null
    });

  } catch (error) {
    console.error('❌ Erreur get latest public:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/audio/latest-multilingual - Récupérer les derniers résumés dans toutes les langues
router.get('/latest-multilingual', async (req, res) => {
  try {
    const languages = ['fr', 'en', 'zh'];
    const summaries = {};

    for (const lang of languages) {
      const { data: summary, error } = await supabaseService.supabase
        .from('audio_summaries')
        .select('*')
        .is('user_id', null)
        .eq('summary_type', 'daily')
        .eq('status', 'completed')
        .eq('language', lang)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!error) {
        summaries[lang] = summary;
      }
    }

    res.json({
      success: true,
      summaries: summaries,
      count: Object.keys(summaries).length
    });

  } catch (error) {
    console.error('❌ Erreur get latest multilingual:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/audio/generate-manual - Générer manuellement un résumé (admin)
router.post('/generate-manual', requireAuth, async (req, res) => {
  try {
    const { timeSlot = 'manual' } = req.body;
    
    // Importer le scheduler
    const { generateManualSummary } = require('../services/audio-scheduler');
    
    const summaryId = await generateManualSummary(timeSlot);
    
    if (!summaryId) {
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur génération manuelle' 
      });
    }

    res.json({
      success: true,
      summaryId: summaryId,
      message: 'Génération en cours...'
    });

  } catch (error) {
    console.error('❌ Erreur generate manual:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/audio/generate-test-summary - Générer un résumé de test MANUEL
router.post('/generate-test-summary', requireAuth, async (req, res) => {
  try {
    const { language = 'fr' } = req.body;
    
    console.log(`\n🧪 Génération résumé de test [${language}]...`);
    
    // Vérifier la clé Supabase utilisée
    const hasServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.length > 50;
    console.log(`🔐 Clé Supabase: ${hasServiceKey ? 'SERVICE_ROLE (✅ bypass RLS)' : 'ANON (⚠️  RLS actif)'}`);
    
    // Récupérer les articles des derniers 7 jours (élargi car peu d'articles récents)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    console.log(`📅 Recherche depuis: ${new Date(sevenDaysAgo).toLocaleString('fr-FR')} (7 jours)`);
    
    const { data: articles, error: fetchError } = await supabaseService.supabase
      .from('articles')
      .select('id,title,summary,summary_ai,content,source,url,category,created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false})
      .limit(20);
    
    console.log(`📊 Résultat requête: ${articles?.length || 0} articles`);
    if (fetchError) {
      console.error('❌ Erreur Supabase:', fetchError);
    }
    
    if (fetchError || !articles || articles.length === 0) {
      // Si pas d'articles, essayer avec 7 jours pour diagnostic
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: oldArticles } = await supabaseService.supabase
        .from('articles')
        .select('id,title,created_at')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false})
        .limit(5);
      
      console.log(`📊 Articles des 7 derniers jours: ${oldArticles?.length || 0}`);
      
      return res.status(400).json({ 
        success: false, 
        error: 'Aucun article trouvé dans les dernières 24h',
        debug: {
          hasServiceKey,
          articles24h: articles?.length || 0,
          articles7days: oldArticles?.length || 0,
          fetchError: fetchError?.message || null
        }
      });
    }

    console.log(`📰 ${articles.length} articles trouvés`);

    // Créer l'entrée dans la BDD (user_id NULL = public)
    const { data: savedSummary, error: insertError } = await supabaseService.supabase
      .from('audio_summaries')
      .insert({
        user_id: null, // NULL = résumé public
        summary_type: 'daily',
        article_ids: articles.map(a => a.id),
        articles_count: articles.length,
        status: 'processing',
        whatsapp_sent: false,
        time_slot: 'test',
        language: language
      })
      .select('id')
      .single();

    if (insertError || !savedSummary) {
      console.error('❌ Erreur création résumé:', insertError);
      return res.status(500).json({ success: false, error: 'Erreur création résumé' });
    }

    const summaryId = savedSummary.id;
    console.log(`✅ Résumé test créé: ${summaryId}`);

    // Réponse immédiate
    res.json({
      success: true,
      message: `Résumé de test en cours de génération (${language})`,
      summaryId: summaryId,
      articlesCount: articles.length
    });

    // Traitement asynchrone
    processTestSummary(summaryId, articles, language).catch(err => {
      console.error('❌ Erreur traitement test:', err);
    });

  } catch (error) {
    console.error('❌ Erreur generate-test-summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Traitement asynchrone du résumé de test
async function processTestSummary(summaryId, articles, language) {
  try {
    console.log(`\n🎬 Traitement résumé test ${summaryId}...`);
    
    // Générer le résumé IA avec GPT-5 Nano
    const fullScript = await generateJournalisticSummary(articles, language);
    
    console.log(`📝 Résumé généré: ${fullScript.length} caractères`);
    console.log(`\n--- RÉSUMÉ GÉNÉRÉ ---\n${fullScript}\n--- FIN RÉSUMÉ ---\n`);

    // Sauvegarder le résumé texte
    const { error: updateTextError } = await supabaseService.supabase
      .from('audio_summaries')
      .update({ 
        text_summary: fullScript,
        status: 'synthesizing_audio'
      })
      .eq('id', summaryId);
    
    if (updateTextError) {
      console.error('❌ Erreur sauvegarde texte:', updateTextError);
      throw new Error(`Erreur UPDATE text_summary: ${updateTextError.message}`);
    }
    
    console.log(`✅ Texte sauvegardé: ${fullScript.length} caractères`);

    // Générer l'audio avec OpenAI TTS
    let audioUrl = null;
    let audioDuration = null;
    
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log(`🔊 Génération audio OpenAI TTS [${language}]...`);
        const audioBuffer = await generateAudio(fullScript, language, 'normal');
        
        // Upload vers Supabase Storage
        const fileName = `test-${Date.now()}.mp3`;
        
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
          
          // Estimer la durée (150 mots/minute)
          const wordCount = fullScript.split(/\s+/).length;
          audioDuration = Math.ceil((wordCount / 150) * 60);
          
          console.log(`✅ Audio uploadé: ${audioUrl}`);
        } else {
          console.error(`❌ Erreur upload audio:`, uploadError);
        }
      } catch (audioError) {
        console.error('❌ Erreur génération audio:', audioError.message);
        console.error('   Stack:', audioError.stack);
        
        // Sauvegarder l'erreur
        await supabaseService.supabase
          .from('audio_summaries')
          .update({ 
            error_message: `Audio generation failed: ${audioError.message}`,
            status: 'completed_without_audio'
          })
          .eq('id', summaryId);
      }
    } else {
      console.log('⚠️  OPENAI_API_KEY manquant, pas d\'audio généré');
      
      // Marquer comme complété sans audio
      await supabaseService.supabase
        .from('audio_summaries')
        .update({ 
          error_message: 'OPENAI_API_KEY not configured',
          status: 'completed_without_audio'
        })
        .eq('id', summaryId);
    }

    // Finaliser avec audio (ou sans si échec)
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ 
        audio_url: audioUrl,
        audio_duration_seconds: audioDuration,
        status: 'completed'
      })
      .eq('id', summaryId);

    console.log(`✅ Résumé test complété: ${summaryId}`);

  } catch (error) {
    console.error(`❌ Erreur processTestSummary:`, error);
    await supabaseService.supabase
      .from('audio_summaries')
      .update({ status: 'failed' })
      .eq('id', summaryId);
  }
}

// POST /api/audio/generate-audio-for-summary - Générer audio pour résumé existant
router.post('/generate-audio-for-summary', requireAuth, async (req, res) => {
  try {
    const { summaryId } = req.body;
    
    if (!summaryId) {
      return res.status(400).json({ success: false, error: 'summaryId requis' });
    }

    console.log(`\n🔊 Génération audio pour résumé ${summaryId}...`);

    // Récupérer le résumé
    const { data: summary, error } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();

    if (error || !summary) {
      return res.status(404).json({ success: false, error: 'Résumé non trouvé' });
    }

    if (!summary.text_summary) {
      return res.status(400).json({ success: false, error: 'Résumé sans texte' });
    }

    console.log(`✅ Résumé trouvé: ${summary.text_summary.length} caractères`);

    // Réponse immédiate
    res.json({
      success: true,
      message: 'Génération audio en cours...',
      summaryId: summaryId
    });

    // Générer audio asynchrone
    generateAudioForExistingSummary(summaryId, summary).catch(err => {
      console.error('❌ Erreur génération audio:', err);
    });

  } catch (error) {
    console.error('❌ Erreur generate-audio-for-summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fonction asynchrone pour générer l'audio d'un résumé existant
async function generateAudioForExistingSummary(summaryId, summary) {
  try {
    const language = summary.language || 'fr';
    const text = summary.text_summary;

    console.log(`🔊 Génération audio OpenAI TTS [${language}]...`);

    // Générer l'audio (retourne Buffer)
    const audioBuffer = await generateAudio(text, language, 'normal');

    // Upload vers Supabase Storage
    const fileName = `audio-${summaryId.substring(0, 8)}-${Date.now()}.mp3`;
    
    const { error: uploadError } = await supabaseService.supabase
      .storage
      .from('audio-summaries')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Erreur upload: ${uploadError.message}`);
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabaseService.supabase
      .storage
      .from('audio-summaries')
      .getPublicUrl(fileName);
    
    const audioUrl = urlData.publicUrl;
    
    // Estimer la durée
    const wordCount = text.split(/\s+/).length;
    const audioDuration = Math.ceil((wordCount / 150) * 60);

    console.log(`✅ Audio uploadé: ${audioUrl}`);

    // Mettre à jour le résumé
    await supabaseService.supabase
      .from('audio_summaries')
      .update({
        audio_url: audioUrl,
        audio_duration_seconds: audioDuration,
        voice_used: 'onyx' // Voix OpenAI masculine journaliste
      })
      .eq('id', summaryId);

    console.log(`✅ Résumé ${summaryId} mis à jour avec audio`);

  } catch (error) {
    console.error(`❌ Erreur generateAudioForExistingSummary:`, error);
  }
}

// POST /api/audio/cancel - Annuler une génération en cours et rembourser les crédits
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const { summaryId, userId } = req.body;

    if (!summaryId || !userId) {
      return res.status(400).json({ success: false, error: 'summaryId et userId requis' });
    }

    console.log(`🛑 Demande d'annulation: ${summaryId} par utilisateur ${userId}`);

    // Récupérer le résumé
    const { data: summary, error: fetchError } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .eq('id', summaryId)
      .eq('user_id', userId) // Vérifier que l'utilisateur est bien le propriétaire
      .single();

    if (fetchError || !summary) {
      return res.status(404).json({ success: false, error: 'Résumé non trouvé ou accès refusé' });
    }

    // Vérifier si l'annulation est possible (pas déjà terminé ou échoué)
    if (summary.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Le résumé est déjà terminé, annulation impossible' });
    }

    if (summary.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Le résumé a déjà été annulé' });
    }

    // Marquer comme annulé
    const { error: updateError } = await supabaseService.supabase
      .from('audio_summaries')
      .update({
        status: 'cancelled',
        error_message: 'Annulé par l\'utilisateur'
      })
      .eq('id', summaryId);

    if (updateError) {
      console.error('❌ Erreur mise à jour statut:', updateError);
      return res.status(500).json({ success: false, error: 'Erreur lors de l\'annulation' });
    }

    // Rembourser les crédits avec le nouveau système
    let refundResult = { success: false, newBalance: null };
    try {
      refundResult = await refundServiceCredits(
        userId,
        'audio_summary',
        `Annulation résumé audio ${summaryId}`
      );

      if (refundResult.success) {
        console.log(`💸 Crédits remboursés: ${refundResult.refunded}. Nouveau solde: ${refundResult.newBalance}`);
      } else {
        console.error('❌ Erreur remboursement:', refundResult.error);
      }
    } catch (refundError) {
      console.error('❌ Exception remboursement:', refundError);
    }

    // Supprimer les fichiers audio si déjà uploadés
    if (summary.audio_url) {
      try {
        const fileName = summary.audio_url.split('/').pop();
        if (fileName) {
          await supabaseService.supabase
            .storage
            .from('audio-summaries')
            .remove([fileName]);
          console.log(`🗑️ Fichier audio supprimé: ${fileName}`);
        }
      } catch (deleteError) {
        console.error('⚠️ Erreur suppression fichier audio:', deleteError);
      }
    }

    res.json({
      success: true,
      message: 'Génération annulée',
      creditsRefunded: refundResult.success,
      newBalance: refundResult.total_balance
    });

  } catch (error) {
    console.error('❌ Erreur cancel:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/audio/generate-scheduled-summary - Générer résumé programmé (13h, 20h)
router.post('/generate-scheduled-summary', requireAuth, async (req, res) => {
  try {
    const { timeSlot, language = 'fr' } = req.body;

    if (!timeSlot || !['morning', 'afternoon', 'evening'].includes(timeSlot)) {
      return res.status(400).json({
        success: false,
        error: 'timeSlot requis (morning, afternoon, evening)'
      });
    }

    console.log(`🎙️ Génération programmée: ${timeSlot} [${language}]`);

    // Utiliser le scheduler
    const { generatePublicAudioSummary } = require('../services/audio-scheduler');
    const summaryId = await generatePublicAudioSummary(timeSlot, language);

    if (summaryId) {
      res.json({
        success: true,
        message: `Génération ${timeSlot} lancée`,
        summaryId,
        language,
        timeSlot
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Échec génération résumé'
      });
    }

  } catch (error) {
    console.error('❌ Erreur generate-scheduled-summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/audio/cron-trigger - Déclenchement par cron/admin (sans auth utilisateur)
// Protégé par CRON_SECRET ou SUPABASE_SERVICE_ROLE_KEY
router.post('/cron-trigger', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const validSecrets = [
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.KIMI_API_KEY
    ].filter(Boolean);

    const token = authHeader?.replace('Bearer ', '');
    if (!token || !validSecrets.includes(token)) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const { timeSlot = 'morning', language = 'fr', debug = false } = req.body;
    console.log(`🎙️ Cron trigger: ${timeSlot} [${language}]`);

    // Diagnostic: replicate exact scheduler query
    if (debug) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Simple query (works)
      const { data: simple, error: simpleErr } = await supabaseService.supabase
        .from('articles')
        .select('id, title, published_at')
        .gte('published_at', since)
        .limit(3);

      // Exact scheduler query
      const { data: full, error: fullErr } = await supabaseService.supabase
        .from('articles')
        .select(`id, title, summary, summary_ai, content, source, category,
          created_at, published_at, view_count,
          sentiment, keywords, entities,
          enrichment_score, relevance_score, quality_score, importance`)
        .gte('published_at', since)
        .order('published_at', { ascending: false })
        .limit(5);

      return res.json({
        debug: true,
        since,
        simpleQuery: { count: simple?.length || 0, error: simpleErr?.message || null },
        fullQuery: { count: full?.length || 0, error: fullErr?.message || null, errorCode: fullErr?.code || null },
        sample: full?.slice(0, 1)?.map(a => ({ title: a.title?.substring(0, 50) }))
      });
    }

    const { generatePublicAudioSummary } = require('../services/audio-scheduler');
    const summaryId = await generatePublicAudioSummary(timeSlot, language);

    res.json({
      success: !!summaryId,
      summaryId,
      message: summaryId ? 'Génération lancée' : 'Aucun article disponible'
    });

  } catch (error) {
    console.error('❌ Erreur cron-trigger:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
