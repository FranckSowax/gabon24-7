const supabaseService = require('../supabase-config');
const quotaManager = require('../services/openai-quota-manager');
const { checkCredits: checkCreditsPremium } = require('../services/credit-manager-premium');

/**
 * Middleware de validation pour les requêtes IA
 * Vérifie à la fois les crédits premium et le quota OpenAI
 */

// Mapping des services vers leur nom dans credit_costs
const SERVICE_NAME_MAPPING = {
  'analyze-opportunity': 'opportunity_analysis',
  'generate-proposals': 'opportunity_analysis', // Même coût
  'skill-test': 'ai_analysis',
  'action-plan': 'ai_analysis',
  'custom-training': 'ai_analysis',
  'business-plan': 'competitive_analysis',
  'enrich-opportunity': 'opportunity_analysis',
  'ai-summary': 'ai_summary'
};

/**
 * Vérifie si l'utilisateur a suffisamment de crédits premium
 */
async function checkUserCredits(userId, serviceName) {
  try {
    // Mapper le nom du service vers le nom dans credit_costs
    const premiumServiceName = SERVICE_NAME_MAPPING[serviceName] || 'ai_analysis';
    
    // Utiliser le nouveau système de crédits premium
    const creditCheck = await checkCreditsPremium(userId, premiumServiceName);

    if (!creditCheck.hasEnough) {
      return {
        allowed: false,
        reason: 'insufficient_credits',
        message: `Crédits insuffisants. Requis: ${creditCheck.required}, Disponible: ${creditCheck.balance}`,
        requiresTopUp: true,
        details: {
          required: creditCheck.required,
          available: creditCheck.balance,
          missing: creditCheck.missing
        }
      };
    }

    return {
      allowed: true,
      credits: creditCheck.balance,
      requiredCredits: creditCheck.required
    };

  } catch (error) {
    console.error('Erreur checkUserCredits:', error);
    return {
      allowed: false,
      reason: 'unexpected_error',
      message: 'Erreur inattendue lors de la vérification'
    };
  }
}

/**
 * Middleware principal : valide TOUS les aspects avant une requête IA
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

    // 2. Vérifier les crédits internes de l'utilisateur
    const creditsCheck = await checkUserCredits(userId, serviceName);
    if (!creditsCheck.allowed) {
      return creditsCheck;
    }

    // 3. Vérifier le quota OpenAI (budget et rate limiting)
    const openAICheck = quotaManager.validateAIRequest(serviceName);
    if (!openAICheck.allowed) {
      return {
        allowed: false,
        reason: openAICheck.reason,
        message: openAICheck.message,
        isServiceIssue: true, // Indique que c'est un problème côté service, pas utilisateur
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
 * Déduit les crédits après une requête IA réussie (utilise le système premium)
 */
async function deductCredits(userId, serviceName) {
  try {
    const { consumeCredits } = require('../services/credit-manager-premium');
    
    // Mapper le nom du service vers le nom dans credit_costs
    const premiumServiceName = SERVICE_NAME_MAPPING[serviceName] || 'ai_analysis';
    
    // Consommer les crédits via le système premium
    const result = await consumeCredits(
      userId,
      premiumServiceName,
      null, // Utilise le coût par défaut du service
      `Utilisation service IA: ${serviceName}`,
      null,
      { service: serviceName }
    );

    if (!result.success) {
      console.error('❌ Erreur déduction crédits:', result.error);
      return { success: false, error: result.error };
    }

    console.log(`✅ ${result.consumed} crédits déduits pour ${userId} (service: ${serviceName})`);

    return {
      success: true,
      deducted: result.consumed,
      newBalance: result.total_balance,
      transaction_id: result.transaction_id
    };

  } catch (error) {
    console.error('❌ Erreur deductCredits:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fonction complète : valide + exécute + enregistre
 * À utiliser dans les routes IA
 */
async function processAIRequest(serviceName, userId, aiFunction) {
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

    // 3. Enregistrer le succès
    quotaManager.recordSuccessfulRequest(serviceName);
    await deductCredits(userId, serviceName);

    return {
      success: true,
      data: result,
      creditsDeducted: validation.requiredCredits,
      remainingCredits: validation.userCredits - validation.requiredCredits
    };

  } catch (error) {
    // 4. Enregistrer l'échec
    quotaManager.recordError(serviceName, error);
    
    console.error(`❌ Erreur lors de l'exécution de ${serviceName}:`, error);
    
    return {
      success: false,
      error: error.message || 'Erreur lors du traitement IA',
      isOpenAIError: error.message && error.message.includes('OpenAI')
    };
  }
}

module.exports = {
  validateAIRequest,
  deductCredits,
  processAIRequest,
  SERVICE_NAME_MAPPING
};
