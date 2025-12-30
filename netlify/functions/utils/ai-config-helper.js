/**
 * 🤖 HELPER DE CONFIGURATION IA POUR NETLIFY FUNCTIONS
 * 
 * Récupère les modèles IA configurés dans la table pricing_config
 * et les applique aux fonctions Netlify.
 * 
 * Configuration via: /admin/tarification
 */

const fetch = require('node-fetch');

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
  audio_summary: { model: 'tts-1', credits: 5 },
  tldr_summary: { model: 'mistral-7b', credits: 0 },
  article_premium: { model: null, credits: 1 },
  
  // Veille
  opportunity_analysis: { model: 'llama-3.1-70b', credits: 15 },
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
  'llama-3.1-8b': 'replicate',
  'llama-3.1-70b': 'replicate',
  'llama-3.1-405b': 'replicate',
  'mistral-7b': 'replicate',
  'mixtral-8x7b': 'replicate',
};

/**
 * Récupère la configuration depuis Supabase
 */
async function fetchConfigFromDB() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ AIConfigHelper: Supabase non configuré');
    return null;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/pricing_config?is_active=eq.true&select=feature_key,ai_model,credits_cost`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn('⚠️ AIConfigHelper: Erreur fetch config:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data && data.length > 0) {
      const config = {};
      data.forEach(item => {
        config[item.feature_key] = {
          model: item.ai_model,
          credits: item.credits_cost
        };
      });
      return config;
    }
  } catch (err) {
    console.error('❌ AIConfigHelper: Erreur:', err.message);
  }
  
  return null;
}

/**
 * Récupère la configuration avec cache
 */
async function getConfig() {
  const now = Date.now();
  
  // Retourner le cache si valide
  if (configCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return configCache;
  }

  // Essayer de charger depuis la DB
  const dbConfig = await fetchConfigFromDB();
  
  if (dbConfig) {
    configCache = dbConfig;
    cacheTimestamp = now;
    console.log('✅ AIConfigHelper: Configuration chargée depuis DB');
    return dbConfig;
  }

  // Fallback aux valeurs par défaut
  console.log('⚠️ AIConfigHelper: Utilisation de la configuration par défaut');
  return DEFAULT_CONFIG;
}

/**
 * Récupère le modèle IA pour une fonctionnalité
 * @param {string} featureKey - Clé de la fonctionnalité (ex: 'initial_analysis')
 * @returns {Promise<string|null>} - Nom du modèle ou null
 */
async function getModel(featureKey) {
  const config = await getConfig();
  return config[featureKey]?.model || DEFAULT_CONFIG[featureKey]?.model || null;
}

/**
 * Récupère le coût en crédits pour une fonctionnalité
 * @param {string} featureKey - Clé de la fonctionnalité
 * @returns {Promise<number>} - Coût en crédits
 */
async function getCredits(featureKey) {
  const config = await getConfig();
  return config[featureKey]?.credits ?? DEFAULT_CONFIG[featureKey]?.credits ?? 0;
}

/**
 * Récupère le provider pour un modèle
 * @param {string} model - Nom du modèle
 * @returns {string} - Provider (openai, gemini, replicate)
 */
function getProvider(model) {
  return MODEL_PROVIDERS[model] || 'openai';
}

/**
 * Vérifie si un modèle est de type Gemini
 */
function isGemini(model) {
  return getProvider(model) === 'gemini';
}

/**
 * Vérifie si un modèle est de type Replicate (Llama, Mistral)
 */
function isReplicate(model) {
  return getProvider(model) === 'replicate';
}

/**
 * Vérifie si un modèle est de type OpenAI
 */
function isOpenAI(model) {
  return getProvider(model) === 'openai';
}

/**
 * Invalide le cache
 */
function invalidateCache() {
  configCache = null;
  cacheTimestamp = 0;
}

/**
 * Récupère la configuration complète d'une fonctionnalité
 */
async function getFeatureConfig(featureKey) {
  const config = await getConfig();
  const featureConfig = config[featureKey] || DEFAULT_CONFIG[featureKey];
  
  if (!featureConfig) {
    return null;
  }

  return {
    model: featureConfig.model,
    credits: featureConfig.credits,
    provider: featureConfig.model ? getProvider(featureConfig.model) : null
  };
}

module.exports = {
  getConfig,
  getModel,
  getCredits,
  getProvider,
  getFeatureConfig,
  isGemini,
  isReplicate,
  isOpenAI,
  invalidateCache,
  MODEL_PROVIDERS,
  DEFAULT_CONFIG
};
