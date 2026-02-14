/**
 * SERVICE DE PAIEMENT E-BILLING (DriveBy Africa)
 *
 * Gère tous les paiements via E-Billing (billing-easy.com):
 * - Achats de crédits
 * - Abonnements (Premium, Pro)
 * - Inscriptions Quiz
 * - Campagnes publicitaires
 *
 * Méthodes supportées: Airtel Money, Moov Money, Visa, Mastercard
 * Devise: XAF
 *
 * Flow:
 * 1. Backend crée une facture via E-Billing API
 * 2. Frontend redirige l'utilisateur vers le portail E-Billing
 * 3. L'utilisateur paie sur le portail (choix opérateur/carte)
 * 4. Frontend poll le statut via backend
 * 5. Backend vérifie le statut auprès de E-Billing
 * 6. Quand complété, backend exécute l'action (crédits, abo, quiz)
 */

const { supabase } = require('../config/supabase');
const axios = require('axios');

// Configuration E-Billing
if (process.env.NODE_ENV === 'production') {
  if (!process.env.EBILLING_API_URL || !(process.env.EBILLING_USERNAME || process.env.EBILLING_USER) || !process.env.EBILLING_API_KEY) {
    console.error('⚠️ Missing required E-Billing env vars: EBILLING_API_URL, EBILLING_USERNAME/EBILLING_USER, EBILLING_API_KEY — payment routes will fail');
  }
}

const EBILLING_CONFIG = {
  apiUrl: process.env.EBILLING_API_URL || 'https://stg.billing-easy.com/api/v1/merchant/e_bills',
  portalUrl: process.env.EBILLING_PORTAL_URL || 'https://staging.billing-easy.net',
  username: process.env.EBILLING_USERNAME || process.env.EBILLING_USER,
  apiKey: process.env.EBILLING_API_KEY,
};

// Générer le header Basic Auth
function getBasicAuth() {
  const credentials = `${EBILLING_CONFIG.username}:${EBILLING_CONFIG.apiKey}`;
  return 'Basic ' + Buffer.from(credentials).toString('base64');
}

class EBillingPaymentService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Génère une référence unique pour le paiement
   * Format: GI + type (3 chars) + timestamp base36 + random (max 20 chars)
   */
  generateReference(type = 'PAY') {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GI${type}${timestamp}${random}`.substring(0, 20);
  }

  // =====================================================
  // CRÉATION DE FACTURES E-BILLING
  // =====================================================

  async createInvoice({ amount, description, reference, payerName, payerEmail, payerPhone }) {
    try {
      const callbackUrl = `${process.env.RAILWAY_PUBLIC_URL || process.env.API_URL || 'https://gabon24-7-production.up.railway.app'}/api/payments/ebilling/callback`;

      const payload = {
        amount: parseInt(amount),
        payer_msisdn: payerPhone || '24100000000',
        payer_email: payerEmail || 'client@gaboninsight.com',
        payer_name: payerName || 'Client Gabon Insight',
        short_description: (description || 'Paiement Gabon Insight').substring(0, 100),
        external_reference: reference,
        callback_url: callbackUrl,
        expiry_period: 60,
        currency: 'XAF',
      };

      console.log('📤 Création facture E-Billing:', { reference, amount, description, apiUrl: EBILLING_CONFIG.apiUrl, username: EBILLING_CONFIG.username, payload });

      const response = await axios.post(
        EBILLING_CONFIG.apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': getBasicAuth(),
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      const billId = data.e_bill?.bill_id || data.bill_id || data.id;

      if (!billId) {
        console.error('❌ E-Billing: bill_id manquant dans la réponse:', data);
        return { success: false, error: 'Réponse E-Billing invalide (bill_id manquant)' };
      }

      const paymentUrl = `${EBILLING_CONFIG.portalUrl}/?invoice=${billId}`;
      console.log(`✅ Facture E-Billing créée: bill_id=${billId}`);

      return { success: true, bill_id: billId, payment_url: paymentUrl, data };

    } catch (err) {
      console.error('❌ Erreur création facture E-Billing:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      let errorMessage = 'Erreur lors de la création de la facture';
      if (err.response?.status === 401) {
        errorMessage = 'Authentification E-Billing échouée. Vérifiez les credentials.';
      } else if (err.response?.status === 422) {
        errorMessage = 'Données de facture invalides.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }

      return { success: false, error: errorMessage, http_code: err.response?.status };
    }
  }

  async checkInvoiceStatus(billId) {
    try {
      const response = await axios.get(
        `${EBILLING_CONFIG.apiUrl}/${billId}`,
        { headers: { 'Accept': 'application/json', 'Authorization': getBasicAuth() }, timeout: 15000 }
      );

      const data = response.data;
      const eBill = data.e_bill || data;
      const status = (eBill.status || eBill.e_bill_status || '').toLowerCase();
      const statusMap = {
        'paid': 'completed', 'completed': 'completed', 'success': 'completed',
        'pending': 'pending', 'waiting': 'pending', 'created': 'pending',
        'failed': 'failed', 'expired': 'failed',
        'cancelled': 'cancelled', 'canceled': 'cancelled',
      };

      return { success: true, bill_id: billId, status: statusMap[status] || 'pending', raw_status: status, data: eBill };

    } catch (err) {
      console.error('❌ Erreur vérification statut E-Billing:', err.message);
      return { success: false, error: err.message };
    }
  }

  // =====================================================
  // INITIATION DES PAIEMENTS
  // =====================================================

  async initiateCreditPurchase({ userId, packageId, userEmail, userName }) {
    try {
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
        reference,
        type: 'credits',
        packageId: pkg.id,
        credits: pkg.credits,
        bonusCredits: pkg.bonus_credits,
        description: `Gabon Insight - ${pkg.name} (${pkg.credits + (pkg.bonus_credits || 0)} crédits)`,
        userEmail,
        userName,
      });

    } catch (err) {
      console.error('❌ Erreur initiation achat crédits:', err);
      return { success: false, error: err.message };
    }
  }

  async initiateSubscriptionPayment({ userId, planSlug, duration = 1, userEmail, userName }) {
    try {
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
        reference,
        type: 'subscription',
        planSlug: plan.slug,
        planName: plan.name,
        planDuration: duration,
        description: `Gabon Insight - Abonnement ${plan.name} (${duration} mois)`,
        userEmail,
        userName,
      });

    } catch (err) {
      console.error('❌ Erreur initiation abonnement:', err);
      return { success: false, error: err.message };
    }
  }

  async initiateQuizPayment({ userId, quizId, userEmail, userName }) {
    try {
      let gameSession = null;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(quizId)) {
        const { data } = await this.supabase
          .from('game_sessions').select('*').eq('id', quizId).single();
        gameSession = data;
      }

      if (!gameSession) {
        const { data } = await this.supabase
          .from('game_sessions').select('*')
          .eq('session_type', quizId).eq('status', 'waiting')
          .order('created_at', { ascending: false }).limit(1).single();
        if (data) gameSession = data;
      }

      if (!gameSession) {
        const { data } = await this.supabase
          .from('game_sessions').select('*')
          .ilike('name', `%${quizId}%`).eq('status', 'waiting')
          .order('created_at', { ascending: false }).limit(1).single();
        if (data) gameSession = data;
      }

      if (!gameSession) return { success: false, error: 'Session de jeu non trouvée' };
      if (!gameSession.entry_fee || gameSession.entry_fee <= 0) return { success: false, error: 'Cette session est gratuite' };

      const reference = this.generateReference('QUZ');

      return await this.initiatePayment({
        userId,
        amount: gameSession.entry_fee,
        reference,
        type: 'quiz',
        quizId: gameSession.id,
        quizName: gameSession.name,
        description: `Gabon Insight - Quiz ${gameSession.name}`,
        userEmail,
        userName,
      });

    } catch (err) {
      console.error('❌ Erreur initiation quiz:', err);
      return { success: false, error: err.message };
    }
  }

  async initiateCampaignPayment({ userId, campaignIds, amount, userEmail, userName }) {
    try {
      const reference = this.generateReference('CMP');

      return await this.initiatePayment({
        userId,
        amount,
        reference,
        type: 'campaign',
        campaignIds,
        description: `Gabon Insight - Campagne publicitaire`,
        userEmail,
        userName,
      });

    } catch (err) {
      console.error('❌ Erreur initiation campagne:', err);
      return { success: false, error: err.message };
    }
  }

  async initiatePayment(params) {
    const {
      userId, amount, reference, type, description,
      packageId, credits, bonusCredits,
      planSlug, planName, planDuration,
      quizId, quizName, campaignIds,
      userEmail, userName,
    } = params;

    try {
      if (!userId || !amount || !reference || !type) {
        return { success: false, error: 'Paramètres manquants' };
      }
      if (amount < 100) {
        return { success: false, error: 'Montant minimum: 100 XAF' };
      }

      // 1. Créer la facture E-Billing
      const invoiceResult = await this.createInvoice({
        amount, description, reference, payerName: userName, payerEmail: userEmail,
      });

      if (!invoiceResult.success) return invoiceResult;

      // 2. Enregistrer le paiement en base
      const { data: payment, error: insertError } = await this.supabase
        .from('ebilling_payments')
        .insert({
          user_id: userId,
          reference,
          bill_id: invoiceResult.bill_id,
          amount,
          description,
          status: 'pending',
          payment_type: type,
          package_id: packageId || null,
          credits_to_add: credits || 0,
          bonus_credits: bonusCredits || 0,
          plan_slug: planSlug || null,
          plan_duration: planDuration || null,
          quiz_id: quizId || null,
          campaign_ids: campaignIds || null,
          ebilling_response: invoiceResult.data,
          metadata: {
            type, plan_name: planName, quiz_name: quizName,
            user_email: userEmail, user_name: userName,
          },
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erreur enregistrement paiement:', insertError);
        return { success: false, error: 'Erreur lors de l\'enregistrement du paiement' };
      }

      console.log(`✅ Paiement E-Billing initié: ${reference} (${type}) - bill_id=${invoiceResult.bill_id}`);

      return {
        success: true,
        reference,
        bill_id: invoiceResult.bill_id,
        payment_url: invoiceResult.payment_url,
        amount, type,
        status: 'pending',
        message: 'Facture créée. Vous allez être redirigé vers le portail de paiement.',
      };

    } catch (err) {
      console.error('❌ Erreur initiatePayment:', err);
      return { success: false, error: err.message };
    }
  }

  // =====================================================
  // VÉRIFICATION DE STATUT & CALLBACKS
  // =====================================================

  async checkPaymentStatus(reference) {
    try {
      const { data: payment, error } = await this.supabase
        .from('ebilling_payments')
        .select('*')
        .eq('reference', reference)
        .single();

      if (error || !payment) return { success: false, error: 'Paiement non trouvé' };

      if (['completed', 'failed', 'cancelled'].includes(payment.status)) {
        return {
          success: true,
          payment: {
            reference: payment.reference, status: payment.status,
            amount: payment.amount, type: payment.payment_type,
            completed_at: payment.completed_at,
          },
        };
      }

      if (payment.bill_id) {
        const statusResult = await this.checkInvoiceStatus(payment.bill_id);

        if (statusResult.success && statusResult.status !== 'pending') {
          const updateData = {
            status: statusResult.status,
            ebilling_status_data: statusResult.data,
            updated_at: new Date().toISOString(),
          };
          if (statusResult.status === 'completed') {
            updateData.completed_at = new Date().toISOString();
          }

          await this.supabase
            .from('ebilling_payments')
            .update(updateData)
            .eq('reference', reference);

          if (statusResult.status === 'completed') {
            await this.processCompletedPayment(payment);
          }

          return {
            success: true,
            payment: {
              reference: payment.reference, status: statusResult.status,
              amount: payment.amount, type: payment.payment_type,
              completed_at: statusResult.status === 'completed' ? new Date().toISOString() : null,
            },
          };
        }
      }

      return {
        success: true,
        payment: { reference: payment.reference, status: 'pending', amount: payment.amount, type: payment.payment_type },
      };

    } catch (err) {
      console.error('❌ Erreur vérification statut:', err);
      return { success: false, error: err.message };
    }
  }

  async processCallback(callbackData) {
    try {
      const billId = callbackData.bill_id || callbackData.e_bill_id || callbackData.id;
      const externalRef = callbackData.external_reference || callbackData.reference;
      const status = (callbackData.status || callbackData.e_bill_status || '').toLowerCase();

      console.log('📥 Callback E-Billing reçu:', { billId, externalRef, status });

      await this.supabase.from('ebilling_callback_logs').insert({
        bill_id: billId, reference: externalRef, status, raw_data: callbackData, processed: false,
      });

      let payment = null;
      if (externalRef) {
        const { data } = await this.supabase.from('ebilling_payments').select('*').eq('reference', externalRef).single();
        payment = data;
      }
      if (!payment && billId) {
        const { data } = await this.supabase.from('ebilling_payments').select('*').eq('bill_id', billId).single();
        payment = data;
      }

      if (!payment) {
        console.warn('⚠️ Paiement non trouvé pour callback:', { billId, externalRef });
        return { success: true, message: 'Paiement non trouvé mais callback enregistré' };
      }
      if (payment.status === 'completed') {
        return { success: true, message: 'Paiement déjà traité' };
      }

      const statusMap = {
        'paid': 'completed', 'completed': 'completed', 'success': 'completed',
        'failed': 'failed', 'expired': 'failed',
        'cancelled': 'cancelled', 'canceled': 'cancelled',
      };
      const internalStatus = statusMap[status] || 'pending';

      const updateData = { status: internalStatus, callback_data: callbackData, updated_at: new Date().toISOString() };
      if (internalStatus === 'completed') updateData.completed_at = new Date().toISOString();

      await this.supabase.from('ebilling_payments').update(updateData).eq('id', payment.id);

      if (internalStatus === 'completed') await this.processCompletedPayment(payment);

      await this.supabase.from('ebilling_callback_logs')
        .update({ processed: true }).eq('bill_id', billId).eq('reference', externalRef);

      return { success: true, status: internalStatus, type: payment.payment_type };

    } catch (err) {
      console.error('❌ Erreur traitement callback E-Billing:', err);
      return { success: false, error: err.message };
    }
  }

  // =====================================================
  // TRAITEMENT POST-PAIEMENT
  // =====================================================

  async processCompletedPayment(payment) {
    const { payment_type, user_id } = payment;
    console.log(`✅ Traitement paiement complété: ${payment_type} pour ${user_id}`);

    switch (payment_type) {
      case 'credits': await this.processCreditsPayment(payment); break;
      case 'subscription': await this.processSubscriptionPayment(payment); break;
      case 'quiz': await this.processQuizPayment(payment); break;
      case 'campaign': await this.processCampaignPayment(payment); break;
      default: console.warn(`⚠️ Type de paiement inconnu: ${payment_type}`);
    }
  }

  async processCreditsPayment(payment) {
    const creditsToAdd = payment.credits_to_add || 0;
    const bonusCredits = payment.bonus_credits || 0;

    if (creditsToAdd > 0) {
      const { error } = await this.supabase.rpc('add_credits', {
        p_user_id: payment.user_id,
        p_credits: creditsToAdd,
        p_bonus_credits: bonusCredits,
        p_package_id: payment.package_id,
        p_price_paid_xaf: parseInt(payment.amount),
        p_payment_method: 'ebilling',
        p_payment_reference: payment.bill_id || payment.reference,
        p_description: `Achat E-Billing - ${payment.reference}`,
      });

      if (error) console.error('❌ Erreur ajout crédits:', error);
      else console.log(`✅ ${creditsToAdd + bonusCredits} crédits ajoutés à ${payment.user_id}`);
    }
  }

  async processSubscriptionPayment(payment) {
    const planSlug = payment.plan_slug;
    const planDuration = payment.plan_duration || 1;

    const { data: plan, error: planError } = await this.supabase
      .from('subscription_plans').select('*').eq('slug', planSlug).single();

    if (planError || !plan) { console.error('❌ Plan non trouvé:', planSlug); return; }

    await this.supabase.from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('user_id', payment.user_id).eq('status', 'active');

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + planDuration);

    const { error: subError } = await this.supabase.from('subscriptions').insert({
      user_id: payment.user_id,
      plan_id: plan.id,
      status: 'active',
      payment_method: 'ebilling',
      current_period_start: now.toISOString(),
      current_period_end: endDate.toISOString(),
      metadata: { ebilling_reference: payment.bill_id, payment_amount: payment.amount, duration_months: planDuration },
    });

    if (subError) { console.error('❌ Erreur création abonnement:', subError); return; }

    const monthlyCredits = plan.monthly_credits || 0;
    if (monthlyCredits > 0) {
      await this.supabase.rpc('add_user_credits', {
        p_user_id: payment.user_id,
        p_amount: monthlyCredits,
        p_reason: 'subscription_activation',
        p_description: `Crédits mensuels - Abonnement ${plan.name}`,
      });
      console.log(`✅ ${monthlyCredits} crédits mensuels attribués`);
    }

    console.log(`✅ Abonnement ${plan.name} activé jusqu'au ${endDate.toLocaleDateString('fr-FR')}`);
  }

  async processQuizPayment(payment) {
    const quizId = payment.quiz_id;
    if (!quizId) { console.error('❌ Quiz ID manquant'); return; }

    const { error } = await this.supabase.from('quiz_participants').insert({
      quiz_id: quizId,
      user_id: payment.user_id,
      payment_reference: payment.bill_id || payment.reference,
      payment_amount: payment.amount,
      status: 'registered',
      registered_at: new Date().toISOString(),
    });

    if (error && error.code !== '23505') console.error('❌ Erreur inscription quiz:', error);
    else console.log(`✅ Utilisateur inscrit au quiz ${quizId}`);
  }

  async processCampaignPayment(payment) {
    const campaignIds = payment.campaign_ids;
    if (!campaignIds || !Array.isArray(campaignIds)) { console.error('❌ Campaign IDs manquants'); return; }

    for (const campaignId of campaignIds) {
      const { error } = await this.supabase.from('campaigns')
        .update({ payment_status: 'completed', status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', campaignId);
      if (error) console.error(`❌ Erreur mise à jour campagne ${campaignId}:`, error);
    }
    console.log(`✅ ${campaignIds.length} campagne(s) payée(s)`);
  }

  // =====================================================
  // UTILITAIRES
  // =====================================================

  async getUserPaymentHistory(userId, limit = 20) {
    try {
      const { data, error } = await this.supabase
        .from('ebilling_payments').select('*')
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
const ebillingPaymentService = new EBillingPaymentService();

module.exports = ebillingPaymentService;
module.exports.EBillingPaymentService = EBillingPaymentService;
module.exports.EBILLING_CONFIG = EBILLING_CONFIG;
