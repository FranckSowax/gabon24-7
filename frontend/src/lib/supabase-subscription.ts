import { supabase } from '@/lib/supabase';

// Helper functions pour la gestion des abonnements
export const subscriptionHelpers = {
  async getUserSubscription(userId: string) {
    const { data, error } = await supabase
      .rpc('get_user_subscription_status', { user_uuid: userId });
    
    if (error) {
      console.error('Error fetching subscription:', error);
      return null;
    }
    
    return data;
  },

  async checkFeatureAccess(userId: string, feature: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || !subscription.is_active) {
      // Vérifier les features du plan gratuit
      return this.checkFreeFeatures(feature);
    }
    
    const features = subscription.features as string[];
    return features.some(f => f.toLowerCase().includes(feature.toLowerCase()));
  },

  checkFreeFeatures(feature: string): boolean {
    const freeFeatures = [
      'articles_limited',
      'search_basic',
      'newsletter_weekly'
    ];
    
    return freeFeatures.includes(feature);
  },

  async trackFeatureUsage(userId: string, feature: string) {
    const { error } = await supabase
      .from('feature_usage')
      .upsert({
        user_id: userId,
        feature_name: feature,
        usage_count: 1,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,feature_name',
        ignoreDuplicates: false
      });
    
    if (error) {
      console.error('Error tracking feature usage:', error);
    }
  },

  async getSubscriptionPlans() {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return [];
    }

    return data || [];
  },

  async createSubscription(userId: string, planId: string, paymentMethod: string = 'pending') {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7); // 7 jours d'essai

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'trialing',
        payment_method: paymentMethod,
        current_period_start: new Date().toISOString(),
        current_period_end: trialEnd.toISOString(),
        trial_end: trialEnd.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription:', error);
      return null;
    }

    return data;
  },

  async updateSubscriptionStatus(subscriptionId: string, status: string) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    if (error) {
      console.error('Error updating subscription status:', error);
      return false;
    }

    return true;
  },

  async recordPayment(subscriptionId: string, amount: number, status: string, transactionRef?: string) {
    const { error } = await supabase
      .from('payment_history')
      .insert({
        subscription_id: subscriptionId,
        amount,
        currency: 'XAF',
        status,
        payment_method: 'mobile_money',
        transaction_reference: transactionRef,
      });

    if (error) {
      console.error('Error recording payment:', error);
      return false;
    }

    return true;
  }
};
