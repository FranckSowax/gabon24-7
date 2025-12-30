const { importMassiveCSV } = require('./import-csv-massive');

// Script pour importer les articles du CSV via MCP Supabase par batches
async function createMCPImportBatches() {
  console.log('🚀 Création des batches MCP pour importation...');
  
  const articles = await importMassiveCSV();
  console.log(`📊 ${articles.length} articles à importer`);
  
  const batchSize = 10; // Taille optimale pour MCP Supabase
  const batches = [];
  
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(articles.length / batchSize);
    
    // Génère les VALUES pour ce batch
    const values = batch.map(article => {
      const escapedTitle = article.title.replace(/'/g, "''");
      const escapedSummary = article.summary.replace(/'/g, "''");
      const escapedAuthor = article.author.replace(/'/g, "''");
      const escapedCategory = article.category.replace(/'/g, "''");
      const escapedUrl = article.url.replace(/'/g, "''");
      
      return `(uuid_generate_v4(), '${escapedTitle}', '${escapedSummary}', '${escapedUrl}', '${escapedAuthor}', '${escapedCategory}', '${article.published_at}', NOW(), '{}', ${article.sentiment_confidence}, null, null)`;
    }).join(',\n');
    
    const sql = `-- Batch ${batchNumber}/${totalBatches} (${batch.length} articles)
INSERT INTO articles (
  id, title, summary, url, author, category, 
  published_at, created_at, keywords, sentiment_confidence, 
  image_url, ai_summary
) VALUES 
${values};`;
    
    batches.push({
      batchNumber,
      totalBatches,
      articlesCount: batch.length,
      sql: sql
    });
  }
  
  return batches;
}

// Affiche les commandes MCP à exécuter
async function showMCPCommands() {
  const batches = await createMCPImportBatches();
  
  console.log(`\n📦 ${batches.length} batches générés pour MCP`);
  console.log('\n🔧 Commandes MCP à exécuter:');
  
  // Affiche les 10 premiers batches pour commencer
  const firstBatches = batches.slice(0, 10);
  
  firstBatches.forEach((batch, index) => {
    console.log(`\n--- BATCH ${batch.batchNumber} (${batch.articlesCount} articles) ---`);
    console.log(batch.sql);
    console.log('');
  });
  
  console.log(`\n💡 Affichage des 10 premiers batches sur ${batches.length} total`);
  console.log('✅ Exécutez ces commandes SQL via MCP Supabase une par une');
  
  return batches;
}

if (require.main === module) {
  showMCPCommands().catch(console.error);
}

module.exports = { createMCPImportBatches, showMCPCommands };
