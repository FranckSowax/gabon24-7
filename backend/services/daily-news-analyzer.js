/**
 * Service d'analyse IA pour résumé quotidien
 * Analyse tous les articles des dernières 24h et génère un résumé politique
 */

const fetch = require('node-fetch');

/**
 * Analyse tous les articles des dernières 24h et génère un résumé politique
 * @param {Array} articles - Liste des articles des 24h
 * @param {string} language - Langue du résumé (fr, en, zh)
 * @returns {Promise<string>} - Résumé généré
 */
async function generateDailySummary(articles, language = 'fr') {
  try {
    if (!articles || articles.length === 0) {
      throw new Error('Aucun article à analyser');
    }

    // Trier les articles par importance (métadonnée IA)
    const sortedArticles = [...articles].sort((a, b) => {
      const importanceA = a.ai_importance || 0;
      const importanceB = b.ai_importance || 0;
      return importanceB - importanceA; // Plus important en premier
    });

    // Prendre les 15 articles les plus importants
    const topArticles = sortedArticles.slice(0, 15);

    // Construire le contexte enrichi pour l'IA avec métadonnées
    const articlesContext = topArticles.map((a, idx) => {
      const importance = a.ai_importance ? `${a.ai_importance}/10` : 'Non évalué';
      const sentiment = a.ai_sentiment || 'Neutre';
      const isBreaking = a.ai_is_breaking ? 'OUI' : 'Non';
      const keywords = a.ai_keywords ? a.ai_keywords.join(', ') : 'Aucun';
      
      return `Article ${idx + 1}:
Titre: ${a.title}
Catégorie: ${a.ai_category || a.category || 'Non catégorisé'}
Importance: ${importance}
Breaking News: ${isBreaking}
Sentiment: ${sentiment}
Mots-clés: ${keywords}
Résumé IA: ${a.summary_ai || 'Non disponible'}
Résumé RSS: ${a.summary || 'Non disponible'}
---`;
    }).join('\n\n');

    // Prompt selon la langue
    let prompt = '';
    if (language === 'fr') {
      prompt = `Tu es un journaliste expert pour Gabon Insight, spécialisé dans les veilles matinales essentielles. Analyse les articles suivants (triés par IMPORTANCE IA) des dernières 6 heures et génère un résumé audio journalistique professionnel de MINIMUM 1 minute 30 secondes (environ 400-500 mots).

RÈGLES ABSOLUES:
1. BASE-TOI sur les colonnes IA:
   - ai_importance (0-10): Priorise les articles avec importance élevée
   - ai_is_breaking: Mets en avant les breaking news
   - ai_sentiment: Utilise pour contextualiser (positif/négatif/neutre)
   - ai_keywords: Identifie les thèmes récurrents
   - summary_ai ET summary RSS: Synthétise l'information

2. NE CITE JAMAIS les sources directement ("Selon X...", "D'après Y...")
   - Présente les faits comme un journaliste qui a analysé l'info
   - Exemple: ❌ "Selon l'AGP, le gouvernement..." 
   - Exemple: ✅ "Le gouvernement gabonais a annoncé..."

3. ANALYSE INTELLIGENTE:
   - Regroupe les infos similaires (même thème, même événement)
   - Identifie les tendances des dernières 6h
   - Explique le CONTEXTE et l'IMPACT
   - Donne des DÉTAILS CONCRETS: chiffres, noms, lieux, dates

4. STRUCTURE VEILLE MATINALE (400-500 mots):
   * Accroche dynamique (30 mots): "Bonjour, voici l'essentiel de l'actualité gabonaise..."
   * Breaking news si présent (80 mots): Info urgente avec contexte
   * 3-4 sujets principaux (250 mots): Par ordre d'importance décroissante
   * Perspective et conclusion (40 mots): Impact et suite à suivre

5. TON JOURNALISTIQUE:
   - Professionnel mais accessible
   - Factuel et précis
   - Dynamique pour la radio
   - Pas de citations de sources
   - Focus sur l'INFORMATION, pas sur qui l'a dit

Articles triés par importance (les plus importants en premier):
${articlesContext}

Génère maintenant une veille matinale journalistique professionnelle (MINIMUM 400 mots):`;
    } else if (language === 'en') {
      prompt = `You are a journalist expert for Gabon Insight, specialized in essential morning briefings. Analyze the following articles (sorted by AI IMPORTANCE) from the last 6 hours and generate a professional journalistic audio summary of MINIMUM 1 minute 30 seconds (about 400-500 words).

ABSOLUTE RULES:
1. BASE YOUR ANALYSIS on AI columns:
   - ai_importance (0-10): Prioritize high-importance articles
   - ai_is_breaking: Highlight breaking news
   - ai_sentiment: Use for context (positive/negative/neutral)
   - ai_keywords: Identify recurring themes
   - summary_ai AND summary RSS: Synthesize information

2. NEVER cite sources directly ("According to X...", "As per Y...")
   - Present facts as a journalist who analyzed the info
   - Example: ❌ "According to AGP, the government..." 
   - Example: ✅ "The Gabonese government announced..."

3. INTELLIGENT ANALYSIS:
   - Group similar information (same theme, same event)
   - Identify trends from the last 6 hours
   - Explain CONTEXT and IMPACT
   - Give CONCRETE DETAILS: numbers, names, places, dates

4. MORNING BRIEFING STRUCTURE (400-500 words):
   * Dynamic opening (30 words): "Good morning, here's what's essential in Gabon..."
   * Breaking news if present (80 words): Urgent info with context
   * 3-4 main topics (250 words): By decreasing importance
   * Perspective and conclusion (40 words): Impact and what's next

5. JOURNALISTIC TONE:
   - Professional but accessible
   - Factual and precise
   - Dynamic for radio
   - No source citations
   - Focus on INFORMATION, not who said it

Articles sorted by importance (most important first):
${articlesContext}

Generate now a professional journalistic morning briefing (MINIMUM 400 words):`;
    } else if (language === 'zh') {
      prompt = `您是Gabon Insight的专业记者，专门制作重要的晨间简报。分析以下文章（按AI重要性排序）过去6小时的内容，生成一个专业的新闻音频摘要，最少1分30秒（约400-500字）。

绝对规则:
1. 基于AI列进行分析:
   - ai_importance (0-10): 优先处理高重要性文章
   - ai_is_breaking: 突出显示突发新闻
   - ai_sentiment: 用于上下文（积极/消极/中性）
   - ai_keywords: 识别重复主题
   - summary_ai 和 summary RSS: 综合信息

2. 永远不要直接引用来源（"据X...", "根据Y..."）
   - 像分析过信息的记者一样呈现事实
   - 例如: ❌ "据AGP报道，政府..." 
   - 例如: ✅ "加蓬政府宣布..."

3. 智能分析:
   - 将相似信息分组（相同主题、相同事件）
   - 识别过去6小时的趋势
   - 解释背景和影响
   - 提供具体细节：数字、姓名、地点、日期

4. 晨间简报结构（400-500字）:
   * 动态开场（30字）："早上好，这是加蓬的重要新闻..."
   * 突发新闻（如有）（80字）：紧急信息及背景
   * 3-4个主要话题（250字）：按重要性递减
   * 展望和结论（40字）：影响和后续

5. 新闻语气:
   - 专业但易懂
   - 事实准确
   - 适合广播的动态风格
   - 不引用来源
   - 关注信息本身，而非谁说的

按重要性排序的文章（最重要的在前）:
${articlesContext}

现在生成专业的新闻晨间简报（最少400字）:`;
    }

    // Si on a OpenAI, utiliser GPT pour générer le résumé
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: language === 'fr' 
                ? 'Tu es un journaliste expert en politique gabonaise spécialisé dans les résumés audio détaillés pour la radio. Tu produis des résumés riches en informations avec des détails concrets.'
                : language === 'en'
                ? 'You are a journalist expert in Gabonese politics specialized in detailed audio summaries for radio. You produce information-rich summaries with concrete details.'
                : '您是专门从事详细广播音频摘要的加蓬政治专家记者。您制作信息丰富、细节具体的摘要。'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices[0]?.message?.content || '';
      
      return summary.trim();
    } else {
      // Fallback: générer un résumé détaillé sans IA
      console.log('⚠️  OPENAI_API_KEY manquant, génération de résumé détaillé basique');
      
      // Filtrer les articles politiques et économiques
      const politicalArticles = articles.filter(a => 
        a.category === 'Politique' || 
        a.category === 'Économie' ||
        a.title.toLowerCase().includes('gouvernement') ||
        a.title.toLowerCase().includes('ministre') ||
        a.title.toLowerCase().includes('président') ||
        a.title.toLowerCase().includes('économie') ||
        a.title.toLowerCase().includes('budget')
      );

      // Prendre 5-6 articles pour avoir plus de contenu
      const topArticles = politicalArticles.length > 0 
        ? politicalArticles.slice(0, 6) 
        : articles.slice(0, 6);

      // Trier par importance même sans OpenAI
      const sortedFallback = [...politicalArticles.length > 0 ? politicalArticles : articles]
        .sort((a, b) => (b.ai_importance || 0) - (a.ai_importance || 0))
        .slice(0, 6);

      let intro = '';
      if (language === 'fr') {
        intro = `Bonjour, voici l'essentiel de l'actualité gabonaise. Nous avons analysé ${articles.length} articles pour vous présenter les informations les plus importantes.\n\n`;
      } else if (language === 'en') {
        intro = `Good morning, here's what's essential in Gabon. We analyzed ${articles.length} articles to bring you the most important information.\n\n`;
      } else {
        intro = `早上好，这是加蓬的重要新闻。我们分析了${articles.length}篇文章，为您呈现最重要的信息。\n\n`;
      }

      const articlesSummary = sortedFallback.map((a, idx) => {
        const summary = a.summary_ai || a.summary || a.content?.substring(0, 300) || a.title;
        const importance = a.ai_importance ? ` [Importance: ${a.ai_importance}/10]` : '';
        // Présenter comme un journaliste, pas comme une citation
        return `${a.title}. ${summary.substring(0, 300)}${importance}`;
      }).join('\n\n');

      const conclusion = language === 'fr' 
        ? '\n\nVoilà pour l\'essentiel de l\'actualité gabonaise. Restez informés avec Gabon Insight.'
        : language === 'en'
        ? '\n\nThat\'s the essential news from Gabon. Stay informed with Gabon Insight.'
        : '\n\n这就是加蓬的重要新闻。通过Gabon Insight保持了解。';

      return intro + articlesSummary + conclusion;
    }
  } catch (error) {
    console.error('❌ Erreur génération résumé:', error);
    throw error;
  }
}

module.exports = {
  generateDailySummary
};
