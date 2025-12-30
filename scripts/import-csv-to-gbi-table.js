const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Configuration Supabase
const supabaseUrl = 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMzMjk3MjYsImV4cCI6MjAzODkwNTcyNn0.pI0SNv0aLFHtPl7tnN-FUlYzQ-LCwMXN5s_MDLwF4d0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importCSVToGBITable() {
  console.log('🚀 Import du fichier CSV GBI - Feuille 1 dans la table dédiée...');
  
  const csvPath = path.join(__dirname, '../documentations/GBI - Feuille 1.csv');
  const records = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv({
        separator: ',',
        skipEmptyLines: true,
        headers: [
          'date_article', 'id_article', 'media', 'titre', 
          'secteur_activite', 'resume', 'url', 'statut', 
          'article_html', 'idees_business', 'perime'
        ]
      }))
      .on('data', (row) => {
        // Skip header row
        if (row.date_article === 'DATE ARTICLE ') return;
        
        // Nettoyer et valider les données
        if (row.titre && row.titre.trim() && row.url && row.url.trim()) {
          records.push({
            date_article: row.date_article?.trim() || null,
            id_article: row.id_article?.trim() || null,
            media: row.media?.trim() || null,
            titre: row.titre?.trim().substring(0, 1000) || null,
            secteur_activite: row.secteur_activite?.trim() || null,
            resume: row.resume?.trim().substring(0, 2000) || null,
            url: row.url?.trim() || null,
            statut: row.statut?.trim() || null,
            article_html: row.article_html?.trim() || null,
            idees_business: row.idees_business?.trim() || null,
            perime: row.perime?.trim() || null
          });
        }
      })
      .on('end', async () => {
        console.log(`📊 ${records.length} enregistrements CSV extraits`);
        
        try {
          // Vider la table d'abord
          console.log('🧹 Nettoyage de la table csv_articles_gbi...');
          const { error: deleteError } = await supabase
            .from('csv_articles_gbi')
            .delete()
            .neq('id', 0); // Delete all
            
          if (deleteError && deleteError.code !== 'PGRST116') {
            console.error('Erreur lors du nettoyage:', deleteError);
          }
          
          // Importer par batches
          const batchSize = 100;
          let importedCount = 0;
          
          for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            
            console.log(`📤 Import batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(records.length/batchSize)} (${batch.length} enregistrements)`);
            
            const { data, error } = await supabase
              .from('csv_articles_gbi')
              .insert(batch);
              
            if (error) {
              console.error(`❌ Erreur batch ${Math.floor(i/batchSize) + 1}:`, error.message);
            } else {
              importedCount += batch.length;
              console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} importé: ${batch.length} enregistrements`);
            }
            
            // Pause entre batches
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          console.log(`\n🎉 Import terminé! ${importedCount} enregistrements importés`);
          
          // Synchroniser avec la table articles
          console.log('\n🔄 Synchronisation vers la table articles...');
          const { data: syncResult, error: syncError } = await supabase
            .rpc('sync_csv_to_articles');
            
          if (syncError) {
            console.error('❌ Erreur de synchronisation:', syncError);
          } else {
            console.log('✅ Synchronisation terminée:', syncResult);
          }
          
          resolve(importedCount);
          
        } catch (error) {
          console.error('❌ Erreur lors de l\'import:', error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Fonction pour synchroniser manuellement
async function syncCSVToArticles() {
  console.log('🔄 Synchronisation CSV vers articles...');
  
  const { data, error } = await supabase.rpc('sync_csv_to_articles');
  
  if (error) {
    console.error('❌ Erreur de synchronisation:', error);
    return false;
  }
  
  console.log('✅ Synchronisation terminée:', data);
  return true;
}

// Fonction pour voir les statistiques
async function showStats() {
  const { data: csvCount } = await supabase
    .from('csv_articles_gbi')
    .select('id', { count: 'exact' });
    
  const { data: syncedCount } = await supabase
    .from('csv_articles_gbi')
    .select('id', { count: 'exact' })
    .eq('synced_to_articles', true);
    
  console.log(`📊 Statistiques:`);
  console.log(`   CSV importés: ${csvCount.length || 0}`);
  console.log(`   Synchronisés: ${syncedCount.length || 0}`);
}

if (require.main === module) {
  const action = process.argv[2];
  
  switch (action) {
    case 'import':
      importCSVToGBITable().catch(console.error);
      break;
    case 'sync':
      syncCSVToArticles().catch(console.error);
      break;
    case 'stats':
      showStats().catch(console.error);
      break;
    default:
      console.log('Usage: node import-csv-to-gbi-table.js [import|sync|stats]');
      console.log('  import - Importe le CSV dans la table csv_articles_gbi');
      console.log('  sync   - Synchronise CSV vers la table articles');
      console.log('  stats  - Affiche les statistiques');
  }
}

module.exports = { importCSVToGBITable, syncCSVToArticles, showStats };
