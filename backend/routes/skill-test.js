/**
 * 🎯 ROUTES TEST DE COMPÉTENCE
 * Génère des tests personnalisés pour évaluer les aptitudes de l'utilisateur
 * Utilise Replicate API avec modèle performant
 */

const express = require('express');
const router = express.Router();
const geminiService = require('../services/gemini-service');
const supabaseService = require('../supabase-config');

/**
 * POST /api/skill-test/generate
 * Génère un test de compétence personnalisé
 */
router.post('/generate', async (req, res) => {
  try {
    const {
      userId,
      articleId,
      proposal,
      userContext,
      articleContext,
      difficulty = 'moyen', // facile, moyen, difficile
      cumulativeContext // Tout le contexte du projet
    } = req.body;

    if (!userId || !proposal) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    console.log('🎯 Génération test de compétence pour:', proposal.titre);
    console.log('📊 Difficulté:', difficulty);

    // Déterminer le nombre de questions selon la difficulté
    const questionCount = {
      'facile': 10,
      'moyen': 15,
      'difficile': 20
    }[difficulty] || 15;

    // Construire le contexte cumulé complet
    const fullContext = cumulativeContext || {
      article: articleContext,
      proposal,
      userProfile: userContext,
      previousActions: [],
      relatedArticles: []
    };

    // Construire le contexte enrichi
    const contextDescription = `
CONTEXTE CUMULÉ DU PROJET (UTILISE TOUTES CES INFOS POUR PERSONNALISER):

Article source:
- Titre: ${fullContext.article?.title || articleContext?.title || 'N/A'}
- Problématique: ${fullContext.article?.problematique || articleContext?.problematique || 'Opportunité entrepreneuriale au Gabon'}

Proposition business:
- Titre: ${proposal.titre}
- Description: ${proposal.description}
- Secteur: ${proposal.secteur}
- Budget: ${proposal.budget}
- Investissements: ${proposal.premiers_investissements || 'Non spécifié'}

Profil utilisateur:
- Compétences: ${JSON.stringify(userContext?.competences || 'Polyvalentes')}
- Expérience: ${userContext?.experience_entrepreneuriale || 'Variable'}
- Disponibilité: ${userContext?.disponibilite || 'Flexible'}

${fullContext.previousActions?.length > 0 ? `Actions IA déjà effectuées: ${fullContext.previousActions.map(a => a.action_type).join(', ')}` : ''}
${fullContext.relatedArticles?.length > 0 ? `Articles connexes consultés: ${fullContext.relatedArticles.length}` : ''}
${fullContext.businessPlanSections ? `Sections Business Plan complétées: ${fullContext.businessPlanSections}` : ''}
`;

    // Prompt complet de génération de test
    const fullPrompt = `Act like un psychométricien et concepteur senior d'évaluations entrepreneuriales (MCQ) doublé d'un UX writer pédagogique.

OBJECTIF
Concevoir un test en ${questionCount} questions à choix multiples (A–D, une seule meilleure réponse) pour évaluer la capacité d'un candidat à développer, gérer et faire évoluer le business suivant.

NIVEAU DE DIFFICULTÉ: ${difficulty.toUpperCase()}
${difficulty === 'facile' ? '- Questions sur concepts de base et connaissances fondamentales\n- Scénarios simples et directs\n- Réponses relativement évidentes pour quelqu\'un qui a les bases' : ''}
${difficulty === 'moyen' ? '- Questions sur application pratique et analyse\n- Scénarios réalistes nécessitant réflexion\n- Plusieurs réponses plausibles, une seule optimale' : ''}
${difficulty === 'difficile' ? '- Questions sur expertise avancée et cas complexes\n- Scénarios multi-facteurs nécessitant analyse approfondie\n- Réponses subtiles nécessitant expérience et jugement' : ''}

${contextDescription}

Marché cible: B2C et B2B au Gabon, marché émergent, contraintes réglementaires locales.

RÈGLES STRICTES:
- UTILISE TOUT LE CONTEXTE CUMULÉ pour créer des questions ultra-personnalisées
- NE PAS poser de questions sur les infos déjà collectées (délais, disponibilité, compétences déclarées)
- CONCENTRE-TOI sur SAVOIR-FAIRE et CAPACITÉ D'EXÉCUTION
- Adapte la COMPLEXITÉ au niveau ${difficulty}
- Intègre des références au secteur ${proposal.secteur} et budget ${proposal.budget}

CONTRAINTES STRICTES
1) Exactement ${questionCount} questions avec 4 options (A–D)
2) Répartition: 70% compétences transverses (Validation marché, Modèle économique, Finance, Acquisition, Opérations, Gestion risque, Leadership), 30% mises en situation concrètes
3) Difficulté adaptée au niveau ${difficulty}
4) Langue française claire, ton professionnel mais convivial
5) Énoncé ≤60 mots, options ≤25 mots
6) AUCUNE question sur: délais, planning, disponibilité horaire

FORMAT DE SORTIE OBLIGATOIRE (JSON UNIQUEMENT)
Retourne UNIQUEMENT un objet JSON valide (pas de texte avant/après) avec cette structure:

{
  "title": "Test de Compétence : ${proposal.titre}",
  "description": "Évaluez vos aptitudes à développer et gérer ce projet avec un budget de ${proposal.budget}",
  "questions": [
    {
      "id": "q1",
      "question": "Énoncé de la question contextualisée (≤60 mots)",
      "options": [
        "Option A (≤25 mots)",
        "Option B (≤25 mots)",
        "Option C (≤25 mots)",
        "Option D (≤25 mots)"
      ],
      "correctAnswer": 0,
      "explanation": "Explication claire de pourquoi cette réponse est la meilleure et pourquoi les autres ne conviennent pas (≤80 mots, langage simple)",
      "category": "Validation marché|Modèle économique|Finance|Acquisition|Opérations|Gestion risque|Leadership"
    }
  ],
  "scoring": {
    "excellent": {
      "min": 80,
      "message": "Excellent ! Vous démontrez une solide maîtrise des compétences entrepreneuriales nécessaires pour ce projet. Vous êtes prêt à vous lancer avec confiance."
    },
    "good": {
      "min": 60,
      "message": "Bon niveau ! Vous avez des bases solides. Quelques renforcements ciblés vous permettront d'optimiser vos chances de succès."
    },
    "average": {
      "min": 40,
      "message": "Bases en développement. Identifiez vos priorités d'apprentissage et prenez le temps de vous former sur les aspects clés avant de vous lancer."
    },
    "needsWork": {
      "message": "Des lacunes importantes sont à combler. Nous vous recommandons un accompagnement structuré pour acquérir les compétences essentielles."
    }
  }
}

GÉNÈRE MAINTENANT LE TEST COMPLET (10 questions) en JSON UNIQUEMENT.`;

    // Appel à Gemini 3 Pro (Reasoning + JSON)
    console.log('🤖 Appel Gemini 3 Pro pour génération test...');
    
    let test;
    try {
      test = await geminiService.generateJSON(fullPrompt, {
        systemPrompt: "Tu es un expert en psychométrie et évaluation entrepreneuriale. Tu génères UNIQUEMENT du JSON valide, sans texte supplémentaire.",
        temperature: 0.7
      });
    } catch (geminiError) {
      console.error('❌ Erreur Gemini:', geminiError);
      return res.status(502).json({ 
        success: false,
        error: 'Erreur Gemini API',
        message: geminiError.message
      });
    }

    console.log('✅ Test de compétence généré avec succès');

    // Enrichir le test avec les métadonnées
    const enrichedTest = {
      ...test,
      difficulty,
      passingScore: difficulty === 'facile' ? 60 : difficulty === 'moyen' ? 70 : 80,
      questionCount
    };

    // Sauvegarder le test dans Supabase
    const { data: savedTest, error: saveError } = await supabaseService.supabase
      .from('skill_tests')
      .insert({
        user_id: userId,
        article_id: articleId,
        proposal_title: proposal.titre,
        proposal_description: proposal.description,
        sector: proposal.secteur,
        budget: proposal.budget,
        test_data: enrichedTest,
        user_context: userContext,
        difficulty,
        credits_used: 30
      })
      .select()
      .single();

    if (saveError) {
      console.error('⚠️ Erreur sauvegarde test:', saveError);
      // Continuer même si la sauvegarde échoue
    } else {
      console.log('💾 Test sauvegardé avec ID:', savedTest.id);
      
      // 🔔 NOTIFICATION EN TEMPS RÉEL
      try {
        const notificationHelper = require('../utils/notificationHelper');
        await notificationHelper.notifySkillTestGenerated(
          userId,
          projectId,
          savedTest.id,
          difficulty
        );
        console.log('✅ Notification test envoyée');
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }
    }

    res.json({
      success: true,
      test,
      testId: savedTest?.id,
      credits_used: 30
    });

  } catch (error) {
    console.error('❌ Erreur génération test:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération du test',
      details: error.message
    });
  }
});

/**
 * GET /api/skill-test/my-tests
 * Récupère tous les tests de l'utilisateur
 */
router.get('/my-tests', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { data: tests, error } = await supabaseService.supabase
      .from('skill_tests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      tests: tests || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération tests:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tests'
    });
  }
});

/**
 * GET /api/skill-test/:id
 * Récupère un test spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { data: test, error } = await supabaseService.supabase
      .from('skill_tests')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test non trouvé'
      });
    }

    res.json({
      success: true,
      test
    });

  } catch (error) {
    console.error('❌ Erreur récupération test:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du test'
    });
  }
});

/**
 * PUT /api/skill-test/:id/complete
 * Enregistre les résultats d'un test complété
 */
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userAnswers, score, scorePercentage } = req.body;

    if (!userId || !userAnswers) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    const { data: test, error } = await supabaseService.supabase
      .from('skill_tests')
      .update({
        user_answers: userAnswers,
        score,
        score_percentage: scorePercentage,
        completed: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Test complété:', id);

    res.json({
      success: true,
      test
    });

  } catch (error) {
    console.error('❌ Erreur complétion test:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'enregistrement des résultats'
    });
  }
});

/**
 * DELETE /api/skill-test/:id
 * Supprime un test
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { error } = await supabaseService.supabase
      .from('skill_tests')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    console.log('🗑️ Test supprimé:', id);

    res.json({
      success: true,
      message: 'Test supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression test:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du test'
    });
  }
});

/**
 * POST /api/skill-test/:id/regenerate
 * Regénère un test sur les mêmes bases
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    // Récupérer le test original
    const { data: originalTest, error: fetchError } = await supabaseService.supabase
      .from('skill_tests')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    if (!originalTest) {
      return res.status(404).json({
        success: false,
        error: 'Test original non trouvé'
      });
    }

    // Regénérer avec les mêmes paramètres
    const proposal = {
      titre: originalTest.proposal_title,
      description: originalTest.proposal_description,
      secteur: originalTest.sector,
      budget: originalTest.budget
    };

    // Réutiliser le même prompt de génération (code dupliqué de la route /generate)
    const fullPrompt = `Act like un psychométricien et concepteur senior d'évaluations entrepreneuriales (MCQ) doublé d'un UX writer pédagogique.

OBJECTIF
Concevoir un test en 10 questions à choix multiples (A–D, une seule meilleure réponse) pour évaluer la capacité d'un candidat à développer, gérer et faire évoluer le business suivant.

CONTEXTE FOURNI (NE PAS DEMANDER DE QUESTIONS SUPPLÉMENTAIRES)

Proposition de valeur/business:
- Titre: ${proposal.titre}
- Description: ${proposal.description}
- Secteur: ${proposal.secteur}
- Budget de démarrage: ${proposal.budget}

Profil utilisateur:
${JSON.stringify(originalTest.user_context, null, 2)}

Marché cible: B2C et B2B au Gabon, marché émergent, contraintes réglementaires locales.

CONTRAINTES STRICTES
1) Exactement 10 questions avec 4 options (A–D)
2) Q1–Q7: compétences transverses (Validation marché, Modèle économique, Finance, Acquisition, Opérations, Gestion risque, Leadership)
3) Q8–Q10: mises en situation concrètes liées à la proposition et au budget
4) Difficulté panachée: ≥3 questions Difficiles
5) Langue française claire, ton professionnel mais convivial
6) Énoncé ≤60 mots, options ≤25 mots

FORMAT DE SORTIE OBLIGATOIRE (JSON UNIQUEMENT)
Retourne UNIQUEMENT un objet JSON valide avec la structure attendue.

GÉNÈRE MAINTENANT UN NOUVEAU TEST COMPLET (10 questions) en JSON UNIQUEMENT.`;

    console.log('🔄 Regénération test pour:', proposal.titre);
    console.log('🤖 Appel Gemini 3 Pro...');

    let newTest;
    try {
      newTest = await geminiService.generateJSON(fullPrompt, {
        systemPrompt: "Tu es un expert en psychométrie et évaluation entrepreneuriale. Tu génères UNIQUEMENT du JSON valide, sans texte supplémentaire.",
        temperature: 0.8
      });
    } catch (geminiError) {
      console.error('❌ Erreur Gemini:', geminiError);
      return res.status(502).json({ 
        success: false,
        error: 'Erreur Gemini API',
        message: geminiError.message
      });
    }

    // Sauvegarder le nouveau test
    const { data: savedTest, error: saveError } = await supabaseService.supabase
      .from('skill_tests')
      .insert({
        user_id: userId,
        article_id: originalTest.article_id,
        proposal_title: originalTest.proposal_title,
        proposal_description: originalTest.proposal_description,
        sector: originalTest.sector,
        budget: originalTest.budget,
        test_data: newTest,
        user_context: originalTest.user_context,
        credits_used: 30
      })
      .select()
      .single();

    if (saveError) throw saveError;

    console.log('✅ Test regénéré avec ID:', savedTest.id);

    res.json({
      success: true,
      test: newTest,
      testId: savedTest.id,
      credits_used: 30
    });

  } catch (error) {
    console.error('❌ Erreur regénération test:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la regénération du test',
      details: error.message
    });
  }
});

/**
 * POST /api/skill-test/save-score
 * Sauvegarde le score d'un test
 */
router.post('/save-score', async (req, res) => {
  try {
    const {
      userId,
      projectId,
      testId,
      score,
      difficulty,
      questionsTotal,
      questionsCorrect,
      timeSpent,
      answers
    } = req.body;

    if (!userId || !projectId || score === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    console.log('💾 Sauvegarde score test:', score, '%', difficulty);

    const { data: savedScore, error } = await supabaseService.supabase
      .from('skill_test_scores')
      .insert({
        user_id: userId,
        project_id: projectId,
        test_id: testId,
        score,
        difficulty,
        questions_total: questionsTotal,
        questions_correct: questionsCorrect,
        time_spent: timeSpent,
        answers
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Score sauvegardé avec ID:', savedScore.id);

    res.json({
      success: true,
      scoreId: savedScore.id
    });

  } catch (error) {
    console.error('❌ Erreur sauvegarde score:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la sauvegarde du score'
    });
  }
});

/**
 * GET /api/skill-test/scores/:projectId
 * Récupère tous les scores d'un projet
 */
router.get('/scores/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { data: scores, error } = await supabaseService.supabase
      .from('skill_test_scores')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      scores: scores || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération scores:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des scores'
    });
  }
});

module.exports = router;
