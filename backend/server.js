const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

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
