const supabase = require('../supabase-config');
const GeminiRAGService = require('../services/gemini-rag.service');
const fs = require('fs');
const path = require('path');

const RAG_SYNC_BATCH_SIZE = 50;
const MIN_CONTENT_LENGTH = 100;
const STATE_FILE = path.join(__dirname, '../rag_sync_state.json');

async function syncArticlesToRAG() {
  console.log('🔄 Démarrage de la synchronisation RAG...');
  
  const ragService = new GeminiRAGService();
  
  try {
    // 1. Get Store
    const store = await ragService.getOrCreateStore();
    // console.log(`✅ Store actif: ${store.name}`);

    // 2. Determine fetch cutoff
    let lastSyncedAt = new Date(0).toISOString();
    
    if (fs.existsSync(STATE_FILE)) {
      try {
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        if (state.last_synced_at) {
          lastSyncedAt = state.last_synced_at;
          console.log(`⏱️ Dernière synchro détectée: ${lastSyncedAt}`);
        }
      } catch (e) {
        console.warn('⚠️ Fichier d\'état corrompu, redémarrage complet.');
      }
    } else {
      // If no state, let's sync last 7 days to be safe for bootstrapping
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      lastSyncedAt = sevenDaysAgo.toISOString();
      console.log(`🆕 Première synchro: récupération depuis ${lastSyncedAt}`);
    }

    // 3. Fetch unindexed articles
    const { data: articles, error } = await supabase.supabase
      .from('articles')
      .select('id, title, content, summary_ai, url, source, published_at, category')
      .gt('published_at', lastSyncedAt)
      .order('published_at', { ascending: true }) // Oldest first to update state progressively
      .limit(100); // Process in chunks of 100 max per run to avoid timeouts

    if (error) throw error;
    
    if (!articles || articles.length === 0) {
      // console.log('Aucun nouvel article à synchroniser.');
      return;
    }

    console.log(`📄 ${articles.length} nouveaux articles à traiter.`);

    // 4. Prepare content
    let batchContent = '';
    let count = 0;
    let maxDate = lastSyncedAt;

    for (const article of articles) {
      // Basic validation
      const content = article.content || article.summary_ai || '';
      if (content.length < MIN_CONTENT_LENGTH) continue;

      const articleText = `
Title: ${article.title}
Source: ${article.source || 'Inconnue'}
Category: ${article.category || 'Général'}
Date: ${article.published_at}
URL: ${article.url}
Content:
${content}
      `.trim();

      batchContent += articleText + '\n\n---\n\n';
      count++;
      
      // Update maxDate
      if (article.published_at > maxDate) {
        maxDate = article.published_at;
      }
    }

    if (count > 0) {
      console.log(`📤 Envoi de ${count} articles vers Gemini...`);
      await ragService.uploadContentToStore(store.name, batchContent);
      console.log('✅ Synchronisation terminée avec succès.');
      
      // 5. Update State
      fs.writeFileSync(STATE_FILE, JSON.stringify({ last_synced_at: maxDate }, null, 2));
      console.log(`💾 État mis à jour: ${maxDate}`);
    } else {
        // If we skipped all (short content), we still update timestamp to avoid looping
        if (articles.length > 0) {
             // Take the last one's date even if skipped
             const lastArticle = articles[articles.length - 1];
             if (lastArticle.published_at > maxDate) {
                 fs.writeFileSync(STATE_FILE, JSON.stringify({ last_synced_at: lastArticle.published_at }, null, 2));
                 console.log(`💾 État mis à jour (articles ignorés): ${lastArticle.published_at}`);
             }
        }
    }

  } catch (error) {
    console.error('❌ Erreur synchronisation RAG:', error);
  }
}

// Allow running directly
if (require.main === module) {
  syncArticlesToRAG()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = syncArticlesToRAG;
