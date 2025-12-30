/**
 * 🤖 SERVICE D'ENRICHISSEMENT IA DES ARTICLES
 * 
 * Génère systématiquement les métadonnées IA pour chaque nouvel article:
 * - ai_category: Catégorie intelligente (Politique, Économie, Sport, etc.)
 * - ai_sentiment: Score de sentiment (-1 à 1)
 * - ai_importance: Score d'importance (0 à 1)
 * - ai_is_breaking: Détection de breaking news
 */

const geminiService = require('./gemini-service');
const smartEnrichmentCache = require('./smart-enrichment-cache');

class ArticleAIEnrichment {
  constructor() {
    this.CATEGORIES = [
      'Politique',
      'Économie', 
      'Société',
      'Sport',
      'Culture',
      'Santé',
      'Éducation',
      'Énergie',
      'Agriculture',
      'Transport',
      'Justice',
      'Environnement',
      'Technologie',
      'International',
      'Général'
    ];
  }

  /**
   * 🎯 ENRICHISSEMENT COMPLET D'UN ARTICLE
   * Utilise le cache intelligent pour minimiser les appels IA
   * Coût fixe minimal grâce à l'enrichissement local
   */
  async enrichArticle(title, content, summary = '', source = '') {
    try {
      // 🧠 ÉTAPE 1: Vérifier le cache intelligent
      const cacheResult = await smartEnrichmentCache.getSmartEnrichment(title, content, summary, source);
      
      // Si cache hit ou enrichissement local suffisant, retourner directement
      if (cacheResult.source !== 'ai-required') {
        return cacheResult.enrichment;
      }
      
      // 🤖 ÉTAPE 2: Enrichissement IA requis (confiance locale insuffisante)
      console.log(`🤖 Enrichissement IA OBJECTIF: "${title.substring(0, 60)}..."`);
      
      // Utiliser plus de contenu pour une analyse factuelle complète
      const textToAnalyze = `${title}. ${summary || content.substring(0, 800)}`;
      
      const prompt = `Analyse cet article de presse gabonais de manière OBJECTIVE et FACTUELLE. Fournis les métadonnées suivantes au format JSON strict:

{
  "summary": "Résumé OBJECTIF en UNE SEULE PHRASE (max 150 caractères) - UNIQUEMENT les faits, sans opinion",
  "category": "une seule catégorie parmi: ${this.CATEGORIES.join(', ')}",
  "sentiment": "score de -1 (très négatif) à 1 (très positif), 0 = neutre",
  "importance": "score de 0 (peu important) à 1 (très important)",
  "is_breaking": "true si actualité urgente/breaking news, false sinon",
  "keywords": ["liste de 5 à 10 mots-clés pertinents pour recherche et alertes"],
  "tldr_points": ["Point clé 1 (max 15 mots)", "Point clé 2 (max 15 mots)", "Point clé 3 (max 15 mots)"]
}

Article à analyser:
${textToAnalyze}

⚠️ RÈGLES D'OBJECTIVITÉ STRICTES:
- RÉSUMÉ: Rapporte uniquement les FAITS présents dans l'article
  * NE PAS inventer de détails absents du texte
  * NE PAS ajouter d'interprétation personnelle
  * NE PAS prendre parti ou émettre d'opinion
  * Utilise un ton NEUTRE et FACTUEL
  * Max 150 caractères, phrase complète et claire
  
- SENTIMENT: Analyse le ton de l'article original (pas ton opinion)
  * Positif = article rapporte des succès, progrès, bonnes nouvelles
  * Négatif = article rapporte des problèmes, crises, mauvaises nouvelles
  * Neutre = article purement informatif sans connotation

- IMPORTANCE: Base-toi sur l'impact objectif de l'événement
  * Impact national/international = haute importance
  * Événements locaux routiniers = faible importance
  
- CATÉGORIE: Choisis selon le sujet principal traité

- MOTS-CLÉS: Extrait UNIQUEMENT les termes présents dans le texte
  * Noms de personnes, lieux, organisations mentionnés
  * Concepts clés explicitement abordés
  * NE PAS inventer de mots-clés absents du texte

- TL;DR (Too Long; Didn't Read): 3 points clés ESSENTIELS
  * Chaque point = 1 phrase courte et percutante (max 15 mots)
  * Verbes d'action au présent
  * Faits essentiels: QUI, QUOI, QUAND, OÙ
  * Économise le temps de lecture de l'utilisateur

Réponds UNIQUEMENT avec le JSON, aucun texte supplémentaire:`;

      const systemPrompt = 'Tu es un assistant OBJECTIF et NEUTRE spécialisé en analyse de presse gabonaise. Tu extrais uniquement les FAITS du texte fourni sans jamais inventer de détails, interpréter ou prendre parti. Tu réponds UNIQUEMENT avec du JSON valide.';

      // Appel via GeminiService (qui gère Gemini 3 Pro -> Fallback OpenAI)
      const enrichment = await geminiService.generateJSON(prompt, {
        systemPrompt,
        temperature: 0.1 // Température basse = plus déterministe et objectif
      });
      
      // Validation et normalisation
      const result = {
        ai_summary: this.validateSummary(enrichment.summary, title),
        ai_category: this.validateCategory(enrichment.category),
        ai_sentiment: this.normalizeSentiment(enrichment.sentiment),
        ai_importance: this.normalizeImportance(enrichment.importance),
        ai_is_breaking: Boolean(enrichment.is_breaking),
        ai_keywords: this.validateKeywords(enrichment.keywords),
        tldr_points: this.validateTLDRPoints(enrichment.tldr_points)
      };

      console.log(`✅ Enrichissement IA terminé:`, {
        summary: result.ai_summary?.substring(0, 50) + '...',
        category: result.ai_category,
        sentiment: result.ai_sentiment.toFixed(2),
        importance: result.ai_importance.toFixed(2),
        breaking: result.ai_is_breaking,
        keywords: result.ai_keywords.length,
        tldr: result.tldr_points?.length || 0
      });

      return result;

    } catch (error) {
      console.error(`❌ Erreur enrichissement IA:`, error.message);
      
      // Fallback vers analyse basique
      return this.getFallbackEnrichment(title, content, summary);
    }
  }

  /**
   * 🔄 ENRICHISSEMENT FALLBACK (sans IA)
   * Analyse basique si OpenAI n'est pas disponible
   */
  getFallbackEnrichment(title, content, summary = '') {
    const text = `${title} ${summary || content}`.toLowerCase();
    
    // Détection catégorie par mots-clés
    const categoryKeywords = {
      'Politique': ['président', 'gouvernement', 'ministre', 'assemblée', 'élection', 'parti', 'sénat', 'conseil', 'politique'],
      'Économie': ['économie', 'économique', 'finance', 'banque', 'inflation', 'croissance', 'pib', 'investissement', 'entreprise', 'budget'],
      'Sport': ['foot', 'football', 'sport', 'match', 'équipe', 'joueur', 'coupe', 'championnat', 'victoire'],
      'Santé': ['santé', 'médical', 'hôpital', 'maladie', 'patient', 'docteur', 'traitement', 'vaccination', 'épidémie'],
      'Culture': ['culture', 'art', 'artiste', 'musique', 'film', 'cinéma', 'festival', 'exposition'],
      'Éducation': ['école', 'éducation', 'université', 'étudiant', 'professeur', 'enseignement', 'formation'],
      'Justice': ['justice', 'tribunal', 'procès', 'juge', 'avocat', 'condamnation', 'affaire'],
      'Environnement': ['environnement', 'climat', 'pollution', 'écologie', 'nature', 'forêt', 'biodiversité'],
      'Technologie': ['technologie', 'numérique', 'digital', 'internet', 'innovation', 'application', 'startup']
    };

    let detectedCategory = 'Général';
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const score = keywords.filter(kw => text.includes(kw)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedCategory = category;
      }
    }

    // Détection sentiment basique
    const positiveWords = ['succès', 'victoire', 'progrès', 'amélioration', 'croissance', 'développement', 'inauguration'];
    const negativeWords = ['crise', 'problème', 'échec', 'défaite', 'corruption', 'décès', 'accident', 'arrestation'];
    
    const positiveCount = positiveWords.filter(w => text.includes(w)).length;
    const negativeCount = negativeWords.filter(w => text.includes(w)).length;
    
    const sentiment = positiveCount > negativeCount 
      ? 0.3 + (positiveCount * 0.1) 
      : negativeCount > positiveCount 
        ? -0.3 - (negativeCount * 0.1)
        : 0;

    // Détection importance
    const importanceKeywords = ['urgent', 'important', 'majeur', 'crucial', 'président', 'ministre', 'national'];
    const importanceScore = importanceKeywords.filter(kw => text.includes(kw)).length;
    const importance = Math.min(0.3 + (importanceScore * 0.15), 1.0);

    // Détection breaking news
    const breakingKeywords = ['urgent', 'alerte', 'breaking', 'flash', 'maintenant', 'direct'];
    const isBreaking = breakingKeywords.some(kw => text.includes(kw));

    // Extraction keywords basique
    const basicKeywords = this.extractBasicKeywords(text);

    // Générer un résumé basique (première phrase du texte)
    const fallbackSummary = this.generateFallbackSummary(title, summary, content);

    console.log(`🔄 Enrichissement fallback utilisé (catégorie: ${detectedCategory})`);

    // Générer un TL;DR basique à partir du titre et du résumé
    const tldrFallback = this.generateFallbackTLDR(title, summary, content);

    return {
      ai_summary: fallbackSummary,
      ai_category: detectedCategory,
      ai_sentiment: Math.max(-1, Math.min(1, sentiment)),
      ai_importance: importance,
      ai_is_breaking: isBreaking,
      ai_keywords: basicKeywords,
      tldr_points: tldrFallback
    };
  }

  /**
   * 📝 GÉNÉRATION TL;DR FALLBACK (sans IA)
   */
  generateFallbackTLDR(title, summary, content) {
    const text = summary || content || title;
    
    // Diviser en phrases
    const sentences = text
      .replace(/([.!?])\s+/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 150);
    
    // Prendre les 3 premières phrases significatives
    const points = sentences.slice(0, 3);
    
    // Si pas assez de phrases, utiliser le titre
    while (points.length < 3) {
      if (points.length === 0) {
        points.push(title);
      } else {
        points.push(`Voir l'article complet pour plus de détails`);
      }
    }
    
    return points;
  }

  /**
   * 📝 GÉNÉRATION RÉSUMÉ FALLBACK
   */
  generateFallbackSummary(title, summary, content) {
    // Utiliser le summary existant s'il est court
    if (summary && summary.length <= 150) {
      return summary;
    }
    
    // Sinon prendre les premiers mots du contenu
    const text = summary || content || title;
    const firstSentence = text.split(/[.!?]/)[0].trim();
    
    // Limiter à 150 caractères
    if (firstSentence.length <= 150) {
      return firstSentence;
    }
    
    return firstSentence.substring(0, 147) + '...';
  }

  /**
   * ✅ VALIDATION RÉSUMÉ
   */
  validateSummary(summary, title) {
    if (!summary || typeof summary !== 'string') {
      // Fallback sur le titre si pas de résumé
      return title.substring(0, 150);
    }
    
    const cleaned = summary.trim();
    
    // Limiter à 200 caractères max
    if (cleaned.length > 200) {
      return cleaned.substring(0, 197) + '...';
    }
    
    return cleaned;
  }

  /**
   * 🔑 EXTRACTION KEYWORDS BASIQUE (fallback)
   */
  extractBasicKeywords(text) {
    // Mots vides à ignorer
    const stopWords = new Set([
      'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
      'ce', 'ces', 'cet', 'cette', 'et', 'ou', 'mais', 'donc', 'car',
      'dans', 'sur', 'pour', 'avec', 'sans', 'par', 'est', 'sont',
      'été', 'être', 'avoir', 'fait', 'faire', 'peut', 'plus', 'tout'
    ]);

    // Diviser en mots et filtrer
    const words = text
      .toLowerCase()
      .replace(/[^\wàâäéèêëïîôùûüÿæœç\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopWords.has(w));

    // Compter fréquences
    const freq = {};
    words.forEach(w => {
      freq[w] = (freq[w] || 0) + 1;
    });

    // Trier par fréquence et garder top 8
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
  }

  /**
   * ✅ VALIDATION DE CATÉGORIE
   */
  validateCategory(category) {
    if (!category) return 'Général';
    
    // Normaliser la catégorie
    const normalized = category.trim();
    
    // Vérifier si la catégorie existe
    const validCategory = this.CATEGORIES.find(
      cat => cat.toLowerCase() === normalized.toLowerCase()
    );
    
    return validCategory || 'Général';
  }

  /**
   * 🔢 NORMALISATION SENTIMENT (-1 à 1)
   */
  normalizeSentiment(sentiment) {
    const value = typeof sentiment === 'string' ? parseFloat(sentiment) : sentiment;
    
    if (isNaN(value)) return 0;
    
    return Math.max(-1, Math.min(1, value));
  }

  /**
   * 🔢 NORMALISATION IMPORTANCE (0 à 1)
   */
  normalizeImportance(importance) {
    const value = typeof importance === 'string' ? parseFloat(importance) : importance;
    
    if (isNaN(value)) return 0.5;
    
    return Math.max(0, Math.min(1, value));
  }

  /**
   * 🔑 VALIDATION KEYWORDS
   */
  validateKeywords(keywords) {
    if (!keywords || !Array.isArray(keywords)) return [];
    
    // Nettoyer et valider chaque keyword
    return keywords
      .filter(kw => kw && typeof kw === 'string')
      .map(kw => kw.trim().toLowerCase())
      .filter(kw => kw.length >= 3 && kw.length <= 50) // Entre 3 et 50 caractères
      .slice(0, 10); // Maximum 10 keywords
  }

  /**
   * ⚡ VALIDATION TL;DR POINTS
   */
  validateTLDRPoints(points) {
    if (!points || !Array.isArray(points)) return null;
    
    // Nettoyer et valider chaque point
    const validPoints = points
      .filter(p => p && typeof p === 'string')
      .map(p => p.trim())
      .filter(p => p.length >= 10 && p.length <= 200) // Entre 10 et 200 caractères
      .slice(0, 3); // Maximum 3 points
    
    // Retourner null si moins de 3 points valides
    if (validPoints.length < 3) return null;
    
    return validPoints;
  }

  /**
   * 💰 ESTIMATION COÛT
   */
  estimateCost(articlesCount) {
    // gpt-4o-mini: $0.150 / 1M input tokens, $0.600 / 1M output tokens
    // Environ 200 tokens input + 50 tokens output par article
    const inputTokens = articlesCount * 200;
    const outputTokens = articlesCount * 50;
    
    const inputCost = (inputTokens / 1_000_000) * 0.150;
    const outputCost = (outputTokens / 1_000_000) * 0.600;
    
    return {
      totalCost: inputCost + outputCost,
      perArticle: (inputCost + outputCost) / articlesCount,
      articlesCount
    };
  }
}

module.exports = ArticleAIEnrichment;
