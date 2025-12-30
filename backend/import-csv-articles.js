const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration Supabase - utiliser la même config que supabase-config.js
const supabaseUrl = 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODg5MjYsImV4cCI6MjA3MDM2NDkyNn0.MLTnZFSSosMt3Lu7BeFR8LFW4ihaUo5Dx2g9sUJeHLA';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseAnonKey;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Mapping des médias vers les RSS feeds existants
const mediaMapping = {
  'Direct infos Gabon': 'Direct Infos Gabon',
  'Direct Infos Gabon': 'Direct Infos Gabon',
  'Les Echos de l\'Eco': 'Les Echos de l\'Eco',
  'Gabon Media Time': 'Gabon Media Time',
  'Gabon Review': 'Gabon Review',
  'L\'Union': 'L\'Union',
  'L\'union': 'L\'Union', // Variante minuscule
  'Media Poste Gabon': 'Media Poste Gabon',
  'Gabonews': 'Gabonews',
  'Gabon Actu': 'Gabon Actu',
  'Dépêche 241': 'Dépêche 241',
  'Kongossa News': 'Kongossa News',
  'AGP': 'AGP', // Agence Gabonaise de Presse
  'Vox Populi': 'Vox Populi',
  'Flipboard': 'Flipboard'
};

// Fonction pour nettoyer et formater le titre
function cleanTitle(title) {
  if (!title) return '';
  return title.replace(/\n|\r/g, ' ').trim();
}

// Fonction pour parser la date
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Format: "26-02-2025 02:35"
  const [datePart, timePart] = dateStr.split(' ');
  if (!datePart || !timePart) return null;
  
  const [day, month, year] = datePart.split('-');
  const [hour, minute] = timePart.split(':');
  
  // Créer la date en UTC
  const date = new Date(year, month - 1, day, hour, minute);
  return date.toISOString();
}

// Fonction pour obtenir l'ID du RSS feed
async function getRssFeedId(mediaName) {
  const mappedName = mediaMapping[mediaName];
  if (!mappedName) {
    console.log(`⚠️ Média non mappé: ${mediaName}`);
    return null;
  }
  
  const { data, error } = await supabase
    .from('rss_feeds')
    .select('id')
    .eq('name', mappedName)
    .single();
    
  if (error) {
    console.log(`❌ Erreur RSS feed pour ${mappedName}:`, error.message);
    return null;
  }
  
  return data?.id;
}

// Fonction principale d'import
async function importCsvArticles() {
  console.log('🚀 Début de l\'import des articles CSV...');
  
  const csvPath = '/Volumes/Samsung_T5/gabon-insight-main/documentations/GBI - Feuille 1.csv';
  const articles = [];
  let processedCount = 0;
  let errorCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', async (row) => {
        try {
          // Mapping des colonnes CSV
          const dateArticle = row['DATE ARTICLE '];
          const idArticle = row['ID ARTICLE '];
          const media = row['MEDIA'];
          const titre = row['TITRE '];
          const secteur = row['SECTEUR D\'ACTIVITE'];
          const resume = row['RESUME '];
          const url = row['URL '];
          const statut = row['STATUT'];
          const articleHtml = row['ARTICLE HTML '];
          
          // Validation des données essentielles
          if (!dateArticle || !titre || !media || !url) {
            console.log(`⚠️ Article incomplet ignoré: ${titre || 'Sans titre'}`);
            return;
          }
          
          // Parser la date
          const createdAt = parseDate(dateArticle);
          if (!createdAt) {
            console.log(`⚠️ Date invalide pour: ${titre}`);
            return;
          }
          
          // Obtenir l'ID du RSS feed
          const rssFeedId = await getRssFeedId(media);
          if (!rssFeedId) {
            console.log(`⚠️ RSS feed non trouvé pour: ${media}`);
            return;
          }
          
          // Préparer l'article pour insertion
          const article = {
            title: cleanTitle(titre),
            summary: resume || '',
            url: url,
            created_at: createdAt,
            published_at: createdAt,
            feed_id: rssFeedId, // Utiliser feed_id au lieu de rss_feed_id
            category: secteur || 'Autres',
            is_published: true,
            view_count: 0,
            content: articleHtml || '',
            image_url: null // Pas d'images dans le CSV
          };
          
          articles.push(article);
          processedCount++;
          
          if (processedCount % 100 === 0) {
            console.log(`📊 ${processedCount} articles traités...`);
          }
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Erreur traitement ligne:`, error.message);
        }
      })
      .on('end', async () => {
        console.log(`📋 Traitement terminé: ${processedCount} articles, ${errorCount} erreurs`);
        
        if (articles.length === 0) {
          console.log('❌ Aucun article à importer');
          resolve();
          return;
        }
        
        // Import par batch de 100
        console.log(`💾 Import de ${articles.length} articles en base...`);
        
        try {
          const batchSize = 100;
          let importedCount = 0;
          
          for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            
            const { data, error } = await supabase
              .from('articles')
              .insert(batch)
              .select('id');
              
            if (error) {
              console.error(`❌ Erreur batch ${i}-${i + batchSize}:`, error.message);
              continue;
            }
            
            importedCount += data.length;
            console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: ${data.length} articles importés`);
          }
          
          console.log(`🎉 Import terminé: ${importedCount} articles importés avec succès`);
          resolve();
          
        } catch (error) {
          console.error('❌ Erreur import:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ Erreur lecture CSV:', error);
        reject(error);
      });
  });
}

// Fonction pour vérifier les RSS feeds
async function checkRssFeeds() {
  console.log('🔍 Vérification des RSS feeds...');
  
  const { data, error } = await supabase
    .from('rss_feeds')
    .select('id, name');
    
  if (error) {
    console.error('❌ Erreur récupération RSS feeds:', error);
    return;
  }
  
  console.log('📡 RSS feeds disponibles:');
  data.forEach(feed => {
    console.log(`  - ${feed.name} (ID: ${feed.id})`);
  });
}

// Exécution du script
async function main() {
  try {
    await checkRssFeeds();
    await importCsvArticles();
    console.log('✅ Script terminé avec succès');
    process.exit(0);
  } catch (error) {
    console.error('💥 Erreur fatale:', error);
    process.exit(1);
  }
}

// Lancement si appelé directement
if (require.main === module) {
  main();
}

module.exports = { importCsvArticles, checkRssFeeds };
