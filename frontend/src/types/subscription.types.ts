export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  limitations: Record<string, number>;
  is_popular: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  country: string | null;
  city: string | null;
  preferred_language: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string | null;
  plan_id: string | null;
  status: 'trialing' | 'active' | 'cancelled' | 'expired' | 'pending';
  payment_method: 'card' | 'mobile_money' | 'bank_transfer' | 'free' | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  subscription_id: string | null;
  amount: number;
  currency: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string | null;
  transaction_reference: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface FeatureUsage {
  id: string;
  user_id: string | null;
  feature_name: string;
  usage_count: number;
  last_used_at: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface SubscriptionStatus {
  is_active: boolean;
  plan_name: string;
  plan_slug: string;
  expires_at: string;
  features: string[];
  limitations: Record<string, number>;
}

export type BillingPeriod = 'monthly' | 'yearly';

export interface PricingCardProps {
  plan: SubscriptionPlan;
  billingPeriod: BillingPeriod;
  isSelected?: boolean;
  onSelect: (planSlug: string) => void;
  isLoading?: boolean;
}
