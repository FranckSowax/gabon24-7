const supabaseService = require('../supabase-config');
const geminiService = require('./gemini-service');

class GameQuestionGenerator {
  constructor() {
    // Service Gemini injecté directement
  }

  async generateDailyQuestions(hoursLookback = 36) {
    console.log(`🚀 Démarrage génération questions jeu (lookback: ${hoursLookback}h) avec Gemini 3...`);
    
    // 1. Récupérer les articles des dernières X heures
    const now = new Date();
    const pastTime = new Date(now.getTime() - (hoursLookback * 60 * 60 * 1000));
    
    // Récupérer plus d'articles pour atteindre l'objectif de ~100 questions
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary, content, url, category')
      .gt('published_at', pastTime.toISOString())
      .order('published_at', { ascending: false })
      .limit(40); // 40 articles * 3 questions = ~120 questions
      
    if (error) {
      console.log('⚠️ Erreur récupération articles:', error);
      return;
    }
    
    if (!articles || articles.length === 0) {
      console.log('⚠️ Pas d\'articles récents (< 36h) trouvés.');
      return;
    }

    console.log(`📝 ${articles.length} articles récents trouvés.`);
    let totalGenerated = 0;

    for (const article of articles) {
      // Générer les questions via IA
      const questions = await this.generateQuestionsForArticle(article);
      
      if (questions && questions.length > 0) {
        for (const q of questions) {
          await this.saveQuestion(q);
          totalGenerated++;
        }
      }
      
      // Petit délai pour éviter le rate limit si on boucle vite
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ Génération terminée. ${totalGenerated} questions créées.`);
    return totalGenerated;
  }

  async generateQuestionsForArticle(article) {
    if (!process.env.GEMINI_API_KEY) {
      console.log('⚠️ Gemini API Key manquante, génération mock pour:', article.title);
      return this.generateMockQuestions(article);
    }

    try {
      console.log(`🤖 Génération questions Gemini pour: ${article.title}`);
      
      const prompt = `
        Tu es un expert en création de quiz sur l'actualité.
        Génère 3 questions de quiz (QCM) basées sur cet article d'actualité.
        
        Niveaux requis :
        1. Facile (Grand public)
        2. Moyen (Lecteur attentif)
        3. Difficile (Expert du sujet)

        Article: ${article.title}
        Résumé: ${article.summary || (article.content ? article.content.substring(0, 500) : '')}...
        
        Format de réponse attendu : UN SEUL objet JSON contenant un tableau "questions".
        Exemple :
        {
          "questions": [
            {
              "question": "Question ?",
              "answers": ["Reponse 1", "Reponse 2", "Reponse 3", "Reponse 4"],
              "correct_index": 0,
              "difficulty": "Facile"
            }
          ]
        }
        
        Règles CRITIQUES de rédaction :
        1. AUTONOMIE TOTALE : Le joueur n'a PAS lu l'article. La question doit contenir tout le contexte nécessaire (lieu, personnes, événement).
        2. INTERDIT : Ne JAMAIS utiliser "Selon l'article", "Dans ce texte", "D'après le titre", "Ci-dessus".
        3. PRÉCISION : Commence par situer le contexte. Ex: "Au Gabon, lors de la visite du Président X...", "Concernant le projet de route Y..."
        4. Les réponses doivent être en français.
        5. La bonne réponse doit être à l'index indiqué par correct_index.
        6. Les mauvaises réponses doivent être plausibles mais fausses.
      `;

      // Utilisation du service Gemini
      const parsed = await geminiService.generateJSON(prompt, {
        temperature: 0.7
      });
      
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        console.error('Format JSON invalide reçu de Gemini:', JSON.stringify(parsed));
        return [];
      }

      // Ajouter les métadonnées
      return parsed.questions.map(q => ({
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

  async saveQuestion(questionData) {
    // Validation basique
    if (!questionData.question || !questionData.answers || questionData.correct_index === undefined) {
      return;
    }

    // Normaliser la difficulté
    let difficulty = questionData.difficulty;
    const validDiffs = ['Facile', 'Moyen', 'Difficile', 'Expert'];
    if (!validDiffs.includes(difficulty)) {
      difficulty = 'Moyen'; // Fallback
    }

    const { error } = await supabaseService.supabase
      .from('game_questions')
      .insert([{
        question_text: questionData.question,
        answers: questionData.answers,
        correct_answer_index: questionData.correct_index,
        difficulty: difficulty,
        category: questionData.category,
        // source_url: questionData.source_url,
        // source_title: questionData.source_title,
        // used_count: 0
      }]);
      
    if (error) console.error('Erreur sauvegarde question:', error.message);
    else console.log('💾 Question sauvegardée:', questionData.question.substring(0, 30) + '...');
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
