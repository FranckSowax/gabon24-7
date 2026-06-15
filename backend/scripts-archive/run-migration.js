/**
 * Script d'execution de la migration de nettoyage des colonnes en doublon
 * Usage: node run-migration.js
 */

const fs = require('fs');
const path = require('path');
const supabaseService = require('./supabase-config');

async function runMigration() {
  console.log('==============================================');
  console.log('MIGRATION: Nettoyage des colonnes en doublon');
  console.log('==============================================\n');

  try {
    // Lire le fichier SQL
    const migrationPath = path.join(__dirname, 'migrations', 'cleanup_duplicate_columns.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Fichier de migration charge');
    console.log('📡 Connexion a Supabase...\n');

    // Executer la migration
    const { data, error } = await supabaseService.supabase.rpc('exec_sql', {
      sql_query: sql
    });

    if (error) {
      // Si la fonction RPC n'existe pas, essayer d'executer ligne par ligne
      console.log('⚠️  Fonction RPC non disponible, execution directe...\n');
      
      // Separer les commandes SQL
      const commands = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd && !cmd.startsWith('--') && cmd !== 'BEGIN' && cmd !== 'COMMIT');
      
      console.log(`📊 ${commands.length} commandes SQL a executer\n`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        console.log(`[${i + 1}/${commands.length}] Execution...`);
        
        try {
          const { error: cmdError } = await supabaseService.supabase.rpc('exec', { 
            query: cmd 
          });
          
          if (cmdError) {
            console.log(`   ⚠️  Avertissement: ${cmdError.message}`);
            errorCount++;
          } else {
            console.log(`   ✅ OK`);
            successCount++;
          }
        } catch (e) {
          console.log(`   ❌ Erreur: ${e.message}`);
          errorCount++;
        }
      }
      
      console.log(`\n📊 Resultat: ${successCount} OK, ${errorCount} erreurs`);
    } else {
      console.log('✅ Migration executee avec succes!');
    }

    // Verifier les resultats
    console.log('\n🔍 Verification des colonnes...\n');
    
    const { data: columns, error: colError } = await supabaseService.supabase
      .from('articles')
      .select('id, category, ai_category, keywords, ai_keywords, sentiment, ai_sentiment, image_url, image_urls, normalized_url, source')
      .limit(5);
    
    if (colError) {
      console.log('❌ Erreur verification:', colError.message);
    } else {
      console.log('✅ Colonnes accessibles:');
      if (columns && columns.length > 0) {
        const sample = columns[0];
        console.log('   - ai_category:', sample.ai_category ? '✅' : '❌');
        console.log('   - ai_keywords:', sample.ai_keywords ? '✅' : '❌');
        console.log('   - ai_sentiment:', sample.ai_sentiment !== null ? '✅' : '❌');
        console.log('   - image_url:', sample.image_url ? '✅' : '❌');
        console.log('   - normalized_url:', sample.normalized_url ? '✅' : '❌');
        console.log('   - source:', sample.source ? '✅' : '❌');
      }
    }
    
    console.log('\n==============================================');
    console.log('✅ MIGRATION TERMINEE');
    console.log('==============================================');
    
  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executer la migration
runMigration();
