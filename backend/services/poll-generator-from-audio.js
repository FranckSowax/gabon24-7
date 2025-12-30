/**
 * 📊 GÉNÉRATEUR DE SONDAGES DEPUIS RÉSUMÉS AUDIO
 * 
 * Analyse les résumés audio de l'actualité du jour
 * et génère automatiquement des questions de sondages pertinentes
 */

const supabaseService = require('../supabase-config');
const geminiService = require('./gemini-service');

/**
 * Analyse le texte du résumé audio et génère des questions de sondage
 * @param {string} summaryText - Texte du résumé audio
 * @param {Array} articles - Articles utilisés pour le résumé
 * @returns {Promise<Array>} - Questions de sondage générées
 */
async function generatePollQuestionsFromSummary(summaryText, articles = []) {
  try {
    console.log('\n📊 GÉNÉRATION DE QUESTIONS DE SONDAGE DEPUIS RÉSUMÉ AUDIO');
    console.log('='.repeat(80));

    if (!summaryText || summaryText.length < 50) {
      throw new Error('Résumé trop court pour générer des questions');
    }

    // Contexte des articles pour enrichir l'analyse
    const articlesContext = articles.slice(0, 10).map((a, idx) => {
      return `${idx + 1}. ${a.title} (${a.category || 'Non catégorisé'})`;
    }).join('\n');

    const prompt = `Tu es un expert en sondages d'opinion sur l'actualité gabonaise. 
    
À partir du résumé audio de l'actualité suivant et de la liste d'articles, génère 3 questions de sondage pertinentes et engageantes.

RÉSUMÉ AUDIO:
${summaryText}

ARTICLES COUVERTS:
${articlesContext}

CONSIGNES:
1. Chaque question doit porter sur un sujet d'actualité DIFFÉRENT mentionné dans le résumé
2. Les questions doivent être formulées de manière neutre et objective
3. Chaque question doit avoir EXACTEMENT 3 options de réponse équilibrées
4. Les questions doivent encourager la réflexion et le débat
5. Privilégier les sujets politiques, économiques ou sociétaux importants
6. Éviter les questions trop techniques ou trop évidentes

FORMAT DE RÉPONSE (JSON strict):
{
  "questions": [
    {
      "question": "Question claire et concise?",
      "category": "Politique|Économie|Social|International|Sport|Culture",
      "options": [
        "Option A",
        "Option B", 
        "Option C"
      ],
      "context": "Brève explication du contexte de la question (1-2 phrases)"
    }
  ]
}

Génère exactement 3 questions au format JSON:`;

    console.log('🤖 Appel à Gemini 3 Pro pour générer les questions...');
    
    // Utiliser Gemini Service
    const parsedQuestions = await geminiService.generateJSON(prompt, {
      systemPrompt: 'Tu es un expert en création de sondages d\'opinion sur l\'actualité. Tu génères toujours des réponses au format JSON valide.',
      temperature: 0.8
    });

    if (!parsedQuestions.questions || !Array.isArray(parsedQuestions.questions)) {
      console.error('❌ Format de réponse invalide');
      return generateDefaultPollQuestions(articles);
    }

    console.log(`✅ ${parsedQuestions.questions.length} questions générées par l'IA`);
    
    // Valider et nettoyer les questions
    const validatedQuestions = parsedQuestions.questions
      .filter(q => q.question && q.options && q.options.length === 3)
      .map(q => ({
        question: q.question.trim(),
        category: q.category || 'Actualité',
        options: q.options.slice(0, 3).map(opt => opt.trim()),
        context: q.context || ''
      }))
      .slice(0, 3); // Maximum 3 questions

    return validatedQuestions;

  } catch (error) {
    console.error('❌ Erreur génération questions:', error.message);
    return generateDefaultPollQuestions(articles);
  }
}

/**
 * Génère des questions de sondage par défaut basées sur les articles
 * @param {Array} articles - Articles de l'actualité
 * @returns {Array} - Questions par défaut
 */
function generateDefaultPollQuestions(articles) {
  console.log('📝 Génération de questions par défaut...');
  
  const questions = [];
  
  // Question 1: Opinion sur l'actualité politique
  const politicalArticles = articles.filter(a => 
    a.category === 'Politique' || 
    (a.title && (
      a.title.toLowerCase().includes('gouvernement') ||
      a.title.toLowerCase().includes('ministre') ||
      a.title.toLowerCase().includes('président')
    ))
  );
  
  if (politicalArticles.length > 0) {
    questions.push({
      question: "Comment évaluez-vous la politique actuelle du gouvernement ?",
      category: "Politique",
      options: [
        "Positif",
        "Neutre",
        "Négatif"
      ],
      context: "Votre avis sur les décisions gouvernementales récentes"
    });
  }
  
  // Question 2: Priorités économiques
  const economyArticles = articles.filter(a => 
    a.category === 'Économie' ||
    (a.title && (
      a.title.toLowerCase().includes('économie') ||
      a.title.toLowerCase().includes('emploi') ||
      a.title.toLowerCase().includes('entreprise')
    ))
  );
  
  if (economyArticles.length > 0) {
    questions.push({
      question: "Quelle devrait être la priorité économique du gouvernement ?",
      category: "Économie",
      options: [
        "Création d'emplois",
        "Soutien aux PME",
        "Diversification économique"
      ],
      context: "Les enjeux économiques actuels du pays"
    });
  }
  
  // Question 3: Confiance dans les médias
  questions.push({
    question: "Quel niveau de confiance accordez-vous aux médias locaux ?",
    category: "Social",
    options: [
      "Confiance",
      "Neutre",
      "Méfiance"
    ],
    context: "Votre perception de l'information médiatique"
  });
  
  return questions.slice(0, 3);
}

/**
 * Sauvegarde les questions de sondage dans Supabase
 * @param {Array} questions - Questions à sauvegarder
 * @param {string} audioSummaryId - ID du résumé audio source
 * @returns {Promise<Object>} - Résultat de la sauvegarde
 */
async function savePollQuestions(questions, audioSummaryId = null) {
  try {
    console.log('\n💾 SAUVEGARDE DES QUESTIONS DE SONDAGE');
    console.log('='.repeat(80));

    const savedPolls = [];
    
    for (const [index, questionData] of questions.entries()) {
      try {
        // Structure adaptée à la table polls existante
        const pollData = {
          question: questionData.question,
          poll_type: 'series', // Type valide dans la contrainte CHECK
          options: questionData.options, // Array JSON
          is_active: true,
          status: 'published', // Status valide
          is_manual: false, // Indique que c'est un sondage automatique
          published_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        };

        const { data: poll, error: pollError } = await supabaseService.supabase
          .from('polls')
          .insert(pollData)
          .select('id, question')
          .single();

        if (pollError) {
          console.error(`❌ Erreur création sondage ${index + 1}:`, pollError.message);
          continue;
        }

        console.log(`✅ Sondage ${index + 1} créé: ${questionData.question.substring(0, 60)}...`);
        console.log(`   📋 Catégorie: ${questionData.category}`);
        console.log(`   ✅ ${questionData.options.length} options`);

        savedPolls.push({
          pollId: poll.id,
          question: questionData.question,
          category: questionData.category,
          optionsCount: questionData.options.length
        });

        // Pause entre chaque sondage
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err) {
        console.error(`❌ Erreur sondage ${index + 1}:`, err.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`📊 RÉSULTAT: ${savedPolls.length}/${questions.length} sondages créés`);
    
    return {
      success: savedPolls.length > 0,
      created: savedPolls.length,
      total: questions.length,
      polls: savedPolls
    };

  } catch (error) {
    console.error('❌ Erreur sauvegarde:', error.message);
    return {
      success: false,
      created: 0,
      error: error.message
    };
  }
}

/**
 * Génère des sondages depuis le dernier résumé audio quotidien
 * @returns {Promise<Object>} - Résultat de la génération
 */
async function generatePollsFromLatestAudioSummary() {
  try {
    console.log('\n🎯 GÉNÉRATION DE SONDAGES DEPUIS LE DERNIER RÉSUMÉ AUDIO');
    console.log('='.repeat(80));

    // Récupérer le dernier résumé audio quotidien réussi
    const { data: summary, error: summaryError } = await supabaseService.supabase
      .from('audio_summaries')
      .select('id, text_summary, article_ids, created_at')
      .eq('summary_type', 'daily')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (summaryError || !summary) {
      console.log('⚠️  Aucun résumé audio quotidien trouvé');
      return { success: false, error: 'Aucun résumé disponible' };
    }

    console.log(`📄 Résumé trouvé: ${summary.id}`);
    console.log(`📅 Date: ${new Date(summary.created_at).toLocaleString('fr-FR')}`);
    console.log(`📰 Articles: ${summary.article_ids?.length || 0}`);

    // Récupérer les articles associés
    let articles = [];
    if (summary.article_ids && summary.article_ids.length > 0) {
      const { data: articlesData } = await supabaseService.supabase
        .from('articles')
        .select('id, title, category, summary, ai_summary')
        .in('id', summary.article_ids)
        .limit(20);
      
      articles = articlesData || [];
      console.log(`✅ ${articles.length} articles récupérés`);
    }

    // Générer les questions
    const questions = await generatePollQuestionsFromSummary(
      summary.text_summary,
      articles
    );

    if (!questions || questions.length === 0) {
      return { success: false, error: 'Aucune question générée' };
    }

    console.log(`\n📊 ${questions.length} questions générées:`);
    questions.forEach((q, i) => {
      console.log(`\n${i + 1}. ${q.question}`);
      console.log(`   Catégorie: ${q.category}`);
      console.log(`   Options: ${q.options.length}`);
    });

    // Sauvegarder les sondages
    const result = await savePollQuestions(questions, summary.id);

    return result;

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Désactive les anciens sondages automatiques (plus de 2 jours)
 */
async function deactivateOldAutoPpolls() {
  try {
    console.log('\n🧹 Désactivation des anciens sondages automatiques...');
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const { data, error } = await supabaseService.supabase
      .from('polls')
      .update({ is_active: false, status: 'closed' })
      .eq('is_manual', false)
      .lt('created_at', twoDaysAgo.toISOString());

    if (error) {
      console.error('❌ Erreur désactivation anciens sondages:', error.message);
    } else {
      console.log('✅ Anciens sondages automatiques désactivés');
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Exécuter si lancé directement
if (require.main === module) {
  generatePollsFromLatestAudioSummary()
    .then((result) => {
      console.log('\n✅ Terminé !\n');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('❌', err);
      process.exit(1);
    });
}

module.exports = {
  generatePollQuestionsFromSummary,
  savePollQuestions,
  generatePollsFromLatestAudioSummary,
  deactivateOldAutoPpolls
};
