/**
 * 🔒 AI VALIDATION MIDDLEWARE
 * Middleware de validation pour les requêtes IA
 * Vérifie les crédits via pricing-service et gère le débit automatique
 */

const supabaseService = require('../supabase-config');
const quotaManager = require('../services/openai-quota-manager');
const { checkCredits: checkCreditsPremium, consumeCredits, refundCredits } = require('../services/credit-manager-premium');
const pricingService = require('../services/pricing-service');

/**
 * Vérifie si l'utilisateur a suffisamment de crédits pour un service
 * @param {string} userId - ID de l'utilisateur
 * @param {string} serviceName - Nom du service
 * @returns {Promise<{allowed: boolean, credits?: number, requiredCredits?: number, ...}>}
 */
async function checkUserCredits(userId, serviceName) {
  try {
    // Obtenir le coût du service depuis pricing-service
    const requiredCredits = await pricingService.getServiceCost(serviceName);

    // Si le service est gratuit, autoriser directement
    if (requiredCredits === 0) {
      return {
        allowed: true,
        credits: 0,
        requiredCredits: 0,
        isFree: true
      };
    }

    // Vérifier si le service est actif
    const isActive = await pricingService.isServiceActive(serviceName);
    if (!isActive) {
      return {
        allowed: false,
        reason: 'service_disabled',
        message: 'Ce service est temporairement désactivé',
        isServiceIssue: true
      };
    }

    // Récupérer le solde de l'utilisateur
    const { data: userCredits, error } = await supabaseService.supabase
      .from('user_credits')
      .select('balance, bonus_balance')
      .eq('user_id', userId)
      .single();

    if (error || !userCredits) {
      // Utilisateur sans compte crédits
      return {
        allowed: false,
        reason: 'no_credits_account',
        message: 'Aucun compte crédits trouvé',
        requiresTopUp: true,
        details: {
          required: requiredCredits,
          available: 0,
          missing: requiredCredits
        }
      };
    }

    const totalBalance = (userCredits.balance || 0) + (userCredits.bonus_balance || 0);

    if (totalBalance < requiredCredits) {
      return {
        allowed: false,
        reason: 'insufficient_credits',
        message: `Crédits insuffisants. Requis: ${requiredCredits}, Disponible: ${totalBalance}`,
        requiresTopUp: true,
        details: {
          required: requiredCredits,
          available: totalBalance,
          missing: requiredCredits - totalBalance
        }
      };
    }

    return {
      allowed: true,
      credits: totalBalance,
      requiredCredits: requiredCredits
    };

  } catch (error) {
    console.error('❌ Erreur checkUserCredits:', error);
    return {
      allowed: false,
      reason: 'unexpected_error',
      message: 'Erreur inattendue lors de la vérification des crédits'
    };
  }
}

/**
 * Middleware principal : valide TOUS les aspects avant une requête IA
 * @param {string} serviceName - Nom du service
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{allowed: boolean, ...}>}
 */
async function validateAIRequest(serviceName, userId) {
  try {
    // 1. Vérifier que userId est fourni
    if (!userId) {
      return {
        allowed: false,
        reason: 'no_user_id',
        message: 'Connexion requise pour utiliser l\'IA',
        requiresLogin: true
      };
    }

    // 2. Vérifier si le service est gratuit
    const isFree = await pricingService.isServiceFree(serviceName);
    if (isFree) {
      return {
        allowed: true,
        userCredits: 0,
        requiredCredits: 0,
        isFree: true
      };
    }

    // 3. Vérifier les crédits de l'utilisateur
    const creditsCheck = await checkUserCredits(userId, serviceName);
    if (!creditsCheck.allowed) {
      return creditsCheck;
    }

    // 4. Vérifier le quota OpenAI (budget et rate limiting)
    const openAICheck = quotaManager.validateAIRequest(serviceName);
    if (!openAICheck.allowed) {
      return {
        allowed: false,
        reason: openAICheck.reason,
        message: openAICheck.message,
        isServiceIssue: true,
        details: openAICheck.details
      };
    }

    // ✅ Tout est OK
    return {
      allowed: true,
      userCredits: creditsCheck.credits,
      requiredCredits: creditsCheck.requiredCredits,
      openAIStatus: openAICheck.status,
      openAIMessage: openAICheck.message
    };

  } catch (error) {
    console.error('❌ Erreur validateAIRequest:', error);
    return {
      allowed: false,
      reason: 'validation_error',
      message: 'Erreur lors de la validation de la requête'
    };
  }
}

/**
 * Déduit les crédits après une requête IA réussie
 * @param {string} userId - ID de l'utilisateur
 * @param {string} serviceName - Nom du service
 * @param {string} referenceId - ID de référence optionnel (article_id, etc.)
 * @param {object} metadata - Métadonnées additionnelles
 * @returns {Promise<{success: boolean, deducted?: number, newBalance?: number, ...}>}
 */
async function deductCredits(userId, serviceName, referenceId = null, metadata = {}) {
  try {
    // Obtenir le coût du service
    const cost = await pricingService.getServiceCost(serviceName);

    // Si gratuit, ne rien débiter
    if (cost === 0) {
      console.log(`✅ Service gratuit: ${serviceName} - pas de débit`);
      return { success: true, deducted: 0, isFree: true };
    }

    // Obtenir la clé de service pour credit_costs
    const featureKey = pricingService.SERVICE_KEY_MAPPING[serviceName] || serviceName;

    // Consommer les crédits
    const result = await consumeCredits(
      userId,
      featureKey,
      cost,
      `Utilisation: ${serviceName}`,
      referenceId,
      { service: serviceName, ...metadata }
    );

    if (!result.success) {
      console.error('❌ Erreur déduction crédits:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`✅ ${cost} crédits débités pour ${userId} (service: ${serviceName})`);

    return {
      success: true,
      deducted: cost,
      newBalance: result.total_balance,
      transaction_id: result.transaction_id
    };

  } catch (error) {
    console.error('❌ Erreur deductCredits:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rembourse les crédits en cas d'erreur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} serviceName - Nom du service
 * @param {string} reason - Raison du remboursement
 * @returns {Promise<{success: boolean, refunded?: number, ...}>}
 */
async function refundServiceCredits(userId, serviceName, reason) {
  try {
    const cost = await pricingService.getServiceCost(serviceName);

    if (cost === 0) {
      return { success: true, refunded: 0, isFree: true };
    }

    const result = await refundCredits(userId, cost, reason);

    if (!result.success) {
      console.error('❌ Erreur remboursement crédits:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`💰 ${cost} crédits remboursés à ${userId} (service: ${serviceName}, raison: ${reason})`);

    return {
      success: true,
      refunded: cost,
      newBalance: result.total_balance
    };

  } catch (error) {
    console.error('❌ Erreur refundServiceCredits:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fonction complète : valide + exécute + débite
 * Usage: const result = await processAIRequest('service-name', userId, async () => { ... })
 * @param {string} serviceName - Nom du service
 * @param {string} userId - ID de l'utilisateur
 * @param {Function} aiFunction - Fonction async qui exécute l'IA
 * @param {object} options - Options additionnelles
 * @returns {Promise<{success: boolean, data?: any, ...}>}
 */
async function processAIRequest(serviceName, userId, aiFunction, options = {}) {
  // 1. Validation préalable
  const validation = await validateAIRequest(serviceName, userId);

  if (!validation.allowed) {
    return {
      success: false,
      error: validation.message,
      reason: validation.reason,
      requiresLogin: validation.requiresLogin,
      requiresTopUp: validation.requiresTopUp,
      isServiceIssue: validation.isServiceIssue,
      details: validation.details
    };
  }

  try {
    // 2. Exécuter la fonction IA
    const result = await aiFunction();

    // 3. Débiter les crédits APRÈS succès
    const deduction = await deductCredits(
      userId,
      serviceName,
      options.referenceId || null,
      options.metadata || {}
    );

    if (!deduction.success && !validation.isFree) {
      console.warn(`⚠️ IA réussie mais débit échoué pour ${serviceName}: ${deduction.error}`);
    }

    // 4. Enregistrer le succès pour quotaManager
    quotaManager.recordSuccessfulRequest(serviceName);

    return {
      success: true,
      data: result,
      creditsDeducted: deduction.deducted || 0,
      remainingCredits: deduction.newBalance,
      isFree: validation.isFree || false
    };

  } catch (error) {
    // 5. Enregistrer l'échec
    quotaManager.recordError(serviceName, error);

    console.error(`❌ Erreur lors de l'exécution de ${serviceName}:`, error);

    return {
      success: false,
      error: error.message || 'Erreur lors du traitement IA',
      isOpenAIError: error.message && error.message.includes('OpenAI')
    };
  }
}

/**
 * Middleware Express pour vérifier les crédits avant une action
 * Usage: router.post('/endpoint', requireCredits('service-name'), handler)
 */
function requireCredits(serviceName) {
  return async (req, res, next) => {
    const userId = req.body.userId || req.query.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }

    const validation = await validateAIRequest(serviceName, userId);

    if (!validation.allowed) {
      const statusCode = validation.requiresLogin ? 401 :
                        validation.requiresTopUp ? 402 :
                        validation.isServiceIssue ? 503 : 400;

      return res.status(statusCode).json({
        success: false,
        error: validation.message,
        code: validation.reason?.toUpperCase() || 'VALIDATION_FAILED',
        details: validation.details
      });
    }

    // Passer les infos aux handlers suivants
    req.creditValidation = validation;
    req.serviceName = serviceName;
    next();
  };
}

/**
 * Middleware pour débiter automatiquement après réponse réussie
 * Usage: router.post('/endpoint', requireCredits('service'), handler, autoDebit)
 */
function autoDebit(req, res, next) {
  // Ce middleware s'exécute après le handler
  // On doit l'utiliser avec res.on('finish')
  const originalJson = res.json.bind(res);

  res.json = function(data) {
    // Si la réponse est un succès, débiter les crédits
    if (data && data.success && req.serviceName && req.body.userId) {
      deductCredits(req.body.userId, req.serviceName).catch(err => {
        console.error('❌ Auto-debit failed:', err);
      });
    }
    return originalJson(data);
  };

  next();
}

module.exports = {
  validateAIRequest,
  deductCredits,
  refundServiceCredits,
  processAIRequest,
  requireCredits,
  autoDebit,
  checkUserCredits,
  // Re-export pour compatibilité
  SERVICE_NAME_MAPPING: pricingService.SERVICE_KEY_MAPPING
};
