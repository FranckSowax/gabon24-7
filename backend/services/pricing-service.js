/**
 * 💰 PRICING SERVICE - Service centralisé de tarification
 * Charge les tarifs depuis Supabase (pricing_config) et les met en cache
 * Utilisé par toutes les routes IA pour le débit de crédits
 */

const supabaseService = require('../supabase-config');

// Cache local des tarifs
let pricingCache = new Map();
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Valeurs par défaut si la table pricing_config n'existe pas
 * Basées sur coûts IA réels (Gemini 2.0 Flash, GPT-4o-mini, OpenAI TTS-1)
 * 1 crédit = 10 FCFA | Marge x40-80 sur coûts API
 */
const DEFAULT_PRICING = {
  // Business & Projets
  initial_analysis: { credits: 25, model: 'gemini-2.0-flash', category: 'business' },
  re_analysis: { credits: 25, model: 'gemini-2.0-flash', category: 'business' },
  action_plan: { credits: 25, model: 'gemini-2.0-flash', category: 'business' },
  skill_test: { credits: 30, model: 'gemini-2.0-flash', category: 'business' },
  custom_training: { credits: 50, model: 'gemini-2.0-flash', category: 'business' },
  business_plan: { credits: 100, model: 'gpt-4-turbo', category: 'business' },
  motivation_letter: { credits: 20, model: 'gemini-2.0-flash', category: 'business' },
  sponsored_article: { credits: 50, model: 'gemini-2.0-flash', category: 'business' },
  generate_document: { credits: 15, model: 'gemini-2.0-flash', category: 'business' },

  // Articles & Contenu
  article_premium: { credits: 1, model: null, category: 'content' },
  audio_summary: { credits: 20, model: 'tts-1', category: 'content' },
  ai_analysis: { credits: 10, model: 'gemini-2.0-flash', category: 'content' },
  tldr_summary: { credits: 0, model: 'gemini-2.0-flash', category: 'content' }, // GRATUIT

  // Veille & Alertes
  veille_report: { credits: 20, model: 'gpt-4-turbo', category: 'veille' },
  custom_alert: { credits: 3, model: null, category: 'veille' },
  opportunity_analysis: { credits: 15, model: 'gemini-2.0-flash', category: 'veille' },

  // Chat & Assistant
  chat_message: { credits: 2, model: 'gpt-4o-mini', category: 'chat' },
  document_analysis: { credits: 15, model: 'gpt-4-turbo', category: 'chat' },

  // Génération IA (routes/ai.js)
  generate_article: { credits: 50, model: 'gemini-2.0-flash', category: 'business' },
  generate_description: { credits: 10, model: 'gemini-2.0-flash', category: 'business' },
  generate_titles: { credits: 5, model: 'gemini-2.0-flash', category: 'business' },
  improve_text: { credits: 10, model: 'gemini-2.0-flash', category: 'content' },
  analyze_text: { credits: 10, model: 'gemini-2.0-flash', category: 'content' },
};

/**
 * Mapping des noms de service (anciens) vers les clés pricing_config
 */
const SERVICE_KEY_MAPPING = {
  // Routes opportunities.js
  'analyze-opportunity': 'opportunity_analysis',
  'generate-proposals': 'opportunity_analysis',
  'enrich-opportunity': 'opportunity_analysis',

  // Routes action-plans.js
  'action-plan': 'action_plan',

  // Routes skill-test.js
  'skill-test': 'skill_test',

  // Routes training.js
  'custom-training': 'custom_training',

  // Routes generate-letter.js
  'motivation-letter': 'motivation_letter',

  // Routes ai.js
  'generate-article': 'generate_article',
  'sponsored-article': 'sponsored_article',
  'generate-description': 'generate_description',
  'generate-titles': 'generate_titles',
  'improve-text': 'improve_text',
  'analyze-text': 'analyze_text',
  'generate-document': 'generate_document',

  // Routes audio.js
  'audio-summary': 'audio_summary',
  'audio_summary': 'audio_summary',

  // Routes tldr.js
  'tldr': 'tldr_summary',
  'tldr_summary': 'tldr_summary',

  // Routes project-chat.js
  'chat-message': 'chat_message',
  'document-analysis': 'document_analysis',

  // Legacy mappings
  'ai_analysis': 'ai_analysis',
  'ai-analysis': 'ai_analysis',
  'ai_summary': 'ai_analysis',
  'competitive_analysis': 'business_plan',
};

/**
 * Charger les tarifs depuis Supabase
 */
async function loadPricingFromDB() {
  try {
    const { data, error } = await supabaseService.supabase
      .from('pricing_config')
      .select('feature_key, feature_name, credits_cost, ai_model, is_active, category')
      .eq('is_active', true);

    if (error) {
      console.warn('⚠️ Table pricing_config non trouvée, utilisation des valeurs par défaut');
      return false;
    }

    // Mettre à jour le cache
    pricingCache.clear();
    for (const item of data || []) {
      pricingCache.set(item.feature_key, {
        credits: item.credits_cost,
        model: item.ai_model,
        category: item.category,
        name: item.feature_name,
        isActive: item.is_active
      });
    }
    cacheTimestamp = Date.now();

    console.log(`✅ ${pricingCache.size} tarifs chargés depuis pricing_config`);
    return true;
  } catch (error) {
    console.error('❌ Erreur loadPricingFromDB:', error);
    return false;
  }
}

/**
 * Vérifier si le cache est valide
 */
function isCacheValid() {
  return pricingCache.size > 0 && (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

/**
 * Obtenir le coût en crédits d'un service
 * @param {string} serviceName - Nom du service (ex: 'analyze-opportunity', 'audio-summary')
 * @returns {Promise<number>} Coût en crédits
 */
async function getServiceCost(serviceName) {
  // Recharger le cache si nécessaire
  if (!isCacheValid()) {
    await loadPricingFromDB();
  }

  // Mapper le nom du service vers la clé pricing_config
  const featureKey = SERVICE_KEY_MAPPING[serviceName] || serviceName;

  // Chercher dans le cache
  const cached = pricingCache.get(featureKey);
  if (cached) {
    return cached.credits;
  }

  // Fallback sur les valeurs par défaut
  const defaultConfig = DEFAULT_PRICING[featureKey];
  if (defaultConfig) {
    return defaultConfig.credits;
  }

  console.warn(`⚠️ Service inconnu: ${serviceName} (clé: ${featureKey}), coût par défaut: 10`);
  return 10; // Coût par défaut si non trouvé
}

/**
 * Obtenir la configuration complète d'un service
 * @param {string} serviceName - Nom du service
 * @returns {Promise<{credits: number, model: string|null, category: string, isActive: boolean}>}
 */
async function getServiceConfig(serviceName) {
  if (!isCacheValid()) {
    await loadPricingFromDB();
  }

  const featureKey = SERVICE_KEY_MAPPING[serviceName] || serviceName;

  // Chercher dans le cache
  const cached = pricingCache.get(featureKey);
  if (cached) {
    return cached;
  }

  // Fallback sur les valeurs par défaut
  const defaultConfig = DEFAULT_PRICING[featureKey];
  if (defaultConfig) {
    return {
      ...defaultConfig,
      isActive: true
    };
  }

  return {
    credits: 10,
    model: 'gemini-2.0-flash',
    category: 'other',
    isActive: true
  };
}

/**
 * Vérifier si un service est actif (peut être désactivé via admin)
 * @param {string} serviceName - Nom du service
 * @returns {Promise<boolean>}
 */
async function isServiceActive(serviceName) {
  const config = await getServiceConfig(serviceName);
  return config.isActive;
}

/**
 * Vérifier si un service est gratuit
 * @param {string} serviceName - Nom du service
 * @returns {Promise<boolean>}
 */
async function isServiceFree(serviceName) {
  const cost = await getServiceCost(serviceName);
  return cost === 0;
}

/**
 * Obtenir tous les tarifs (pour API/affichage)
 * @returns {Promise<Array>}
 */
async function getAllPricing() {
  if (!isCacheValid()) {
    await loadPricingFromDB();
  }

  // Combiner cache et valeurs par défaut
  const result = [];

  // D'abord les valeurs du cache (DB)
  for (const [key, config] of pricingCache) {
    result.push({
      feature_key: key,
      ...config
    });
  }

  // Ensuite les valeurs par défaut non présentes dans le cache
  for (const [key, config] of Object.entries(DEFAULT_PRICING)) {
    if (!pricingCache.has(key)) {
      result.push({
        feature_key: key,
        credits: config.credits,
        model: config.model,
        category: config.category,
        isActive: true,
        isDefault: true
      });
    }
  }

  return result;
}

/**
 * Obtenir la valeur du crédit en FCFA
 * @returns {Promise<number>}
 */
async function getCreditValueFCFA() {
  try {
    const { data, error } = await supabaseService.supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'credit_value_fcfa')
      .single();

    if (error || !data) {
      return 10; // Valeur par défaut: 1 crédit = 10 FCFA
    }

    return parseInt(data.value) || 10;
  } catch (error) {
    console.error('❌ Erreur getCreditValueFCFA:', error);
    return 10;
  }
}

/**
 * Forcer le rechargement du cache
 */
async function refreshCache() {
  cacheTimestamp = 0;
  await loadPricingFromDB();
}

/**
 * Obtenir le coût de manière synchrone (utilise le cache)
 * À utiliser uniquement après que loadPricingFromDB() a été appelé
 * @param {string} serviceName - Nom du service
 * @returns {number}
 */
function getServiceCostSync(serviceName) {
  const featureKey = SERVICE_KEY_MAPPING[serviceName] || serviceName;
  const cached = pricingCache.get(featureKey);
  if (cached) {
    return cached.credits;
  }
  const defaultConfig = DEFAULT_PRICING[featureKey];
  return defaultConfig?.credits || 10;
}

// Initialiser le cache au démarrage
loadPricingFromDB().then(() => {
  console.log('💰 Pricing service initialisé');
}).catch(err => {
  console.warn('⚠️ Pricing service: utilisation des valeurs par défaut');
});

module.exports = {
  getServiceCost,
  getServiceConfig,
  isServiceActive,
  isServiceFree,
  getAllPricing,
  getCreditValueFCFA,
  refreshCache,
  getServiceCostSync,
  loadPricingFromDB,
  SERVICE_KEY_MAPPING,
  DEFAULT_PRICING
};
