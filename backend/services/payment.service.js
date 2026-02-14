const supabaseService = require('../supabase-config');
const axios = require('axios');

/**
 * Service de gestion des paiements
 * Gère les interactions avec les fournisseurs de paiement (E-Billing, Stripe, etc.)
 */
class PaymentService {
  constructor() {
    this.providers = {
      'card': new CardProvider(),
      'cash': new CashProvider(),
      'demo': new DemoProvider()
    };
  }

  /**
   * Initier un paiement
   * @param {Object} params - Paramètres de paiement
   * @returns {Promise<Object>} Résultat de l'initiation
   */
  async initiatePayment(params) {
    const { 
      userId, 
      amount, 
      currency = 'XAF', 
      method, 
      provider_data = {},
      description,
      metadata = {} 
    } = params;

    console.log(`🚀 Initiation paiement: ${method} - ${amount} ${currency} (User: ${userId})`);

    const provider = this.providers[method] || this.providers['demo'];
    
    // 1. Créer l'enregistrement de transaction en base (Pending)
    const { data: transaction, error } = await supabaseService.supabase
      .from('campaign_payments')
      .insert({
        user_id: userId,
        amount,
        currency,
        payment_method: method,
        status: 'pending',
        payment_provider: provider.name,
        created_at: new Date().toISOString(),
        campaign_ids: metadata.campaignIds || [],
        mobile_number: provider_data.phoneNumber,
        mobile_operator: provider_data.operator,
        metadata: metadata
      })
      .select()
      .single();

    if (error) throw new Error(`Erreur création transaction: ${error.message}`);

    try {
      // 2. Appeler le fournisseur de paiement
      const paymentResult = await provider.initiate({
        transactionId: transaction.id,
        amount,
        currency,
        user: { id: userId, email: metadata.email, phone: provider_data.phoneNumber },
        description,
        metadata,
        provider_data
      });

      // 3. Mettre à jour la transaction avec les infos du provider
      await supabaseService.supabase
        .from('campaign_payments')
        .update({
          payment_provider_response: paymentResult.raw_response,
          external_reference: paymentResult.externalId,
          status: paymentResult.status || 'pending'
        })
        .eq('id', transaction.id);

      return {
        success: true,
        transactionId: transaction.id,
        status: paymentResult.status,
        redirectUrl: paymentResult.redirectUrl,
        instructions: paymentResult.instructions,
        providerReference: paymentResult.externalId
      };

    } catch (providerError) {
      console.error('❌ Erreur provider:', providerError);
      
      // Marquer comme échoué
      await supabaseService.supabase
        .from('campaign_payments')
        .update({
          status: 'failed',
          payment_provider_response: { error: providerError.message }
        })
        .eq('id', transaction.id);

      throw providerError;
    }
  }

  /**
   * Vérifier le statut d'un paiement
   */
  async checkStatus(transactionId) {
    // Récupérer la transaction
    const { data: transaction, error } = await supabaseService.supabase
      .from('campaign_payments')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (error || !transaction) throw new Error('Transaction non trouvée');

    const provider = this.providers[transaction.payment_method] || this.providers['demo'];
    
    // Vérifier auprès du provider
    const statusResult = await provider.checkStatus(transaction.external_reference || transaction.id);

    // Si le statut a changé, mettre à jour
    if (statusResult.status !== transaction.status) {
      await this.updateTransactionStatus(transactionId, statusResult.status, statusResult.raw_response);
      
      // Si complété, déclencher les actions post-paiement
      if (statusResult.status === 'completed') {
        await this.handlePaymentSuccess(transaction);
      }
    }

    return statusResult;
  }

  async updateTransactionStatus(transactionId, status, responseData) {
    await supabaseService.supabase
      .from('campaign_payments')
      .update({
        status,
        payment_provider_response: responseData,
        updated_at: new Date().toISOString(),
        completed_at: status === 'completed' ? new Date().toISOString() : null
      })
      .eq('id', transactionId);
  }

  async handlePaymentSuccess(transaction) {
    console.log(`✅ Paiement succès: ${transaction.id} - Déclenchement actions`);
    
    // 1. Activer les campagnes associées
    if (transaction.campaign_ids && transaction.campaign_ids.length > 0) {
      await supabaseService.supabase
        .from('campaigns')
        .update({ 
          payment_status: 'paid',
          status: 'pending_validation'
        })
        .in('id', transaction.campaign_ids);
    }

    // 2. Ajouter des crédits si c'est un achat de crédits
    if (transaction.metadata?.type === 'credit_purchase') {
      await supabaseService.supabase.rpc('add_user_credits', {
        p_user_id: transaction.user_id,
        p_credits: transaction.metadata.credits,
        p_bonus: transaction.metadata.bonus || 0
      });
    }
  }
}

// ==========================================
// FOURNISSEURS DE PAIEMENT
// ==========================================

class BaseProvider {
  constructor(name) { this.name = name; }
  async initiate(params) { throw new Error('Not implemented'); }
  async checkStatus(ref) { throw new Error('Not implemented'); }
}

/**
 * Fournisseur Demo pour les tests
 */
class DemoProvider extends BaseProvider {
  constructor() { super('Demo'); }

  async initiate({ transactionId, amount }) {
    return {
      status: 'completed',
      externalId: `DEMO-${Date.now()}`,
      raw_response: { message: 'Demo payment successful' }
    };
  }

  async checkStatus(ref) {
    return { status: 'completed', raw_response: {} };
  }
}

/**
 * Fournisseur Carte Bancaire (Stripe)
 */
class CardProvider extends BaseProvider {
  constructor() { super('Stripe'); }

  async initiate({ transactionId, amount, currency }) {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        status: 'pending',
        externalId: `STRIPE-SIM-${Date.now()}`,
        redirectUrl: 'https://checkout.stripe.com/test-link', 
        raw_response: { simulation: true, note: 'Configure STRIPE_SECRET_KEY' }
      };
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: 'Achat Gabon 24/7' },
            unit_amount: amount * 100,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel`,
        client_reference_id: transactionId,
      });

      return {
        status: 'pending',
        externalId: session.id,
        redirectUrl: session.url,
        raw_response: session
      };
    } catch (error) {
      console.error('Stripe error:', error);
      throw error;
    }
  }

  async checkStatus(ref) {
    return { status: 'pending', raw_response: {} };
  }
}

/**
 * Fournisseur Cash (Paiement en agence)
 */
class CashProvider extends BaseProvider {
  constructor() { super('Cash'); }
  
  async initiate({ transactionId }) {
    return {
      status: 'pending_cash',
      externalId: `CASH-${Date.now()}`,
      instructions: 'Rendez-vous en agence pour régler la commande.',
      raw_response: {}
    };
  }
  
  async checkStatus() { return { status: 'pending_cash' }; }
}

module.exports = new PaymentService();
