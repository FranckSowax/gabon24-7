import * as cron from 'node-cron';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
});

// Queue pour les tâches de génération de sondages
const pollQueue = new Queue('poll-generation', {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Questions prédéfinies pour la génération automatique
const DAILY_QUESTIONS = [
  {
    question: "Le développement du numérique au Gabon améliore-t-il vraiment la vie quotidienne des citoyens ?",
    type: 'yes_no' as const,
    options: []
  },
  {
    question: "Quelle est la priorité absolue pour l'économie gabonaise en 2025 ?",
    type: 'mcq' as const,
    options: ['Diversification économique', 'Transformation digitale', 'Agriculture durable', 'Tourisme écologique']
  },
  {
    question: "Les jeunes Gabonais ont-ils suffisamment d'opportunités d'emploi dans le pays ?",
    type: 'yes_no' as const,
    options: []
  },
  {
    question: "Quel secteur devrait recevoir le plus d'investissements publics ?",
    type: 'mcq' as const,
    options: ['Éducation', 'Santé', 'Infrastructure', 'Environnement']
  },
  {
    question: "La transition écologique est-elle compatible avec le développement économique du Gabon ?",
    type: 'yes_no' as const,
    options: []
  },
  {
    question: "Quelle mesure améliorerait le plus la qualité de vie à Libreville ?",
    type: 'mcq' as const,
    options: ['Transport public efficace', 'Plus d\'espaces verts', 'Internet haut débit', 'Centres culturels']
  },
  {
    question: "Le système éducatif gabonais prépare-t-il bien les jeunes aux défis de demain ?",
    type: 'yes_no' as const,
    options: []
  },
  {
    question: "Quelle innovation technologique aurait le plus d'impact positif au Gabon ?",
    type: 'mcq' as const,
    options: ['Télémédecine', 'E-commerce local', 'Agriculture intelligente', 'Énergies renouvelables']
  }
];

// Fonction pour générer une nouvelle question quotidienne
const generateDailyPoll = async () => {
  try {
    console.log('🗳️ Génération du sondage quotidien...');
    
    // Sélectionner une question aléatoire
    const randomQuestion = DAILY_QUESTIONS[Math.floor(Math.random() * DAILY_QUESTIONS.length)];
    
    // Ajouter la tâche à la queue
    await pollQueue.add('generate-daily-poll', {
      question: randomQuestion.question,
      poll_type: randomQuestion.type,
      options: randomQuestion.options,
      timestamp: new Date().toISOString()
    });
    
    console.log('✅ Tâche de génération de sondage ajoutée à la queue');
  } catch (error) {
    console.error('❌ Erreur lors de la génération du sondage quotidien:', error);
  }
};

// Programmer la génération quotidienne à 6h00 (timezone Africa/Libreville)
export const startPollScheduler = () => {
  console.log('📅 Démarrage du planificateur de sondages quotidiens');
  
  // Cron job pour 6h00 chaque jour (timezone Africa/Libreville: UTC+1)
  cron.schedule('0 6 * * *', generateDailyPoll, {
    scheduled: true,
    timezone: 'Africa/Libreville'
  });
  
  // Générer un sondage au démarrage si aucun sondage actif
  setTimeout(async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      // Vérifier s'il y a un sondage actif
      const { data: activePoll } = await supabase
        .from('polls')
        .select('id')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();
      
      if (!activePoll) {
        console.log('🚀 Aucun sondage actif trouvé, génération d\'un nouveau sondage...');
        await generateDailyPoll();
      }
    } catch (error) {
      console.log('ℹ️ Génération de sondage de démarrage:', error.message);
    }
  }, 5000);
  
  console.log('⏰ Planificateur configuré: génération quotidienne à 6h00 (Libreville)');
};

export { pollQueue };
