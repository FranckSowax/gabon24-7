/**
 * Script pour appliquer la migration fix_audio_summaries_language.sql
 * Corrige la colonne language qui était CHAR(1) au lieu de VARCHAR(5)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_KEY manquant dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🔧 Application de la migration fix_audio_summaries_language.sql...\n');

    // Lire le fichier SQL
    const sqlPath = path.join(__dirname, '../migrations/fix_audio_summaries_language.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Contenu de la migration:');
    console.log('─'.repeat(70));
    console.log(sql);
    console.log('─'.repeat(70));
    console.log();

    // Exécuter la migration
    console.log('⚙️  Exécution...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Si exec_sql n'existe pas, on essaie avec une requête directe
      console.log('⚠️  exec_sql non disponible, tentative requête directe...');
      
      // Extraire et exécuter chaque commande SQL séparément
      const commands = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

      for (const command of commands) {
        if (command.startsWith('DO $$')) {
          console.log('⏭️  Ignoré (DO block - à exécuter manuellement):', command.substring(0, 50) + '...');
          continue;
        }
        
        console.log('📝 Exécution:', command.substring(0, 60) + '...');
        const { error: cmdError } = await supabase.rpc('exec', { sql: command });
        
        if (cmdError) {
          console.error('❌ Erreur:', cmdError.message);
        } else {
          console.log('✅ OK');
        }
      }
    } else {
      console.log('✅ Migration appliquée avec succès!');
    }

    // Vérifier la structure de la table
    console.log('\n🔍 Vérification de la structure de la table...');
    const { data: columns, error: colError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, character_maximum_length')
      .eq('table_name', 'audio_summaries')
      .in('column_name', ['language', 'voice_used', 'time_slot']);

    if (colError) {
      console.error('❌ Erreur vérification:', colError.message);
    } else {
      console.log('\n📊 Colonnes audio_summaries:');
      console.log('─'.repeat(70));
      columns?.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`);
      });
      console.log('─'.repeat(70));
    }

    console.log('\n✅ Migration terminée!');
    console.log('\n💡 Si "DO block" a été ignoré, exécutez-le manuellement dans Supabase SQL Editor.');

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

applyMigration();
