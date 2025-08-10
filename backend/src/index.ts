import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger';
import { connectRedis } from './config/redis';
import { initializeQueues } from './config/queue';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import articleRoutes from './routes/article';
import rssRoutes from './routes/rss';
import subscriptionRoutes from './routes/subscription';
import whatsappRoutes from './routes/whatsapp';
import journalistRoutes from './routes/journalist';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'GabonNews API'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/rss', authMiddleware, rssRoutes);
app.use('/api/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);
app.use('/api/journalist', authMiddleware, journalistRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint non trouvé',
    path: req.originalUrl 
  });
});

async function startServer() {
  try {
    // Initialize Redis connection
    await connectRedis();
    logger.info('Redis connecté avec succès');

    // Initialize job queues
    await initializeQueues();
    logger.info('Queues initialisées avec succès');

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Serveur GabonNews démarré sur le port ${PORT}`);
      logger.info(`📱 API disponible sur http://localhost:${PORT}`);
      logger.info(`🔧 Environnement: ${process.env.NODE_ENV}`);
    });

  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu, arrêt gracieux du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT reçu, arrêt gracieux du serveur...');
  process.exit(0);
});

startServer();
