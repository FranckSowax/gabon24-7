/**
 * 🎮 GAME - "Il n'en restera qu'1" Battle Royale Quiz
 * Génère des questions basées sur les articles récents avec Gemini
 */

const express = require('express');
const router = express.Router();
// Utiliser la configuration partagée au lieu de recréer un client
const { supabase } = require('../config/supabase');
const gameQuestionGenerator = require('../services/game-question-generator');

// Service Gemini (pour backward compatibility si besoin)
let geminiService;
try {
  geminiService = require('../services/gemini-service');
} catch (e) {
  console.warn('⚠️ Gemini service non disponible pour le jeu');
}

/**
 * POST /api/game/generate-daily
 * Déclenche manuellement la génération de questions quotidiennes via IA
 */
router.post('/generate-daily', async (req, res) => {
  try {
    console.log('🎮 [GAME] Déclenchement manuel génération quotidienne...');
    // Exécuter en arrière-plan (fire and forget) ou attendre
    // Pour l'API, on attend un peu pour confirmer le démarrage
    
    const count = await gameQuestionGenerator.generateDailyQuestions();
    
    res.json({
      success: true,
      message: 'Génération terminée',
      count
    });
  } catch (error) {
    console.error('❌ Erreur génération daily:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/questions
 * Génère des questions de quiz basées sur les articles récents
 * Privilégie les questions générées dans les dernières 72h (actualité fraîche)
 */
router.post('/questions', async (req, res) => {
  try {
    const { rounds = 10, sessionType = 'training' } = req.body;

    // Déterminer le type de questions à récupérer
    // training = questions gratuites pour entraînement
    // paid = questions pour sessions payantes (différentes du training!)
    const questionType = sessionType === 'training' ? 'training' : 'paid';

    console.log(`🎮 [GAME] Demande de ${rounds} questions (type: ${questionType})...`);

    // Date limite: questions des dernières 72h uniquement
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 72);
    const cutoffISO = cutoffDate.toISOString();

    // Récupérer des questions récentes de chaque niveau de difficulté
    // Filtrer par question_type pour séparer Training des sessions payantes
    const buildQuery = (difficulty) => {
      let query = supabase
        .from('game_questions')
        .select('id, difficulty, question, question_text, answers, correct_answer_index, time_limit, is_anti_ai, source_excerpt, question_type')
        .eq('difficulty', difficulty)
        .gte('created_at', cutoffISO)
        .order('created_at', { ascending: false })
        .limit(60);

      // Filtrer par type si la colonne existe (graceful degradation)
      // Les questions sans type sont considérées comme 'paid'
      if (questionType === 'training') {
        query = query.eq('question_type', 'training');
      } else {
        // Pour paid, on accepte 'paid' ou null (anciennes questions)
        query = query.or('question_type.eq.paid,question_type.is.null');
      }

      return query;
    };

    const [facileRes, moyenRes, difficileRes] = await Promise.all([
      buildQuery('Facile'),
      buildQuery('Moyen'),
      buildQuery('Difficile')
    ]);

    // Grouper par difficulté et mélanger aléatoirement
    const byDifficulty = {
      'Facile': (facileRes.data || []).sort(() => Math.random() - 0.5),
      'Moyen': (moyenRes.data || []).sort(() => Math.random() - 0.5),
      'Difficile': (difficileRes.data || []).sort(() => Math.random() - 0.5)
    };

    const totalQuestions = Object.values(byDifficulty).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✅ ${totalQuestions} questions récupérées (Facile: ${byDifficulty['Facile'].length}, Moyen: ${byDifficulty['Moyen'].length}, Difficile: ${byDifficulty['Difficile'].length})`);

    if (totalQuestions >= rounds) {
      // Distribution progressive pour une session de 10 questions:
      // Rounds 1-3: Facile (échauffement)
      // Rounds 4-7: Moyen (cœur du jeu)
      // Rounds 8-10: Difficile (défi final)
      const selected = [];
      const usedIds = new Set(); // Éviter les doublons

      const addQuestions = (arr, count) => {
        let added = 0;
        for (const q of arr) {
          if (added >= count) break;
          if (!usedIds.has(q.id)) {
            selected.push(q);
            usedIds.add(q.id);
            added++;
          }
        }
        return added;
      };

      // Phase 1: 3 questions faciles (30%)
      const facilesAdded = addQuestions(byDifficulty['Facile'], Math.ceil(rounds * 0.3));

      // Phase 2: 4 questions moyennes (40%)
      const moyennesAdded = addQuestions(byDifficulty['Moyen'], Math.ceil(rounds * 0.4));

      // Phase 3: 3 questions difficiles (30%)
      const difficilesAdded = addQuestions(byDifficulty['Difficile'], Math.ceil(rounds * 0.3));

      // Compléter si nécessaire avec ce qui reste
      if (selected.length < rounds) {
        const allRemaining = [...byDifficulty['Facile'], ...byDifficulty['Moyen'], ...byDifficulty['Difficile']];
        addQuestions(allRemaining, rounds - selected.length);
      }

      console.log(`📊 Distribution finale: Facile=${selected.filter(q => q.difficulty === 'Facile').length}, Moyen=${selected.filter(q => q.difficulty === 'Moyen').length}, Difficile=${selected.filter(q => q.difficulty === 'Difficile').length}`);
      
      // Mapper vers le format attendu par le frontend avec mélange des réponses
      const formattedQuestions = selected.slice(0, rounds).map((q, index) => {
        const originalAnswers = q.answers || [];
        const originalCorrectIndex = q.correct_answer_index;
        const correctAnswer = originalAnswers[originalCorrectIndex];
        
        // Mélanger les réponses aléatoirement
        const shuffledAnswers = [...originalAnswers].sort(() => Math.random() - 0.5);
        
        // Trouver le nouvel index de la bonne réponse
        const newCorrectIndex = shuffledAnswers.indexOf(correctAnswer);
        
        return {
          id: q.id,
          round: index + 1,
          difficulty: q.difficulty || 'Moyen',
          question: q.question || q.question_text,
          answers: shuffledAnswers,
          correct: newCorrectIndex,
          timeLimit: q.time_limit || 15,
          isAntiAI: q.is_anti_ai || false,
          articleSource: q.source_excerpt || null
        };
      });

      return res.json({
        success: true,
        questions: formattedQuestions,
        source: 'database',
        count: formattedQuestions.length
      });
    }

    console.log(`📊 Seulement ${totalQuestions} questions en base (< ${rounds} requises), génération nécessaire...`);

    // 2. Récupérer les articles des dernières 36h pour générer de nouvelles questions
    const thirtySixHoursAgo = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, content, category, published_at')
      .eq('is_published', true)
      .gte('published_at', thirtySixHoursAgo)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    console.log(`📰 ${articles?.length || 0} articles récents trouvés`);

    // 3. Si pas assez d'articles ou pas de Gemini, utiliser les questions par défaut
    if (!articles || articles.length < 5 || !geminiService) {
      console.log('⚠️ Utilisation des questions par défaut (pas assez d\'articles ou Gemini indisponible)');
      return res.json({
        success: true,
        questions: getDefaultQuestions(rounds),
        source: 'default'
      });
    }

    // 3. Préparer le contexte pour Gemini
    const articlesContext = articles.slice(0, 20).map(a => ({
      title: a.title,
      summary: a.summary?.substring(0, 300) || '',
      category: a.category
    }));

    // 4. Générer les questions avec Gemini
    const prompt = `Tu es un rédacteur expert de questions pour "Il n'en restera qu'1", un jeu de culture générale sur l'actualité gabonaise.
    
    CONTEXTE: Voici des extraits d'articles récents:
    ${JSON.stringify(articlesContext, null, 2)}

    MISSION: Génère exactement ${rounds} questions QCM basées EXCLUSIVEMENT sur les faits mentionnés dans ces textes.

    RÈGLES DE RÉDACTION (TRÈS IMPORTANT):
    1. AUTONOMIE TOTALE : Le joueur n'a PAS lu les articles. La question doit être 100% compréhensible sans contexte préalable.
    2. INTERDIT FORMELLEMENT : "De quoi parle cet article ?", "Selon le texte", "Dans l'extrait ci-dessus", "Quel est le titre ?".
    3. OBLIGATOIRE : Pose des questions DIRECTES et CONTEXTUALISÉES (ex: "Au Gabon, quelle compagnie...").
       - MAUVAIS : "Quel est le sujet de l'article sur le pétrole ?"
       - BON : "Quelle compagnie pétrolière a annoncé un nouveau forage au large de Port-Gentil ?"
    4. Les réponses doivent être précises, courtes et factuelles (noms, chiffres, lieux, dates).
    5. Style : Journalistique, précis, neutre.

    PROGRESSION DE DIFFICULTÉ:
    1. Questions 1-3 (FACILE): Faits majeurs et évidents du texte.
    2. Questions 4-5 (MOYEN): Détails importants mais demandant de l'attention.
    3. Questions 6-7 (DIFFICILE): Chiffres précis, dates exactes, noms complets.
    4. Questions 8-9 (EXPERT): Détails pointus ou pièges subtils.
    5. Question 10 (ANTI-IA): Question subjective/émotionnelle (voir règles ci-dessous).

    QUESTIONS ANTI-IA (pour détecter les bots):
    - Demande une opinion, une émotion ou un choix instinctif.
    - Ex: "Quel emoji résume cette bonne nouvelle ?", "Instinctivement, quel chiffre préférez-vous ?"
    - TOUTES les réponses sont acceptées ("correct": -1).

    FORMAT JSON STRICT (pas de markdown):
    {
      "questions": [
        {
          "id": "1",
          "round": 1,
          "difficulty": "Facile",
          "question": "Texte de la question...",
          "answers": ["Choix A", "Choix B", "Choix C", "Choix D"],
          "correct": 0,
          "timeLimit": 15,
          "articleSource": "Titre de l'article source (facultatif)",
          "isAntiAI": false
        }
      ]
    }

    TEMPS PAR DIFFICULTÉ:
    - Facile: 15s | Moyen: 12s | Difficile: 10s | Expert: 8s | Anti-IA: 5s`;

    try {
      const questionsData = await geminiService.generateJSON(prompt, {
        systemPrompt: 'Tu es un rédacteur de questions de quiz strict et précis. Réponds UNIQUEMENT en JSON valide.',
        temperature: 0.7
      });

      if (questionsData.questions && Array.isArray(questionsData.questions)) {
        console.log(`✅ [GAME] ${questionsData.questions.length} questions générées par Gemini`);
        
        // Sauvegarder les questions dans Supabase
        try {
          const questionsToSave = questionsData.questions.map(q => ({
            round: q.round,
            difficulty: q.difficulty,
            question_text: q.question,
            answers: q.answers,
            correct_answer_index: q.correct,
            time_limit: q.timeLimit,
            is_anti_ai: q.isAntiAI || false,
            // source_article_id: ... (plus complexe à lier ici, on laisse null pour l'instant)
          }));

          const { error: saveError } = await supabase
            .from('game_questions')
            .insert(questionsToSave);

          if (saveError) {
            console.error('⚠️ Erreur sauvegarde questions:', saveError);
          } else {
            console.log('💾 Questions sauvegardées en base');
          }
        } catch (saveErr) {
          console.error('⚠️ Erreur sauvegarde questions:', saveErr);
        }

        return res.json({
          success: true,
          questions: questionsData.questions,
          source: 'gemini',
          articlesUsed: articles.length
        });
      }
    } catch (geminiError) {
      console.error('❌ Erreur Gemini:', geminiError);
    }

    // Fallback aux questions par défaut
    return res.json({
      success: true,
      questions: getDefaultQuestions(rounds),
      source: 'default'
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      questions: getDefaultQuestions(10)
    });
  }
});

/**
 * GET /api/game/generated-questions
 * Récupère l'historique des questions générées
 */
router.get('/generated-questions', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('game_questions')
      .select('id, difficulty, question, question_text, answers, correct_answer_index, time_limit, is_anti_ai, source_excerpt')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    res.json({
      success: true,
      questions: data || [],
      total: count || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Erreur récupération questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/question
 * Génère UNE SEULE question basée sur le round et la difficulté
 * Utilise la base de données des questions générées par IA
 */
router.post('/question', async (req, res) => {
  try {
    const { round = 1, difficulty = 'Facile', survivors = 1000, excludeIds = [] } = req.body;
    
    console.log(`🎮 [GAME] Demande question round ${round} (${difficulty}), exclusions: ${excludeIds.length}`);

    // Cas Anti-IA: Générer à la volée ou fallback statique (car elles sont rares en base)
    if (difficulty === 'Anti-IA') {
      // Utiliser le fallback Anti-IA directement pour l'instant
      return res.json({
        success: true,
        question: generateSingleFallbackQuestion(round, 'Anti-IA'),
        source: 'anti-ia-static'
      });
    }

    // 1. Chercher une question dans la DB qui n'est pas dans excludeIds
    let query = supabase
      .from('game_questions')
      .select('id, difficulty, question, question_text, answers, correct_answer_index, time_limit, is_anti_ai, source_excerpt')
      .eq('difficulty', difficulty); // On filtre par difficulté

    // Appliquer l'exclusion (limite de l'URL Supabase, on fait attention à la taille)
    // Si excludeIds est trop grand, on prendra au hasard et on filtrera en JS, ou on prend les plus récentes
    if (excludeIds.length > 0 && excludeIds.length < 100) {
      query = query.not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`);
        query = query.not('id', 'in', `(${excludeIds.map(id => `"${id}"`).join(',')})`);
    }

    // Prendre un lot aléatoire (via random sort non supporté nativement efficacement, on prend les 50 dernières et on shuffle en JS)
    const { data: questions, error } = await query.limit(50).order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur DB Questions:', error);
      throw error;
    }

    let selectedQuestion = null;

    if (questions && questions.length > 0) {
      // Filtrage JS supplémentaire si excludeIds était trop grand
      const available = questions.filter(q => !excludeIds.includes(q.id));
      
      if (available.length > 0) {
        // Sélection aléatoire
        const randomQ = available[Math.floor(Math.random() * available.length)];
        
        // Incrémenter le compteur d'utilisation pour la gestion du pool (fire and forget)
        supabase.from('game_questions')
          .update({ used_count: (randomQ.used_count || 0) + 1 })
          .eq('id', randomQ.id)
          .then(() => {}); // On ignore le résultat pour aller vite

        // Formater pour le frontend
        selectedQuestion = {
          id: randomQ.id,
          round: round,
          difficulty: randomQ.difficulty,
          question: randomQ.question_text || randomQ.question, // Support des deux noms de colonne au cas où
          answers: randomQ.answers,
          correct: randomQ.correct_answer_index, // Correction du nom de la colonne
          timeLimit: difficulty === 'Facile' ? 15 : difficulty === 'Moyen' ? 12 : difficulty === 'Difficile' ? 10 : difficulty === 'Expert' ? 7 : 5,
          isAntiAI: false,
          articleSource: randomQ.source_title
        };
      }
    }

    // 2. Si pas de question trouvée, utiliser le fallback ou générer à la volée
    if (!selectedQuestion) {
      console.log('⚠️ Aucune question trouvée en base, utilisation fallback');
      selectedQuestion = generateSingleFallbackQuestion(round, difficulty);
      
      // Optionnel: déclencher une génération asynchrone pour recharger le stock
      // gameQuestionGenerator.generateDailyQuestions(); 
    } else {
      console.log(`✅ Question trouvée: ${selectedQuestion.id}`);
    }

    res.json({
      success: true,
      question: selectedQuestion,
      source: selectedQuestion.id.startsWith(round + '-') ? 'fallback' : 'database'
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur:', error);
    res.json({
      success: true, // On renvoie success true avec fallback pour ne pas bloquer le jeu
      question: generateSingleFallbackQuestion(round, difficulty),
      source: 'error-fallback'
    });
  }
});

// Historique des questions posées pour éviter les répétitions
const askedQuestions = new Set();

/**
 * Génère une question de fallback unique sans répétition
 */
function generateSingleFallbackQuestion(round, difficulty) {
  const questions = {
    'Facile': [
      { id: 'f1', question: "Quelle est la capitale du Gabon ?", answers: ["Libreville", "Port-Gentil", "Franceville", "Oyem"], correct: 0 },
      { id: 'f2', question: "Quelle est la monnaie du Gabon ?", answers: ["Euro", "Dollar", "Franc CFA", "Naira"], correct: 2 },
      { id: 'f3', question: "Sur quel continent se trouve le Gabon ?", answers: ["Asie", "Europe", "Afrique", "Amérique"], correct: 2 },
      { id: 'f4', question: "Quelle langue officielle parle-t-on au Gabon ?", answers: ["Anglais", "Français", "Espagnol", "Portugais"], correct: 1 },
      { id: 'f5', question: "Quel océan borde le Gabon ?", answers: ["Pacifique", "Indien", "Atlantique", "Arctique"], correct: 2 },
      { id: 'f6', question: "De quelle couleur est le drapeau gabonais ?", answers: ["Rouge-Blanc-Bleu", "Vert-Jaune-Bleu", "Vert-Rouge-Noir", "Jaune-Vert-Orange"], correct: 1 },
      { id: 'f7', question: "Quel pays ne partage PAS de frontière avec le Gabon ?", answers: ["Cameroun", "Congo", "Guinée Équatoriale", "Nigeria"], correct: 3 },
      { id: 'f8', question: "Quelle est la devise du Gabon ?", answers: ["Unité, Travail, Justice", "Liberté, Égalité, Fraternité", "Union, Travail, Justice", "Paix, Travail, Patrie"], correct: 2 },
      { id: 'f9', question: "Quel sport est le plus populaire au Gabon ?", answers: ["Basketball", "Football", "Tennis", "Athlétisme"], correct: 1 },
      { id: 'f10', question: "Quelle est la religion majoritaire au Gabon ?", answers: ["Islam", "Christianisme", "Animisme", "Bouddhisme"], correct: 1 },
    ],
    'Moyen': [
      { id: 'm1', question: "En quelle année le Gabon a-t-il obtenu son indépendance ?", answers: ["1958", "1960", "1962", "1964"], correct: 1 },
      { id: 'm2', question: "Quel fleuve traverse Lambaréné ?", answers: ["Komo", "Ogooué", "Nyanga", "Ivindo"], correct: 1 },
      { id: 'm3', question: "Qui est le président de la Transition ?", answers: ["Ali Bongo", "Oligui Nguema", "Jean Ping", "Léon Mba"], correct: 1 },
      { id: 'm4', question: "Quelle est la deuxième ville du Gabon ?", answers: ["Franceville", "Port-Gentil", "Oyem", "Moanda"], correct: 1 },
      { id: 'm5', question: "Qui fut le premier président du Gabon ?", answers: ["Omar Bongo", "Léon Mba", "Jean-Hilaire Aubame", "Paul Gondjout"], correct: 1 },
      { id: 'm6', question: "Quel médecin célèbre a fondé un hôpital à Lambaréné ?", answers: ["Louis Pasteur", "Albert Schweitzer", "Pierre Curie", "Robert Koch"], correct: 1 },
      { id: 'm7', question: "Quelle ressource naturelle est majeure au Gabon ?", answers: ["Diamants", "Pétrole", "Uranium", "Cuivre"], correct: 1 },
      { id: 'm8', question: "Quel est le code téléphonique du Gabon ?", answers: ["+237", "+241", "+242", "+243"], correct: 1 },
      { id: 'm9', question: "Quelle ethnie est la plus nombreuse au Gabon ?", answers: ["Fang", "Punu", "Nzebi", "Myene"], correct: 0 },
      { id: 'm10', question: "Quel footballeur gabonais a joué à Arsenal ?", answers: ["Mario Lemina", "Pierre-Emerick Aubameyang", "Denis Bouanga", "Aaron Boupendza"], correct: 1 },
    ],
    'Difficile': [
      { id: 'd1', question: "Combien de provinces compte le Gabon ?", answers: ["7", "8", "9", "10"], correct: 2 },
      { id: 'd2', question: "Quel est le nom de l'aéroport de Libreville ?", answers: ["Léon Mba", "Omar Bongo", "Schweitzer", "De Gaulle"], correct: 0 },
      { id: 'd3', question: "Quel parc national est classé UNESCO ?", answers: ["Lopé", "Ivindo", "Loango", "Minkébé"], correct: 0 },
      { id: 'd4', question: "Quelle province a pour chef-lieu Oyem ?", answers: ["Estuaire", "Woleu-Ntem", "Ogooué-Maritime", "Haut-Ogooué"], correct: 1 },
      { id: 'd5', question: "En quelle année Omar Bongo est-il devenu président ?", answers: ["1965", "1967", "1970", "1973"], correct: 1 },
      { id: 'd6', question: "Quel est le point culminant du Gabon ?", answers: ["Mont Iboundji", "Mont Cristal", "Mont Bengoué", "Mont Brazza"], correct: 0 },
      { id: 'd7', question: "Quelle ville est le centre de l'industrie pétrolière ?", answers: ["Libreville", "Port-Gentil", "Franceville", "Moanda"], correct: 1 },
      { id: 'd8', question: "Quel est le nom du parlement gabonais ?", answers: ["Assemblée Nationale", "Sénat", "Les deux", "Conseil National"], correct: 2 },
      { id: 'd9', question: "Quelle est la superficie du Gabon ?", answers: ["167 000 km²", "227 000 km²", "267 000 km²", "307 000 km²"], correct: 2 },
      { id: 'd10', question: "Quel minerai est exploité à Moanda ?", answers: ["Or", "Fer", "Manganèse", "Bauxite"], correct: 2 },
    ],
    'Expert': [
      { id: 'e1', question: "Quelle est la population exacte du Gabon (2023) ?", answers: ["1.8 million", "2.3 millions", "2.8 millions", "3.2 millions"], correct: 1 },
      { id: 'e2', question: "Quel % du territoire est couvert de forêt ?", answers: ["75%", "80%", "85%", "88%"], correct: 3 },
      { id: 'e3', question: "En quelle année le Gabon a rejoint l'OPEP ?", answers: ["1973", "1975", "1978", "1980"], correct: 0 },
      { id: 'e4', question: "Combien d'espèces de gorilles vivent au Gabon ?", answers: ["1", "2", "3", "4"], correct: 0 },
      { id: 'e5', question: "Quel est le PIB par habitant du Gabon (USD) ?", answers: ["5 000", "8 000", "12 000", "16 000"], correct: 1 },
      { id: 'e6', question: "Quelle est l'altitude du Mont Iboundji ?", answers: ["972m", "1 020m", "1 150m", "1 575m"], correct: 1 },
      { id: 'e7', question: "Combien de parcs nationaux compte le Gabon ?", answers: ["10", "13", "15", "18"], correct: 1 },
      { id: 'e8', question: "Quelle année marque la création de la COMILOG ?", answers: ["1953", "1958", "1962", "1967"], correct: 1 },
      { id: 'e9', question: "Quel est le taux d'alphabétisation au Gabon ?", answers: ["75%", "80%", "85%", "89%"], correct: 2 },
      { id: 'e10', question: "Combien de km de côtes possède le Gabon ?", answers: ["600 km", "800 km", "885 km", "1 000 km"], correct: 2 },
    ],
    'Anti-IA': [
      // Questions Anti-IA sur le thème du Gabon - toutes les réponses sont valides
      { id: 'ai1', question: "🧠 Vite ! Quelle ville gabonaise préférez-vous ?", answers: ["Libreville", "Port-Gentil", "Franceville", "Oyem"], correct: -1, isAntiAI: true },
      { id: 'ai2', question: "🧠 Instinctivement, quel plat gabonais ?", answers: ["Poulet Nyembwe", "Poisson braisé", "Manioc", "Banane plantain"], correct: -1, isAntiAI: true },
      { id: 'ai3', question: "🧠 Premier réflexe : quelle ethnie vous inspire ?", answers: ["Fang", "Punu", "Myene", "Nzebi"], correct: -1, isAntiAI: true },
      { id: 'ai4', question: "🧠 Sans réfléchir : quel parc national ?", answers: ["Lopé", "Loango", "Ivindo", "Minkébé"], correct: -1, isAntiAI: true },
      { id: 'ai5', question: "🧠 Vite ! Quel fleuve gabonais ?", answers: ["Ogooué", "Komo", "Nyanga", "Ivindo"], correct: -1, isAntiAI: true },
      { id: 'ai6', question: "🧠 Intuition : quelle province ?", answers: ["Estuaire", "Woleu-Ntem", "Ogooué-Maritime", "Haut-Ogooué"], correct: -1, isAntiAI: true },
      { id: 'ai7', question: "🧠 Réflexe : quel animal du Gabon ?", answers: ["Gorille", "Éléphant", "Panthère", "Mandrill"], correct: -1, isAntiAI: true },
      { id: 'ai8', question: "🧠 Vite ! Quelle musique gabonaise ?", answers: ["Rumba", "Bikutsi", "Afrobeat", "Makossa"], correct: -1, isAntiAI: true },
      { id: 'ai9', question: "🧠 Instinct : quel arbre gabonais ?", answers: ["Okoumé", "Moabi", "Kevazingo", "Padouk"], correct: -1, isAntiAI: true },
      { id: 'ai10', question: "🧠 Sans hésiter : quelle plage ?", answers: ["Pointe Denis", "Cap Estérias", "Mayumba", "Ekwata"], correct: -1, isAntiAI: true },
    ]
  };

  const pool = questions[difficulty] || questions['Facile'];
  
  // Filtrer les questions déjà posées
  const availableQuestions = pool.filter(q => !askedQuestions.has(q.id));
  
  // Si toutes les questions ont été posées, réinitialiser
  if (availableQuestions.length === 0) {
    pool.forEach(q => askedQuestions.delete(q.id));
    availableQuestions.push(...pool);
  }
  
  // Sélectionner une question aléatoire parmi celles disponibles
  const q = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];

  // Marquer comme posée
  askedQuestions.add(q.id);

  // Mélanger les réponses aléatoirement (sauf pour Anti-IA où toutes sont valides)
  let shuffledAnswers = [...q.answers];
  let newCorrectIndex = q.correct;

  if (!q.isAntiAI && q.correct >= 0) {
    const correctAnswer = q.answers[q.correct];
    // Fisher-Yates shuffle
    for (let i = shuffledAnswers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledAnswers[i], shuffledAnswers[j]] = [shuffledAnswers[j], shuffledAnswers[i]];
    }
    // Trouver le nouvel index de la bonne réponse
    newCorrectIndex = shuffledAnswers.indexOf(correctAnswer);
  }

  return {
    id: `${round}-${q.id}-${Date.now()}`,
    round,
    difficulty,
    question: q.question,
    answers: shuffledAnswers,
    correct: newCorrectIndex,
    timeLimit: difficulty === 'Facile' ? 15 : difficulty === 'Moyen' ? 12 : difficulty === 'Difficile' ? 10 : difficulty === 'Expert' ? 7 : 5,
    isAntiAI: q.isAntiAI || false
  };
}

/**
 * Génère une liste de questions par défaut mélangées avec réponses randomisées
 * @param {number} count - Nombre de questions à générer
 * @returns {Array} Questions formatées avec réponses mélangées
 */
function getDefaultQuestions(count = 10) {
  const allQuestions = [];

  // Distribution: 30% Facile, 40% Moyen, 30% Difficile
  const facileCount = Math.ceil(count * 0.3);
  const moyenCount = Math.ceil(count * 0.4);
  const difficileCount = count - facileCount - moyenCount;

  // Générer les questions avec difficulté progressive
  for (let i = 0; i < facileCount; i++) {
    allQuestions.push(generateSingleFallbackQuestion(allQuestions.length + 1, 'Facile'));
  }
  for (let i = 0; i < moyenCount; i++) {
    allQuestions.push(generateSingleFallbackQuestion(allQuestions.length + 1, 'Moyen'));
  }
  for (let i = 0; i < difficileCount; i++) {
    allQuestions.push(generateSingleFallbackQuestion(allQuestions.length + 1, 'Difficile'));
  }

  // Réassigner les numéros de round
  return allQuestions.slice(0, count).map((q, index) => ({
    ...q,
    round: index + 1
  }));
}

// ==================== LE PACTE - KILLER FEATURE ====================

/**
 * Configuration du Pacte (paramètres ajustables par session)
 */
const PACT_CONFIG = {
  // Seuils de déclenchement par type de session
  sessions: {
    starter: { minPlayers: 20, minPot: 20000 },      // 100 joueurs, 25k pot
    classic: { minPlayers: 50, minPot: 200000 },     // 500 joueurs, 250k pot
    premium: { minPlayers: 100, minPot: 800000 },    // 1000 joueurs, 1M pot
    elite: { minPlayers: 150, minPot: 4000000 },     // 2000 joueurs, 5M pot
    mega: { minPlayers: 200, minPot: 20000000 }      // 5000 joueurs, 25M pot
  },
  systemCommission: 0.10,  // 10% pour l'organisateur
  voteThreshold: 0.80,     // 80% requis pour valider le pacte
  voteTimer: 10,           // 10 secondes pour voter
  defaultVote: 'refuse'    // Pas de réponse = refus
};

/**
 * Calcule l'offre du Pacte
 * @param {number} totalPot - Cagnotte totale en FCFA
 * @param {number} playerCount - Nombre de joueurs restants
 * @returns {Object} Détails de l'offre
 */
function calculatePactOffer(totalPot, playerCount) {
  // 1. Commission système (10%)
  const systemCommission = Math.floor(totalPot * PACT_CONFIG.systemCommission);
  
  // 2. Montant à partager
  const amountToShare = totalPot - systemCommission;
  
  // 3. Offre individuelle
  const individualOffer = Math.floor(amountToShare / playerCount);
  
  return {
    totalPot,
    playerCount,
    systemCommission,
    systemCommissionPercent: PACT_CONFIG.systemCommission * 100,
    amountToShare,
    individualOffer,
    formattedOffer: formatCurrency(individualOffer),
    formattedPot: formatCurrency(totalPot),
    formattedCommission: formatCurrency(systemCommission)
  };
}

/**
 * Formate un montant en FCFA
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

/**
 * Vérifie si le Pacte peut être proposé
 * @param {string} sessionType - Type de session (starter, classic, premium, elite, mega)
 * @param {number} playerCount - Nombre de joueurs restants
 * @param {number} totalPot - Cagnotte totale
 * @returns {Object} Résultat de la vérification
 */
function checkPactConditions(sessionType, playerCount, totalPot) {
  const config = PACT_CONFIG.sessions[sessionType] || PACT_CONFIG.sessions.classic;
  
  const canPropose = playerCount <= config.minPlayers && totalPot >= config.minPot;
  
  return {
    canPropose,
    sessionType,
    playerCount,
    totalPot,
    thresholds: config,
    reason: canPropose 
      ? 'CONDITIONS_MET' 
      : playerCount > config.minPlayers 
        ? 'TOO_MANY_PLAYERS' 
        : 'POT_TOO_LOW'
  };
}

/**
 * Traite les votes du Pacte
 * @param {Array} votes - Liste des votes [{odlayerId, odlayerId, vote: 'accept'|'refuse'}]
 * @param {number} totalPlayers - Nombre total de joueurs
 * @returns {Object} Résultat du vote
 */
function processPactVotes(votes, totalPlayers) {
  const acceptVotes = votes.filter(v => v.vote === 'accept').length;
  const refuseVotes = votes.filter(v => v.vote === 'refuse').length;
  const noVotes = totalPlayers - votes.length;
  
  // Les non-votants comptent comme refus
  const totalRefuse = refuseVotes + noVotes;
  const acceptPercentage = (acceptVotes / totalPlayers) * 100;
  
  const isPactAccepted = acceptPercentage >= (PACT_CONFIG.voteThreshold * 100);
  
  return {
    totalPlayers,
    acceptVotes,
    refuseVotes,
    noVotes,
    totalRefuse,
    acceptPercentage: Math.round(acceptPercentage * 10) / 10,
    requiredPercentage: PACT_CONFIG.voteThreshold * 100,
    isPactAccepted,
    result: isPactAccepted ? 'PACT_ACCEPTED' : 'PACT_REJECTED',
    message: isPactAccepted 
      ? `LE PACTE EST ACCEPTÉ ! ${acceptPercentage.toFixed(1)}% ont voté OUI`
      : `PACTE REJETÉ ! Seulement ${acceptPercentage.toFixed(1)}% ont voté OUI (${PACT_CONFIG.voteThreshold * 100}% requis)`
  };
}

// Stockage temporaire des sessions de vote (en production: Redis)
const pactVoteSessions = new Map();

/**
 * POST /api/game/pact/check
 * Vérifie si le Pacte peut être proposé
 */
router.post('/pact/check', async (req, res) => {
  try {
    const { sessionType, playerCount, totalPot } = req.body;
    
    console.log(`🤝 [PACTE] Vérification: ${playerCount} joueurs, ${totalPot} FCFA, session ${sessionType}`);
    
    const conditions = checkPactConditions(sessionType, playerCount, totalPot);
    
    if (conditions.canPropose) {
      const offer = calculatePactOffer(totalPot, playerCount);
      console.log(`✅ [PACTE] Conditions remplies! Offre: ${offer.formattedOffer}/joueur`);
      
      return res.json({
        success: true,
        canPropose: true,
        conditions,
        offer,
        voteTimer: PACT_CONFIG.voteTimer,
        voteThreshold: PACT_CONFIG.voteThreshold * 100
      });
    }
    
    console.log(`❌ [PACTE] Conditions non remplies: ${conditions.reason}`);
    return res.json({
      success: true,
      canPropose: false,
      conditions
    });
    
  } catch (error) {
    console.error('❌ [PACTE] Erreur check:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/pact/calculate
 * Calcule l'offre du Pacte
 */
router.post('/pact/calculate', async (req, res) => {
  try {
    const { totalPot, playerCount } = req.body;
    
    if (!totalPot || !playerCount) {
      return res.status(400).json({ 
        success: false, 
        error: 'totalPot et playerCount requis' 
      });
    }
    
    const offer = calculatePactOffer(totalPot, playerCount);
    
    console.log(`💰 [PACTE] Calcul: ${offer.formattedPot} / ${playerCount} joueurs = ${offer.formattedOffer}/joueur`);
    
    res.json({
      success: true,
      offer
    });
    
  } catch (error) {
    console.error('❌ [PACTE] Erreur calcul:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/pact/start-vote
 * Démarre une session de vote pour le Pacte
 */
router.post('/pact/start-vote', async (req, res) => {
  try {
    const { sessionId, totalPot, playerCount, playerIds } = req.body;
    
    if (!sessionId || !totalPot || !playerCount) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, totalPot et playerCount requis' 
      });
    }
    
    const offer = calculatePactOffer(totalPot, playerCount);
    const voteSession = {
      sessionId,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + PACT_CONFIG.voteTimer * 1000),
      totalPot,
      playerCount,
      offer,
      votes: [],
      playerIds: playerIds || [],
      status: 'voting'
    };
    
    pactVoteSessions.set(sessionId, voteSession);
    
    console.log(`🗳️ [PACTE] Vote démarré pour session ${sessionId}: ${playerCount} joueurs, ${offer.formattedOffer}/joueur`);
    
    res.json({
      success: true,
      voteSession: {
        sessionId,
        offer,
        voteTimer: PACT_CONFIG.voteTimer,
        voteThreshold: PACT_CONFIG.voteThreshold * 100,
        expiresAt: voteSession.expiresAt
      }
    });
    
  } catch (error) {
    console.error('❌ [PACTE] Erreur start-vote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/pact/vote
 * Enregistre le vote d'un joueur
 */
router.post('/pact/vote', async (req, res) => {
  try {
    const { sessionId, odlayerId, vote } = req.body;
    
    if (!sessionId || !odlayerId || !['accept', 'refuse'].includes(vote)) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, odlayerId et vote (accept/refuse) requis' 
      });
    }
    
    const voteSession = pactVoteSessions.get(sessionId);
    
    if (!voteSession) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session de vote non trouvée' 
      });
    }
    
    if (voteSession.status !== 'voting') {
      return res.status(400).json({ 
        success: false, 
        error: 'Le vote est terminé' 
      });
    }
    
    // Vérifier si le joueur a déjà voté
    const existingVote = voteSession.votes.find(v => v.odlayerId === odlayerId);
    if (existingVote) {
      return res.status(400).json({ 
        success: false, 
        error: 'Vous avez déjà voté' 
      });
    }
    
    // Enregistrer le vote
    voteSession.votes.push({ odlayerId, vote, votedAt: new Date() });
    
    console.log(`🗳️ [PACTE] Vote reçu: ${odlayerId} -> ${vote} (${voteSession.votes.length}/${voteSession.playerCount})`);
    
    // Calculer le pourcentage actuel
    const currentAccept = voteSession.votes.filter(v => v.vote === 'accept').length;
    const currentPercentage = (currentAccept / voteSession.playerCount) * 100;
    
    res.json({
      success: true,
      voteRegistered: true,
      currentStats: {
        totalVotes: voteSession.votes.length,
        acceptVotes: currentAccept,
        currentPercentage: Math.round(currentPercentage * 10) / 10
      }
    });
    
  } catch (error) {
    console.error('❌ [PACTE] Erreur vote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/pact/end-vote
 * Termine le vote et calcule le résultat
 */
router.post('/pact/end-vote', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const voteSession = pactVoteSessions.get(sessionId);
    
    if (!voteSession) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session de vote non trouvée' 
      });
    }
    
    // Marquer comme terminé
    voteSession.status = 'completed';
    
    // Traiter les résultats
    const result = processPactVotes(voteSession.votes, voteSession.playerCount);
    
    console.log(`🏁 [PACTE] Vote terminé: ${result.result} (${result.acceptPercentage}%)`);
    
    // Si accepté, préparer les gains
    let winnings = null;
    if (result.isPactAccepted) {
      winnings = {
        totalPot: voteSession.totalPot,
        systemCommission: voteSession.offer.systemCommission,
        amountDistributed: voteSession.offer.amountToShare,
        perPlayer: voteSession.offer.individualOffer,
        winners: voteSession.playerCount
      };
      console.log(`💰 [PACTE] Distribution: ${voteSession.offer.formattedOffer} x ${voteSession.playerCount} joueurs`);
    }
    
    // Nettoyer la session
    pactVoteSessions.delete(sessionId);
    
    res.json({
      success: true,
      result,
      winnings,
      offer: voteSession.offer
    });
    
  } catch (error) {
    console.error('❌ [PACTE] Erreur end-vote:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/game/pact/simulate
 * Simule un scénario de Pacte (pour tests)
 */
router.get('/pact/simulate', async (req, res) => {
  try {
    // Scénario: 80 joueurs, pacte rejeté de justesse (75% de oui)
    const scenario = {
      sessionType: 'mega',
      totalPot: 25000000,
      playerCount: 80,
      description: 'Simulation: Pacte rejeté de justesse'
    };
    
    // Vérifier les conditions
    const conditions = checkPactConditions(scenario.sessionType, scenario.playerCount, scenario.totalPot);
    
    // Calculer l'offre
    const offer = calculatePactOffer(scenario.totalPot, scenario.playerCount);
    
    // Simuler les votes (75% acceptent = 60 joueurs)
    const simulatedVotes = [];
    for (let i = 0; i < 60; i++) {
      simulatedVotes.push({ odlayerId: `player_${i}`, vote: 'accept' });
    }
    for (let i = 60; i < 75; i++) {
      simulatedVotes.push({ odlayerId: `player_${i}`, vote: 'refuse' });
    }
    // 5 joueurs n'ont pas voté (comptent comme refus)
    
    // Traiter les votes
    const result = processPactVotes(simulatedVotes, scenario.playerCount);
    
    res.json({
      success: true,
      scenario,
      conditions,
      offer,
      votes: {
        simulated: simulatedVotes.length,
        noVotes: scenario.playerCount - simulatedVotes.length
      },
      result,
      nextAction: result.isPactAccepted ? 'END_GAME_DISTRIBUTE_WINNINGS' : 'CONTINUE_WITH_NEXT_QUESTION'
    });
    
  } catch (error) {
    console.error('❌ [PACTE] Erreur simulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GÉNÉRATION DE QUESTIONS DEPUIS ARTICLES ====================

/**
 * POST /api/game/generate-questions
 * Génère des questions à partir des articles récents et les stocke en base
 */
router.post('/generate-questions', async (req, res) => {
  try {
    const { count = 20, difficulty = 'medium' } = req.body;
    
    console.log(`🎮 [GAME] Génération de ${count} questions depuis les articles...`);

    // 1. Récupérer les articles des dernières 72h
    const hoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, summary, content, category, published_at')
      .eq('is_published', true)
      .gte('published_at', hoursAgo)
      .order('published_at', { ascending: false })
      .limit(50);

    if (articlesError) throw articlesError;

    if (!articles || articles.length === 0) {
      return res.json({ success: true, generated: 0, message: 'Aucun article récent trouvé' });
    }

    console.log(`📰 ${articles.length} articles trouvés pour génération`);

    const generatedQuestions = [];

    for (const article of articles.slice(0, Math.min(count, articles.length))) {
      try {
        // Générer une question avec Gemini si disponible
        let questionData;
        
        if (geminiService && geminiService.generateJSON) {
          const prompt = `
Génère UNE question de quiz QCM basée EXCLUSIVEMENT sur les faits de cet article.

ARTICLE:
Titre: ${article.title}
Résumé: ${article.summary || ''}
Contenu: ${(article.content || '').substring(0, 1000)}

RÈGLES STRICTES DE RÉDACTION:
1. INTERDIT FORMELLEMENT : Les questions "méta" (ex: "Quel est le titre ?", "De quoi parle l'article ?", "Quel est le sujet principal ?", "Selon le texte...").
2. OBLIGATOIRE : Pose une question DIRECTE et AUTONOME sur un fait, un chiffre, un nom ou un lieu mentionné.
   - MAUVAIS : "Quel est le sujet de l'article sur la route ?"
   - BON : "Quelle ville sera reliée par la nouvelle route nationale 1 ?"
3. Les réponses doivent être courtes, précises et sans ambiguïté.
4. Les 3 mauvaises réponses doivent être crédibles mais fausses.
5. Difficulté: ${difficulty} (sois précis).

FORMAT JSON STRICT:
{
  "question": "La question ici ?",
  "answers": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "correctIndex": 0,
  "excerpt": "Extrait court prouvant la réponse"
}`;

          try {
            console.log(`🤖 Appel Gemini pour l'article: ${article.title.substring(0, 30)}...`);
            const response = await geminiService.generateJSON(prompt, { temperature: 0.5 });
            
            // Nettoyage du JSON
            const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
            questionData = JSON.parse(cleanResponse);
            console.log('✨ Question générée par IA avec succès');
          } catch (geminiErr) {
            console.error('⚠️ Erreur génération Gemini:', geminiErr.message);
            // On laisse questionData null pour activer le fallback
          }
        }

        // Fallback: générer une question basique
        if (!questionData) {
          questionData = generateBasicQuestionFromArticle(article);
        }

        if (questionData) {
          // Vérifier si la question existe déjà
          const { data: existing } = await supabase
            .from('game_questions')
            .select('id')
            .eq('article_id', article.id)
            .single();

          if (!existing) {
            // Insérer la nouvelle question
            const { data: inserted, error: insertError } = await supabase
              .from('game_questions')
              .insert({
                article_id: article.id,
                question_text: questionData.question,
                answers: questionData.answers,
                correct_answer_index: questionData.correctIndex,
                difficulty: difficulty,
                category: article.category,
                source_excerpt: questionData.excerpt || article.summary
              })
              .select()
              .single();

            if (!insertError && inserted) {
              generatedQuestions.push(inserted);
            }
          }
        }
      } catch (err) {
        console.warn(`⚠️ Erreur génération question pour article ${article.id}:`, err.message);
      }
    }

    console.log(`✅ ${generatedQuestions.length} questions générées et stockées`);

    res.json({
      success: true,
      generated: generatedQuestions.length,
      questions: generatedQuestions
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur génération questions:', error);
    // Si la table n'existe pas, retourner un message explicatif
    if (error.code === '42P01' || error.message?.includes('does not exist')) {
      return res.json({ 
        success: false, 
        generated: 0, 
        error: 'Les tables de jeu ne sont pas encore créées. Veuillez exécuter la migration Supabase.',
        questions: []
      });
    }
    res.json({ success: false, generated: 0, error: error.message, questions: [] });
  }
});

/**
 * Génère une question basique à partir d'un article (fallback sans IA)
 */
function generateBasicQuestionFromArticle(article) {
  const templates = [
    {
      q: `Quel est le sujet principal de l'article "${article.title.substring(0, 50)}..." ?`,
      generateAnswers: () => {
        const correct = article.category || 'Actualité';
        const wrong = ['Sport', 'Économie', 'Politique', 'Culture', 'Société', 'International']
          .filter(c => c !== correct)
          .slice(0, 3);
        const answers = [correct, ...wrong].sort(() => Math.random() - 0.5);
        return { answers, correctIndex: answers.indexOf(correct) };
      }
    },
    {
      q: `Cet article a été publié dans quelle catégorie ?`,
      generateAnswers: () => {
        const correct = article.category || 'Actualité';
        const wrong = ['Technologie', 'Santé', 'Éducation', 'Environnement']
          .filter(c => c !== correct)
          .slice(0, 3);
        const answers = [correct, ...wrong].sort(() => Math.random() - 0.5);
        return { answers, correctIndex: answers.indexOf(correct) };
      }
    }
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];
  const { answers, correctIndex } = template.generateAnswers();

  return {
    question: template.q,
    answers,
    correctIndex,
    excerpt: article.summary
  };
}

/**
 * GET /api/game/questions/available
 * Récupère les questions disponibles (non utilisées aujourd'hui)
 */
router.get('/questions/available', async (req, res) => {
  try {
    const { session_id, limit = 50 } = req.query;
    const today = new Date().toISOString().split('T')[0];

    // Questions déjà utilisées aujourd'hui
    const { data: usedToday } = await supabase
      .from('game_daily_questions')
      .select('question_id')
      .eq('used_date', today);

    const usedIds = (usedToday || []).map(q => q.question_id);

    // Questions déjà utilisées dans cette session
    let sessionUsedIds = [];
    if (session_id) {
      const { data: usedInSession } = await supabase
        .from('game_session_questions')
        .select('question_id')
        .eq('session_id', session_id);
      sessionUsedIds = (usedInSession || []).map(q => q.question_id);
    }

    const allUsedIds = [...new Set([...usedIds, ...sessionUsedIds])];

    // Récupérer les questions disponibles
    let query = supabase
      .from('game_questions')
      .select('*')
      .order('times_used', { ascending: true })
      .limit(parseInt(limit));

    if (allUsedIds.length > 0) {
      query = query.not('id', 'in', `(${allUsedIds.join(',')})`);
    }

    const { data: questions, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      available: questions?.length || 0,
      questions: questions || []
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur récupération questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/questions/mark-used
 * Marque une question comme utilisée
 */
router.post('/questions/mark-used', async (req, res) => {
  try {
    const { question_id, session_id, round_number = 1 } = req.body;

    if (!question_id) {
      return res.status(400).json({ success: false, error: 'question_id requis' });
    }

    const today = new Date().toISOString().split('T')[0];

    // Marquer comme utilisée aujourd'hui
    await supabase
      .from('game_daily_questions')
      .upsert({
        question_id,
        used_date: today,
        session_id
      }, { onConflict: 'question_id,used_date' });

    // Marquer comme utilisée dans la session
    if (session_id) {
      await supabase
        .from('game_session_questions')
        .upsert({
          session_id,
          question_id,
          round_number
        }, { onConflict: 'session_id,question_id' });
    }

    // Incrémenter le compteur d'utilisation
    await supabase.rpc('increment_question_usage', { q_id: question_id });

    res.json({ success: true });

  } catch (error) {
    console.error('❌ [GAME] Erreur marquage question:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GESTION DES SESSIONS ====================

/**
 * GET /api/game/sessions
 * Liste toutes les sessions
 * Paramètres: status, game_mode ('quota' | 'hourly'), limit
 */
router.get('/sessions', async (req, res) => {
  try {
    const { status, game_mode, limit = 20 } = req.query;

    let query = supabase
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }

    // Filtrer par mode de jeu si spécifié
    if (game_mode && ['quota', 'hourly'].includes(game_mode)) {
      query = query.eq('game_mode', game_mode);
    }

    let { data: sessions, error } = await query;

    // Si la table n'existe pas, retourner un tableau vide
    if (error && error.code === '42P01') {
      return res.json({ success: true, sessions: [], message: 'Table non créée' });
    }
    if (error) throw error;

    // NOTE: La session Training est définie dans le frontend (TRAINING_SESSION)
    // Pas besoin de la créer en base de données

    res.json({
      success: true,
      sessions: sessions || []
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur liste sessions:', error);
    // Retourner succès avec données vides plutôt qu'une erreur 500
    res.json({ success: true, sessions: [], error: error.message });
  }
});

/**
 * GET /api/game/sessions/:id
 * Récupère une session par son ID
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: session, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !session) {
      return res.status(404).json({ success: false, error: 'Session non trouvée' });
    }

    // Récupérer le nombre de questions associées
    const { count: questionsCount } = await supabase
      .from('game_session_questions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', id);

    res.json({ 
      success: true, 
      session: {
        ...session,
        questions_count: questionsCount || 0
      }
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur récupération session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/sessions
 * Crée une nouvelle session avec génération automatique de questions
 * Supporte deux modes: 'quota' (remplissage requis) et 'hourly' (lancement à heure fixe)
 */
router.post('/sessions', async (req, res) => {
  try {
    const { 
      session_type, 
      name, 
      entry_fee, 
      max_players, 
      scheduled_start, 
      generate_questions = true,
      // Nouveaux paramètres pour les modes
      game_mode = 'quota', // 'quota' ou 'hourly'
      starts_at,           // Date/heure de lancement (mode hourly)
      scheduled_hour,      // Heure programmée 0-23 (mode hourly)
      min_prize = 0        // Prix minimum garanti (mode hourly)
    } = req.body;

    if (!session_type || !name) {
      return res.status(400).json({ success: false, error: 'session_type et name requis' });
    }

    // Validation du mode
    if (!['quota', 'hourly'].includes(game_mode)) {
      return res.status(400).json({ success: false, error: 'game_mode doit être "quota" ou "hourly"' });
    }

    // Pour le mode hourly, starts_at est requis
    if (game_mode === 'hourly' && !starts_at) {
      return res.status(400).json({ success: false, error: 'starts_at requis pour le mode hourly' });
    }

    console.log(`🎮 [GAME] Création session: ${name} (${session_type}) - Mode: ${game_mode}`);

    const sessionData = {
      session_type,
      name,
      entry_fee: entry_fee || 0,
      max_players: game_mode === 'hourly' ? null : (max_players || 100), // null = illimité pour hourly
      scheduled_start: scheduled_start || null,
      status: 'upcoming',
      game_mode,
      starts_at: starts_at || null,
      scheduled_hour: scheduled_hour ?? null,
      min_prize: min_prize || 0
    };

    const { data: session, error } = await supabase
      .from('game_sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ [GAME] Session créée: ${session.id} (Mode: ${game_mode})`);

    // Générer automatiquement les questions pour cette session
    if (generate_questions) {
      try {
        console.log(`🎯 [GAME] Génération des questions pour la session ${session.id}...`);
        
        // Récupérer les articles récents
        const hoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        const { data: articles } = await supabase
          .from('articles')
          .select('id, title, summary, content, category')
          .eq('is_published', true)
          .gte('published_at', hoursAgo)
          .order('published_at', { ascending: false })
          .limit(30);

        let questionsGenerated = 0;

        if (articles && articles.length > 0) {
          // Générer des questions à partir des articles
          for (const article of articles.slice(0, 15)) {
            try {
              const questionData = generateBasicQuestionFromArticle(article);
              
              if (questionData) {
                // Insérer la question
                const { data: question, error: qError } = await supabase
                  .from('game_questions')
                  .insert({
                    article_id: article.id,
                    question_text: questionData.question,
                    answers: questionData.answers,
                    correct_answer_index: questionData.correctIndex,
                    difficulty: 'medium',
                    category: article.category,
                    source_excerpt: questionData.excerpt
                  })
                  .select()
                  .single();

                if (!qError && question) {
                  // Associer la question à la session
                  await supabase
                    .from('game_session_questions')
                    .insert({
                      session_id: session.id,
                      question_id: question.id
                    });
                  questionsGenerated++;
                }
              }
            } catch (qErr) {
              console.warn(`⚠️ Erreur génération question:`, qErr.message);
            }
          }
        }

        console.log(`✅ [GAME] ${questionsGenerated} questions générées pour la session`);
        
        // Mettre à jour la session avec le flag questions_generated
        await supabase
          .from('game_sessions')
          .update({ questions_generated: true })
          .eq('id', session.id);

      } catch (genError) {
        console.warn(`⚠️ [GAME] Erreur génération questions:`, genError.message);
      }
    }

    res.json({ 
      success: true, 
      session,
      sessionUrl: `/jeu/${session.id}`
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur création session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/sessions/:id/complete
 * Termine une session et crée automatiquement une nouvelle session
 */
router.post('/sessions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { winner_id, create_next = true } = req.body;

    console.log(`🏁 [GAME] Fin de session: ${id}`);

    // Mettre à jour la session comme terminée
    const { data: completedSession, error: updateError } = await supabase
      .from('game_sessions')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Marquer le gagnant si fourni
    if (winner_id) {
      await supabase
        .from('game_registrations')
        .update({ status: 'winner' })
        .eq('id', winner_id);
    }

    let nextSession = null;

    // Créer automatiquement une nouvelle session
    if (create_next) {
      console.log(`🔄 [GAME] Création de la session suivante...`);
      
      const nextName = `Session ${new Date().toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })}`;

      const { data: newSession, error: createError } = await supabase
        .from('game_sessions')
        .insert({
          session_type: completedSession.session_type,
          name: nextName,
          entry_fee: completedSession.entry_fee,
          max_players: completedSession.max_players,
          status: 'upcoming'
        })
        .select()
        .single();

      if (!createError && newSession) {
        nextSession = newSession;
        console.log(`✅ [GAME] Nouvelle session créée: ${newSession.id}`);

        // Générer les questions pour la nouvelle session
        try {
          const hoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
          const { data: articles } = await supabase
            .from('articles')
            .select('id, title, summary, content, category')
            .eq('is_published', true)
            .gte('published_at', hoursAgo)
            .order('published_at', { ascending: false })
            .limit(20);

          if (articles && articles.length > 0) {
            for (const article of articles.slice(0, 10)) {
              const questionData = generateBasicQuestionFromArticle(article);
              if (questionData) {
                const { data: question } = await supabase
                  .from('game_questions')
                  .insert({
                    article_id: article.id,
                    question_text: questionData.question,
                    answers: questionData.answers,
                    correct_answer_index: questionData.correctIndex,
                    difficulty: 'medium',
                    category: article.category
                  })
                  .select()
                  .single();

                if (question) {
                  await supabase
                    .from('game_session_questions')
                    .insert({
                      session_id: newSession.id,
                      question_id: question.id
                    });
                }
              }
            }
          }
        } catch (genErr) {
          console.warn(`⚠️ Erreur génération questions nouvelle session:`, genErr.message);
        }
      }
    }

    res.json({
      success: true,
      completedSession,
      nextSession,
      nextSessionUrl: nextSession ? `/jeu/${nextSession.id}` : null
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur fin session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/game/sessions/active
 * Récupère la session active actuelle ou la prochaine session à venir
 */
router.get('/sessions/active', async (req, res) => {
  try {
    // Chercher d'abord une session active
    let { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Si pas de session active, chercher la prochaine session upcoming
    if (!session) {
      const { data: upcomingSession } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('status', 'upcoming')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      session = upcomingSession;
    }

    if (!session) {
      return res.json({ 
        success: true, 
        session: null,
        message: 'Aucune session active ou à venir'
      });
    }

    res.json({ success: true, session });

  } catch (error) {
    console.error('❌ [GAME] Erreur récupération session active:', error);
    res.json({ success: true, session: null, error: error.message });
  }
});

/**
 * POST /api/game/sessions/generate-hourly
 * Génère automatiquement les sessions horaires pour les prochaines heures
 */
router.post('/sessions/generate-hourly', async (req, res) => {
  try {
    const { hours_ahead = 6 } = req.body; // Générer pour les 6 prochaines heures par défaut
    
    const now = new Date();
    const createdSessions = [];
    
    // Configuration des sessions horaires
    const hourlyConfigs = [
      { hour: 8, name: 'Session Matinale', entryFee: 500, minPrize: 25000, icon: '🌅' },
      { hour: 10, name: 'Session 10h', entryFee: 500, minPrize: 25000, icon: '☀️' },
      { hour: 12, name: 'Session Midi', entryFee: 1000, minPrize: 50000, icon: '🌞' },
      { hour: 14, name: 'Session 14h', entryFee: 1000, minPrize: 50000, icon: '🔥' },
      { hour: 16, name: 'Session 16h', entryFee: 1500, minPrize: 75000, icon: '⚡' },
      { hour: 18, name: 'Session 18h', entryFee: 2000, minPrize: 100000, icon: '🌆' },
      { hour: 20, name: 'Session Prime Time', entryFee: 2500, minPrize: 150000, icon: '🌙' },
      { hour: 22, name: 'Session Nocturne', entryFee: 2000, minPrize: 100000, icon: '🌃' },
    ];
    
    for (let i = 0; i < hours_ahead; i++) {
      const targetTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const targetHour = targetTime.getHours();
      
      // Trouver la config pour cette heure
      const config = hourlyConfigs.find(c => c.hour === targetHour);
      if (!config) continue;
      
      // Vérifier si une session existe déjà pour cette heure
      const startOfHour = new Date(targetTime);
      startOfHour.setMinutes(0, 0, 0);
      const endOfHour = new Date(startOfHour.getTime() + 60 * 60 * 1000);
      
      const { data: existingSession } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('game_mode', 'hourly')
        .gte('starts_at', startOfHour.toISOString())
        .lt('starts_at', endOfHour.toISOString())
        .limit(1)
        .single();
      
      if (existingSession) {
        console.log(`⏭️ Session horaire déjà existante pour ${targetHour}h`);
        continue;
      }
      
      // Créer la session horaire
      const startsAt = new Date(startOfHour);
      const { data: session, error } = await supabase
        .from('game_sessions')
        .insert({
          session_type: 'hourly',
          name: config.name,
          entry_fee: config.entryFee,
          max_players: null, // Illimité
          status: 'upcoming',
          game_mode: 'hourly',
          starts_at: startsAt.toISOString(),
          scheduled_hour: config.hour,
          min_prize: config.minPrize
        })
        .select()
        .single();
      
      if (error) {
        console.error(`❌ Erreur création session ${config.hour}h:`, error);
        continue;
      }
      
      createdSessions.push(session);
      console.log(`✅ Session horaire créée: ${config.name} à ${startsAt.toISOString()}`);
    }
    
    res.json({ 
      success: true, 
      message: `${createdSessions.length} sessions horaires créées`,
      sessions: createdSessions 
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur génération sessions horaires:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/game/sessions/upcoming-hourly
 * Récupère les prochaines sessions horaires à venir
 */
router.get('/sessions/upcoming-hourly', async (req, res) => {
  try {
    const now = new Date();
    
    const { data: sessions, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('game_mode', 'hourly')
      .eq('status', 'upcoming')
      .gte('starts_at', now.toISOString())
      .order('starts_at', { ascending: true })
      .limit(10);
    
    if (error) throw error;
    
    res.json({ success: true, sessions: sessions || [] });

  } catch (error) {
    console.error('❌ [GAME] Erreur récupération sessions horaires:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/game/sessions/:id/registrations
 * Liste les inscriptions d'une session
 */
router.get('/sessions/:id/registrations', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: registrations, error } = await supabase
      .from('game_registrations')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      count: registrations?.length || 0,
      registrations: registrations || []
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur liste inscriptions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/game/sessions/training/register
 * Inscrit un joueur à une session Training (pour stats dashboard)
 */
router.post('/sessions/training/register', async (req, res) => {
  try {
    const { player_name, whatsapp_number } = req.body;

    if (!player_name || !whatsapp_number) {
      return res.status(400).json({ success: false, error: 'player_name et whatsapp_number requis' });
    }

    // Chercher ou créer la session Training
    let { data: trainingSession } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('session_type', 'training')
      .single();

    // Si pas de session Training, la créer
    if (!trainingSession) {
      const { data: newSession, error: createError } = await supabase
        .from('game_sessions')
        .insert({
          name: 'Mode Training',
          max_players: 1000000,
          current_players: 0,
          entry_fee: 0,
          prize_pool: 0,
          status: 'active',
          session_type: 'training',
          game_mode: 'hourly'
        })
        .select()
        .single();

      if (createError) {
        console.error('Erreur création session training:', createError);
        return res.json({ success: true, message: 'Training sans tracking' });
      }
      trainingSession = newSession;
      console.log('✅ Session Training créée:', trainingSession.id);
    }

    // Enregistrer l'inscription
    const { data: registration, error: regError } = await supabase
      .from('game_registrations')
      .insert({
        session_id: trainingSession.id,
        player_name,
        whatsapp_number,
        status: 'playing'
      })
      .select()
      .single();

    if (regError) {
      console.error('Erreur inscription training:', regError);
      return res.json({ success: true, message: 'Training sans tracking' });
    }

    // Incrémenter le compteur de joueurs
    const { data: currentSession } = await supabase
      .from('game_sessions')
      .select('current_players')
      .eq('id', trainingSession.id)
      .single();
    
    if (currentSession) {
      await supabase
        .from('game_sessions')
        .update({ current_players: (currentSession.current_players || 0) + 1 })
        .eq('id', trainingSession.id);
    }

    console.log('🎓 Inscription Training enregistrée:', player_name);
    
    return res.json({ 
      success: true, 
      registration: {
        id: registration.id,
        session_id: trainingSession.id,
        player_name,
        whatsapp_number
      }
    });

  } catch (error) {
    console.error('❌ Erreur inscription training:', error);
    // Ne pas bloquer le jeu si l'enregistrement échoue
    return res.json({ success: true, message: 'Training sans tracking' });
  }
});

/**
 * POST /api/game/sessions/:id/register
 * Inscrit un joueur à une session
 */
router.post('/sessions/:id/register', async (req, res) => {
  try {
    const { id } = req.params;
    const { player_name, whatsapp_number, email } = req.body;

    if (!player_name || !whatsapp_number) {
      return res.status(400).json({ success: false, error: 'player_name et whatsapp_number requis' });
    }

    // Vérifier si la session existe et n'est pas pleine
    // Pour 'demo', on cherche par session_type car l'id est un UUID auto-généré
    let { data: session, error: sessionError } = id === 'demo' 
        ? await supabase
            .from('game_sessions')
            .select('*')
            .eq('session_type', 'demo')
            .single()
        : await supabase
            .from('game_sessions')
            .select('*')
            .eq('id', id)
            .single();

    // NOTE: La session Training est gérée côté frontend, pas besoin de la créer en base

    if (sessionError || !session) {
      return res.status(404).json({ success: false, error: 'Session non trouvée' });
    }

    if (session.current_players >= session.max_players) {
      return res.status(400).json({ success: false, error: 'Session complète' });
    }

    // Utiliser l'ID réel de la session (important pour demo qui a un UUID)
    const realSessionId = session.id;
    const isDemo = session.session_type === 'demo' || id === 'demo';

    // Vérifier si déjà inscrit (sauf pour la démo qui permet de rejouer)
    if (!isDemo) {
      const { data: existing } = await supabase
        .from('game_registrations')
        .select('id')
        .eq('session_id', realSessionId)
        .eq('whatsapp_number', whatsapp_number)
        .single();

      if (existing) {
        return res.status(400).json({ success: false, error: 'Déjà inscrit à cette session' });
      }
    } else {
      // Pour la démo, retourner succès directement sans créer d'inscription
      console.log('🎮 Session DEMO - Accès direct autorisé pour:', player_name);
      return res.json({ 
        success: true, 
        registration: { 
          id: 'demo-' + Date.now(),
          session_id: realSessionId,
          player_name,
          whatsapp_number,
          is_demo: true
        }
      });
    }

    // Créer l'inscription
    const { data: registration, error: regError } = await supabase
      .from('game_registrations')
      .insert({
        session_id: realSessionId,
        player_name,
        whatsapp_number,
        email
      })
      .select()
      .single();

    if (regError) throw regError;

    // Mettre à jour le compteur et la cagnotte
    await supabase
      .from('game_sessions')
      .update({
        current_players: session.current_players + 1,
        prize_pool: session.prize_pool + session.entry_fee
      })
      .eq('id', realSessionId);

    res.json({ success: true, registration });

  } catch (error) {
    console.error('❌ [GAME] Erreur inscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/game/registrations/:id/eliminate
 * Marquer un joueur comme éliminé
 */
router.put('/registrations/:id/eliminate', async (req, res) => {
  try {
    const { id } = req.params;
    const { round } = req.body;

    const { data, error } = await supabase
      .from('game_registrations')
      .update({
        status: 'eliminated',
        eliminated_at_round: round || 1
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`🚫 Joueur ${id} éliminé au round ${round || 1}`);
    res.json({ success: true, registration: data });

  } catch (error) {
    console.error('❌ [GAME] Erreur élimination:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/game/registrations/:id/winner
 * Marquer un joueur comme gagnant
 */
router.put('/registrations/:id/winner', async (req, res) => {
  try {
    const { id } = req.params;
    const { position = 1 } = req.body;

    const { data, error } = await supabase
      .from('game_registrations')
      .update({
        status: 'winner',
        final_position: position
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`🏆 Joueur ${id} gagnant - Position: ${position}`);
    res.json({ success: true, registration: data });

  } catch (error) {
    console.error('❌ [GAME] Erreur winner:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/game/sessions/:sessionId/player-status
 * Mettre à jour le statut d'un joueur par son numéro WhatsApp
 */
router.put('/sessions/:sessionId/player-status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { whatsapp_number, status, round, position, eliminated_at_question, eliminated_round } = req.body;

    if (!whatsapp_number || !status) {
      return res.status(400).json({ 
        success: false, 
        error: 'whatsapp_number et status requis' 
      });
    }

    // Pour demo/training, chercher par session_type
    let realSessionId = sessionId;
    if (sessionId === 'demo' || sessionId === 'training') {
      const { data: trainingSession } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('session_type', 'training')
        .single();
      
      if (trainingSession) {
        realSessionId = trainingSession.id;
      }
    }

    const updateData = { status };
    
    if (status === 'eliminated') {
      if (round || eliminated_round) {
        updateData.eliminated_at_round = round || eliminated_round;
      }
      if (eliminated_at_question) {
        updateData.eliminated_at_question = eliminated_at_question;
      }
    }
    if (status === 'winner' && position) {
      updateData.final_position = position;
    }

    const { data, error } = await supabase
      .from('game_registrations')
      .update(updateData)
      .eq('session_id', realSessionId)
      .eq('whatsapp_number', whatsapp_number)
      .select()
      .single();

    if (error) throw error;

    const statusEmoji = status === 'winner' ? '🏆' : status === 'eliminated' ? '🚫' : '📝';
    console.log(`${statusEmoji} Joueur ${whatsapp_number} - Statut: ${status}`);
    
    res.json({ success: true, registration: data });

  } catch (error) {
    console.error('❌ [GAME] Erreur mise à jour statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/game/dashboard/stats
 * Statistiques pour le dashboard admin
 */
router.get('/dashboard/stats', async (req, res) => {
  try {
    // Sessions par statut (avec gestion d'erreur si table n'existe pas)
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('id, session_type, name, status, current_players, prize_pool, created_at');

    // Si les tables n'existent pas, retourner des stats vides
    if (sessionsError && (sessionsError.code === '42P01' || sessionsError.message?.includes('does not exist'))) {
      return res.json({
        success: true,
        stats: {
          sessions: { upcoming: 0, active: 0, completed: 0 },
          totalSessions: 0,
          totalRegistrations: 0,
          totalQuestions: 0,
          questionsUsedToday: 0,
          totalPrizePool: 0,
          recentSessions: []
        },
        message: 'Tables de jeu non encore créées'
      });
    }

    // Total inscriptions
    const { count: totalRegistrations } = await supabase
      .from('game_registrations')
      .select('*', { count: 'exact', head: true });

    // Total questions
    const { count: totalQuestions } = await supabase
      .from('game_questions')
      .select('*', { count: 'exact', head: true });

    // Questions utilisées aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const { count: questionsUsedToday } = await supabase
      .from('game_daily_questions')
      .select('*', { count: 'exact', head: true })
      .eq('used_date', today);

    // Stats par type de session
    const sessionStats = {
      upcoming: sessions?.filter(s => s.status === 'upcoming').length || 0,
      active: sessions?.filter(s => s.status === 'active').length || 0,
      completed: sessions?.filter(s => s.status === 'completed').length || 0
    };

    // Cagnotte totale
    const totalPrizePool = sessions?.reduce((sum, s) => sum + (s.prize_pool || 0), 0) || 0;

    res.json({
      success: true,
      stats: {
        sessions: sessionStats,
        totalSessions: sessions?.length || 0,
        totalRegistrations: totalRegistrations || 0,
        totalQuestions: totalQuestions || 0,
        questionsUsedToday: questionsUsedToday || 0,
        totalPrizePool,
        recentSessions: sessions?.slice(0, 10) || []
      }
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur stats dashboard:', error);
    // Retourner des stats vides plutôt qu'une erreur 500
    res.json({
      success: true,
      stats: {
        sessions: { upcoming: 0, active: 0, completed: 0 },
        totalSessions: 0,
        totalRegistrations: 0,
        totalQuestions: 0,
        questionsUsedToday: 0,
        totalPrizePool: 0,
        recentSessions: []
      },
      error: error.message
    });
  }
});

/**
 * GET /api/game/dashboard/registrations
 * Liste complète des inscriptions pour le dashboard
 */
router.get('/dashboard/registrations', async (req, res) => {
  try {
    const { session_id, limit = 100 } = req.query;

    let query = supabase
      .from('game_registrations')
      .select(`
        *,
        game_sessions (
          id,
          name,
          session_type,
          status,
          entry_fee,
          prize_pool
        )
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (session_id) {
      query = query.eq('session_id', session_id);
    }

    const { data: registrations, error } = await query;

    // Si la table n'existe pas, retourner un tableau vide
    if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
      return res.json({ success: true, count: 0, registrations: [], message: 'Table non créée' });
    }
    if (error) throw error;

    res.json({
      success: true,
      count: registrations?.length || 0,
      registrations: registrations || []
    });

  } catch (error) {
    console.error('❌ [GAME] Erreur liste inscriptions dashboard:', error);
    // Retourner données vides plutôt qu'erreur 500
    res.json({ success: true, count: 0, registrations: [], error: error.message });
  }
});

/**
 * DELETE /api/game/generated-questions
 * Supprime des questions générées
 */
router.delete('/generated-questions', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Liste d\'IDs requise' });
    }

    const { error } = await supabase
      .from('game_questions')
      .delete()
      .in('id', ids);

    if (error) throw error;

    res.json({ success: true, count: ids.length });
  } catch (error) {
    console.error('❌ Erreur suppression questions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/game/dashboard/questions
 * Questions générées des dernières 72h pour le dashboard admin
 */
router.get('/dashboard/questions', async (req, res) => {
  try {
    // Date limite: 72h
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 72);
    const cutoffISO = cutoffDate.toISOString();

    const { data: questions, error } = await supabase
      .from('game_questions')
      .select('id, difficulty, question_text, answers, correct_answer_index, time_limit, is_anti_ai, source_excerpt, created_at')
      .gte('created_at', cutoffISO)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Grouper par jour
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().split('T')[0];

    const grouped = {
      today: questions?.filter(q => q.created_at?.startsWith(today)) || [],
      yesterday: questions?.filter(q => q.created_at?.startsWith(yesterday)) || [],
      older: questions?.filter(q => !q.created_at?.startsWith(today) && !q.created_at?.startsWith(yesterday)) || []
    };

    // Stats par difficulté
    const byDifficulty = {
      Facile: questions?.filter(q => q.difficulty === 'Facile').length || 0,
      Moyen: questions?.filter(q => q.difficulty === 'Moyen').length || 0,
      Difficile: questions?.filter(q => q.difficulty === 'Difficile').length || 0
    };

    res.json({
      success: true,
      total: questions?.length || 0,
      byDifficulty,
      grouped,
      questions: questions || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération questions dashboard:', error);
    res.json({ success: true, total: 0, questions: [], error: error.message });
  }
});

/**
 * GET /api/game/dashboard/advanced-stats
 * Statistiques avancées: revenus, stats par période (jour/semaine/mois)
 */
router.get('/dashboard/advanced-stats', async (req, res) => {
  try {
    const { period = 'week' } = req.query; // day, week, month

    // Calculer les dates
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Lundi
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Récupérer toutes les inscriptions
    const { data: registrations, error: regError } = await supabase
      .from('game_registrations')
      .select(`
        id, player_name, whatsapp_number, status, created_at,
        game_sessions (id, name, entry_fee, prize_pool)
      `)
      .order('created_at', { ascending: false });

    if (regError) throw regError;

    // Récupérer les sessions
    const { data: sessions, error: sessError } = await supabase
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (sessError) throw sessError;

    // Récupérer les questions
    const { count: totalQuestions } = await supabase
      .from('game_questions')
      .select('*', { count: 'exact', head: true });

    // Récupérer les vainqueurs
    const winners = registrations?.filter(r => r.status === 'winner') || [];

    // Calculer les revenus (basé sur entry_fee de la session)
    const calculateRevenue = (regs) => {
      return regs?.reduce((sum, r) => {
        const amount = r.game_sessions?.entry_fee || 0;
        return sum + amount;
      }, 0) || 0;
    };

    // Stats aujourd'hui
    const todayRegs = registrations?.filter(r =>
      new Date(r.created_at) >= today
    ) || [];

    // Stats cette semaine
    const weekRegs = registrations?.filter(r =>
      new Date(r.created_at) >= startOfWeek
    ) || [];

    // Stats ce mois
    const monthRegs = registrations?.filter(r =>
      new Date(r.created_at) >= startOfMonth
    ) || [];

    // Stats sessions par période
    const todaySessions = sessions?.filter(s => new Date(s.created_at) >= today) || [];
    const weekSessions = sessions?.filter(s => new Date(s.created_at) >= startOfWeek) || [];
    const monthSessions = sessions?.filter(s => new Date(s.created_at) >= startOfMonth) || [];

    // Revenus par session (top 10)
    const sessionRevenues = sessions?.map(s => ({
      id: s.id,
      name: s.name,
      players: s.current_players || 0,
      revenue: (s.current_players || 0) * (s.entry_fee || 0),
      prizePool: s.prize_pool || 0,
      status: s.status,
      createdAt: s.created_at
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 10) || [];

    // Stats globales
    const totalRevenue = calculateRevenue(registrations);
    const totalPrizesPaid = winners.reduce((sum, w) => sum + (w.game_sessions?.prize_pool || 0), 0);
    const netRevenue = totalRevenue - totalPrizesPaid;

    res.json({
      success: true,
      stats: {
        // Totaux
        totalRevenue,
        totalPrizesPaid,
        netRevenue,
        totalPlayers: registrations?.length || 0,
        totalWinners: winners.length,
        totalSessions: sessions?.length || 0,
        totalQuestions: totalQuestions || 0,

        // Aujourd'hui
        today: {
          players: todayRegs.length,
          revenue: calculateRevenue(todayRegs),
          sessions: todaySessions.length
        },

        // Cette semaine
        week: {
          players: weekRegs.length,
          revenue: calculateRevenue(weekRegs),
          sessions: weekSessions.length
        },

        // Ce mois
        month: {
          players: monthRegs.length,
          revenue: calculateRevenue(monthRegs),
          sessions: monthSessions.length
        },

        // Top sessions par revenus
        topSessions: sessionRevenues,

        // Vainqueurs récents
        recentWinners: winners.slice(0, 10).map(w => ({
          id: w.id,
          name: w.player_name,
          whatsapp: w.whatsapp_number,
          session: w.game_sessions?.name,
          prize: w.game_sessions?.prize_pool || 0,
          date: w.created_at
        }))
      }
    });

  } catch (error) {
    console.error('❌ Erreur stats avancées:', error);
    res.json({
      success: false,
      error: error.message,
      stats: {
        totalRevenue: 0, totalPrizesPaid: 0, netRevenue: 0,
        totalPlayers: 0, totalWinners: 0, totalSessions: 0, totalQuestions: 0,
        today: { players: 0, revenue: 0, sessions: 0 },
        week: { players: 0, revenue: 0, sessions: 0 },
        month: { players: 0, revenue: 0, sessions: 0 },
        topSessions: [], recentWinners: []
      }
    });
  }
});

/**
 * GET /api/game/dashboard/session-stats
 * Stats détaillées par session pour l'onglet Sessions
 */
router.get('/dashboard/session-stats', async (req, res) => {
  try {
    const { period = 'all' } = req.query; // today, week, month, all

    // Calculer les dates filtres
    const now = new Date();
    let startDate = null;

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }

    // Récupérer les sessions
    let query = supabase
      .from('game_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data: sessions, error } = await query;
    if (error) throw error;

    // Récupérer les inscriptions pour chaque session
    const sessionIds = sessions?.map(s => s.id) || [];
    const { data: allRegs } = await supabase
      .from('game_registrations')
      .select('session_id, status')
      .in('session_id', sessionIds);

    // Enrichir les sessions avec les stats
    const enrichedSessions = sessions?.map(session => {
      const regs = allRegs?.filter(r => r.session_id === session.id) || [];
      const winners = regs.filter(r => r.status === 'winner');
      const revenue = regs.length * (session.entry_fee || 0);

      return {
        ...session,
        stats: {
          registrations: regs.length,
          winners: winners.length,
          revenue,
          fillRate: session.max_players ? Math.round((session.current_players / session.max_players) * 100) : 0
        }
      };
    }) || [];

    // Agrégations
    const totals = {
      sessions: enrichedSessions.length,
      players: enrichedSessions.reduce((sum, s) => sum + (s.current_players || 0), 0),
      revenue: enrichedSessions.reduce((sum, s) => sum + (s.stats?.revenue || 0), 0),
      prizePool: enrichedSessions.reduce((sum, s) => sum + (s.prize_pool || 0), 0),
      byStatus: {
        upcoming: enrichedSessions.filter(s => s.status === 'upcoming').length,
        active: enrichedSessions.filter(s => s.status === 'active').length,
        completed: enrichedSessions.filter(s => s.status === 'completed').length,
        cancelled: enrichedSessions.filter(s => s.status === 'cancelled').length
      }
    };

    res.json({
      success: true,
      period,
      totals,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error('❌ Erreur stats sessions:', error);
    res.json({ success: false, error: error.message, sessions: [], totals: {} });
  }
});

module.exports = router;
