const OpenAI = require('openai');

class OpenAIEditorialService {
  constructor() {
    // Configuration Kimi K2.5 (Moonshot AI, OpenAI-compatible)
    const apiKey = process.env.KIMI_API_KEY;

    this.model = 'kimi-k2.5-preview';

    if (!apiKey) {
      console.warn('⚠️ KIMI_API_KEY non configurée - Service IA Editorial désactivé');
      this.openai = null;
      return;
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.moonshot.ai/v1'
    });

    console.log('✅ Service Kimi Editorial initialisé');
  }

  /**
   * 📝 GÉNÉRATION D'ÉDITORIAL AUTOMATIQUE
   */
  async generateEditorial(topic, context = '', style = 'journalistique') {
    try {
      if (!this.openai) {
        throw new Error('Service OpenAI non disponible');
      }

      const prompt = `Rédigez un éditorial journalistique gabonais sur le sujet suivant :

Sujet : ${topic}
Contexte : ${context}
Style : ${style}

L'éditorial doit :
- Être informatif et objectif
- Refléter la perspective gabonaise
- Faire entre 200-300 mots
- Avoir une structure claire (introduction, développement, conclusion)
- Utiliser un français correct et professionnel

Éditorial :`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.7
      });

      return response.choices[0]?.message?.content?.trim();
      
    } catch (error) {
      console.error('❌ Erreur génération éditorial:', error.message);
      throw error;
    }
  }

  /**
   * 🔍 ANALYSE DE SENTIMENT D'ARTICLE
   */
  async analyzeSentiment(title, content) {
    try {
      if (!this.openai) {
        return 'neutral';
      }

      const prompt = `Analysez le sentiment de cet article gabonais :

Titre : ${title}
Contenu : ${content?.substring(0, 500)}

Répondez uniquement par : "positif", "négatif" ou "neutre"`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0.1
      });

      const sentiment = response.choices[0]?.message?.content?.trim().toLowerCase();
      return ['positif', 'négatif', 'neutre'].includes(sentiment) ? sentiment : 'neutre';
      
    } catch (error) {
      console.error('❌ Erreur analyse sentiment:', error.message);
      return 'neutre';
    }
  }

  /**
   * 🏷️ EXTRACTION DE MOTS-CLÉS
   */
  async extractKeywords(title, content) {
    try {
      if (!this.openai) {
        return [];
      }

      const prompt = `Extrayez 5 mots-clés pertinents de cet article gabonais :

Titre : ${title}
Contenu : ${content?.substring(0, 500)}

Répondez uniquement par une liste de mots-clés séparés par des virgules.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.3
      });

      const keywords = response.choices[0]?.message?.content?.trim();
      return keywords ? keywords.split(',').map(k => k.trim()) : [];
      
    } catch (error) {
      console.error('❌ Erreur extraction mots-clés:', error.message);
      return [];
    }
  }

  /**
   * 📊 VÉRIFICATION DE LA DISPONIBILITÉ DU SERVICE
   */
  isAvailable() {
    return this.openai !== null;
  }
}

module.exports = OpenAIEditorialService;
