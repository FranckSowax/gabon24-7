// Types partagés entre frontend et backend
export interface User {
  id: string;
  phone_number: string;
  subscription_tier: 'free' | 'premium' | 'journalist';
  subscription_status: 'active' | 'inactive' | 'suspended';
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: 'fr' | 'en';
  delivery_time?: string;
  categories?: string[];
  keywords?: string[];
  notifications_enabled: boolean;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  media_name: string;
  author?: string;
  published_at: string;
  url: string;
  image_url?: string;
  category: string;
  keywords: string[];
  rss_feed_id: string;
  created_at: string;
}

export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  media_name: string;
  is_active: boolean;
  last_fetched_at?: string;
  fetch_interval: number;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface Editorial {
  id: string;
  title: string;
  content: string;
  template_type: 'matinale' | 'midi' | 'soir' | 'weekly';
  journalist_id: string;
  status: 'draft' | 'published' | 'scheduled';
  scheduled_for?: string;
  article_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface UserFilter {
  id: string;
  user_id: string;
  keywords: string[];
  categories: string[];
  media_sources: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: 'free' | 'premium' | 'journalist';
  status: 'active' | 'inactive' | 'suspended';
  payment_method: 'airtel_money' | 'moov_money';
  amount: number;
  currency: 'XAF';
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  currency: 'XAF';
  payment_method: 'airtel_money' | 'moov_money';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  transaction_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  user_id?: string;
  article_id?: string;
  message_type: 'article' | 'editorial' | 'notification' | 'welcome';
  content: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: string;
  created_at: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Auth Types
export interface AuthUser {
  id: string;
  phone_number: string;
  subscription_tier: 'free' | 'premium' | 'journalist';
  subscription_status: 'active' | 'inactive' | 'suspended';
  preferences: UserPreferences;
}

export interface LoginRequest {
  phone_number: string;
  otp: string;
}

export interface LoginResponse extends ApiResponse {
  data: {
    user: AuthUser;
    access_token: string;
    refresh_token: string;
  };
}

// Dashboard Types
export interface DashboardStats {
  total_articles: number;
  articles_today: number;
  active_feeds: number;
  total_users: number;
  premium_users: number;
  journalist_users: number;
  messages_sent_today: number;
  revenue_this_month: number;
}

// Categories
export const NEWS_CATEGORIES = [
  'politique',
  'economie',
  'sport',
  'culture',
  'societe',
  'international',
  'environnement',
  'sante',
  'education',
  'technologie'
] as const;

export type NewsCategory = typeof NEWS_CATEGORIES[number];

// Subscription Tiers
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Gratuit',
    price: 0,
    features: ['Canal WhatsApp public', 'Actualités générales'],
  },
  premium: {
    name: 'Premium',
    price: 2500,
    features: [
      'Messages personnalisés',
      'Filtres par mots-clés',
      'Choix des catégories',
      'Horaires de livraison'
    ],
  },
  journalist: {
    name: 'Journaliste',
    price: 5000,
    features: [
      'Toutes les fonctionnalités Premium',
      'Outils éditoriaux',
      'Génération de contenu IA',
      'Accès aux sources RSS',
      'Statistiques avancées'
    ],
  },
} as const;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;
