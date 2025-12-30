/**
 * SCRIPT DE TEST ENRICHISSEMENT
 * 
 * Enrichit seulement 5 articles pour tester le système
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialisation
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function enrichArticle(article) {
  console.log(`\n📰 Article: ${article.title}`);
  console.log('⏳ Enrichissement en cours...');

  const prompt = `Analyse cet article d'actualité gabonaise:

Titre: ${article.title}
Contenu: ${article.content ? article.content.substring(0, 2000) : article.summary || ''}

Retourne un JSON avec:
{
  "category": "Politique|Économie|Sport|Société|Culture|International|Technologie|Santé|Éducation|Environnement|Justice|Sécurité",
  "summary_ai": "résumé en 2-3 phrases",
  "keywords": ["mot1", "mot2", "mot3", "mot4", "mot5"],
  "sentiment_score": nombre entre -1 et 1,
  "importance": nombre entre 1 et 10,
  "is_breaking": true ou false,
  "entities": {
    "personnes": [],
    "lieux": [],
    "organisations": []
  },
  "topic": "sujet principal"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Tu retournes UNIQUEMENT du JSON valide.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const enriched = JSON.parse(response.choices[0].message.content);

    // Mettre à jour dans Supabase
    const { error } = await supabase
      .from('articles')
      .update({
        category: enriched.category,
        summary_ai: enriched.summary_ai,
        keywords: enriched.keywords,
        sentiment_score: enriched.sentiment_score,
        importance: enriched.importance,
        is_breaking: enriched.is_breaking || false,
        entities: enriched.entities || {},
        topic: enriched.topic,
        enriched_at: new Date().toISOString(),
        enrichment_status: 'completed'
      })
      .eq('id', article.id);

    if (error) throw error;

    console.log('✅ Article enrichi avec succès!');
    console.log(`   Catégorie: ${enriched.category}`);
    console.log(`   Topic: ${enriched.topic}`);
    console.log(`   Importance: ${enriched.importance}/10`);
    console.log(`   Sentiment: ${enriched.sentiment_score}`);
    
    return { success: true, enriched };
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n🧪 TEST D\'ENRICHISSEMENT - 5 ARTICLES\n');

  try {
    // Récupérer 5 articles pending
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, title, content, summary')
      .eq('enrichment_status', 'pending')
      .limit(5);

    if (error) throw error;

    if (!articles || articles.length === 0) {
      console.log('✅ Aucun article pending à tester');
      return;
    }

    console.log(`📝 ${articles.length} articles à enrichir\n`);

    let success = 0;
    let failed = 0;

    for (const article of articles) {
      const result = await enrichArticle(article);
      if (result.success) {
        success++;
      } else {
        failed++;
      }
      
      // Pause de 1s entre chaque article
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSULTATS DU TEST');
    console.log('='.repeat(50));
    console.log(`✅ Succès: ${success}`);
    console.log(`❌ Échecs: ${failed}`);
    console.log('='.repeat(50));

    // Vérifier dans la base
    const { count } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('enrichment_status', 'completed');

    console.log(`\n✅ Total articles enrichis dans la base: ${count}\n`);

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main();
