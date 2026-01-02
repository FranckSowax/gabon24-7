/**
 * 💳 SERVICE DE PAIEMENT PVIT UNIFIÉ
 *
 * Gère tous les paiements via PVIT (Mobile Money Gabon):
 * - Achats de crédits
 * - Abonnements (Premium, Pro)
 * - Inscriptions Quiz
 *
 * Documentation PVIT: https://api.mypvit.pro
 */

const { supabase } = require('../config/supabase');
const axios = require('axios');

// Configuration PVIT
const PVIT_CONFIG = {
  baseUrl: process.env.PVIT_BASE_URL || 'https://api.mypvit.pro',
  operationAccountCode: process.env.PVIT_OPERATION_ACCOUNT_CODE,
  callbackUrlCode: process.env.PVIT_CALLBACK_URL_CODE,
  receptionUrlCode: process.env.PVIT_RECEPTION_URL_CODE,
  successRedirectionCode: process.env.PVIT_SUCCESS_REDIRECTION_CODE,
  failedRedirectionCode: process.env.PVIT_FAILED_REDIRECTION_CODE,
  renewPassword: process.env.PVIT_RENEW_PASSWORD,
  // URLs PHP pour les callbacks
  phpApiUrl: process.env.PHP_API_URL || 'https://gabon24-7.com/api'
};

class PvitPaymentService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Génère une référence unique pour le paiement
   */
  generateReference(type = 'PAY') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `G247-${type}-${timestamp}-${random}`;
  }

  /**
   * Récupère la clé secrète PVIT valide
   */
  async getValidPvitKey() {
    try {
      const { data, error } = await this.supabase
        .from('pvit_current_key')
        .select('*')
        .eq('operation_account_code', PVIT_CONFIG.operationAccountCode)
        .eq('is_valid', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('⚠️ Clé PVIT non trouvée ou expirée');
        return null;
      }

      return data.secret_key;
    } catch (err) {
      console.error('❌ Erreur récupération clé PVIT:', err.message);
      return null;
    }
  }

  /**
   * Initialise un paiement pour achat de crédits
   */
  async initiateCreditPurchase({ userId, packageId, phone }) {
    try {
      // Récupérer le package
      const { data: pkg, error: pkgError } = await this.supabase
        .from('credit_packages')
        .select('*')
        .eq('id', packageId)
        .eq('is_active', true)
        .single();

      if (pkgError || !pkg) {
        return { success: false, error: 'Package de crédits non trouvé' };
      }

      const reference = this.generateReference('CRD');

      return await this.initiatePayment({
        userId,
        amount: pkg.price_xaf,
        phone,
        reference,
        type: 'credits',
        packageId: pkg.id,
        credits: pkg.credits,
        bonusCredits: pkg.bonus_credits,
        description: `Achat ${pkg.name} - ${pkg.credits + pkg.bonus_credits} crédits`
      });

    } catch (err) {
      console.error('❌ Erreur initiation achat crédits:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Initialise un paiement pour abonnement
   */
  async initiateSubscriptionPayment({ userId, planSlug, phone, duration = 1 }) {
    try {
      // Récupérer le plan
      const { data: plan, error: planError } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .single();

      if (planError || !plan) {
        return { success: false, error: 'Plan d\'abonnement non trouvé' };
      }

      const amount = duration === 12 && plan.price_yearly
        ? plan.price_yearly
        : plan.price_monthly * duration;

      const reference = this.generateReference('SUB');

      return await this.initiatePayment({
        userId,
        amount,
        phone,
        reference,
        type: 'subscription',
        planSlug: plan.slug,
        planName: plan.name,
        planDuration: duration,
        description: `Abonnement ${plan.name} - ${duration} mois`
      });

    } catch (err) {
      console.error('❌ Erreur initiation abonnement:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Initialise un paiement pour inscription Quiz
   */
  async initiateQuizPayment({ userId, quizId, phone }) {
    try {
      // Récupérer le quiz
      const { data: quiz, error: quizError } = await this.supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (quizError || !quiz) {
        return { success: false, error: 'Quiz non trouvé' };
      }

      if (!quiz.entry_fee || quiz.entry_fee <= 0) {
        return { success: false, error: 'Ce quiz est gratuit' };
      }

      const reference = this.generateReference('QUZ');

      return await this.initiatePayment({
        userId,
        amount: quiz.entry_fee,
        phone,
        reference,
        type: 'quiz',
        quizId: quiz.id,
        quizName: quiz.title,
        description: `Inscription Quiz - ${quiz.title}`
      });

    } catch (err) {
      console.error('❌ Erreur initiation quiz:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Méthode centrale d'initiation de paiement
   */
  async initiatePayment(params) {
    const {
      userId,
      amount,
      phone,
      reference,
      type,
      description,
      packageId,
      credits,
      bonusCredits,
      planSlug,
      planName,
      planDuration,
      quizId,
      quizName
    } = params;

    try {
      // Validation
      if (!userId || !amount || !phone || !reference || !type) {
        return { success: false, error: 'Paramètres manquants' };
      }

      if (amount < 100) {
        return { success: false, error: 'Montant minimum: 100 XAF' };
      }

      // Formater le téléphone
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.length === 8 || formattedPhone.length === 9) {
        formattedPhone = '241' + formattedPhone;
      }

      // Enregistrer le paiement en attente
      const { data: payment, error: insertError } = await this.supabase
        .from('pvit_payments')
        .insert({
          user_id: userId,
          reference,
          amount,
          phone: formattedPhone,
          description,
          status: 'pending',
          payment_type: type,
          package_id: packageId || null,
          credits_to_add: credits || 0,
          bonus_credits: bonusCredits || 0,
          plan_slug: planSlug || null,
          plan_duration: planDuration || null,
          quiz_id: quizId || null,
          metadata: JSON.stringify({
            type,
            plan_name: planName,
            quiz_name: quizName
          })
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erreur enregistrement paiement:', insertError);
        return { success: false, error: 'Erreur lors de l\'enregistrement' };
      }

      // Appeler l'API PHP PVIT
      const pvitResponse = await this.callPvitApi({
        amount,
        phone: formattedPhone,
        reference,
        type,
        user_id: userId,
        package_id: packageId,
        credits,
        bonus_credits: bonusCredits,
        plan_slug: planSlug,
        plan_name: planName,
        plan_duration: planDuration,
        quiz_id: quizId,
        quiz_name: quizName
      });

      if (!pvitResponse.success) {
        // Mettre à jour le statut en échec
        await this.supabase
          .from('pvit_payments')
          .update({
            status: 'failed',
            pvit_response: pvitResponse
          })
          .eq('id', payment.id);

        return pvitResponse;
      }

      // Mettre à jour avec la réponse PVIT
      await this.supabase
        .from('pvit_payments')
        .update({
          merchant_reference_id: pvitResponse.data?.merchant_reference_id,
          pvit_response: pvitResponse.pvit_response
        })
        .eq('id', payment.id);

      return {
        success: true,
        reference,
        merchant_reference_id: pvitResponse.data?.merchant_reference_id,
        amount,
        type,
        status: 'pending',
        message: 'Paiement initié. Vérifiez votre téléphone pour valider.'
      };

    } catch (err) {
      console.error('❌ Erreur initiatePayment:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Appelle l'API PHP PVIT
   */
  async callPvitApi(params) {
    try {
      const response = await axios.post(
        `${PVIT_CONFIG.phpApiUrl}/pvit_payment.php`,
        params,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );

      return response.data;
    } catch (err) {
      console.error('❌ Erreur appel API PVIT:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data?.error || err.message
      };
    }
  }

  /**
   * Vérifie le statut d'un paiement
   */
  async checkPaymentStatus(reference) {
    try {
      const { data, error } = await this.supabase
        .from('pvit_payments')
        .select('*')
        .eq('reference', reference)
        .single();

      if (error || !data) {
        return { success: false, error: 'Paiement non trouvé' };
      }

      return {
        success: true,
        payment: {
          reference: data.reference,
          status: data.status,
          amount: data.amount,
          type: data.payment_type,
          completed_at: data.completed_at
        }
      };
    } catch (err) {
      console.error('❌ Erreur vérification statut:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Récupère l'historique des paiements d'un utilisateur
   */
  async getUserPaymentHistory(userId, limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('pvit_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { success: true, payments: data || [] };
    } catch (err) {
      console.error('❌ Erreur historique paiements:', err);
      return { success: false, error: err.message };
    }
  }
}

// Singleton
const pvitPaymentService = new PvitPaymentService();

module.exports = pvitPaymentService;
module.exports.PvitPaymentService = PvitPaymentService;
module.exports.PVIT_CONFIG = PVIT_CONFIG;
