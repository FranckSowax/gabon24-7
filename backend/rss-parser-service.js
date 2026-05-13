const Parser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const OpenAIService = require('./openai-service');
const SupabaseService = require('./supabase-config');

class RSSParserService {
  constructor(supabaseService) {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'GabonNews RSS Reader 1.0'
      }
    });
    
    // Services
    this.openaiService = new OpenAIService();
    this.supabaseService = supabaseService;
    
    // Cache en mémoire pour performance (optionnel)
    this.articlesCache = [];
    this.feedsCache = [];
    this.lastFetchTimes = new Map();
    
    // Initialiser les données depuis Supabase (désactivé pour éviter le blocage)
    // this.initializeFromDatabase();
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

  // Vérifier si une URL est une image valide
  isImageUrl(url) {
    if (!url) return false;
    
    // Nettoyer l'URL
    const cleanUrl = url.toLowerCase().trim();
    
    // Vérifier les extensions d'image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    const hasImageExtension = imageExtensions.some(ext => cleanUrl.includes(ext));
    
    // Vérifier les domaines d'images connus
    const imageDomains = ['wp-content', 'images', 'img', 'media', 'photos', 'assets'];
    const hasImageDomain = imageDomains.some(domain => cleanUrl.includes(domain));
    
    // Éviter les images de tracking et petites icônes
    const excludePatterns = ['1x1', 'pixel', 'tracking', 'beacon', 'analytics'];
    const hasExcludePattern = excludePatterns.some(pattern => cleanUrl.includes(pattern));
    
    return (hasImageExtension || hasImageDomain) && !hasExcludePattern;
  }

  // Extraire les images du contenu
  extractImages(content) {
    if (!content) return [];
    
    const $ = cheerio.load(content);
    const images = [];
    
    $('img').each((i, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      if (src && this.isImageUrl(src)) {
        const fullUrl = src.startsWith('//') ? 'https:' + src : src;
        if (fullUrl.startsWith('http')) {
          images.push(fullUrl);
        }
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

          // Générer un résumé simple (sans OpenAI)
          const aiSummary = this.openaiService.generateMockSummary(
            item.title || 'Sans titre',
            cleanedContent
          );

          // Générer des mots-clés simples (sans OpenAI)
          const keywords = this.openaiService.generateMockKeywords(
            item.title || 'Sans titre',
            cleanedContent
          );

          // Analyser le sentiment simple (sans OpenAI)
          const sentimentAnalysis = { sentiment: 'neutre', confidence: 0.5 };

          // Extraire la date de publication originale du site si possible
          let originalPublishDate = null;
          
          // Enrichir le contenu en récupérant la page complète si nécessaire
          let enrichedContent = null;
          try {
            if (item.link) {
              const response = await axios.get(item.link, {
                timeout: 10000,
                headers: {
                  'User-Agent': 'GabonNews RSS Reader 1.0'
                }
              });
              enrichedContent = { html: response.data };
            }
          } catch (error) {
            console.log(`⚠️ Impossible d'enrichir le contenu pour ${item.title}: ${error.message}`);
          }
          
          // Essayer d'extraire la date depuis le HTML de l'article
          if (enrichedContent && enrichedContent.html) {
            const htmlContent = enrichedContent.html;
            
            // Patterns pour extraire les dates des métadonnées et du contenu HTML
            const datePatterns = [
              // Métadonnées OpenGraph et Schema.org
              /<meta[^>]*property=["']*article:published_time["']*[^>]*content=["'](.*?)["']\s*[^>]*>/i,
              /<meta[^>]*name=["']*datePublished["']*[^>]*content=["'](.*?)["']\s*[^>]*>/i,
              /<time[^>]*datetime=["'](.*?)["']\s*[^>]*>/i,
              // JSON-LD
              /"datePublished"\s*:\s*["'](.*?)["']/i,
              // Dates françaises dans le contenu
              /Publié le (\d{1,2}\/\d{1,2}\/\d{4})/i,
              /Le (\d{1,2} \w+ \d{4})/i,
              /(\d{1,2} \w+ \d{4} à \d{1,2}h\d{2})/i,
              // Formats ISO
              /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/
            ];
            
            for (const pattern of datePatterns) {
              const match = htmlContent.match(pattern);
              if (match) {
                try {
                  let dateStr = match[1];
                  
                  // Convertir les mois français en anglais pour le parsing
                  const frenchMonths = {
                    'janvier': 'January', 'février': 'February', 'mars': 'March', 'avril': 'April',
                    'mai': 'May', 'juin': 'June', 'juillet': 'July', 'août': 'August',
                    'septembre': 'September', 'octobre': 'October', 'novembre': 'November', 'décembre': 'December'
                  };
                  
                  for (const [french, english] of Object.entries(frenchMonths)) {
                    dateStr = dateStr.replace(new RegExp(french, 'i'), english);
                  }
                  
                  // Nettoyer et parser la date
                  dateStr = dateStr.replace(/à \d{1,2}h\d{2}/, ''); // Supprimer l'heure française
                  const parsedDate = new Date(dateStr);
                  
                  if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 2020) {
                    originalPublishDate = parsedDate.toISOString();
                    console.log(`📅 Date originale extraite: ${originalPublishDate} pour ${item.title?.substring(0, 50)}...`);
                    break;
                  }
                } catch (e) {
                  // Ignorer les erreurs de parsing de date
                }
              }
            }
          }

          // 🖼️ EXTRACTION D'IMAGE PRINCIPALE - MÉTHODE ROBUSTE
          let mainImageUrl = null;
          
          // 1. Chercher dans enclosure
          if (item.enclosure && item.enclosure.url && this.isImageUrl(item.enclosure.url)) {
            mainImageUrl = item.enclosure.url;
            console.log('🖼️ Image trouvée via enclosure:', mainImageUrl);
          }
          
          // 2. Chercher dans media:content
          if (!mainImageUrl && item['media:content']) {
            if (Array.isArray(item['media:content'])) {
              for (const media of item['media:content']) {
                if (media.$ && media.$.url && media.$.medium === 'image') {
                  mainImageUrl = media.$.url;
                  console.log('🖼️ Image trouvée via media:content:', mainImageUrl);
                  break;
                }
              }
            } else if (item['media:content'].$ && item['media:content'].$.url) {
              mainImageUrl = item['media:content'].$.url;
            }
          }
          
          // 3. Chercher dans media:thumbnail
          if (!mainImageUrl && item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
            mainImageUrl = item['media:thumbnail'].$.url;
          }
          
          // 4. SCRAPING WEB SYSTÉMATIQUE si pas d'image trouvée
          if (!mainImageUrl && item.link) {
            try {
              console.log(`🌐 Scraping web pour récupérer l'image: ${item.link}`);
              const axios = require('axios');
              const cheerio = require('cheerio');
              
              const response = await axios.get(item.link, {
                timeout: 8000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });

              const $ = cheerio.load(response.data);
              
              // Priorité absolue aux métadonnées Open Graph
              const ogImage = $('meta[property="og:image"]').attr('content');
              if (ogImage && this.isImageUrl(ogImage)) {
                mainImageUrl = ogImage.startsWith('//') ? 'https:' + ogImage : ogImage;
                console.log('🖼️ Image trouvée via Open Graph:', mainImageUrl);
              }
              
              // Twitter Card comme fallback
              if (!mainImageUrl) {
                const twitterImage = $('meta[name="twitter:image"]').attr('content');
                if (twitterImage && this.isImageUrl(twitterImage)) {
                  mainImageUrl = twitterImage.startsWith('//') ? 'https:' + twitterImage : twitterImage;
                  console.log('🖼️ Image trouvée via Twitter Card:', mainImageUrl);
                }
              }
              
              // Sélecteurs CSS spécialisés par domaine
              if (!mainImageUrl) {
                let selectors = [];
                
                if (item.link.includes('gabonactu.com')) {
                  selectors = ['.post-thumbnail img', '.featured-image img', '.wp-post-image'];
                } else if (item.link.includes('gabon-insight.com')) {
                  selectors = ['.article-image img', '.post-image img', '.content img:first-of-type'];
                } else if (item.link.includes('rfi.fr')) {
                  selectors = ['.article-media img', '.m-figure img'];
                } else if (item.link.includes('infosgabon.com')) {
                  selectors = ['.wp-post-image', '.featured-image img', '.post-thumbnail img', 'article img:first-of-type'];
                } else {
                  // Sélecteurs génériques WordPress
                  selectors = [
                    'img[class*="featured"]', 'img[class*="main"]', 'img[class*="hero"]',
                    '.wp-post-image', 'article img:first-of-type', '.post-content img:first-of-type'
                  ];
                }
                
                for (const selector of selectors) {
                  const img = $(selector).first();
                  if (img.length) {
                    const src = img.attr('src') || img.attr('data-src');
                    if (src && this.isImageUrl(src)) {
                      mainImageUrl = src.startsWith('//') ? 'https:' + src : src;
                      console.log(`🖼️ Image trouvée via sélecteur ${selector}:`, mainImageUrl);
                      break;
                    }
                  }
                }
              }
              
            } catch (scrapingError) {
              console.log(`⚠️ Erreur scraping pour ${item.link}:`, scrapingError.message);
            }
          }
          
          // 5. Chercher dans le contenu RSS de base
          if (!mainImageUrl && (item.content || item.description)) {
            const content = item.content || item.description;
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1] && this.isImageUrl(imgMatch[1])) {
              mainImageUrl = imgMatch[1];
              console.log('🖼️ Image trouvée dans le contenu RSS:', mainImageUrl);
            }
          }
          
          // 6. FALLBACK ULTIME - Image par défaut basée sur la source
          if (!mainImageUrl) {
            const defaultImages = {
              'AGP': 'https://agpgabon.ga/wp-content/uploads/2021/04/LOGO-AGP-HD-ACL.png',
              'Gabon Actu': 'https://gabonactu.com/wp-content/uploads/2021/01/cropped-logo_gabonactu_website-Rouge-Transparent.png',
              'Gabonews': 'https://www.gabon-insight.com/local/cache-gd2/d5/d5b8c8f8f8f8f8f8f8f8f8f8f8f8f8f8.png'
            };
            
            if (defaultImages[feed.name]) {
              mainImageUrl = defaultImages[feed.name];
              console.log(`🖼️ Image par défaut utilisée pour ${feed.name}:`, mainImageUrl);
            }
          }

          const article = {
            feed_id: feed.id,
            external_id: item.guid || item.link || articleId,
            title: item.title || 'Sans titre',
            summary: cleanedContent || 'Résumé non disponible',
            summary_ai: aiSummary,
            content: item.content || item.description || '',
            url: item.link || '',
            author: item.creator || item['dc:creator'] || 'Rédaction',
            published_at: originalPublishDate || item.pubDate || item.isoDate || new Date().toISOString(),
            language: 'fr',
            category: feed.category || 'Actualités',
            keywords: keywords,
            sentiment_score: sentimentAnalysis.sentiment === 'positif' ? 0.8
              : sentimentAnalysis.sentiment === 'négatif' ? -0.8
              : 0,
            read_time_minutes: this.calculateReadTimeMinutes(cleanedContent),
            image_url: mainImageUrl,
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
            // Doublons (23505) silencieux — dédup RSS normale
            if (dbError?.code === '23505' || (dbError?.message && dbError.message.includes('duplicate'))) {
              // silent
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

  // Vider complètement le cache et forcer une resynchronisation
  async clearCacheAndResync() {
    console.log('🧹 Vidage complet du cache RSS...');
    
    // Vider tous les caches
    this.articlesCache = [];
    this.feedsCache = [];
    this.lastFetchTimes.clear();
    
    // Réinitialiser depuis la base
    await this.initializeFromDatabase();
    
    // Synchroniser tous les flux
    await this.syncAllFeeds();
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
        (a.summary_ai && a.summary_ai.toLowerCase().includes(searchLower))
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

  // Obtenir la dernière heure de mise à jour
  getLastUpdateTime() {
    if (this.feedsCache.length === 0) {
      return null;
    }

    // Trouver la dernière synchronisation parmi tous les flux
    const lastFetchTimes = this.feedsCache
      .map(feed => feed.last_fetch_at)
      .filter(time => time !== null)
      .sort((a, b) => new Date(b) - new Date(a));

    return lastFetchTimes.length > 0 ? lastFetchTimes[0] : null;
  }

  // Formater la dernière heure de mise à jour
  getFormattedLastUpdateTime() {
    const lastUpdate = this.getLastUpdateTime();
    
    if (!lastUpdate) {
      return 'Jamais';
    }

    const now = new Date();
    const updateTime = new Date(lastUpdate);
    const diffMs = now.getTime() - updateTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    
    return updateTime.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

module.exports = RSSParserService;
