// Sentry doit être initialisé AVANT toute autre instrumentation Express.
const sentry = require('./lib/sentry');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabaseService = require('./supabase-config');
const { formatTimeAgo, formatFullDate, getTimeRangeTimestamps } = require('./time-utils');
const cron = require('node-cron');
const redisCache = require('./services/redis-cache.service');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

/**
 * 📰 MAPPING COMPLET DES SOURCES MÉDIAS
 * Basé sur les flux RSS configurés dans l'application
 */
function getMediaNameFromUrl(url, source = '') {
  if (!url) return source || 'Source inconnue';
  
  const urlLower = url.toLowerCase();
  
  // Médias principaux
  if (urlLower.includes('gabonactu.com')) return 'Gabon Actu';
  if (urlLower.includes('agpgabon.ga')) return 'AGP - Agence Gabonaise de Presse';
  if (urlLower.includes('gabonreview.com')) return 'Gabon Review';
  if (urlLower.includes('directinfosgabon.com')) return 'Direct Infos Gabon';
  if (urlLower.includes('gabon-insight.com')) return 'Gabonews';
  if (urlLower.includes('gabonmediatime.com')) return 'Gabon Media Time';
  if (urlLower.includes('gabonmailinfos.com')) return 'Gabon Mail Infos';
  if (urlLower.includes('focusgroupemedia.com')) return 'Focus Groupe Media';
  if (urlLower.includes('insidenews241.com')) return 'Inside News 241';
  if (urlLower.includes('kongossanews.info')) return 'Kongossa News';
  if (urlLower.includes('vxp241.com')) return 'Vox Populi 241';
  
  // Médias L'Union et partenaires
  if (urlLower.includes('lunion.ga') || urlLower.includes('lunion.sonapresse.com')) return 'L\'Union';
  if (urlLower.includes('gaboneco.com')) return 'Gabon Eco';
  if (urlLower.includes('gabonallsport.com')) return 'Gabonallsport';
  if (urlLower.includes('sport241.com')) return 'Sport241';
  
  // Autres médias
  if (urlLower.includes('gaboma.info')) return 'GabomaInfo';
  if (urlLower.includes('gabon-info.com')) return 'Gabon Info';
  if (urlLower.includes('gabonclic.info')) return 'Gabonclic.info';
  if (urlLower.includes('fr.infosgabon.com')) return 'INFOS GABON';
  if (urlLower.includes('depeches241.com')) return 'Groupe Dépêches241';
  if (urlLower.includes('gabon-newsroom.com')) return 'Gabon Newsroom';
  if (urlLower.includes('journaldugabon.com')) return 'Journal du Gabon';
  if (urlLower.includes('mediapostegabon.com')) return 'MEDIAPOSTE GABON';
  if (urlLower.includes('echosdeleco.com')) return 'Les Echos de l\'Eco';
  if (urlLower.includes('lenouveaugabon.com')) return 'Le Nouveau Gabon';
  
  // Médias internationaux
  if (urlLower.includes('rfi.fr')) return 'RFI - Gabon';
  if (urlLower.includes('latribune-afrique.com')) return 'La Tribune Afrique';
  if (urlLower.includes('africaintelligence.fr')) return 'Africa Intelligence';
  
  // Nouveaux médias
  if (urlLower.includes('7joursinfo.com')) return '7 Jours Info';
  if (urlLower.includes('g9infos.com')) return 'G9INFOS';
  if (urlLower.includes('leconfidentiel.net')) return 'Le Confidentiel du Gabon';
  if (urlLower.includes('agenceequateur.com')) return 'Agence Equateur';
  if (urlLower.includes('courrierdesjournalistes.net')) return 'Courrier des Journalistes';
  if (urlLower.includes('letouracovert.com')) return 'Le Touraco Vert';
  if (urlLower.includes('peupleinfos.com')) return 'Peuple Infos';
  if (urlLower.includes('relaisinfosgabon.com')) return 'Relais Infos Gabon';
  if (urlLower.includes('biba241.com')) return 'BIBA 241';
  
  // Facebook Pages
  if (urlLower.includes('facebook.com/tvgabon24')) return 'Gabon 24';
  if (urlLower.includes('facebook.com/communicationgouvga')) return 'Communication Gouvernementale';
  if (urlLower.includes('facebook.com/agriculturegouvga')) return 'Ministère de l\'Agriculture';
  if (urlLower.includes('facebook.com/numeriquegouvga')) return 'Ministère de l\'Economie Numérique';
  if (urlLower.includes('facebook.com/educationgouvga')) return 'Ministère de l\'Education Nationale';
  if (urlLower.includes('facebook.com/esupgouvga')) return 'Ministère de l\'Enseignement Supérieur';
  if (urlLower.includes('facebook.com/ministereindustriegabon')) return 'Ministère de l\'Industrie';
  if (urlLower.includes('facebook.com/interieurgouvga')) return 'Ministère de l\'Intérieur';
  if (urlLower.includes('facebook.com/communicationengouvga')) return 'Ministère de la Communication';
  if (urlLower.includes('facebook.com/justicegouvga')) return 'Ministère de la Justice';
  if (urlLower.includes('facebook.com/minesgouvga')) return 'Ministère des Mines';
  if (urlLower.includes('facebook.com/transportsgouvga')) return 'Ministère des Transports';
  if (urlLower.includes('facebook.com/equipementgouvga')) return 'Ministère des Travaux Publics';
  if (urlLower.includes('facebook.com/commercepmepmigouvga')) return 'Ministère du Commerce';
  if (urlLower.includes('facebook.com/petrolegouvga')) return 'Ministère du Pétrole';
  if (urlLower.includes('facebook.com/tourismegouvga')) return 'Ministère du Tourisme';
  if (urlLower.includes('facebook.com/eaugouvga')) return 'Ministère de l\'Energie';
  if (urlLower.includes('facebook.com/habitatgouvga')) return 'Ministère du Logement';
  if (urlLower.includes('facebook.com') && urlLower.includes('minist')) return 'Ministère du Travail';
  if (urlLower.includes('facebook.com/presidencegouvga')) return 'Présidence de la République';
  
  // Twitter/X
  if (urlLower.includes('x.com/oliguinguema') || urlLower.includes('twitter.com/oliguinguema')) {
    return 'Présidence de la République';
  }
  
  // Site officiel Présidence
  if (urlLower.includes('presence.ga')) return 'Présidence de la République';
  
  // Fallback avec source fournie
  return source || 'Source inconnue';
}

// 💤 Services Lazy Loading
const services = {
  get gameSocketService() { return require('./services/game-socket'); },
  get schedulerService() { return require('./services/scheduler-service'); },
  get RSSParserService() { return require('./rss-parser-service'); },
  
  _rssAggregator: null,
  get rssAggregator() {
    if (!this._rssAggregator) {
      const RSSAggregator = require('./rss-aggregator');
      this._rssAggregator = new RSSAggregator();
    }
    return this._rssAggregator;
  },

  _imageProxy: null,
  get imageProxy() {
    if (!this._imageProxy) {
      const AdvancedImageProxy = require('./advanced-image-proxy');
      this._imageProxy = new AdvancedImageProxy();
      // 🧹 Nettoyer le cache toutes les heures
      setInterval(() => this._imageProxy.cleanupCache(), 60 * 60 * 1000);
    }
    return this._imageProxy;
  }
};

const imageUploadService = require('./src/services/imageUpload.service');
const videoUploadService = require('./src/services/videoUpload.service');
// const rssController = require('./src/controllers/rss.controller');

// Service de génération de projet
let projectFrameworkGenerator;
try {
  projectFrameworkGenerator = require('./services/projectFrameworkGenerator');
} catch (error) {
  console.warn('⚠️ Service projectFrameworkGenerator non disponible:', error.message);
}

require('dotenv').config();

// Import du service Supabase
const { supabase } = supabaseService;

// Import du service RSS
// const RSSParserService = require('./rss-parser-service');

// Import du service d'événements
// const { fetchEvents } = require('./fetch-events');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - nécessaire pour Railway/Heroku/Nginx et express-rate-limit
app.set('trust proxy', 1);

// Fonctions utilitaires
const formatViewCount = (count) => {
  if (count === 0) return '0 vue';
  if (count === 1) return '1 vue';
  if (count < 1000) return `${count} vues`;
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k vues`;
  return `${(count / 1000000).toFixed(1)}M vues`;
};

// Configuration CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8888',
  'https://gaboninsight.com',           // ✅ Domaine principal
  'https://www.gaboninsight.com',       // ✅ Avec www
  'https://gabon24-7.netlify.app',      // Domaine Netlify
  'https://gabon-insight.netlify.app',  // Ancien domaine (compatibilité)
  process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origin (comme les apps mobiles ou curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('netlify.app') || origin.includes('gaboninsight.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma']
};

// CORS doit être AVANT helmet pour que les preflight OPTIONS fonctionnent
// Sentry request handler — doit être en premier dans la chaîne pour tracer toutes les requêtes.
app.use(sentry.requestHandler);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware de sécurité (après CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Compression gzip/brotli des réponses (désactivée pour SSE/streaming)
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    const ct = res.getHeader('Content-Type') || '';
    if (ct.includes('text/event-stream')) return false;
    return compression.filter(req, res);
  },
}));

// Parsing du body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// 🚀 CACHE HEADERS HTTP - Lecture publique
// ============================================
// Helper pour cacher des endpoints publics côté CDN/navigateur
// Usage : router.get('/articles', cacheControl('public', 300), handler)
function cacheControl(scope = 'public', maxAgeSeconds = 60, swr = 600) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.setHeader(
      'Cache-Control',
      `${scope}, max-age=${maxAgeSeconds}, stale-while-revalidate=${swr}`
    );
    next();
  };
}
// Exposer en global léger pour les routes existantes (sans refactor massif)
app.locals.cacheControl = cacheControl;

// ============================================
// 🛡️ RATE LIMITING GRANULAIRE - Protection contre les abus
// ============================================
const {
  generalLimiter,
  aiLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  campaignCreationLimiter,
  searchLimiter,
  publicReadLimiter,
  webhookLimiter
} = require('./middleware/rate-limiter');

const { requireAuth, requireAdmin } = require('./middleware/auth');

// Appliquer les limiteurs par type d'endpoint
app.use('/api/', generalLimiter);                          // Général: 1000/15min
app.use('/api/generate', aiLimiter);                       // IA: 50/15min par user
app.use('/api/analyze', aiLimiter);                        // IA: 50/15min par user
app.use('/api/chat', aiLimiter);                           // IA: 50/15min par user
app.use('/api/project-chat', aiLimiter);                   // IA: 50/15min par user
app.use('/api/action-plans', aiLimiter);                   // IA: génération plans d'action
app.use('/api/opportunities', aiLimiter);                  // IA: analyse d'opportunités
app.use('/api/bceg', aiLimiter);                           // IA: mentor BCEG (chatbot Gemini)
app.use('/api/skill-test', aiLimiter);                     // IA: tests de compétences
app.use('/api/training', aiLimiter);                       // IA: génération de formations
app.use('/api/generate-letter', aiLimiter);               // IA: génération de courriers
app.use('/api/tldr', aiLimiter);                           // IA: résumés TL;DR
app.use('/api/auth', authLimiter);                         // Auth: 10/15min par IP
app.use('/api/payments', paymentLimiter);                  // Paiements: 20/heure par user
app.use('/api/credits-premium', paymentLimiter);           // Paiements: 20/heure par user
app.use('/api/upload', uploadLimiter);                     // Uploads: 30/heure par user
app.use('/api/campaigns/create', campaignCreationLimiter); // Campagnes: 10/jour par user
app.use('/api/search', searchLimiter);                     // Recherche: 200/heure par user
app.use('/api/webhooks', webhookLimiter);                  // Webhooks: 100/minute

console.log('✅ Rate limiting granulaire activé (10 limiteurs configurés)');

// ============================================
// 📊 MONITORING APM - Performance tracking
// ============================================
const monitor = require('./utils/performance-monitor');

// Middleware de tracking des requêtes
app.use(monitor.trackRequest());

console.log('✅ Monitoring APM activé');

// Servir les fichiers statiques du dossier public
app.use(express.static(path.join(__dirname, 'public')));
console.log('✅ Fichiers statiques servis depuis /public');

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

// Route de santé — payload public minimal (status only) pour ne pas leak la version/deployment
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Health détaillé (interne) : exige le header X-Internal-Token configuré côté infra
app.get('/health/detailed', (req, res) => {
  const expected = process.env.INTERNAL_HEALTH_TOKEN;
  if (!expected || req.get('X-Internal-Token') !== expected) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(200).json({
    status: 'OK',
    service: 'Gabon Insight API',
    version: '2.0.0-ai',
    timestamp: new Date().toISOString(),
    redis: redisCache.isAvailable() ? 'connected' : 'disconnected'
  });
});

// Route de vérification de déploiement (Si 404, c'est que le code n'est pas à jour)
// Verrouillée par le même token interne pour éviter le fingerprinting public.
app.get('/api/deployment-check', (req, res) => {
  const expected = process.env.INTERNAL_HEALTH_TOKEN;
  if (!expected || req.get('X-Internal-Token') !== expected) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({ success: true, message: 'New code is running!', time: new Date().toISOString() });
});

// ==================== WHATSAPP ROUTES (PRIORITAIRES) ====================
try {
  console.log('🔄 Tentative chargement routes WhatsApp...');
  const whatsappRoutes = require('./routes/whatsapp');

  // Montage du routeur
  app.use('/api/whatsapp', whatsappRoutes);
  console.log('✅ Routes WhatsApp chargées avec succès sur /api/whatsapp');
} catch (error) {
  console.error('❌ ÉCHEC chargement routes WhatsApp:', error);
  // Fallback pour ne pas 404 complètement
  app.get('/api/whatsapp/status', (req, res) => {
    res.status(500).json({ success: false, error: 'Route loading failed', details: error.message });
  });
}
// ========================================================================

// 📊 Statistiques du cache d'enrichissement IA
app.get('/api/admin/enrichment-stats', requireAdmin, (req, res) => {
  try {
    const smartEnrichmentCache = require('./services/smart-enrichment-cache');
    const stats = smartEnrichmentCache.getStats();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        costPerAIEnrichment: '$0.004',
        model: 'gemini-3-pro-preview',
        cacheStrategy: 'memory + db + local-enrichment'
      },
      optimization: {
        localEnrichmentThreshold: '70% confidence',
        cacheTTL: '24 hours',
        estimatedSavings: stats.estimatedMonthlySavings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import des routes YouTube
const youtubeRoutes = require('./src/routes/youtube');
app.use('/api', youtubeRoutes);

// ==================== ROUTES MODULAIRES ====================
// Import des routes extraites de server.js pour meilleure maintenabilité
const footballRoutes = require('./routes/football');
const pollsRoutes = require('./routes/polls');
const eventsRoutes = require('./routes/events');
const uploadsRoutes = require('./routes/uploads');
const feedbackRoutes = require('./routes/feedback');
const slidesRoutes = require('./routes/slides');
const authRoutes = require('./routes/auth');
// NOTE: whatsappRoutes déjà chargé plus haut (section PRIORITAIRES)

console.log('📦 Chargement des routes modulaires...');

// Enregistrement des routes modulaires (WhatsApp déjà enregistré plus haut)
app.use('/api/auth', authRoutes);
app.use('/api/football', cacheControl('public', 60, 300), footballRoutes);  // Scores: 1min cache
app.use('/api/polls', cacheControl('public', 30, 120), pollsRoutes);        // Sondages: 30s
app.use('/api/events', cacheControl('public', 300, 900), eventsRoutes);     // Événements: 5min
app.use('/api/admin', uploadsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/slides', cacheControl('public', 600, 1800), slidesRoutes);    // Slides: 10min

// Routes Paiements (E-Billing)
const paymentsRoutes = require('./routes/payments');
app.use('/api/payments', paymentsRoutes);

// Routes Credit Premium (Système de crédits premium complet)
const creditsPremiumRoutes = require('./routes/credits-premium');
app.use('/api/credits-premium', creditsPremiumRoutes);

console.log('✅ Routes modulaires chargées: football, polls, events, uploads, feedback, slides, whatsapp');

// Initialiser le planificateur WhatsApp
const { initWhatsAppScheduler } = require('./schedulers/whatsapp-scheduler');
initWhatsAppScheduler();

// ==================== ROUTES MODULAIRES ACTIVES ====================
// NOTE: Les routes suivantes sont ACTIVES dans des fichiers séparés:
// - /api/events → routes/events.js
// - /api/polls → routes/polls.js
// - /api/football → routes/football.js
// - /api/admin/upload-* → routes/uploads.js
// - /api/slides → routes/slides.js (à créer si nécessaire)

// ==================== ROUTES MAPS ====================
app.get('/api/routes', async (req, res) => {
  try {
    console.log('🗺️  Récupération des trajets...');
    // Sélectionner toutes les colonnes disponibles avec fallback gracieux
    const { data: routes, error } = await supabase
      .from('map_routes')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true, nullsFirst: false });

    if (error) {
      // Si erreur de colonne manquante, retourner tableau vide
      if (error.message?.includes('does not exist')) {
        console.warn('⚠️ Table map_routes incomplète, retourne tableau vide');
        return res.json({ success: true, routes: [] });
      }
      throw error;
    }

    res.json({
      success: true,
      routes: routes || []
    });
  } catch (error) {
    console.error('❌ Erreur récupération trajets:', error);
    res.json({ success: false, routes: [], error: error.message });
  }
});

// NOTE: Routes PROJETS migrées vers routes/saved-projects.js
// Alias pour compatibilité avec l'ancienne API /api/save-project (POST vers /)
app.post('/api/save-project', (req, res, next) => {
  // Redirect vers /api/saved-projects avec le body intact
  req.url = '/';
  require('./routes/saved-projects')(req, res, next);
});

// NOTE: Routes CREDITS migrées vers routes/credits.js

// ==================== ROUTES USER HISTORY ====================
app.get('/api/user/history', async (req, res) => {
  try {
    const { userId, page = 1, limit = 20, category, source } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId requis' });
    }

    // Requête principale pour l'historique
    let query = supabase
      .from('user_reading_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('read_at', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('article_category', category);
    }
    if (source && source !== 'all') {
      query = query.eq('article_source', source);
    }

    const { data, error, count } = await query
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Enrichir avec les images des articles (priorité: image stockée dans historique, sinon jointure avec articles)
    let enrichedHistory = data || [];
    if (enrichedHistory.length > 0) {
      // Trouver les articles sans image dans l'historique
      const articlesWithoutImage = enrichedHistory.filter(h => !h.image_url);
      const articleIdsWithoutImage = articlesWithoutImage.map(h => h.article_id).filter(Boolean);

      if (articleIdsWithoutImage.length > 0) {
        const { data: articlesImages } = await supabase
          .from('articles')
          .select('id, image_url')
          .in('id', articleIdsWithoutImage);

        if (articlesImages) {
          // Convertir les IDs UUID en strings pour la comparaison avec article_id (VARCHAR)
          const imageMap = new Map(articlesImages.map(a => [String(a.id), a.image_url]));
          enrichedHistory = enrichedHistory.map(h => ({
            ...h,
            // Priorité: image déjà dans historique, sinon depuis articles
            image_url: h.image_url || imageMap.get(String(h.article_id)) || null
          }));
        }
      }
    }

    // Récupérer TOUTES les données pour les statistiques globales
    const { data: allHistory, error: allError } = await supabase
      .from('user_reading_history')
      .select('article_category, article_source, reading_duration, is_favorite, is_bookmarked, read_at')
      .eq('user_id', userId);

    if (allError) {
      console.error('⚠️ Erreur récupération stats:', allError);
    }

    // Calculer les statistiques complètes
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      totalArticles: allHistory?.length || count || 0,
      total_articles_read: allHistory?.length || count || 0,
      articles_this_week: allHistory?.filter(h => new Date(h.read_at) >= oneWeekAgo).length || 0,
      articles_this_month: allHistory?.filter(h => new Date(h.read_at) >= oneMonthAgo).length || 0,
      favorite_articles: allHistory?.filter(h => h.is_favorite).length || 0,
      bookmarked_articles: allHistory?.filter(h => h.is_bookmarked).length || 0,
      total_reading_time: allHistory?.reduce((sum, item) => sum + (item.reading_duration || 0), 0) || 0,
      categoriesRead: [...new Set(allHistory?.map(item => item.article_category).filter(Boolean))].length,
      sourcesRead: [...new Set(allHistory?.map(item => item.article_source).filter(Boolean))].length,
      most_read_source: getMostFrequent(allHistory?.map(h => h.article_source).filter(Boolean)),
      most_read_category: getMostFrequent(allHistory?.map(h => h.article_category).filter(Boolean))
    };

    console.log(`📊 Historique utilisateur: ${stats.totalArticles} articles, ${stats.favorite_articles} favoris`);

    res.json({
      success: true,
      history: enrichedHistory,
      stats,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / parseInt(limit)),
      hasMore: (offset + parseInt(limit)) < count
    });
  } catch (error) {
    console.error('❌ Erreur historique utilisateur:', error);
    res.json({ success: false, history: [], error: error.message });
  }
});

// Helper pour trouver l'élément le plus fréquent
function getMostFrequent(arr) {
  if (!arr || arr.length === 0) return null;
  const frequency = {};
  let maxFreq = 0;
  let mostFrequent = null;
  arr.forEach(item => {
    frequency[item] = (frequency[item] || 0) + 1;
    if (frequency[item] > maxFreq) {
      maxFreq = frequency[item];
      mostFrequent = item;
    }
  });
  return mostFrequent;
}

// Enregistrer un article dans l'historique de lecture
app.post('/api/reading-history/record', async (req, res) => {
  try {
    const {
      userId,
      articleId,
      articleTitle,
      articleSummary,
      articleUrl,
      articleSource,
      articleCategory,
      articlePublishedAt,
      readingDuration,
      deviceType
    } = req.body;

    if (!userId || !articleId) {
      return res.status(400).json({
        success: false,
        error: 'userId et articleId sont requis'
      });
    }

    // Insérer ou mettre à jour l'historique
    const { data, error } = await supabase
      .from('user_reading_history')
      .upsert({
        user_id: userId,
        article_id: String(articleId),
        article_title: articleTitle ?? null,
        article_summary: articleSummary ?? null,
        article_url: articleUrl ?? null,
        article_source: articleSource ?? null,
        article_category: articleCategory ?? null,
        article_published_at: articlePublishedAt ?? null,
        reading_duration: Number(readingDuration || 0),
        device_type: deviceType || 'web',
        read_at: new Date().toISOString(),
        reading_progress: 100
      }, {
        onConflict: 'user_id,article_id'
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('❌ Erreur enregistrement historique:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    console.log('✅ Article enregistré dans historique:', articleId);
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('❌ Erreur enregistrement historique:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Alias pour rétrocompatibilité
app.get('/api/supabase-articles', (req, res) => {
  // Rediriger vers /api/articles
  req.url = '/api/articles' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '');
  return app._router.handle(req, res, () => {});
});

// (route legacy /api/opportunities/enhance supprimée au profit du router ./routes/opportunities)

// Import des routes Weather
const weatherRoutes = require('./src/routes/weather');
app.use('/api/weather', weatherRoutes);

// Sondages gérés par crons Netlify (generate-daily-poll 18h, poll-publisher 19h, poll-closer 18h55)
console.log('📊 Sondages: gérés par crons Netlify (génération 18h UTC, publication 19h UTC)');

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

// REMOVED: fake /api/auth/login endpoint (security risk - returned tokens for any credentials)
// REMOVED: /api/facebook-proxy endpoint (SSRF risk - allowed arbitrary URL fetching)

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
    // Health check rapide
    if (req.query.health === '1') {
      return res.json({ success: true, ok: true, health: 'ok' });
    }

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 heures
    
    console.log('🏠 Récupération articles Accueil (< 36h)...');
    console.log(`⏰ Maintenant: ${now.toISOString()}`);
    console.log(`⏰ Cutoff (36h): ${cutoffTime.toISOString()}`);
    
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at, image_url, source, url, is_premium, view_count')
      .eq('is_published', true)
      .gte('published_at', cutoffTime.toISOString())
      .order('published_at', { ascending: false })
      .limit(1000); // Augmenté à 1000 pour garantir que tous les articles < 36h sont inclus

    if (error) {
      console.error('❌ Erreur Supabase /home:', error);
      throw error;
    }

    console.log(`📊 Articles bruts trouvés: ${data?.length || 0}`);
    
    // Statistiques avant dédoublonnage (colonne renommée: rss_feed_id → feed_id)
    const rssArticles = data.filter(a => a.feed_id);
    const manualArticles = data.filter(a => !a.feed_id);
    console.log(`  📰 Articles RSS: ${rssArticles.length}`);
    console.log(`  ✍️  Articles manuels: ${manualArticles.length}`);
    
    // Dédoublonnage par normalized_url puis url
    const seenKeysHome = new Set();
    const uniqueHome = [];
    let duplicatesRemoved = 0;
    
    for (const a of data) {
      const key = ((a.normalized_url || a.url || '') + '').trim().toLowerCase();
      if (key && seenKeysHome.has(key)) {
        duplicatesRemoved++;
        console.log(`  🔄 Doublon retiré: ${a.title?.substring(0, 50)}...`);
        continue;
      }
      if (key) seenKeysHome.add(key);
      uniqueHome.push(a);
    }

    console.log(`  ❌ Doublons retirés: ${duplicatesRemoved}`);
    
    // Afficher les 3 articles les plus récents
    if (uniqueHome.length > 0) {
      console.log(`\n📰 Top 3 articles les plus récents:`);
      uniqueHome.slice(0, 3).forEach((a, i) => {
        const age = Math.round((now - new Date(a.published_at)) / (1000 * 60 * 60));
        console.log(`  ${i + 1}. [${age}h] ${a.title?.substring(0, 60)}...`);
      });
    }

    const transformedArticles = uniqueHome.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.content?.substring(0, 200) || '',
      source: getMediaNameFromUrl(article.url, article.source),
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      publishedAt: formatTimeAgo(article.published_at),
      category: article.category,
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at,
      view_count: article.view_count || 0,
      views: article.view_count || 0,
      viewCount: formatViewCount(article.view_count || 0),
      tldr_points: article.tldr_points || null  // TL;DR pré-généré
    }));

    console.log(`✅ ${transformedArticles.length} articles uniques envoyés au frontend\n`);
    
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
    // Health check rapide
    if (req.query.health === '1') {
      return res.json({ success: true, ok: true, health: 'ok' });
    }

    const now = new Date();
    const startWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 jours
    const endRecent = new Date(now.getTime() - 36 * 60 * 60 * 1000); // 36 heures
    
    console.log('📅 Récupération articles Cette Semaine (36h - 7j)...');
    
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at, image_url, source, url, is_premium, view_count')
      .eq('is_published', true)
      .gte('published_at', startWeek.toISOString())
      .lte('published_at', endRecent.toISOString())
      .order('published_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('❌ Erreur Supabase /week:', error);
      throw error;
    }
    // Dédoublonnage par normalized_url puis url
    const seenKeysWeek = new Set();
    const uniqueWeek = [];
    for (const a of data) {
      const key = ((a.normalized_url || a.url || '') + '').trim().toLowerCase();
      if (key && seenKeysWeek.has(key)) continue;
      if (key) seenKeysWeek.add(key);
      uniqueWeek.push(a);
    }

    const transformedArticles = uniqueWeek.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.content?.substring(0, 200) || '',
      source: getMediaNameFromUrl(article.url, article.source),
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      publishedAt: formatTimeAgo(article.published_at),
      category: article.category,
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at,
      view_count: article.view_count || 0,
      views: article.view_count || 0,
      viewCount: formatViewCount(article.view_count || 0),
      tldr_points: article.tldr_points || null  // TL;DR pré-généré
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

// Route pour les articles TENDANCE (par vues sur une période)
app.get("/api/articles/trending", async (req, res) => {
  try {
    // Health check rapide
    if (req.query.health === '1') {
      return res.json({ success: true, ok: true, health: 'ok' });
    }

    const period = req.query.period === "week" ? "week" : "day";
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    // Cache Redis - 5 minutes pour trending
    const cacheKey = `articles:trending:${period}:${limit}`;
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    const now = new Date();
    const start = new Date(now);
    if (period === "day") start.setDate(now.getDate() - 1);
    else start.setDate(now.getDate() - 7);

    console.log(`🔥 Récupération articles tendance (${period}) depuis ${start.toISOString()} ...`);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at, image_url, source, url, is_premium, view_count')
      .eq('is_published', true)
      .gte('published_at', start.toISOString())
      .order("view_count", { ascending: false, nullsLast: true })
      .limit(limit);

    if (error) throw error;

    const { data: feeds } = await supabase.from("rss_feeds").select("*");
    
    const mapArticleToFeed = (article, feedsList) => {
      // Priorité 1: Source déjà présente dans l'article
      if (article.source && article.source.trim() !== '') {
        return article.source;
      }
      // Priorité 2: Lookup via feed_id
      if (article.feed_id && feedsList) {
        const f = feedsList.find(feed => feed.id === article.feed_id);
        if (f) return f.name;
      }
      // Priorité 3: Déduction depuis l'URL
      const url = article.url || "";
      if (url.includes("agpgabon")) return "AGP";
      if (url.includes("lunion")) return "L'Union";
      if (url.includes("gabon-insight")) return "Gabonews";
      if (url.includes("gabonactu")) return "Gabon Actu";
      if (url.includes("gabonmediatime")) return "Gabon Media Time";
      if (url.includes("facebook.com")) return "Facebook";
      if (url.includes("7joursinfo")) return "7 Jours Info";
      if (url.includes("directinfosgabon")) return "Direct Infos Gabon";
      if (url.includes("biba241")) return "Biba 241";
      if (url.includes("sport241")) return "Sport 241";
      if (url.includes("gabonnewsroom")) return "Gabon Newsroom";
      // Fallback: extraire le domaine
      try {
        const hostname = new URL(url).hostname.replace('www.', '');
        return hostname || "Source inconnue";
      } catch {
        return "Source inconnue";
      }
    };

    const transformed = (articles || []).map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.content?.substring(0, 200) || "Résumé non disponible",
      source: mapArticleToFeed(article, feeds),
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      url: article.url,
      category: article.category,
      created_at: article.created_at,
      published_at: article.published_at,
      view_count: article.view_count || 0,
      viewCount: article.view_count ? `${article.view_count} vues` : "0 vues",
      is_trending: true,
      tldr_points: article.tldr_points || null  // TL;DR pré-généré
    }));

    console.log(`✅ ${transformed.length} articles tendance (${period})`);

    const response = { success: true, articles: transformed, period };

    // Mettre en cache Redis - 5 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 300);
    }

    res.json(response);
  } catch (err) {
    console.error("❌ Erreur articles tendance:", err);
    res.json({ success: false, articles: [], error: err.message });
  }
});

// Route pour les articles ARCHIVES (> 7 jours - tous les anciens articles avec pagination et filtres)
app.get('/api/articles/archives', async (req, res) => {
  try {
    const now = new Date();
    const archiveCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 jours
    
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;

    // Filtres
    const searchQuery = req.query.q ? String(req.query.q).trim() : '';
    const sourceFilter = req.query.source ? String(req.query.source) : '';
    const categoryFilter = req.query.category ? String(req.query.category) : '';
    const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : '';
    const dateTo = req.query.dateTo ? String(req.query.dateTo) : '';
    const datePreset = req.query.datePreset ? String(req.query.datePreset) : '';

    console.log(`📅 Récupération articles Archives (> 7j) - Page ${page}...`);
    console.log(`⏰ Cutoff (7j): ${archiveCutoff.toISOString()}`);
    if (searchQuery) console.log(`🔍 Recherche: "${searchQuery}"`);
    if (sourceFilter) console.log(`📰 Source: "${sourceFilter}"`);
    if (categoryFilter) console.log(`🏷️ Catégorie: "${categoryFilter}"`);
    if (dateFrom || dateTo) console.log(`📆 Dates: ${dateFrom || '...'} → ${dateTo || '...'}`);
    if (datePreset) console.log(`📆 Preset: ${datePreset}`);

    // Calculer dateFrom/dateTo depuis le preset si fourni
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;
    if (datePreset && datePreset !== 'all' && datePreset !== 'custom') {
      const presetMap = {
        'week': 7,
        'month': 30,
        '3months': 90,
        '6months': 180,
        'year': 365
      };
      const days = presetMap[datePreset];
      if (days) {
        effectiveDateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
      }
    }

    // Construire la requête de base
    let countQuery = supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
      .or(`published_at.lt.${archiveCutoff.toISOString()},published_at.is.null`);

    let dataQuery = supabase
      .from('articles')
      .select('*')
      .eq('is_published', true)
      .or(`published_at.lt.${archiveCutoff.toISOString()},published_at.is.null`);

    // Appliquer les filtres
    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      countQuery = countQuery.or(`title.ilike.${searchPattern},summary.ilike.${searchPattern},content.ilike.${searchPattern}`);
      dataQuery = dataQuery.or(`title.ilike.${searchPattern},summary.ilike.${searchPattern},content.ilike.${searchPattern}`);
    }

    if (categoryFilter) {
      countQuery = countQuery.ilike('category', `%${categoryFilter}%`);
      dataQuery = dataQuery.ilike('category', `%${categoryFilter}%`);
    }

    if (sourceFilter) {
      countQuery = countQuery.ilike('source', `%${sourceFilter}%`);
      dataQuery = dataQuery.ilike('source', `%${sourceFilter}%`);
    }

    // Filtres de date
    if (effectiveDateFrom) {
      countQuery = countQuery.gte('published_at', effectiveDateFrom);
      dataQuery = dataQuery.gte('published_at', effectiveDateFrom);
    }
    if (effectiveDateTo) {
      // Ajouter 23:59:59 si c'est une date sans heure (YYYY-MM-DD)
      const toDate = effectiveDateTo.length === 10 ? effectiveDateTo + 'T23:59:59.999Z' : effectiveDateTo;
      countQuery = countQuery.lte('published_at', toDate);
      dataQuery = dataQuery.lte('published_at', toDate);
    }

    // Compter le total d'articles (avec filtres)
    const { count: totalCount } = await countQuery;

    // Récupérer les articles de la page (avec filtres)
    const { data, error} = await dataQuery
      .order('published_at', { ascending: false, nullsLast: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('❌ Erreur Supabase /archives:', error);
      throw error;
    }

    console.log(`📊 Articles archives bruts trouvés: ${data?.length || 0} / ${totalCount || 0} total`);

    // Pas de dédoublonnage : Supabase n'a pas de doublons (vérifié)
    const transformedArticles = data.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.content?.substring(0, 200) || '',
      source: getMediaNameFromUrl(article.url, article.source),
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      publishedAt: article.published_at ? formatTimeAgo(article.published_at) : 'Date inconnue',
      category: article.category,
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at || article.created_at,
      view_count: article.view_count || 0,
      views: article.view_count || 0,
      viewCount: formatViewCount(article.view_count || 0),
      tldr_points: article.tldr_points || null  // TL;DR pré-généré
    }));

    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasMore = page < totalPages;

    console.log(`✅ ${transformedArticles.length} articles d'archives uniques envoyés (Page ${page}/${totalPages})`);

    res.json({
      success: true,
      articles: transformedArticles,
      filter: 'archives',
      timeRange: '> 7j',
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages,
        hasMore
      }
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
    const limitParam = parseInt(req.query.limit);
    const safeLimit = Math.min(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50, 200);

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at, image_url, source, url, is_premium, view_count')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(safeLimit);

    if (error) throw error;

    const transformedArticles = data.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summary || article.content?.substring(0, 200) || '',
      image_url: article.image_url || null,
      imageUrl: article.image_url || null,
      publishedAt: formatTimeAgo(article.published_at),
      category: article.category,
      readTime: `${article.read_time_minutes || 3} min`,
      trending: article.is_trending || false,
      author: article.author || 'Rédaction',
      source: article.source || 'Source inconnue',
      url: article.url,
      created_at: article.created_at,
      published_at: article.published_at,
      tldr_points: article.tldr_points || null  // TL;DR pré-généré
    }));

    res.json({
      success: true,
      articles: transformedArticles,
      pagination: {
        page: 1,
        limit: safeLimit,
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

// Route pour récupérer un article par son ID (utilisé pour le deep-linking WhatsApp)
app.get('/api/articles/:id', async (req, res, next) => {
  // Ne pas capturer les routes nommées (all, check-updates, etc.)
  const { id } = req.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return next();
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at, image_url, source, url, is_premium, view_count')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Article non trouvé' });
    }

    const article = {
      id: data.id,
      title: data.title,
      summary: data.summary || '',
      image_url: data.image_url || null,
      imageUrl: data.image_url || null,
      publishedAt: formatTimeAgo(data.published_at),
      category: data.category,
      source: data.source || 'Source inconnue',
      url: data.url,
      published_at: data.published_at
    };

    res.json({ success: true, article });
  } catch (error) {
    console.error('Erreur récupération article par ID:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Route pour trouver des articles similaires avec IA (matching STRICT)
app.post('/api/articles/similar', async (req, res) => {
  try {
    const { projectTitle, projectDescription, sector, problematique, excludeUrl } = req.body;

    if (!projectTitle && !projectDescription && !sector) {
      return res.status(400).json({
        success: false,
        error: 'Au moins un critère de recherche est requis'
      });
    }

    console.log('🔍 Recherche articles similaires STRICT avec IA pour:', { projectTitle, sector });

    // 1. Récupérer les articles récents
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at, source, url')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    if (!articles || articles.length === 0) {
      return res.json({ success: true, articles: [] });
    }

    // Exclure l'article source si fourni
    const filteredArticles = excludeUrl
      ? articles.filter(a => a.url !== excludeUrl)
      : articles;

    // 2. Préparer le contexte pour l'IA
    const articlesList = filteredArticles.map((a, i) =>
      `[${i}] "${a.title}" - ${a.summary?.substring(0, 150) || 'Pas de résumé'}`
    ).join('\n');

    const prompt = `Tu es un expert STRICT en analyse de pertinence de contenu.

PROJET BUSINESS À ANALYSER:
- Titre: ${projectTitle || 'Non spécifié'}
- Description: ${projectDescription?.substring(0, 300) || 'Non spécifiée'}
- Secteur: ${sector || 'Non spécifié'}
- Problématique: ${problematique?.substring(0, 300) || 'Non spécifiée'}

ARTICLES DISPONIBLES:
${articlesList}

MISSION: Identifie UNIQUEMENT les articles qui ont un lien DIRECT et ÉVIDENT avec ce projet.

⚠️ RÈGLES STRICTES DE PERTINENCE:
1. L'article DOIT traiter du MÊME SECTEUR D'ACTIVITÉ EXACT (pas juste économie générale)
2. L'article DOIT mentionner des éléments directement liés au projet (acteurs, zone géographique spécifique, problématique identique)
3. Les articles généraux sur l'économie, la politique ou l'Afrique NE SONT PAS pertinents sauf s'ils concernent DIRECTEMENT le secteur du projet
4. Si un article ne mentionne pas clairement le secteur ou la problématique du projet, il N'EST PAS pertinent

IMPORTANT:
- Retourne un tableau VIDE si aucun article n'est vraiment pertinent
- Il vaut mieux ne rien retourner que de suggérer des articles sans lien réel
- Chaque article sélectionné DOIT avoir un score de confiance >= 70/100

Réponds UNIQUEMENT avec un JSON:
{
  "similar_articles": [
    {"index": 0, "confidence": 85, "reason": "Traite exactement du secteur agricole au Gabon mentionné dans le projet"},
    {"index": 5, "confidence": 72, "reason": "Concerne la même zone économique spéciale citée dans le projet"}
  ]
}

Si AUCUN article n'atteint le seuil de pertinence de 70%, retourne:
{
  "similar_articles": []
}`;

    // 3. Appeler l'IA
    const geminiService = require('./services/gemini-service');
    const aiResult = await geminiService.generateJSON(prompt, {
      systemPrompt: 'Tu es un expert en analyse sémantique STRICT. Tu ne retournes que des articles ayant un lien DIRECT avec le projet. En cas de doute, tu ne retournes rien. Réponds uniquement en JSON valide.',
      temperature: 0.2 // Plus bas = plus strict
    });

    // 4. Extraire les articles avec filtrage par score de confiance
    const similarResults = aiResult?.similar_articles || [];
    const MIN_CONFIDENCE = 70; // Score minimum de confiance

    const similarArticles = similarResults
      .filter(item => item.confidence >= MIN_CONFIDENCE && item.index >= 0 && item.index < filteredArticles.length)
      .slice(0, 5)
      .map(item => ({
        ...filteredArticles[item.index],
        relevance_reason: item.reason || 'Article pertinent',
        confidence_score: item.confidence
      }));

    console.log(`✅ Trouvé ${similarArticles.length} articles vraiment similaires via IA (sur ${similarResults.length} candidats)`);

    res.json({
      success: true,
      articles: similarArticles,
      method: 'ai'
    });

  } catch (error) {
    console.error('❌ Erreur recherche articles similaires:', error);

    // Fallback: recherche basique STRICTE par mots-clés
    try {
      const { projectTitle, sector, problematique, excludeUrl } = req.body;

      // Extraire les mots-clés importants (minimum 5 caractères pour être significatif)
      const extractKeywords = (text) => {
        if (!text) return [];
        const stopWords = ['avec', 'dans', 'pour', 'cette', 'celui', 'celle', 'leurs', 'notre', 'votre', 'entre', 'aussi', 'comme', 'après', 'avant', 'faire', 'projet', 'business', 'entreprise', 'activité', 'développement', 'gabon', 'afrique'];
        return text
          .toLowerCase()
          .replace(/[^\wàâäéèêëïîôùûüç\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length >= 5 && !stopWords.includes(word));
      };

      const titleKeywords = extractKeywords(projectTitle);
      const sectorKeywords = extractKeywords(sector);
      const problemKeywords = extractKeywords(problematique);

      // Combiner et dédupliquer
      const allKeywords = [...new Set([...titleKeywords, ...sectorKeywords, ...problemKeywords])];

      if (allKeywords.length === 0) {
        return res.json({ success: true, articles: [], method: 'fallback' });
      }

      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, summary, category, published_at, source, url')
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(50);

      // Calculer un score de pertinence pour chaque article
      const scoredArticles = (articles || [])
        .filter(a => a.url !== excludeUrl)
        .map(a => {
          const content = `${a.title} ${a.summary || ''}`.toLowerCase();
          let score = 0;
          let matchedKeywords = [];

          allKeywords.forEach(keyword => {
            if (content.includes(keyword)) {
              score += keyword.length; // Plus le mot est long, plus il est significatif
              matchedKeywords.push(keyword);
            }
          });

          return { ...a, score, matchedKeywords };
        })
        .filter(a => a.score >= 15 && a.matchedKeywords.length >= 2) // Minimum 2 mots-clés et score >= 15
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(a => ({
          id: a.id,
          title: a.title,
          summary: a.summary,
          category: a.category,
          published_at: a.published_at,
          source: a.source,
          url: a.url,
          relevance_reason: `Mots-clés: ${a.matchedKeywords.slice(0, 3).join(', ')}`
        }));

      res.json({
        success: true,
        articles: scoredArticles,
        method: 'fallback'
      });
    } catch (fallbackError) {
      res.json({
        success: true,
        articles: [],
        error: 'Recherche temporairement indisponible'
      });
    }
  }
});

// Route pour archiver un article
app.patch('/api/articles/:id/archive', requireAdmin, async (req, res) => {
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
app.delete('/api/articles/:id', requireAdmin, async (req, res) => {
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
        summary_ai,
        url,
        normalized_url,
        image_urls,
        author,
        published_at,
        created_at,
        read_time_minutes,
        view_count,
        is_published,
        sentiment,
        category
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
      const sourceA = getMediaNameFromUrl(article.url, article.source);
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

    // Dédoublonnage par normalized_url puis url
    const seenKeysArch = new Set();
    const uniqueArch = [];
    for (const a of validArticles) {
      const key = ((a.normalized_url || a.url || '') + '').trim().toLowerCase();
      if (key && seenKeysArch.has(key)) continue;
      if (key) seenKeysArch.add(key);
      uniqueArch.push(a);
    }

    const sortedArticles = uniqueArch.sort((a, b) => {
      const sourceA = getMediaNameFromUrl(a.url, a.source);
      const sourceB = getMediaNameFromUrl(b.url, b.source);

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
        imageUrl: article.image_url || null,
      image_url: article.image_url || null,
        source: getMediaNameFromUrl(article.url, article.source),
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
        summary_ai,
        url,
        image_urls,
        author,
        published_at,
        created_at,
        read_time_minutes,
        view_count,
        is_published,
        sentiment,
        category
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
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      source: getMediaNameFromUrl(article.url, article.source),
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
  try {
    // Cache Redis - 3 minutes pour homepage
    const cacheKey = 'articles:homepage';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('🏠 Récupération des articles AUJOURD\'HUI (0-36h)...');

    // Calculer les timestamps pour 0-36h
    const now = new Date();
    const thirtySixHoursAgo = new Date(now.getTime() - 36 * 60 * 60 * 1000);

    console.log(`📅 Période: ${thirtySixHoursAgo.toISOString()} → ${now.toISOString()}`);

    // Récupérer les articles des dernières 36h avec jointure RSS feeds
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary, category, published_at, image_url, source, url, is_premium, view_count')
      .eq('is_published', true)
      .gte('published_at', thirtySixHoursAgo.toISOString())
      .lte('published_at', now.toISOString())
      .order('published_at', { ascending: false })
      .limit(500);
      
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

    // Dédoublonnage par normalized_url puis url (ordre conservé)
    const seenKeysHomepage = new Set();
    const uniqueHomepage = [];
    for (const a of articles) {
      const key = ((a.normalized_url || a.url || '') + '').trim().toLowerCase();
      if (key && seenKeysHomepage.has(key)) continue;
      if (key) seenKeysHomepage.add(key);
      uniqueHomepage.push(a);
    }

    // Transformer les données avec jointure rss_feeds + fallback URL
    // Le tri est déjà fait par Supabase avec ORDER BY published_at DESC
    const transformedArticles = uniqueHomepage.map(article => {
      // Triple fallback: 1) jointure SQL, 2) mapping URL, 3) champ source
      const mediaName = article.rss_feeds?.media_name 
        || getMediaNameFromUrl(article.url, article.source);
      
      return {
        id: article.id,
        title: article.title,
        summary: article.summary || article.content?.substring(0, 200) || 'Résumé non disponible',
        source: mediaName,
        imageUrl: article.image_url || null,
      image_url: article.image_url || null,
        publishedAt: formatTimeAgo(article.published_at),
        category: article.category,
        author: article.author || 'Rédaction',
        viewCount: article.view_count ? `${article.view_count} vues` : '0 vues',
        view_count: article.view_count || 0,
        published_at: article.published_at,
        created_at: article.created_at,
        url: article.url,
        trending: article.is_trending || false,
        isGovernment: mediaName.includes('Ministère') || mediaName.includes('Présidence') || mediaName.includes('Gouvernement')
      };
    });

    // Pas de tri supplémentaire - on garde l'ordre de Supabase (ORDER BY published_at DESC)
    console.log(`✅ ${transformedArticles.length} articles transformés (triés par Supabase)`);
    
    // Log des 5 premiers articles pour vérifier l'ordre
    if (transformedArticles.length > 0) {
      console.log('📅 Top 5 articles (ordre Supabase published_at DESC):');
      transformedArticles.slice(0, 5).forEach((article, index) => {
        const pubDate = new Date(article.published_at);
        console.log(`  ${index + 1}. [${pubDate.toISOString()}] ${article.publishedAt} - ${article.title?.substring(0, 40)}...`);
      });
    }
    
    const response = {
      success: true,
      articles: transformedArticles,
      total: transformedArticles.length
    };

    // Mettre en cache Redis - 30 secondes (fraîcheur des articles)
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 30);
    }

    res.json(response);

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
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
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
app.get('/api/admin/rss-feeds', requireAdmin, async (req, res) => {
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
app.post('/api/admin/rss-feeds', requireAdmin, async (req, res) => {
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
app.delete('/api/articles/feed/:feedId', requireAdmin, async (req, res) => {
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
app.put('/api/admin/rss-feeds/:id', requireAdmin, async (req, res) => {
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

// Endpoint pour activer/désactiver un flux RSS (toggle status)
app.patch('/api/admin/rss-feeds/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: feed, error: fetchErr } = await supabaseService.supabase
      .from('rss_feeds')
      .select('status')
      .eq('id', id)
      .single();
    if (fetchErr || !feed) {
      return res.status(404).json({ success: false, error: 'Flux RSS non trouvé' });
    }
    const newStatus = feed.status === 'active' ? 'inactive' : 'active';
    const { data, error } = await supabaseService.supabase
      .from('rss_feeds')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, feed: data, message: `Flux ${newStatus === 'active' ? 'activé' : 'désactivé'}` });
  } catch (error) {
    console.error('❌ Erreur toggle flux RSS:', error);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour supprimer un flux RSS (et optionnellement ses articles)
app.delete('/api/admin/rss-feeds/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteArticles } = req.query; // ?deleteArticles=true pour cascade
    console.log(`🗑️ Suppression flux RSS: ${id} (cascade=${!!deleteArticles})`);

    if (deleteArticles === 'true') {
      const { error: articlesErr } = await supabaseService.supabase
        .from('articles')
        .delete()
        .eq('feed_id', id);
      if (articlesErr) {
        console.warn('⚠️ Erreur suppression articles liés:', articlesErr.message);
      }
    }

    const { error } = await supabaseService.supabase
      .from('rss_feeds')
      .delete()
      .eq('id', id);
    if (error) throw error;

    res.json({ success: true, message: 'Flux RSS supprimé' });
  } catch (error) {
    console.error('❌ Erreur suppression flux RSS:', error);
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
  }
});

// Endpoint pour synchroniser manuellement tous les flux RSS
app.post('/api/admin/rss-feeds/sync-all', requireAdmin, async (req, res) => {
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
app.post('/api/admin/rss-feeds/:id/test', requireAdmin, async (req, res) => {
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
app.delete('/api/articles/test-feed', requireAdmin, async (req, res) => {
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
    // Cache Redis - 15 minutes pour stats trending
    const cacheKey = 'stats:trending:daily:views';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des articles les plus vus du jour...');

    // Récupérer tous les articles récents (dernières 24h) pour les tendances
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 24h en arrière

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, summary_ai, category, published_at, image_url, image_urls, source, url, is_premium, view_count, share_count, author')
      .eq('is_published', true)
      .gte('published_at', yesterday.toISOString())
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances vues:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary_ai || article.summary || 'Résumé non disponible.',
      url: article.url,
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      view_count: article.view_count || 0,
      share_count: article.share_count || 0,
      category: article.category,
      source: getMediaNameFromUrl(article.url, article.source),
      viewCount: formatViewCount(article.view_count || 0),
      publishedAt: formatTimeAgo(article.published_at),
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances vues (daily) récupérés`);

    const response = {
      success: true,
      articles: transformedArticles,
      period: 'daily',
      metric: 'views',
      count: transformedArticles.length
    };

    // Mettre en cache Redis - 15 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 900);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur endpoint tendances vues quotidiennes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tendances',
      articles: []
    });
  }
});

// Endpoint pour les articles les plus vus de la semaine
app.get('/api/stats/trending/weekly/views', async (req, res) => {
  try {
    // Cache Redis - 30 minutes pour weekly
    const cacheKey = 'stats:trending:weekly:views';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des articles les plus vus de la semaine...');

    const now = new Date();
    const lastWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 jours en arrière

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, summary_ai, category, published_at, image_url, image_urls, source, url, is_premium, view_count, share_count, author')
      .eq('is_published', true)
      .gte('published_at', lastWeek.toISOString())
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances vues semaine:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary_ai || article.summary || 'Résumé non disponible.',
      url: article.url,
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      view_count: article.view_count || 0,
      share_count: article.share_count || 0,
      category: article.category,
      source: getMediaNameFromUrl(article.url, article.source),
      viewCount: formatViewCount(article.view_count || 0),
      publishedAt: formatTimeAgo(article.published_at),
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances vues (weekly) récupérés`);

    const response = {
      success: true,
      articles: transformedArticles,
      period: 'weekly',
      metric: 'views',
      count: transformedArticles.length
    };

    // Mettre en cache Redis - 30 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 1800);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur endpoint tendances vues semaine:', error);
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
    // Cache Redis - 1 heure pour monthly
    const cacheKey = 'stats:trending:monthly:views';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des articles les plus vus du mois...');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, summary_ai, category, published_at, image_url, image_urls, source, url, is_premium, view_count, share_count, author')
      .eq('is_published', true)
      .gte('published_at', startOfMonth.toISOString())
      .order('view_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances vues mensuelles:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary_ai || article.summary || 'Résumé non disponible.',
      url: article.url,
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      view_count: article.view_count || 0,
      share_count: article.share_count || 0,
      category: article.category,
      source: getMediaNameFromUrl(article.url, article.source),
      viewCount: formatViewCount(article.view_count || 0),
      publishedAt: formatTimeAgo(article.published_at),
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances vues (monthly) récupérés`);

    const response = {
      success: true,
      articles: transformedArticles,
      period: 'monthly',
      metric: 'views',
      count: transformedArticles.length
    };

    // Mettre en cache Redis - 1 heure
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 3600);
    }

    res.json(response);

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
    // Cache Redis - 15 minutes
    const cacheKey = 'stats:trending:daily:shares';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des articles les plus partagés du jour...');

    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, summary_ai, category, published_at, image_url, image_urls, source, url, view_count, share_count, author')
      .eq('is_published', true)
      .gte('published_at', yesterday.toISOString())
      .order('share_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances partages:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary_ai || article.summary || 'Résumé non disponible.',
      url: article.url,
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      publishedAt: formatTimeAgo(article.published_at),
      view_count: article.view_count || 0,
      viewCount: formatViewCount(article.view_count || 0),
      share_count: article.share_count || 0,
      shareCount: formatViewCount(article.share_count || 0),
      category: article.category,
      source: getMediaNameFromUrl(article.url, article.source),
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances partages (daily) récupérés`);

    const response = {
      success: true,
      articles: transformedArticles,
      period: 'daily',
      metric: 'shares',
      count: transformedArticles.length
    };

    // Mettre en cache Redis - 15 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 900);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur endpoint tendances partages quotidiens:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des tendances',
      articles: []
    });
  }
});

// Endpoint pour les articles les plus partagés de la semaine
app.get('/api/stats/trending/weekly/shares', async (req, res) => {
  try {
    // Cache Redis - 30 minutes
    const cacheKey = 'stats:trending:weekly:shares';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des articles les plus partagés de la semaine...');

    const now = new Date();
    const lastWeek = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, summary_ai, category, published_at, image_url, image_urls, source, url, view_count, share_count, author')
      .eq('is_published', true)
      .gte('published_at', lastWeek.toISOString())
      .order('share_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances partages semaine:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary_ai || article.summary || 'Résumé non disponible.',
      url: article.url,
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      publishedAt: formatTimeAgo(article.published_at),
      view_count: article.view_count || 0,
      viewCount: formatViewCount(article.view_count || 0),
      share_count: article.share_count || 0,
      shareCount: formatViewCount(article.share_count || 0),
      category: article.category,
      source: getMediaNameFromUrl(article.url, article.source),
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances partages (weekly) récupérés`);

    const response = {
      success: true,
      articles: transformedArticles,
      period: 'weekly',
      metric: 'shares',
      count: transformedArticles.length
    };

    // Mettre en cache Redis - 30 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 1800);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur endpoint tendances partages semaine:', error);
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
    // Cache Redis - 1 heure
    const cacheKey = 'stats:trending:monthly:shares';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération des articles les plus partagés du mois...');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, summary, summary_ai, category, published_at, image_url, image_urls, source, url, view_count, share_count, author')
      .eq('is_published', true)
      .gte('published_at', startOfMonth.toISOString())
      .order('share_count', { ascending: false, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Erreur récupération articles tendances partages mensuels:', error);
      throw error;
    }

    const transformedArticles = (articles || []).map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary_ai || article.summary || 'Résumé non disponible.',
      url: article.url,
      imageUrl: article.image_url || null,
      image_url: article.image_url || null,
      author: article.author || 'Rédaction',
      published_at: article.published_at,
      publishedAt: formatTimeAgo(article.published_at),
      view_count: article.view_count || 0,
      viewCount: formatViewCount(article.view_count || 0),
      share_count: article.share_count || 0,
      shareCount: formatViewCount(article.share_count || 0),
      category: article.category,
      source: getMediaNameFromUrl(article.url, article.source),
      trending: true
    }));

    console.log(`✅ ${transformedArticles.length} articles tendances partages (monthly) récupérés`);

    const response = {
      success: true,
      articles: transformedArticles,
      period: 'monthly',
      metric: 'shares',
      count: transformedArticles.length
    };

    // Mettre en cache Redis - 1 heure
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 3600);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur endpoint tendances partages mensuels:', error);
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
    // Cache Redis - 1 heure pour events
    const cacheKey = 'events:list';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('🎉 Récupération des événements à venir...');

    const now = new Date();

    // Récupérer les 5 événements les plus récents
    const { data: events, error } = await supabaseService.supabase
      .from('events')
      .select('id, title, description, published_at, location, url, image_url, category, organizer')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Erreur Supabase events:', error);
      throw error;
    }

    // Transformer les données pour le frontend
    const transformedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      published_at: event.published_at || event.event_date,  // Support ancien et nouveau format
      location: event.location || 'Libreville, Gabon',
      url: event.url,
      image_url: event.image_url,
      category: event.category || 'Événement',
      organizer: event.organizer || event.source || 'Eventime.ga',
      formattedDate: (event.published_at || event.event_date) ? new Date(event.published_at || event.event_date).toLocaleDateString('fr-FR', {
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

    const response = {
      success: true,
      events: transformedEvents,
      total: transformedEvents.length
    };

    // Mettre en cache Redis - 1 heure
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 3600);
    }

    res.json(response);

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
    console.log('🔄 Synchronisation manuelle des événements depuis RSS...');
    const { extractEventsFromRSS } = require('./events-rss-extractor');
    const result = await extractEventsFromRSS();
    res.json({ 
      success: result.success, 
      message: 'Synchronisation des événements terminée',
      ...result
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
    // Cache Redis - 30 minutes pour slides
    const cacheKey = 'slides:active';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📢 Récupération des slides publicitaires actifs...');

    const now = new Date();

    // Récupérer les slides actifs et approuvés avec leurs campagnes
    const { data: slides, error } = await supabaseService.supabase
      .from('promotional_slides')
      .select(`
        *,
        campaigns!inner (
          company_name,
          is_active,
          admin_approved,
          payment_status,
          start_date,
          end_date
        )
      `)
      .eq('is_active', true)
      .eq('campaigns.is_active', true)
      .eq('campaigns.admin_approved', true)
      .eq('campaigns.payment_status', 'paid')
      .lte('campaigns.start_date', now.toISOString())
      .gte('campaigns.end_date', now.toISOString())
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
      companyName: slide.campaigns.company_name,
      displayOrder: slide.display_order
    }));

    console.log(`✅ ${transformedSlides.length} slides publicitaires trouvés`);

    const response = {
      success: true,
      slides: transformedSlides,
      total: transformedSlides.length
    };

    // Mettre en cache Redis - 30 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 1800);
    }

    res.json(response);

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
    
    const { data: packages, error } = await supabase
      .from('credit_packages')
      .select('id, name, description, credits, bonus_credits, price_fcfa, is_active, display_order')
      .eq('is_active', true)
      .order('credits', { ascending: true });

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
app.post('/api/campaigns', requireAuth, async (req, res) => {
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
      .from('campaigns')
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
app.get('/api/admin/campaigns', requireAdmin, async (req, res) => {
  try {
    console.log('📋 Admin: Récupération des campagnes...');

    const { data: campaigns, error } = await supabaseService.supabase
      .from('campaigns')
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
      .from('campaigns')
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
app.post('/api/admin/campaigns/:id/approve', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    
    const { data, error } = await supabaseService.supabase
      .from('campaigns')
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
app.post('/api/admin/campaigns/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;
    
    const { data, error } = await supabaseService.supabase
      .from('campaigns')
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
app.post('/api/admin/campaigns/:id/activate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabaseService.supabase
      .from('campaigns')
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
app.post('/api/admin/campaigns/:id/renew', requireAdmin, async (req, res) => {
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
      .from('campaigns')
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
app.post('/api/admin/campaigns/:id/extend', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { extension_days } = req.body;
    
    if (!extension_days || extension_days <= 0) {
      return res.status(400).json({ error: 'Extension invalide' });
    }

    // Récupérer la campagne actuelle
    const { data: campaign, error: fetchError } = await supabaseService.supabase
      .from('campaigns')
      .select('end_date')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Prolonger la date de fin
    const currentEndDate = new Date(campaign.end_date);
    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + extension_days);
    
    const { data, error } = await supabaseService.supabase
      .from('campaigns')
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
app.post('/api/admin/campaigns/:id/reactivate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabaseService.supabase
      .from('campaigns')
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
app.put('/api/admin/campaigns/:id', requireAdmin, async (req, res) => {
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
      .from('campaigns')
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
app.put('/api/admin/slides/:id', requireAdmin, async (req, res) => {
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
app.delete('/api/admin/slides/:id', requireAdmin, async (req, res) => {
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
app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
  try {
    console.log('📈 Admin: Récupération analytics globales...');

    // Statistiques des campagnes
    const { data: campaignStats, error: campaignError } = await supabaseService.supabase
      .from('campaigns')
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

// ==================== ROUTE IMAGE PROXY AVANCÉ ====================
// Proxy d'images avec 95%+ de succès, cache, Facebook support
app.get('/api/image-proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter required' });
  }

  await services.imageProxy.proxyImage(url, res);
});

// Statistiques du proxy d'images
app.get('/api/image-proxy/stats', (req, res) => {
  res.json({
    success: true,
    stats: services.imageProxy.getStats()
  });
});

// ==================== ROUTES RSS ====================
// Démarrer le processeur RSS automatique
app.get('/api/rss/start', async (req, res) => {
  try {
    await services.rssAggregator.start();
    res.json({ success: true, message: 'Processeur RSS démarré' });
  } catch (error) {
    console.error('❌ Erreur démarrage RSS:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Forcer un traitement RSS immédiat
app.post('/api/rss/process', async (req, res) => {
  try {
    const result = await services.rssAggregator.processAggregatedFeed();
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur génération sondages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/youtube/extract - Extraction journal TV depuis RSS
app.post('/api/youtube/extract', async (req, res) => {
  try {
    console.log('📺 Extraction journal TV depuis RSS...');
    
    const { extractJournalFromRSS } = require('./youtube-journal-extractor');
    
    const result = await extractJournalFromRSS();
    
    if (result) {
      console.log('✅ Journal TV extrait avec succès');
      res.json({
        success: true,
        message: 'Journal TV extrait avec succès',
        journal: {
          title: result.title,
          link: result.link,
          pubDate: result.pubDate,
          thumbnail: result.thumbnail
        }
      });
    } else {
      res.json({
        success: false,
        message: 'Aucun nouveau journal trouvé',
        journal: null
      });
    }
  } catch (error) {
    console.error('❌ Erreur extraction journal TV:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Statistiques du processeur RSS
app.get('/api/rss/stats', (req, res) => {
  try {
    const stats = services.rssAggregator.getStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ROUTES MIGRÉES NETLIFY → EXPRESS ====================
// Migration des fonctions serverless Netlify vers architecture Express

// Route Actu++ (Résumés intelligents)
const actuPlusRoutes = require('./routes/actu-plus');
app.use('/api/actu-plus', actuPlusRoutes);

// Routes Opportunités IA (Analyse business)
const opportunitiesRoutes = require('./routes/opportunities');
app.use('/api/opportunities', opportunitiesRoutes);

// Routes Formation IA (Training sur mesure)
const trainingRoutes = require('./routes/training');
app.use('/api/training', trainingRoutes);

// Routes Contextes Utilisateur (Mémorisation profils)
const userContextsRoutes = require('./routes/user-contexts');
app.use('/api/user-contexts', userContextsRoutes);

// Routes Test de Compétence (Évaluation aptitudes)
const skillTestRoutes = require('./routes/skill-test');
app.use('/api/skill-test', skillTestRoutes);

// Routes Proxy Images (Contournement CORS)
const imageProxyRoutes = require('./routes/image-proxy');
app.use('/api/image-proxy', imageProxyRoutes);

// Routes Extraction d'Images (Multi-stratégie pour articles)
const imageExtractionRoutes = require('./routes/image-extraction');
app.use('/api/image-extraction', imageExtractionRoutes);

// Routes Audio (TTS résumés)
const audioRoutes = require('./routes/audio');
app.use('/api/audio', audioRoutes);

// Routes Veille & Alertes (Notifications)
const alertsRoutes = require('./routes/alerts');
app.use('/api/alerts', alertsRoutes);

// Routes Veille - Abonnements
const veilleSubscriptionsRoutes = require('./routes/veille-subscriptions');
app.use('/api/veille', veilleSubscriptionsRoutes);

// Routes Recherche Intelligente (avec IA)
const searchRoutes = require('./routes/search');
app.use('/api/search', cacheControl('public', 120, 600), searchRoutes);  // Search: 2min cache

// Routes Credit Manager (Gestion crédits - ancien système)
const creditsRoutes = require('./routes/credits');
app.use('/api/credits', creditsRoutes);

// Routes Admin (Analytics, campagnes, clients, slides, routes)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Routes Admin Alerts (Surveillance quotas API)
const adminAlertsRoutes = require('./routes/admin-alerts');
app.use('/api/admin', adminAlertsRoutes);

// Routes Projects (Propositions sauvegardées)
const projectsRoutes = require('./routes/projects');
app.use('/api/projects', projectsRoutes);

// Routes Docs (Documents sauvegardés)
const docsRoutes = require('./routes/docs');
app.use('/api/docs', docsRoutes);

// Routes Action Plans (Plans d'action avec checklist)
const actionPlansRoutes = require('./routes/action-plans');
app.use('/api/action-plans', actionPlansRoutes);

// Routes AI Monitoring (Monitoring quota OpenAI + crédits)
const aiMonitoringRoutes = require('./routes/ai-monitoring');
app.use('/api/ai', aiMonitoringRoutes);

// ==================== ROUTES CAMPAGNES PUBLICITAIRES ====================

// Routes Campaigns (Gestion campagnes publicitaires utilisateurs)
const campaignsRoutes = require('./routes/campaigns');
app.use('/api/campaigns', campaignsRoutes);

// Routes Upload (Upload images et vidéos vers Supabase Storage)
const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

// Routes AI Generator (Génération contenu IA pour publicités)
const aiGeneratorRoutes = require('./routes/ai');
app.use('/api/ai', aiGeneratorRoutes);

// Routes Admin Campaigns (Validation et gestion admin des campagnes)
const adminCampaignsRoutes = require('./routes/admin-campaigns');
app.use('/api/admin/campaigns', adminCampaignsRoutes);

console.log('✅ Routes campagnes publicitaires chargées');

// Routes Admin Subscriptions (Gestion des abonnements et crédits)
const adminSubscriptionsRoutes = require('./routes/admin-subscriptions');
app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);

console.log('🎫 Routes admin abonnements chargées');

// Routes Game (Jeu Battle Royale "Il n'en restera qu'1")
const gameRoutes = require('./routes/game');
app.use('/api/game', gameRoutes);

console.log('🎮 Routes jeu Battle Royale chargées');

// Routes Monitoring APM (Métriques de performance)
const monitoringRoutes = require('./routes/monitoring');
app.use('/api/monitoring', monitoringRoutes);

console.log('📊 Routes monitoring APM chargées');

// Routes Trending (Tendances - articles les plus vus/partagés)
const trendingRoutes = require('./routes/trending');
app.use('/api/stats/trending', cacheControl('public', 120, 600), trendingRoutes);  // Trending: 2min
// Aussi monter les routes de tracking sur /api
app.post('/api/articles/:id/view', trendingRoutes);
app.post('/api/articles/:id/share', trendingRoutes);

console.log('📈 Routes tendances chargées');

// ==================== CRON MATCHING ALERTES (HORAIRE 7h-22h GABON) ====================
console.log('⏰ Démarrage du matching automatique des alertes (horaire, 7h-22h Gabon)...');

async function processAlertsAutomatically() {
  // Vérifier la plage horaire (7h-22h heure Gabon = UTC+1)
  const gabonHour = (new Date().getUTCHours() + 1) % 24;
  if (gabonHour < 7 || gabonHour >= 22) {
    console.log(`⏰ Hors plage horaire (${gabonHour}h Gabon), skip alertes.`);
    return;
  }

  try {
    console.log(`🔔 Traitement automatique des alertes (${gabonHour}h Gabon)...`);
    const response = await fetch('http://localhost:3001/api/alerts/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Alertes traitées: ${result.processed} matches sur ${result.articlesScanned} articles`);
    } else {
      console.error('❌ Erreur traitement alertes:', response.status);
    }
  } catch (error) {
    console.error('❌ Erreur appel /api/alerts/process:', error.message);
  }
}

// Exécuter toutes les heures (3600000 ms)
setInterval(processAlertsAutomatically, 60 * 60 * 1000);

// Exécuter immédiatement au démarrage (après 30 secondes)
setTimeout(processAlertsAutomatically, 30000);

console.log('✅ Matching automatique des alertes activé (toutes les heures, 7h-22h Gabon)');

// ==================== CRON EXPIRATION DEMOS VEILLE ====================
async function expireVeilleTrials() {
  try {
    const veilleService = require('./services/veille-subscription.service');
    const result = await veilleService.expireTrials();
    if (result.expired > 0) {
      console.log(`⏰ ${result.expired} demo(s) veille expirée(s)`);
    }
  } catch (error) {
    console.error('❌ Erreur expiration demos veille:', error.message);
  }
}

setInterval(expireVeilleTrials, 60 * 60 * 1000); // Toutes les heures
setTimeout(expireVeilleTrials, 60000); // 1 minute après démarrage

// ==================== CRON NETTOYAGE HEBDOMADAIRE ====================
function normalizeUrlInline(url) {
  try {
    if (!url) return '';
    let u = url.toString().trim();
    // Forcer schéma en minuscule et retirer www.
    u = u.replace(/^https?:\/\/(www\.)?/i, (m, w) => m.toLowerCase().includes('https') ? 'https://' : 'http://');
    u = u.replace(/^https?:\/\/www\./i, (m) => m.toLowerCase().startsWith('https') ? 'https://' : 'http://');
    const parsed = new URL(u);
    const trackingParams = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_name','gclid','fbclid','igshid','mc_cid','mc_eid'];
    trackingParams.forEach(p => parsed.searchParams.delete(p));
    parsed.hash = '';
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString().toLowerCase();
  } catch (e) {
    return (url || '').toString().trim().toLowerCase();
  }
}

async function weeklyCleanupDuplicates() {
  const supa = supabaseService.supabase;
  const batch = 1000;
  let from = 0;
  let total = 0;
  const groups = new Map();

  // Charger tous les articles publiés en lots
  // et construire des groupes par clé canonique (normalized_url || url normalisée)
  while (true) {
    const to = from + batch - 1;
    const { data, error } = await supa
      .from('articles')
      .select('id, url, normalized_url, published_at, created_at, is_published')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    total += data.length;

    for (const r of data) {
      const key = (r.normalized_url && r.normalized_url.trim())
        ? r.normalized_url.trim().toLowerCase()
        : normalizeUrlInline(r.url);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    from += data.length;
  }

  // Identifier les doublons à dépublier (garder le plus récent)
  const toUnpublish = [];
  for (const [key, arr] of groups) {
    if (arr.length <= 1) continue;
    arr.sort((a, b) => {
      const pa = a.published_at ? new Date(a.published_at).getTime() : 0;
      const pb = b.published_at ? new Date(b.published_at).getTime() : 0;
      if (pb !== pa) return pb - pa;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
    const rest = arr.slice(1);
    for (const r of rest) toUnpublish.push(r.id);
  }

  // Dépublier en lots
  const chunk = 500;
  let done = 0;
  for (let i = 0; i < toUnpublish.length; i += chunk) {
    const ids = toUnpublish.slice(i, i + chunk);
    const { error } = await supa
      .from('articles')
      .update({ is_published: false })
      .in('id', ids);
    if (error) {
      console.error('❌ Erreur dépublication (cron):', error.message);
      continue;
    }
    done += ids.length;
  }

  console.log(`🧹 Cron hebdo: dépubliés ${done}/${toUnpublish.length} doublons (sur ${total} publiés)`);
}

console.log('⏰ Planification du nettoyage hebdomadaire des doublons (dimanche 03:00 Africa/Libreville)...');
cron.schedule('0 3 * * 0', async () => {
  console.log('🧹 Cron hebdo: début nettoyage des doublons...');
  try {
    await weeklyCleanupDuplicates();
    console.log('✅ Cron hebdo: nettoyage terminé');
  } catch (e) {
    console.error('❌ Cron hebdo: erreur nettoyage:', e.message);
  }
}, { timezone: 'Africa/Libreville' });

// 🤖 CRON: ENRICHISSEMENT IA DES ARTICLES MANQUÉS (toutes les 6 heures - économie tokens)
console.log('⏰ Planification enrichissement IA des articles manqués (toutes les 6 heures)...');
cron.schedule('0 */6 * * *', async () => {
  const ArticleAIEnrichment = require('./services/article-ai-enrichment');
  const enrichmentService = new ArticleAIEnrichment();
  
  console.log('🤖 Cron: vérification articles non enrichis (cycle 6h)...');
  
  try {
    // Récupérer articles récents sans enrichissement (dernières 8 heures pour couvrir le cycle 6h)
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    const { data: articles } = await supabaseService.supabase
      .from('articles')
      .select('id, title, content, summary, source')
      .is('category', null)
      .gte('created_at', eightHoursAgo)
      .eq('is_published', true)
      .limit(20);
    
    if (!articles || articles.length === 0) {
      console.log('✅ Cron: tous les articles récents sont enrichis');
      return;
    }
    
    console.log(`🤖 Cron: enrichissement de ${articles.length} articles manqués...`);
    
    for (const article of articles) {
      try {
        const enrichment = await enrichmentService.enrichArticle(
          article.title,
          article.content || '',
          article.summary || '',
          article.source || '' // Passer la source pour le cache intelligent
        );
        
        await supabaseService.supabase
          .from('articles')
          .update({
            category: enrichment.ai_category || enrichment.category,
            sentiment_score: enrichment.ai_sentiment || enrichment.sentiment,
            keywords: enrichment.ai_keywords || enrichment.keywords
          })
          .eq('id', article.id);
        
        console.log(`   ✅ "${article.title.substring(0, 50)}..." → ${enrichment.ai_category || enrichment.category}`);
        
        // Petite pause entre chaque article (réduite car cache intelligent)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`   ❌ Erreur enrichissement: ${err.message}`);
      }
    }
    
    console.log('✅ Cron: enrichissement terminé');
  } catch (e) {
    console.error('❌ Cron: erreur enrichissement:', e.message);
  }
}, { timezone: 'Africa/Libreville' });

// 🧹 CRON: NETTOYAGE CACHE ENRICHISSEMENT (toutes les 12 heures)
console.log('⏰ Planification nettoyage cache enrichissement (toutes les 12 heures)...');
cron.schedule('0 */12 * * *', async () => {
  try {
    const smartEnrichmentCache = require('./services/smart-enrichment-cache');
    const cleaned = smartEnrichmentCache.cleanExpiredCache();
    const stats = smartEnrichmentCache.getStats();
    console.log(`🧹 Cache enrichissement nettoyé: ${cleaned} entrées`);
    console.log(`📊 Stats cache: ${stats.hitRate} hit rate, ${stats.localEnrichments} enrichissements locaux, économies estimées: ${stats.estimatedMonthlySavings}`);
  } catch (e) {
    console.error('❌ Cron: erreur nettoyage cache:', e.message);
  }
}, { timezone: 'Africa/Libreville' });

// 🎉 CRON: SYNCHRONISATION DES ÉVÉNEMENTS (quotidien à 6h du matin)
console.log('⏰ Planification synchronisation événements (tous les jours à 6h)...');
cron.schedule('0 6 * * *', async () => {
  console.log('🎉 Cron: synchronisation des événements depuis RSS...');
  try {
    const { extractEventsFromRSS } = require('./events-rss-extractor');
    const result = await extractEventsFromRSS();
    console.log(`✅ Cron: événements synchronisés - ${result.inserted} ajoutés, ${result.updated} mis à jour`);
  } catch (error) {
    console.error('❌ Cron: erreur synchronisation événements:', error.message);
  }
}, { timezone: 'Africa/Libreville' });

// 📺 CRON: EXTRACTION DU JOURNAL TV (après chaque publication: 13h, 18h, 21h, 23h)
// Extraction à 14h, 19h, 21h et 0h (minuit) pour récupérer les journaux publiés
console.log('⏰ Planification extraction journal TV (14h, 19h, 21h, 0h WAT)...');
cron.schedule('0 0,14,19,21 * * *', async () => {
  console.log('📺 Cron: extraction du journal TV depuis RSS...');
  try {
    const { extractJournalFromRSS } = require('./youtube-journal-extractor');
    const result = await extractJournalFromRSS();
    if (result) {
      console.log(`✅ Cron: journal TV extrait - ${result.title || 'Article existant mis à jour'}`);
    } else {
      console.log('⚠️  Cron: aucun journal TV trouvé');
    }
  } catch (error) {
    console.error('❌ Cron: erreur extraction journal TV:', error.message);
  }
}, { timezone: 'Africa/Libreville' });

// 🖼️ CRON: EXTRACTION AUTOMATIQUE DES IMAGES (toutes les 5 minutes)
// Traite les articles récents (< 1h) sans image
console.log('⏰ Planification extraction automatique des images (toutes les 5 minutes)...');
cron.schedule('*/5 * * * *', async () => {
  try {
    const { imageExtractor } = require('./services/image-extractor');

    // Récupérer les articles récents (< 1h) sans image
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, url, category, source, title')
      .or('image_url.is.null,image_url.eq.')
      .not('url', 'is', null)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !articles || articles.length === 0) {
      return; // Pas d'articles à traiter, sortie silencieuse
    }

    console.log(`🖼️ Cron images: ${articles.length} articles récents sans image`);

    let updated = 0;
    for (const article of articles) {
      try {
        const result = await imageExtractor.extractImage(article.url, {
          category: article.category,
          source: article.source
        });

        if (result.imageUrl) {
          const { error: updateError } = await supabase
            .from('articles')
            .update({
              image_url: result.imageUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', article.id);

          if (!updateError) {
            updated++;
          }
        }
      } catch (err) {
        // Ignorer les erreurs individuelles
      }
    }

    if (updated > 0) {
      console.log(`✅ Cron images: ${updated}/${articles.length} images extraites`);
    }
  } catch (error) {
    console.error('❌ Cron images: erreur:', error.message);
  }
});

// 🎬 EXTRACTION IMMÉDIATE DU JOURNAL TV AU DÉMARRAGE
// Force Railway redeploy - Updated: 2025-10-22 21:49
console.log('📺 Extraction immédiate du journal TV au démarrage...');
setTimeout(async () => {
  try {
    const { extractJournalFromRSS } = require('./youtube-journal-extractor');
    const result = await extractJournalFromRSS();
    if (result) {
      console.log(`✅ Journal TV extrait au démarrage - ${result.title || 'Article existant mis à jour'}`);
    }
  } catch (error) {
    console.error('❌ Erreur extraction journal TV au démarrage:', error.message);
  }
}, 5000); // Attendre 5 secondes après le démarrage

// ============================================
// 🤖 ROUTES IA - GÉNÉRATION CONTENU
// ============================================

// POST: Streaming IA - Génération avec Server-Sent Events
app.post('/api/ai/stream', requireAuth, async (req, res) => {
  try {
    console.log('🤖 Démarrage streaming IA...');
    
    const { streamGeneration } = require('./services/ai-streaming');
    const { prompt, maxTokens, temperature } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt requis'
      });
    }

    await streamGeneration(res, prompt, {
      maxTokens: maxTokens || 2000,
      temperature: temperature || 0.7
    });

  } catch (error) {
    console.error('❌ Erreur streaming IA:', error.message);
    // L'erreur est déjà gérée dans streamGeneration
  }
});

// POST: Générer article sponsorisé avec IA
app.post('/api/generate-sponsored-article', requireAdmin, async (req, res) => {
  try {
    console.log('🤖 Demande génération article IA...');
    
    const { generateSponsoredArticle } = require('./services/gpt5-nano-analyzer');
    
    const {
      company_name,
      product_service,
      key_message,
      target_audience,
      call_to_action,
      tone,
      category
    } = req.body;

    // Validation
    if (!company_name || !product_service || !key_message) {
      return res.status(400).json({
        success: false,
        error: 'Champs requis: company_name, product_service, key_message'
      });
    }

    // Appel service IA
    const result = await generateSponsoredArticle({
      company_name,
      product_service,
      key_message,
      target_audience: target_audience || 'Grand public gabonais',
      call_to_action: call_to_action || 'Contactez-nous pour plus d\'informations',
      tone: tone || 'professionnel',
      category: category || 'business'
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Erreur génération IA'
      });
    }

    res.json({
      success: true,
      article: result.article
    });

  } catch (error) {
    console.error('❌ Erreur génération article IA:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST: Générer image de couverture avec Nano Banana
app.post('/api/generate-article-image', requireAuth, async (req, res) => {
  try {
    console.log('🎨 Demande génération image IA...');
    
    const { generateArticleImage } = require('./services/gpt5-nano-analyzer');
    
    const {
      title,
      category,
      company_name,
      product_service,
      key_message
    } = req.body;

    // Validation
    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Champ requis: title'
      });
    }

    // Appel service IA
    const result = await generateArticleImage({
      title,
      category: category || 'business',
      company_name: company_name || '',
      product_service: product_service || '',
      key_message: key_message || ''
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Erreur génération image IA'
      });
    }

    res.json({
      success: true,
      image_url: result.image_url
    });

  } catch (error) {
    console.error('❌ Erreur génération image IA:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 📊 CRÉATION DE PROJET ASSISTÉ PAR IA
// ============================================

// Générer un document cadre de projet avec IA
app.post('/api/projects/generate-framework', requireAuth, async (req, res) => {
  try {
    const { userId, userEmail, formData } = req.body;

    if (!userId || !formData) {
      return res.status(400).json({
        success: false,
        error: 'userId et formData sont requis'
      });
    }

    if (!projectFrameworkGenerator) {
      return res.status(503).json({
        success: false,
        error: 'Service de génération de projet non disponible'
      });
    }

    console.log('📝 Génération document cadre pour:', userEmail);

    // Vérifier et déduire les crédits (50 crédits pour création de projet)
    const FRAMEWORK_CREDITS_COST = 50;
    try {
      const { data: creditResult, error: creditError } = await supabase
        .rpc('consume_credits', {
          p_user_id: userId,
          p_amount: FRAMEWORK_CREDITS_COST,
          p_service_name: 'project_creation',
          p_description: 'Création de projet avec assistant IA',
          p_reference_id: null,
          p_metadata: { form_type: 'framework' }
        });

      if (creditError || !creditResult?.success) {
        console.error('❌ Erreur déduction crédits:', creditError || creditResult?.error);
        return res.status(400).json({
          success: false,
          error: creditResult?.error || 'Crédits insuffisants pour créer un projet',
          credits_required: FRAMEWORK_CREDITS_COST
        });
      }
      console.log(`💰 ${FRAMEWORK_CREDITS_COST} crédits déduits - Solde: ${creditResult.total_balance}`);
    } catch (creditErr) {
      console.error('❌ Erreur système crédits:', creditErr);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification des crédits'
      });
    }

    // Générer le document cadre avec IA
    const frameworkResult = await projectFrameworkGenerator.generateProjectFramework(formData);

    if (!frameworkResult.success) {
      throw new Error('Erreur génération document cadre');
    }

    // Extraire les données pour la carte projet (async pour génération IA)
    const projectCardData = await projectFrameworkGenerator.extractProjectCardData(frameworkResult.document, formData);

    // Créer le projet dans Supabase avec mapping vers format analyzer
    const { data: project, error: projectError } = await supabase
      .from('saved_projects')
      .insert({
        user_id: userId,
        
        // Mapping vers format analyzer (colonnes principales)
        proposition_titre: projectCardData.title,
        proposition_description: projectCardData.description,
        secteur_selectionne: projectCardData.category,
        budget_selectionne: projectCardData.budget,
        
        // Colonnes spécifiques framework (pour compatibilité)
        title: projectCardData.title,
        description: projectCardData.description,
        category: projectCardData.category,
        status: 'active',
        phase: projectCardData.phase,
        budget: projectCardData.budget,
        location: projectCardData.location,
        team_size: projectCardData.team_size,
        timeline: projectCardData.timeline,
        target_audience: projectCardData.target_audience,
        unique_value: projectCardData.unique_value,
        
        // Données analyzer manquantes (valeurs par défaut)
        article_title: null,
        article_summary: null,
        article_url: null,
        article_image_url: null,
        article_source: 'Formulaire IA',
        article_published_at: null,
        problematique_centrale: projectCardData.problematique_centrale || 'À définir',
        secteur_principal: projectCardData.category,
        proposition_problematique: projectCardData.problematique_centrale,
        proposition_investissement: projectCardData.budget,
        proposition_rentabilite: 'À calculer',
        proposition_revenus_mensuels: 'À estimer',
        proposition_actions_immediates: [],
        proposition_avantages_concurrentiels: [projectCardData.avantage_concurrentiel || 'Innovation'],
        proposition_score_faisabilite: 75,
        
        // Business Tracker
        current_phase: projectCardData.phase || 'idea',
        progress_percentage: 0,
        total_credits_used: 50, // Coût de génération du framework
        
        cumulative_context: [{
          date: new Date().toISOString(),
          type: 'project_creation',
          content: 'Projet créé via formulaire assisté IA',
          form_data: formData
        }],
        context_updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (projectError) {
      console.error('❌ Erreur création projet:', projectError);
      throw projectError;
    }

    console.log('✅ Projet créé:', project.id);

    // Sauvegarder le document cadre dans project_documents
    const { data: document, error: docError } = await supabase
      .from('project_documents')
      .insert({
        project_id: project.id,
        user_id: userId,
        document_type: 'framework',
        title: `Document Cadre - ${projectCardData.title}`,
        content: frameworkResult.document,
        metadata: {
          ...frameworkResult.metadata,
          form_data: formData,
          category: projectCardData.category,
          phase: projectCardData.phase
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (docError) {
      console.error('⚠️ Erreur sauvegarde document:', docError);
    } else {
      console.log('📄 Document cadre sauvegardé:', document.id);
    }

    // Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: project.id,
        user_id: userId,
        event_type: 'project_created',
        event_description: 'Projet créé avec assistant IA',
        created_at: new Date().toISOString()
      });

    // Mettre à jour le contexte cumulatif avec le document
    await supabase
      .from('saved_projects')
      .update({
        cumulative_context: [
          ...project.cumulative_context,
          {
            date: new Date().toISOString(),
            type: 'framework_document',
            content: `Document cadre généré (${frameworkResult.metadata.word_count} mots)`,
            document_id: document?.id
          }
        ],
        context_updated_at: new Date().toISOString()
      })
      .eq('id', project.id);

    res.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        category: project.category,
        phase: project.phase
      },
      document: {
        id: document?.id,
        word_count: frameworkResult.metadata.word_count
      },
      message: 'Projet créé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur génération projet:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur'
    });
  }
});

// ============================================
// DÉMARRAGE SERVEUR AVEC WEBSOCKET
// ============================================

// Créer le serveur HTTP pour supporter WebSocket
const server = http.createServer(app);

// Initialiser le service WebSocket pour le jeu
services.gameSocketService.initialize(server);

// Démarrer le planificateur de tâches (Cron)
try {
  services.schedulerService.start();
} catch (err) {
  console.error('❌ Erreur démarrage Scheduler:', err);
}

// Vérification de la configuration critique
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY manquante ! Les fonctionnalités IA seront limitées.');
} else {
  console.log('✅ OPENAI_API_KEY détectée (GPT-4.1-mini).');
}

if (!process.env.RAPIDAPI_KEY && !process.env.RAPIDAPI_FOOTBALL_KEY) {
  console.warn('⚠️  RAPIDAPI_KEY manquante ! Le fallback sera utilisé pour Foot/Météo.');
} else {
  console.log('✅ RAPIDAPI_KEY détectée.');
}

// Initialiser Redis avant de démarrer le serveur
redisCache.connect().then(() => {
  console.log('✅ Service Redis initialisé');
}).catch(err => {
  console.warn('⚠️ Redis non disponible, cache désactivé:', err.message);
});

// Exporter redisCache pour utilisation dans les routes
app.set('redisCache', redisCache);

server.listen(PORT, () => {
  console.log(`🚀 Serveur Gabon Insight démarré sur le port ${PORT}`);
  console.log(`📡 API accessible sur: http://localhost:${PORT}`);
  console.log(`🎮 WebSocket Game: ws://localhost:${PORT}`);
  console.log(`🏠 Page d'accueil: http://localhost:${PORT}`);
  console.log(`📊 Santé du service: http://localhost:${PORT}/health`);
  console.log(`💾 Redis: ${redisCache.isAvailable() ? '✅ Connecté' : '⚠️ Non disponible'}`);
  console.log(`📰 Articles récents: http://localhost:${PORT}/api/homepage/articles`);
  console.log(`📚 Articles archivés: http://localhost:${PORT}/api/archives/articles`);
  console.log(`📈 Tendances: http://localhost:${PORT}/api/stats/trending/daily/views`);
  console.log(`🎉 Événements: http://localhost:${PORT}/api/events`);
  console.log(`📢 Slides publicitaires: http://localhost:${PORT}/api/slides`);
  console.log(`📤 Upload d'images: http://localhost:${PORT}/api/admin/upload-image`);
  
  // Initialiser le service RSS avec synchronisation automatique
  console.log('🔄 Service RSS disponible via endpoints manuels');
  rssService = new services.RSSParserService(supabaseService);
  
  // 🤖 DÉMARRER LE PROCESSEUR RSS AGRÉGÉ AVEC ENRICHISSEMENT IA (OPTIMISÉ)
  console.log('🤖 Démarrage du processeur RSS agrégé avec enrichissement IA automatique...');
  console.log('📡 Utilisation du flux RSS bundle unique (12x plus rapide)');
  services.rssAggregator.start(); // Traitement toutes les 15 min + enrichissement IA
  
  // ❌ ANCIEN SYSTÈME DÉSACTIVÉ (inefficace - traitait 12+ flux séparément)
  // const rssProcessor = new RSSProcessor();
  // rssProcessor.startAutomaticProcessing();
  // rssService.startAutoSync(15);
  
  // Démarrer le planificateur de résumés audio automatiques
  const { startScheduler } = require('./services/audio-scheduler');
  startScheduler();
});

// NOTE: Les endpoints d'upload sont dans routes/uploads.js (déjà enregistré)

// Arrêt gracieux
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt gracieux du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu, arrêt gracieux du serveur...');
  process.exit(0);
});

// Capture des erreurs non gérées — sans crash silencieux
process.on('uncaughtException', (err, origin) => {
  console.error('❌ uncaughtException:', err);
  console.error('Origin:', origin);
  if (typeof Sentry !== 'undefined' && Sentry.captureException) {
    try { Sentry.captureException(err); } catch (_) {}
  }
  // En prod : laisser le process superviseur (Railway) redémarrer après log
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => process.exit(1), 1000);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ unhandledRejection at:', promise);
  console.error('Reason:', reason);
  if (typeof Sentry !== 'undefined' && Sentry.captureException) {
    try { Sentry.captureException(reason); } catch (_) {}
  }
});

// Routes pour le tracking des articles
const articleViewsRouter = require('./src/routes/article-views');
app.use('/api/article-views', articleViewsRouter);

// Routes pour l'historique de lecture
const readingHistoryRouter = require('./src/routes/reading-history');
app.use('/api/reading-history', readingHistoryRouter);

// Routes pour le tracking des actions sur projets
const projectActionsRouter = require('./routes/project-actions');
app.use('/api/project-actions', projectActionsRouter);

// Routes pour les projets sauvegardés (Dossiers)
const savedProjectsRouter = require('./routes/saved-projects');
app.use('/api/saved-projects', savedProjectsRouter);

// Routes pour les notes sur projets
const projectNotesRouter = require('./routes/project-notes');
app.use('/api/project-notes', projectNotesRouter);

// Routes pour les documents de projets (Plans d'action, etc.)
const projectDocumentsRouter = require('./src/routes/project-documents');
app.use('/api/project-documents', projectDocumentsRouter);

// Routes pour les articles connexes aux projets
const relatedArticlesRouter = require('./src/routes/related-articles');
app.use('/api/related-articles', relatedArticlesRouter);

// Routes pour le chat IA par projet
const projectChatRouter = require('./src/routes/project-chat');
app.use('/api/project-chat', projectChatRouter);

// Routes pour la timeline et upload de fichiers
const projectTimelineRouter = require('./src/routes/project-timeline');
app.use('/api/project-timeline', projectTimelineRouter);

// Routes pour la collaboration sur projets
const projectCollaborationRouter = require('./src/routes/project-collaboration');
app.use('/api/project-collaboration', projectCollaborationRouter);

// Routes pour la génération de courriers IA
const generateLetterRouter = require('./routes/generate-letter');
app.use('/api/generate-letter', generateLetterRouter);

// Routes pour les notifications admin et système
const adminNotificationsRouter = require('./routes/admin-notifications');
app.use('/api/admin-notifications', adminNotificationsRouter);

// Routes pour le TL;DR (résumé intelligent en 3 points)
const tldrRouter = require('./routes/tldr');
app.use('/api/tldr', tldrRouter);

// Routes pour les tarifs dynamiques
const pricingRouter = require('./routes/pricing');
app.use('/api/pricing', cacheControl('public', 600, 1800), pricingRouter);  // Pricing: 10min cache

// Routes BCEG Project (Phase 2: score, simulator, stats)
const bcegRouter = require('./routes/bceg');
app.use('/api/bceg', bcegRouter);

// Routes Flip Ad (animation pub sur carte profil sidebar)
const flipAdRouter = require('./routes/flip-ad');
app.use('/api/flip-ad', flipAdRouter);

// ============================================
// 🎵 TIKTOK TRENDING - ENDPOINT
// ============================================

/**
 * GET: Récupérer les vidéos TikTok trending au Gabon
 */
app.get('/api/tiktok/trending', async (req, res) => {
  try {
    // Cache Redis - 1 heure pour TikTok (API externe coûteuse)
    const cacheKey = 'tiktok:trending:gabon';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('🎵 Récupération TikTok trending Gabon...');

    const apiKey = process.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'Service TikTok non configuré (RAPIDAPI_KEY manquant)'
      });
    }

    // Recherche par hashtag #gabontiktok (2.1 milliards de vues)
    const response = await fetch('https://tokapi-mobile-version.p.rapidapi.com/v1/search/post?offset=0&keyword=gabontiktok&count=10', {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'tokapi-mobile-version.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`TikTok API error: ${response.status}`);
    }

    const data = await response.json();
    
    console.log('🔍 Structure réponse API:', {
      hasData: !!data.data,
      dataLength: data.data?.length || 0,
      statusCode: data.status_code
    });
    
    // Parse les vidéos du résultat de recherche
    const videoList = data.data || [];
    
    const parsedVideos = videoList.map((item, index) => {
      const video = item.aweme;
      if (!video) {
        console.log(`⚠️ Item ${index} n'a pas de propriété 'aweme'`, Object.keys(item));
        return null;
      }
      
      return {
        id: video.aweme_id || `video-${index}`,
        title: video.desc || 'Vidéo TikTok Gabon',
        author: {
          username: video.author?.unique_id || 'tiktokuser',
          nickname: video.author?.nickname || 'TikTok User',
          avatar: video.author?.avatar_thumb?.url_list?.[0] || 'https://via.placeholder.com/40',
          verified: video.author?.custom_verify || video.author?.enterprise_verify_reason || false
        },
        cover: video.video?.origin_cover?.url_list?.[0] || video.video?.cover?.url_list?.[0] || 'https://via.placeholder.com/300x400',
        duration: video.video?.duration || 15,
        stats: {
          likes: video.statistics?.digg_count || 0,
          comments: video.statistics?.comment_count || 0,
          views: video.statistics?.play_count || 0,
          shares: video.statistics?.share_count || 0
        },
        url: `https://www.tiktok.com/@${video.author?.unique_id || 'tiktok'}/video/${video.aweme_id}` 
      };
    }).filter(v => v !== null);

    console.log(`✅ ${parsedVideos.length} vidéos TikTok Gabon récupérées`);

    const tiktokResponse = {
      success: true,
      videos: parsedVideos,
      count: parsedVideos.length
    };

    // Mettre en cache Redis - 1 heure
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, tiktokResponse, 3600);
    }

    res.json(tiktokResponse);

  } catch (error) {
    console.error('❌ Erreur TikTok API:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

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


// ==================== ROUTE YOUTUBE ====================
// Endpoint /api/youtube géré par le routeur YouTube (src/routes/youtube.js)
// Voir ligne 223: app.use('/api', youtubeRoutes);

// (removed duplicate simple redirect /api/image-proxy route)

// ==================== ROUTE CAMPAIGNS PUBLICITAIRES ====================
app.post('/api/campaigns', requireAuth, async (req, res) => {
  try {
    console.log('📢 Création nouvelle campagne publicitaire...');
    
    const {
      campaign_type,
      name,
      banner_title,
      banner_description,
      redirect_url,
      start_date,
      duration_days,
      desktop_image_url,
      mobile_image_url,
      design_request,
      design_request_notes,
      budget,
      status = 'pending',
      // Article Sponsorisé Tendances
      article_title,
      article_subtitle,
      article_content,
      article_summary,
      article_author,
      article_category,
      article_image_url,
      article_image_preview,
      company_name,
      product_service,
      target_audience,
      key_message,
      call_to_action,
      request_creation,
      generate_with_ai
    } = req.body;

    // Validation
    if (!campaign_type || !name || !start_date || !duration_days || !budget) {
      return res.status(400).json({ 
        success: false, 
        error: 'Champs obligatoires manquants' 
      });
    }

    // Calculer la date de fin
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + duration_days);

    // Vérifier disponibilité créneaux (sauf pour article-trending qui est illimité)
    const limit = CAMPAIGN_LIMITS[campaign_type];
    if (limit !== null) {
      const { data: overlappingCampaigns, error: checkError } = await supabase
        .from('campaigns')
        .select('id, name, start_date, end_date')
        .eq('campaign_type', campaign_type)
        .in('status', ['active', 'pending'])
        .or(`and(start_date.lte.${endDateObj.toISOString()},end_date.gte.${startDateObj.toISOString()})`);

      if (checkError) {
        console.error('❌ Erreur vérification disponibilité:', checkError.message);
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de la vérification de disponibilité'
        });
      }

      const currentCount = overlappingCampaigns?.length || 0;
      if (currentCount >= limit) {
        console.warn(`⚠️ Limite atteinte pour ${campaign_type}: ${currentCount}/${limit}`);
        return res.status(409).json({
          success: false,
          error: `Limite atteinte: ${currentCount}/${limit} campagnes actives pour cette période`,
          limit,
          current_count: currentCount,
          conflicting_campaigns: overlappingCampaigns
        });
      }
    }

    // Construire l'objet campagne selon le type
    const campaignData = {
      campaign_type,
      name,
      redirect_url,
      start_date: startDateObj.toISOString(),
      end_date: endDateObj.toISOString(),
      duration_days,
      design_request: design_request || request_creation || false,
      design_request_notes: design_request_notes || null,
      budget,
      status,
      views: 0,
      clicks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Ajouter champs spécifiques selon le type de campagne
    if (campaign_type === 'article-trending') {
      // Pour articles sponsorisés: pas d'images de bannières
      campaignData.banner_title = article_title || name;
      campaignData.banner_description = article_summary || article_subtitle || '';
    } else {
      // Pour bannières et vidéos
      campaignData.banner_title = banner_title || '';
      campaignData.banner_description = banner_description || '';
      if (desktop_image_url) campaignData.desktop_image_url = desktop_image_url;
      if (mobile_image_url) campaignData.mobile_image_url = mobile_image_url;
    }

    // Insérer la campagne dans Supabase
    const { data, error } = await supabase
      .from('campaigns')
      .insert([campaignData])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur insertion campagne:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la création de la campagne' 
      });
    }

    console.log(`✅ Campagne créée: ${data.name} (${data.id})`);
    console.log(`   📅 Démarrage: ${new Date(data.start_date).toLocaleDateString('fr-FR')}`);
    console.log(`   💰 Budget: ${data.budget} FCFA`);
    console.log(`   📊 Status: ${data.status}`);

    let sponsoredArticle = null;

    // Si c'est un article sponsorisé, créer l'article dans la table articles
    if (campaign_type === 'article-trending' && article_title) {
      console.log('🔥 Création article sponsorisé Gabon Insight...');

      // Créer un flux RSS virtuel "Gabon Insight" s'il n'existe pas
      let gabonInsightFeed;
      const { data: existingFeed } = await supabase
        .from('rss_feeds')
        .select('id')
        .eq('name', 'Gabon Insight')
        .single();

      if (existingFeed) {
        gabonInsightFeed = existingFeed;
      } else {
        const { data: newFeed, error: feedError } = await supabase
          .from('rss_feeds')
          .insert([{
            name: 'Gabon Insight',
            url: 'https://gabon-insight.netlify.app/sponsored',
            description: 'Articles sponsorisés et contenus partenaires',
            category: 'Sponsorisé',
            language: 'fr',
            country: 'GA',
            status: 'active',
            is_premium: true,
            priority: 1
          }])
          .select('id')
          .single();

        if (feedError) {
          console.error('❌ Erreur création flux Gabon Insight:', feedError.message);
        } else {
          gabonInsightFeed = newFeed;
          console.log('✅ Flux Gabon Insight créé');
        }
      }

      // Créer l'article sponsorisé
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .insert([{
          feed_id: gabonInsightFeed?.id || null,
          external_id: `sponsored-${data.id}`,
          title: article_title,
          summary: article_summary || article_subtitle || 'Article sponsorisé',
          summary_ai: article_summary || article_subtitle,
          content: article_content,
          url: redirect_url,
          author: article_author || 'Équipe Gabon Insight',
          published_at: startDateObj.toISOString(),
          language: 'fr',
          category: article_category || 'business',
          keywords: [company_name, product_service, 'sponsorisé', 'publicité', target_audience].filter(Boolean),
          sentiment: 'positif',
          sentiment_confidence: 0.85,
          read_time_minutes: Math.ceil((article_content?.length || 500) / 1000 * 5),
          image_urls: article_image_url ? [article_image_url] : (article_image_preview ? [article_image_preview] : []),
          is_trending: true,
          view_count: 5000 + Math.floor(Math.random() * 3000), // Boost: 5000-8000 vues
          share_count: 50 + Math.floor(Math.random() * 50), // 50-100 partages
          whatsapp_share_count: 30 + Math.floor(Math.random() * 30),
          is_published: status === 'active',
          is_premium: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (articleError) {
        console.error('❌ Erreur création article sponsorisé:', articleError.message);
      } else {
        sponsoredArticle = articleData;
        console.log(`✅ Article sponsorisé créé: ${articleData.title} (ID: ${articleData.id})`);
        console.log(`   👁️ Vues boostées: ${articleData.view_count}`);
        console.log(`   🎯 Catégorie: ${articleData.category}`);
        console.log(`   ✨ Source: Gabon Insight`);
      }
    }

    res.json({ 
      success: true, 
      campaign: data,
      sponsored_article: sponsoredArticle,
      message: campaign_type === 'article-trending' && sponsoredArticle 
        ? 'Campagne et article sponsorisé créés avec succès' 
        : 'Campagne créée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur création campagne:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// GET: Récupérer les campagnes d'un utilisateur
app.get('/api/campaigns', async (req, res) => {
  try {
    const { user_id, status } = req.query;

    let query = supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur récupération campagnes:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la récupération' 
      });
    }

    res.json({ 
      success: true, 
      campaigns: data || [] 
    });

  } catch (error) {
    console.error('❌ Erreur récupération campagnes:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// ==================== GESTION CALENDRIER CAMPAGNES ====================

// Configuration des limites par type de campagne
const CAMPAIGN_LIMITS = {
  'banner-home': 10,        // Bannière page d'accueil: max 10 simultanées
  'banner-feed': 1,         // Bannière feed: max 1 simultanée
  'video-home': 1,          // Vidéo home: max 1 simultanée
  'article-trending': null  // Article sponsorisé: illimité
};

// GET: Vérifier disponibilité créneaux pour une période
app.get('/api/campaigns/availability', async (req, res) => {
  try {
    const { campaign_type, start_date, end_date } = req.query;

    if (!campaign_type || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'campaign_type, start_date et end_date sont requis'
      });
    }

    // Vérifier la limite pour ce type
    const limit = CAMPAIGN_LIMITS[campaign_type];
    
    // Si illimité (null), toujours disponible
    if (limit === null) {
      return res.json({
        success: true,
        available: true,
        limit: null,
        current_count: 0,
        message: 'Aucune limite pour ce type de campagne'
      });
    }

    // Compter les campagnes actives qui se chevauchent avec la période demandée
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, name, start_date, end_date, status')
      .eq('campaign_type', campaign_type)
      .in('status', ['active', 'pending'])
      .or(`and(start_date.lte.${end_date},end_date.gte.${start_date})`);

    if (error) {
      console.error('❌ Erreur vérification disponibilité:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification'
      });
    }

    const current_count = data?.length || 0;
    const available = current_count < limit;

    res.json({
      success: true,
      available,
      limit,
      current_count,
      remaining: available ? limit - current_count : 0,
      conflicting_campaigns: data,
      message: available 
        ? `${limit - current_count} créneau(x) disponible(s)`
        : `Limite atteinte (${current_count}/${limit})`
    });

  } catch (error) {
    console.error('❌ Erreur disponibilité:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// GET: Récupérer calendrier des campagnes par type
app.get('/api/campaigns/calendar/:campaign_type', async (req, res) => {
  try {
    const { campaign_type } = req.params;
    const { start_date, end_date } = req.query;

    let query = supabase
      .from('campaigns')
      .select('id, name, start_date, end_date, status, budget, views, clicks')
      .eq('campaign_type', campaign_type)
      .in('status', ['active', 'pending'])
      .order('start_date', { ascending: true });

    // Filtrer par période si spécifiée
    if (start_date && end_date) {
      query = query.or(`and(start_date.lte.${end_date},end_date.gte.${start_date})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur récupération calendrier:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération'
      });
    }

    const limit = CAMPAIGN_LIMITS[campaign_type];

    res.json({
      success: true,
      campaigns: data || [],
      limit,
      count: data?.length || 0,
      campaign_type
    });

  } catch (error) {
    console.error('❌ Erreur calendrier:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

// PUT: Valider une campagne (admin)
app.put('/api/campaigns/:id/validate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`✅ Validation campagne: ${id}`);

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        status: 'active',
        admin_approved: true,
        approval_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur validation:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la validation' 
      });
    }

    console.log(`✅ Campagne validée: ${data.name}`);
    console.log(`   📅 Date validation: ${new Date(data.approval_date).toLocaleDateString('fr-FR')}`);

    res.json({ 
      success: true, 
      campaign: data,
      message: 'Campagne validée avec succès' 
    });

  } catch (error) {
    console.error('❌ Erreur validation campagne:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// PUT: Rejeter une campagne (admin)
app.put('/api/campaigns/:id/reject', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    console.log(`❌ Rejet campagne: ${id}`);
    console.log(`   Raison: ${rejection_reason}`);

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        status: 'rejected',
        admin_approved: false,
        admin_notes: rejection_reason || 'Rejetée par l\'administrateur',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur rejet:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors du rejet' 
      });
    }

    console.log(`❌ Campagne rejetée: ${data.name}`);

    res.json({ 
      success: true, 
      campaign: data,
      message: 'Campagne rejetée' 
    });

  } catch (error) {
    console.error('❌ Erreur rejet campagne:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// GET: Récupérer campagnes actives pour affichage public
app.get('/api/campaigns/active', async (req, res) => {
  try {
    const { campaign_type } = req.query;
    const now = new Date().toISOString();

    let query = supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .lte('start_date', now);

    if (campaign_type) {
      query = query.eq('campaign_type', campaign_type);
    }

    // Calculer end_date (start_date + duration_days)
    const { data, error } = await query;

    if (error) {
      console.error('❌ Erreur récupération campagnes actives:', error.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la récupération' 
      });
    }

    // Filtrer les campagnes dont la date de fin n'est pas dépassée
    const activeCampaigns = (data || []).filter(campaign => {
      const startDate = new Date(campaign.start_date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + campaign.duration_days);
      return endDate >= new Date();
    });

    // Prendre la plus récente
    const campaign = activeCampaigns.length > 0 
      ? activeCampaigns.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0]
      : null;

    res.json({ 
      success: true, 
      campaign 
    });

  } catch (error) {
    console.error('❌ Erreur récupération campagnes actives:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// POST: Tracker vues et clics des campagnes
app.post('/api/campaigns/:id/track', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'view' ou 'click'

    if (!['view', 'click'].includes(action)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Action invalide' 
      });
    }

    // Récupérer la campagne
    const { data: campaign, error: fetchError } = await supabase
      .from('campaigns')
      .select('views, clicks')
      .eq('id', id)
      .single();

    if (fetchError || !campaign) {
      return res.status(404).json({ 
        success: false, 
        error: 'Campagne non trouvée' 
      });
    }

    // Incrémenter le compteur
    const updateData = action === 'view' 
      ? { views: (campaign.views || 0) + 1 }
      : { clicks: (campaign.clicks || 0) + 1 };

    const { error: updateError } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('❌ Erreur mise à jour compteur:', updateError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la mise à jour' 
      });
    }

    console.log(`📊 Campagne ${id}: ${action} enregistré`);

    res.json({ 
      success: true, 
      message: `${action} enregistré` 
    });

  } catch (error) {
    console.error('❌ Erreur tracking campagne:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur serveur' 
    });
  }
});

// ============================================
// 🎓 FORMATIONS IA - ENDPOINTS
// ============================================

const { generateModuleLesson, generateModuleImage } = require('./services/gpt5-nano-analyzer');

/**
 * POST: Générer une leçon complète pour un module de formation
 * Body: { title, description, opportunity_context, project_info, category, difficulty_level }
 */
app.post('/api/training/generate-lesson', async (req, res) => {
  try {
    console.log('📚 Requête génération leçon...');
    
    const { title, description, opportunity_context, project_info, category, difficulty_level } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Titre et description requis'
      });
    }

    const result = await generateModuleLesson({
      title,
      description,
      opportunity_context: opportunity_context || 'Contexte entrepreneurial gabonais général',
      project_info: project_info || 'Projet business au Gabon',
      category: category || 'business',
      difficulty_level: difficulty_level || 'débutant'
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur génération leçon:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST: Générer une image d'illustration pour un module
 * Body: { title, category, description }
 */
app.post('/api/training/generate-module-image', async (req, res) => {
  try {
    console.log('🎨 Requête génération image module...');
    
    const { title, category, description } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Titre requis'
      });
    }

    const result = await generateModuleImage({
      title,
      category: category || 'business',
      description: description || ''
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur génération image:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST: Créer une formation complète avec modules
 * Body: { project_id, modules_selected, opportunity_id, payment_credits }
 */
app.post('/api/training/create-training', async (req, res) => {
  try {
    console.log('🎓 Création formation...');
    
    const { project_id, modules_selected, opportunity_id, payment_credits, user_id } = req.body;

    if (!project_id || !user_id || !modules_selected || modules_selected.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Données incomplètes'
      });
    }

    // Vérifier les crédits de l'utilisateur
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('ia_credits')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    if (userData.ia_credits < payment_credits) {
      return res.status(402).json({
        success: false,
        error: 'Crédits insuffisants',
        required: payment_credits,
        available: userData.ia_credits
      });
    }

    // Créer la formation
    const { data: training, error: trainingError } = await supabase
      .from('trainings')
      .insert({
        user_id,
        project_id,
        opportunity_id,
        modules: modules_selected,
        status: 'active',
        credits_used: payment_credits,
        progress: 0,
        completed_modules: []
      })
      .select()
      .single();

    if (trainingError) {
      console.error('Erreur création training:', trainingError);
      return res.status(500).json({
        success: false,
        error: 'Erreur création formation'
      });
    }

    // Déduire les crédits
    const { error: deductError } = await supabase
      .from('users')
      .update({ ia_credits: userData.ia_credits - payment_credits })
      .eq('id', user_id);

    if (deductError) {
      console.error('Erreur déduction crédits:', deductError);
    }

    console.log(`✅ Formation créée: ${training.id}`);

    res.json({
      success: true,
      training_id: training.id,
      message: 'Formation créée avec succès',
      remaining_credits: userData.ia_credits - payment_credits
    });

  } catch (error) {
    console.error('❌ Erreur création formation:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET: Récupérer une formation avec modules
 * Query: training_id
 */
app.get('/api/training/:training_id', async (req, res) => {
  try {
    const { training_id } = req.params;

    const { data, error } = await supabase
      .from('trainings')
      .select(`
        *,
        users!inner(email, full_name),
        projects!inner(title, category)
      `)
      .eq('id', training_id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Formation non trouvée'
      });
    }

    res.json({
      success: true,
      training: data
    });

  } catch (error) {
    console.error('❌ Erreur récupération formation:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT: Mettre à jour progression formation
 * Body: { module_id, completed }
 */
app.put('/api/training/:training_id/progress', async (req, res) => {
  try {
    const { training_id } = req.params;
    const { module_id, completed } = req.body;

    // Récupérer formation actuelle
    const { data: training, error: fetchError } = await supabase
      .from('trainings')
      .select('completed_modules, modules')
      .eq('id', training_id)
      .single();

    if (fetchError) {
      return res.status(404).json({
        success: false,
        error: 'Formation non trouvée'
      });
    }

    let completedModules = training.completed_modules || [];
    
    if (completed && !completedModules.includes(module_id)) {
      completedModules.push(module_id);
    } else if (!completed) {
      completedModules = completedModules.filter(id => id !== module_id);
    }

    const progress = Math.round((completedModules.length / training.modules.length) * 100);

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('trainings')
      .update({
        completed_modules: completedModules,
        progress,
        last_accessed_at: new Date().toISOString()
      })
      .eq('id', training_id);

    if (updateError) {
      return res.status(500).json({
        success: false,
        error: 'Erreur mise à jour progression'
      });
    }

    res.json({
      success: true,
      progress,
      completed_modules: completedModules
    });

  } catch (error) {
    console.error('❌ Erreur MAJ progression:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🚀 DÉMARRAGE AUTOMATIQUE DU PROCESSEUR RSS
console.log('\n📡 Initialisation du processeur RSS...');
services.rssAggregator.start()
  .then(() => console.log('✅ Processeur RSS démarré avec succès'))
  .catch(err => console.error('❌ Erreur démarrage RSS:', err));

// ============================================
// 404 + ERROR HANDLERS (doivent être les TOUT DERNIERS middlewares)
// ============================================
app.use(notFoundHandler);
app.use(sentry.errorHandler); // capture Sentry avant le handler custom
app.use(errorHandler);

