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
 *
 * Utilise Prisma ORM pour les requêtes vers Supabase PostgreSQL.
 */

const { prisma } = require('../lib/prisma');
const axios = require('axios');

// Configuration E-Billing
const EBILLING_CONFIG = {
  apiUrl: process.env.EBILLING_API_URL || 'https://stg.billing-easy.com/api/v1/merchant/e_bills',
  portalUrl: process.env.EBILLING_PORTAL_URL || 'https://staging.billing-easy.net',
  username: process.env.EBILLING_USERNAME || 'Sowax',
  apiKey: process.env.EBILLING_API_KEY || 'ca492d78-cbeb-4513-9525-c23b8f0ce0c1',
};

// Générer le header Basic Auth
function getBasicAuth() {
  const credentials = `${EBILLING_CONFIG.username}:${EBILLING_CONFIG.apiKey}`;
  return 'Basic ' + Buffer.from(credentials).toString('base64');
}

class EBillingPaymentService {
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

  /**
   * Crée une facture E-Billing via l'API
   * @param {Object} params - Paramètres de la facture
   * @returns {Object} - { success, bill_id, payment_url, ... }
   */
  async createInvoice({ amount, description, reference, payerName, payerEmail, payerPhone }) {
    try {
      const callbackUrl = `${process.env.RAILWAY_PUBLIC_URL || process.env.API_URL || 'https://gabon24-7-production.up.railway.app'}/api/payments/ebilling/callback`;

      const payload = {
        amount: parseInt(amount),
        payer_msisdn: payerPhone || '',
        payer_email: payerEmail || '',
        payer_name: payerName || 'Client Gabon Insight',
        short_description: description || 'Paiement Gabon Insight',
        external_reference: reference,
        callback_url: callbackUrl,
      };

      console.log('📤 Création facture E-Billing:', { reference, amount, description });

      const response = await axios.post(
        EBILLING_CONFIG.apiUrl,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
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

      return {
        success: true,
        bill_id: billId,
        payment_url: paymentUrl,
        data: data,
      };

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

      return {
        success: false,
        error: errorMessage,
        http_code: err.response?.status,
      };
    }
  }

  /**
   * Vérifie le statut d'une facture E-Billing auprès de l'API
   */
  async checkInvoiceStatus(billId) {
    try {
      const response = await axios.get(
        `${EBILLING_CONFIG.apiUrl}/${billId}`,
        {
          headers: {
            'Authorization': getBasicAuth(),
          },
          timeout: 15000,
        }
      );

      const data = response.data;
      const eBill = data.e_bill || data;

      // Mapper le statut E-Billing vers un statut interne
      const status = (eBill.status || eBill.e_bill_status || '').toLowerCase();
      const statusMap = {
        'paid': 'completed',
        'completed': 'completed',
        'success': 'completed',
        'pending': 'pending',
        'waiting': 'pending',
        'created': 'pending',
        'failed': 'failed',
        'expired': 'failed',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
      };

      const internalStatus = statusMap[status] || 'pending';

      return {
        success: true,
        bill_id: billId,
        status: internalStatus,
        raw_status: status,
        data: eBill,
      };

    } catch (err) {
      console.error('❌ Erreur vérification statut E-Billing:', err.message);
      return { success: false, error: err.message };
    }
  }

  // =====================================================
  // INITIATION DES PAIEMENTS
  // =====================================================

  /**
   * Initialise un paiement pour achat de crédits
   */
  async initiateCreditPurchase({ userId, packageId, userEmail, userName }) {
    try {
      const pkg = await prisma.creditPackage.findFirst({
        where: { id: packageId, isActive: true },
      });

      if (!pkg) {
        return { success: false, error: 'Package de crédits non trouvé' };
      }

      const reference = this.generateReference('CRD');

      return await this.initiatePayment({
        userId,
        amount: pkg.priceXaf,
        reference,
        type: 'credits',
        packageId: pkg.id,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
        description: `Gabon Insight - ${pkg.name} (${pkg.credits + (pkg.bonusCredits || 0)} crédits)`,
        userEmail,
        userName,
      });

    } catch (err) {
      console.error('❌ Erreur initiation achat crédits:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Initialise un paiement pour abonnement
   */
  async initiateSubscriptionPayment({ userId, planSlug, duration = 1, userEmail, userName }) {
    try {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { slug: planSlug },
      });

      if (!plan) {
        return { success: false, error: 'Plan d\'abonnement non trouvé' };
      }

      const amount = duration === 12 && plan.priceYearly
        ? plan.priceYearly
        : plan.priceMonthly * duration;

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

  /**
   * Initialise un paiement pour inscription Quiz/Jeu
   */
  async initiateQuizPayment({ userId, quizId, userEmail, userName }) {
    try {
      let gameSession = null;

      // 1. Essayer par ID direct (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(quizId)) {
        gameSession = await prisma.gameSession.findUnique({
          where: { id: quizId },
        });
      }

      // 2. Essayer par session_type
      if (!gameSession) {
        gameSession = await prisma.gameSession.findFirst({
          where: { sessionType: quizId, status: 'waiting' },
          orderBy: { createdAt: 'desc' },
        });
      }

      // 3. Essayer par name (recherche insensible à la casse)
      if (!gameSession) {
        gameSession = await prisma.gameSession.findFirst({
          where: {
            name: { contains: quizId, mode: 'insensitive' },
            status: 'waiting',
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!gameSession) {
        return { success: false, error: 'Session de jeu non trouvée' };
      }

      if (!gameSession.entryFee || gameSession.entryFee <= 0) {
        return { success: false, error: 'Cette session est gratuite' };
      }

      const reference = this.generateReference('QUZ');

      return await this.initiatePayment({
        userId,
        amount: gameSession.entryFee,
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

  /**
   * Initialise un paiement pour campagne publicitaire
   */
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

  /**
   * Méthode centrale d'initiation de paiement
   */
  async initiatePayment(params) {
    const {
      userId,
      amount,
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
      quizName,
      campaignIds,
      userEmail,
      userName,
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
        amount,
        description,
        reference,
        payerName: userName,
        payerEmail: userEmail,
      });

      if (!invoiceResult.success) {
        return invoiceResult;
      }

      // 2. Enregistrer le paiement en base via Prisma
      const payment = await prisma.ebillingPayment.create({
        data: {
          userId,
          reference,
          billId: invoiceResult.bill_id,
          amount,
          description,
          status: 'pending',
          paymentType: type,
          packageId: packageId || null,
          creditsToAdd: credits || 0,
          bonusCredits: bonusCredits || 0,
          planSlug: planSlug || null,
          planDuration: planDuration || null,
          quizId: quizId || null,
          campaignIds: campaignIds || [],
          ebillingResponse: invoiceResult.data,
          metadata: {
            type,
            plan_name: planName,
            quiz_name: quizName,
            user_email: userEmail,
            user_name: userName,
          },
        },
      });

      console.log(`✅ Paiement E-Billing initié: ${reference} (${type}) - bill_id=${invoiceResult.bill_id}`);

      return {
        success: true,
        reference,
        bill_id: invoiceResult.bill_id,
        payment_url: invoiceResult.payment_url,
        amount,
        type,
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

  /**
   * Vérifie le statut d'un paiement (appelé par le polling frontend)
   */
  async checkPaymentStatus(reference) {
    try {
      // Récupérer le paiement en base (reference est unique)
      const payment = await prisma.ebillingPayment.findUnique({
        where: { reference },
      });

      if (!payment) {
        return { success: false, error: 'Paiement non trouvé' };
      }

      // Si déjà complété ou échoué, retourner directement
      if (payment.status === 'completed' || payment.status === 'failed' || payment.status === 'cancelled') {
        return {
          success: true,
          payment: {
            reference: payment.reference,
            status: payment.status,
            amount: payment.amount,
            type: payment.paymentType,
            completed_at: payment.completedAt,
          },
        };
      }

      // Sinon, vérifier auprès de E-Billing
      if (payment.billId) {
        const statusResult = await this.checkInvoiceStatus(payment.billId);

        if (statusResult.success && statusResult.status !== 'pending') {
          const updateData = {
            status: statusResult.status,
            ebillingStatusData: statusResult.data,
          };

          if (statusResult.status === 'completed') {
            updateData.completedAt = new Date();
          }

          await prisma.ebillingPayment.update({
            where: { reference },
            data: updateData,
          });

          // Si paiement réussi, exécuter l'action
          if (statusResult.status === 'completed') {
            await this.processCompletedPayment(payment);
          }

          return {
            success: true,
            payment: {
              reference: payment.reference,
              status: statusResult.status,
              amount: payment.amount,
              type: payment.paymentType,
              completed_at: statusResult.status === 'completed' ? new Date().toISOString() : null,
            },
          };
        }
      }

      // Toujours en attente
      return {
        success: true,
        payment: {
          reference: payment.reference,
          status: 'pending',
          amount: payment.amount,
          type: payment.paymentType,
        },
      };

    } catch (err) {
      console.error('❌ Erreur vérification statut:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Traite un callback E-Billing (webhook)
   */
  async processCallback(callbackData) {
    try {
      const billId = callbackData.bill_id || callbackData.e_bill_id || callbackData.id;
      const externalRef = callbackData.external_reference || callbackData.reference;
      const status = (callbackData.status || callbackData.e_bill_status || '').toLowerCase();

      console.log('📥 Callback E-Billing reçu:', { billId, externalRef, status });

      // Log du callback
      await prisma.ebillingCallbackLog.create({
        data: {
          billId: billId || null,
          reference: externalRef || null,
          status: status || null,
          rawData: callbackData,
          processed: false,
        },
      });

      // Trouver le paiement
      let payment = null;

      if (externalRef) {
        payment = await prisma.ebillingPayment.findUnique({
          where: { reference: externalRef },
        });
      }

      if (!payment && billId) {
        payment = await prisma.ebillingPayment.findFirst({
          where: { billId },
        });
      }

      if (!payment) {
        console.warn('⚠️ Paiement non trouvé pour callback:', { billId, externalRef });
        return { success: true, message: 'Paiement non trouvé mais callback enregistré' };
      }

      // Ne pas retraiter un paiement complété
      if (payment.status === 'completed') {
        return { success: true, message: 'Paiement déjà traité' };
      }

      // Mapper le statut
      const statusMap = {
        'paid': 'completed',
        'completed': 'completed',
        'success': 'completed',
        'failed': 'failed',
        'expired': 'failed',
        'cancelled': 'cancelled',
        'canceled': 'cancelled',
      };
      const internalStatus = statusMap[status] || 'pending';

      // Mettre à jour
      const updateData = {
        status: internalStatus,
        callbackData: callbackData,
      };
      if (internalStatus === 'completed') {
        updateData.completedAt = new Date();
      }

      await prisma.ebillingPayment.update({
        where: { id: payment.id },
        data: updateData,
      });

      // Exécuter l'action si complété
      if (internalStatus === 'completed') {
        await this.processCompletedPayment(payment);
      }

      // Marquer les callbacks comme traités
      await prisma.ebillingCallbackLog.updateMany({
        where: {
          billId: billId || undefined,
          reference: externalRef || undefined,
        },
        data: { processed: true },
      });

      return { success: true, status: internalStatus, type: payment.paymentType };

    } catch (err) {
      console.error('❌ Erreur traitement callback E-Billing:', err);
      return { success: false, error: err.message };
    }
  }

  // =====================================================
  // TRAITEMENT POST-PAIEMENT
  // =====================================================

  /**
   * Traite un paiement complété selon son type
   */
  async processCompletedPayment(payment) {
    const { paymentType, userId } = payment;
    console.log(`✅ Traitement paiement complété: ${paymentType} pour ${userId}`);

    switch (paymentType) {
      case 'credits':
        await this.processCreditsPayment(payment);
        break;
      case 'subscription':
        await this.processSubscriptionPayment(payment);
        break;
      case 'quiz':
        await this.processQuizPayment(payment);
        break;
      case 'campaign':
        await this.processCampaignPayment(payment);
        break;
      default:
        console.warn(`⚠️ Type de paiement inconnu: ${paymentType}`);
    }
  }

  /**
   * Traite un paiement de crédits via la fonction PostgreSQL add_credits
   */
  async processCreditsPayment(payment) {
    const creditsToAdd = payment.creditsToAdd || 0;
    const bonusCredits = payment.bonusCredits || 0;

    if (creditsToAdd > 0) {
      try {
        await prisma.$queryRaw`
          SELECT add_credits(
            ${payment.userId}::uuid,
            ${creditsToAdd}::int,
            ${bonusCredits}::int,
            ${payment.packageId}::uuid,
            ${parseInt(payment.amount)}::int,
            ${'ebilling'}::text,
            ${payment.billId || payment.reference}::text,
            ${`Achat E-Billing - ${payment.reference}`}::text
          )
        `;
        console.log(`✅ ${creditsToAdd + bonusCredits} crédits ajoutés à ${payment.userId}`);
      } catch (err) {
        console.error('❌ Erreur ajout crédits:', err);
      }
    }
  }

  /**
   * Traite un paiement d'abonnement
   */
  async processSubscriptionPayment(payment) {
    const planSlug = payment.planSlug;
    const planDuration = payment.planDuration || 1;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan) {
      console.error('❌ Plan non trouvé:', planSlug);
      return;
    }

    // Désactiver les anciens abonnements
    await prisma.subscription.updateMany({
      where: {
        userId: payment.userId,
        status: 'active',
      },
      data: { status: 'expired' },
    });

    // Calculer les dates
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + planDuration);

    // Créer le nouvel abonnement
    try {
      await prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          status: 'active',
          paymentMethod: 'ebilling',
          currentPeriodStart: now,
          currentPeriodEnd: endDate,
          metadata: {
            ebilling_reference: payment.billId,
            payment_amount: payment.amount,
            duration_months: planDuration,
          },
        },
      });
    } catch (err) {
      console.error('❌ Erreur création abonnement:', err);
      return;
    }

    // Attribuer les crédits mensuels via la fonction PostgreSQL
    const monthlyCredits = plan.monthlyCredits || 0;
    if (monthlyCredits > 0) {
      try {
        await prisma.$queryRaw`
          SELECT add_user_credits(
            ${payment.userId}::uuid,
            ${monthlyCredits}::int,
            ${'subscription_activation'}::text,
            ${`Crédits mensuels - Abonnement ${plan.name}`}::text
          )
        `;
        console.log(`✅ ${monthlyCredits} crédits mensuels attribués`);
      } catch (err) {
        console.error('❌ Erreur ajout crédits mensuels:', err);
      }
    }

    console.log(`✅ Abonnement ${plan.name} activé jusqu'au ${endDate.toLocaleDateString('fr-FR')}`);
  }

  /**
   * Traite un paiement d'inscription Quiz
   */
  async processQuizPayment(payment) {
    const quizId = payment.quizId;
    if (!quizId) {
      console.error('❌ Quiz ID manquant');
      return;
    }

    try {
      await prisma.quizParticipant.create({
        data: {
          quizId,
          userId: payment.userId,
          paymentReference: payment.billId || payment.reference,
          paymentAmount: payment.amount,
          status: 'registered',
          registeredAt: new Date(),
        },
      });
      console.log(`✅ Utilisateur inscrit au quiz ${quizId}`);
    } catch (err) {
      // Code 23505 = unique constraint violation (déjà inscrit)
      if (err.code === 'P2002') {
        console.log(`ℹ️ Utilisateur déjà inscrit au quiz ${quizId}`);
      } else {
        console.error('❌ Erreur inscription quiz:', err);
      }
    }
  }

  /**
   * Traite un paiement de campagne publicitaire
   */
  async processCampaignPayment(payment) {
    const campaignIds = payment.campaignIds;
    if (!campaignIds || !Array.isArray(campaignIds)) {
      console.error('❌ Campaign IDs manquants');
      return;
    }

    for (const campaignId of campaignIds) {
      try {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: {
            paymentStatus: 'completed',
            status: 'pending',
          },
        });
      } catch (err) {
        console.error(`❌ Erreur mise à jour campagne ${campaignId}:`, err);
      }
    }

    console.log(`✅ ${campaignIds.length} campagne(s) payée(s)`);
  }

  // =====================================================
  // UTILITAIRES
  // =====================================================

  /**
   * Récupère l'historique des paiements d'un utilisateur
   */
  async getUserPaymentHistory(userId, limit = 20) {
    try {
      const payments = await prisma.ebillingPayment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return { success: true, payments };
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
