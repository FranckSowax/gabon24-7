/**
 * 🤖 SERVICE DE CONFIGURATION IA CENTRALISÉ
 * 
 * Récupère les modèles IA configurés dans la table pricing_config
 * et les applique à toutes les fonctionnalités de l'application.
 * 
 * Configuration via: /admin/tarification
 */

const { supabase } = require('../config/supabase');

// Cache de la configuration (5 minutes)
let configCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Configuration par défaut (fallback si DB indisponible)
const DEFAULT_CONFIG = {
  // Business
  initial_analysis: { model: 'gemini-3-pro', credits: 30 },
  re_analysis: { model: 'gpt-4-turbo-preview', credits: 25 },
  action_plan: { model: 'gpt-4-turbo-preview', credits: 25 },
  skill_test: { model: 'gemini-3-pro', credits: 30 },
  custom_training: { model: 'gemini-3-pro', credits: 50 },
  business_plan: { model: 'gemini-3-pro', credits: 100 },
  motivation_letter: { model: 'gemini-3-pro', credits: 20 },
  sponsored_article: { model: 'gemini-3-pro', credits: 50 },
  
  // Chat
  chat_message: { model: 'gpt-4o-mini', credits: 2 },
  document_analysis: { model: 'gpt-4-turbo-preview', credits: 15 },
  
  // Content
  ai_analysis: { model: 'gemini-3-pro', credits: 10 },
  audio_summary: { model: 'gemini-3-pro', credits: 5 }, // Migrated to Gemini
  tldr_summary: { model: 'gemini-3-pro', credits: 0 },  // Migrated to Gemini
  article_premium: { model: null, credits: 1 },
  
  // Veille
  opportunity_analysis: { model: 'gemini-3-pro', credits: 15 }, // Migrated from llama/replicate
  veille_report: { model: 'gpt-4-turbo-preview', credits: 20 },
  custom_alert: { model: null, credits: 3 },
};

// Mapping des modèles vers les providers
const MODEL_PROVIDERS = {
  'gpt-4-turbo-preview': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-3.5-turbo': 'openai',
  'tts-1': 'openai',
  'tts-1-hd': 'openai',
  'whisper-1': 'openai',
  'gemini-3-pro': 'gemini',
  'gemini-1.5-pro': 'gemini',
  'gemini-1.5-flash': 'gemini',
  'llama-3.1-8b': 'replicate',
  'llama-3.1-70b': 'replicate',
  'llama-3.1-405b': 'replicate',
  'mistral-7b': 'replicate',
  'mixtral-8x7b': 'replicate',
};

class AIConfigService {
  constructor() {
    this.supabase = null;
    this.initSupabase();
  }

  initSupabase() {
    if (supabase) {
      this.supabase = supabase;
    } else {
      console.warn('⚠️ AIConfigService: Supabase non configuré, utilisation des valeurs par défaut');
    }
  }

  /**
   * Récupère la configuration depuis la DB avec cache
   */
  async getConfig() {
    const now = Date.now();
    
    // Retourner le cache si valide
    if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return configCache;
    }

    // Essayer de charger depuis la DB
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('pricing_config')
          .select('feature_key, ai_model, credits_cost')
          .eq('is_active', true);

        if (!error && data && data.length > 0) {
          const config = {};
          data.forEach(item => {
            config[item.feature_key] = {
              model: item.ai_model,
              credits: item.credits_cost
            };
          });
          
          configCache = config;
          cacheTimestamp = now;
          console.log('✅ AIConfigService: Configuration chargée depuis DB');
          return config;
        }
      } catch (err) {
        console.error('❌ AIConfigService: Erreur chargement config:', err.message);
      }
    }

    // Fallback aux valeurs par défaut
    console.log('⚠️ AIConfigService: Utilisation de la configuration par défaut');
    return DEFAULT_CONFIG;
  }

  /**
   * Récupère le modèle IA pour une fonctionnalité
   * @param {string} featureKey - Clé de la fonctionnalité (ex: 'initial_analysis')
   * @returns {Promise<string|null>} - Nom du modèle ou null
   */
  async getModel(featureKey) {
    const config = await this.getConfig();
    return config[featureKey]?.model || DEFAULT_CONFIG[featureKey]?.model || null;
  }

  /**
   * Récupère le coût en crédits pour une fonctionnalité
   * @param {string} featureKey - Clé de la fonctionnalité
   * @returns {Promise<number>} - Coût en crédits
   */
  async getCredits(featureKey) {
    const config = await this.getConfig();
    return config[featureKey]?.credits ?? DEFAULT_CONFIG[featureKey]?.credits ?? 0;
  }

  /**
   * Récupère le provider pour un modèle
   * @param {string} model - Nom du modèle
   * @returns {string} - Provider (openai, gemini, replicate)
   */
  getProvider(model) {
    return MODEL_PROVIDERS[model] || 'openai';
  }

  /**
   * Vérifie si un modèle est de type Gemini
   */
  isGemini(model) {
    return this.getProvider(model) === 'gemini';
  }

  /**
   * Vérifie si un modèle est de type Replicate (Llama, Mistral)
   */
  isReplicate(model) {
    return this.getProvider(model) === 'replicate';
  }

  /**
   * Vérifie si un modèle est de type OpenAI
   */
  isOpenAI(model) {
    return this.getProvider(model) === 'openai';
  }

  /**
   * Invalide le cache (à appeler après modification de la config)
   */
  invalidateCache() {
    configCache = null;
    cacheTimestamp = 0;
    console.log('🔄 AIConfigService: Cache invalidé');
  }

  /**
   * Récupère la configuration complète d'une fonctionnalité
   */
  async getFeatureConfig(featureKey) {
    const config = await this.getConfig();
    const featureConfig = config[featureKey] || DEFAULT_CONFIG[featureKey];
    
    if (!featureConfig) {
      return null;
    }

    return {
      model: featureConfig.model,
      credits: featureConfig.credits,
      provider: featureConfig.model ? this.getProvider(featureConfig.model) : null
    };
  }
}

// Singleton
const aiConfigService = new AIConfigService();

module.exports = aiConfigService;
module.exports.AIConfigService = AIConfigService;
module.exports.MODEL_PROVIDERS = MODEL_PROVIDERS;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
