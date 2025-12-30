const cron = require('node-cron');
const whapiService = require('../services/whapiService');

/**
 * Initialise le planificateur pour les envois WhatsApp
 */
function initWhatsAppScheduler() {
  console.log('Initialisation du planificateur WhatsApp...');

  // Exécuter toutes les 15 minutes
  // Format cron: minute hour day-of-month month day-of-week
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ Démarrage de la tâche planifiée : Envoi WhatsApp');
    try {
      await whapiService.sendPendingArticles();
      console.log('✅ Tâche planifiée WhatsApp terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la tâche planifiée WhatsApp:', error);
    }
  });

  console.log('✅ Planificateur WhatsApp configuré (*/15 * * * *)');
}

module.exports = {
  initWhatsAppScheduler
};
