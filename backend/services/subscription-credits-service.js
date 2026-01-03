/**
 * 🎫 SERVICE D'ATTRIBUTION DES CRÉDITS D'ABONNEMENT
 *
 * Gère l'attribution automatique des crédits mensuels
 * lors de la souscription ou du renouvellement d'un abonnement.
 *
 * Crédits par plan:
 * - Freemium: 0 crédits
 * - Premium/Discovery: 300 crédits/mois
 * - Pro: 1000 crédits/mois
 */

const { supabase } = require('../config/supabase');

// Configuration des crédits par plan
// Tous les types d'abonnement reconnus par l'application
const PLAN_CREDITS = {
  'free': 0,
  'freemium': 0,
  'premium': 300,      // Legacy - même crédits que discovery
  'discovery': 300,    // Plan Premium
  'pro': 1000,         // Plan Professionnel
  'enterprise': 2000,  // Plan Entreprise (admin)
  'journalist': 500    // Legacy - journalistes
};

class SubscriptionCreditsService {
  constructor() {
    this.supabase = supabase;
  }

  /**
   * Récupère les crédits mensuels pour un plan donné
   * @param {string} planSlug - Slug du plan (free, premium, pro)
   * @returns {number} - Nombre de crédits mensuels
   */
  getMonthlyCredits(planSlug) {
    return PLAN_CREDITS[planSlug?.toLowerCase()] || 0;
  }

  /**
   * Récupère les infos d'un plan depuis la base de données
   * @param {string} planSlug - Slug du plan
   * @returns {Promise<Object|null>} - Détails du plan
   */
  async getPlanBySlug(planSlug) {
    try {
      const { data, error } = await this.supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', planSlug)
        .single();

      if (error) {
        console.error('❌ Erreur récupération plan:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('❌ Exception getPlanBySlug:', err.message);
      return null;
    }
  }

  /**
   * Attribue les crédits d'abonnement à un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} planSlug - Slug du plan souscrit
   * @param {string} reason - Raison de l'attribution (subscription, renewal, manual)
   * @returns {Promise<{success: boolean, credits: number, error?: string}>}
   */
  async grantSubscriptionCredits(userId, planSlug, reason = 'subscription') {
    try {
      const credits = this.getMonthlyCredits(planSlug);

      if (credits === 0) {
        console.log(`ℹ️ Plan ${planSlug} : 0 crédits à attribuer`);
        return { success: true, credits: 0, message: 'Plan gratuit, pas de crédits' };
      }

      console.log(`🎫 Attribution de ${credits} crédits à l'utilisateur ${userId} (${planSlug})`);

      // Utiliser la fonction RPC add_user_credits si elle existe
      const { data: rpcData, error: rpcError } = await this.supabase.rpc('add_user_credits', {
        p_user_id: userId,
        p_amount: credits,
        p_reason: `subscription_${reason}`,
        p_description: `Crédits mensuels - Plan ${planSlug.charAt(0).toUpperCase() + planSlug.slice(1)}`
      });

      if (rpcError) {
        // Fallback: insertion directe si RPC n'existe pas
        console.warn('⚠️ RPC add_user_credits non disponible, fallback direct');
        return await this.grantCreditsDirectly(userId, credits, planSlug, reason);
      }

      // Enregistrer la transaction dans l'historique
      await this.logCreditTransaction(userId, credits, planSlug, reason);

      console.log(`✅ ${credits} crédits attribués avec succès`);
      return { success: true, credits, balance: rpcData };

    } catch (err) {
      console.error('❌ Erreur attribution crédits:', err.message);
      return { success: false, credits: 0, error: err.message };
    }
  }

  /**
   * Attribution directe des crédits (fallback si RPC non disponible)
   */
  async grantCreditsDirectly(userId, credits, planSlug, reason) {
    try {
      // Vérifier si l'utilisateur a déjà un enregistrement de crédits
      const { data: existing, error: checkError } = await this.supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(checkError.message);
      }

      let newBalance;

      if (existing) {
        // Mettre à jour le solde existant
        newBalance = (existing.balance || 0) + credits;
        const { error: updateError } = await this.supabase
          .from('user_credits')
          .update({
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) throw new Error(updateError.message);
      } else {
        // Créer un nouvel enregistrement
        newBalance = credits;
        const { error: insertError } = await this.supabase
          .from('user_credits')
          .insert({
            user_id: userId,
            balance: credits,
            total_purchased: 0,
            total_consumed: 0
          });

        if (insertError) throw new Error(insertError.message);
      }

      // Enregistrer la transaction
      await this.logCreditTransaction(userId, credits, planSlug, reason);

      console.log(`✅ ${credits} crédits attribués directement (nouveau solde: ${newBalance})`);
      return { success: true, credits, balance: newBalance };

    } catch (err) {
      console.error('❌ Erreur attribution directe:', err.message);
      return { success: false, credits: 0, error: err.message };
    }
  }

  /**
   * Enregistre la transaction de crédits dans l'historique
   */
  async logCreditTransaction(userId, credits, planSlug, reason) {
    try {
      await this.supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          amount: credits,
          type: 'subscription',
          description: `Crédits mensuels - Plan ${planSlug} (${reason})`,
          metadata: {
            plan_slug: planSlug,
            reason: reason,
            granted_at: new Date().toISOString()
          }
        });
    } catch (err) {
      console.warn('⚠️ Erreur log transaction (non-bloquant):', err.message);
    }
  }

  /**
   * Active un abonnement et attribue les crédits (pour admin)
   * @param {string} userId - ID de l'utilisateur
   * @param {string} planSlug - Slug du plan
   * @param {number} durationMonths - Durée en mois (1 = mensuel, 12 = annuel)
   * @returns {Promise<Object>}
   */
  async activateSubscription(userId, planSlug, durationMonths = 1) {
    try {
      console.log(`🔄 Activation abonnement ${planSlug} pour ${userId} (${durationMonths} mois)`);

      // Récupérer le plan
      const plan = await this.getPlanBySlug(planSlug);
      if (!plan) {
        return { success: false, error: `Plan "${planSlug}" non trouvé` };
      }

      // Calculer les dates
      const now = new Date();
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + durationMonths);

      // Désactiver les anciens abonnements actifs
      await this.supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          updated_at: now.toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'active');

      // Créer le nouvel abonnement
      const { data: subscription, error: subError } = await this.supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan.id,
          status: 'active',
          payment_method: 'manual', // Attribution manuelle par admin
          current_period_start: now.toISOString(),
          current_period_end: endDate.toISOString(),
          metadata: {
            activated_by: 'admin',
            duration_months: durationMonths
          }
        })
        .select()
        .single();

      if (subError) {
        console.error('❌ Erreur création abonnement:', subError.message);
        return { success: false, error: subError.message };
      }

      // Attribuer les crédits
      const creditsResult = await this.grantSubscriptionCredits(userId, planSlug, 'activation');

      console.log(`✅ Abonnement ${planSlug} activé jusqu'au ${endDate.toLocaleDateString('fr-FR')}`);

      return {
        success: true,
        subscription: subscription,
        credits: creditsResult,
        expires_at: endDate.toISOString()
      };

    } catch (err) {
      console.error('❌ Erreur activation abonnement:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Renouvelle un abonnement et attribue les crédits mensuels
   * @param {string} subscriptionId - ID de l'abonnement à renouveler
   * @returns {Promise<Object>}
   */
  async renewSubscription(subscriptionId) {
    try {
      // Récupérer l'abonnement avec le plan
      const { data: subscription, error: fetchError } = await this.supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('id', subscriptionId)
        .single();

      if (fetchError || !subscription) {
        return { success: false, error: 'Abonnement non trouvé' };
      }

      const now = new Date();
      const newEndDate = new Date(subscription.current_period_end);
      newEndDate.setMonth(newEndDate.getMonth() + 1);

      // Mettre à jour les dates
      const { error: updateError } = await this.supabase
        .from('subscriptions')
        .update({
          current_period_start: now.toISOString(),
          current_period_end: newEndDate.toISOString(),
          status: 'active',
          updated_at: now.toISOString()
        })
        .eq('id', subscriptionId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Attribuer les crédits mensuels
      const creditsResult = await this.grantSubscriptionCredits(
        subscription.user_id,
        subscription.plan.slug,
        'renewal'
      );

      console.log(`✅ Abonnement renouvelé jusqu'au ${newEndDate.toLocaleDateString('fr-FR')}`);

      return {
        success: true,
        new_period_end: newEndDate.toISOString(),
        credits: creditsResult
      };

    } catch (err) {
      console.error('❌ Erreur renouvellement:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Récupère le solde de crédits d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<number>}
   */
  async getUserBalance(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return 0; // Pas de record
        throw error;
      }

      return data?.balance || 0;
    } catch (err) {
      console.error('❌ Erreur récupération solde:', err.message);
      return 0;
    }
  }

  /**
   * Récupère les statistiques des abonnements (pour admin)
   */
  async getSubscriptionStats() {
    try {
      const { data: stats, error } = await this.supabase
        .from('subscriptions')
        .select(`
          status,
          plan:subscription_plans(slug, name)
        `)
        .eq('status', 'active');

      if (error) throw error;

      const summary = {
        total_active: stats.length,
        by_plan: {}
      };

      stats.forEach(sub => {
        const planSlug = sub.plan?.slug || 'unknown';
        if (!summary.by_plan[planSlug]) {
          summary.by_plan[planSlug] = { count: 0, name: sub.plan?.name };
        }
        summary.by_plan[planSlug].count++;
      });

      return summary;

    } catch (err) {
      console.error('❌ Erreur stats abonnements:', err.message);
      return { total_active: 0, by_plan: {} };
    }
  }
}

// Singleton
const subscriptionCreditsService = new SubscriptionCreditsService();

module.exports = subscriptionCreditsService;
module.exports.SubscriptionCreditsService = SubscriptionCreditsService;
module.exports.PLAN_CREDITS = PLAN_CREDITS;
