const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const OpenAIService = require('./openai-service');
const SupabaseService = require('./supabase-config');

class RSSParserService {
  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'GabonNews RSS Reader 1.0'
      }
    });
    
    // Services
    this.openaiService = new OpenAIService();
    this.supabaseService = new SupabaseService();
    
    // Cache en mémoire pour performance (optionnel)
    this.articlesCache = [];
    this.feedsCache = [];
    this.lastFetchTimes = new Map();
    
    // Initialiser les données depuis Supabase
    this.initializeFromDatabase();
  }

  // Initialiser les données depuis Supabase
  async initializeFromDatabase() {
    try {
      console.log('🔄 Initialisation depuis Supabase...');
      
      // Charger les flux RSS depuis Supabase
      this.feedsCache = await this.supabaseService.getRSSFeeds();
      console.log(`✅ ${this.feedsCache.length} flux RSS chargés depuis Supabase`);
      
      // Charger les articles récents pour le cache
      const recentArticles = await this.supabaseService.getArticles(1, 100);
      this.articlesCache = recentArticles.articles || [];
      console.log(`✅ ${this.articlesCache.length} articles récents chargés en cache`);
      
    } catch (error) {
      console.error('❌ Erreur initialisation Supabase:', error);
      // Fallback vers données par défaut si Supabase indisponible
      this.feedsCache = [];
      this.articlesCache = [];
    }
  }

  // Ajouter un flux RSS
  async addFeed(feed) {
    try {
      // Ajouter à Supabase
      const savedFeed = await this.supabaseService.addRSSFeed(feed);
      
      // Mettre à jour le cache
      const existingIndex = this.feedsCache.findIndex(f => f.id === savedFeed.id);
      if (existingIndex >= 0) {
        this.feedsCache[existingIndex] = savedFeed;
      } else {
        this.feedsCache.push(savedFeed);
      }
      
      console.log(`✅ Flux RSS ajouté: ${savedFeed.name} - ${savedFeed.url}`);
      return savedFeed;
    } catch (error) {
      console.error(`❌ Erreur ajout flux RSS:`, error);
      throw error;
    }
  }

  // Supprimer un flux RSS
  async removeFeed(feedId) {
    try {
      // Supprimer de Supabase
      await this.supabaseService.deleteRSSFeed(feedId);
      
      // Mettre à jour le cache
      const index = this.feedsCache.findIndex(f => f.id === feedId);
      let removed = null;
      if (index >= 0) {
        removed = this.feedsCache.splice(index, 1)[0];
        
        // Supprimer les articles de ce flux du cache
        this.articlesCache = this.articlesCache.filter(article => article.feed_id !== feedId);
        
        console.log(`🗑️ Flux RSS supprimé: ${removed.name}`);
      }
      
      return removed;
    } catch (error) {
      console.error(`❌ Erreur suppression flux RSS:`, error);
      throw error;
    }
  }

  // Nettoyer le contenu HTML
  cleanContent(html) {
    if (!html) return '';
    const $ = cheerio.load(html);
    
    // Supprimer les scripts et styles
    $('script, style, iframe, object, embed').remove();
    
    // Extraire le texte propre
    let text = $.text().trim();
    
    // Nettoyer les espaces multiples
    text = text.replace(/\s+/g, ' ');
    
    // Limiter à 500 caractères pour le résumé
    if (text.length > 500) {
      text = text.substring(0, 497) + '...';
    }
    
    return text;
  }

  // Extraire les images du contenu
  extractImages(content) {
    if (!content) return [];
    
    const $ = cheerio.load(content);
    const images = [];
    
    $('img').each((i, elem) => {
      const src = $(elem).attr('src');
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        images.push(src.startsWith('//') ? 'https:' + src : src);
      }
    });
    
    return images;
  }

  // Tester la connectivité d'un flux RSS
  async testFeed(feedUrl) {
    try {
      console.log(`🔍 Test du flux RSS: ${feedUrl}`);
      
      const feed = await this.parser.parseURL(feedUrl);
      
      return {
        success: true,
        title: feed.title,
        description: feed.description,
        itemCount: feed.items ? feed.items.length : 0,
        lastBuildDate: feed.lastBuildDate,
        link: feed.link
      };
    } catch (error) {
      console.error(`❌ Erreur test RSS ${feedUrl}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Parser un flux RSS et extraire les articles
  async parseFeed(feed) {
    try {
      console.log(`📡 Parsing du flux RSS: ${feed.name} - ${feed.url}`);
      
      const parsedFeed = await this.parser.parseURL(feed.url);
      const newArticles = [];
      
      if (!parsedFeed.items || parsedFeed.items.length === 0) {
        console.log(`⚠️ Aucun article trouvé dans ${feed.name}`);
        return newArticles;
      }

      for (const item of parsedFeed.items) {
        try {
          // Créer un ID unique pour l'article
          const articleId = this.generateArticleId(item.link || item.guid || item.title);
          
          // Vérifier si l'article existe déjà
          if (this.articles.find(a => a.id === articleId)) {
            continue;
          }

          // Extraire et nettoyer le contenu
          const cleanedContent = this.cleanContent(item.contentSnippet || item.content || item.description);
          const images = this.extractImages(item.content || item.description);

          // Générer un résumé avec OpenAI
          const aiSummary = await this.openaiService.generateSummary(
            item.title || 'Sans titre',
            cleanedContent,
            feed.name
          );

          // Générer des mots-clés
          const keywords = await this.openaiService.generateKeywords(
            item.title || 'Sans titre',
            cleanedContent,
            feed.name
          );

          // Analyser le sentiment
          const sentimentAnalysis = await this.openaiService.analyzeSentiment(
            item.title || 'Sans titre',
            cleanedContent
          );

          const article = {
            feed_id: feed.id,
            external_id: item.guid || item.link || articleId,
            title: item.title || 'Sans titre',
            summary: cleanedContent || 'Résumé non disponible',
            ai_summary: aiSummary,
            content: item.content || item.description || '',
            url: item.link || '',
            author: item.creator || item['dc:creator'] || 'Rédaction',
            published_at: item.pubDate || item.isoDate || new Date().toISOString(),
            language: 'fr',
            category: feed.category || 'Actualités',
            keywords: keywords,
            sentiment: sentimentAnalysis.sentiment,
            sentiment_confidence: sentimentAnalysis.confidence,
            read_time_minutes: this.calculateReadTimeMinutes(cleanedContent),
            image_urls: images,
            is_trending: false,
            is_published: true,
            is_premium: feed.is_premium || false
          };

          try {
            // Sauvegarder l'article dans Supabase
            const savedArticle = await this.supabaseService.addArticle(article);
            newArticles.push(savedArticle);
            
            // Ajouter au cache
            this.articlesCache.unshift(savedArticle);
            
            // Limiter le cache à 1000 articles
            if (this.articlesCache.length > 1000) {
              this.articlesCache = this.articlesCache.slice(0, 1000);
            }
            
          } catch (dbError) {
            if (dbError.message && dbError.message.includes('duplicate')) {
              console.log(`⚠️ Article déjà existant: ${article.title}`);
            } else {
              console.error(`❌ Erreur sauvegarde article:`, dbError);
            }
          }

        } catch (itemError) {
          console.error(`❌ Erreur parsing article de ${feed.name}:`, itemError.message);
        }
      }

      // Mettre à jour le statut du flux dans Supabase
      try {
        await this.supabaseService.updateRSSFeed(feed.id, {
          status: 'active',
          last_fetch_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          total_articles_count: newArticles.length
        });
        
        // Mettre à jour le cache
        const feedIndex = this.feedsCache.findIndex(f => f.id === feed.id);
        if (feedIndex >= 0) {
          this.feedsCache[feedIndex].status = 'active';
          this.feedsCache[feedIndex].last_fetch_at = new Date().toISOString();
          this.feedsCache[feedIndex].last_success_at = new Date().toISOString();
        }
      } catch (updateError) {
        console.error(`❌ Erreur mise à jour statut flux:`, updateError);
      }

      this.lastFetchTimes.set(feed.id, Date.now());
      
      console.log(`✅ ${newArticles.length} nouveaux articles récupérés de ${feed.name}`);
      return newArticles;

    } catch (error) {
      console.error(`❌ Erreur parsing flux ${feed.name}:`, error.message);
      
      // Mettre à jour le statut d'erreur
      const feedIndex = this.feeds.findIndex(f => f.id === feed.id);
      if (feedIndex >= 0) {
        this.feeds[feedIndex].status = 'error';
        this.feeds[feedIndex].lastError = error.message;
      }
      
      return [];
    }
  }

  // Générer un ID unique pour un article
  generateArticleId(link) {
    return Buffer.from(link || Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  // Calculer le temps de lecture estimé
  calculateReadTime(text) {
    if (!text) return '1 min';
    const wordsPerMinute = 200;
    const wordCount = text.split(' ').length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return `${minutes} min`;
  }

  // Calculer le temps de lecture en minutes (pour Supabase)
  calculateReadTimeMinutes(text) {
    if (!text) return 1;
    const wordsPerMinute = 200;
    const wordCount = text.split(' ').length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  // Formater la date
  formatDate(dateString) {
    if (!dateString) return 'Date inconnue';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      if (diffHours < 1) return 'À l\'instant';
      if (diffHours < 24) return `${diffHours} heure${diffHours > 1 ? 's' : ''}`;
      if (diffDays < 7) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      
      return date.toLocaleDateString('fr-FR');
    } catch (error) {
      return 'Date inconnue';
    }
  }

  // Synchroniser tous les flux RSS
  async syncAllFeeds() {
    // Recharger les flux depuis Supabase pour avoir les dernières données
    await this.initializeFromDatabase();
    
    console.log(`🔄 Début de synchronisation de ${this.feedsCache.length} flux RSS`);
    
    let totalNewArticles = 0;
    let successfulFeeds = 0;
    
    for (const feed of this.feedsCache) {
      try {
        const newArticles = await this.parseFeed(feed);
        totalNewArticles += newArticles.length;
        if (newArticles.length > 0 || feed.status === 'active') {
          successfulFeeds++;
        }
        
        // Attendre un peu entre chaque flux pour éviter la surcharge
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Erreur sync flux ${feed.name}:`, error.message);
        
        // Mettre à jour le statut d'erreur dans Supabase
        try {
          await this.supabaseService.updateRSSFeed(feed.id, {
            status: 'error',
            last_error: error.message,
            last_fetch_at: new Date().toISOString()
          });
        } catch (updateError) {
          console.error(`❌ Erreur mise à jour statut erreur:`, updateError);
        }
      }
    }

    console.log(`✅ Synchronisation terminée: ${totalNewArticles} nouveaux articles de ${successfulFeeds} flux`);
    
    return {
      totalNewArticles,
      successfulFeeds,
      totalFeeds: this.feedsCache.length,
      totalArticles: this.articlesCache.length
    };
  }

  // Obtenir tous les articles avec pagination (utilise Supabase)
  async getArticles(page = 1, limit = 20, filters = {}) {
    try {
      return await this.supabaseService.getArticles(page, limit, filters);
    } catch (error) {
      console.error('❌ Erreur récupération articles Supabase:', error);
      // Fallback vers le cache
      return this.getArticlesFromCache(page, limit, filters);
    }
  }

  // Fallback: obtenir articles depuis le cache
  getArticlesFromCache(page = 1, limit = 20, filters = {}) {
    let filteredArticles = this.articlesCache;
    
    if (filters.category && filters.category !== 'all') {
      filteredArticles = this.articlesCache.filter(a => 
        a.category && a.category.toLowerCase() === filters.category.toLowerCase()
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredArticles = filteredArticles.filter(a => 
        (a.title && a.title.toLowerCase().includes(searchLower)) ||
        (a.summary && a.summary.toLowerCase().includes(searchLower)) ||
        (a.ai_summary && a.ai_summary.toLowerCase().includes(searchLower))
      );
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      articles: filteredArticles.slice(startIndex, endIndex),
      total: filteredArticles.length,
      page,
      limit,
      totalPages: Math.ceil(filteredArticles.length / limit)
    };
  }

  // Obtenir les statistiques
  async getStats() {
    try {
      const stats = await this.supabaseService.getStats();
      return stats;
    } catch (error) {
      console.error('❌ Erreur récupération stats Supabase:', error);
      // Fallback vers le cache
      return this.getStatsFromCache();
    }
  }

  // Fallback: obtenir stats depuis le cache
  getStatsFromCache() {
    const activeFeeds = this.feedsCache.filter(f => f.status === 'active').length;
    const today = new Date().toDateString();
    const todayArticles = this.articlesCache.filter(a => 
      new Date(a.created_at).toDateString() === today
    ).length;

    return {
      totalArticles: this.articlesCache.length,
      activeFeeds,
      totalFeeds: this.feedsCache.length,
      todayArticles,
      categories: this.getCategoriesFromCache()
    };
  }

  // Obtenir les catégories disponibles depuis le cache
  getCategoriesFromCache() {
    const categories = [...new Set(this.articlesCache.map(a => a.category).filter(Boolean))];
    return categories.map(cat => ({
      name: cat,
      count: this.articlesCache.filter(a => a.category === cat).length
    }));
  }

  // Getter pour les flux (compatible avec l'ancien code)
  get feeds() {
    return this.feedsCache;
  }

  // Getter pour les articles (compatible avec l'ancien code)
  get articles() {
    return this.articlesCache;
  }

  // Démarrer la synchronisation automatique
  startAutoSync(intervalMinutes = 30) {
    console.log(`⏰ Synchronisation automatique programmée toutes les ${intervalMinutes} minutes`);
    
    // Synchronisation immédiate
    this.syncAllFeeds();
    
    // Programmer la synchronisation périodique
    const cronExpression = `*/${intervalMinutes} * * * *`;
    cron.schedule(cronExpression, () => {
      console.log('🔄 Synchronisation automatique déclenchée');
      this.syncAllFeeds();
    });
  }
}

module.exports = RSSParserService;
