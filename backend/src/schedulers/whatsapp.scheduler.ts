
import cron from 'node-cron';
import { whatsAppService } from '../services/whatsapp.service';
import { logger } from '../utils/logger';

// Planifier l'envoi WhatsApp toutes les heures à xx:30
// On décale de 30min par rapport à l'enrichissement RSS (souvent à xx:00)
// pour laisser le temps à l'IA d'enrichir les articles
export const initWhatsAppScheduler = () => {
  logger.info('Initialisation du planificateur WhatsApp...');

  // Exécuter toutes les 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Démarrage de la tâche planifiée : Envoi WhatsApp');
    try {
      await whatsAppService.sendPendingArticles();
      logger.info('Tâche planifiée WhatsApp terminée');
    } catch (error) {
      logger.error('Erreur lors de la tâche planifiée WhatsApp:', error);
    }
  });

  logger.info('Planificateur WhatsApp configuré (*/15 * * * *)');
};
