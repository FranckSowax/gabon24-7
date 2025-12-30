const supabaseService = require('./supabase-config');
const ArticleAIEnrichment = require('./services/article-ai-enrichment');

async function fix() {
  const enrichmentService = new ArticleAIEnrichment();
  
  // Trouver articles avec anciennes catégories
  const { data: articles } = await supabaseService.supabase
    .from('articles')
    .select('id, title, content, summary, category')
    .or('category.eq.actualités,category.eq.Economie')
    .limit(10);
  
  console.log(`🔧 Correction de ${articles?.length || 0} articles...\n`);
  
  if (!articles || articles.length === 0) {
    console.log('✅ Aucun article à corriger !');
    return;
  }
  
  for (const article of articles) {
    const enrichment = await enrichmentService.enrichArticle(
      article.title,
      article.content || '',
      article.summary || ''
    );
    
    await supabaseService.supabase
      .from('articles')
      .update({ 
        category: enrichment.ai_category,
        sentiment_score: enrichment.ai_sentiment,
        importance: enrichment.ai_importance ? Math.max(1, Math.round(enrichment.ai_importance * 10)) : null,
        is_breaking: enrichment.ai_is_breaking,
        keywords: enrichment.ai_keywords,
        enrichment_status: 'completed',
        enriched_at: new Date().toISOString()
      })
      .eq('id', article.id);
    
    console.log(`✅ ${article.category} → ${enrichment.ai_category}: ${article.title.substring(0, 50)}...`);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n🎉 Correction terminée !');
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
