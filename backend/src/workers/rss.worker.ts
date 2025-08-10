import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { RSSService } from '../services/rss.service';
import { logger } from '../utils/logger';
import { RSSJobData } from '../config/queue';

const rssService = new RSSService();

// Worker pour traiter les flux RSS
export const rssWorker = new Worker(
  'rss-feeds',
  async (job: Job<RSSJobData | any>) => {
    const { name, data } = job;
    
    try {
      logger.info(`Traitement du job RSS: ${name}`, { jobId: job.id, data });

      switch (name) {
        case 'process-feed':
          await processSingleFeed(job);
          break;
          
        case 'monitor-all-feeds':
          await monitorAllFeeds(job);
          break;
          
        case 'cleanup-old-articles':
          await cleanupOldArticles(job);
          break;
          
        default:
          throw new Error(`Type de job RSS inconnu: ${name}`);
      }

      logger.info(`Job RSS ${name} terminé avec succès`, { jobId: job.id });
      
    } catch (error) {
      logger.error(`Erreur dans le job RSS ${name}:`, error, { jobId: job.id });
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5, // Traiter jusqu'à 5 flux en parallèle
    limiter: {
      max: 10, // Maximum 10 jobs par minute
      duration: 60000
    }
  }
);

/**
 * Traiter un flux RSS spécifique
 */
async function processSingleFeed(job: Job<RSSJobData>): Promise<void> {
  const { feedId, feedUrl, mediaName } = job.data;
  
  if (!feedId || !feedUrl || !mediaName) {
    throw new Error('Données de flux RSS manquantes');
  }

  await job.updateProgress(10);
  
  try {
    await rssService.processFeed(feedId, feedUrl, mediaName);
    await job.updateProgress(100);
    
    logger.info(`Flux RSS traité: ${mediaName}`, { feedId, feedUrl });
    
  } catch (error) {
    logger.error(`Erreur lors du traitement du flux ${mediaName}:`, error);
    throw error;
  }
}

/**
 * Surveiller tous les flux RSS actifs
 */
async function monitorAllFeeds(job: Job): Promise<void> {
  try {
    await job.updateProgress(5);
    
    // Récupérer tous les flux actifs
    const activeFeeds = await rssService.getActiveFeeds();
    
    if (activeFeeds.length === 0) {
      logger.info('Aucun flux RSS actif trouvé');
      return;
    }

    logger.info(`${activeFeeds.length} flux RSS actifs trouvés`);
    await job.updateProgress(20);

    // Traiter chaque flux
    const promises = activeFeeds.map(async (feed, index) => {
      try {
        // Vérifier l'intervalle de récupération
        const now = new Date();
        const lastFetched = feed.last_fetched_at ? new Date(feed.last_fetched_at) : null;
        const intervalMs = feed.fetch_interval * 60 * 1000; // Convertir en millisecondes

        if (lastFetched && (now.getTime() - lastFetched.getTime()) < intervalMs) {
          logger.debug(`Flux ${feed.media_name} traité récemment, ignoré`);
          return;
        }

        await rssService.processFeed(feed.id, feed.url, feed.media_name);
        
        // Mettre à jour le progrès
        const progress = 20 + Math.floor((index + 1) / activeFeeds.length * 70);
        await job.updateProgress(progress);
        
      } catch (error) {
        logger.error(`Erreur lors du traitement du flux ${feed.media_name}:`, error);
        // Ne pas faire échouer tout le job pour un flux défaillant
      }
    });

    await Promise.all(promises);
    await job.updateProgress(95);

    // Statistiques finales
    const stats = await getProcessingStats();
    logger.info('Surveillance RSS terminée', stats);
    
    await job.updateProgress(100);
    
  } catch (error) {
    logger.error('Erreur lors de la surveillance des flux RSS:', error);
    throw error;
  }
}

/**
 * Nettoyer les anciens articles
 */
async function cleanupOldArticles(job: Job): Promise<void> {
  try {
    await job.updateProgress(10);
    
    const daysToKeep = 30; // Garder 30 jours d'articles
    await rssService.cleanupOldArticles(daysToKeep);
    
    await job.updateProgress(50);
    
    // Nettoyer aussi le cache Redis
    await cleanupRedisCache();
    
    await job.updateProgress(100);
    
    logger.info(`Nettoyage terminé: articles > ${daysToKeep} jours supprimés`);
    
  } catch (error) {
    logger.error('Erreur lors du nettoyage:', error);
    throw error;
  }
}

/**
 * Nettoyer le cache Redis des articles
 */
async function cleanupRedisCache(): Promise<void> {
  try {
    // Supprimer les clés de cache d'articles anciennes
    const keys = await redis.keys('article:hash:*');
    
    if (keys.length > 0) {
      // Traiter par batches de 1000
      const batchSize = 1000;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        await redis.del(...batch);
      }
      
      logger.info(`${keys.length} clés de cache d'articles supprimées`);
    }
    
  } catch (error) {
    logger.error('Erreur lors du nettoyage du cache Redis:', error);
  }
}

/**
 * Obtenir les statistiques de traitement
 */
async function getProcessingStats(): Promise<any> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Compter les articles traités aujourd'hui
    const { count: articlesCount } = await rssService['supabaseAdmin']
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    // Compter les flux actifs
    const { count: feedsCount } = await rssService['supabaseAdmin']
      .from('rss_feeds')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return {
      articlesProcessedToday: articlesCount || 0,
      activeFeeds: feedsCount || 0,
      timestamp: now.toISOString()
    };
    
  } catch (error) {
    logger.error('Erreur lors du calcul des statistiques:', error);
    return {
      articlesProcessedToday: 0,
      activeFeeds: 0,
      timestamp: new Date().toISOString()
    };
  }
}

// Gestionnaires d'événements du worker
rssWorker.on('completed', (job) => {
  logger.info(`Job RSS terminé: ${job.name}`, { 
    jobId: job.id, 
    duration: job.finishedOn ? job.finishedOn - job.processedOn! : 0 
  });
});

rssWorker.on('failed', (job, err) => {
  logger.error(`Job RSS échoué: ${job?.name}`, err, { 
    jobId: job?.id,
    attempts: job?.attemptsMade 
  });
});

rssWorker.on('stalled', (jobId) => {
  logger.warn(`Job RSS bloqué: ${jobId}`);
});

rssWorker.on('progress', (job, progress) => {
  logger.debug(`Progrès job RSS ${job.name}: ${progress}%`, { jobId: job.id });
});

// Arrêt gracieux
process.on('SIGTERM', async () => {
  logger.info('Arrêt du worker RSS...');
  await rssWorker.close();
});

process.on('SIGINT', async () => {
  logger.info('Interruption du worker RSS...');
  await rssWorker.close();
});

export default rssWorker;
