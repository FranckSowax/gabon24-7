/**
 * 🔄 ENRICHISSEMENT DES ARTICLES RÉCENTS NON ENRICHIS
 * Script pour enrichir uniquement les articles des 7 derniers jours sans métadonnées IA
 */

const ArticleAIEnrichment = require('./services/article-ai-enrichment');
const supabaseService = require('./supabase-config');

const DELAY_BETWEEN_ARTICLES = 1000;
const DAYS_TO_PROCESS = 7;

class RecentArticlesEnrichment {
  constructor() {
    this.enrichmentService = new ArticleAIEnrichment();
    this.stats = { total: 0, enriched: 0, errors: 0, startTime: Date.now() };
  }

  async sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async start() {
    console.log('\n�� ENRICHISSEMENT ARTICLES RÉCENTS NON ENRICHIS');
    console.log('='.repeat(80));
    
    try {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - DAYS_TO_PROCESS);
      
      console.log(`\n📅 Période: Articles depuis le ${dateLimit.toLocaleDateString('fr-FR')}`);
      
      const { data: articlesToEnrich, error } = await supabaseService.supabase
        .from('articles')
        .select('id, title, content, summary, ai_summary')
        .is('ai_category', null)
        .gte('published_at', dateLimit.toISOString())
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (error) { console.error('❌ Erreur:', error.message); return; }

      this.stats.total = articlesToEnrich?.length || 0;
      
      console.log(`\n📋 Articles à enrichir: ${this.stats.total}`);
      console.log(`⏱️  Temps estimé: ~${Math.ceil((this.stats.total * 2.4) / 60)} min`);
      console.log(`💰 Coût OpenAI: $${(this.stats.total * 0.00006).toFixed(4)}\n`);

      if (this.stats.total === 0) {
        console.log('✅ Tous les articles récents sont déjà enrichis !');
        return;
      }

      console.log('Démarrage dans 2 secondes...');
      await this.sleep(2000);

      for (let i = 0; i < articlesToEnrich.length; i++) {
        try {
          await this.enrichArticle(articlesToEnrich[i], i + 1);
          this.stats.enriched++;
        } catch (error) {
          console.error(`❌ ${error.message}`);
          this.stats.errors++;
        }
        await this.sleep(DELAY_BETWEEN_ARTICLES);
        if ((i + 1) % 10 === 0) this.displayStats();
      }

      console.log('\n✅ ENRICHISSEMENT TERMINÉ !');
      this.displayStats();

    } catch (error) {
      console.error('\n❌ ERREUR:', error);
      process.exit(1);
    }
  }

  async enrichArticle(article, index) {
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

    console.log(`   ✅ ${enrichment.ai_category} | Sent: ${enrichment.ai_sentiment?.toFixed(2)} | Imp: ${enrichment.ai_importance?.toFixed(2)} | Breaking: ${enrichment.ai_is_breaking ? 'Oui' : 'Non'}`);
    if (enrichment.ai_keywords?.length) {
      console.log(`   🔑 ${enrichment.ai_keywords.slice(0, 5).join(', ')}`);
    }
  }

  displayStats() {
    const elapsed = Date.now() - this.stats.startTime;
    const min = Math.floor(elapsed / 60000);
    const sec = Math.floor((elapsed % 60000) / 1000);
    const processed = this.stats.enriched + this.stats.errors;
    const pct = ((processed / this.stats.total) * 100).toFixed(1);
    console.log(`\n📊 ${processed}/${this.stats.total} (${pct}%) | ✅ ${this.stats.enriched} | ❌ ${this.stats.errors} | ⏱️ ${min}m ${sec}s\n`);
  }
}

const enricher = new RecentArticlesEnrichment();
enricher.start()
  .then(() => { console.log('\n🎉 Terminé avec succès !\n'); process.exit(0); })
  .catch(error => { console.error('\n❌ Erreur:', error); process.exit(1); });
