import cron from 'node-cron';
import { Queue } from 'bullmq';
import { redis } from '../config/redis';

// Queue pour les tâches météo
const weatherQueue = new Queue('weather-queue', {
  connection: redis,
});

/**
 * Planificateur pour mettre à jour les données météo 2 fois par jour
 * - 08:00 (matin)
 * - 20:00 (soir)
 */
export function initWeatherScheduler() {
  console.log('🌤️ Initialisation du planificateur météo...');

  // Mise à jour météo à 08:00 tous les jours
  cron.schedule('0 8 * * *', async () => {
    console.log('🌅 Mise à jour météo matinale programmée');
    try {
      await weatherQueue.add('update-weather', {
        cities: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem'],
        schedule: 'morning'
      });
    } catch (error) {
      console.error('Erreur planification météo matinale:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Libreville"
  });

  // Mise à jour météo à 20:00 tous les jours
  cron.schedule('0 20 * * *', async () => {
    console.log('🌆 Mise à jour météo du soir programmée');
    try {
      await weatherQueue.add('update-weather', {
        cities: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem'],
        schedule: 'evening'
      });
    } catch (error) {
      console.error('Erreur planification météo du soir:', error);
    }
  }, {
    scheduled: true,
    timezone: "Africa/Libreville"
  });

  // Mise à jour initiale au démarrage (si pas de données récentes)
  setTimeout(async () => {
    console.log('🚀 Vérification données météo au démarrage...');
    try {
      await weatherQueue.add('update-weather', {
        cities: ['Libreville'],
        schedule: 'startup'
      });
    } catch (error) {
      console.error('Erreur mise à jour météo initiale:', error);
    }
  }, 5000); // Attendre 5 secondes après le démarrage

  console.log('✅ Planificateur météo initialisé (08:00 et 20:00 quotidien)');
}
