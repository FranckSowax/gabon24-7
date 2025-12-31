const supabaseService = require('../supabase-config');
const geminiService = require('./gemini-service');

class GameQuestionGenerator {
  constructor() {
    // Service Gemini injecté directement
    // Modèle dédié pour le quiz (éviter les quotas du modèle principal)
    this.quizModel = 'gemini-2.5-flash';
    // Objectif quotidien de questions (150 pour avoir assez pour Training + Payantes)
    this.dailyTarget = 150;
    // Durée de vie des questions (72h)
    this.questionLifespanHours = 72;
    // Distribution cible des difficultés (sur 150 questions)
    this.difficultyDistribution = {
      'Facile': 50,      // ~33% faciles
      'Moyen': 60,       // ~40% moyennes
      'Difficile': 40    // ~27% difficiles
    };
    // Types de questions: training (gratuites) vs paid (sessions payantes)
    this.questionTypes = ['training', 'paid'];
  }

  /**
   * Génère un hash simple d'une question pour détecter les doublons
   */
  generateQuestionHash(questionText) {
    // Normaliser: minuscules, supprimer ponctuation et espaces multiples
    const normalized = questionText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Prendre les 100 premiers caractères pour le hash
    return normalized.substring(0, 100);
  }

  /**
   * Vérifie si une question similaire existe déjà
   */
  async isDuplicateQuestion(questionText) {
    try {
      const hash = this.generateQuestionHash(questionText);

      // Chercher des questions récentes avec un texte similaire
      const { data, error } = await supabaseService.supabase
        .from('game_questions')
        .select('question_text')
        .limit(500); // Vérifier les 500 dernières questions

      if (error || !data) return false;

      // Comparer les hashs
      for (const existing of data) {
        const existingHash = this.generateQuestionHash(existing.question_text || '');
        // Si les 50 premiers caractères sont identiques, c'est probablement un doublon
        if (existingHash.substring(0, 50) === hash.substring(0, 50)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Erreur vérification doublon:', error.message);
      return false; // En cas d'erreur, on laisse passer
    }
  }

  /**
   * Compte les questions par difficulté pour aujourd'hui
   */
  async getTodayDifficultyStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = { 'Facile': 0, 'Moyen': 0, 'Difficile': 0 };

      for (const difficulty of Object.keys(stats)) {
        const { count, error } = await supabaseService.supabase
          .from('game_questions')
          .select('*', { count: 'exact', head: true })
          .eq('difficulty', difficulty)
          .gte('created_at', today.toISOString());

        if (!error) {
          stats[difficulty] = count || 0;
        }
      }

      return stats;
    } catch (error) {
      console.error('❌ Erreur stats difficultés:', error.message);
      return { 'Facile': 0, 'Moyen': 0, 'Difficile': 0 };
    }
  }

  /**
   * Détermine quelles difficultés sont nécessaires selon la distribution cible
   */
  async getNeededDifficulties() {
    const stats = await this.getTodayDifficultyStats();
    const needed = [];

    for (const [difficulty, target] of Object.entries(this.difficultyDistribution)) {
      const current = stats[difficulty] || 0;
      const missing = Math.max(0, target - current);
      if (missing > 0) {
        needed.push({ difficulty, missing, current, target });
      }
    }

    // Trier par manque (le plus manquant en premier)
    needed.sort((a, b) => b.missing - a.missing);

    console.log('📊 Distribution actuelle:', stats);
    console.log('📊 Difficultés manquantes:', needed.map(n => `${n.difficulty}: ${n.missing}`).join(', '));

    return needed;
  }

  /**
   * Supprime les questions de plus de 72 heures
   */
  async deleteOldQuestions() {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - this.questionLifespanHours);

      const { data, error } = await supabaseService.supabase
        .from('game_questions')
        .delete()
        .lt('created_at', cutoffTime.toISOString())
        .select('id');

      if (error) {
        console.error('❌ Erreur suppression anciennes questions:', error.message);
        return 0;
      }

      const count = data?.length || 0;
      console.log(`🗑️ ${count} questions de plus de ${this.questionLifespanHours}h supprimées`);
      return count;
    } catch (error) {
      console.error('❌ Erreur deleteOldQuestions:', error.message);
      return 0;
    }
  }

  /**
   * Compte les questions générées aujourd'hui
   */
  async getTodayQuestionsCount() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabaseService.supabase
        .from('game_questions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('❌ Erreur comptage questions du jour:', error.message);
      return 0;
    }
  }

  async generateDailyQuestions(hoursLookback = 36) {
    console.log(`🚀 Démarrage génération questions jeu (lookback: ${hoursLookback}h) avec ${this.quizModel}...`);
    console.log(`🎯 Objectif: ${this.dailyTarget} questions/jour`);

    // 0. D'abord, supprimer les questions de plus de 72h
    await this.deleteOldQuestions();

    // 1. Vérifier combien de questions on a déjà générées aujourd'hui
    const todayCount = await this.getTodayQuestionsCount();
    const remaining = Math.max(0, this.dailyTarget - todayCount);

    if (remaining === 0) {
      console.log(`✅ Objectif quotidien atteint (${todayCount}/${this.dailyTarget}). Pas de génération nécessaire.`);
      return 0;
    }

    console.log(`📊 Questions aujourd'hui: ${todayCount}/${this.dailyTarget}. Besoin de ${remaining} supplémentaires.`);

    // 1.5 Analyser la distribution des difficultés nécessaires
    const neededDifficulties = await this.getNeededDifficulties();

    // 2. Récupérer les articles des dernières X heures
    const now = new Date();
    const pastTime = new Date(now.getTime() - (hoursLookback * 60 * 60 * 1000));

    // Calculer combien d'articles récupérer (3 questions par article en moyenne)
    const articlesNeeded = Math.ceil(remaining / 3) + 5; // +5 marge de sécurité

    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary, content, url, category')
      .gt('published_at', pastTime.toISOString())
      .order('published_at', { ascending: false })
      .limit(articlesNeeded);

    if (error) {
      console.log('⚠️ Erreur récupération articles:', error);
      return 0;
    }

    if (!articles || articles.length === 0) {
      console.log('⚠️ Pas d\'articles récents (< 36h) trouvés.');
      return 0;
    }

    console.log(`📝 ${articles.length} articles récents trouvés.`);
    let totalGenerated = 0;
    let duplicatesSkipped = 0;

    for (const article of articles) {
      // Vérifier si on a atteint l'objectif
      if (totalGenerated >= remaining) {
        console.log(`✅ Objectif atteint (${totalGenerated} questions générées)`);
        break;
      }

      // Générer les questions via IA avec les difficultés nécessaires
      const questions = await this.generateQuestionsForArticle(article, neededDifficulties);

      if (questions && questions.length > 0) {
        for (const q of questions) {
          // Vérifier les doublons avant de sauvegarder
          const isDuplicate = await this.isDuplicateQuestion(q.question);
          if (isDuplicate) {
            console.log(`⏭️ Doublon détecté, question ignorée: ${q.question.substring(0, 40)}...`);
            duplicatesSkipped++;
            continue;
          }

          const saved = await this.saveQuestion(q);
          if (saved) {
            totalGenerated++;
          }
        }
      }

      // Petit délai pour éviter le rate limit si on boucle vite
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ Génération terminée. ${totalGenerated} questions créées, ${duplicatesSkipped} doublons évités.`);
    return totalGenerated;
  }

  async generateQuestionsForArticle(article, neededDifficulties = []) {
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️ Gemini API Key manquante, génération mock pour:', article.title);
      return this.generateMockQuestions(article);
    }

    try {
      console.log(`🤖 Génération questions (${this.quizModel}) pour: ${article.title}`);

      // Déterminer quelles difficultés générer selon les besoins
      let difficultiesToGenerate = ['Facile', 'Moyen', 'Difficile'];
      if (neededDifficulties.length > 0) {
        // Prioriser les difficultés les plus manquantes
        difficultiesToGenerate = neededDifficulties.slice(0, 3).map(d => d.difficulty);
        // S'assurer qu'on a au moins une de chaque si possible
        if (!difficultiesToGenerate.includes('Facile') && neededDifficulties.some(d => d.difficulty === 'Facile')) {
          difficultiesToGenerate.push('Facile');
        }
      }

      const difficultiesStr = difficultiesToGenerate.join(', ');

      const prompt = `
Tu es un expert en création de quiz sur l'actualité gabonaise.
Génère exactement 3 questions de quiz (QCM) UNIQUES et ORIGINALES basées sur cet article.

📰 ARTICLE:
Titre: ${article.title}
Résumé: ${article.summary || (article.content ? article.content.substring(0, 600) : '')}

🎯 DIFFICULTÉS REQUISES: ${difficultiesStr}
- Facile: Question générale, réponse évidente dans le titre/résumé
- Moyen: Question sur un détail spécifique, nécessite lecture attentive
- Difficile: Question sur un chiffre précis, une date, un nom complet, un détail technique

📋 FORMAT JSON STRICT:
{
  "questions": [
    {
      "question": "Question complète et autonome ?",
      "answers": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
      "correct_index": 0,
      "difficulty": "Facile"
    }
  ]
}

⚠️ RÈGLES OBLIGATOIRES:
1. UNICITÉ: Chaque question doit être TOTALEMENT DIFFÉRENTE des autres (sujet, angle, formulation)
2. AUTONOMIE: Le joueur n'a PAS lu l'article. Inclure TOUT le contexte dans la question
3. INTERDIT: "Selon l'article", "Dans ce texte", "D'après le titre", "Mentionné ci-dessus"
4. CONTEXTE: Toujours commencer par situer (lieu, personne, événement). Ex: "Au Gabon, le ministre X a annoncé..."
5. VARIÉTÉ:
   - Question 1: Qui/Quoi (personne, organisation, sujet principal)
   - Question 2: Où/Quand/Comment (lieu, date, méthode)
   - Question 3: Pourquoi/Combien (raison, chiffre, conséquence)
6. RÉPONSES: 4 réponses plausibles, une seule correcte. Les mauvaises réponses doivent être crédibles.
7. LANGUE: Tout en français correct
8. LONGUEUR: Questions de 15-40 mots maximum
`;

      // Utilisation du service Gemini avec modèle dédié (gemini-2.5-flash)
      const parsed = await geminiService.generateJSON(prompt, {
        temperature: 0.8, // Un peu plus de créativité pour éviter les répétitions
        model: this.quizModel
      });

      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        console.error('Format JSON invalide reçu de Gemini:', JSON.stringify(parsed));
        return [];
      }

      // Valider et filtrer les questions
      const validQuestions = parsed.questions.filter(q => {
        if (!q.question || !q.answers || q.correct_index === undefined) return false;
        if (q.answers.length !== 4) return false;
        // Vérifier que la question ne contient pas de références à l'article
        const forbidden = ['selon l\'article', 'dans ce texte', 'd\'après le titre', 'ci-dessus', 'mentionné'];
        const lowerQ = q.question.toLowerCase();
        return !forbidden.some(f => lowerQ.includes(f));
      });

      // Ajouter les métadonnées
      return validQuestions.map(q => ({
        ...q,
        source_url: article.url,
        source_title: article.title,
        category: article.category
      }));

    } catch (error) {
      console.error('❌ Erreur génération questions Gemini:', error.message);
      return [];
    }
  }

  generateMockQuestions(article) {
    // Générateur de fallback pour tester sans payer OpenAI
    // Utilise le titre pour faire des questions semi-dynamiques
    const titleWords = article.title.split(' ');
    const keyword = titleWords.length > 3 ? titleWords[2] : 'Sujet';
    
    return [
      {
        question: `Dans l'actualité récente concernant "${keyword}", de quoi parle l'article "${article.title.substring(0, 20)}..." ?`,
        answers: ["D'économie", "De politique", "De sport", "De culture"],
        correct_index: 0, // Mock, on suppose le premier
        difficulty: "Facile",
        source_url: article.url,
        source_title: article.title,
        category: article.category
      },
      {
        question: `Selon l'article sur ${keyword}, quel est le point clé ?`,
        answers: ["Option A", "Option B", "Option C", "Option D"],
        correct_index: 1,
        difficulty: "Moyen",
        source_url: article.url,
        source_title: article.title,
        category: article.category
      },
      {
        question: `Détail technique sur ${keyword} ?`,
        answers: ["10%", "20%", "30%", "40%"],
        correct_index: 2,
        difficulty: "Difficile",
        source_url: article.url,
        source_title: article.title,
        category: article.category
      }
    ];
  }

  async saveQuestion(questionData, questionType = null) {
    // Validation basique
    if (!questionData.question || !questionData.answers || questionData.correct_index === undefined) {
      return false;
    }

    // Normaliser la difficulté
    let difficulty = questionData.difficulty;
    const validDiffs = ['Facile', 'Moyen', 'Difficile'];
    if (!validDiffs.includes(difficulty)) {
      // Mapper Expert vers Difficile
      if (difficulty === 'Expert') {
        difficulty = 'Difficile';
      } else {
        difficulty = 'Moyen'; // Fallback
      }
    }

    // Assigner un type de question (training ou paid) aléatoirement si non spécifié
    // Distribution: 40% training, 60% paid (les sessions payantes ont besoin de plus de variété)
    const type = questionType || (Math.random() < 0.4 ? 'training' : 'paid');

    const { error } = await supabaseService.supabase
      .from('game_questions')
      .insert([{
        question_text: questionData.question,
        answers: questionData.answers,
        correct_answer_index: questionData.correct_index,
        difficulty: difficulty,
        category: questionData.category,
        question_type: type
        // source_url: questionData.source_url,
        // source_title: questionData.source_title,
        // used_count: 0
      }]);

    if (error) {
      console.error('Erreur sauvegarde question:', error.message);
      return false;
    }

    console.log(`💾 [${difficulty}/${type}] Question sauvegardée: ${questionData.question.substring(0, 40)}...`);
    return true;
  }

  /**
   * Compte le nombre de questions jamais utilisées
   */
  async getUnusedCount() {
    try {
      const { count, error } = await supabaseService.supabase
        .from('game_questions')
        .select('*', { count: 'exact', head: true })
        .eq('used_count', 0);
        
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('❌ Erreur comptage questions:', error.message);
      return 0;
    }
  }

  /**
   * Vérifie si le pool est suffisant et recharge si nécessaire
   * @param {number} minThreshold - Seuil minimum de questions neuves
   */
  async checkAndRefill(minThreshold = 50) {
    console.log('🔍 [AUTO-REFILL] Vérification du pool de questions...');
    const unusedCount = await this.getUnusedCount();
    console.log(`📊 Questions neuves disponibles : ${unusedCount} (Seuil: ${minThreshold})`);
    
    if (unusedCount < minThreshold) {
      console.log('⚠️ Pool faible ! Lancement d\'une recharge d\'urgence...');
      // On élargit la recherche à 72h pour trouver plus de matière
      await this.generateDailyQuestions(72);
    } else {
      console.log('✅ Pool suffisant.');
    }
  }
}

module.exports = new GameQuestionGenerator();
