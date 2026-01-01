const { GoogleGenerativeAI } = require('@google/generative-ai');
const supabase = require('../supabase-config');

class GeminiRAGService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not set. RAG Service will not function.');
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.modelName = 'gemini-1.5-flash';
  }

  /**
   * Search relevant articles using AI-enriched columns
   * Uses: keywords, category, summary_ai, importance, sentiment_score
   */
  async searchArticles(query, limit = 8) {
    try {
      // Extract keywords from query
      const queryKeywords = query
        .toLowerCase()
        .replace(/[^\w\sàâäéèêëïîôùûüç'-]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 8);

      if (queryKeywords.length === 0) {
        // Fallback: get recent important articles
        const { data, error } = await supabase.supabase
          .from('articles')
          .select('id, title, content, summary_ai, source, published_at, category, keywords, sentiment_score, importance, is_breaking')
          .eq('is_published', true)
          .order('importance', { ascending: false, nullsFirst: false })
          .order('published_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      }

      // Multi-strategy search using AI-enriched columns
      let allArticles = [];

      // Strategy 1: Search in AI keywords array (most relevant)
      for (const keyword of queryKeywords.slice(0, 3)) {
        const { data: keywordMatches } = await supabase.supabase
          .from('articles')
          .select('id, title, content, summary_ai, source, published_at, category, keywords, sentiment_score, importance, is_breaking')
          .eq('is_published', true)
          .contains('keywords', [keyword])
          .order('importance', { ascending: false, nullsFirst: false })
          .limit(10);

        if (keywordMatches) allArticles.push(...keywordMatches);
      }

      // Strategy 2: Search in title and summary_ai
      for (const keyword of queryKeywords.slice(0, 2)) {
        const { data: textMatches } = await supabase.supabase
          .from('articles')
          .select('id, title, content, summary_ai, source, published_at, category, keywords, sentiment_score, importance, is_breaking')
          .eq('is_published', true)
          .or(`title.ilike.%${keyword}%,summary_ai.ilike.%${keyword}%`)
          .order('published_at', { ascending: false })
          .limit(10);

        if (textMatches) allArticles.push(...textMatches);
      }

      // Strategy 3: Category-based search if query mentions categories
      const categoryMap = {
        'politique': 'Politique', 'gouvernement': 'Politique', 'président': 'Politique',
        'économie': 'Économie', 'économique': 'Économie', 'finance': 'Économie',
        'sport': 'Sport', 'football': 'Sport', 'match': 'Sport',
        'santé': 'Santé', 'hôpital': 'Santé', 'médical': 'Santé',
        'éducation': 'Éducation', 'école': 'Éducation', 'université': 'Éducation',
        'culture': 'Culture', 'musique': 'Culture', 'festival': 'Culture',
        'justice': 'Justice', 'tribunal': 'Justice', 'procès': 'Justice',
        'environnement': 'Environnement', 'climat': 'Environnement'
      };

      for (const keyword of queryKeywords) {
        if (categoryMap[keyword]) {
          const { data: categoryMatches } = await supabase.supabase
            .from('articles')
            .select('id, title, content, summary_ai, source, published_at, category, keywords, sentiment_score, importance, is_breaking')
            .eq('is_published', true)
            .eq('category', categoryMap[keyword])
            .order('importance', { ascending: false, nullsFirst: false })
            .order('published_at', { ascending: false })
            .limit(5);

          if (categoryMatches) allArticles.push(...categoryMatches);
        }
      }

      // Deduplicate by ID
      const uniqueArticles = Array.from(
        new Map(allArticles.map(a => [a.id, a])).values()
      );

      // Score and sort by relevance using AI metadata
      const scored = uniqueArticles.map(article => {
        let score = 0;
        const titleLower = (article.title || '').toLowerCase();
        const summaryLower = (article.summary_ai || '').toLowerCase();
        const articleKeywords = (article.keywords || []).map(k => k.toLowerCase());

        // Score based on keyword matches
        for (const keyword of queryKeywords) {
          // High score for keyword in AI keywords array
          if (articleKeywords.some(k => k.includes(keyword) || keyword.includes(k))) {
            score += 5;
          }
          // Medium score for title match
          if (titleLower.includes(keyword)) {
            score += 3;
          }
          // Lower score for summary match
          if (summaryLower.includes(keyword)) {
            score += 1;
          }
        }

        // Boost based on AI importance (0-10)
        if (article.importance) {
          score += article.importance * 0.5;
        }

        // Boost breaking news
        if (article.is_breaking) {
          score += 3;
        }

        // Small recency boost (articles from last 7 days)
        if (article.published_at) {
          const daysSincePublished = (Date.now() - new Date(article.published_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSincePublished < 7) {
            score += 2;
          }
        }

        return { ...article, relevanceScore: score };
      });

      return scored
        .filter(a => a.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);

    } catch (error) {
      console.error('Search articles error:', error);
      return [];
    }
  }

  /**
   * Build rich context from articles using AI-enriched data
   */
  buildContext(articles) {
    if (!articles || articles.length === 0) {
      return '';
    }

    return articles.map((article, idx) => {
      // Prefer AI summary, fallback to content
      const content = article.summary_ai || article.content || '';
      const truncatedContent = content.length > 800
        ? content.substring(0, 800) + '...'
        : content;

      // Format sentiment
      let sentimentLabel = 'Neutre';
      if (article.sentiment_score !== null && article.sentiment_score !== undefined) {
        if (article.sentiment_score > 0.3) sentimentLabel = 'Positif';
        else if (article.sentiment_score < -0.3) sentimentLabel = 'Négatif';
      }

      // Format importance
      const importanceLabel = article.importance
        ? `${article.importance}/10`
        : 'Non évalué';

      // Format keywords
      const keywordsStr = article.keywords && article.keywords.length > 0
        ? article.keywords.slice(0, 5).join(', ')
        : 'Aucun';

      return `---
📰 ARTICLE ${idx + 1}: ${article.title}
📅 DATE: ${article.published_at ? new Date(article.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}
📌 SOURCE: ${article.source || 'Gabon 24/7'}
📁 CATÉGORIE: ${article.category || 'Général'}
⭐ IMPORTANCE: ${importanceLabel}
💭 SENTIMENT: ${sentimentLabel}
🔑 MOTS-CLÉS: ${keywordsStr}
${article.is_breaking ? '🚨 BREAKING NEWS' : ''}

CONTENU:
${truncatedContent}
---`;
    }).join('\n\n');
  }

  /**
   * Chat with RAG - searches articles using AI metadata and generates response
   */
  async chat(query, history = []) {
    // Check API key first
    if (!this.apiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return {
        success: false,
        error: 'API key not configured',
        text: "Le service Insight Gab n'est pas configuré. Contactez l'administrateur."
      };
    }

    try {
      // 1. Search relevant articles using AI-enriched columns
      const articles = await this.searchArticles(query);
      console.log(`RAG: Found ${articles.length} articles for query: "${query.substring(0, 50)}..."`);

      if (articles.length === 0) {
        return {
          success: true,
          text: "Je n'ai pas trouvé d'articles pertinents dans ma base de données pour cette question. Essayez avec d'autres mots-clés ou reformulez votre demande.",
          articlesUsed: 0
        };
      }
      const context = this.buildContext(articles);

      // 2. Build enhanced system prompt
      const systemPrompt = `Tu es **Insight Gab**, un assistant IA expert en actualité gabonaise. Tu as accès à une base de plus de 20 000 articles enrichis par intelligence artificielle.

## TES CAPACITÉS
- Accès aux articles avec métadonnées IA: catégorie, sentiment, importance, mots-clés
- Recherche sémantique dans la base de connaissances
- Analyse des tendances et des sujets récurrents

## RÈGLES IMPÉRATIVES
1. Réponds TOUJOURS en français
2. Base tes réponses UNIQUEMENT sur les articles fournis en contexte
3. Si tu ne trouves pas d'information pertinente, dis-le clairement: "Je n'ai pas trouvé d'article sur ce sujet dans ma base."
4. Cite les sources: "Selon [Source], le [Date]..."
5. Utilise les métadonnées (importance, sentiment) pour contextualiser
6. Sois factuel et concis
7. Pour les sujets sensibles, reste neutre et objectif

## ARTICLES DE CONTEXTE (${articles.length} trouvé${articles.length > 1 ? 's' : ''})
${context || 'Aucun article trouvé pour cette requête. Suggère à l\'utilisateur de reformuler ou d\'utiliser d\'autres mots-clés.'}`;

      // 3. Initialize model
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        systemInstruction: systemPrompt,
      });

      // 4. Convert history
      const formattedHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));

      // 5. Start chat and send message
      const chatSession = model.startChat({
        history: formattedHistory,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1500,
        }
      });

      const result = await chatSession.sendMessage(query);
      const response = await result.response;
      const text = response.text();

      return {
        text,
        success: true,
        articlesUsed: articles.length,
        sources: articles.map(a => ({
          title: a.title,
          source: a.source,
          date: a.published_at,
          category: a.category
        }))
      };

    } catch (error) {
      console.error('Chat RAG Error:', error.message);
      console.error('Chat RAG Error Stack:', error.stack);

      // Provide more specific error messages
      let errorMessage = "Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants.";

      if (error.message?.includes('API_KEY')) {
        errorMessage = "Configuration manquante: la clé API Gemini n'est pas configurée.";
      } else if (error.message?.includes('quota') || error.message?.includes('rate')) {
        errorMessage = "Limite de requêtes atteinte. Veuillez réessayer dans quelques minutes.";
      } else if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
        errorMessage = "Problème de connexion au service IA. Veuillez réessayer.";
      }

      return {
        success: false,
        error: error.message,
        text: errorMessage
      };
    }
  }

  /**
   * For compatibility with admin page - returns store status
   */
  async findStore() {
    return { name: 'supabase-ai-enriched', displayName: 'Gabon24-7 AI-Enriched Store' };
  }

  /**
   * Get enriched articles count for status
   */
  async getArticlesCount() {
    try {
      const { count, error } = await supabase.supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('is_published', true)
        .not('summary_ai', 'is', null);

      return error ? 0 : (count || 0);
    } catch {
      return 0;
    }
  }
}

module.exports = GeminiRAGService;
