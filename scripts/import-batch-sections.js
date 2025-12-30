const fs = require('fs');
const path = require('path');

// Lit le fichier SQL généré et le divise en sections plus petites pour MCP
function createSmallBatchSections() {
  const sqlFile = path.join(__dirname, 'massive-import.sql');
  const content = fs.readFileSync(sqlFile, 'utf8');
  
  // Split par batch
  const batches = content.split('-- Batch ').slice(1); // Remove empty first element
  
  console.log(`📦 ${batches.length} batches trouvés`);
  
  batches.forEach((batch, index) => {
    const batchNumber = index + 1;
    const batchContent = `-- Batch ${batch}`;
    
    // Extract VALUES section and split into smaller chunks of 50 articles
    const valuesMatch = batchContent.match(/VALUES\s+([\s\S]*?)ON CONFLICT/);
    if (valuesMatch) {
      const valuesContent = valuesMatch[1].trim();
      
      // Split individual value entries (each article is wrapped in parentheses)
      const valueEntries = [];
      let currentEntry = '';
      let parenCount = 0;
      let inString = false;
      let escaping = false;
      
      for (let i = 0; i < valuesContent.length; i++) {
        const char = valuesContent[i];
        
        if (escaping) {
          currentEntry += char;
          escaping = false;
          continue;
        }
        
        if (char === '\\') {
          escaping = true;
          currentEntry += char;
          continue;
        }
        
        if (char === "'" && !escaping) {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '(') parenCount++;
          if (char === ')') parenCount--;
        }
        
        currentEntry += char;
        
        if (!inString && parenCount === 0 && char === ')') {
          // End of an entry
          valueEntries.push(currentEntry.trim().replace(/,$/, '').replace(/^,/, ''));
          currentEntry = '';
        }
      }
      
      // Create sections of 50 articles each
      const sectionSize = 50;
      for (let i = 0; i < valueEntries.length; i += sectionSize) {
        const sectionEntries = valueEntries.slice(i, i + sectionSize);
        const sectionNumber = Math.floor(i / sectionSize) + 1;
        const totalSections = Math.ceil(valueEntries.length / sectionSize);
        
        const sectionSQL = `-- Batch ${batchNumber} - Section ${sectionNumber}/${totalSections} (${sectionEntries.length} articles)

INSERT INTO articles (
  id, title, summary, url, author, category, 
  published_at, created_at, keywords, sentiment_confidence, 
  image_url, ai_summary
) VALUES ${sectionEntries.join(',\n')}
ON CONFLICT (id) DO NOTHING;

`;
        
        const fileName = `batch-${batchNumber}-section-${sectionNumber}.sql`;
        fs.writeFileSync(path.join(__dirname, fileName), sectionSQL);
        console.log(`💾 Créé: ${fileName} (${sectionEntries.length} articles)`);
      }
    }
  });
}

// Génère la liste des commandes pour copy-paste
function generateCommandList() {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.startsWith('batch-') && f.endsWith('.sql'))
    .sort((a, b) => {
      const aMatch = a.match(/batch-(\d+)-section-(\d+)/);
      const bMatch = b.match(/batch-(\d+)-section-(\d+)/);
      if (!aMatch || !bMatch) return 0;
      
      const aBatch = parseInt(aMatch[1]);
      const bBatch = parseInt(bMatch[1]);
      const aSection = parseInt(aMatch[2]);
      const bSection = parseInt(bMatch[2]);
      
      if (aBatch !== bBatch) return aBatch - bBatch;
      return aSection - bSection;
    });
  
  console.log('\n📋 Fichiers SQL générés:');
  files.forEach(file => {
    console.log(`   ${file}`);
  });
  
  return files;
}

if (require.main === module) {
  createSmallBatchSections();
  generateCommandList();
}

module.exports = { createSmallBatchSections, generateCommandList };
