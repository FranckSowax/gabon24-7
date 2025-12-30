require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase pour GabonNews
const supabaseUrl = 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODg5MjYsImV4cCI6MjA3MDM2NDkyNn0.MLTnZFSSosMt3Lu7BeFR8LFW4ihaUo5Dx2g9sUJeHLA';

// Clé service pour contourner RLS - chargée depuis .env
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

if (supabaseServiceKey === supabaseAnonKey) {
  console.warn('⚠️  ATTENTION: Utilisation de la clé ANON au lieu de la clé SERVICE_ROLE. Les politiques RLS seront appliquées.');
} else {
  console.log('✅ Supabase client initialisé avec clé SERVICE_ROLE (bypass RLS)');
}

// Créer le client Supabase avec la clé service pour les opérations backend
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'User-Agent': 'Gabon24-7-Backend/1.0'
    },
    fetch: (url, options = {}) => {
      // Wrapper fetch avec timeout et retry
      return fetch(url, {
        ...options,
        // Timeout de 30 secondes
        signal: AbortSignal.timeout(30000)
      }).catch(error => {
        console.error('❌ Supabase fetch error:', error.message, 'URL:', url);
        throw error;
      });
    }
  }
});

class SupabaseService {
  constructor() {
    this.supabase = supabase;
  }

  // =============================================
  // GESTION DES FLUX RSS
  // =============================================

  async getRSSFeeds() {
    try {
      const { data, error } = await this.supabase
        .from('rss_feeds')
        .select('*')
        .order('priority', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur récupération flux RSS:', error);
      return [];
    }
  }

  async addRSSFeed(feedData) {
    try {
      const { data, error } = await this.supabase
        .from('rss_feeds')
        .insert([feedData])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur ajout flux RSS:', error);
      throw error;
    }
  }

  async ensureRSSFeedExists(feedData) {
    try {
      // Vérifier si le flux existe déjà
      const { data: existing, error: selectError } = await this.supabase
        .from('rss_feeds')
        .select('*')
        .eq('url', feedData.url)
        .single();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows found
        throw selectError;
      }

      if (existing) {
        console.log(`✅ Flux RSS existe déjà: ${existing.name}`);
        return existing;
      }

      // Créer le flux s'il n'existe pas
      console.log(`➕ Création nouveau flux RSS: ${feedData.name}`);
      const { data, error } = await this.supabase
        .from('rss_feeds')
        .insert([feedData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Erreur ensureRSSFeedExists:', error.message);
      throw error;
    }
  }

  async updateRSSFeed(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('rss_feeds')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur mise à jour flux RSS:', error);
      throw error;
    }
  }

  async deleteRSSFeed(id) {
    try {
      const { error } = await this.supabase
        .from('rss_feeds')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erreur suppression flux RSS:', error);
      throw error;
    }
  }

  // =============================================
  // GESTION DES ARTICLES
  // =============================================

  async insertArticle(article) {
    try {
      console.log('💾 Insertion article dans Supabase...');
      
      // Préparer l'article pour l'insertion
      const articleData = {
        feed_id: article.feed_id,
        external_id: article.external_id,
        title: article.title,
        summary: article.summary,
        ai_summary: article.ai_summary,
        content: article.content,
        url: article.url,
        image_urls: article.image_urls || [],
        author: article.author,
        published_at: article.published_at,
        category: article.category,
        keywords: article.keywords || [],
        sentiment: article.sentiment,
        is_published: article.is_published !== false
      };

      const { data, error } = await this.supabase
        .from('articles')
        .insert([articleData])
        .select();

      if (error) {
        console.error('❌ Erreur insertion article:', error.message);
        throw error;
      }

      console.log('✅ Article inséré avec succès:', data?.[0]?.id);
      return data?.[0];
    } catch (error) {
      console.error('❌ Erreur insertion article:', error.message);
      throw error;
    }
  }

  async getArticles(page = 1, limit = 20, filters = {}) {
    try {
      let query = this.supabase
        .from('articles')
        .select(`
          *,
          rss_feeds(name, category)
        `)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      // Filtres
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters.sentiment) {
        query = query.eq('sentiment', filters.sentiment);
      }

      if (filters.search) {
        query = query.textSearch('title', filters.search);
      }

      // Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        articles: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Erreur récupération articles:', error);
      return { articles: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  async addArticle(article) {
    try {
      const { data, error } = await this.supabase
        .from('articles')
        .insert([article])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur ajout article:', error);
      throw error;
    }
  }

  async updateArticle(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('articles')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur mise à jour article:', error);
      throw error;
    }
  }

  async getArticleById(id) {
    try {
      const { data, error } = await this.supabase
        .from('articles')
        .select(`
          *,
          rss_feeds(name, category)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erreur récupération article:', error);
      return null;
    }
  }

  // =============================================
  // GESTION DES UTILISATEURS
  // =============================================

  async getUsers(page = 1, limit = 20) {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        users: data || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Erreur récupération utilisateurs:', error);
      return { users: [], total: 0, page, limit, totalPages: 0 };
    }
  }

  async addUser(user) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([user])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur ajout utilisateur:', error);
      throw error;
    }
  }

  // =============================================
  // GESTION DES MESSAGES WHATSAPP
  // =============================================

  async addWhatsAppMessage(message) {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_messages')
        .insert([message])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur ajout message WhatsApp:', error);
      throw error;
    }
  }

  async updateWhatsAppMessage(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('whatsapp_messages')
        .update(updates)
        .eq('id', id)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur mise à jour message WhatsApp:', error);
      throw error;
    }
  }

  // =============================================
  // ANALYTICS ET STATISTIQUES
  // =============================================

  async getStats() {
    try {
      // Statistiques utilisateurs
      const { data: userStats } = await this.supabase
        .from('user_stats')
        .select('*');

      // Statistiques articles
      const { data: articleStats } = await this.supabase
        .from('daily_article_stats')
        .select('*')
        .limit(7)
        .order('date', { ascending: false });

      // Flux actifs
      const { data: activeFeeds } = await this.supabase
        .from('active_feeds_stats')
        .select('*');

      // Top articles
      const { data, error } = await this.supabase
        .from('rss_feeds')
        .insert({
          name: feedData.name,
          url: feedData.url,
          description: feedData.description || '',
          category: feedData.category || 'Actualités',
          language: feedData.language || 'fr',
          country: feedData.country || 'GA',
          status: 'active',
          fetch_interval_minutes: feedData.fetch_interval_minutes || 30,
          total_articles_count: 0,
          is_premium: feedData.is_premium || false,
          priority: feedData.priority || 1
        })
        .select()
        .single();

      return {
        userStats: userStats || [],
        articleStats: articleStats || [],
        activeFeeds: activeFeeds || [],
        topArticles: data || []
      };
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      return {
        userStats: [],
        articleStats: [],
        activeFeeds: [],
        topArticles: []
      };
    }
  }

  async addAnalytic(date, metricType, metricValue, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('analytics')
        .upsert([{
          date,
          metric_type: metricType,
          metric_value: metricValue,
          metadata
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur ajout analytique:', error);
      throw error;
    }
  }

  // =============================================
  // LOGS SYSTÈME
  // =============================================

  async addLog(level, component, message, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('system_logs')
        .insert([{
          level,
          component,
          message,
          metadata
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Erreur ajout log:', error);
      // Ne pas throw pour éviter les boucles d'erreur
      return null;
    }
  }

  // =============================================
  // UTILITAIRES
  // =============================================

  async testConnection() {
    try {
      const { data, error } = await this.supabase
        .from('rss_feeds')
        .select('count')
        .limit(1);

      return !error;
    } catch (error) {
      console.error('Erreur test connexion Supabase:', error);
      return false;
    }
  }

  // =============================================
  // FILTRES PREMIUM
  // =============================================

  async testUserFilter(filterConfig) {
    try {
      // Simuler un test de filtre avec des articles de démonstration
      const mockArticles = [
        {
          id: 1,
          title: "Développement économique au Gabon",
          category: "Économie",
          keywords: ["économie", "gabon", "développement"],
          sentiment: "positif",
          published_at: new Date().toISOString()
        },
        {
          id: 2,
          title: "Politique gabonaise en transition",
          category: "Politique",
          keywords: ["politique", "gabon", "transition"],
          sentiment: "neutre",
          published_at: new Date().toISOString()
        },
        {
          id: 3,
          title: "Crise environnementale préoccupante",
          category: "Environnement",
          keywords: ["environnement", "crise", "gabon"],
          sentiment: "négatif",
          published_at: new Date().toISOString()
        }
      ];

      // Appliquer les filtres
      let filteredArticles = mockArticles;

      // Filtre par mots-clés
      if (filterConfig.keywords && filterConfig.keywords.length > 0) {
        filteredArticles = filteredArticles.filter(article =>
          filterConfig.keywords.some(keyword =>
            article.keywords.includes(keyword.toLowerCase()) ||
            article.title.toLowerCase().includes(keyword.toLowerCase())
          )
        );
      }

      // Filtre par catégories
      if (filterConfig.categories && filterConfig.categories.length > 0) {
        filteredArticles = filteredArticles.filter(article =>
          filterConfig.categories.includes(article.category)
        );
      }

      // Filtre par sentiment
      if (filterConfig.sentiment) {
        filteredArticles = filteredArticles.filter(article =>
          article.sentiment === filterConfig.sentiment
        );
      }

      return {
        success: true,
        totalArticles: mockArticles.length,
        filteredArticles: filteredArticles.length,
        matchingArticles: filteredArticles,
        filterConfig: filterConfig,
        message: `Filtre testé avec succès. ${filteredArticles.length}/${mockArticles.length} articles correspondent aux critères.`
      };

    } catch (error) {
      console.error('Erreur test filtre utilisateur:', error);
      return {
        success: false,
        error: 'Erreur lors du test du filtre',
        message: error.message
      };
    }
  }

  async getUserFilters(userId) {
    try {
      // Simuler la récupération des filtres utilisateur
      return [
        {
          id: 1,
          user_id: userId,
          name: "Économie Gabonaise",
          filter_config: {
            keywords: ["économie", "gabon"],
            categories: ["Économie"],
            sentiment: "positif"
          },
          is_active: true,
          created_at: new Date().toISOString()
        }
      ];
    } catch (error) {
      console.error('Erreur récupération filtres utilisateur:', error);
      return [];
    }
  }

  async addUserFilter(filterData) {
    try {
      // Simuler l'ajout d'un filtre utilisateur
      const newFilter = {
        id: Date.now(),
        ...filterData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return newFilter;
    } catch (error) {
      console.error('Erreur ajout filtre utilisateur:', error);
      throw error;
    }
  }
}

// Créer et exporter une instance unique du service
const supabaseService = new SupabaseService();
module.exports = supabaseService;
