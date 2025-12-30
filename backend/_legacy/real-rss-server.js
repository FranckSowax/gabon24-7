const express = require('express');
const cors = require('cors');
const RSSParserService = require('./rss-parser-service');
const OpenAIEditorialService = require('./openai-editorial-service');

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS pour permettre les requêtes depuis le frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Initialiser les services
const rssService = new RSSParserService();
const editorialService = new OpenAIEditorialService();

// Flux RSS gabonais par défaut (vous pouvez me fournir les vrais liens)
const defaultFeeds = [
  {
    name: 'L\'Union',
    url: 'https://www.lunion.ga/rss',
    description: 'Journal officiel du Gabon',
    category: 'Actualités',
    status: 'active'
  },
  {
    name: 'Gabon Matin',
    url: 'https://www.gabonmatin.com/rss',
    description: 'Actualités quotidiennes du Gabon',
    category: 'Actualités',
    status: 'active'
  },
  {
    name: 'Gabon Review',
    url: 'https://www.gabonreview.com/rss',
    description: 'Actualités économiques et politiques',
    category: 'Économie',
    status: 'active'
  }
];

// Ajouter les flux par défaut
defaultFeeds.forEach(feed => rssService.addFeed(feed));

// Routes API

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'GabonNews RSS Parser Service',
    timestamp: new Date().toISOString(),
    feeds: rssService.feeds.length,
    articles: rssService.articles.length
  });
});

// Obtenir les statistiques du dashboard
app.get('/api/admin/stats', (req, res) => {
  const stats = rssService.getStats();
  res.json({
    success: true,
    data: stats
  });
});

// Obtenir les articles récents
app.get('/api/admin/recent-articles', (req, res) => {
  const recentArticles = rssService.getArticles(1, 10);
  res.json({
    success: true,
    data: recentArticles.articles
  });
});

// Obtenir tous les flux RSS
app.get('/api/admin/rss-feeds', (req, res) => {
  res.json({
    success: true,
    feeds: rssService.feeds
  });
});

// Ajouter un nouveau flux RSS
app.post('/api/admin/rss-feeds', async (req, res) => {
  try {
    const { name, url, category } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        message: 'Nom et URL sont requis'
      });
    }

    // Tester le flux avant de l'ajouter
    console.log(`🔍 Test du nouveau flux: ${name} - ${url}`);
    const testResult = await rssService.testFeed(url);
    
    if (!testResult.success) {
      return res.status(400).json({
        success: false,
        message: `Impossible de se connecter au flux RSS: ${testResult.error}`
      });
    }

    // Créer le flux
    const feedId = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newFeed = {
      id: feedId,
      name,
      url,
      category: category || 'Actualités',
      status: 'active',
      last_fetch_at: null,
      total_articles_count: 0,
      title: testResult.title,
      description: testResult.description
    };

    rssService.addFeed(newFeed);

    // Parser immédiatement le flux pour récupérer les articles
    console.log(`📡 Parsing immédiat du nouveau flux: ${name}`);
    await rssService.parseFeed(newFeed);

    res.json({
      success: true,
      message: `Flux RSS "${name}" ajouté avec succès`,
      feed: newFeed
    });

  } catch (error) {
    console.error('Erreur ajout flux RSS:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'ajout du flux RSS'
    });
  }
});

// Tester un flux RSS
app.post('/api/admin/rss-feeds/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const feed = rssService.feeds.find(f => f.id === id);
    
    if (!feed) {
      return res.status(404).json({
        success: false,
        message: 'Flux RSS non trouvé'
      });
    }

    console.log(`🔍 Test du flux: ${feed.name} - ${feed.url}`);
    const testResult = await rssService.testFeed(feed.url);
    
    if (testResult.success) {
      // Mettre à jour le statut du flux
      feed.status = 'active';
      feed.lastFetch = 'À l\'instant';
      
      // Parser le flux pour récupérer les articles
      const newArticles = await rssService.parseFeed(feed);
      
      res.json({
        success: true,
        message: `Test du flux ${feed.name} réussi`,
        feed,
        details: `Connexion établie - ${testResult.itemCount} articles disponibles - ${newArticles.length} nouveaux articles récupérés`
      });
    } else {
      // Mettre à jour le statut d'erreur
      feed.status = 'error';
      feed.lastError = testResult.error;
      
      res.json({
        success: false,
        message: `Test du flux ${feed.name} échoué`,
        feed,
        details: `Erreur: ${testResult.error}`
      });
    }

  } catch (error) {
    console.error('Erreur test flux RSS:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du test du flux RSS'
    });
  }
});

// Supprimer un flux RSS
app.delete('/api/admin/rss-feeds/:id', (req, res) => {
  const { id } = req.params;
  const removedFeed = rssService.removeFeed(id);
  
  if (removedFeed) {
    res.json({
      success: true,
      message: `Flux RSS "${removedFeed.name}" supprimé avec succès`
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Flux RSS non trouvé'
    });
  }
});

// Synchroniser tous les flux RSS
app.post('/api/admin/sync-rss', async (req, res) => {
  try {
    console.log('🔄 Démarrage synchronisation manuelle RSS');
    const result = await rssService.syncAllFeeds();
    
    res.json({
      success: true,
      message: `Synchronisation terminée: ${result.totalNewArticles} nouveaux articles récupérés depuis ${result.successfulFeeds}/${result.totalFeeds} flux`,
      data: result
    });
  } catch (error) {
    console.error('Erreur synchronisation RSS:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la synchronisation RSS'
    });
  }
});

// Réinitialiser tous les flux (pour tests)
app.post('/api/admin/rss-feeds/reset-all', async (req, res) => {
  try {
    console.log('🔄 Réinitialisation de tous les flux RSS');
    
    // Tester tous les flux
    let activeCount = 0;
    for (const feed of rssService.feeds) {
      const testResult = await rssService.testFeed(feed.url);
      if (testResult.success) {
        feed.status = 'active';
        feed.lastFetch = 'À l\'instant';
        activeCount++;
      } else {
        feed.status = 'error';
        feed.lastError = testResult.error;
      }
    }

    res.json({
      success: true,
      message: `${activeCount}/${rssService.feeds.length} flux RSS sont maintenant actifs`,
      activeFeeds: activeCount
    });
  } catch (error) {
    console.error('Erreur réinitialisation flux:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation'
    });
  }
});

// Obtenir tous les articles pour le frontend
app.get('/api/articles', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const category = req.query.category;
  const search = req.query.search;
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder || 'desc';
  
  let filteredArticles = rssService.articles;
  
  // Filtrer par catégorie
  if (category && category !== 'all') {
    filteredArticles = filteredArticles.filter(a => 
      a.category.toLowerCase() === category.toLowerCase()
    );
  }
  
  // Filtrer par recherche
  if (search) {
    const searchLower = search.toLowerCase();
    filteredArticles = filteredArticles.filter(a => 
      a.title.toLowerCase().includes(searchLower) ||
      a.summary.toLowerCase().includes(searchLower) ||
      (a.aiSummary && a.aiSummary.toLowerCase().includes(searchLower)) ||
      a.source.toLowerCase().includes(searchLower) ||
      (a.keywords && a.keywords.some(k => k.toLowerCase().includes(searchLower)))
    );
  }
  
  // Trier
  filteredArticles.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    
    if (sortBy === 'createdAt' || sortBy === 'publishedAt') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    if (sortOrder === 'desc') {
      return bVal > aVal ? 1 : -1;
    } else {
      return aVal > bVal ? 1 : -1;
    }
  });
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    data: {
      articles: paginatedArticles,
      total: filteredArticles.length,
      page,
      limit,
      totalPages: Math.ceil(filteredArticles.length / limit)
    }
  });
});

// Obtenir un article spécifique
app.get('/api/articles/:id', (req, res) => {
  const { id } = req.params;
  const article = rssService.articles.find(a => a.id === id);
  
  if (article) {
    res.json({
      success: true,
      data: article
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Article non trouvé'
    });
  }
});

// =============================================
// PORTAIL JOURNALISTE - Nouvelles fonctionnalités
// =============================================

// Obtenir les éditoriaux
app.get('/api/v1/journalist/editorials', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      journalist_id: req.query.journalist_id,
      type: req.query.type,
      status: req.query.status
    };

    const result = await rssService.supabaseService.getEditorials(page, limit, filters);
    
    res.json({
      success: true,
      data: result.editorials,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (error) {
    console.error('❌ Erreur récupération éditoriaux:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération éditoriaux',
      message: error.message
    });
  }
});

// Générer une matinale
app.post('/api/v1/journalist/matinale', async (req, res) => {
  try {
    const { selectedArticles, customPrompt, journalistId } = req.body;

    if (!selectedArticles || selectedArticles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Articles requis',
        message: 'Veuillez sélectionner au moins un article'
      });
    }

    // Générer le contenu avec OpenAI
    const generationResult = await editorialService.generateMatinale(selectedArticles, customPrompt);
    
    if (!generationResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erreur génération matinale',
        message: 'Impossible de générer la matinale'
      });
    }

    // Sauvegarder l'éditorial dans Supabase
    const editorialData = {
      journalist_id: journalistId,
      title: `Matinale du ${new Date().toLocaleDateString('fr-FR')}`,
      type: 'matinale',
      content: generationResult.content,
      ai_generated_content: generationResult.content,
      selected_articles: selectedArticles.map(a => a.id),
      status: 'draft',
      metadata: {
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false,
        generatedAt: new Date().toISOString()
      }
    };

    const savedEditorial = await rssService.supabaseService.addEditorial(editorialData);

    res.json({
      success: true,
      data: {
        editorial: savedEditorial,
        content: generationResult.content,
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false
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
    const { selectedArticles, theme, customPrompt, journalistId } = req.body;

    if (!selectedArticles || selectedArticles.length === 0 || !theme) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        message: 'Articles et thème requis'
      });
    }

    const generationResult = await editorialService.generateAnalyseThematique(selectedArticles, theme, customPrompt);
    
    if (!generationResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erreur génération analyse',
        message: 'Impossible de générer l\'analyse thématique'
      });
    }

    const editorialData = {
      journalist_id: journalistId,
      title: `Analyse: ${theme}`,
      type: 'analyse_thematique',
      content: generationResult.content,
      ai_generated_content: generationResult.content,
      selected_articles: selectedArticles.map(a => a.id),
      status: 'draft',
      metadata: {
        theme,
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false,
        generatedAt: new Date().toISOString()
      }
    };

    const savedEditorial = await rssService.supabaseService.addEditorial(editorialData);

    res.json({
      success: true,
      data: {
        editorial: savedEditorial,
        content: generationResult.content,
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false
      }
    });
  } catch (error) {
    console.error('❌ Erreur génération analyse thématique:', error);
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
    const { selectedArticles, customPrompt, journalistId } = req.body;

    if (!selectedArticles || selectedArticles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Articles requis',
        message: 'Veuillez sélectionner au moins un article'
      });
    }

    const generationResult = await editorialService.generateRevuePresse(selectedArticles, customPrompt);
    
    if (!generationResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erreur génération revue de presse',
        message: 'Impossible de générer la revue de presse'
      });
    }

    const editorialData = {
      journalist_id: journalistId,
      title: `Revue de presse du ${new Date().toLocaleDateString('fr-FR')}`,
      type: 'revue_presse',
      content: generationResult.content,
      ai_generated_content: generationResult.content,
      selected_articles: selectedArticles.map(a => a.id),
      status: 'draft',
      metadata: {
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false,
        generatedAt: new Date().toISOString()
      }
    };

    const savedEditorial = await rssService.supabaseService.addEditorial(editorialData);

    res.json({
      success: true,
      data: {
        editorial: savedEditorial,
        content: generationResult.content,
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false
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
    const { selectedArticles, instructions, title, customPrompt, journalistId } = req.body;

    if (!selectedArticles || selectedArticles.length === 0 || !instructions) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        message: 'Articles et instructions requis'
      });
    }

    const generationResult = await editorialService.generateEditorialPersonnalise(selectedArticles, instructions, customPrompt);
    
    if (!generationResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Erreur génération éditorial',
        message: 'Impossible de générer l\'éditorial personnalisé'
      });
    }

    const editorialData = {
      journalist_id: journalistId,
      title: title || `Éditorial du ${new Date().toLocaleDateString('fr-FR')}`,
      type: 'editorial_personnalise',
      content: generationResult.content,
      ai_generated_content: generationResult.content,
      selected_articles: selectedArticles.map(a => a.id),
      status: 'draft',
      metadata: {
        instructions,
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false,
        generatedAt: new Date().toISOString()
      }
    };

    const savedEditorial = await rssService.supabaseService.addEditorial(editorialData);

    res.json({
      success: true,
      data: {
        editorial: savedEditorial,
        content: generationResult.content,
        tokensUsed: generationResult.tokensUsed,
        fallback: generationResult.fallback || false
      }
    });
  } catch (error) {
    console.error('❌ Erreur génération éditorial personnalisé:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération éditorial',
      message: error.message
    });
  }
});

// Publier un éditorial
app.post('/api/v1/journalist/editorials/:id/publish', async (req, res) => {
  try {
    const editorialId = req.params.id;
    const { optimizeForWhatsApp } = req.body;

    let content = req.body.content;

    // Optimiser pour WhatsApp si demandé
    if (optimizeForWhatsApp) {
      const optimizationResult = await editorialService.optimizeContentForWhatsApp(content);
      if (optimizationResult.success) {
        content = optimizationResult.content;
      }
    }

    // Mettre à jour l'éditorial
    const updatedEditorial = await rssService.supabaseService.updateEditorial(editorialId, {
      content: content,
      status: 'published',
      published_at: new Date().toISOString()
    });

    res.json({
      success: true,
      data: updatedEditorial,
      message: 'Éditorial publié avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur publication éditorial:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur publication éditorial',
      message: error.message
    });
  }
});

// =============================================
// FILTRES PREMIUM - Nouvelles fonctionnalités
// =============================================

// Obtenir les filtres d'un utilisateur
app.get('/api/v1/filters', async (req, res) => {
  try {
    const userId = req.query.user_id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID requis'
      });
    }

    const filters = await rssService.supabaseService.getUserFilters(userId);
    
    res.json({
      success: true,
      data: filters
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

    const newFilter = await rssService.supabaseService.addUserFilter(filterData);
    
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

    const testResult = await rssService.supabaseService.testUserFilter(filter_config);
    
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

// Mettre à jour un filtre
app.put('/api/v1/filters/:id', async (req, res) => {
  try {
    const filterId = req.params.id;
    const updates = req.body;

    const updatedFilter = await rssService.supabaseService.updateUserFilter(filterId, updates);
    
    res.json({
      success: true,
      data: updatedFilter,
      message: 'Filtre mis à jour avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour filtre:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur mise à jour filtre',
      message: error.message
    });
  }
});

// Supprimer un filtre
app.delete('/api/v1/filters/:id', async (req, res) => {
  try {
    const filterId = req.params.id;
    
    await rssService.supabaseService.deleteUserFilter(filterId);
    
    res.json({
      success: true,
      message: 'Filtre supprimé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression filtre:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur suppression filtre',
      message: error.message
    });
  }
});

// =============================================
// CANAUX WHATSAPP - Nouvelles fonctionnalités
// =============================================

// Obtenir les canaux WhatsApp
app.get('/api/v1/channels', async (req, res) => {
  try {
    const channels = await rssService.supabaseService.getWhatsAppChannels();
    
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

// Programmer une diffusion sur canal
app.post('/api/v1/channels/broadcast', async (req, res) => {
  try {
    const broadcastData = req.body;

    if (!broadcastData.channel_id || !broadcastData.content) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        message: 'channel_id et content requis'
      });
    }

    const newBroadcast = await rssService.supabaseService.addChannelBroadcast(broadcastData);
    
    res.status(201).json({
      success: true,
      data: newBroadcast,
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

// Obtenir les statistiques des canaux
app.get('/api/v1/channels/stats', async (req, res) => {
  try {
    const channels = await rssService.supabaseService.getWhatsAppChannels();
    const scheduledBroadcasts = await rssService.supabaseService.getScheduledBroadcasts();

    const stats = {
      totalChannels: channels.length,
      activeChannels: channels.filter(c => c.is_active).length,
      totalSubscribers: channels.reduce((sum, c) => sum + (c.subscriber_count || 0), 0),
      scheduledBroadcasts: scheduledBroadcasts.length,
      channelDetails: channels.map(channel => ({
        id: channel.id,
        name: channel.name,
        isPremium: channel.is_premium,
        subscriberCount: channel.subscriber_count || 0,
        isActive: channel.is_active
      }))
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

// =============================================
// GESTION AVANCÉE DES UTILISATEURS
// =============================================

// Vérifier un journaliste
app.post('/api/v1/users/:id/verify-journalist', async (req, res) => {
  try {
    const userId = req.params.id;
    const { media_affiliation } = req.body;

    if (!media_affiliation) {
      return res.status(400).json({
        success: false,
        error: 'Affiliation média requise'
      });
    }

    const verifiedUser = await rssService.supabaseService.verifyJournalist(userId, media_affiliation);
    
    res.json({
      success: true,
      data: verifiedUser,
      message: 'Journaliste vérifié avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur vérification journaliste:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur vérification journaliste',
      message: error.message
    });
  }
});

// Générer un token API
app.post('/api/v1/users/:id/generate-token', async (req, res) => {
  try {
    const userId = req.params.id;
    
    const result = await rssService.supabaseService.generateApiToken(userId);
    
    res.json({
      success: true,
      data: {
        token: result.token,
        user: result.user
      },
      message: 'Token API généré avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur génération token:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur génération token',
      message: error.message
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log('🚀 GabonNews RSS Parser Service démarré!');
  console.log(`📡 Serveur: http://localhost:${PORT}`);
  console.log(`📊 Dashboard admin: http://localhost:3002/admin`);
  console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📰 Flux RSS configurés:');
  rssService.feeds.forEach(feed => {
    console.log(`   • ${feed.name}: ${feed.url}`);
  });
  console.log('');
  console.log('⚡ Synchronisation automatique toutes les 15 minutes');
  console.log('🔄 Synchronisation manuelle: POST /api/admin/sync-rss');
  console.log('');
  console.log('🆕 Nouvelles fonctionnalités disponibles:');
  console.log('   • 🖋️ Portail Journaliste: /api/v1/journalist/*');
  console.log('   • 🔍 Filtres Premium: /api/v1/filters/*');
  console.log('   • 📱 Canaux WhatsApp: /api/v1/channels/*');
  console.log('   • 👥 Gestion Utilisateurs: /api/v1/users/*');
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur GabonNews RSS...');
  process.exit(0);
});

module.exports = app;
