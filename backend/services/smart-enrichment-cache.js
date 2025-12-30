/**
 * 🧠 CACHE INTELLIGENT D'ENRICHISSEMENT IA
 * 
 * Optimise les coûts en:
 * 1. Réutilisant les enrichissements similaires (même source/catégorie)
 * 2. Utilisant l'enrichissement local pour articles simples
 * 3. Batch processing pour réduire les appels API
 * 4. Cache en mémoire + persistance Supabase
 * 
 * OBJECTIF: Réduire les coûts IA de 70-80%
 */

const crypto = require('crypto');
const supabaseService = require('../supabase-config');

class SmartEnrichmentCache {
  constructor() {
    // Cache en mémoire (TTL: 24h)
    this.memoryCache = new Map();
    this.MEMORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures
    
    // Statistiques
    this.stats = {
      hits: 0,
      misses: 0,
      localEnrichments: 0,
      aiEnrichments: 0,
      savedCost: 0
    };
    
    // Coût estimé par enrichissement IA (Gemini 3 Pro)
    this.COST_PER_AI_ENRICHMENT = 0.004; // $0.004 par article
    
    // Seuils pour enrichissement local vs IA
    this.LOCAL_ENRICHMENT_CONFIDENCE_THRESHOLD = 0.7;
    
    // Patterns de catégories avec mots-clés pondérés
    this.categoryPatterns = {
      'Politique': {
        keywords: ['président', 'gouvernement', 'ministre', 'assemblée', 'élection', 'parti', 'sénat', 'conseil', 'politique', 'oligui', 'nguema', 'bongo', 'député', 'vote', 'loi', 'décret'],
        weight: 1.5
      },
      'Économie': {
        keywords: ['économie', 'économique', 'finance', 'banque', 'inflation', 'croissance', 'pib', 'investissement', 'entreprise', 'budget', 'fcfa', 'milliard', 'million', 'commerce', 'export', 'import', 'pétrole', 'manganèse'],
        weight: 1.3
      },
      'Sport': {
        keywords: ['foot', 'football', 'sport', 'match', 'équipe', 'joueur', 'coupe', 'championnat', 'victoire', 'panthères', 'fegafoot', 'can', 'ligue', 'stade', 'but', 'entraîneur'],
        weight: 1.4
      },
      'Santé': {
        keywords: ['santé', 'médical', 'hôpital', 'maladie', 'patient', 'docteur', 'traitement', 'vaccination', 'épidémie', 'covid', 'paludisme', 'clinique', 'médicament'],
        weight: 1.2
      },
      'Culture': {
        keywords: ['culture', 'art', 'artiste', 'musique', 'film', 'cinéma', 'festival', 'exposition', 'concert', 'danse', 'tradition', 'patrimoine'],
        weight: 1.1
      },
      'Éducation': {
        keywords: ['école', 'éducation', 'université', 'étudiant', 'professeur', 'enseignement', 'formation', 'baccalauréat', 'examen', 'diplôme', 'bourse'],
        weight: 1.2
      },
      'Société': {
        keywords: ['société', 'social', 'population', 'communauté', 'famille', 'jeunesse', 'femme', 'enfant', 'quartier', 'libreville', 'port-gentil'],
        weight: 1.0
      },
      'Justice': {
        keywords: ['justice', 'tribunal', 'procès', 'juge', 'avocat', 'condamnation', 'affaire', 'prison', 'arrestation', 'enquête', 'corruption'],
        weight: 1.3
      },
      'Environnement': {
        keywords: ['environnement', 'climat', 'pollution', 'écologie', 'nature', 'forêt', 'biodiversité', 'parc', 'lopé', 'ivindo', 'faune', 'flore'],
        weight: 1.1
      },
      'Technologie': {
        keywords: ['technologie', 'numérique', 'digital', 'internet', 'innovation', 'application', 'startup', 'mobile', 'fibre', 'réseau'],
        weight: 1.2
      },
      'Énergie': {
        keywords: ['énergie', 'électricité', 'pétrole', 'gaz', 'seeg', 'barrage', 'solaire', 'hydrocarbure', 'raffinerie'],
        weight: 1.2
      },
      'Transport': {
        keywords: ['transport', 'route', 'avion', 'aéroport', 'train', 'transgabonais', 'setrag', 'port', 'owendo', 'circulation'],
        weight: 1.1
      },
      'International': {
        keywords: ['international', 'afrique', 'cemac', 'union africaine', 'onu', 'france', 'chine', 'diplomatie', 'coopération', 'ambassade'],
        weight: 1.0
      }
    };
    
    // Sources connues avec catégories par défaut
    this.sourceDefaults = {
      'AGP': { defaultCategory: 'Politique', trustScore: 0.9 },
      'Gabon Actu': { defaultCategory: 'Société', trustScore: 0.85 },
      'L\'Union': { defaultCategory: 'Société', trustScore: 0.9 },
      'Gabon Review': { defaultCategory: 'Politique', trustScore: 0.85 },
      'Gabon Media Time': { defaultCategory: 'Société', trustScore: 0.8 },
      'Direct Infos Gabon': { defaultCategory: 'Société', trustScore: 0.8 },
      'Gabon Eco': { defaultCategory: 'Économie', trustScore: 0.9 },
      'Sport241': { defaultCategory: 'Sport', trustScore: 0.95 },
      'RFI': { defaultCategory: 'International', trustScore: 0.95 }
    };
  }

  /**
   * 🔑 Génère une clé de cache unique pour un article
   */
  generateCacheKey(title, source) {
    const normalized = `${title.toLowerCase().trim()}-${(source || '').toLowerCase()}`;
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * 🧠 Enrichissement intelligent avec cache multi-niveaux
   * Retourne: { enrichment, source: 'cache'|'local'|'ai', confidence }
   */
  async getSmartEnrichment(title, content, summary, source) {
    const cacheKey = this.generateCacheKey(title, source);
    
    // 1. Vérifier cache mémoire
    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < this.MEMORY_TTL_MS) {
      this.stats.hits++;
      this.stats.savedCost += this.COST_PER_AI_ENRICHMENT;
      console.log(`💾 Cache mémoire HIT: "${title.substring(0, 40)}..."`);
      return { enrichment: memoryCached.data, source: 'memory-cache', confidence: 1.0 };
    }

    // 2. Vérifier cache Supabase (articles similaires enrichis)
    const dbCached = await this.checkDatabaseCache(title, source);
    if (dbCached) {
      this.stats.hits++;
      this.stats.savedCost += this.COST_PER_AI_ENRICHMENT;
      // Sauvegarder en mémoire pour accès rapide
      this.memoryCache.set(cacheKey, { data: dbCached, timestamp: Date.now() });
      console.log(`🗄️ Cache DB HIT: "${title.substring(0, 40)}..."`);
      return { enrichment: dbCached, source: 'db-cache', confidence: 0.95 };
    }

    // 3. Tenter enrichissement local (sans IA)
    const localResult = this.tryLocalEnrichment(title, content, summary, source);
    if (localResult.confidence >= this.LOCAL_ENRICHMENT_CONFIDENCE_THRESHOLD) {
      this.stats.localEnrichments++;
      this.stats.savedCost += this.COST_PER_AI_ENRICHMENT;
      // Sauvegarder en cache
      this.memoryCache.set(cacheKey, { data: localResult.enrichment, timestamp: Date.now() });
      console.log(`🏠 Enrichissement LOCAL (${(localResult.confidence * 100).toFixed(0)}%): "${title.substring(0, 40)}..." → ${localResult.enrichment.ai_category}`);
      return { enrichment: localResult.enrichment, source: 'local', confidence: localResult.confidence };
    }

    // 4. Enrichissement IA requis
    this.stats.misses++;
    this.stats.aiEnrichments++;
    console.log(`🤖 Enrichissement IA requis: "${title.substring(0, 40)}..." (confiance locale: ${(localResult.confidence * 100).toFixed(0)}%)`);
    return { enrichment: null, source: 'ai-required', confidence: localResult.confidence, localFallback: localResult.enrichment };
  }

  /**
   * 🗄️ Vérifie le cache en base de données
   */
  async checkDatabaseCache(title, source) {
    try {
      // Chercher un article similaire déjà enrichi (même source, titre similaire)
      const { data: similar } = await supabaseService.supabase
        .from('articles')
        .select('category, sentiment, keywords')
        .eq('source', source)
        .not('category', 'is', null)
        .ilike('title', `%${title.split(' ').slice(0, 3).join('%')}%`)
        .limit(1)
        .maybeSingle();

      if (similar && similar.category) {
        return {
          ai_category: similar.category,
          ai_sentiment: similar.sentiment || 0,
          ai_importance: 0.5,
          ai_is_breaking: false,
          ai_keywords: similar.keywords || [],
          ai_summary: null
        };
      }
      return null;
    } catch (error) {
      console.warn('⚠️ Erreur cache DB:', error.message);
      return null;
    }
  }

  /**
   * 🏠 Enrichissement local (sans appel IA)
   */
  tryLocalEnrichment(title, content, summary, source) {
    const text = `${title} ${summary || ''} ${(content || '').substring(0, 500)}`.toLowerCase();
    
    // Calcul des scores par catégorie
    const categoryScores = {};
    let maxScore = 0;
    let bestCategory = 'Général';
    
    for (const [category, config] of Object.entries(this.categoryPatterns)) {
      let score = 0;
      let matchedKeywords = 0;
      
      for (const keyword of config.keywords) {
        if (text.includes(keyword)) {
          score += config.weight;
          matchedKeywords++;
        }
      }
      
      // Normaliser le score
      const normalizedScore = matchedKeywords > 0 
        ? (score / config.keywords.length) * (matchedKeywords / 3)
        : 0;
      
      categoryScores[category] = normalizedScore;
      
      if (normalizedScore > maxScore) {
        maxScore = normalizedScore;
        bestCategory = category;
      }
    }

    // Bonus si la source a une catégorie par défaut correspondante
    const sourceConfig = this.sourceDefaults[source];
    if (sourceConfig && sourceConfig.defaultCategory === bestCategory) {
      maxScore *= 1.2; // Boost de 20%
    }

    // Calcul du sentiment
    const sentiment = this.calculateLocalSentiment(text);
    
    // Calcul de l'importance
    const importance = this.calculateLocalImportance(text, title);
    
    // Détection breaking news
    const isBreaking = this.detectBreakingNews(text, title);
    
    // Extraction keywords
    const keywords = this.extractLocalKeywords(text);

    // Calcul de la confiance globale
    const confidence = Math.min(maxScore * 1.5, 0.95);

    return {
      confidence,
      enrichment: {
        ai_category: bestCategory,
        ai_sentiment: sentiment,
        ai_importance: importance,
        ai_is_breaking: isBreaking,
        ai_keywords: keywords,
        ai_summary: null // Pas de résumé en local
      }
    };
  }

  /**
   * 😊😐😢 Calcul du sentiment local
   */
  calculateLocalSentiment(text) {
    const positiveWords = [
      'succès', 'victoire', 'progrès', 'amélioration', 'croissance', 
      'développement', 'inauguration', 'félicitations', 'réussite',
      'accord', 'partenariat', 'investissement', 'création', 'lancement'
    ];
    const negativeWords = [
      'crise', 'problème', 'échec', 'défaite', 'corruption', 
      'décès', 'accident', 'arrestation', 'condamnation', 'grève',
      'manifestation', 'violence', 'incendie', 'catastrophe', 'pénurie'
    ];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of positiveWords) {
      if (text.includes(word)) positiveCount++;
    }
    for (const word of negativeWords) {
      if (text.includes(word)) negativeCount++;
    }
    
    if (positiveCount === 0 && negativeCount === 0) return 0;
    
    const total = positiveCount + negativeCount;
    return ((positiveCount - negativeCount) / total) * 0.8;
  }

  /**
   * ⭐ Calcul de l'importance locale
   */
  calculateLocalImportance(text, title) {
    const highImportanceKeywords = [
      'président', 'ministre', 'gouvernement', 'national', 'urgent',
      'milliard', 'million', 'accord', 'signature', 'inauguration',
      'décès', 'arrestation', 'élection', 'nomination', 'démission'
    ];
    
    let score = 0.3; // Base
    
    for (const keyword of highImportanceKeywords) {
      if (text.includes(keyword)) score += 0.1;
      if (title.toLowerCase().includes(keyword)) score += 0.15; // Bonus titre
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * 🚨 Détection breaking news
   */
  detectBreakingNews(text, title) {
    const breakingKeywords = [
      'urgent', 'alerte', 'breaking', 'flash', 'maintenant', 
      'direct', 'dernière minute', 'vient de', 'à l\'instant'
    ];
    
    const titleLower = title.toLowerCase();
    
    for (const keyword of breakingKeywords) {
      if (titleLower.includes(keyword) || text.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 🔑 Extraction keywords locale
   */
  extractLocalKeywords(text) {
    const stopWords = new Set([
      'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
      'ce', 'ces', 'cet', 'cette', 'et', 'ou', 'mais', 'donc', 'car',
      'dans', 'sur', 'pour', 'avec', 'sans', 'par', 'est', 'sont',
      'été', 'être', 'avoir', 'fait', 'faire', 'peut', 'plus', 'tout',
      'qui', 'que', 'quoi', 'dont', 'où', 'comme', 'aussi', 'bien'
    ]);

    const words = text
      .replace(/[^\wàâäéèêëïîôùûüÿæœç\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 4 && !stopWords.has(w));

    const freq = {};
    words.forEach(w => {
      freq[w] = (freq[w] || 0) + 1;
    });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
  }

  /**
   * 💾 Sauvegarder un enrichissement IA dans le cache
   */
  saveToCache(title, source, enrichment) {
    const cacheKey = this.generateCacheKey(title, source);
    this.memoryCache.set(cacheKey, { 
      data: enrichment, 
      timestamp: Date.now() 
    });
  }

  /**
   * 📊 Obtenir les statistiques du cache
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;
    
    return {
      ...this.stats,
      total,
      hitRate: `${hitRate}%`,
      memoryCacheSize: this.memoryCache.size,
      estimatedMonthlySavings: `$${(this.stats.savedCost * 30).toFixed(2)}`
    };
  }

  /**
   * 🧹 Nettoyer le cache expiré
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.memoryCache.entries()) {
      if (now - value.timestamp > this.MEMORY_TTL_MS) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cache nettoyé: ${cleaned} entrées expirées supprimées`);
    }
    
    return cleaned;
  }
}

// Singleton
const smartEnrichmentCache = new SmartEnrichmentCache();

module.exports = smartEnrichmentCache;
