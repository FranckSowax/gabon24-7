const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabaseService = require('./supabase-config');
const imageUploadService = require('./src/services/imageUpload.service');
// const rssController = require('./src/controllers/rss.controller');

require('dotenv').config();

// Import du service Supabase
const supabaseService2 = require('./supabase-config');
const { supabase } = supabaseService2;

// Import du service RSS
const RSSParserService = require('./rss-parser-service');

// Import du service d'événements
const { fetchEvents } = require('./fetch-events');

const app = express();
const PORT = process.env.PORT || 3001;

// Fonctions utilitaires
const formatTimeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) return 'À l\'instant';
  if (diffHours < 24) return `${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks} semaine${diffWeeks > 1 ? 's' : ''}`;
  
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} mois`;
};

const formatViewCount = (count) => {
  if (count === 0) return '0 vue';
  if (count === 1) return '1 vue';
  if (count < 1000) return `${count} vues`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k vues`;
  return `${(count / 1000000).toFixed(1)}M vues`;
};

// Middleware de sécurité
app.use(helmet());

// Configuration CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:8888'],
  credentials: true
}));

// Parsing du body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue sur l\'API Gabon 24/7 WhatsApp SaaS',
    service: 'Gabon 24/7 API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      status: '/api/status',
      auth: '/api/auth/login',
      rss: '/api/rss',
      articles: '/api/articles',
      dashboard: '/api/admin/dashboard'
    },
    documentation: 'https://github.com/gabonnews/api-docs',
    timestamp: new Date().toISOString()
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Gabon 24/7 API',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Import des routes YouTube
const youtubeRoutes = require('./src/routes/youtube');
app.use('/api', youtubeRoutes);

// Import des routes Weather
const weatherRoutes = require('./src/routes/weather');
app.use('/api/weather', weatherRoutes);

// Démarrer les planificateurs (désactivé temporairement)
try {
  // const { startPollScheduler } = require('./dist/schedulers/poll.scheduler');
  // const { pollWorker } = require('./dist/workers/poll.worker');
  
  // startPollScheduler();
  console.log('📊 Planificateur de sondages désactivé temporairement');
} catch (error) {
  console.log('⚠️ Planificateur de sondages non disponible:', error.message);
}

// Routes API de base
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API Gabon 24/7 opérationnelle',
    data: {
      status: 'running',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    }
  });
});

// Route d'authentification simple
app.post('/api/auth/login', (req, res) => {
  res.json({
    success: true,
    message: 'Authentification en cours de développement',
    data: {
      user: { 
        id: 'test-user', 
        phone_number: '+241000000', 
        subscription_tier: 'free',
        subscription_status: 'active'
      },
      access_token: 'test_token_' + Date.now()
    }
  });
});

// Route pour les flux RSS
app.get('/api/rss', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        name: 'Gabon Media Time',
        url: 'https://rss.app/feeds/YZrtbmX63sgyaGU6.xml',
        media_name: 'Gabon Media Time',
        is_active: true,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        name: 'L\'Union',
        url: 'https://union.sonapresse.com/feed/',
        media_name: 'L\'Union',
        is_active: true,
        created_at: new Date().toISOString()
      }
    ],
    message: 'Flux RSS de démonstration'
  });
});

// Route pour les articles de l'onglet ACCUEIL (< 36h)
app.get('/api/articles/home', async (req, res) => {
  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 heures
    
    console.log('🏠 Récupération articles Accueil (< 36h)...');
    
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        rss_feeds (
          name
        )
      `)
      .eq('is_published', true)
      .gte('published_at', cutoffTime.toISOString())
      .order('published_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const transformedArticles = data.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.ai_summary || '',
      source: article.rss_feeds?.name || article.source || 'Source inconnue',
      imageUrl: article.image_url || '/images/default-news.jpg',
      publishedAt: formatTimeAgo(article.published_at),
      category: article.category || 'Actualités',
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at
    }));

    console.log(`✅ ${transformedArticles.length} articles récents trouvés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      filter: 'home',
      timeRange: '< 36h'
    });
    
  } catch (error) {
    console.error('❌ Erreur articles home:', error);
    res.json({
      success: true,
      articles: [],
      error: 'Erreur de récupération'
    });
  }
});

// Route pour les articles de l'onglet CETTE SEMAINE (36h à 7 jours)
app.get('/api/articles/week', async (req, res) => {
  try {
    const now = new Date();
    const startWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 jours
    const endRecent = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 heures
    
    console.log('📅 Récupération articles Cette Semaine (36h - 7j)...');
    
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        rss_feeds (
          name
        )
      `)
      .eq('is_published', true)
      .gte('published_at', startWeek.toISOString())
      .lte('published_at', endRecent.toISOString())
      .order('published_at', { ascending: false })
      .limit(200);

    if (error) throw error;

    const transformedArticles = data.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.ai_summary || '',
      source: article.rss_feeds?.name || article.source || 'Source inconnue',
      imageUrl: article.image_url || '/images/default-news.jpg',
      publishedAt: formatTimeAgo(article.published_at),
      category: article.category || 'Actualités',
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at
    }));

    console.log(`✅ ${transformedArticles.length} articles de la semaine trouvés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      filter: 'week',
      timeRange: '36h - 7j'
    });
    
  } catch (error) {
    console.error('❌ Erreur articles week:', error);
    res.json({
      success: true,
      articles: [],
      error: 'Erreur de récupération'
    });
  }
});

// Route pour les articles ARCHIVES (> 7 jours + dates invalides)
app.get('/api/articles/archives', async (req, res) => {
  try {
    const now = new Date();
    const archiveCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 jours
    
    console.log('📚 Récupération articles Archives (> 7j)...');
    
    const { data, error } = await supabase
      .from('articles')
      .select(`
        *,
        rss_feeds (
          name
        )
      `)
      .eq('is_published', true)
      .or(`published_at.lt.${archiveCutoff.toISOString()},published_at.is.null`)
      .order('published_at', { ascending: false, nullsLast: true })
      .limit(500);

    if (error) throw error;

    const transformedArticles = data.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.ai_summary || '',
      source: article.rss_feeds?.name || article.source || 'Source inconnue',
      imageUrl: article.image_url || '/images/default-news.jpg',
      publishedAt: article.published_at ? formatTimeAgo(article.published_at) : 'Date inconnue',
      category: article.category || 'Actualités',
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at || article.created_at
    }));

    console.log(`✅ ${transformedArticles.length} articles d'archives trouvés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      filter: 'archives',
      timeRange: '> 7j'
    });
    
  } catch (error) {
    console.error('❌ Erreur articles archives:', error);
    res.json({
      success: true,
      articles: [],
      error: 'Erreur de récupération'
    });
  }
});

// Route générale pour les articles (fallback)
app.get('/api/articles', async (req, res) => {
  try {
    console.log('📊 Récupération tous articles...');
    
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const transformedArticles = data.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.ai_summary || '',
      imageUrl: article.image_url || '/images/default-news.jpg',
      publishedAt: formatTimeAgo(article.published_at),
      category: article.category || 'Actualités',
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at
    }));
    
    res.json({
      success: true,
      articles: transformedArticles,
      pagination: {
        page: 1,
        limit: 50,
        total: transformedArticles.length,
        totalPages: 1
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur articles généraux:', error);
    res.json({
      success: true,
      articles: [],
      error: 'Erreur de récupération'
    });
  }
});

// Route pour archiver un article
app.patch('/api/articles/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗄️ Archivage de l'article: ${id}`);
    
    const { data, error } = await supabaseService.supabase
      .from('articles')
      .update({ is_published: false })
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Article archivé avec succès',
      article: data[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur archivage article:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour supprimer un article
app.delete('/api/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Suppression de l'article: ${id}`);
    
    const { data, error } = await supabaseService.supabase
      .from('articles')
      .delete()
      .eq('id', id)
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      message: 'Article supprimé avec succès',
      article: data[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur suppression article:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Route pour récupérer les articles de cette semaine (36h à 7 jours)
app.get('/api/archives/articles', async (req, res) => {
  try {
    console.log('📚 Récupération des articles de cette semaine (36h-7j)...');
    
    // Calculer les dates limites
    const now = new Date();
    const thirtySevenHoursAgo = new Date(now.getTime() - (36 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Articles entre ${sevenDaysAgo.toISOString()} et ${thirtySevenHoursAgo.toISOString()}`);
    
    // Récupérer les articles de cette semaine (entre 36h et 7 jours)
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select(`
        id,
        title,
        summary,
        ai_summary,
        url,
        image_url,
        author,
        published_at,
        created_at,
        read_time_minutes,
        view_count,
        is_published,
        sentiment,
        category,
        rss_feeds (
          name,
          description
        )
      `)
      .eq('is_published', true)
      .gte('created_at', sevenDaysAgo.toISOString())
      .lt('created_at', thirtySevenHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    // Filtrer et trier les articles avec validation de dates
    const validArticles = articles.filter(article => {
      const sourceA = article.rss_feeds?.name || '';
      let dateToCheck;
      
      if (sourceA === "L'Union" || sourceA === "Gabonews") {
        dateToCheck = new Date(article.created_at);
      } else {
        dateToCheck = new Date(article.published_at);
      }
      
      // Exclure les articles avec dates invalides
      if (isNaN(dateToCheck.getTime())) {
        console.warn(`❌ Article avec date invalide exclu: ${article.title} - Date: ${article.published_at || article.created_at}`);
        return false;
      }
      
      return true;
    });

    const sortedArticles = validArticles.sort((a, b) => {
      const sourceA = a.rss_feeds?.name || '';
      const sourceB = b.rss_feeds?.name || '';
      
      let dateA, dateB;
      
      if (sourceA === "L'Union" || sourceA === "Gabonews") {
        dateA = new Date(a.created_at);
      } else {
        dateA = new Date(a.published_at);
      }
      
      if (sourceB === "L'Union" || sourceB === "Gabonews") {
        dateB = new Date(b.created_at);
      } else {
        dateB = new Date(b.published_at);
      }
      
      return dateB - dateA;
    });

    // Transformer les données pour le frontend
    const transformedArticles = sortedArticles.map(article => {
      let formattedDate = 'Date invalide';
      
      try {
        const dateToFormat = new Date(article.published_at);
        if (!isNaN(dateToFormat.getTime())) {
          formattedDate = dateToFormat.toLocaleDateString('fr-FR', {
            timeZone: 'Africa/Libreville',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          });
        } else {
          console.warn(`❌ Date invalide pour article: ${article.title} - published_at: ${article.published_at}`);
        }
      } catch (error) {
        console.warn(`❌ Erreur formatage date pour article: ${article.title} - Error: ${error.message}`);
      }

      return {
        ...article,
        imageUrl: article.image_url,
        source: article.rss_feeds?.name || 'Source inconnue',
        viewCount: article.view_count ? `${article.view_count} vues` : '0 vues',
        publishedAt: formattedDate
      };
    });

    console.log(`✅ ${transformedArticles.length} articles de cette semaine récupérés (36h-7j)`);
    res.json({
      success: true,
      articles: transformedArticles,
      total: transformedArticles.length,
      dateFilter: 'Articles de cette semaine (36h à 7 jours)'
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération articles archivés:', error);
    res.json({
      success: true,
      articles: [],
      total: 0,
      error: error.message
    });
  }
});

// Route pour récupérer tous les articles avec pagination et filtres (Archives générales)
app.get('/api/articles/all', async (req, res) => {
  try {
    const { page = 1, limit = 20, search, dateFilter, source, category } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('🗄️ Récupération des archives générales...', { page, limit, search, dateFilter, source, category });
    
    let query = supabaseService.supabase
      .from('articles')
      .select(`
        id,
        title,
        summary,
        ai_summary,
        url,
        image_url,
        author,
        published_at,
        created_at,
        read_time_minutes,
        view_count,
        is_published,
        sentiment,
        category,
        rss_feeds (
          name,
          description
        )
      `, { count: 'exact' })
      .eq('is_published', true);

    // Filtre par recherche
    if (search) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`);
    }

    // Filtre par date - Archives générales
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    
    if (dateFilter && dateFilter !== 'all') {
      let dateLimit = new Date();
      
      switch (dateFilter) {
        case 'week':
          dateLimit = oneWeekAgo;
          query = query.gte('created_at', dateLimit.toISOString());
          break;
        case 'month':
          dateLimit.setMonth(now.getMonth() - 1);
          query = query.gte('created_at', dateLimit.toISOString());
          break;
        case '3months':
          dateLimit.setMonth(now.getMonth() - 3);
          query = query.gte('created_at', dateLimit.toISOString());
          break;
        case '6months':
          dateLimit.setMonth(now.getMonth() - 6);
          query = query.gte('created_at', dateLimit.toISOString());
          break;
        case 'year':
          dateLimit.setFullYear(now.getFullYear() - 1);
          query = query.gte('created_at', dateLimit.toISOString());
          break;
        case 'custom':
          // Gérer les dates personnalisées - pas de restriction par défaut
          if (req.query.dateFrom) {
            query = query.gte('created_at', new Date(req.query.dateFrom).toISOString());
          }
          if (req.query.dateTo) {
            const dateTo = new Date(req.query.dateTo);
            dateTo.setHours(23, 59, 59, 999); // Fin de journée
            query = query.lte('created_at', dateTo.toISOString());
          }
          break;
      }
    } else {
      // Par défaut, afficher seulement les articles de plus d'1 semaine
      query = query.lt('created_at', oneWeekAgo.toISOString());
    }

    // Filtre par source
    if (source) {
      query = query.eq('rss_feeds.name', source);
    }

    // Filtre par catégorie
    if (category) {
      query = query.eq('category', category);
    }

    const { data: articles, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    // Transformer les données
    const transformedArticles = articles.map(article => ({
      ...article,
      imageUrl: article.image_url,
      source: article.rss_feeds?.name || 'Source inconnue',
      viewCount: article.view_count ? `${article.view_count} vues` : '0 vues',
      publishedAt: new Date(article.published_at).toLocaleDateString('fr-FR', {
        timeZone: 'Africa/Libreville',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));

    console.log(`✅ ${transformedArticles.length} articles récupérés (page ${page}/${Math.ceil(count / parseInt(limit))})`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit))
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération archives générales:', error);
    res.json({
      success: false,
      articles: [],
      total: 0,
      error: error.message
    });
  }
});

// Route pour récupérer les articles de la page d'accueil
app.get('/api/homepage/articles', async (req, res) => {
  console.log('🏠 Récupération des articles pour la page d\'accueil...');
  
  try {
    // Test de connectivité Supabase simple
    const { data: testData, error: testError } = await supabaseService.supabase
      .from('articles')
      .select('id')
      .limit(1);
      
    console.log(`🔍 Test connectivité: ${testError ? 'ÉCHEC' : 'SUCCÈS'}`);
    
    if (testError) {
      console.error('❌ Erreur connectivité Supabase:', testError);
      return res.json({
        success: false,
        error: `Connectivité Supabase: ${testError.message}`,
        articles: [],
        total: 0
      });
    }

    // Récupérer les articles sans jointure pour éviter l'erreur de colonne
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(50);
      
    // Récupérer tous les flux RSS séparément
    const { data: feeds, error: feedsError } = await supabaseService.supabase
      .from('rss_feeds')
      .select('*');
      
    console.log(`📊 Articles récupérés: ${articles?.length || 0}`);
    
    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    if (!articles || articles.length === 0) {
      console.log('⚠️ Aucun article trouvé');
      return res.json({
        success: true,
        articles: [],
        total: 0,
        message: 'Aucun article publié trouvé'
      });
    }

    // Fonction pour mapper les articles avec les flux RSS par feed_id
    const mapArticleToFeed = (article, feeds) => {
      if (article.feed_id && feeds) {
        const matchingFeed = feeds.find(feed => feed.id === article.feed_id);
        if (matchingFeed) {
          console.log(`✅ Média trouvé via feed_id: ${matchingFeed.name}`);
          return matchingFeed.name;
        }
      }
      
      // Fallback par URL si pas de feed_id
      const url = article.url || '';
      if (url.includes('facebook.com/tvgabon24')) return 'TV Gabon 24';
      if (url.includes('facebook.com/PresidenceGabon')) return 'Présidence de la République';
      if (url.includes('agpgabon.ga')) return 'AGP - Agence Gabonaise de Presse';
      if (url.includes('lunion.ga')) return 'L\'Union';
      if (url.includes('gabonews.com')) return 'Gabonews';
      if (url.includes('gabonactu.com')) return 'Gabon Actu';
      if (url.includes('gabonmediatime.com')) return 'Gabon Media Time';
      
      console.log(`⚠️ Aucun flux RSS associé pour l'article: ${article.title?.substring(0, 50)}...`);
      return 'Source RSS non configurée';
    };

    // Transformer les données en utilisant les flux RSS Supabase
    const transformedArticles = articles.map(article => {
      const mediaName = mapArticleToFeed(article, feeds);
      
      return {
        id: article.id,
        title: article.title,
        summary: article.summary || article.ai_summary || 'Résumé non disponible',
        source: mediaName,
        imageUrl: article.image_url,
        viewCount: article.view_count ? `${article.view_count} vues` : '0 vues',
        published_at: article.published_at,
        created_at: article.created_at,
        category: article.category,
        url: article.url,
        isGovernment: mediaName.includes('Ministère') || mediaName.includes('Présidence') || mediaName.includes('Gouvernement'),
        rss_feed_info: article.rss_feeds // Pour debug
      };
    });

    // Trier les articles par date de publication (plus récent en premier)
    transformedArticles.sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at);
      const dateB = new Date(b.published_at || b.created_at);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`✅ ${transformedArticles.length} articles transformés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      total: transformedArticles.length
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération articles:', error);
    
    res.json({
      success: false,
      error: error.message,
      articles: [],
      total: 0
    });
  }
});

// Route pour incrémenter le nombre de vues d'un article
app.post('/api/articles/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👁️ Incrémentation des vues pour l'article: ${id}`);

    // D'abord récupérer l'article pour obtenir le view_count actuel
    const { data: currentArticle, error: fetchError } = await supabaseService.supabase
      .from('articles')
      .select('view_count')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('❌ Erreur récupération article:', fetchError);
      throw fetchError;
    }

    const newViewCount = (currentArticle?.view_count || 0) + 1;

    // Incrémenter le compteur de vues
    const { data, error } = await supabaseService.supabase
      .from('articles')
      .update({ 
        view_count: newViewCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('view_count')
      .single();

    if (error) {
      console.error('❌ Erreur incrémentation vues:', error);
      throw error;
    }

    console.log(`✅ Vues incrémentées: ${data?.view_count || newViewCount}`);
    res.json({
      success: true,
      view_count: data?.view_count || newViewCount,
      message: 'Vue comptabilisée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur API incrémentation vues:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la comptabilisation de la vue'
    });
  }
});

// Route pour les statistiques
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      stats: {
        total_users: 0,
        active_feeds: 2,
        articles_today: 1,
        messages_sent: 0
      },
      queues: {
        rss: { waiting: 0, active: 0, completed: 0 },
        messages: { waiting: 0, active: 0, completed: 0 }
      }
    }
  });
});

// Route pour incrémenter les vues d'un article
app.post('/api/articles/view', async (req, res) => {
  try {
    const { articleId } = req.body;
    
    if (!articleId) {
      return res.status(400).json({
        success: false,
        error: 'ID de l\'article requis'
      });
    }

    console.log(`👁️ Incrémentation des vues pour l'article: ${articleId}`);
    
    // Incrémenter le compteur de vues dans Supabase
    const { data: article, error } = await supabaseService.supabase
      .from('articles')
      .select('view_count')
      .eq('id', articleId)
      .single();

    if (error) {
      console.error('❌ Erreur lors de la récupération de l\'article:', error);
      return res.status(404).json({
        success: false,
        error: 'Article non trouvé'
      });
    }

    const newViewCount = (article.view_count || 0) + 1;

    const { error: updateError } = await supabaseService.supabase
      .from('articles')
      .update({ view_count: newViewCount })
      .eq('id', articleId);

    if (updateError) {
      console.error('❌ Erreur lors de la mise à jour des vues:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour'
      });
    }

    console.log(`✅ Vues mises à jour: ${newViewCount} pour l'article ${articleId}`);
    
    res.json({
      success: true,
      view_count: newViewCount,
      message: 'Vue comptabilisée avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'incrémentation des vues:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Endpoint pour récupérer tous les flux RSS configurés
app.get('/api/rss/feeds', async (req, res) => {
  try {
    console.log('📡 Récupération de tous les flux RSS...');
    
    const { data: feeds, error } = await supabaseService.supabase
      .from('rss_feeds')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur lors de la récupération des flux RSS:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des flux RSS'
      });
    }

    console.log(`✅ ${feeds?.length || 0} flux RSS récupérés`);
    
    res.json({
      success: true,
      feeds: feeds || [],
      count: feeds?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Endpoint pour récupérer tous les flux RSS
app.get('/api/admin/rss-feeds', async (req, res) => {
  try {
    console.log('📡 Récupération des flux RSS...');
    
    const { data: feeds, error } = await supabaseService.supabase
      .from('rss_feeds')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur récupération flux RSS:', error);
      throw error;
    }
    
    console.log(`✅ ${feeds?.length || 0} flux RSS récupérés`);
    
    res.json({
      success: true,
      feeds: feeds || []
    });
    
  } catch (error) {
    console.error('❌ Erreur endpoint flux RSS:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      feeds: []
    });
  }
});

// Endpoint pour ajouter un nouveau flux RSS
app.post('/api/admin/rss-feeds', async (req, res) => {
  try {
    const { name, url, category } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Nom et URL requis'
      });
    }

    console.log(`📡 Ajout d'un nouveau flux RSS: ${name}`);
    
    const { data: feed, error } = await supabaseService.supabase
      .from('rss_feeds')
      .insert([{
        name: name,
        url: url,
        category: category || 'Actualités',
        language: 'fr',
        country: 'GA',
        status: 'active',
        fetch_interval_minutes: 30,
        is_premium: false,
        priority: 1
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur lors de l\'ajout du flux RSS:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'ajout du flux RSS'
      });
    }

    console.log(`✅ Flux RSS ajouté: ${feed.name}`);
    
    res.json({
      success: true,
      feed: feed,
      message: 'Flux RSS ajouté avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout du flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Route pour supprimer les anciens articles d'un flux RSS spécifique
app.delete('/api/articles/feed/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;
    console.log(`🗑️ Suppression des anciens articles du flux: ${feedId}`);
    
    const { data, error } = await supabase
      .from('articles')
      .delete()
      .eq('feed_id', feedId);

    if (error) {
      console.error('❌ Erreur lors de la suppression des articles:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression des articles'
      });
    }

    console.log(`✅ Articles supprimés: ${data?.length || 0}`);
    
    res.json({
      success: true,
      message: `Articles supprimés avec succès`,
      deletedCount: data?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des articles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Endpoint pour modifier un flux RSS
app.put('/api/admin/rss-feeds/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, category } = req.body;
    
    console.log(`📝 Modification du flux RSS: ${id}`);
    
    const { data, error } = await supabaseService.supabase
      .from('rss_feeds')
      .update({
        name,
        url,
        category,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('❌ Erreur lors de la modification du flux RSS:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la modification du flux RSS'
      });
    }

    console.log(`✅ Flux RSS modifié: ${id}`);
    
    res.json({
      success: true,
      message: 'Flux RSS modifié avec succès',
      feed: data[0]
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la modification du flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Endpoint pour synchroniser manuellement tous les flux RSS
app.post('/api/admin/rss-feeds/sync-all', async (req, res) => {
  try {
    console.log('🔄 Déclenchement manuel de la synchronisation RSS...');
    
    // Déclencher la synchronisation via le service RSS
    if (rssService && typeof rssService.syncAllFeeds === 'function') {
      await rssService.syncAllFeeds();
      
      res.json({
        success: true,
        message: 'Synchronisation déclenchée avec succès'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Service RSS non disponible'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation manuelle:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la synchronisation'
    });
  }
});

// Endpoint pour tester un flux RSS
app.post('/api/admin/rss-feeds/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🧪 Test du flux RSS: ${id}`);
    
    // Récupérer le flux
    const { data: feed, error } = await supabaseService.supabase
      .from('rss_feeds')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !feed) {
      return res.status(404).json({
        success: false,
        error: 'Flux RSS non trouvé'
      });
    }

    // Tester le flux avec le service RSS
    try {
      await rssService.syncFeed(feed);
      console.log(`✅ Test réussi pour le flux: ${feed.name}`);
      
      res.json({
        success: true,
        message: 'Test du flux RSS réussi'
      });
    } catch (testError) {
      console.error(`❌ Test échoué pour le flux ${feed.name}:`, testError);
      
      res.json({
        success: false,
        error: 'Test du flux RSS échoué: ' + testError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test du flux RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur interne du serveur'
    });
  }
});

// Route pour déclencher le traitement RSS
app.post('/api/rss/process-all', async (req, res) => {
  try {
    console.log('🔄 Déclenchement manuel du traitement RSS...');
    
    // Lancer la synchronisation de tous les flux
    await rssService.syncAllFeeds();
    
    res.json({
      success: true,
      message: 'Traitement RSS déclenché avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur traitement RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement RSS'
    });
  }
});

// Route pour supprimer les articles de test
app.delete('/api/articles/test-feed', async (req, res) => {
  try {
    console.log('🗑️ Suppression des articles de test "Test Feed Updated"...');
    
    // Récupérer d'abord les articles avec le feed "Test Feed Updated"
    const { data: feedData, error: feedError } = await supabaseService.supabase
      .from('rss_feeds')
      .select('id')
      .eq('name', 'Test Feed Updated');

    if (feedError) {
      console.error('❌ Erreur récupération feed test:', feedError);
      throw feedError;
    }

    if (feedData && feedData.length > 0) {
      const feedId = feedData[0].id;
      
      // Supprimer les articles liés à ce feed
      const { data: deletedArticles, error: deleteError } = await supabaseService.supabase
        .from('articles')
        .delete()
        .eq('feed_id', feedId);

      if (deleteError) {
        console.error('❌ Erreur suppression articles:', deleteError);
        throw deleteError;
      }

      // Supprimer aussi le feed lui-même
      const { error: deleteFeedError } = await supabaseService.supabase
        .from('rss_feeds')
        .delete()
        .eq('id', feedId);

      if (deleteFeedError) {
        console.error('❌ Erreur suppression feed:', deleteFeedError);
        throw deleteFeedError;
      }

      console.log(`✅ Articles et feed de test supprimés avec succès`);
      res.json({
        success: true,
        message: 'Articles et feed de test supprimés avec succès'
      });
    } else {
      res.json({
        success: true,
        message: 'Aucun article de test trouvé'
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur suppression articles test:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression des articles de test'
    });
  }
});

// ===== ENDPOINTS DE TENDANCES =====

// Endpoint pour les articles les plus vus du jour
app.get('/api/stats/trending/daily/views', async (req, res) => {
  try {
    console.log('📊 Récupération des articles les plus vus du jour...');
    
    // Récupérer tous les articles récents (dernières 24h) pour les tendances
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24h en arrière
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        *,
        rss_feeds (
          name
        )
      `)
      .gte('published_at', yesterday.toISOString())
      .order('view_count', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances vues:', error);
      throw error;
    }

    const transformedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary || 'Résumé non disponible.',
      ai_summary: article.ai_summary,
      url: article.url,
      imageUrl: article.image_url,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      created_at: article.created_at,
      read_time_minutes: article.read_time_minutes || 1,
      view_count: article.view_count || 0,
      is_published: article.is_published,
      sentiment: article.sentiment || 'neutre',
      category: article.category || 'Actualités',
      rss_feeds: article.rss_feeds,
      source: article.rss_feeds?.name || 'Source inconnue',
      viewCount: formatViewCount(article.view_count || 0),
      publishedAt: formatTimeAgo(article.published_at)
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances vues récupérés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      period: 'daily',
      metric: 'views',
      count: transformedArticles.length
    });

  } catch (error) {
    console.error('❌ Erreur endpoint tendances vues quotidiennes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tendances',
      articles: []
    });
  }
});

// Endpoint pour les articles les plus vus du mois
app.get('/api/stats/trending/monthly/views', async (req, res) => {
  try {
    console.log('📊 Récupération des articles les plus vus du mois...');
    
    // Récupérer tous les articles du mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select(`
        *,
        rss_feeds (
          name
        )
      `)
      .gte('published_at', startOfMonth.toISOString())
      .order('view_count', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances vues mensuelles:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map(article => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary || 'Résumé non disponible.',
      ai_summary: article.ai_summary,
      url: article.url,
      imageUrl: article.image_url,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      created_at: article.created_at,
      read_time_minutes: article.read_time_minutes || 1,
      view_count: article.view_count || 0,
      is_published: article.is_published,
      sentiment: article.sentiment || 'neutre',
      category: article.category || 'Actualités',
      rss_feeds: article.rss_feeds,
      source: article.rss_feeds?.name || 'Source inconnue',
      viewCount: formatViewCount(article.view_count || 0),
      publishedAt: formatTimeAgo(article.published_at)
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances vues mensuelles récupérés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      period: 'monthly',
      metric: 'views',
      count: transformedArticles.length
    });

  } catch (error) {
    console.error('❌ Erreur endpoint tendances vues mensuelles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tendances',
      articles: []
    });
  }
});

// Endpoint pour les articles les plus partagés du jour
app.get('/api/stats/trending/daily/shares', async (req, res) => {
  try {
    console.log('📊 Récupération des articles les plus partagés du jour...');
    
    // Calculer la date d'hier 18h en heure de Libreville
    const now = new Date();
    const librevilleTime = new Date(now.toLocaleString("en-US", {timeZone: "Africa/Libreville"}));
    const yesterday = new Date(librevilleTime);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);
    const yesterdayUTC = new Date(yesterday.getTime() - (60 * 60 * 1000)); // GMT+1 = UTC+1
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .gte('published_at', yesterdayUTC.toISOString())
      .order('view_count', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances partages:', error);
      throw error;
    }

    // Simuler les partages comme un pourcentage des vues (15%)
    const transformedArticles = (articles || []).map(article => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary || 'Résumé non disponible.',
      source: article.source,
      publishedAt: formatTimeAgo(article.published_at),
      published_at: article.published_at,
      category: article.category || 'actualité',
      viewCount: formatViewCount(article.view_count || 0),
      view_count: article.view_count || 0,
      share_count: Math.floor((article.view_count || 0) * 0.15),
      url: article.url,
      imageUrl: article.image_url,
      author: article.author || 'Rédaction',
      trending: true
    })).sort((a, b) => b.share_count - a.share_count);

    console.log(`✅ ${transformedArticles.length} articles tendances partages quotidiens récupérés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      period: 'daily',
      metric: 'shares',
      count: transformedArticles.length
    });

  } catch (error) {
    console.error('❌ Erreur endpoint tendances partages quotidiens:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tendances',
      articles: []
    });
  }
});

// Endpoint pour les articles les plus partagés du mois
app.get('/api/stats/trending/monthly/shares', async (req, res) => {
  try {
    console.log('📊 Récupération des articles les plus partagés du mois...');
    
    // Calculer le début du mois en heure de Libreville
    const now = new Date();
    const librevilleTime = new Date(now.toLocaleString("en-US", {timeZone: "Africa/Libreville"}));
    const startOfMonth = new Date(librevilleTime.getFullYear(), librevilleTime.getMonth(), 1);
    const startOfMonthUTC = new Date(startOfMonth.getTime() - (60 * 60 * 1000)); // GMT+1 = UTC+1
    
    const { data: articles, error } = await supabase
      .from('articles')
      .select('*')
      .gte('published_at', startOfMonthUTC.toISOString())
      .order('view_count', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances partages mensuels:', error);
      throw error;
    }

    // Simuler les partages comme un pourcentage des vues (15%)
    const transformedArticles = (articles || []).map(article => ({
      id: article.id,
      title: article.title,
      summary: article.ai_summary || article.summary || 'Résumé non disponible.',
      source: article.source,
      publishedAt: formatTimeAgo(article.published_at),
      published_at: article.published_at,
      category: article.category || 'actualité',
      viewCount: formatViewCount(article.view_count || 0),
      view_count: article.view_count || 0,
      share_count: Math.floor((article.view_count || 0) * 0.15),
      url: article.url,
      imageUrl: article.image_url,
      author: article.author || 'Rédaction',
      trending: true
    })).sort((a, b) => b.share_count - a.share_count);

    console.log(`✅ ${transformedArticles.length} articles tendances partages mensuels récupérés`);
    
    res.json({
      success: true,
      articles: transformedArticles,
      period: 'monthly',
      metric: 'shares',
      count: transformedArticles.length
    });

  } catch (error) {
    console.error('Erreur récupération dernière mise à jour:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Endpoint pour vérifier s'il y a de nouveaux articles
app.get('/api/articles/check-updates', async (req, res) => {
  try {
    const { lastCheck } = req.query;
    
    if (!lastCheck) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre lastCheck requis'
      });
    }

    const { data: newArticles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, created_at')
      .eq('is_published', true)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      hasNewArticles: newArticles.length > 0,
      newArticlesCount: newArticles.length,
      newArticles: newArticles.slice(0, 5) // Limiter à 5 pour la réponse
    });

  } catch (error) {
    console.error('❌ Erreur vérification nouveaux articles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Initialiser le service RSS sans synchronisation automatique au démarrage
let rssService;

// Endpoint pour récupérer la dernière heure de mise à jour RSS
app.get('/api/rss/last-update', (req, res) => {
  try {
    const lastUpdate = rssService.getLastUpdateTime();
    const formattedTime = rssService.getFormattedLastUpdateTime();
    
    res.json({
      success: true,
      lastUpdate: lastUpdate,
      lastUpdateFormatted: formattedTime
    });
  } catch (error) {
    console.error('❌ Erreur récupération dernière actualisation RSS:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Endpoint pour vérifier s'il y a de nouveaux articles
app.get('/api/articles/check-updates', async (req, res) => {
  try {
    const { lastCheck } = req.query;
    
    if (!lastCheck) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre lastCheck requis'
      });
    }

    const { data: newArticles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, created_at')
      .eq('is_published', true)
      .gt('created_at', lastCheck)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      hasNewArticles: newArticles.length > 0,
      newArticlesCount: newArticles.length,
      newArticles: newArticles.slice(0, 5) // Limiter à 5 pour la réponse
    });

  } catch (error) {
    console.error('❌ Erreur vérification nouveaux articles:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// Route pour récupérer les événements à venir
app.get('/api/events', async (req, res) => {
  try {
    console.log('🎉 Récupération des événements à venir...');
    
    const now = new Date();
    
    // Récupérer les événements actifs, triés par date de création si event_date est null
    const { data: events, error } = await supabaseService.supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur Supabase events:', error);
      throw error;
    }

    // Transformer les données pour le frontend
    const transformedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      eventDate: event.event_date,
      location: event.location,
      url: event.url,
      imageUrl: event.image_url,
      category: event.category,
      organizer: event.organizer,
      formattedDate: event.event_date ? new Date(event.event_date).toLocaleDateString('fr-FR', {
        timeZone: 'Africa/Libreville',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Date à confirmer'
    }));

    console.log(`✅ ${transformedEvents.length} événements récupérés`);
    res.json({
      success: true,
      events: transformedEvents,
      total: transformedEvents.length
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des événements:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      events: [],
      total: 0
    });
  }
});

// Route pour synchroniser les événements manuellement
app.post('/api/events/sync', async (req, res) => {
  try {
    console.log('🔄 Synchronisation manuelle des événements...');
    await fetchEvents();
    res.json({ 
      success: true, 
      message: 'Synchronisation des événements terminée avec succès' 
    });
  } catch (error) {
    console.error('❌ Erreur synchronisation événements:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Erreur lors de la synchronisation des événements'
    });
  }
});

// =============================================
// ROUTES API SLIDES PUBLICITAIRES
// =============================================

// Route pour récupérer les slides actifs
app.get('/api/slides', async (req, res) => {
  try {
    console.log('📢 Récupération des slides publicitaires actifs...');
    
    const now = new Date();
    
    // Récupérer les slides actifs et approuvés avec leurs campagnes
    const { data: slides, error } = await supabaseService.supabase
      .from('promotional_slides')
      .select(`
        *,
        ad_campaigns!inner (
          company_name,
          is_active,
          admin_approved,
          payment_status,
          start_date,
          end_date
        )
      `)
      .eq('is_active', true)
      .eq('ad_campaigns.is_active', true)
      .eq('ad_campaigns.admin_approved', true)
      .eq('ad_campaigns.payment_status', 'paid')
      .lte('ad_campaigns.start_date', now.toISOString())
      .gte('ad_campaigns.end_date', now.toISOString())
      .order('display_order', { ascending: true });

    if (error) {
      console.error('❌ Erreur Supabase slides:', error);
      throw error;
    }

    // Transformer les données pour le frontend
    const transformedSlides = slides.map(slide => ({
      id: slide.id,
      title: slide.title,
      description: slide.description,
      imageUrl: slide.image_url,
      linkUrl: slide.link_url,
      ctaText: slide.cta_text,
      companyName: slide.ad_campaigns.company_name,
      displayOrder: slide.display_order
    }));

    console.log(`✅ ${transformedSlides.length} slides publicitaires trouvés`);
    
    res.json({ 
      success: true, 
      slides: transformedSlides,
      total: transformedSlides.length
    });

  } catch (error) {
    console.error('❌ Erreur récupération slides:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      slides: [],
      total: 0
    });
  }
});

// Route pour enregistrer une vue de slide
app.post('/api/slides/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referrer');

    // Récupérer le slide actuel pour obtenir le view_count
    const { data: slide, error: fetchError } = await supabaseService.supabase
      .from('promotional_slides')
      .select('view_count')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Incrémenter le compteur de vues
    const { error: updateError } = await supabaseService.supabase
      .from('promotional_slides')
      .update({ 
        view_count: (slide.view_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Enregistrer l'analytics
    const { error: analyticsError } = await supabaseService.supabase
      .from('slide_analytics')
      .insert({
        slide_id: id,
        event_type: 'view',
        user_ip: userIp,
        user_agent: userAgent,
        referrer: referrer
      });

    if (analyticsError) throw analyticsError;

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur enregistrement vue slide:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour enregistrer un clic de slide
app.post('/api/slides/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const referrer = req.get('Referrer');

    // Récupérer le slide actuel pour obtenir le click_count
    const { data: slide, error: fetchError } = await supabaseService.supabase
      .from('promotional_slides')
      .select('click_count')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Incrémenter le compteur de clics
    const { error: updateError } = await supabaseService.supabase
      .from('promotional_slides')
      .update({ 
        click_count: (slide.click_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Enregistrer l'analytics
    const { error: analyticsError } = await supabaseService.supabase
      .from('slide_analytics')
      .insert({
        slide_id: id,
        event_type: 'click',
        user_ip: userIp,
        user_agent: userAgent,
        referrer: referrer
      });

    if (analyticsError) throw analyticsError;

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur enregistrement clic slide:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour récupérer les forfaits publicitaires
app.get('/api/ad-packages', async (req, res) => {
  try {
    console.log('💰 Récupération des forfaits publicitaires...');
    
    const { data: packages, error } = await supabaseService.supabase
      .from('ad_packages')
      .select('*')
      .eq('is_active', true)
      .order('price_fcfa', { ascending: true });

    if (error) throw error;

    console.log(`✅ ${packages.length} forfaits publicitaires trouvés`);
    
    res.json({ 
      success: true, 
      packages: packages,
      total: packages.length
    });

  } catch (error) {
    console.error('❌ Erreur récupération forfaits:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      packages: [],
      total: 0
    });
  }
});

// Route pour créer une nouvelle campagne publicitaire
app.post('/api/campaigns', async (req, res) => {
  try {
    console.log('📝 Création d\'une nouvelle campagne publicitaire...');
    
    const {
      company_name,
      contact_email,
      contact_phone,
      package_id,
      start_date,
      slides_data
    } = req.body;

    // Validation des données
    if (!company_name || !contact_email || !package_id || !start_date || !slides_data) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes pour créer la campagne'
      });
    }

    // Récupérer les informations du forfait
    const { data: package_info, error: packageError } = await supabaseService.supabase
      .from('ad_packages')
      .select('*')
      .eq('id', package_id)
      .single();

    if (packageError || !package_info) {
      return res.status(400).json({
        success: false,
        error: 'Forfait publicitaire introuvable'
      });
    }

    // Calculer la date de fin
    const startDate = new Date(start_date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + package_info.duration_days);

    // Créer la campagne
    const { data: campaign, error: campaignError } = await supabaseService.supabase
      .from('ad_campaigns')
      .insert({
        company_name,
        contact_email,
        contact_phone,
        package_id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        total_amount: package_info.price_fcfa,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // Créer les slides
    const slidesWithCampaign = slides_data.map((slide, index) => ({
      ...slide,
      campaign_id: campaign.id,
      display_order: index
    }));

    const { data: slides, error: slidesError } = await supabaseService.supabase
      .from('promotional_slides')
      .insert(slidesWithCampaign)
      .select();

    if (slidesError) throw slidesError;

    console.log(`✅ Campagne créée avec ${slides.length} slides`);
    
    res.json({ 
      success: true, 
      campaign: campaign,
      slides: slides,
      message: 'Campagne créée avec succès. En attente de paiement et d\'approbation.'
    });

  } catch (error) {
    console.error('❌ Erreur création campagne:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// ========================
// ROUTES ADMIN - SLIDES PUBLICITAIRES
// ========================

// GET /api/admin/campaigns - Récupérer toutes les campagnes avec leurs slides
app.get('/api/admin/campaigns', async (req, res) => {
  try {
    console.log('📋 Admin: Récupération des campagnes...');

    const { data: campaigns, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .select(`
        *,
        ad_packages (
          name,
          duration_days,
          max_slides,
          price_fcfa
        ),
        promotional_slides (
          id,
          title,
          description,
          image_url,
          link_url,
          cta_text,
          display_order,
          is_active,
          view_count,
          click_count
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`✅ ${campaigns.length} campagnes récupérées`);
    res.json({ success: true, campaigns });

  } catch (error) {
    console.error('❌ Erreur récupération campagnes:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// POST /api/campaigns/request - Nouvelle demande de campagne
app.post('/api/campaigns/request', async (req, res) => {
  try {
    const {
      company_name,
      contact_email,
      contact_phone,
      start_date,
      end_date,
      package_id,
      visual_creation_service,
      visual_service_price,
      message
    } = req.body;

    console.log('📝 Nouvelle demande de campagne:', company_name);

    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .insert({
        company_name,
        contact_email,
        contact_phone,
        start_date: new Date(start_date).toISOString(),
        end_date: new Date(end_date).toISOString(),
        package_id,
        visual_creation_service: visual_creation_service || false,
        visual_service_price: visual_service_price || 0,
        admin_notes: message || null,
        status: 'pending',
        payment_status: 'pending',
        is_active: false,
        admin_approved: false,
        submission_date: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    console.log('✅ Demande de campagne créée:', data[0].id);
    res.json({
      success: true,
      message: 'Demande soumise avec succès',
      campaign: data[0]
    });

  } catch (error) {
    console.error('❌ Erreur création demande:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la demande'
    });
  }
});

// POST /api/admin/campaigns/:id/approve - Approuver une campagne
app.post('/api/admin/campaigns/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    
    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        status: 'approved',
        admin_approved: true,
        admin_notes: admin_notes || null,
        approval_date: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, message: 'Campagne approuvée', campaign: data[0] });
  } catch (error) {
    console.error('Erreur approbation campagne:', error);
    res.status(500).json({ error: 'Erreur lors de l\'approbation' });
  }
});

// Rejeter une campagne
app.post('/api/admin/campaigns/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    
    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        status: 'rejected',
        admin_approved: false,
        admin_notes: admin_notes || 'Campagne rejetée',
        approval_date: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, message: 'Campagne rejetée', campaign: data[0] });
  } catch (error) {
    console.error('Erreur rejet campagne:', error);
    res.status(500).json({ error: 'Erreur lors du rejet' });
  }
});

// Activer une campagne approuvée
app.post('/api/admin/campaigns/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        status: 'active',
        is_active: true
      })
      .eq('id', id)
      .eq('status', 'approved')
      .select();

    if (error) throw error;
    if (data.length === 0) {
      return res.status(400).json({ error: 'Campagne non trouvée ou non approuvée' });
    }
    
    res.json({ success: true, message: 'Campagne activée', campaign: data[0] });
  } catch (error) {
    console.error('Erreur activation campagne:', error);
    res.status(500).json({ error: 'Erreur lors de l\'activation' });
  }
});

// Renouveler une campagne
app.post('/api/admin/campaigns/:id/renew', async (req, res) => {
  try {
    const { id } = req.params;
    const { duration_days } = req.body;
    
    if (!duration_days || duration_days <= 0) {
      return res.status(400).json({ error: 'Durée invalide' });
    }

    // Calculer nouvelles dates
    const newStartDate = new Date();
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + duration_days);
    
    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        start_date: newStartDate.toISOString(),
        end_date: newEndDate.toISOString(),
        status: 'active',
        is_active: true,
        admin_notes: `Campagne renouvelée pour ${duration_days} jours`
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, message: `Campagne renouvelée pour ${duration_days} jours`, campaign: data[0] });
  } catch (error) {
    console.error('Erreur renouvellement campagne:', error);
    res.status(500).json({ error: 'Erreur lors du renouvellement' });
  }
});

// Prolonger une campagne active
app.post('/api/admin/campaigns/:id/extend', async (req, res) => {
  try {
    const { id } = req.params;
    const { extension_days } = req.body;
    
    if (!extension_days || extension_days <= 0) {
      return res.status(400).json({ error: 'Extension invalide' });
    }

    // Récupérer la campagne actuelle
    const { data: campaign, error: fetchError } = await supabaseService.supabase
      .from('ad_campaigns')
      .select('end_date')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Prolonger la date de fin
    const currentEndDate = new Date(campaign.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + extension_days);
    
    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        end_date: newEndDate.toISOString(),
        admin_notes: `Campagne prolongée de ${extension_days} jours`
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, message: `Campagne prolongée de ${extension_days} jours`, campaign: data[0] });
  } catch (error) {
    console.error('Erreur prolongation campagne:', error);
    res.status(500).json({ error: 'Erreur lors de la prolongation' });
  }
});

// Réactiver une campagne expirée
app.post('/api/admin/campaigns/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        status: 'active',
        is_active: true,
        admin_notes: 'Campagne réactivée'
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json({ success: true, message: 'Campagne réactivée', campaign: data[0] });
  } catch (error) {
    console.error('Erreur réactivation campagne:', error);
    res.status(500).json({ error: 'Erreur lors de la réactivation' });
  }
});

// PUT /api/admin/campaigns/:id - Modifier une campagne complète
app.put('/api/admin/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      company_name, 
      contact_email, 
      contact_phone, 
      start_date, 
      end_date, 
      payment_status, 
      payment_reference, 
      is_active, 
      admin_approved 
    } = req.body;

    console.log(`✏️ Admin: Modification campagne ${id}...`);

    const { data, error } = await supabaseService.supabase
      .from('ad_campaigns')
      .update({ 
        company_name,
        contact_email,
        contact_phone,
        start_date: new Date(start_date).toISOString(),
        end_date: new Date(end_date).toISOString(),
        payment_status,
        payment_reference,
        is_active,
        admin_approved,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    console.log(`✅ Campagne ${id} modifiée avec succès`);
    res.json({ 
      success: true, 
      message: 'Campagne modifiée avec succès',
      campaign: data[0]
    });

  } catch (error) {
    console.error('❌ Erreur modification campagne:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// PUT /api/admin/slides/:id - Modifier un slide
app.put('/api/admin/slides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, link_url, cta_text, display_order, is_active } = req.body;

    console.log(`✏️ Admin: Modification slide ${id}...`);

    const { data, error } = await supabaseService.supabase
      .from('promotional_slides')
      .update({ 
        title,
        description,
        image_url,
        link_url,
        cta_text,
        display_order,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    console.log(`✅ Slide ${id} modifié avec succès`);
    res.json({ 
      success: true, 
      message: 'Slide modifié avec succès',
      slide: data[0]
    });

  } catch (error) {
    console.error('❌ Erreur modification slide:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// DELETE /api/admin/slides/:id - Supprimer un slide
app.delete('/api/admin/slides/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Admin: Suppression slide ${id}...`);

    const { error } = await supabaseService.supabase
      .from('promotional_slides')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`✅ Slide ${id} supprimé avec succès`);
    res.json({ 
      success: true, 
      message: 'Slide supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression slide:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});


// POST /api/slides/track-view - Enregistrer une vue de slide
app.post('/api/slides/track-view', async (req, res) => {
  try {
    const { slideId, userAgent, referrer } = req.body;
    const userIp = req.ip || req.connection.remoteAddress;

    // Récupérer le slide actuel pour obtenir le view_count
    const { data: slide, error: fetchError } = await supabaseService.supabase
      .from('promotional_slides')
      .select('view_count')
      .eq('id', slideId)
      .single();

    if (fetchError) throw fetchError;

    // Incrémenter le compteur de vues
    const { error: slideError } = await supabaseService.supabase
      .from('promotional_slides')
      .update({ 
        view_count: (slide.view_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', slideId);

    if (slideError) throw slideError;

    // Enregistrer l'événement dans les analytics
    const { error: analyticsError } = await supabaseService.supabase
      .from('slide_analytics')
      .insert({
        slide_id: slideId,
        event_type: 'view',
        user_ip: userIp,
        user_agent: userAgent,
        referrer: referrer
      });

    if (analyticsError) throw analyticsError;

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur tracking vue:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/slides/track-click - Enregistrer un clic de slide
app.post('/api/slides/track-click', async (req, res) => {
  try {
    const { slideId, userAgent, referrer } = req.body;
    const userIp = req.ip || req.connection.remoteAddress;

    // Incrémenter le compteur de clics
    const { error: slideError } = await supabaseService.supabase
      .from('promotional_slides')
      .update({ 
        click_count: supabaseService.supabase.raw('click_count + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', slideId);

    if (slideError) throw slideError;

    // Enregistrer l'événement dans les analytics
    const { error: analyticsError } = await supabaseService.supabase
      .from('slide_analytics')
      .insert({
        slide_id: slideId,
        event_type: 'click',
        user_ip: userIp,
        user_agent: userAgent,
        referrer: referrer
      });

    if (analyticsError) throw analyticsError;

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Erreur tracking clic:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/admin/analytics - Statistiques globales des slides
app.get('/api/admin/analytics', async (req, res) => {
  try {
    console.log('📈 Admin: Récupération analytics globales...');

    // Statistiques des campagnes
    const { data: campaignStats, error: campaignError } = await supabaseService.supabase
      .from('ad_campaigns')
      .select('id, is_approved, is_active, payment_status');

    if (campaignError) throw campaignError;

    // Statistiques des slides
    const { data: slideStats, error: slideError } = await supabaseService.supabase
      .from('promotional_slides')
      .select('id, view_count, click_count, is_active');

    if (slideError) throw slideError;

    // Analytics détaillées par slide
    const { data: analytics, error: analyticsError } = await supabaseService.supabase
      .from('slide_analytics')
      .select('slide_id, action_type, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // 30 derniers jours

    if (analyticsError) throw analyticsError;

    // Calculs des statistiques
    const totalCampaigns = campaignStats.length;
    const approvedCampaigns = campaignStats.filter(c => c.is_approved).length;
    const activeCampaigns = campaignStats.filter(c => c.is_active).length;
    const paidCampaigns = campaignStats.filter(c => c.payment_status === 'paid').length;

    const totalSlides = slideStats.length;
    const activeSlides = slideStats.filter(s => s.is_active).length;
    const totalViews = slideStats.reduce((sum, s) => sum + (s.view_count || 0), 0);
    const totalClicks = slideStats.reduce((sum, s) => sum + (s.click_count || 0), 0);

    console.log('✅ Analytics globales calculées');
    res.json({ 
      success: true, 
      analytics: {
        campaigns: {
          total: totalCampaigns,
          approved: approvedCampaigns,
          active: activeCampaigns,
          paid: paidCampaigns
        },
        slides: {
          total: totalSlides,
          active: activeSlides,
          totalViews,
          totalClicks,
          ctr: totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0
        },
        recentActivity: analytics.length
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur Gabon 24/7 démarré sur le port ${PORT}`);
  console.log(`📡 API accessible sur: http://localhost:${PORT}`);
  console.log(`🏠 Page d'accueil: http://localhost:${PORT}`);
  console.log(`📊 Santé du service: http://localhost:${PORT}/health`);
  console.log(`📰 Articles récents: http://localhost:${PORT}/api/homepage/articles`);
  console.log(`📚 Articles archivés: http://localhost:${PORT}/api/archives/articles`);
  console.log(`📈 Tendances: http://localhost:${PORT}/api/stats/trending/daily/views`);
  console.log(`🎉 Événements: http://localhost:${PORT}/api/events`);
  console.log(`📢 Slides publicitaires: http://localhost:${PORT}/api/slides`);
  console.log(`📤 Upload d'images: http://localhost:${PORT}/api/admin/upload-image`);
  
  // Initialiser le service RSS avec synchronisation automatique
  console.log('🔄 Service RSS disponible via endpoints manuels et synchronisation automatique');
  rssService = new RSSParserService(supabaseService);
  
  // Activer la synchronisation automatique RSS
  console.log('⏰ Activation de la synchronisation automatique RSS...');
  rssService.startAutoSync(15); // Synchronisation toutes les 15 minutes
});

// ==================== ENDPOINTS D'UPLOAD D'IMAGES ====================

// POST /api/admin/upload-image - Upload d'image vers Supabase Storage
app.post('/api/admin/upload-image', imageUploadService.upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Valider l'image
    const validation = await imageUploadService.validateImage(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Upload vers le dossier public du frontend
    const uploadResult = await imageUploadService.uploadToPublicFolder(
      req.file.path,
      req.file.originalname
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: uploadResult.error || 'Erreur lors de l\'upload'
      });
    }

    res.json({
      success: true,
      message: 'Image uploadée avec succès',
      image_url: uploadResult.url,
      file_name: uploadResult.fileName
    });

  } catch (error) {
    console.error('❌ Erreur upload image:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'upload'
    });
  }
});

// DELETE /api/admin/delete-image - Supprimer une image de Supabase Storage
app.delete('/api/admin/delete-image/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Nom de fichier requis'
      });
    }

    const deleteResult = await imageUploadService.deleteFromSupabase(fileName, 'campaign-images');
    
    if (!deleteResult.success) {
      return res.status(500).json({
        success: false,
        message: deleteResult.error || 'Erreur lors de la suppression'
      });
    }

    res.json({
      success: true,
      message: 'Image supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression image:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
});

// Arrêt gracieux
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt gracieux du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu, arrêt gracieux du serveur...');
  process.exit(0);
});

// Routes pour le tracking des articles
const articleViewsRouter = require('./src/routes/article-views');
app.use('/api/article-views', articleViewsRouter);

// Routes pour l'historique de lecture
const readingHistoryRouter = require('./src/routes/reading-history');
app.use('/api/reading-history', readingHistoryRouter);

// Gestionnaire d'erreur 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint non trouvé'
  });
});

// Gestionnaire d'erreur global
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur'
  });
});

