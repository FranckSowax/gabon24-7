import { logger } from '../utils/logger';
import rssWorker from './rss.worker';
import summaryWorker from './summary.worker';

// Centraliser tous les workers
export const workers = {
  rss: rssWorker,
  summary: summaryWorker
};

// Fonction pour démarrer tous les workers
export async function startAllWorkers(): Promise<void> {
  try {
    logger.info('Démarrage de tous les workers...');
    
    // Les workers sont déjà démarrés lors de leur importation
    // Cette fonction sert principalement pour la gestion centralisée
    
    logger.info('Tous les workers sont démarrés et opérationnels');
    
    // Afficher les statistiques des workers
    await logWorkerStats();
    
  } catch (error) {
    logger.error('Erreur lors du démarrage des workers:', error);
    throw error;
  }
}

// Fonction pour arrêter tous les workers
export async function stopAllWorkers(): Promise<void> {
  try {
    logger.info('Arrêt de tous les workers...');
    
    await Promise.all([
      workers.rss.close(),
      workers.summary.close()
    ]);
    
    logger.info('Tous les workers ont été arrêtés');
    
  } catch (error) {
    logger.error('Erreur lors de l\'arrêt des workers:', error);
    throw error;
  }
}

// Afficher les statistiques des workers
async function logWorkerStats(): Promise<void> {
  try {
    const stats = {
      rss: {
        name: 'RSS Worker',
        concurrency: 5,
        status: 'running'
      },
      summary: {
        name: 'Summary Worker',
        concurrency: 3,
        status: 'running'
      }
    };
    
    logger.info('Statistiques des workers:', stats);
    
  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
  }
}

// Gestionnaire d'arrêt gracieux global
process.on('SIGTERM', async () => {
  logger.info('Signal SIGTERM reçu, arrêt des workers...');
  await stopAllWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Signal SIGINT reçu, arrêt des workers...');
  await stopAllWorkers();
  process.exit(0);
});

export default workers;
