import { Worker } from 'bullmq';
import { redis } from '../config/redis';
import { WeatherService } from '../services/weather.service';

const weatherService = new WeatherService();

// Worker pour traiter les tâches de mise à jour météo
export const weatherWorker = new Worker('weather-queue', async (job) => {
  console.log(`🌤️ Traitement tâche météo: ${job.name}`);
  
  try {
    switch (job.name) {
      case 'update-weather':
        const cities = job.data.cities || ['Libreville', 'Port-Gentil', 'Franceville'];
        await weatherService.updateWeatherData(cities);
        return { success: true, cities };
        
      default:
        throw new Error(`Type de tâche météo inconnu: ${job.name}`);
    }
  } catch (error) {
    console.error('Erreur worker météo:', error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: 1, // Une seule tâche météo à la fois
});

weatherWorker.on('completed', (job) => {
  console.log(`✅ Tâche météo terminée: ${job.name}`);
});

weatherWorker.on('failed', (job, err) => {
  console.error(`❌ Échec tâche météo ${job?.name}:`, err);
});

weatherWorker.on('error', (err) => {
  console.error('❌ Erreur worker météo:', err);
});
