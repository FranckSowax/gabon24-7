const { createClient } = require('@supabase/supabase-js');
const { callGPT5NanoWithFallback, calculateCost } = require('./utils/replicate-gpt5-helper');

console.log('🔍 Contextual Poll - Environment check:');
console.log('REPLICATE_API_TOKEN:', process.env.REPLICATE_API_TOKEN ? 'SET' : 'MISSING');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET (fallback)' : 'MISSING');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Générer un sondage basé sur les actualités récentes de la homepage
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
    console.log('🗳️ Génération sondage contextuel basé sur actualités...');

    // 1. Récupérer les articles récents via l'API homepage
    const articlesResponse = await fetch('https://gabon24-7.netlify.app/.netlify/functions/homepage-articles-new');
    
    if (!articlesResponse.ok) {
      throw new Error('Impossible de récupérer les articles');
    }

    const { articles } = await articlesResponse.json();
    
    if (!articles || articles.length === 0) {
      throw new Error('Aucun article trouvé');
    }

    console.log(`📰 ${articles.length} articles analysés`);

    // 2. Analyser les thèmes principaux
    const themes = analyzeArticleThemes(articles.slice(0, 15));
    console.log('🎯 Thèmes identifiés:', themes);

    // 3. Générer le sondage avec OpenAI
    const pollData = await generatePollWithAI(themes, articles.slice(0, 10));
    
    if (!pollData) {
      throw new Error('Impossible de générer le sondage');
    }

    // 4. Sauvegarder en base
    const savedPoll = await savePollToDatabase(pollData);
    
    if (!savedPoll) {
      throw new Error('Impossible de sauvegarder le sondage');
    }

    console.log('✅ Sondage contextuel généré et publié');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Sondage généré avec succès basé sur l\'actualité',
        data: {
          poll_id: savedPoll.id,
          question: savedPoll.question,
          type: savedPoll.poll_type,
          options: savedPoll.options,
          themes_analyzed: themes,
          articles_count: articles.length
        }
      })
    };

  } catch (error) {
    console.error('❌ Erreur génération sondage contextuel:', error);
    
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

/**
 * Analyser les thèmes principaux des articles
 */
function analyzeArticleThemes(articles) {
  const themes = {
    sport: 0,
    politique: 0,
    economie: 0,
    social: 0,
    international: 0,
    culture: 0
  };

  const sportKeywords = ['football', 'sport', 'match', 'équipe', 'joueur', 'contrat', 'but', 'ligue'];
  const politiqueKeywords = ['maire', 'élection', 'campagne', 'politique', 'gouvernement', 'ministre', 'arrondissement'];
  const economieKeywords = ['économie', 'entreprise', 'emploi', 'business', 'investissement', 'marché'];
  const socialKeywords = ['santé', 'éducation', 'société', 'social', 'famille', 'jeunesse'];
  const internationalKeywords = ['international', 'monde', 'pays', 'chypre', 'turquie', 'tunisie', 'france'];
  const cultureKeywords = ['culture', 'art', 'musique', 'festival', 'tradition'];

  articles.forEach(article => {
    const text = (article.title + ' ' + article.summary).toLowerCase();
    
    if (sportKeywords.some(keyword => text.includes(keyword))) themes.sport++;
    if (politiqueKeywords.some(keyword => text.includes(keyword))) themes.politique++;
    if (economieKeywords.some(keyword => text.includes(keyword))) themes.economie++;
    if (socialKeywords.some(keyword => text.includes(keyword))) themes.social++;
    if (internationalKeywords.some(keyword => text.includes(keyword))) themes.international++;
    if (cultureKeywords.some(keyword => text.includes(keyword))) themes.culture++;
  });

  return themes;
}

/**
 * Générer le sondage avec OpenAI
 */
async function generatePollWithAI(themes, articles) {
  try {
    // Identifier le thème dominant
    const dominantTheme = Object.keys(themes).reduce((a, b) => themes[a] > themes[b] ? a : b);
    
    // Créer le contexte pour OpenAI
    const headlines = articles.slice(0, 8).map(a => `• ${a.title}`).join('\n');
    
    const prompt = `Tu es un expert en sondages d'opinion gabonais. 

Actualités récentes au Gabon :
${headlines}

Thème dominant identifié : ${dominantTheme}
Distribution des thèmes : ${JSON.stringify(themes)}

Génère UN sondage pertinent et engageant pour les citoyens gabonais basé sur ces actualités récentes. Le sondage doit :
- Être directement lié aux actualités du jour
- Avoir UNE question principale avec 3-4 options de réponse
- Être neutre et objectif
- Encourager la participation citoyenne
- Utiliser un langage accessible

Format JSON strict :
{
  "question": "Question principale claire et directe ?",
  "type": "mcq",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "context": "Brève explication du contexte"
}

Exemples selon le thème dominant :
- Sport : Opinion sur les performances des joueurs gabonais à l'étranger
- Politique : Attentes vis-à-vis des candidats aux élections locales  
- Économie : Priorités pour le développement économique
- Social : Enjeux de société prioritaires`;

    console.log('🚀 Calling GPT-5 Nano for contextual poll...');
    
    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Tu es un expert en sondages d\'opinion au Gabon. Réponds uniquement en JSON valide.',
      maxTokens: 800,
      temperature: 0.7,
      returnJSON: true,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    });
    
    console.log('✅ Contextual poll generated');
    console.log('📊 Provider:', result.provider);
    const cost = calculateCost(result.usage, result.provider, result.model);
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`);
    
    console.log('✅ Sondage généré par IA:', result.content.question);
    return result.content;
    
  } catch (error) {
    console.error('❌ Erreur génération IA:', error);
    return getFallbackPoll(themes);
  }
}

/**
 * Sondage de fallback selon le thème dominant
 */
function getFallbackPoll(dominantTheme) {
  const fallbacks = {
    sport: {
      question: "Que pensez-vous des performances des footballeurs gabonais évoluant à l'étranger ?",
      type: "mcq",
      options: [
        "Excellentes, ils font honneur au Gabon",
        "Bonnes mais peuvent mieux faire", 
        "Moyennes, il faut plus de soutien",
        "Décevantes par rapport aux attentes"
      ],
      context: "Suite aux actualités sur les joueurs gabonais en Europe"
    },
    politique: {
      question: "Quelle qualité recherchez-vous en priorité chez un candidat aux élections locales ?",
      type: "mcq", 
      options: [
        "Expérience et compétence",
        "Proximité avec les citoyens",
        "Programme de développement",
        "Intégrité et transparence"
      ],
      context: "En période de campagne électorale"
    },
    default: {
      question: "Quelle priorité devrait avoir le Gabon actuellement ?",
      type: "mcq",
      options: [
        "Développement économique",
        "Amélioration des services publics",
        "Formation de la jeunesse", 
        "Infrastructure et transport"
      ],
      context: "Basé sur l'actualité générale"
    }
  };

  return fallbacks[dominantTheme] || fallbacks.default;
}

/**
 * Sauvegarder le sondage en base
 */
async function savePollToDatabase(pollData) {
  try {
    // Archiver l'ancien sondage actif s'il existe
    const { error: archiveError } = await supabase
      .from('polls')
      .update({ 
        status: 'archived',
        is_active: false 
      })
      .eq('status', 'published')
      .eq('is_active', true);
    
    if (archiveError) {
      console.log('Note: Erreur archivage (peut être normal):', archiveError.message);
    }

    // Créer le nouveau sondage
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h de durée

    const { data, error } = await supabase
      .from('polls')
      .insert({
        question: pollData.question,
        poll_type: pollData.type,
        options: pollData.options ? pollData.options.slice(0, 3) : [],
        expires_at: expiresAt.toISOString(),
        status: 'published',
        published_at: new Date().toISOString(),
        is_active: true,
        is_manual: true, // Généré manuellement
        total_votes: 0
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur sauvegarde:', error);
      return null;
    }

    console.log('✅ Sondage sauvegardé:', data.question);
    return data;
    
  } catch (error) {
    console.error('❌ Erreur base de données:', error);
    return null;
  }
}
