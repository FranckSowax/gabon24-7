const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import du service Supabase
const supabaseService = require('./supabase-config');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Parsing du body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue sur l\'API GabonNews WhatsApp SaaS',
    service: 'GabonNews API',
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
    service: 'GabonNews API',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Routes API de base
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API GabonNews opérationnelle',
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
        url: 'https://gabonmediatime.com/feed/',
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

// Route pour les articles
app.get('/api/articles', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        title: 'Actualité gabonaise du jour',
        summary: 'Résumé de l\'actualité gabonaise générée par IA',
        media_name: 'Gabon Media Time',
        category: 'politique',
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1
    }
  });
});

// Route pour récupérer les articles de la page d'accueil
app.get('/api/homepage/articles', async (req, res) => {
  try {
    console.log('🏠 Récupération des articles pour la page d\'accueil...');
    
    // Récupérer les articles réels depuis Supabase
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select(`
        id,
        title,
        summary,
        ai_summary,
        url,
        image_urls,
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
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    // Transformer les données pour le frontend
    const transformedArticles = articles.map(article => ({
      ...article,
      source: article.rss_feeds?.name || 'Source inconnue'
    }));

    console.log(`✅ ${transformedArticles.length} articles réels récupérés depuis la base de données`);
    res.json({
      success: true,
      articles: transformedArticles,
      total: transformedArticles.length
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération articles page d\'accueil:', error);
    
    // Fallback vers articles simulés en cas d'erreur
    console.log('🔄 Utilisation des articles simulés en fallback...');
    const fallbackArticles = [
      {
        id: 1,
        title: 'Nouvelle politique économique du gouvernement gabonais',
        summary: 'Le gouvernement gabonais a annoncé une nouvelle politique économique visant à diversifier l\'économie nationale et réduire la dépendance au pétrole.',
        ai_summary: 'Le gouvernement gabonais lance une stratégie de diversification économique ambitieuse pour réduire la dépendance pétrolière et stimuler la croissance dans de nouveaux secteurs.',
        source: 'Gabon Review',
        category: 'Économie',
        author: 'Rédaction',
        url: 'https://gabonreview.com/article-economie',
        image_urls: ['https://picsum.photos/800/400?random=1'],
        published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        read_time_minutes: 3,
        is_published: true,
        sentiment: 'positif'
      }
    ];
    
    res.json({
      success: true,
      articles: fallbackArticles,
      total: fallbackArticles.length
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

// Gestionnaire d'erreur 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint non trouvé',
    path: req.originalUrl 
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

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur GabonNews démarré sur le port ${PORT}`);
  console.log(`📱 API disponible sur http://localhost:${PORT}`);
  console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Status: http://localhost:${PORT}/api/status`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
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
