const { importMassiveCSV } = require('./import-csv-massive');

// Import les articles restants du CSV en créant un gros fichier SQL pour import direct
async function createBulkImportSQL() {
  console.log('🚀 Création du fichier SQL pour import en masse...');
  
  const articles = await importMassiveCSV();
  console.log(`📊 ${articles.length} articles à traiter`);
  
  // Prendre seulement les articles non encore importés (skip les 25 premiers)
  const remainingArticles = articles.slice(25);
  console.log(`📝 ${remainingArticles.length} articles restants à importer`);
  
  // Créer des batches de 100 articles pour éviter les timeouts MCP
  const batchSize = 100;
  let sqlContent = '-- IMPORTATION MASSIVE DES ARTICLES CSV RESTANTS\n\n';
  
  for (let i = 0; i < remainingArticles.length; i += batchSize) {
    const batch = remainingArticles.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(remainingArticles.length / batchSize);
    
    // Générer les VALUES pour ce batch
    const values = batch.map(article => {
      const escapedTitle = article.title.replace(/'/g, "''").substring(0, 500);
      const escapedSummary = article.summary.replace(/'/g, "''").substring(0, 1000);
      const escapedAuthor = article.author.replace(/'/g, "''");
      const escapedCategory = article.category.replace(/'/g, "''");
      const escapedUrl = article.url.replace(/'/g, "''");
      
      return `(uuid_generate_v4(), '${escapedTitle}', '${escapedSummary}', '${escapedUrl}', '${escapedAuthor}', '${escapedCategory}', '${article.published_at}', NOW(), '{}', ${article.sentiment_confidence}, null, null)`;
    }).join(',\n  ');
    
    sqlContent += `-- Batch ${batchNumber}/${totalBatches} (${batch.length} articles)
INSERT INTO articles (
  id, title, summary, url, author, category, 
  published_at, created_at, keywords, sentiment_confidence, 
  image_url, ai_summary
) VALUES 
  ${values};

`;
  }
  
  // Ajouter une vérification finale
  sqlContent += `
-- Vérification finale
SELECT COUNT(*) as total_articles_apres_import FROM articles;
SELECT COUNT(*) as articles_csv_importes FROM articles WHERE author IN ('Direct infos Gabon', 'Les Echos de l''Eco', 'Gabon Review', 'Gabonews', 'Gabon Media Time', 'L''Union', 'Media Poste Gabon', 'Gabon Actu', 'Kongossa News', 'Dépêche 241');
`;
  
  // Sauvegarder le fichier
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(path.join(__dirname, 'bulk-import-remaining.sql'), sqlContent);
  
  console.log('💾 Fichier bulk-import-remaining.sql créé');
  console.log(`📈 ${Math.ceil(remainingArticles.length / batchSize)} batches de ${batchSize} articles`);
  console.log('✅ Prêt pour importation massive via MCP');
  
  return {
    totalArticles: remainingArticles.length,
    batches: Math.ceil(remainingArticles.length / batchSize),
    fileName: 'bulk-import-remaining.sql'
  };
}

if (require.main === module) {
  createBulkImportSQL().catch(console.error);
}

module.exports = { createBulkImportSQL };
