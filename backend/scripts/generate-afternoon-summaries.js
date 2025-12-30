#!/usr/bin/env node
/**
 * ☀️ Script Cron: Génération résumés de l'après-midi (13h)
 * Usage: node scripts/generate-afternoon-summaries.js
 */

const supabaseService = require('../supabase-config');
const { generateMultilingualSummaries } = require('../services/audio-scheduler');

async function main() {
  const startTime = new Date();
  console.log('\n' + '='.repeat(70));
  console.log('☀️  CRON JOB: RÉSUMÉS DE L\'APRÈS-MIDI (13H00)');
  console.log('='.repeat(70));
  console.log(`⏰ Démarrage: ${startTime.toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })}`);
  console.log(`📍 Timezone: Africa/Libreville (WAT)`);
  console.log(`🌍 Langues: Français, English, 中文\n`);

  try {
    // Logger le déclenchement
    await supabaseService.supabase
      .from('cron_logs')
      .insert({
        job_name: 'afternoon-summaries',
        job_type: 'audio_generation',
        time_slot: 'afternoon',
        status: 'started',
        triggered_at: new Date().toISOString(),
        metadata: { 
          languages: ['fr', 'en', 'zh'],
          source: 'railway_cron'
        }
      });

    // Générer les résumés multilingues
    const summaries = await generateMultilingualSummaries('afternoon');
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log('\n' + '='.repeat(70));
    console.log('✅ GÉNÉRATION TERMINÉE');
    console.log('='.repeat(70));
    console.log(`⏱️  Durée: ${duration}s`);
    console.log(`📊 Résumés créés: ${summaries.length}/3`);
    summaries.forEach(s => {
      const flag = { fr: '🇫🇷', en: '🇺🇸', zh: '🇨🇳' }[s.language] || '🏳️';
      console.log(`   ${flag} ${s.language.toUpperCase()}: ${s.id}`);
    });
    console.log('='.repeat(70) + '\n');

    // Logger le succès
    await supabaseService.supabase
      .from('cron_logs')
      .insert({
        job_name: 'afternoon-summaries',
        job_type: 'audio_generation',
        time_slot: 'afternoon',
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
        metadata: { 
          summaries: summaries,
          languages_generated: summaries.map(s => s.language),
          success_count: summaries.length
        }
      });

    process.exit(0);

  } catch (error) {
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    console.error('\n' + '='.repeat(70));
    console.error('❌ ERREUR GÉNÉRATION RÉSUMÉS APRÈS-MIDI');
    console.error('='.repeat(70));
    console.error(`⏱️  Durée: ${duration}s`);
    console.error(`❌ Erreur: ${error.message}`);
    console.error(`📍 Stack:`, error.stack);
    console.error('='.repeat(70) + '\n');

    // Logger l'erreur
    await supabaseService.supabase
      .from('cron_logs')
      .insert({
        job_name: 'afternoon-summaries',
        job_type: 'audio_generation',
        time_slot: 'afternoon',
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_seconds: duration,
        error_message: error.message,
        metadata: { 
          error_stack: error.stack,
          source: 'railway_cron'
        }
      });

    process.exit(1);
  }
}

main();
