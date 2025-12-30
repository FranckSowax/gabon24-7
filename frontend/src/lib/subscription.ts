import { supabase } from './supabase'

export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number | null
  features: string[]
  limitations: {
    gov_sources: number
    search_days: number
    daily_articles: number
    offline_articles: number
    team_accounts?: number
  }
  is_popular: boolean
  sort_order: number
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: 'active' | 'inactive' | 'cancelled' | 'expired'
  billing_cycle: 'monthly' | 'yearly'
  current_period_start: string
  current_period_end: string
  created_at: string
  updated_at: string
  plan?: SubscriptionPlan
}

// Récupérer tous les plans d'abonnement
export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  // Plans simulés en attendant la configuration de la base de données
  const mockPlans: SubscriptionPlan[] = [
    {
      id: 'free-plan',
      name: 'Freemium',
      slug: 'free',
      price_monthly: 0,
      price_yearly: 0,
      features: ['5 articles par jour', 'Accès aux Archives générales', 'Accès section Business', 'Newsletter hebdomadaire'],
      limitations: {
        gov_sources: 1,
        search_days: 7,
        daily_articles: 5,
        offline_articles: 0
      },
      is_popular: false,
      sort_order: 1
    },
    {
      id: 'discovery',
      name: 'Premium',
      slug: 'premium',
      price_monthly: 3000,
      price_yearly: 30000,
      features: ['Tout du plan Freemium', '200 crédits / mois', 'Accès chaîne WhatsApp', 'Business Plan IA'],
      limitations: {
        gov_sources: -1,
        search_days: -1,
        daily_articles: -1,
        offline_articles: 100
      },
      is_popular: true,
      sort_order: 2
    },
    {
      id: 'pro-plan',
      name: 'Professionnel',
      slug: 'pro',
      price_monthly: 12000,
      price_yearly: 120000,
      features: ['Tout du plan Premium', '600 crédits / mois', 'Déblocage Outils', 'Alertes WhatsApp'],
      limitations: {
        gov_sources: -1,
        search_days: -1,
        daily_articles: -1,
        offline_articles: -1,
        team_accounts: 10
      },
      is_popular: false,
      sort_order: 3
    }
  ];

  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error || !data || data.length === 0) {
      console.warn('Plans BDD indisponibles, utilisation des plans simulés:', error)
      return mockPlans
    }

    return data
  } catch (error) {
    console.warn('Erreur récupération plans, utilisation des plans simulés:', error)
    return mockPlans
  }
}

// Récupérer l'abonnement actuel d'un utilisateur
export const getUserSubscription = async (userId: string): Promise<UserSubscription | null> => {
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('Erreur récupération abonnement:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Erreur récupération abonnement:', error)
    return null
  }
}

// Créer un nouvel abonnement utilisateur
export const createUserSubscription = async (
  userId: string,
  planId: string,
  billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<{ data: UserSubscription | null; error: any }> => {
  // Désactiver les anciens abonnements
  await supabase
    .from('user_subscriptions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'active')

  // Calculer les dates de période
  const now = new Date()
  const periodEnd = new Date(now)
  if (billingCycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const { data, error } = await supabase
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'active',
      billing_cycle: billingCycle,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    })
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single()

  return { data, error }
}

// Vérifier si un utilisateur peut accéder à une fonctionnalité
export const checkFeatureAccess = (
  subscription: UserSubscription | null,
  feature: keyof SubscriptionPlan['limitations']
): boolean => {
  if (!subscription || !subscription.plan) {
    // Plan gratuit par défaut
    const freeLimitations = {
      gov_sources: 1,
      search_days: 7,
      daily_articles: 5,
      offline_articles: 0,
      team_accounts: 0
    }
    return (freeLimitations[feature] || 0) > 0
  }

  const limitation = subscription.plan.limitations[feature]
  return limitation === -1 || (limitation || 0) > 0
}

// Obtenir les limites d'un utilisateur
export const getUserLimitations = (subscription: UserSubscription | null) => {
  if (!subscription || !subscription.plan) {
    return {
      gov_sources: 1,
      search_days: 7,
      daily_articles: 5,
      offline_articles: 0,
      team_accounts: 0
    }
  }

  return subscription.plan.limitations
}

// Vérifier si l'abonnement est actif
export const isSubscriptionActive = (subscription: UserSubscription | null): boolean => {
  if (!subscription) return false
  
  const now = new Date()
  const endDate = new Date(subscription.current_period_end)
  
  return subscription.status === 'active' && endDate > now
}

// Obtenir le plan par défaut (Freemium)
export const getFreemiumPlan = async (): Promise<SubscriptionPlan | null> => {
  // Plan freemium simulé
  const mockFreePlan: SubscriptionPlan = {
    id: 'free-plan',
    name: 'Freemium',
    slug: 'free',
    price_monthly: 0,
    price_yearly: 0,
    features: ['5 articles par jour', 'Accès limité'],
    limitations: {
      gov_sources: 1,
      search_days: 7,
      daily_articles: 5,
      offline_articles: 0
    },
    is_popular: false,
    sort_order: 1
  };

  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('slug', 'free')
      .single()

    if (error || !data) {
      console.warn('Plan freemium BDD indisponible, utilisation du plan simulé:', error)
      return mockFreePlan
    }

    return data
  } catch (error) {
    console.warn('Erreur récupération plan freemium, utilisation du plan simulé:', error)
    return mockFreePlan
  }
}
