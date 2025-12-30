/**
 * SCRIPT D'ENRICHISSEMENT MASSIF DES ARTICLES
 * 
 * Enrichit tous les articles en statut "pending" avec l'IA
 * Traite par batch de 10 articles à la fois
 * Coût estimé: ~$1.20 pour 12,134 articles
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const BATCH_SIZE = 10; // Articles par batch
const DELAY_BETWEEN_BATCHES = 2000; // 2 secondes entre chaque batch
const MAX_RETRIES = 3;

// Initialisation clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Statistiques
let stats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now()
};

/**
 * Enrichir un article avec l'IA
 */
async function enrichArticleWithAI(article) {
  const prompt = `Analyse cet article d'actualité gabonaise et retourne un JSON avec les métadonnées suivantes:

Titre: ${article.title}
Contenu: ${article.content ? article.content.substring(0, 3000) : article.summary || ''}

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte:
{
  "category": "une catégorie parmi: Politique, Économie, Sport, Société, Culture, International, Technologie, Santé, Éducation, Environnement, Justice, Sécurité",
  "summary_ai": "un résumé clair et concis en 2-3 phrases maximum (150 mots max)",
  "keywords": ["5 à 8 mots-clés pertinents"],
  "sentiment_score": un nombre entre -1 (très négatif) et 1 (très positif),
  "importance": un score entre 1 (peu important) et 10 (très important),
  "is_breaking": true ou false (article d'actualité urgente),
  "entities": {
    "personnes": ["noms de personnes mentionnées"],
    "lieux": ["villes, régions, pays mentionnés"],
    "organisations": ["organisations, entreprises, institutions"]
  },
  "topic": "le sujet principal en 2-4 mots"
}

Règles strictes:
- Retourne UNIQUEMENT le JSON, sans texte avant ou après
- Utilise les catégories exactes listées
- Le résumé doit être informatif et neutre
- Les keywords doivent être en français
- Le sentiment_score doit être un nombre décimal`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Tu es un expert en analyse d\'actualités. Tu retournes UNIQUEMENT du JSON valide, sans markdown ni texte supplémentaire.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const enriched = JSON.parse(content);

    // Validation basique
    if (!enriched.category || !enriched.summary_ai || !Array.isArray(enriched.keywords)) {
      throw new Error('JSON incomplet ou invalide');
    }

    return enriched;
  } catch (error) {
    console.error(`❌ Erreur enrichissement article ${article.id}:`, error.message);
    throw error;
  }
}

/**
 * Mettre à jour un article dans Supabase
 */
async function updateArticle(articleId, enrichedData) {
  const { error } = await supabase
    .from('articles')
    .update({
      category: enrichedData.category,
      summary_ai: enrichedData.summary_ai,
      keywords: enrichedData.keywords,
      sentiment_score: enrichedData.sentiment_score,
      importance: enrichedData.importance,
      is_breaking: enrichedData.is_breaking || false,
      entities: enrichedData.entities || {},
      topic: enrichedData.topic,
      enriched_at: new Date().toISOString(),
      enrichment_status: 'completed',
      enrichment_error: null,
      enrichment_retries: 0
    })
    .eq('id', articleId);

  if (error) {
    throw error;
  }
}

/**
 * Marquer un article comme échoué
 */
async function markArticleFailed(articleId, errorMessage, retries) {
  await supabase
    .from('articles')
    .update({
      enrichment_status: retries >= MAX_RETRIES ? 'failed' : 'pending',
      enrichment_error: errorMessage.substring(0, 500),
      enrichment_retries: retries + 1
    })
    .eq('id', articleId);
}

/**
 * Traiter un batch d'articles
 */
async function processBatch(articles) {
  const promises = articles.map(async (article) => {
    try {
      console.log(`⏳ Enrichissement article: ${article.title.substring(0, 60)}...`);
      
      const enriched = await enrichArticleWithAI(article);
      await updateArticle(article.id, enriched);
      
      stats.success++;
      console.log(`✅ Article enrichi: ${article.title.substring(0, 60)}...`);
      
      return { success: true, id: article.id };
    } catch (error) {
      stats.failed++;
      await markArticleFailed(article.id, error.message, article.enrichment_retries || 0);
      console.error(`❌ Échec article: ${article.title.substring(0, 60)}...`);
      
      return { success: false, id: article.id, error: error.message };
    } finally {
      stats.processed++;
    }
  });

  return Promise.all(promises);
}

/**
 * Afficher les statistiques
 */
function displayStats() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const rate = stats.processed > 0 ? Math.round(stats.processed / elapsed * 60) : 0;
  const remaining = stats.total - stats.processed;
  const eta = rate > 0 ? Math.round(remaining / rate) : 0;

  console.log('\n' + '='.repeat(60));
  console.log('📊 STATISTIQUES');
  console.log('='.repeat(60));
  console.log(`Total à traiter: ${stats.total}`);
  console.log(`Traités: ${stats.processed} / ${stats.total} (${Math.round(stats.processed / stats.total * 100)}%)`);
  console.log(`✅ Succès: ${stats.success}`);
  console.log(`❌ Échecs: ${stats.failed}`);
  console.log(`⏭️  Ignorés: ${stats.skipped}`);
  console.log(`⏱️  Temps écoulé: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`⚡ Vitesse: ${rate} articles/minute`);
  console.log(`⏳ ETA: ~${Math.floor(eta / 60)}m ${eta % 60}s`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Fonction principale
 */
async function main() {
  console.log('\n🚀 DÉMARRAGE ENRICHISSEMENT MASSIF DES ARTICLES\n');

  try {
    // 1. Compter les articles à traiter
    const { count, error: countError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'pending');

    if (countError) throw countError;

    stats.total = count;
    console.log(`📝 ${stats.total} articles à enrichir\n`);

    if (stats.total === 0) {
      console.log('✅ Aucun article à enrichir !');
      return;
    }

    // 2. Traiter par batch
    let offset = 0;
    
    while (offset < stats.total) {
      console.log(`\n📦 Batch ${Math.floor(offset / BATCH_SIZE) + 1}/${Math.ceil(stats.total / BATCH_SIZE)}`);
      
      // Récupérer le prochain batch
      const { data: articles, error: fetchError } = await supabase
        .from('articles')
        .select('id, title, content, summary, enrichment_retries')
        .eq('enrichment_status', 'pending')
        .order('published_at', { ascending: false })
        .limit(BATCH_SIZE);

      if (fetchError) throw fetchError;

      if (!articles || articles.length === 0) {
        console.log('✅ Plus d\'articles à traiter');
        break;
      }

      // Traiter le batch
      await processBatch(articles);

      // Afficher les stats
      displayStats();

      // Pause entre les batch (éviter rate limit)
      if (offset + BATCH_SIZE < stats.total) {
        console.log(`⏸️  Pause ${DELAY_BETWEEN_BATCHES}ms avant le prochain batch...\n`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }

      offset += BATCH_SIZE;
    }

    // 3. Statistiques finales
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ENRICHISSEMENT TERMINÉ !');
    console.log('='.repeat(60));
    displayStats();

    // 4. Vérifier le résultat dans la base
    const { data: finalStats } = await supabase
      .from('articles')
      .select('enrichment_status')
      .in('enrichment_status', ['completed', 'failed', 'pending']);

    const completed = finalStats?.filter(a => a.enrichment_status === 'completed').length || 0;
    const failed = finalStats?.filter(a => a.enrichment_status === 'failed').length || 0;
    const pending = finalStats?.filter(a => a.enrichment_status === 'pending').length || 0;

    console.log('\n📊 ÉTAT FINAL BASE DE DONNÉES:');
    console.log(`✅ Completed: ${completed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏳ Pending: ${pending}\n`);

    // 5. Estimation coût
    const tokensPerArticle = 700; // Estimation moyenne
    const costPer1kTokens = 0.00015; // GPT-4o-mini
    const estimatedCost = (stats.success * tokensPerArticle / 1000) * costPer1kTokens;
    console.log(`💰 Coût estimé: $${estimatedCost.toFixed(3)}\n`);

  } catch (error) {
    console.error('\n❌ ERREUR FATALE:', error.message);
    process.exit(1);
  }
}

// Gestion des interruptions
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interruption détectée. Statistiques actuelles:');
  displayStats();
  process.exit(0);
});

// Lancement
main();
