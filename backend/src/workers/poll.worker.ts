import { Worker } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Worker pour traiter les tâches de génération de sondages
const pollWorker = new Worker('poll-generation', async (job) => {
  const { question, poll_type, options, timestamp } = job.data;
  
  try {
    console.log('🔄 Traitement de la génération de sondage:', { question, poll_type });
    
    // 1. Désactiver tous les sondages précédents
    await supabase
      .from('polls')
      .update({ is_active: false })
      .eq('is_active', true);
    
    console.log('📝 Anciens sondages désactivés');
    
    // 2. Créer le nouveau sondage
    const { data: newPoll, error } = await supabase
      .from('polls')
      .insert({
        question,
        poll_type,
        options: options || [],
        is_active: true,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
        based_on_article_id: `auto_generated_${Date.now()}`
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Nouveau sondage créé:', {
      id: newPoll.id,
      question: newPoll.question,
      expires_at: newPoll.expires_at
    });
    
    return {
      success: true,
      poll_id: newPoll.id,
      message: 'Sondage quotidien généré avec succès'
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de la génération du sondage:', error);
    throw error;
  }
}, {
  connection: redisClient,
  concurrency: 1, // Un seul sondage à la fois
});

// Gestion des événements du worker
pollWorker.on('completed', (job, result) => {
  console.log(`✅ Tâche de sondage ${job.id} terminée:`, result);
});

pollWorker.on('failed', (job, err) => {
  console.error(`❌ Tâche de sondage ${job?.id} échouée:`, err.message);
});

pollWorker.on('error', (err) => {
  console.error('❌ Erreur du worker de sondages:', err);
});

export { pollWorker };
