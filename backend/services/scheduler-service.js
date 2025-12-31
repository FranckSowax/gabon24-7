const cron = require('node-cron');
const gameQuestionGenerator = require('./game-question-generator');

class SchedulerService {
  constructor() {
    this.jobs = [];
  }

  start() {
    console.log('⏰ Démarrage du Scheduler Service...');

    // ============================================================
    // GÉNÉRATION QUOTIDIENNE DE QUESTIONS - 1x par jour à 5h00
    // ============================================================
    // Génère 100 questions basées sur les articles des dernières 36h
    // La génération nettoie automatiquement les questions > 72h
    this.scheduleJob('0 5 * * *', async () => {
      console.log('🎮 [CRON] Génération quotidienne des questions (100 questions/jour)...');
      try {
        const count = await gameQuestionGenerator.generateDailyQuestions();
        console.log(`✅ [CRON] Génération questions terminée : ${count} nouvelles questions.`);
      } catch (error) {
        console.error('❌ [CRON] Erreur génération questions:', error);
      }
    });

    // ============================================================
    // COMPLÉMENT SI NÉCESSAIRE - 2x par jour (12h et 20h)
    // ============================================================
    // Vérifie si l'objectif quotidien n'est pas atteint et complète si nécessaire
    this.scheduleJob('0 12,20 * * *', async () => {
      console.log('🔍 [CRON] Vérification objectif quotidien...');
      try {
        const todayCount = await gameQuestionGenerator.getTodayQuestionsCount();
        if (todayCount < 100) {
          console.log(`📊 Seulement ${todayCount}/100 questions. Lancement complément...`);
          const count = await gameQuestionGenerator.generateDailyQuestions();
          console.log(`✅ [CRON] Complément terminé : ${count} questions ajoutées.`);
        } else {
          console.log(`✅ Objectif atteint : ${todayCount}/100 questions.`);
        }
      } catch (error) {
        console.error('❌ [CRON] Erreur complément questions:', error);
      }
    });

    // ============================================================
    // NETTOYAGE QUOTIDIEN - Tous les jours à 4h00
    // ============================================================
    // Supprime les questions de plus de 72h (redondant avec génération mais safety net)
    this.scheduleJob('0 4 * * *', async () => {
      console.log('🧹 [CRON] Nettoyage quotidien des anciennes questions...');
      try {
        const deleted = await gameQuestionGenerator.deleteOldQuestions();
        console.log(`🗑️ [CRON] ${deleted} questions anciennes supprimées.`);
      } catch (error) {
        console.error('❌ [CRON] Erreur nettoyage:', error);
      }
    });
    
    console.log(`✅ Scheduler démarré avec ${this.jobs.length} jobs actifs.`);
  }

  scheduleJob(expression, callback) {
    if (!cron.validate(expression)) {
      console.error(`❌ Expression Cron invalide: ${expression}`);
      return;
    }
    
    const job = cron.schedule(expression, callback);
    this.jobs.push(job);
    return job;
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    console.log('🛑 Scheduler arrêté.');
  }
}

module.exports = new SchedulerService();
