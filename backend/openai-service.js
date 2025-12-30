const OpenAI = require('openai');

class OpenAIService {
  constructor() {
    // Initialiser OpenAI avec la clé API (à configurer via variable d'environnement)
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
    });
    
    this.isConfigured = !!process.env.OPENAI_API_KEY;
    
    if (!this.isConfigured) {
      console.warn('⚠️ OpenAI API Key non configurée. Utilisez OPENAI_API_KEY dans les variables d\'environnement.');
    }
  }

  // Générer un résumé d'article avec ChatGPT
  async generateSummary(title, content, source = '') {
    if (!this.isConfigured) {
      return this.generateMockSummary(title, content);
    }

    try {
      console.log(`🤖 Génération résumé OpenAI pour: ${title}`);
      
      const prompt = `Tu es un journaliste expert spécialisé dans l'actualité gabonaise. 
Résume cet article de presse en français en UNE SEULE phrase complète et informative.
La phrase doit capturer l'essentiel de l'information sans être tronquée.
Ne commence jamais par "[Résumé automatique]" ou toute autre mention de résumé automatique.

Source: ${source}
Titre: ${title}
Contenu: ${content}

Résumé en une phrase complète:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Tu es un assistant journaliste expert en actualité gabonaise. Tu résumes les articles de presse en UNE SEULE phrase complète et informative en français, sans jamais la tronquer. Ne commence jamais par '[Résumé automatique]' ou toute autre mention de résumé automatique."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3,
        presence_penalty: 0.1
      });

      const summary = completion.choices[0]?.message?.content?.trim();
      
      if (summary) {
        console.log(`✅ Résumé OpenAI généré: ${summary.substring(0, 100)}...`);
        return summary;
      } else {
        throw new Error('Résumé vide reçu de OpenAI');
      }

    } catch (error) {
      console.error(`❌ Erreur OpenAI pour ${title}:`, error.message);
      return this.generateMockSummary(title, content);
    }
  }

  // Générer un résumé simulé (fallback)
  generateMockSummary(title, content) {
    console.log(`🔄 Génération résumé simulé pour: ${title}`);
    
    // Extraire les premières phrases du contenu
    let summary = content || title;
    
    // Nettoyer et limiter
    summary = summary.replace(/<[^>]*>/g, ''); // Supprimer HTML
    summary = summary.replace(/\s+/g, ' ').trim(); // Nettoyer espaces
    
    // Prendre les 2 premières phrases ou 200 caractères max
    const sentences = summary.split(/[.!?]+/);
    if (sentences.length >= 2) {
      summary = sentences.slice(0, 2).join('. ') + '.';
    } else {
      summary = summary.substring(0, 200) + '...';
    }
    
    return summary;
  }

  // Générer des mots-clés pour un article
  async generateKeywords(title, content, source = '') {
    if (!this.isConfigured) {
      return this.generateMockKeywords(title, content);
    }

    try {
      const prompt = `Extrait 5 mots-clés pertinents de cet article gabonais en français:

Titre: ${title}
Contenu: ${content}

Mots-clés (séparés par des virgules):`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system", 
            content: "Tu extrais des mots-clés pertinents d'articles de presse gabonais. Réponds uniquement avec les mots-clés séparés par des virgules."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0.2
      });

      const keywords = completion.choices[0]?.message?.content?.trim();
      return keywords ? keywords.split(',').map(k => k.trim()) : [];

    } catch (error) {
      console.error(`❌ Erreur génération mots-clés:`, error.message);
      return this.generateMockKeywords(title, content);
    }
  }

  // Générer des mots-clés simulés
  generateMockKeywords(title, content) {
    const commonWords = ['actualité', 'gabon', 'politique', 'économie', 'société'];
    const titleWords = title.toLowerCase().split(' ').filter(w => w.length > 3);
    return [...titleWords.slice(0, 3), ...commonWords.slice(0, 2)];
  }

  // Analyser le sentiment d'un article
  async analyzeSentiment(title, content) {
    if (!this.isConfigured) {
      return { sentiment: 'neutre', confidence: 0.5 };
    }

    try {
      const prompt = `Analyse le sentiment de cet article gabonais. Réponds uniquement par: "positif", "négatif" ou "neutre"

Titre: ${title}
Contenu: ${content.substring(0, 500)}

Sentiment:`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Tu analyses le sentiment d'articles de presse. Réponds uniquement par 'positif', 'négatif' ou 'neutre'."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.1
      });

      const sentiment = completion.choices[0]?.message?.content?.trim().toLowerCase();
      return {
        sentiment: ['positif', 'négatif', 'neutre'].includes(sentiment) ? sentiment : 'neutre',
        confidence: 0.8
      };

    } catch (error) {
      console.error(`❌ Erreur analyse sentiment:`, error.message);
      return { sentiment: 'neutre', confidence: 0.5 };
    }
  }

  // Vérifier si OpenAI est configuré
  isReady() {
    return this.isConfigured;
  }

  // Obtenir les statistiques d'utilisation
  getUsageStats() {
    return {
      configured: this.isConfigured,
      model: 'gpt-3.5-turbo',
      features: ['résumés', 'mots-clés', 'sentiment']
    };
  }
}

module.exports = OpenAIService;
