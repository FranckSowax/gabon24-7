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

    const { data: votes, error } = await supabase
      .from('poll_votes')
      .select('response')
      .eq('question_id', questionId);

    if (error) throw error;

    // Calculer les statistiques (comptage + pourcentage par réponse)
    const voteCounts = {};
    const totalVotes = (votes || []).length;
    for (const vote of (votes || [])) {
      const val = vote.response;
      voteCounts[val] = (voteCounts[val] || 0) + 1;
    }

    const computedStats = Object.entries(voteCounts).map(([response_value, vote_count]) => ({
      response_value,
      vote_count,
      percentage: totalVotes > 0 ? (vote_count / totalVotes) * 100 : 0
    }));

    const response = {
      success: true,
      stats: computedStats,
      total_votes: totalVotes
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

    // Recalculer les stats après le vote
    const { data: allVotes } = await supabase
      .from('poll_votes')
      .select('response')
      .eq('question_id', questionId);

    const voteCounts = {};
    const totalVotes = (allVotes || []).length;
    for (const v of (allVotes || [])) {
      voteCounts[v.response] = (voteCounts[v.response] || 0) + 1;
    }
    const stats = Object.entries(voteCounts).map(([response_value, vote_count]) => ({
      response_value,
      vote_count,
      percentage: totalVotes > 0 ? (vote_count / totalVotes) * 100 : 0
    }));

    res.json({ success: true, vote: data[0], stats });
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

// GET /api/polls/global-stats - Statistiques globales des sondages (admin)
router.get('/global-stats', async (req, res) => {
  try {
    // Cache Redis - 10 minutes
    const cacheKey = 'polls:global-stats';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des stats globales des sondages...');

    // Total sondages
    const { count: totalPolls } = await supabase
      .from('polls')
      .select('*', { count: 'exact', head: true });

    // Sondages actifs
    const { count: activePolls } = await supabase
      .from('polls')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Total réponses
    const { count: totalResponses } = await supabase
      .from('poll_votes')
      .select('*', { count: 'exact', head: true });

    const response = {
      success: true,
      stats: {
        totalPolls: totalPolls || 0,
        activePolls: activePolls || 0,
        totalResponses: totalResponses || 0
      }
    };

    // Mettre en cache Redis - 10 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 600);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Erreur stats globales sondages:', error);
    res.json({
      success: true,
      stats: { totalPolls: 0, activePolls: 0, totalResponses: 0 }
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

    // Appel OpenAI GPT-4.1-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'Tu es un expert en sondages d\'opinion au Gabon. Réponds uniquement en JSON valide.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.status}`);
    }

    const result = await response.json();
    const output = result.choices[0]?.message?.content || '';
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
