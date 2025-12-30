const cron = require('node-cron');
const gameQuestionGenerator = require('./game-question-generator');

class SchedulerService {
  constructor() {
    this.jobs = [];
  }

  start() {
    console.log('⏰ Démarrage du Scheduler Service...');

    // ============================================================
    // GÉNÉRATION DE QUESTIONS DE JEU - 2x par jour (6h et 18h)
    // ============================================================
    // Réduit pour économiser le quota Gemini API
    // Génère des questions basées sur les articles des dernières 36h
    this.scheduleJob('5 6,18 * * *', async () => {
      console.log('🎮 [CRON] Lancement génération automatique des questions (2x/jour)...');
      try {
        const count = await gameQuestionGenerator.generateDailyQuestions();
        console.log(`✅ [CRON] Génération questions terminée : ${count} nouvelles questions.`);
      } catch (error) {
        console.error('❌ [CRON] Erreur génération questions:', error);
      }
    });

    // ============================================================
    // MONITORING POOL QUESTIONS - Toutes les 6 heures
    // ============================================================
    // Vérifie si le stock de questions est bas (< 30) et recharge si nécessaire
    // Réduit de 15min à 6h pour économiser le quota
    this.scheduleJob('0 */6 * * *', async () => {
      try {
        await gameQuestionGenerator.checkAndRefill(30);
      } catch (error) {
        console.error('❌ [CRON] Erreur monitoring pool:', error);
      }
    });

    // ============================================================
    // NETTOYAGE SESSIONS - Tous les jours à 04:00
    // ============================================================
    this.scheduleJob('0 4 * * *', async () => {
      console.log('🧹 [CRON] Nettoyage maintenance...');
      // Ici on pourrait nettoyer les vieilles sessions ou questions trop vieilles
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
