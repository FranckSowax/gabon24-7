/**
 * 🚀 ENRICHISSEMENT RAPIDE DES DERNIERS ARTICLES
 * Enrichit tous les articles non enrichis des dernières heures
 */

const ArticleAIEnrichment = require('./services/article-ai-enrichment');
const supabaseService = require('./supabase-config');

const DELAY_BETWEEN_ARTICLES = 800; // 0.8 seconde entre articles

class LatestArticlesEnrichment {
  constructor() {
    this.enrichmentService = new ArticleAIEnrichment();
    this.stats = { total: 0, enriched: 0, errors: 0, startTime: Date.now() };
  }

  async sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async start() {
    console.log('\n🚀 ENRICHISSEMENT DES DERNIERS ARTICLES NON ENRICHIS');
    console.log('='.repeat(80));
    
    try {
      // Récupérer tous les articles sans ai_category (peu importe la date)
      const { data: articlesToEnrich, error } = await supabaseService.supabase
        .from('articles')
        .select('id, title, content, summary, ai_summary, created_at')
        .is('ai_category', null)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(100); // Limiter aux 100 plus récents non enrichis

      if (error) { 
        console.error('❌ Erreur:', error.message); 
        return; 
      }

      this.stats.total = articlesToEnrich?.length || 0;
      
      console.log(`\n📋 Articles à enrichir: ${this.stats.total}`);
      console.log(`⏱️  Temps estimé: ~${Math.ceil((this.stats.total * 2) / 60)} minutes`);
      console.log(`💰 Coût OpenAI: $${(this.stats.total * 0.00006).toFixed(4)}\n`);

      if (this.stats.total === 0) {
        console.log('✅ Tous les articles sont déjà enrichis !');
        return;
      }

      console.log('Démarrage...\n');
      await this.sleep(1000);

      for (let i = 0; i < articlesToEnrich.length; i++) {
        try {
          await this.enrichArticle(articlesToEnrich[i], i + 1);
          this.stats.enriched++;
        } catch (error) {
          console.error(`❌ Erreur: ${error.message}`);
          this.stats.errors++;
        }
        await this.sleep(DELAY_BETWEEN_ARTICLES);
      }

      console.log('\n' + '='.repeat(80));
      console.log('✅ ENRICHISSEMENT TERMINÉ !');
      this.displayStats();

    } catch (error) {
      console.error('\n❌ ERREUR:', error);
      process.exit(1);
    }
  }

  async enrichArticle(article, index) {
    const startTime = Date.now();
    console.log(`[${index}/${this.stats.total}] "${article.title.substring(0, 60)}..."`);

    const enrichment = await this.enrichmentService.enrichArticle(
      article.title,
      article.content || '',
      article.summary || article.ai_summary || ''
    );

    const { error } = await supabaseService.supabase
      .from('articles')
      .update({
        category: enrichment.ai_category, // 🎯 Synchroniser avec catégorie IA
        ai_category: enrichment.ai_category,
        ai_sentiment: enrichment.ai_sentiment,
        ai_importance: enrichment.ai_importance,
        ai_is_breaking: enrichment.ai_is_breaking,
        ai_keywords: enrichment.ai_keywords
      })
      .eq('id', article.id);

    if (error) throw new Error(error.message);

    const elapsed = Date.now() - startTime;
    console.log(`   ✅ ${enrichment.ai_category} | Sent: ${enrichment.ai_sentiment?.toFixed(2)} | Imp: ${enrichment.ai_importance?.toFixed(2)} | Breaking: ${enrichment.ai_is_breaking ? '🔥' : '—'} (${(elapsed / 1000).toFixed(1)}s)`);
  }

  displayStats() {
    const elapsed = Date.now() - this.stats.startTime;
    const min = Math.floor(elapsed / 60000);
    const sec = Math.floor((elapsed % 60000) / 1000);
    console.log(`\n📊 ${this.stats.enriched} enrichis | ${this.stats.errors} erreurs | ⏱️ ${min}m ${sec}s\n`);
  }
}

const enricher = new LatestArticlesEnrichment();
enricher.start()
  .then(() => { console.log('🎉 Terminé !\n'); process.exit(0); })
  .catch(error => { console.error('❌', error); process.exit(1); });
