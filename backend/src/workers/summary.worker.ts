import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { GPTService } from '../services/gpt.service';
import { QueueManager, SummaryJobData } from '../config/queue';
import { logger } from '../utils/logger';

const gptService = new GPTService();

// Worker pour générer les résumés avec l'IA
export const summaryWorker = new Worker(
  'summaries',
  async (job: Job<SummaryJobData>) => {
    const { articleId, title, content, mediaName } = job.data;
    
    try {
      logger.info(`Génération du résumé pour l'article: ${title}`, { 
        jobId: job.id, 
        articleId, 
        mediaName 
      });

      await job.updateProgress(10);

      // Générer le résumé avec GPT
      const summary = await gptService.generateSummary(articleId, title, content, mediaName);
      
      await job.updateProgress(80);

      // Ajouter l'article à la queue de distribution WhatsApp
      await QueueManager.addMessageJob({
        articleId,
        messageType: 'article',
        content: `📰 *${title}*\n\n${summary}\n\n_Source: ${mediaName}_`,
        isChannelMessage: true
      }, 2); // Priorité élevée pour la distribution

      await job.updateProgress(100);

      logger.info(`Résumé généré et article ajouté à la queue de distribution`, { 
        articleId, 
        summaryLength: summary.length 
      });

      return { 
        articleId, 
        summary, 
        summaryLength: summary.length,
        addedToDistribution: true 
      };

    } catch (error) {
      logger.error(`Erreur lors de la génération du résumé pour l'article ${articleId}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 3, // Limiter pour éviter de surcharger l'API OpenAI
    limiter: {
      max: 20, // Maximum 20 résumés par minute (limite API)
      duration: 60000
    }
  }
);

// Gestionnaires d'événements
summaryWorker.on('completed', (job, result) => {
  logger.info(`Résumé généré avec succès`, { 
    jobId: job.id,
    articleId: result.articleId,
    summaryLength: result.summaryLength,
    duration: job.finishedOn ? job.finishedOn - job.processedOn! : 0
  });
});

summaryWorker.on('failed', (job, err) => {
  logger.error(`Échec de génération de résumé`, err, { 
    jobId: job?.id,
    articleId: job?.data?.articleId,
    attempts: job?.attemptsMade 
  });
});

summaryWorker.on('stalled', (jobId) => {
  logger.warn(`Job de résumé bloqué: ${jobId}`);
});

summaryWorker.on('progress', (job, progress) => {
  logger.debug(`Progrès résumé ${job.data.articleId}: ${progress}%`, { jobId: job.id });
});

// Arrêt gracieux
process.on('SIGTERM', async () => {
  logger.info('Arrêt du worker de résumé...');
  await summaryWorker.close();
});

process.on('SIGINT', async () => {
  logger.info('Interruption du worker de résumé...');
  await summaryWorker.close();
});

export default summaryWorker;
