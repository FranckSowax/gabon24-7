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
   * Search relevant articles from Supabase using text search
   */
  async searchArticles(query, limit = 5) {
    try {
      // Extract keywords from query (simple approach)
      const keywords = query
        .toLowerCase()
        .replace(/[^\w\sàâäéèêëïîôùûüç]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);

      if (keywords.length === 0) {
        // Fallback: get recent articles
        const { data, error } = await supabase.supabase
          .from('articles')
          .select('id, title, content, summary_ai, source, published_at, category')
          .order('published_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        return data || [];
      }

      // Search using ilike for first keyword
      const { data, error } = await supabase.supabase
        .from('articles')
        .select('id, title, content, summary_ai, source, published_at, category')
        .or(`title.ilike.%${keywords[0]}%,content.ilike.%${keywords[0]}%,summary_ai.ilike.%${keywords[0]}%`)
        .order('published_at', { ascending: false })
        .limit(limit * 2); // Get more to filter

      if (error) throw error;

      // Score and sort by relevance
      const scored = (data || []).map(article => {
        let score = 0;
        const titleLower = (article.title || '').toLowerCase();
        const contentLower = (article.content || article.summary_ai || '').toLowerCase();

        for (const keyword of keywords) {
          if (titleLower.includes(keyword)) score += 3;
          if (contentLower.includes(keyword)) score += 1;
        }

        return { ...article, score };
      });

      return scored
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      console.error('Search articles error:', error);
      return [];
    }
  }

  /**
   * Build context from articles
   */
  buildContext(articles) {
    if (!articles || articles.length === 0) {
      return '';
    }

    return articles.map(article => {
      const content = article.summary_ai || article.content || '';
      const truncatedContent = content.length > 1000
        ? content.substring(0, 1000) + '...'
        : content;

      return `---
ARTICLE: ${article.title}
SOURCE: ${article.source || 'Gabon 24/7'}
DATE: ${article.published_at ? new Date(article.published_at).toLocaleDateString('fr-FR') : 'N/A'}
CATÉGORIE: ${article.category || 'Général'}
CONTENU: ${truncatedContent}
---`;
    }).join('\n\n');
  }

  /**
   * Chat with RAG - searches articles and uses them as context
   */
  async chat(query, history = []) {
    try {
      // 1. Search relevant articles
      const articles = await this.searchArticles(query);
      const context = this.buildContext(articles);

      // 2. Build system prompt
      const systemPrompt = `Tu es Insight Gab, un assistant IA spécialisé sur l'actualité du Gabon. Tu as accès à une base de plus de 20 000 articles d'actualité gabonaise.

RÈGLES IMPORTANTES:
- Réponds TOUJOURS en français
- Base tes réponses sur les articles fournis en contexte
- Si tu ne trouves pas d'information pertinente, dis-le clairement
- Cite les sources quand c'est pertinent (nom du journal, date)
- Sois concis mais informatif
- Si on te demande des informations très récentes, précise que ta base peut ne pas être à jour

${context ? `ARTICLES DE CONTEXTE:\n${context}` : 'Aucun article trouvé pour cette requête.'}`;

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
          maxOutputTokens: 1024,
        }
      });

      const result = await chatSession.sendMessage(query);
      const response = await result.response;
      const text = response.text();

      return {
        text,
        success: true,
        articlesUsed: articles.length
      };

    } catch (error) {
      console.error('Chat RAG Error:', error);
      return {
        success: false,
        error: error.message,
        text: "Désolé, je rencontre des difficultés techniques. Veuillez réessayer dans quelques instants."
      };
    }
  }

  /**
   * For compatibility with admin page - returns store status
   */
  async findStore() {
    // We use Supabase, so always "active"
    return { name: 'supabase-articles', displayName: 'Gabon24-7 Supabase Store' };
  }

  /**
   * Get articles count for status
   */
  async getArticlesCount() {
    try {
      const { count, error } = await supabase.supabase
        .from('articles')
        .select('*', { count: 'exact', head: true });

      return error ? 0 : (count || 0);
    } catch {
      return 0;
    }
  }
}

module.exports = GeminiRAGService;
