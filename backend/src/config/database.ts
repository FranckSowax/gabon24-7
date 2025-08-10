import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Variables d\'environnement Supabase manquantes');
}

// Client pour les opérations publiques
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

// Client avec privilèges administrateur
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Types de base de données
export interface User {
  id: string;
  phone_number: string;
  subscription_tier: 'free' | 'premium' | 'journalist';
  subscription_status: 'active' | 'inactive' | 'suspended';
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
  preferences: {
    language: 'fr' | 'en';
    delivery_time?: string;
    categories?: string[];
    keywords?: string[];
  };
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

// Fonction de test de connexion
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      logger.error('Erreur de connexion à la base de données:', error);
      return false;
    }
    
    logger.info('Connexion à la base de données réussie');
    return true;
  } catch (error) {
    logger.error('Erreur lors du test de connexion:', error);
    return false;
  }
}
