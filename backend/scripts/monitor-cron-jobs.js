#!/usr/bin/env node
/**
 * 📊 Script Monitoring: Afficher logs des cron jobs
 * Usage: node scripts/monitor-cron-jobs.js [days]
 */

const supabaseService = require('../supabase-config');

async function main() {
  const days = parseInt(process.argv[2]) || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  console.log('\n' + '='.repeat(80));
  console.log(`📊 MONITORING CRON JOBS - ${days} derniers jours`);
  console.log('='.repeat(80));
  console.log(`📅 Période: ${startDate.toLocaleDateString('fr-FR')} → ${new Date().toLocaleDateString('fr-FR')}\n`);

  try {
    // Récupérer tous les logs
    const { data: logs, error } = await supabaseService.supabase
      .from('cron_logs')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération logs:', error.message);
      process.exit(1);
    }

    if (!logs || logs.length === 0) {
      console.log('⚠️  Aucun log trouvé pour cette période\n');
      process.exit(0);
    }

    // Statistiques globales
    const stats = {
      total: logs.length,
      completed: logs.filter(l => l.status === 'completed').length,
      failed: logs.filter(l => l.status === 'failed').length,
      started: logs.filter(l => l.status === 'started').length,
      byJob: {},
      byDay: {}
    };

    logs.forEach(log => {
      // Par job
      if (!stats.byJob[log.job_name]) {
        stats.byJob[log.job_name] = { total: 0, completed: 0, failed: 0, started: 0 };
      }
      stats.byJob[log.job_name].total++;
      stats.byJob[log.job_name][log.status]++;

      // Par jour
      const day = new Date(log.created_at).toLocaleDateString('fr-FR');
      if (!stats.byDay[day]) {
        stats.byDay[day] = { total: 0, completed: 0, failed: 0, started: 0 };
      }
      stats.byDay[day].total++;
      stats.byDay[day][log.status]++;
    });

    // Afficher statistiques
    console.log('📈 STATISTIQUES GLOBALES');
    console.log('-'.repeat(80));
    console.log(`Total exécutions: ${stats.total}`);
    console.log(`✅ Réussies:      ${stats.completed} (${Math.round(stats.completed/stats.total*100)}%)`);
    console.log(`❌ Échouées:      ${stats.failed} (${Math.round(stats.failed/stats.total*100)}%)`);
    console.log(`⏳ En cours:      ${stats.started} (${Math.round(stats.started/stats.total*100)}%)`);
    console.log('');

    // Par job
    console.log('📋 PAR JOB');
    console.log('-'.repeat(80));
    Object.entries(stats.byJob).forEach(([job, data]) => {
      const emoji = job.includes('morning') ? '🌅' : job.includes('afternoon') ? '☀️' : '🌙';
      console.log(`${emoji} ${job.padEnd(25)} → Total: ${data.total}, ✅ ${data.completed}, ❌ ${data.failed}, ⏳ ${data.started}`);
    });
    console.log('');

    // Par jour
    console.log('📅 PAR JOUR');
    console.log('-'.repeat(80));
    Object.entries(stats.byDay)
      .sort((a, b) => new Date(b[0].split('/').reverse().join('-')) - new Date(a[0].split('/').reverse().join('-')))
      .forEach(([day, data]) => {
        console.log(`${day.padEnd(12)} → Total: ${data.total}, ✅ ${data.completed}, ❌ ${data.failed}, ⏳ ${data.started}`);
      });
    console.log('');

    // Dernières exécutions
    console.log('🕐 DERNIÈRES EXÉCUTIONS (10 plus récentes)');
    console.log('-'.repeat(80));
    logs.slice(0, 10).forEach(log => {
      const emoji = log.status === 'completed' ? '✅' : log.status === 'failed' ? '❌' : '⏳';
      const timeEmoji = log.job_name.includes('morning') ? '🌅' : log.job_name.includes('afternoon') ? '☀️' : '🌙';
      const date = new Date(log.created_at);
      const dateStr = date.toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' });
      const duration = log.duration_seconds ? `${log.duration_seconds}s` : 'N/A';
      
      console.log(`${emoji} ${timeEmoji} ${log.job_name.padEnd(25)} | ${dateStr} | ${duration.padStart(6)}`);
      
      if (log.status === 'failed' && log.error_message) {
        console.log(`   💬 Erreur: ${log.error_message.substring(0, 100)}`);
      }
      
      if (log.status === 'completed' && log.metadata?.success_count) {
        const langs = log.metadata.languages_generated?.join(', ') || 'N/A';
        console.log(`   💬 Généré: ${log.metadata.success_count}/3 langues (${langs})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Monitoring terminé');
    console.log('='.repeat(80) + '\n');

    // Alertes si échecs récents
    const recentFailed = logs.filter(l => {
      const hoursSince = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
      return l.status === 'failed' && hoursSince < 24;
    });

    if (recentFailed.length > 0) {
      console.log('⚠️  ALERTES - Échecs dans les dernières 24h:');
      console.log('-'.repeat(80));
      recentFailed.forEach(log => {
        const date = new Date(log.created_at).toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' });
        console.log(`❌ ${log.job_name} - ${date}`);
        console.log(`   Erreur: ${log.error_message}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
