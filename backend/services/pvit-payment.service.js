/**
 * 💳 SERVICE DE PAIEMENT PVIT - 100% Node.js
 *
 * Gère tous les paiements via PVIT (Mobile Money Gabon):
 * - Achats de crédits
 * - Abonnements (Premium, Pro)
 * - Inscriptions Quiz
 *
 * Documentation PVIT: https://api.mypvit.pro
 *
 * NOTE: Ce service remplace les endpoints PHP et fonctionne entièrement sur Railway
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
  renewPassword: process.env.PVIT_RENEW_PASSWORD
};

// Endpoints PVIT
const PVIT_ENDPOINTS = {
  restlink: '/YH6BCNXXAAQVNXYT/link',
  renewSecret: '/BYQ5LLFX2X0BA0HB/renew-secret',
  checkStatus: '/9CYO5IQF289XH253/status'
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

  // =====================================================
  // GESTION DES CLÉS PVIT
  // =====================================================

  /**
   * Récupère la clé secrète PVIT valide depuis la base de données
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
   * Régénère la clé secrète PVIT
   */
  async regeneratePvitKey() {
    try {
      console.log('🔄 Tentative de régénération de la clé PVIT...');

      const response = await axios.post(
        `${PVIT_CONFIG.baseUrl}${PVIT_ENDPOINTS.renewSecret}`,
        {
          operationAccountCode: PVIT_CONFIG.operationAccountCode,
          receptionUrlCode: PVIT_CONFIG.receptionUrlCode,
          password: PVIT_CONFIG.renewPassword
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      console.log('✅ Demande de régénération envoyée:', response.data);
      return { success: true, data: response.data };

    } catch (err) {
      console.error('❌ Erreur régénération clé:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Vérifie et gère automatiquement la clé PVIT
   */
  async verifyAndManagePvitKey() {
    // Vérifier si une clé valide existe
    let secretKey = await this.getValidPvitKey();

    if (secretKey) {
      return { success: true, secretKey, regenerated: false };
    }

    // Tentative de régénération avec retry
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (attempt > 1) {
        await this.sleep(3000);
      }

      const regenerationResult = await this.regeneratePvitKey();

      if (regenerationResult.success) {
        // Attendre que PVIT envoie la nouvelle clé via webhook
        await this.sleep(5000);

        secretKey = await this.getValidPvitKey();

        if (secretKey) {
          console.log(`✅ Clé PVIT régénérée après ${attempt} tentative(s)`);
          return { success: true, secretKey, regenerated: true, attempts: attempt };
        }
      }
    }

    return {
      success: false,
      error: 'Impossible de régénérer la clé PVIT après 3 tentatives. Veuillez vérifier vos credentials PVIT.',
      retry_after: 10
    };
  }

  /**
   * Enregistre une nouvelle clé secrète reçue de PVIT
   */
  async receiveSecretKey(data) {
    try {
      const operationAccountCode = data.operation_account_code || data.operationAccountCode;
      const secretKey = data.secret_key || data.secretKey;
      const expiresIn = data.expires_in || data.expiresIn || 86400;

      if (!operationAccountCode || !secretKey) {
        return { success: false, error: 'Données de clé manquantes' };
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Désactiver les anciennes clés
      await this.supabase
        .from('pvit_current_key')
        .update({ is_valid: false })
        .eq('operation_account_code', operationAccountCode);

      // Insérer la nouvelle clé
      const { error } = await this.supabase
        .from('pvit_current_key')
        .insert({
          operation_account_code: operationAccountCode,
          secret_key: secretKey,
          expires_at: expiresAt,
          key_source: 'pvit_api',
          is_valid: true
        });

      if (error) throw error;

      console.log(`✅ Nouvelle clé PVIT enregistrée, expire le ${expiresAt}`);
      return { success: true, expires_at: expiresAt };

    } catch (err) {
      console.error('❌ Erreur enregistrement clé:', err);
      return { success: false, error: err.message };
    }
  }

  // =====================================================
  // INITIATION DES PAIEMENTS
  // =====================================================

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

      // Formater le téléphone (format Gabon)
      let formattedPhone = phone.replace(/[^0-9]/g, '');
      if (formattedPhone.length === 8 || formattedPhone.length === 9) {
        formattedPhone = '241' + formattedPhone;
      }

      // Vérifier/obtenir la clé PVIT
      const keyResult = await this.verifyAndManagePvitKey();
      if (!keyResult.success) {
        return keyResult;
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
          metadata: {
            type,
            plan_name: planName,
            quiz_name: quizName
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erreur enregistrement paiement:', insertError);
        return { success: false, error: 'Erreur lors de l\'enregistrement' };
      }

      // Appeler l'API PVIT RESTLINK
      const pvitResponse = await this.callPvitRestLink({
        amount,
        phone: formattedPhone,
        reference,
        description,
        secretKey: keyResult.secretKey
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
      const merchantReferenceId = pvitResponse.data?.merchantReferenceId;

      await this.supabase
        .from('pvit_payments')
        .update({
          merchant_reference_id: merchantReferenceId,
          pvit_response: pvitResponse.data
        })
        .eq('id', payment.id);

      console.log(`✅ Paiement PVIT initié: ${reference} (${type})`);

      return {
        success: true,
        reference,
        merchant_reference_id: merchantReferenceId,
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
   * Appelle l'API PVIT RESTLINK directement
   */
  async callPvitRestLink({ amount, phone, reference, description, secretKey }) {
    try {
      const payload = {
        amount,
        currency: 'XAF',
        merchantReference: reference,
        customerMsisdn: phone,
        description: description || 'Achat Gabon24-7',
        operationAccountCode: PVIT_CONFIG.operationAccountCode,
        callbackUrlCode: PVIT_CONFIG.callbackUrlCode,
        successRedirectionCode: PVIT_CONFIG.successRedirectionCode,
        failedRedirectionCode: PVIT_CONFIG.failedRedirectionCode
      };

      console.log('📤 Appel PVIT RESTLINK:', { reference, amount, phone });

      const response = await axios.post(
        `${PVIT_CONFIG.baseUrl}${PVIT_ENDPOINTS.restlink}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secretKey}`
          },
          timeout: 60000
        }
      );

      console.log('📥 Réponse PVIT:', response.data);

      return {
        success: true,
        data: response.data
      };

    } catch (err) {
      console.error('❌ Erreur appel PVIT:', err.response?.data || err.message);
      return {
        success: false,
        error: err.response?.data?.message || err.message,
        http_code: err.response?.status
      };
    }
  }

  // =====================================================
  // TRAITEMENT DES CALLBACKS
  // =====================================================

  /**
   * Traite un callback PVIT
   */
  async processCallback(callbackData) {
    try {
      const reference = callbackData.merchantReference;
      const merchantReferenceId = callbackData.merchantReferenceId;
      const operationStatus = (callbackData.operationStatus || '').toUpperCase();
      const amount = callbackData.amount;

      console.log('📥 Traitement callback PVIT:', { reference, operationStatus });

      // Log du callback
      await this.supabase
        .from('pvit_callback_logs')
        .insert({
          reference,
          merchant_reference_id: merchantReferenceId,
          status: operationStatus,
          amount,
          raw_data: callbackData,
          processed: false
        });

      if (!reference) {
        return { success: true, message: 'Reference manquante mais callback enregistré' };
      }

      // Mapper le statut PVIT
      const statusMap = {
        'SUCCESS': 'completed',
        'SUCCESSFUL': 'completed',
        'COMPLETED': 'completed',
        'FAILED': 'failed',
        'FAILURE': 'failed',
        'CANCELLED': 'cancelled',
        'PENDING': 'pending'
      };
      const internalStatus = statusMap[operationStatus] || 'pending';

      // Récupérer le paiement
      const { data: payment, error: fetchError } = await this.supabase
        .from('pvit_payments')
        .select('*')
        .eq('reference', reference)
        .single();

      if (fetchError || !payment) {
        return { success: true, message: 'Paiement non trouvé mais callback enregistré' };
      }

      // Ne pas retraiter un paiement complété
      if (payment.status === 'completed') {
        return { success: true, message: 'Paiement déjà traité' };
      }

      // Mettre à jour le paiement
      const updateData = {
        status: internalStatus,
        callback_data: callbackData,
        updated_at: new Date().toISOString()
      };

      if (internalStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      await this.supabase
        .from('pvit_payments')
        .update(updateData)
        .eq('reference', reference);

      // Si paiement réussi, exécuter l'action
      if (internalStatus === 'completed' && payment.user_id) {
        await this.processCompletedPayment(payment, merchantReferenceId, amount);
      }

      // Marquer le callback comme traité
      await this.supabase
        .from('pvit_callback_logs')
        .update({ processed: true })
        .eq('reference', reference);

      return { success: true, status: internalStatus, type: payment.payment_type };

    } catch (err) {
      console.error('❌ Erreur traitement callback:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Traite un paiement complété selon son type
   */
  async processCompletedPayment(payment, merchantReferenceId, amount) {
    const { payment_type, user_id } = payment;

    console.log(`✅ Traitement paiement complété: ${payment_type} pour ${user_id}`);

    switch (payment_type) {
      case 'credits':
        await this.processCreditsPayment(payment, merchantReferenceId, amount);
        break;

      case 'subscription':
        await this.processSubscriptionPayment(payment, merchantReferenceId, amount);
        break;

      case 'quiz':
        await this.processQuizPayment(payment, merchantReferenceId, amount);
        break;

      default:
        console.warn(`⚠️ Type de paiement inconnu: ${payment_type}`);
    }
  }

  /**
   * Traite un paiement de crédits
   */
  async processCreditsPayment(payment, merchantReferenceId, amount) {
    const creditsToAdd = payment.credits_to_add || 0;
    const bonusCredits = payment.bonus_credits || 0;

    if (creditsToAdd > 0) {
      // Appeler la fonction RPC add_credits
      const { error } = await this.supabase.rpc('add_credits', {
        p_user_id: payment.user_id,
        p_credits: creditsToAdd,
        p_bonus_credits: bonusCredits,
        p_package_id: payment.package_id,
        p_price_paid_xaf: parseInt(amount),
        p_payment_method: 'pvit',
        p_payment_reference: merchantReferenceId,
        p_description: `Achat Mobile Money - ${payment.reference}`
      });

      if (error) {
        console.error('❌ Erreur ajout crédits:', error);
      } else {
        console.log(`✅ ${creditsToAdd + bonusCredits} crédits ajoutés à ${payment.user_id}`);
      }
    }
  }

  /**
   * Traite un paiement d'abonnement
   */
  async processSubscriptionPayment(payment, merchantReferenceId, amount) {
    const planSlug = payment.plan_slug;
    const planDuration = payment.plan_duration || 1;

    // Récupérer le plan
    const { data: plan, error: planError } = await this.supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', planSlug)
      .single();

    if (planError || !plan) {
      console.error('❌ Plan non trouvé:', planSlug);
      return;
    }

    // Désactiver les anciens abonnements
    await this.supabase
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', payment.user_id)
      .eq('status', 'active');

    // Calculer les dates
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + planDuration);

    // Créer le nouvel abonnement
    const { error: subError } = await this.supabase
      .from('subscriptions')
      .insert({
        user_id: payment.user_id,
        plan_id: plan.id,
        status: 'active',
        payment_method: 'mobile_money',
        current_period_start: now.toISOString(),
        current_period_end: endDate.toISOString(),
        metadata: {
          pvit_reference: merchantReferenceId,
          payment_amount: amount,
          duration_months: planDuration
        }
      });

    if (subError) {
      console.error('❌ Erreur création abonnement:', subError);
      return;
    }

    // Attribuer les crédits mensuels
    const monthlyCredits = plan.monthly_credits || 0;
    if (monthlyCredits > 0) {
      await this.supabase.rpc('add_user_credits', {
        p_user_id: payment.user_id,
        p_amount: monthlyCredits,
        p_reason: 'subscription_activation',
        p_description: `Crédits mensuels - Abonnement ${plan.name}`
      });

      console.log(`✅ ${monthlyCredits} crédits mensuels attribués`);
    }

    console.log(`✅ Abonnement ${plan.name} activé jusqu'au ${endDate.toLocaleDateString('fr-FR')}`);
  }

  /**
   * Traite un paiement d'inscription Quiz
   */
  async processQuizPayment(payment, merchantReferenceId, amount) {
    const quizId = payment.quiz_id;

    if (!quizId) {
      console.error('❌ Quiz ID manquant');
      return;
    }

    // Créer l'inscription au quiz
    const { error } = await this.supabase
      .from('quiz_participants')
      .insert({
        quiz_id: quizId,
        user_id: payment.user_id,
        payment_reference: merchantReferenceId,
        payment_amount: amount,
        status: 'registered',
        registered_at: new Date().toISOString()
      });

    if (error && error.code !== '23505') { // Ignorer les doublons
      console.error('❌ Erreur inscription quiz:', error);
    } else {
      console.log(`✅ Utilisateur inscrit au quiz ${quizId}`);
    }
  }

  // =====================================================
  // UTILITAIRES
  // =====================================================

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

  /**
   * Utilitaire sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton
const pvitPaymentService = new PvitPaymentService();

module.exports = pvitPaymentService;
module.exports.PvitPaymentService = PvitPaymentService;
module.exports.PVIT_CONFIG = PVIT_CONFIG;
