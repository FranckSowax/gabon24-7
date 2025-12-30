import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import { redis } from './redis';
import { logger } from '../utils/logger';

// Configuration des queues
const queueConfig: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Queues principales
export const rssQueue = new Queue('rss-feeds', queueConfig);
export const messageQueue = new Queue('messages', queueConfig);
export const paymentQueue = new Queue('payments', queueConfig);
export const summaryQueue = new Queue('summaries', queueConfig);

// Types de jobs
export interface RSSJobData {
  feedId: string;
  feedUrl: string;
  mediaName: string;
  lastFetched?: string;
}

export interface SummaryJobData {
  articleId: string;
  title: string;
  content: string;
  mediaName: string;
}

export interface MessageJobData {
  userId?: string;
  articleId?: string;
  messageType: 'article' | 'editorial' | 'notification' | 'welcome';
  content: string;
  channelId?: string;
  isChannelMessage?: boolean;
}

export interface PaymentJobData {
  userId: string;
  subscriptionId: string;
  amount: number;
  paymentMethod: 'airtel_money' | 'moov_money';
  phoneNumber: string;
}

// Initialisation des queues
export async function initializeQueues(): Promise<void> {
  try {
    // Nettoyer les jobs en attente au démarrage
    await rssQueue.obliterate({ force: true });
    await messageQueue.obliterate({ force: true });
    await paymentQueue.obliterate({ force: true });
    await summaryQueue.obliterate({ force: true });

    logger.info('Queues initialisées et nettoyées');

    // Ajouter des jobs récurrents pour RSS
    await addRecurringRSSJobs();

  } catch (error) {
    logger.error('Erreur lors de l\'initialisation des queues:', error);
    throw error;
  }
}

// Ajouter des jobs RSS récurrents
async function addRecurringRSSJobs(): Promise<void> {
  try {
    // Job principal de surveillance RSS toutes les 5 minutes
    await rssQueue.add(
      'monitor-all-feeds',
      {},
      {
        repeat: { pattern: '*/5 * * * *' }, // Toutes les 5 minutes
        jobId: 'rss-monitor-recurring'
      }
    );

    // Job de nettoyage quotidien
    await rssQueue.add(
      'cleanup-old-articles',
      {},
      {
        repeat: { pattern: '0 2 * * *' }, // 2h du matin chaque jour
        jobId: 'cleanup-recurring'
      }
    );

    logger.info('Jobs RSS récurrents ajoutés');
  } catch (error) {
    logger.error('Erreur lors de l\'ajout des jobs récurrents:', error);
    throw error;
  }
}

// Utilitaires pour ajouter des jobs
export class QueueManager {
  static async addRSSJob(data: RSSJobData, priority: number = 0): Promise<void> {
    await rssQueue.add('process-feed', data, { priority });
  }

  static async addSummaryJob(data: SummaryJobData, priority: number = 0): Promise<void> {
    await summaryQueue.add('generate-summary', data, { priority });
  }

  static async addMessageJob(data: MessageJobData, priority: number = 0): Promise<void> {
    await messageQueue.add('send-message', data, { priority });
  }

  static async addPaymentJob(data: PaymentJobData, priority: number = 0): Promise<void> {
    await paymentQueue.add('process-payment', data, { priority });
  }

  // Statistiques des queues
  static async getQueueStats() {
    const [rssStats, messageStats, paymentStats, summaryStats] = await Promise.all([
      rssQueue.getJobCounts(),
      messageQueue.getJobCounts(),
      paymentQueue.getJobCounts(),
      summaryQueue.getJobCounts()
    ]);

    return {
      rss: rssStats,
      messages: messageStats,
      payments: paymentStats,
      summaries: summaryStats
    };
  }

  // Nettoyer les jobs terminés
  static async cleanupQueues(): Promise<void> {
    await Promise.all([
      rssQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'), // 24h
      rssQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'), // 7 jours
      messageQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'),
      messageQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'),
      paymentQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'),
      paymentQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed'),
      summaryQueue.clean(24 * 60 * 60 * 1000, 100, 'completed'),
      summaryQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed')
    ]);

    logger.info('Nettoyage des queues terminé');
  }
}
