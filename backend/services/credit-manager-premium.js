/**
 * 🪙 CREDIT MANAGER PREMIUM
 * Service pour gérer les crédits premium dans toutes les fonctionnalités
 */

const supabaseService = require('../supabase-config');

/**
 * Vérifier si l'utilisateur a assez de crédits pour un service
 * @param {string} userId - ID de l'utilisateur
 * @param {string} serviceName - Nom du service (ex: 'ai_analysis', 'audio_summary')
 * @returns {Promise<{hasEnough: boolean, balance: number, required: number, missing: number}>}
 */
async function checkCredits(userId, serviceName) {
  try {
    // Appeler la fonction RPC check_credits
    const { data, error } = await supabaseService.supabase
      .rpc('check_user_credits', {
        p_user_id: userId,
        p_service_name: serviceName
      });

    if (error) {
      console.error('❌ Erreur vérification crédits:', error);
      return { hasEnough: false, balance: 0, required: 0, missing: 0 };
    }

    return {
      hasEnough: data?.has_enough || false,
      balance: data?.balance || 0,
      required: data?.required || 0,
      missing: data?.missing || 0
    };
  } catch (err) {
    console.error('❌ Erreur checkCredits:', err);
    return { hasEnough: false, balance: 0, required: 0, missing: 0 };
  }
}

/**
 * Consommer des crédits pour un service
 * @param {string} userId - ID de l'utilisateur
 * @param {string} serviceName - Nom du service
 * @param {number} amount - Montant à consommer (optionnel, utilise le coût du service par défaut)
 * @param {string} description - Description de la transaction
 * @param {string} referenceId - ID de référence (ex: article_id, summary_id)
 * @param {object} metadata - Métadonnées additionnelles
 * @returns {Promise<{success: boolean, transaction_id?: string, balance?: number, error?: string}>}
 */
async function consumeCredits(userId, serviceName, amount = null, description = null, referenceId = null, metadata = {}) {
  try {
    // Si amount n'est pas fourni, récupérer le coût du service
    let creditsToConsume = amount;
    
    if (!creditsToConsume) {
      const { data: costData } = await supabaseService.supabase
        .from('credit_costs')
        .select('cost_credits')
        .eq('service_name', serviceName)
        .eq('is_active', true)
        .single();
      
      if (!costData) {
        return { success: false, error: `Service ${serviceName} non trouvé` };
      }
      
      creditsToConsume = costData.cost_credits;
    }

    // Appeler la fonction RPC consume_credits
    const { data, error } = await supabaseService.supabase
      .rpc('consume_credits', {
        p_user_id: userId,
        p_amount: creditsToConsume,
        p_service_name: serviceName,
        p_description: description || `Utilisation de ${serviceName}`,
        p_reference_id: referenceId,
        p_metadata: metadata
      });

    if (error) {
      console.error('❌ Erreur consommation crédits:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      transaction_id: data?.transaction_id,
      balance: data?.balance,
      bonus_balance: data?.bonus_balance,
      total_balance: data?.total_balance,
      consumed: creditsToConsume
    };
  } catch (err) {
    console.error('❌ Erreur consumeCredits:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Rembourser des crédits (en cas d'erreur)
 * @param {string} userId - ID de l'utilisateur
 * @param {number} amount - Montant à rembourser
 * @param {string} reason - Raison du remboursement
 * @param {string} originalTransactionId - ID de la transaction originale
 * @returns {Promise<{success: boolean, transaction_id?: string, error?: string}>}
 */
async function refundCredits(userId, amount, reason, originalTransactionId = null) {
  try {
    const { data, error } = await supabaseService.supabase
      .rpc('refund_credits', {
        p_user_id: userId,
        p_amount: amount,
        p_reason: reason,
        p_original_transaction_id: originalTransactionId
      });

    if (error) {
      console.error('❌ Erreur remboursement crédits:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      transaction_id: data?.transaction_id,
      balance: data?.balance,
      bonus_balance: data?.bonus_balance,
      total_balance: data?.total_balance
    };
  } catch (err) {
    console.error('❌ Erreur refundCredits:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Obtenir le solde de l'utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<{balance: number, bonus_balance: number, total_balance: number}>}
 */
async function getBalance(userId) {
  try {
    const { data, error } = await supabaseService.supabase
      .from('user_credits')
      .select('balance, bonus_balance')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return { balance: 0, bonus_balance: 0, total_balance: 0 };
    }

    return {
      balance: data.balance || 0,
      bonus_balance: data.bonus_balance || 0,
      total_balance: (data.balance || 0) + (data.bonus_balance || 0)
    };
  } catch (err) {
    console.error('❌ Erreur getBalance:', err);
    return { balance: 0, bonus_balance: 0, total_balance: 0 };
  }
}

/**
 * Initialiser un utilisateur avec des crédits bonus
 * @param {string} userId - ID de l'utilisateur
 * @param {number} welcomeBonus - Montant du bonus de bienvenue (défaut: 50)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function initializeUser(userId, welcomeBonus = 50) {
  try {
    const { data, error } = await supabaseService.supabase
      .rpc('initialize_user_credits', {
        p_user_id: userId,
        p_welcome_bonus: welcomeBonus
      });

    if (error) {
      // Si l'utilisateur existe déjà, ce n'est pas une erreur
      if (error.message.includes('already exists')) {
        return { success: true, message: 'Utilisateur déjà initialisé' };
      }
      console.error('❌ Erreur initialisation utilisateur:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('❌ Erreur initializeUser:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Middleware Express pour vérifier les crédits avant une action
 * Usage: router.post('/endpoint', checkCreditsMiddleware('service_name'), handler)
 */
function checkCreditsMiddleware(serviceName) {
  return async (req, res, next) => {
    const userId = req.body.userId || req.query.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }

    const check = await checkCredits(userId, serviceName);
    
    if (!check.hasEnough) {
      return res.status(402).json({ 
        success: false, 
        error: 'Crédits insuffisants',
        code: 'INSUFFICIENT_CREDITS',
        balance: check.balance,
        required: check.required,
        missing: check.missing
      });
    }

    // Passer les infos de crédits à la route suivante
    req.creditCheck = check;
    req.serviceName = serviceName;
    next();
  };
}

module.exports = {
  checkCredits,
  consumeCredits,
  refundCredits,
  getBalance,
  initializeUser,
  checkCreditsMiddleware
};
