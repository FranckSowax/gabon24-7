/**
 * 🔄 ENRICHISSEMENT BATCH DES ARTICLES EXISTANTS
 * 
 * Script pour enrichir tous les articles existants avec métadonnées IA
 * - Traitement progressif avec pause entre chaque article
 * - Sauvegarde de la progression
 * - Reprise possible en cas d'interruption
 * - Logs détaillés
 */

const ArticleAIEnrichment = require('./services/article-ai-enrichment');
const supabaseService = require('./supabase-config');
const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join(__dirname, 'enrichment-progress.json');
const BATCH_SIZE = 100; // Traiter par lots de 100
const DELAY_BETWEEN_ARTICLES = 1000; // 1 seconde entre articles (éviter rate limits)
const SAVE_PROGRESS_EVERY = 10; // Sauvegarder tous les 10 articles

class ArticleBatchEnrichment {
  constructor() {
    this.enrichmentService = new ArticleAIEnrichment();
    this.progress = this.loadProgress();
    this.stats = {
      total: 0,
      processed: 0,
      enriched: 0,
      skipped: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * 📂 CHARGER PROGRESSION
   */
  loadProgress() {
    try {
      if (fs.existsSync(PROGRESS_FILE)) {
        const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
        const progress = JSON.parse(data);
        console.log(`📂 Progression chargée: ${progress.processedIds.length} articles déjà traités`);
        return progress;
      }
    } catch (error) {
      console.log('⚠️  Impossible de charger la progression, démarrage nouveau');
    }

    return {
      processedIds: [],
      lastProcessedId: null,
      lastSaveTime: new Date().toISOString()
    };
  }

  /**
   * 💾 SAUVEGARDER PROGRESSION
   */
  saveProgress() {
    try {
      this.progress.lastSaveTime = new Date().toISOString();
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(this.progress, null, 2));
    } catch (error) {
      console.error('❌ Erreur sauvegarde progression:', error.message);
    }
  }

  /**
   * ⏸️ PAUSE
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 📊 AFFICHER STATISTIQUES
   */
  displayStats() {
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedMin = Math.floor(elapsed / 60000);
    const elapsedSec = Math.floor((elapsed % 60000) / 1000);
    
    const avgTime = this.stats.processed > 0 ? elapsed / this.stats.processed : 0;
    const remaining = this.stats.total - this.stats.processed;
    const estimatedMin = Math.floor((remaining * avgTime) / 60000);
    
    const progressPct = this.stats.total > 0 
      ? ((this.stats.processed / this.stats.total) * 100).toFixed(1)
      : 0;

    console.log('\n' + '='.repeat(80));
    console.log('📊 STATISTIQUES ENRICHISSEMENT');
    console.log('='.repeat(80));
    console.log(`   Total articles: ${this.stats.total}`);
    console.log(`   Traités: ${this.stats.processed} (${progressPct}%)`);
    console.log(`   Enrichis: ${this.stats.enriched}`);
    console.log(`   Ignorés (déjà enrichis): ${this.stats.skipped}`);
    console.log(`   Erreurs: ${this.stats.errors}`);
    console.log(`   Temps écoulé: ${elapsedMin}m ${elapsedSec}s`);
    console.log(`   Temps moyen: ${(avgTime / 1000).toFixed(2)}s/article`);
    console.log(`   Temps restant estimé: ~${estimatedMin} minutes`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * 🚀 LANCER ENRICHISSEMENT BATCH
   */
  async start() {
    console.log('\n🚀 DÉMARRAGE ENRICHISSEMENT BATCH DES ARTICLES');
    console.log('='.repeat(80));
    
    try {
      // 1. Compter articles totaux à enrichir
      const { count: totalCount } = await supabaseService.supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .is('ai_category', null)
        .eq('is_published', true);

      this.stats.total = totalCount || 0;
      
      console.log(`\n📋 Articles à enrichir: ${this.stats.total}`);
      console.log(`📂 Déjà traités dans session précédente: ${this.progress.processedIds.length}`);
      console.log(`⏱️  Temps estimé total: ~${Math.floor((this.stats.total * 2.4) / 60)} minutes`);
      console.log(`💰 Coût estimé: $${(this.stats.total * 0.00006).toFixed(2)}\n`);

      if (this.stats.total === 0) {
        console.log('✅ Tous les articles sont déjà enrichis !');
        return;
      }

      // Demander confirmation
      console.log('⚠️  ATTENTION: Ce processus peut prendre plusieurs heures.');
      console.log('   Vous pouvez l\'interrompre avec CTRL+C et le reprendre plus tard.\n');
      
      // Attendre 3 secondes pour permettre annulation
      console.log('Démarrage dans 3 secondes... (CTRL+C pour annuler)');
      await this.sleep(3000);

      // 2. Traiter par lots
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        // Récupérer lot d'articles
        const { data: articles, error } = await supabaseService.supabase
          .from('articles')
          .select('id, title, content, summary, ai_summary')
          .is('ai_category', null)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
          console.error('❌ Erreur récupération articles:', error.message);
          break;
        }

        if (!articles || articles.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`\n📦 Traitement lot ${Math.floor(offset / BATCH_SIZE) + 1} (${articles.length} articles)`);
        console.log('─'.repeat(80));

        // Traiter chaque article du lot
        for (const article of articles) {
          // Vérifier si déjà traité dans session précédente
          if (this.progress.processedIds.includes(article.id)) {
            this.stats.skipped++;
            this.stats.processed++;
            continue;
          }

          try {
            await this.enrichArticle(article);
            this.stats.enriched++;
          } catch (error) {
            console.error(`❌ Erreur article ${article.id}:`, error.message);
            this.stats.errors++;
          }

          this.stats.processed++;
          this.progress.processedIds.push(article.id);
          this.progress.lastProcessedId = article.id;

          // Sauvegarder progression périodiquement
          if (this.stats.processed % SAVE_PROGRESS_EVERY === 0) {
            this.saveProgress();
            this.displayStats();
          }

          // Pause entre articles
          await this.sleep(DELAY_BETWEEN_ARTICLES);
        }

        offset += BATCH_SIZE;
        
        // Sauvegarder après chaque lot
        this.saveProgress();
      }

      // Statistiques finales
      console.log('\n' + '='.repeat(80));
      console.log('✅ ENRICHISSEMENT BATCH TERMINÉ !');
      this.displayStats();

      // Nettoyer fichier de progression
      if (fs.existsSync(PROGRESS_FILE)) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('🗑️  Fichier de progression supprimé\n');
      }

    } catch (error) {
      console.error('\n❌ ERREUR CRITIQUE:', error);
      this.saveProgress();
      console.log('💾 Progression sauvegardée. Vous pouvez relancer le script pour continuer.\n');
      process.exit(1);
    }
  }

  /**
   * 🤖 ENRICHIR UN ARTICLE
   */
  async enrichArticle(article) {
    const startTime = Date.now();
    
    console.log(`\n   [${this.stats.processed + 1}/${this.stats.total}] "${article.title.substring(0, 50)}..."`);

    // Enrichissement IA
    const enrichment = await this.enrichmentService.enrichArticle(
      article.title,
      article.content || '',
      article.summary || article.ai_summary || ''
    );

    // Mise à jour dans Supabase
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

    if (error) {
      throw new Error(`Erreur update DB: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ ${enrichment.ai_category} | ${enrichment.ai_sentiment.toFixed(2)} | ${enrichment.ai_importance.toFixed(2)} | ${enrichment.ai_keywords.length} kw (${duration}ms)`);
  }
}

// Gestion interruption gracieuse
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interruption détectée...');
  console.log('💾 Sauvegarde de la progression en cours...');
  
  if (global.enrichmentInstance) {
    global.enrichmentInstance.saveProgress();
    global.enrichmentInstance.displayStats();
  }
  
  console.log('✅ Progression sauvegardée. Relancez le script pour continuer.\n');
  process.exit(0);
});

// Lancer l'enrichissement
const instance = new ArticleBatchEnrichment();
global.enrichmentInstance = instance;
instance.start().catch(error => {
  console.error('❌ Erreur fatale:', error);
  instance.saveProgress();
  process.exit(1);
});
