const { createClient } = require('@supabase/supabase-js');
const { callGPT5NanoWithFallback, calculateCost } = require('./utils/replicate-gpt5-helper');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const replicateToken = process.env.REPLICATE_API_TOKEN;
const openaiApiKey = process.env.OPENAI_API_KEY;

console.log('🔍 Daily Poll - Environment check:');
console.log('REPLICATE_API_TOKEN:', replicateToken ? 'SET' : 'MISSING');
console.log('OPENAI_API_KEY:', openaiApiKey ? 'SET (fallback)' : 'MISSING');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
}
if (!replicateToken && !openaiApiKey) {
  console.error('❌ Aucune clé API IA disponible');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Analyser les actualités du jour pour extraire les thèmes principaux
 */
async function analyzeNewsTopics() {
  try {
    console.log('📰 Récupération des articles du jour...');
    
    // Récupérer les 30 derniers articles (plus pertinent que la fenêtre 24h)
    const { data: articles, error } = await supabase
      .from('articles')
      .select('title, summary, category, source, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(30);

    if (error) {
      console.error('❌ Erreur récupération articles:', error);
      return null;
    }

    if (!articles || articles.length === 0) {
      console.log('⚠️ Aucun article trouvé pour les dernières 24h');
      return null;
    }

    console.log(`📊 ${articles.length} articles analysés (30 derniers)`);

    // Créer un résumé des actualités
    const newsContext = {
      total_articles: articles.length,
      categories: [...new Set(articles.map(a => a.category))],
      sources: [...new Set(articles.map(a => a.source))],
      headlines: articles.slice(0, 10).map(a => ({
        title: a.title,
        summary: a.summary?.substring(0, 200) + '...',
        category: a.category
      }))
    };

    return newsContext;
  } catch (error) {
    console.error('❌ Erreur analyse actualités:', error);
    return null;
  }
}

/**
 * Générer des questions de sondage avec OpenAI
 */
async function generatePollQuestions(newsContext) {
  try {
    console.log('🤖 Génération des questions avec OpenAI...');
    
    const prompt = `Tu es un expert en sondages d'opinion sur les actualités gabonaises.

Contexte synthétique des 30 derniers articles au Gabon :
- Total: ${newsContext.total_articles}
- Catégories: ${newsContext.categories.join(', ')}
- Titres récents:
${newsContext.headlines.map(h => `  • ${h.title} (${h.category})`).join('\n')}

Objectif: Générer UN sondage de type "série" (3 à 5 questions) pour le public gabonais, STRICTEMENT:
- Non politique, neutre et objectif (ne JAMAIS mettre en difficulté le gouvernement ni citer des responsables politiques ou individus)
- Basé sur les FAITS d'actualité gabonaise (services publics, éducation, santé, emploi, infrastructures, environnement, sécurité routière, économie quotidienne)
- Langage simple, court, accessible, sans polémique
- Types de questions: "mcq" (3-4 options concises) et/ou "yes_no"

Format de réponse JSON strict:
{
  "title": "Titre court et neutre du sondage",
  "description": "Description très courte et factuelle",
  "questions": [
    { "question": "...", "type": "mcq", "options": ["...","...","..."] },
    { "question": "...", "type": "yes_no" }
  ]
}

Contraintes supplémentaires:
- 3 à 5 questions maximum
- Aucune attaque, aucune opinion partisane, pas de jugement sur l'action du gouvernement
- Si 'mcq', fournir 3 à 4 options factuelles et distinctes
- Pas de contenu sensible, pas de diffamation, rester informatif et constructif`;

    console.log('🚀 Calling GPT-5 Nano for poll generation...');
    
    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Tu es un expert en sondages d\'opinion sur les actualités gabonaises. Génère des sondages neutres et objectifs.',
      maxTokens: 600,
      temperature: 0.7,
      returnJSON: true,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    });
    
    console.log('✅ Poll generated');
    console.log('📊 Provider:', result.provider);
    const cost = calculateCost(result.usage, result.provider, result.model);
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`);
    
    return result.content;
    
  } catch (error) {
    console.error('❌ Erreur génération OpenAI:', error);
    
    // Fallback avec des questions par défaut
    return {
      title: "Sondage du Jour",
      description: "Votre opinion sur des sujets factuels et neutres",
      questions: [
        {
          question: "Quelle priorité quotidienne est la plus importante pour améliorer la vie des citoyens ?",
          type: "mcq",
          options: ["Accès aux soins", "Qualité de l'éducation", "Emploi/entrepreneuriat", "Transports et routes"]
        },
        {
          question: "Êtes-vous satisfait de l'état général de la propreté dans votre quartier ?",
          type: "yes_no"
        },
        {
          question: "Quel service public devrait être renforcé en premier ?",
          type: "mcq",
          options: ["Eau potable", "Électricité", "Gestion des déchets"]
        },
        {
          question: "Pensez-vous que la sécurité routière s'est améliorée ces dernières semaines ?",
          type: "yes_no"
        }
      ],
      duration_hours: 24
    };
  }
}

/**
 * Sauvegarder le sondage dans la base de données
 */
async function savePollToDatabase(pollData) {
  try {
    console.log('💾 Sauvegarde du sondage (série) idempotente...');

    // Calculer heures cibles en UTC pour l'Afrique centrale (Gabon UTC+1)
    const now = new Date();
    // Publication du jour à 20:00 locale = 19:00 UTC
    let publishAtUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 19, 0, 0, 0));
    // Expiration le lendemain à 19:55 locale = 18:55 UTC
    let expiresAtUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 18, 55, 0, 0));
    // forcer expiration au lendemain
    expiresAtUtc = new Date(expiresAtUtc.getTime() + 24 * 60 * 60 * 1000);

    // Idempotence: s'il existe déjà un sondage "series" non manuel planifié aujourd'hui
    const startOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString();
    const endOfDayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();
    const { data: existingToday } = await supabase
      .from('polls')
      .select('id')
      .eq('poll_type', 'series')
      .eq('is_manual', false)
      .gte('scheduled_publish_at', startOfDayUtc)
      .lte('scheduled_publish_at', endOfDayUtc)
      .limit(1);
    if (existingToday && existingToday.length > 0) {
      console.log('ℹ️ Sondage "series" déjà préparé pour aujourd\'hui, skip génération');
      return existingToday;
    }

    // Créer 1 poll parent de type "series" (brouillon, publication programmée)
    const seriesTitle = pollData.title || 'Sondage du jour';
    const { data: seriesPoll, error: seriesErr } = await supabase
      .from('polls')
      .insert({
        question: seriesTitle,
        poll_type: 'series',
        options: [],
        expires_at: expiresAtUtc.toISOString(),
        status: 'draft',
        scheduled_publish_at: publishAtUtc.toISOString(),
        is_active: false,
        is_manual: false,
        total_votes: 0
      })
      .select()
      .single();

    if (seriesErr) {
      console.error('❌ Erreur création poll série:', seriesErr);
      return null;
    }

    // Insérer les 3 à 5 questions dans poll_questions
    const questions = Array.isArray(pollData.questions) ? pollData.questions.slice(0, 5) : [];
    const sanitizedQuestions = questions.map((q, idx) => ({
      poll_id: seriesPoll.id,
      question_text: String(q.question || '').trim().slice(0, 240),
      question_type: q.type === 'yes_no' ? 'yes_no' : 'mcq',
      options: q.type === 'mcq' && Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      question_order: idx + 1
    })).filter(q => q.question_text);

    if (sanitizedQuestions.length === 0) {
      console.warn('⚠️ Aucune question valide, suppression du poll créé');
      await supabase.from('polls').delete().eq('id', seriesPoll.id);
      return null;
    }

    await supabase.from('poll_questions').insert(sanitizedQuestions);

    return [seriesPoll];
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde sondage:', error);
    return null;
  }
}

/**
 * Fonction principale
 */
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🗳️ Début génération sondage quotidien...');
    
    // Vérification des variables d'environnement
    if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Configuration manquante'
        })
      };
    }

    // 1. Analyser les actualités
    const newsContext = await analyzeNewsTopics();
    if (!newsContext) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Impossible d\'analyser les actualités'
        })
      };
    }

    // 2. Générer les questions
    const pollData = await generatePollQuestions(newsContext);
    if (!pollData || !pollData.questions || pollData.questions.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Impossible de générer les questions'
        })
      };
    }

    // 3. Sauvegarder en base
    const savedPolls = await savePollToDatabase(pollData);
    if (!savedPolls || savedPolls.length === 0) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Impossible de sauvegarder le sondage'
        })
      };
    }

    console.log(`✅ Sondage quotidien généré avec ${savedPolls.length} questions`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Sondage quotidien généré avec succès`,
        data: {
          title: pollData.title,
          questions_count: savedPolls.length,
          polls: savedPolls.map(p => ({
            id: p.id,
            question: p.question,
            type: p.poll_type,
            expires_at: p.expires_at
          }))
        }
      })
    };

  } catch (error) {
    console.error('❌ Erreur génération sondage:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la génération du sondage',
        details: error.message
      })
    };
  }
};
