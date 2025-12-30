const OpenAI = require('openai');

/**
 * Service de gestion et monitoring du quota OpenAI
 * Combine le système de crédits interne avec les coûts réels OpenAI
 */

// Coûts estimés en dollars par service (basé sur GPT-4o et GPT-4-turbo)
const OPENAI_COSTS = {
  'analyze-opportunity': 0.015,        // ~$0.015 par analyse (prompt moyen)
  'generate-proposals': 0.025,         // ~$0.025 par génération de propositions
  'skill-test': 0.040,                 // ~$0.040 par test (10 questions + explications)
  'action-plan': 0.035,                // ~$0.035 par plan (10 actions détaillées)
  'custom-training': 0.080,            // ~$0.080 par formation complète
  'business-plan': 0.150,              // ~$0.150 par business plan complet
  'enrich-opportunity': 0.020,         // ~$0.020 par enrichissement
  'ai-summary': 0.005,                 // ~$0.005 par résumé simple
  'default': 0.010                     // Coût par défaut
};

// Budget mensuel OpenAI en dollars (à configurer selon votre plan)
const MONTHLY_BUDGET = parseFloat(process.env.OPENAI_MONTHLY_BUDGET || '100');

// État du quota (en mémoire, réinitialisé au redémarrage)
let quotaState = {
  status: 'ok',                        // ok | warning | critical | exhausted
  lastCheck: null,
  estimatedSpent: 0,
  requestsToday: 0,
  requestsThisHour: 0,
  lastResetDate: new Date().toISOString().split('T')[0],
  lastResetHour: new Date().getHours(),
  errors: [],
  totalRequests: 0
};

/**
 * Récupère le coût estimé pour un service
 */
function getServiceCost(serviceName) {
  return OPENAI_COSTS[serviceName] || OPENAI_COSTS['default'];
}

/**
 * Vérifie si le quota OpenAI permet une nouvelle requête
 */
function checkQuotaAvailability(serviceName) {
  const estimatedCost = getServiceCost(serviceName);
  const remainingBudget = MONTHLY_BUDGET - quotaState.estimatedSpent;
  const percentageUsed = (quotaState.estimatedSpent / MONTHLY_BUDGET) * 100;

  // Déterminer le statut
  let status = 'ok';
  let canProceed = true;
  let message = '';

  if (percentageUsed >= 100) {
    status = 'exhausted';
    canProceed = false;
    message = 'Budget OpenAI mensuel épuisé. Réessayez le mois prochain.';
  } else if (percentageUsed >= 95) {
    status = 'critical';
    canProceed = estimatedCost <= remainingBudget;
    message = canProceed 
      ? 'Budget OpenAI presque épuisé. Dernières requêtes disponibles.'
      : 'Budget insuffisant pour cette opération.';
  } else if (percentageUsed >= 80) {
    status = 'warning';
    canProceed = true;
    message = 'Budget OpenAI à 80%. Consommation surveillée.';
  }

  return {
    allowed: canProceed,
    status,
    message,
    details: {
      estimatedCost,
      remainingBudget,
      percentageUsed: Math.round(percentageUsed),
      totalSpent: quotaState.estimatedSpent,
      monthlyBudget: MONTHLY_BUDGET
    }
  };
}

/**
 * Rate limiting : vérifie les limites horaires et journalières
 */
function checkRateLimit() {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentHour = now.getHours();

  // Réinitialiser les compteurs si nécessaire
  if (currentDate !== quotaState.lastResetDate) {
    quotaState.requestsToday = 0;
    quotaState.lastResetDate = currentDate;
    quotaState.estimatedSpent = 0; // Reset mensuel manuel à faire
  }
  if (currentHour !== quotaState.lastResetHour) {
    quotaState.requestsThisHour = 0;
    quotaState.lastResetHour = currentHour;
  }

  // Limites configurables
  const HOURLY_LIMIT = parseInt(process.env.OPENAI_HOURLY_LIMIT || '100');
  const DAILY_LIMIT = parseInt(process.env.OPENAI_DAILY_LIMIT || '1000');

  if (quotaState.requestsThisHour >= HOURLY_LIMIT) {
    return {
      allowed: false,
      reason: 'rate_limit_hour',
      message: `Limite horaire atteinte (${HOURLY_LIMIT} requêtes/heure). Réessayez dans quelques minutes.`
    };
  }

  if (quotaState.requestsToday >= DAILY_LIMIT) {
    return {
      allowed: false,
      reason: 'rate_limit_day',
      message: `Limite journalière atteinte (${DAILY_LIMIT} requêtes/jour). Réessayez demain.`
    };
  }

  return { allowed: true };
}

/**
 * Valide si une requête OpenAI peut être effectuée
 * Vérifie : budget, rate limiting, erreurs récentes
 */
function validateAIRequest(serviceName) {
  // 1. Vérifier rate limiting
  const rateLimitCheck = checkRateLimit();
  if (!rateLimitCheck.allowed) {
    return rateLimitCheck;
  }

  // 2. Vérifier quota/budget
  const quotaCheck = checkQuotaAvailability(serviceName);
  if (!quotaCheck.allowed) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      message: quotaCheck.message,
      details: quotaCheck.details
    };
  }

  // 3. Vérifier si trop d'erreurs récentes (circuit breaker)
  const recentErrors = quotaState.errors.filter(e => 
    Date.now() - e.timestamp < 5 * 60 * 1000 // 5 minutes
  );

  if (recentErrors.length >= 10) {
    return {
      allowed: false,
      reason: 'too_many_errors',
      message: 'Service OpenAI temporairement indisponible (trop d\'erreurs récentes).'
    };
  }

  return {
    allowed: true,
    status: quotaCheck.status,
    message: quotaCheck.message
  };
}

/**
 * Enregistre une requête OpenAI réussie
 */
function recordSuccessfulRequest(serviceName) {
  const cost = getServiceCost(serviceName);
  quotaState.estimatedSpent += cost;
  quotaState.requestsToday += 1;
  quotaState.requestsThisHour += 1;
  quotaState.totalRequests += 1;
  quotaState.lastCheck = new Date().toISOString();

  // Log si passage d'un seuil + envoyer alertes
  const percentage = (quotaState.estimatedSpent / MONTHLY_BUDGET) * 100;
  
  if (percentage >= 90 && quotaState.status !== 'critical' && quotaState.status !== 'exhausted') {
    quotaState.status = 'critical';
    console.error(`🚨 Budget OpenAI CRITIQUE : ${Math.round(percentage)}%`);
    
    // Envoyer alerte critique (async, ne pas bloquer)
    setImmediate(() => {
      const alertService = require('./alert-service');
      alertService.alertBudgetCritical({
        percentageUsed: Math.round(percentage),
        totalSpent: quotaState.estimatedSpent,
        remainingBudget: MONTHLY_BUDGET - quotaState.estimatedSpent,
        monthlyBudget: MONTHLY_BUDGET,
        requestsToday: quotaState.requestsToday,
        estimatedRequestsLeft: Math.floor((MONTHLY_BUDGET - quotaState.estimatedSpent) / 0.01)
      }).catch(err => console.error('Erreur envoi alerte:', err));
    });
  } else if (percentage >= 80 && quotaState.status !== 'warning' && quotaState.status !== 'critical') {
    quotaState.status = 'warning';
    console.warn(`⚠️  Budget OpenAI à ${Math.round(percentage)}%`);
    
    // Envoyer alerte warning (async)
    setImmediate(() => {
      const alertService = require('./alert-service');
      alertService.alertBudgetWarning({
        percentageUsed: Math.round(percentage),
        totalSpent: quotaState.estimatedSpent,
        remainingBudget: MONTHLY_BUDGET - quotaState.estimatedSpent,
        monthlyBudget: MONTHLY_BUDGET,
        requestsToday: quotaState.requestsToday,
        estimatedRequestsLeft: Math.floor((MONTHLY_BUDGET - quotaState.estimatedSpent) / 0.01)
      }).catch(err => console.error('Erreur envoi alerte:', err));
    });
  }

  return {
    cost,
    totalSpent: quotaState.estimatedSpent,
    percentageUsed: Math.round(percentage)
  };
}

/**
 * Enregistre une erreur OpenAI
 */
function recordError(serviceName, error) {
  quotaState.errors.push({
    serviceName,
    error: error.message,
    timestamp: Date.now()
  });

  // Garder seulement les 50 dernières erreurs
  if (quotaState.errors.length > 50) {
    quotaState.errors = quotaState.errors.slice(-50);
  }

  // Détecter les erreurs de quota OpenAI
  if (error.message && error.message.includes('quota')) {
    quotaState.status = 'exhausted';
    console.error('🚨 QUOTA OPENAI DÉPASSÉ - Service désactivé');
  }
}

/**
 * Obtient l'état actuel du quota
 */
function getQuotaStatus() {
  const percentageUsed = (quotaState.estimatedSpent / MONTHLY_BUDGET) * 100;
  const remainingBudget = Math.max(0, MONTHLY_BUDGET - quotaState.estimatedSpent);
  const estimatedRequestsLeft = Math.floor(remainingBudget / OPENAI_COSTS['default']);

  return {
    status: quotaState.status,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
    totalSpent: Math.round(quotaState.estimatedSpent * 100) / 100,
    remainingBudget: Math.round(remainingBudget * 100) / 100,
    monthlyBudget: MONTHLY_BUDGET,
    requestsToday: quotaState.requestsToday,
    requestsThisHour: quotaState.requestsThisHour,
    totalRequests: quotaState.totalRequests,
    estimatedRequestsLeft,
    lastCheck: quotaState.lastCheck,
    recentErrorsCount: quotaState.errors.filter(e => 
      Date.now() - e.timestamp < 5 * 60 * 1000
    ).length
  };
}

/**
 * Réinitialise les compteurs (à appeler manuellement en début de mois)
 */
function resetMonthlyQuota() {
  quotaState.estimatedSpent = 0;
  quotaState.status = 'ok';
  quotaState.errors = [];
  console.log('✅ Quota mensuel OpenAI réinitialisé');
  return getQuotaStatus();
}

/**
 * Obtient les coûts par service (pour affichage admin)
 */
function getServiceCosts() {
  return { ...OPENAI_COSTS };
}

module.exports = {
  validateAIRequest,
  recordSuccessfulRequest,
  recordError,
  getQuotaStatus,
  resetMonthlyQuota,
  getServiceCosts,
  getServiceCost
};
