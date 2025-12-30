/**
 * Script pour vérifier si les tables audio existent
 */

const supabaseService = require('./supabase-config');

async function checkTables() {
  try {
    console.log('🔍 Vérification des tables audio...\n');
    
    // Vérifier audio_summaries
    const { data: summaries, error: sumError } = await supabaseService.supabase
      .from('audio_summaries')
      .select('*')
      .limit(1);
    
    if (!sumError) {
      console.log('✅ Table audio_summaries existe');
      console.log(`   ${summaries?.length || 0} résumé(s) trouvé(s)`);
    } else {
      console.log('❌ Table audio_summaries n\'existe pas');
      console.log(`   Erreur: ${sumError.message}`);
    }
    
    // Vérifier audio_settings
    const { data: settings, error: setError } = await supabaseService.supabase
      .from('audio_settings')
      .select('*')
      .limit(1);
    
    if (!setError) {
      console.log('✅ Table audio_settings existe');
      console.log(`   ${settings?.length || 0} paramètre(s) trouvé(s)`);
    } else {
      console.log('❌ Table audio_settings n\'existe pas');
      console.log(`   Erreur: ${setError.message}`);
    }
    
    console.log('\n📝 Instructions:');
    console.log('Si les tables n\'existent pas, créez-les via l\'interface Supabase SQL Editor');
    console.log('Fichier de migration: migrations/create-audio-tables.sql');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkTables();
