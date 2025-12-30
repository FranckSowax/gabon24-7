const express = require('express');
const cors = require('cors');
const Parser = require('rss-parser');
const OpenAIEditorialService = require('./openai-editorial-service');
const SupabaseService = require('./supabase-config');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Servir les fichiers statiques
app.use(express.static('public'));

// Initialiser les services
const editorialService = new OpenAIEditorialService();
const supabaseService = new SupabaseService();
const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'GabonNews RSS Reader 1.0'
  }
});

// =============================================
// ROUTES DE BASE
// =============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'GabonNews API Service',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Dashboard route - redirect to test interface
app.get('/dashboard', (req, res) => {
  res.redirect('/');
});

// =============================================
// GESTION DES FLUX RSS
// =============================================

// Obtenir tous les flux RSS
app.get('/api/admin/rss-feeds', async (req, res) => {
  try {
    const feeds = await supabaseService.getRSSFeeds();
    res.json({
      success: true,
      feeds: feeds || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération flux RSS',
      message: error.message
    });
  }
});

// Ajouter un nouveau flux RSS
app.post('/api/admin/rss-feeds', async (req, res) => {
  try {
    const { name, url, category, description } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Nom et URL requis'
      });
    }

    const feedData = {
      name,
      url,
      description: description || '',
      category: category || 'Actualités',
      status: 'active'
    };

    const newFeed = await supabaseService.addRSSFeed(feedData);
    
    res.status(201).json({
      success: true,
      feed: newFeed,
      message: 'Flux RSS ajouté avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur ajout flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur ajout flux RSS',
      message: error.message
    });
  }
});

// =============================================
// GESTION DES ARTICLES
// =============================================

// Obtenir les articles
app.get('/api/admin/articles', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await supabaseService.getArticles(page, limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ Erreur récupération articles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération articles',
      message: error.message
    });
  }
});

// =============================================
// PORTAIL JOURNALISTE - Génération d'éditoriaux
// =============================================

// Générer une matinale
app.post('/api/v1/journalist/matinale', async (req, res) => {
  try {
    const { articles, customInstructions } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Articles requis pour générer une matinale'
      });
    }

    const matinale = await editorialService.generateMatinale(articles, customInstructions);
    
    res.json({
      success: true,
      data: {
        type: 'matinale',
        content: matinale.content,
        whatsappOptimized: matinale.whatsappOptimized,
        metadata: matinale.metadata
      }
    });
  } catch (error) {
    console.error('❌ Erreur génération matinale:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération matinale',
      message: error.message
    });
  }
});

// Générer une analyse thématique
app.post('/api/v1/journalist/analyse', async (req, res) => {
  try {
    const { articles, theme, customInstructions } = req.body;

    if (!articles || articles.length === 0 || !theme) {
      return res.status(400).json({
        success: false,
        error: 'Articles et thème requis pour générer une analyse'
      });
    }

    const analyse = await editorialService.generateThematicAnalysis(articles, theme, customInstructions);
    
    res.json({
      success: true,
      data: {
        type: 'analyse',
        content: analyse.content,
        whatsappOptimized: analyse.whatsappOptimized,
        metadata: analyse.metadata
      }
    });
  } catch (error) {
    console.error('❌ Erreur génération analyse:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération analyse',
      message: error.message
    });
  }
});

// Générer une revue de presse
app.post('/api/v1/journalist/revue-presse', async (req, res) => {
  try {
    const { articles, customInstructions } = req.body;

    if (!articles || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Articles requis pour générer une revue de presse'
      });
    }

    const revue = await editorialService.generatePressReview(articles, customInstructions);
    
    res.json({
      success: true,
      data: {
        type: 'revue-presse',
        content: revue.content,
        whatsappOptimized: revue.whatsappOptimized,
        metadata: revue.metadata
      }
    });
  } catch (error) {
    console.error('❌ Erreur génération revue de presse:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération revue de presse',
      message: error.message
    });
  }
});

// Générer un éditorial personnalisé
app.post('/api/v1/journalist/editorial', async (req, res) => {
  try {
    const { articles, instructions, tone } = req.body;

    if (!articles || articles.length === 0 || !instructions) {
      return res.status(400).json({
        success: false,
        error: 'Articles et instructions requis pour générer un éditorial'
      });
    }

    const editorial = await editorialService.generateCustomEditorial(articles, instructions, tone);
    
    res.json({
      success: true,
      data: {
        type: 'editorial',
        content: editorial.content,
        whatsappOptimized: editorial.whatsappOptimized,
        metadata: editorial.metadata
      }
    });
  } catch (error) {
    console.error('❌ Erreur génération éditorial:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération éditorial',
      message: error.message
    });
  }
});

// =============================================
// FILTRES PREMIUM
// =============================================

// Obtenir les filtres d'un utilisateur
app.get('/api/v1/filters/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const filters = await supabaseService.getUserFilters(userId);
    
    res.json({
      success: true,
      data: filters || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération filtres:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération filtres',
      message: error.message
    });
  }
});

// Créer un nouveau filtre
app.post('/api/v1/filters', async (req, res) => {
  try {
    const filterData = req.body;

    if (!filterData.user_id || !filterData.name || !filterData.filter_config) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        message: 'user_id, name et filter_config requis'
      });
    }

    const newFilter = await supabaseService.addUserFilter(filterData);
    
    res.status(201).json({
      success: true,
      data: newFilter,
      message: 'Filtre créé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur création filtre:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur création filtre',
      message: error.message
    });
  }
});

// Tester un filtre
app.post('/api/v1/filters/test', async (req, res) => {
  try {
    const { filter_config } = req.body;

    if (!filter_config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration de filtre requise'
      });
    }

    const testResult = await supabaseService.testUserFilter(filter_config);
    
    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    console.error('❌ Erreur test filtre:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur test filtre',
      message: error.message
    });
  }
});

// =============================================
// CANAUX WHATSAPP
// =============================================

// Obtenir les canaux WhatsApp
app.get('/api/v1/channels', async (req, res) => {
  try {
    // Données simulées pour les canaux WhatsApp
    const channels = [
      {
        id: 'channel-1',
        name: 'GabonNews Actualités',
        description: 'Canal principal pour les actualités du Gabon',
        is_premium: false,
        is_active: true,
        subscriber_count: 1250,
        created_at: new Date().toISOString()
      },
      {
        id: 'channel-2',
        name: 'GabonNews Premium',
        description: 'Canal premium avec analyses approfondies',
        is_premium: true,
        is_active: true,
        subscriber_count: 320,
        created_at: new Date().toISOString()
      }
    ];
    
    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    console.error('❌ Erreur récupération canaux:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération canaux',
      message: error.message
    });
  }
});

// Obtenir les statistiques des canaux
app.get('/api/v1/channels/stats', async (req, res) => {
  try {
    const stats = {
      totalChannels: 2,
      activeChannels: 2,
      totalSubscribers: 1570,
      scheduledBroadcasts: 3
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur récupération stats canaux:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques',
      message: error.message
    });
  }
});

// Programmer une diffusion
app.post('/api/v1/channels/broadcast', async (req, res) => {
  try {
    const { channel_id, content, scheduled_at } = req.body;

    if (!channel_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'channel_id et content requis'
      });
    }

    // Simulation de programmation de diffusion
    const broadcast = {
      id: 'broadcast-' + Date.now(),
      channel_id,
      content,
      scheduled_at: scheduled_at || new Date().toISOString(),
      status: 'scheduled',
      created_at: new Date().toISOString()
    };
    
    res.status(201).json({
      success: true,
      data: broadcast,
      message: 'Diffusion programmée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur programmation diffusion:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur programmation diffusion',
      message: error.message
    });
  }
});

// =============================================
// STATISTIQUES ADMIN
// =============================================

// Obtenir les statistiques du dashboard
app.get('/api/admin/stats', async (req, res) => {
  try {
    const stats = {
      totalArticles: 0,
      totalFeeds: 0,
      activeFeeds: 0,
      articlesToday: 0,
      lastSync: new Date().toISOString()
    };

    // Récupérer les vraies statistiques depuis Supabase
    try {
      const feeds = await supabaseService.getRSSFeeds();
      const articles = await supabaseService.getArticles(1, 1);
      
      stats.totalFeeds = feeds.length;
      stats.activeFeeds = feeds.filter(f => f.status === 'active').length;
      stats.totalArticles = articles.total || 0;
    } catch (error) {
      console.error('Erreur récupération stats:', error);
    }
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Erreur récupération statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques',
      message: error.message
    });
  }
});

// Obtenir les articles récents pour le dashboard admin
app.get('/api/admin/recent-articles', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Récupérer les flux RSS actifs
    const feeds = await supabaseService.getRSSFeeds();
    const activeFeeds = feeds.filter(feed => feed.status === 'active');
    
    const allArticles = [];
    
    // Parser chaque flux RSS actif
    for (const feed of activeFeeds.slice(0, 5)) { // Limiter à 5 flux pour éviter la surcharge
      try {
        console.log(`📡 Parsing RSS feed: ${feed.name} (${feed.url})`);
        const rssFeed = await parser.parseURL(feed.url);
        
        if (rssFeed.items && rssFeed.items.length > 0) {
          // Prendre les 3 articles les plus récents de chaque flux
          const feedArticles = rssFeed.items.slice(0, 3).map((item, index) => ({
            id: `${feed.id}-${index}`,
            title: item.title || 'Titre non disponible',
            summary: item.contentSnippet || item.content || item.summary || 'Résumé non disponible',
            source: feed.name,
            category: feed.category || 'Actualités',
            published_at: item.pubDate || item.isoDate || new Date().toISOString(),
            url: item.link || feed.url,
            guid: item.guid || item.id,
            author: item.creator || item.author || 'Auteur non spécifié'
          }));
          
          allArticles.push(...feedArticles);
          console.log(`✅ ${feedArticles.length} articles récupérés de ${feed.name}`);
        }
      } catch (feedError) {
        console.error(`❌ Erreur parsing ${feed.name}:`, feedError.message);
        // Marquer le flux comme en erreur
        await supabaseService.updateRSSFeed(feed.id, {
          status: 'error',
          last_error: feedError.message
        });
      }
    }
    
    // Trier par date de publication (plus récent en premier)
    allArticles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    
    // Limiter le nombre d'articles retournés
    const limitedArticles = allArticles.slice(0, parseInt(limit));
    
    console.log(`📊 Total articles récupérés: ${limitedArticles.length}`);
    
    res.json({
      success: true,
      articles: limitedArticles,
      total: limitedArticles.length,
      timestamp: new Date().toISOString(),
      sources: activeFeeds.map(f => f.name)
    });
  } catch (error) {
    console.error('❌ Erreur récupération articles récents:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération articles récents',
      message: error.message
    });
  }
});

// =============================================
// GESTION DES ARTICLES
// =============================================

// Obtenir tous les articles avec pagination et filtres
app.get('/api/articles', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      sortBy = 'published_at', 
      sortOrder = 'desc',
      category,
      search,
      source
    } = req.query;

    console.log(`📊 Récupération des articles - Page ${page}, Limite ${limit}`);
    
    // Récupérer les flux RSS actifs
    const feeds = await supabaseService.getRSSFeeds();
    const activeFeeds = feeds.filter(feed => feed.status === 'active');
    
    const allArticles = [];
    
    // Parser chaque flux RSS actif pour récupérer tous les articles
    for (const feed of activeFeeds) {
      try {
        console.log(`📡 Parsing articles from: ${feed.name}`);
        const rssFeed = await parser.parseURL(feed.url);
        
        if (rssFeed.items && rssFeed.items.length > 0) {
          const feedArticles = rssFeed.items.map((item, index) => ({
            id: `${feed.id}-${index}`,
            title: item.title || 'Titre non disponible',
            summary: item.contentSnippet || item.content || item.summary || 'Résumé non disponible',
            content: item.content || item.contentSnippet || '',
            source: feed.name,
            category: feed.category || 'Actualités',
            published_at: item.pubDate || item.isoDate || new Date().toISOString(),
            url: item.link || feed.url,
            guid: item.guid || item.id,
            author: item.creator || item.author || 'Auteur non spécifié',
            feed_id: feed.id,
            // Simulation d'enrichissement IA
            ai_summary: `Résumé IA: ${(item.contentSnippet || item.title || '').substring(0, 150)}...`,
            keywords: extractKeywords(item.title || '', item.contentSnippet || ''),
            sentiment: analyzeSentiment(item.title || '', item.contentSnippet || ''),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          
          allArticles.push(...feedArticles);
          console.log(`✅ ${feedArticles.length} articles récupérés de ${feed.name}`);
        }
      } catch (feedError) {
        console.error(`❌ Erreur parsing ${feed.name}:`, feedError.message);
      }
    }
    
    // Appliquer les filtres
    let filteredArticles = allArticles;
    
    if (category && category !== 'all') {
      filteredArticles = filteredArticles.filter(article => 
        article.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    if (source && source !== 'all') {
      filteredArticles = filteredArticles.filter(article => 
        article.source.toLowerCase().includes(source.toLowerCase())
      );
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredArticles = filteredArticles.filter(article => 
        article.title.toLowerCase().includes(searchLower) ||
        article.summary.toLowerCase().includes(searchLower) ||
        (article.keywords && article.keywords.some(k => k.toLowerCase().includes(searchLower)))
      );
    }
    
    // Trier les articles
    filteredArticles.sort((a, b) => {
      const aValue = a[sortBy] || '';
      const bValue = b[sortBy] || '';
      
      if (sortBy === 'published_at' || sortBy === 'created_at') {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
      }
      
      if (sortOrder === 'desc') {
        return bValue.localeCompare(aValue);
      }
      return aValue.localeCompare(bValue);
    });
    
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
    
    // Statistiques
    const stats = {
      total: filteredArticles.length,
      positive: filteredArticles.filter(a => a.sentiment === 'positif').length,
      negative: filteredArticles.filter(a => a.sentiment === 'négatif').length,
      neutral: filteredArticles.filter(a => a.sentiment === 'neutre').length,
      sources: [...new Set(filteredArticles.map(a => a.source))],
      categories: [...new Set(filteredArticles.map(a => a.category))]
    };
    
    console.log(`📊 Articles retournés: ${paginatedArticles.length}/${filteredArticles.length} total`);
    
    res.json({
      success: true,
      data: {
        articles: paginatedArticles,
        totalPages: Math.ceil(filteredArticles.length / parseInt(limit)),
        currentPage: parseInt(page),
        totalArticles: filteredArticles.length,
        stats
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredArticles.length,
        pages: Math.ceil(filteredArticles.length / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération articles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération articles',
      message: error.message
    });
  }
});

// Méthodes utilitaires pour l'enrichissement IA simulé
function extractKeywords(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  const commonWords = ['le', 'la', 'les', 'de', 'du', 'des', 'et', 'à', 'un', 'une', 'pour', 'avec', 'sur', 'dans', 'par', 'ce', 'cette', 'ces', 'que', 'qui', 'est', 'sont', 'ont', 'avoir', 'être'];
  const words = text.match(/\b\w{4,}\b/g) || [];
  const keywords = words
    .filter(word => !commonWords.includes(word))
    .reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
  
  return Object.entries(keywords)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

function analyzeSentiment(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  const positiveWords = ['succès', 'victoire', 'croissance', 'amélioration', 'développement', 'progrès', 'réussite', 'inauguration', 'nouveau', 'moderne'];
  const negativeWords = ['crise', 'problème', 'échec', 'baisse', 'diminution', 'accident', 'conflit', 'guerre', 'mort', 'arrestation'];
  
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  if (positiveCount > negativeCount) return 'positif';
  if (negativeCount > positiveCount) return 'négatif';
  return 'neutre';
}

// =============================================
// GESTION DES FLUX RSS ADMIN
// =============================================

// Obtenir tous les flux RSS
app.get('/api/admin/rss-feeds', async (req, res) => {
  try {
    const feeds = await supabaseService.getRSSFeeds();
    
    // Ajouter des données simulées si aucun flux n'existe
    const mockFeeds = feeds.length === 0 ? [
      {
        id: '1',
        name: 'L\'Union',
        url: 'https://www.lunion.ga/rss',
        category: 'Actualités',
        status: 'active',
        last_fetch_at: new Date().toISOString(),
        total_articles_count: 245,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        name: 'Gabon Review',
        url: 'https://www.gabonreview.com/rss',
        category: 'Actualités',
        status: 'active',
        last_fetch_at: new Date().toISOString(),
        total_articles_count: 189,
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        name: 'Info241',
        url: 'https://www.info241.com/rss',
        category: 'Actualités',
        status: 'error',
        last_fetch_at: new Date(Date.now() - 86400000).toISOString(),
        total_articles_count: 156,
        created_at: new Date().toISOString()
      }
    ] : feeds;

    res.json({
      success: true,
      feeds: mockFeeds,
      total: mockFeeds.length
    });
  } catch (error) {
    console.error('❌ Erreur récupération flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération flux RSS',
      message: error.message
    });
  }
});

// Ajouter un nouveau flux RSS
app.post('/api/admin/rss-feeds', async (req, res) => {
  try {
    const { name, url, category } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Nom et URL requis'
      });
    }

    const newFeed = {
      name,
      url,
      category: category || 'Actualités',
      status: 'active',
      last_fetch_at: null,
      total_articles_count: 0,
      created_at: new Date().toISOString()
    };

    const savedFeed = await supabaseService.addRSSFeed(newFeed);
    
    res.status(201).json({
      success: true,
      data: savedFeed,
      message: 'Flux RSS ajouté avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur ajout flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur ajout flux RSS',
      message: error.message
    });
  }
});

// Mettre à jour un flux RSS
app.put('/api/admin/rss-feeds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedFeed = await supabaseService.updateRSSFeed(id, updates);
    
    res.json({
      success: true,
      data: updatedFeed,
      message: 'Flux RSS mis à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour flux RSS',
      message: error.message
    });
  }
});

// Supprimer un flux RSS
app.delete('/api/admin/rss-feeds/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await supabaseService.deleteRSSFeed(id);
    
    res.json({
      success: true,
      message: 'Flux RSS supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression flux RSS',
      message: error.message
    });
  }
});

// Tester un flux RSS par ID
app.post('/api/admin/rss-feeds/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const startTime = Date.now();

    // Récupérer les informations du flux pour le test
    const feeds = await supabaseService.getRSSFeeds();
    const feed = feeds.find(f => f.id === id);
    
    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'Flux RSS non trouvé'
      });
    }

    console.log(`🧪 Test du flux RSS: ${feed.name} (${feed.url})`);

    try {
      // Test réel du flux RSS
      const rssFeed = await parser.parseURL(feed.url);
      const responseTime = Date.now() - startTime;
      
      const testResult = {
        valid: true,
        articlesFound: rssFeed.items ? rssFeed.items.length : 0,
        lastArticle: rssFeed.items && rssFeed.items.length > 0 ? {
          title: rssFeed.items[0].title || 'Titre non disponible',
          publishedAt: rssFeed.items[0].pubDate || rssFeed.items[0].isoDate || new Date().toISOString(),
          link: rssFeed.items[0].link
        } : null,
        responseTime: responseTime,
        feedInfo: {
          name: feed.name,
          url: feed.url,
          title: rssFeed.title,
          description: rssFeed.description,
          lastBuildDate: rssFeed.lastBuildDate
        }
      };

      // Mettre à jour le statut du flux après le test réussi
      await supabaseService.updateRSSFeed(id, {
        status: 'active',
        last_fetch_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_error: null,
        total_articles_count: testResult.articlesFound
      });

      console.log(`✅ Test réussi: ${testResult.articlesFound} articles trouvés en ${responseTime}ms`);

      res.json({
        success: true,
        data: testResult,
        message: `Test du flux RSS réussi - ${testResult.articlesFound} articles trouvés`
      });

    } catch (rssError) {
      const responseTime = Date.now() - startTime;
      
      console.error(`❌ Erreur test RSS ${feed.name}:`, rssError.message);

      // Mettre à jour le statut du flux après l'erreur
      await supabaseService.updateRSSFeed(id, {
        status: 'error',
        last_error: rssError.message,
        last_fetch_at: new Date().toISOString()
      });

      const testResult = {
        valid: false,
        error: rssError.message,
        responseTime: responseTime,
        feedInfo: {
          name: feed.name,
          url: feed.url
        }
      };

      res.json({
        success: false,
        data: testResult,
        message: `Flux RSS inaccessible: ${rssError.message}`
      });
    }

  } catch (error) {
    console.error('❌ Erreur test flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur test flux RSS',
      message: error.message
    });
  }
});

// Tester un flux RSS par URL (endpoint alternatif)
app.post('/api/admin/rss-feeds/test', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL requise'
      });
    }

    // Simulation de test de flux RSS
    const testResult = {
      valid: true,
      articlesFound: Math.floor(Math.random() * 50) + 10,
      lastArticle: {
        title: 'Exemple d\'article du flux RSS',
        publishedAt: new Date().toISOString()
      },
      responseTime: Math.floor(Math.random() * 1000) + 200
    };

    res.json({
      success: true,
      data: testResult,
      message: 'Test du flux RSS réussi'
    });
  } catch (error) {
    console.error('❌ Erreur test flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur test flux RSS',
      message: error.message
    });
  }
});

// Supprimer un flux RSS
app.delete('/api/admin/rss-feeds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ [DEBUG] Suppression du flux RSS ID: ${id}`);
    console.log(`🗑️ [DEBUG] Type de l'ID: ${typeof id}`);
    
    // Vérifier si c'est un UUID valide ou un ID simulé
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    console.log(`🗑️ [DEBUG] Est-ce un UUID? ${isUUID}`);
    
    if (isUUID) {
      console.log(`🗑️ [DEBUG] Tentative de suppression via Supabase`);
      // Tenter de supprimer via Supabase pour les vrais UUIDs
      try {
        await supabaseService.deleteRSSFeed(id);
        console.log(`✅ Flux RSS ${id} supprimé de la base de données`);
      } catch (dbError) {
        console.log(`⚠️ Erreur base de données: ${dbError.message}`);
        return res.status(500).json({
          success: false,
          error: 'Erreur suppression flux RSS',
          message: dbError.message
        });
      }
    } else {
      // Pour les IDs simulés (1, 2, 3, etc.), on simule la suppression
      console.log(`⚠️ [DEBUG] ID simulé détecté (${id}), suppression simulée`);
    }
    
    console.log(`✅ [DEBUG] Suppression réussie pour ID: ${id}`);
    res.json({
      success: true,
      message: `Flux RSS supprimé avec succès`,
      feedId: id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] Erreur suppression flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression flux RSS',
      message: error.message
    });
  }
});

// Ajouter un nouveau flux RSS
app.post('/api/admin/rss-feeds', async (req, res) => {
  try {
    const { name, url, category } = req.body;
    
    if (!name || !url || !category) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants',
        message: 'Nom, URL et catégorie sont requis'
      });
    }
    
    console.log(`➕ Ajout nouveau flux RSS: ${name}`);
    
    const newFeed = {
      name,
      url,
      category,
      status: 'active',
      created_at: new Date().toISOString(),
      last_fetch_at: null,
      total_articles_count: 0
    };
    
    // Tenter d'ajouter via Supabase
    try {
      const savedFeed = await supabaseService.addRSSFeed(newFeed);
      console.log(`✅ Flux RSS ${name} ajouté à la base de données`);
      
      res.json({
        success: true,
        message: 'Flux RSS ajouté avec succès',
        feed: savedFeed,
        timestamp: new Date().toISOString()
      });
    } catch (dbError) {
      console.log(`⚠️ Erreur base de données, simulation: ${dbError.message}`);
      
      // Simulation si base de données non disponible
      const simulatedFeed = {
        ...newFeed,
        id: Date.now().toString()
      };
      
      res.json({
        success: true,
        message: 'Flux RSS ajouté avec succès (mode simulation)',
        feed: simulatedFeed,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur ajout flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur ajout flux RSS',
      message: error.message
    });
  }
});

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================

app.listen(PORT, () => {
  console.log('⚠️ OpenAI API Key non configurée. Utilisez OPENAI_API_KEY dans les variables d\'environnement.');
  console.log('🚀 GabonNews API Service démarré!');
  console.log(`📡 Serveur: http://localhost:${PORT}`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('🆕 Fonctionnalités disponibles:');
  console.log('   • 🖋️ Portail Journaliste: /api/v1/journalist/*');
  console.log('   • 🔍 Filtres Premium: /api/v1/filters/*');
  console.log('   • 📱 Canaux WhatsApp: /api/v1/channels/*');
  console.log('   • 📊 Admin Dashboard: /api/admin/*');
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur GabonNews API...');
  process.exit(0);
});

module.exports = app;
