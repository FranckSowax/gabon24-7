/**
 * Service de génération de résumés personnalisés multilingues
 * Génère des résumés intelligents en FR, EN et ZH avec Gemini 3 Pro (fallback OpenAI)
 * Max 10 articles par résumé
 */

const geminiService = require('./gemini-service');

/**
 * Générer un résumé personnalisé avec IA dans n'importe quelle langue
 * @param {Array} articles - Articles sélectionnés par l'utilisateur
 * @param {string} language - Langue du résumé (fr, en, zh)
 * @returns {Promise<string>} - Résumé généré
 */
async function generateCustomSummary(articles, language = 'fr') {
  try {
    if (!articles || articles.length === 0) {
      throw new Error('Aucun article à résumer');
    }

    // Construire le contexte pour l'IA
    const articlesContext = articles.map((a, idx) => {
      return `Article ${idx + 1}:\nTitre: ${a.title}\nSource: ${a.source || 'N/A'}\nRésumé: ${a.summary_ai || a.summary || a.content?.substring(0, 200) || 'Pas de résumé'}\n---`;
    }).join('\n\n');

    // Prompts selon la langue
    let prompt = '';
    let systemPrompt = '';
    
    if (language === 'fr') {
      systemPrompt = 'Tu es un journaliste expert qui crée des résumés audio professionnels et captivants.';
      prompt = `Tu es un journaliste professionnel. Crée un résumé audio captivant et cohérent à partir des ${articles.length} articles suivants.\n\nInstructions:\n- Commence par une introduction accueillante\n- Présente chaque article de manière fluide et professionnelle\n- Utilise un ton adapté à la radio/podcast\n- Fais des transitions naturelles entre les sujets\n- Conclus de manière engageante\n- Maximum 400 mots pour rester concis\n\nArticles:\n${articlesContext}\n\nRésumé audio professionnel:`;
    } else if (language === 'en') {
      systemPrompt = 'You are an expert journalist who creates professional and captivating audio summaries.';
      prompt = `You are a professional journalist. Create a captivating and cohesive audio summary from the following ${articles.length} articles.\n\nInstructions:\n- Start with a welcoming introduction\n- Present each article in a smooth and professional way\n- Use a tone suitable for radio/podcast\n- Make natural transitions between topics\n- Conclude in an engaging manner\n- Maximum 400 words to stay concise\n\nArticles:\n${articlesContext}\n\nProfessional audio summary:`;
    } else if (language === 'zh') {
      systemPrompt = '您是一位专业记者，创建专业且引人入胜的音频摘要。';
      prompt = `您是一位专业记者。请根据以下${articles.length}篇文章创建一个引人入胜且连贯的音频摘要。\n\n说明:\n- 以热情的介绍开始\n- 以流畅和专业的方式呈现每篇文章\n- 使用适合广播/播客的语气\n- 在主题之间自然过渡\n- 以引人入胜的方式结束\n- 最多400字以保持简洁\n\n文章:\n${articlesContext}\n\n专业音频摘要:`;
    }

    // Appel à GeminiService (qui gère Gemini -> Fallback OpenAI)
    const summary = await geminiService.generateText(prompt, {
      systemPrompt,
      temperature: 0.7
    });

    if (!summary) {
      throw new Error('Résumé vide reçu de l\'IA');
    }

    console.log(`✅ Résumé personnalisé généré (${language}): ${summary.length} caractères`);
    return summary;

  } catch (error) {
    console.error('❌ Erreur génération résumé personnalisé:', error.message);
    // Fallback vers résumé basique manuel si tout échoue
    return generateBasicSummary(articles, language);
  }
}

/**
 * Générer un résumé basique sans IA
 * @param {Array} articles - Articles sélectionnés
 * @param {string} language - Langue
 * @returns {string} - Résumé basique
 */
function generateBasicSummary(articles, language) {
  let intro = '';
  
  if (language === 'fr') {
    intro = `Bonjour. Voici votre résumé personnalisé avec ${articles.length} article${articles.length > 1 ? 's' : ''} sélectionné${articles.length > 1 ? 's' : ''}.`;
  } else if (language === 'en') {
    intro = `Hello. Here is your custom summary with ${articles.length} selected article${articles.length > 1 ? 's' : ''}.`;
  } else if (language === 'zh') {
    intro = `您好。这是您选择的${articles.length}篇文章的自定义摘要。`;
  }

  const articleScripts = articles.map((a, idx) => {
    const summary = a.summary_ai || a.summary || a.content?.substring(0, 250) || a.title;
    
    if (language === 'fr') {
      return `Article ${idx + 1}: ${a.title}. ${summary.substring(0, 250)}.`;
    } else if (language === 'en') {
      return `Article ${idx + 1}: ${a.title}. ${summary.substring(0, 250)}.`;
    } else {
      return `文章 ${idx + 1}: ${a.title}. ${summary.substring(0, 200)}。`;
    }
  }).join('\n\n');

  let conclusion = '';
  if (language === 'fr') {
    conclusion = `\n\nCe résumé personnalisé contenait ${articles.length} article${articles.length > 1 ? 's' : ''}. Merci de votre écoute.`;
  } else if (language === 'en') {
    conclusion = `\n\nThis custom summary contained ${articles.length} article${articles.length > 1 ? 's' : ''}. Thank you for listening.`;
  } else {
    conclusion = `\n\n此自定义摘要包含${articles.length}篇文章。感谢您的收听。`;
  }

  return `${intro}\n\n${articleScripts}${conclusion}`;
}

module.exports = {
  generateCustomSummary
};
