const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Script pour importer massivement le CSV via MCP Supabase
async function importMassiveCSV() {
  console.log('🚀 Démarrage de l\'importation massive du CSV...');
  
  const csvPath = path.join(__dirname, '../documentations/GBI - Feuille 1.csv');
  const articles = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv({
        separator: ',',
        skipEmptyLines: true,
        headers: ['date_article', 'id_article', 'media', 'titre', 'secteur', 'resume', 'url', 'statut', 'html', 'idees', 'perime']
      }))
      .on('data', (row) => {
        // Skip header row
        if (row.date_article === 'DATE ARTICLE ') return;
        
        // Parse et valide les données
        if (row.titre && row.titre.trim() && row.url && row.url.trim()) {
          // Génère un UUID v4 simple
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          
          // Parse la date
          let publishedDate = new Date();
          if (row.date_article && row.date_article.trim()) {
            const dateMatch = row.date_article.match(/(\d{2})-(\d{2})-(\d{4})/);
            if (dateMatch) {
              publishedDate = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
            }
          }
          
          articles.push({
            id: uuid,
            title: row.titre.trim().substring(0, 500),
            summary: row.resume ? row.resume.trim().substring(0, 1000) : '',
            url: row.url.trim(),
            author: row.media ? row.media.trim() : 'Source inconnue',
            category: row.secteur ? row.secteur.trim() : 'Business Intelligence',
            published_at: publishedDate.toISOString(),
            created_at: new Date().toISOString(),
            keywords: [],
            sentiment_confidence: 0.5,
            image_url: null,
            ai_summary: null
          });
        }
      })
      .on('end', () => {
        console.log(`📊 ${articles.length} articles extraits du CSV`);
        resolve(articles);
      })
      .on('error', reject);
  });
}

// Génère les commandes SQL pour insertion par batch
function generateBatchInsertSQL(articles, batchSize = 1000) {
  const batches = [];
  
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    const values = batch.map(article => {
      const escapedTitle = article.title.replace(/'/g, "''");
      const escapedSummary = article.summary.replace(/'/g, "''");
      const escapedAuthor = article.author.replace(/'/g, "''");
      const escapedCategory = article.category.replace(/'/g, "''");
      const escapedUrl = article.url.replace(/'/g, "''");
      
      return `(
        '${article.id}',
        '${escapedTitle}',
        '${escapedSummary}',
        '${escapedUrl}',
        '${escapedAuthor}',
        '${escapedCategory}',
        '${article.published_at}',
        '${article.created_at}',
        '{}',
        ${article.sentiment_confidence},
        null,
        null
      )`;
    }).join(',\n');
    
    const sql = `
INSERT INTO articles (
  id, title, summary, url, author, category, 
  published_at, created_at, keywords, sentiment_confidence, 
  image_url, ai_summary
) VALUES ${values}
ON CONFLICT (id) DO NOTHING;`;
    
    batches.push({
      batchNumber: Math.floor(i / batchSize) + 1,
      totalBatches: Math.ceil(articles.length / batchSize),
      articlesCount: batch.length,
      sql: sql
    });
  }
  
  return batches;
}

// Export pour utilisation externe
module.exports = {
  importMassiveCSV,
  generateBatchInsertSQL
};

// Execution directe si script appelé
if (require.main === module) {
  importMassiveCSV()
    .then(articles => {
      console.log(`✅ ${articles.length} articles prêts pour importation`);
      
      const batches = generateBatchInsertSQL(articles, 1000);
      console.log(`📦 ${batches.length} batches générés`);
      
      // Sauvegarde des commandes SQL dans un fichier
      const sqlOutput = batches.map((batch, index) => {
        return `-- Batch ${batch.batchNumber}/${batch.totalBatches} (${batch.articlesCount} articles)\n${batch.sql}\n`;
      }).join('\n');
      
      fs.writeFileSync(path.join(__dirname, 'massive-import.sql'), sqlOutput);
      console.log('💾 Fichier massive-import.sql généré');
      
      console.log('\n🔧 Pour exécuter l\'importation, utilisez MCP Supabase avec ces commandes SQL par batch');
    })
    .catch(console.error);
}
