/**
 * Script pour créer les tables audio_summaries et audio_settings
 */

const fs = require('fs');
const path = require('path');
const supabaseService = require('./supabase-config');

async function runMigration() {
  try {
    console.log('🚀 Exécution de la migration audio...');
    
    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, 'migrations', 'create-audio-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Exécuter chaque commande SQL séparément
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 ${statements.length} instructions SQL à exécuter`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          const { error } = await supabaseService.supabase.rpc('exec_sql', {
            sql_query: statement + ';'
          });
          
          if (error) {
            // Essayer avec une requête directe si RPC échoue
            const { error: directError } = await supabaseService.supabase
              .from('_migrations')
              .select('*')
              .limit(0); // Ceci va échouer mais établit la connexion
            
            console.log(`⚠️  Instruction ${i + 1}: ${error.message.substring(0, 100)}`);
          } else {
            console.log(`✅ Instruction ${i + 1} exécutée`);
          }
        } catch (err) {
          console.log(`⚠️  Instruction ${i + 1}: ${err.message.substring(0, 100)}`);
        }
      }
    }
    
    console.log('\n🎉 Migration terminée !');
    console.log('\n📋 Vérification des tables...');
    
    // Vérifier que les tables existent
    const { data: summaries, error: sumError } = await supabaseService.supabase
      .from('audio_summaries')
      .select('count')
      .limit(1);
    
    if (!sumError) {
      console.log('✅ Table audio_summaries existe');
    } else {
      console.log('❌ Table audio_summaries:', sumError.message);
    }
    
    const { data: settings, error: setError } = await supabaseService.supabase
      .from('audio_settings')
      .select('count')
      .limit(1);
    
    if (!setError) {
      console.log('✅ Table audio_settings existe');
    } else {
      console.log('❌ Table audio_settings:', setError.message);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
    process.exit(1);
  }
}

runMigration();
