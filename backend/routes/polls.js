/**
 * 📊 ROUTES POLLS (SONDAGES)
 * Endpoints pour la gestion des sondages
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { supabase } = supabaseService;
const redisCache = require('../services/redis-cache.service');

// GET /api/polls - Récupérer les sondages actifs
router.get('/', async (req, res) => {
  try {
    // Cache Redis - 10 minutes pour polls
    const cacheKey = 'polls:active';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des sondages...');
    const { data: polls, error } = await supabase
      .from('polls')
      .select('id, question, poll_type, is_active, created_at, expires_at, options')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const response = {
      success: true,
      polls: polls || [],
      count: polls?.length || 0
    };

    // Mettre en cache Redis - 10 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 600);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Erreur récupération sondages:', error);
    res.json({ success: false, polls: [], error: error.message });
  }
});

// POST /api/polls/questions - Récupérer les questions d'un sondage
router.post('/questions', async (req, res) => {
  try {
    const { pollId } = req.body;
    console.log(`📋 Récupération des questions pour le sondage: ${pollId}`);

    const { data: questions, error } = await supabase
      .from('poll_questions')
      .select('id, poll_id, question_text, question_type, options, question_order')
      .eq('poll_id', pollId)
      .order('question_order', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      questions: questions || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération questions:', error);
    res.json({ success: false, questions: [], error: error.message });
  }
});

// GET /api/polls/stats - Statistiques d'une question
router.get('/stats', async (req, res) => {
  try {
    const questionId = req.query.question_id;

    // Cache Redis - 5 minutes pour stats
    const cacheKey = `polls:stats:${questionId}`;
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log(`📊 Récupération des stats pour la question: ${questionId}`);

    const { data: stats, error } = await supabase
      .from('poll_responses')
      .select('response_value')
      .eq('question_id', questionId);

    if (error) throw error;

    const response = {
      success: true,
      stats: stats || []
    };

    // Mettre en cache Redis - 5 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 300);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Erreur récupération stats:', error);
    res.json({ success: false, stats: [], error: error.message });
  }
});

// POST /api/polls/check-votes - Vérifier si un utilisateur a voté
router.post('/check-votes', async (req, res) => {
  try {
    const { userId, pollId } = req.body;

    const { data: votes, error } = await supabase
      .from('poll_votes')
      .select('question_id')
      .eq('user_id', userId)
      .eq('poll_id', pollId);

    if (error) throw error;

    res.json({
      success: true,
      hasVoted: votes && votes.length > 0,
      votes: votes || []
    });
  } catch (error) {
    console.error('❌ Erreur vérification votes:', error);
    res.json({ success: false, hasVoted: false, error: error.message });
  }
});

// POST /api/polls/vote - Enregistrer un vote
router.post('/vote', async (req, res) => {
  try {
    const { userId, questionId, pollId, response } = req.body;

    const { data, error } = await supabase
      .from('poll_votes')
      .insert({
        user_id: userId,
        question_id: questionId,
        poll_id: pollId,
        response: response,
        created_at: new Date().toISOString()
      })
      .select('id');

    if (error) throw error;

    // Invalider le cache des stats pour cette question
    if (redisCache.isAvailable()) {
      await redisCache.del(`polls:stats:${questionId}`);
      console.log('🗑️ Cache stats invalidé après vote');
    }

    res.json({ success: true, vote: data[0] });
  } catch (error) {
    console.error('❌ Erreur enregistrement vote:', error);
    res.json({ success: false, error: error.message });
  }
});

// POST /api/polls/generate-from-audio - Générer sondages depuis résumés audio
router.post('/generate-from-audio', async (req, res) => {
  try {
    console.log('📊 Génération de sondages depuis résumés audio...');
    
    const { generatePollsFromLatestAudioSummary, deactivateOldAutoPpolls } = require('../services/poll-generator-from-audio');
    
    // Désactiver les vieux sondages automatiques
    await deactivateOldAutoPpolls();
    
    // Générer les nouveaux sondages
    const result = await generatePollsFromLatestAudioSummary();
    
    if (result.success) {
      console.log(`✅ ${result.created} sondages générés avec succès`);
      res.json({
        success: true,
        message: `${result.created} sondages générés depuis le résumé audio`,
        ...result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Erreur génération sondages'
      });
    }
  } catch (error) {
    console.error('❌ Erreur génération sondages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/polls/generate-ai - Générer questions de sondage avec IA
router.post('/generate-ai', async (req, res) => {
  try {
    console.log('🤖 Génération IA questions de sondage...');
    
    const { organization, target_audience, context } = req.body;

    if (!organization || !target_audience) {
      return res.status(400).json({
        success: false,
        error: 'Organisation et public cible requis'
      });
    }

    // Prompt pour génération questions
    const prompt = `Tu es un expert en sondages d'opinion au Gabon.

Génère 5-8 questions pertinentes pour un sondage professionnel avec ces informations:

**Organisation:** ${organization}
**Public Cible:** ${target_audience}
${context ? `**Contexte:** ${context}` : ''}

**Consignes:**
- Questions claires et précises adaptées au contexte gabonais
- Mélange de questions fermées (oui/non, choix multiples) et ouvertes
- Éviter les questions biaisées
- Langue professionnelle mais accessible
- Pertinentes pour l'audience cible

Retourne UNIQUEMENT un objet JSON:
{
  "questions": ["Question 1", "Question 2", "Question 3", ...],
  "rationale": "Brève explication de la stratégie"
}`;

    // Appel Replicate GPT-5 Nano
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "26e1bd4fb0be0aa56c969e09ec7d55f3fc55fa2b83e5ce5023c9ad8e64477751",
        input: {
          prompt: prompt,
          max_new_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9,
          top_k: 50
        }
      })
    });

    const prediction = await response.json();
    
    if (response.status !== 201) {
      throw new Error(`Erreur Replicate: ${prediction.detail || 'Erreur inconnue'}`);
    }

    console.log('📊 Prediction créée:', prediction.id);

    // Attendre résultat (max 60s)
    let result = prediction;
    let attempts = 0;
    
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
      });
      
      result = await pollResponse.json();
      attempts++;
    }

    if (result.status !== 'succeeded') {
      throw new Error('Timeout génération IA');
    }

    // Parser sortie
    const output = Array.isArray(result.output) ? result.output.join('') : result.output;
    console.log('📄 Sortie IA:', output.substring(0, 200));

    // Extraire JSON
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Format JSON invalide');
    }

    const data = JSON.parse(jsonMatch[0]);
    
    console.log('✅ Questions générées:', data.questions.length);

    res.json({
      success: true,
      questions: data.questions,
      rationale: data.rationale
    });

  } catch (error) {
    console.error('❌ Erreur génération IA questions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
