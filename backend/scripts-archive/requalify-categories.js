/**
 * 🏷️ SCRIPT DE REQUALIFICATION DES CATÉGORIES
 * Requalifie les catégories des anciens articles en extrayant depuis leurs données
 */

const supabaseService = require('./supabase-config');
const Parser = require('rss-parser');
const parser = new Parser();

class CategoryRequalifier {
  constructor() {
    this.stats = {
      total: 0,
      updated: 0,
      unchanged: 0,
      errors: 0
    };
  }

  /**
   * 🔄 NORMALISATION DE CATÉGORIE (même logique que rss-processor)
   */
  normalizeCategory(category) {
    if (!category) return 'Actualités';
    
    const categoryLower = category.toLowerCase().trim();
    
    const categoryMap = {
      'sport': 'Sport',
      'sports': 'Sport',
      'football': 'Sport',
      'économie': 'Économie',
      'economie': 'Économie',
      'economy': 'Économie',
      'business': 'Économie',
      'politique': 'Politique',
      'politics': 'Politique',
      'santé': 'Santé',
      'sante': 'Santé',
      'health': 'Santé',
      'culture': 'Culture',
      'art': 'Culture',
      'musique': 'Culture',
      'technologie': 'Technologie',
      'technology': 'Technologie',
      'tech': 'Technologie',
      'numérique': 'Technologie',
      'actualités': 'Actualités',
      'actualites': 'Actualités',
      'news': 'Actualités',
      'infos': 'Actualités'
    };
    
    return categoryMap[categoryLower] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * 🏷️ EXTRACTION DE CATÉGORIE DEPUIS TITRE/CONTENU
   */
  extractCategoryFromContent(title, summary) {
    const titleLower = (title || '').toLowerCase();
    const summaryLower = (summary || '').toLowerCase();
    const text = `${titleLower} ${summaryLower}`;
    
    // Détection par mots-clés
    if (text.includes('sport') || text.includes('football') || text.includes('match') || 
        text.includes('olympique') || text.includes('championnat')) {
      return 'Sport';
    }
    if (text.includes('économie') || text.includes('economie') || text.includes('business') ||
        text.includes('finance') || text.includes('économique')) {
      return 'Économie';
    }
    if (text.includes('politique') || text.includes('gouvernement') || text.includes('ministre') ||
        text.includes('président') || text.includes('assemblée')) {
      return 'Politique';
    }
    if (text.includes('santé') || text.includes('sante') || text.includes('médical') ||
        text.includes('hôpital') || text.includes('maladie')) {
      return 'Santé';
    }
    if (text.includes('culture') || text.includes('musique') || text.includes('art') ||
        text.includes('festival') || text.includes('concert')) {
      return 'Culture';
    }
    if (text.includes('technologie') || text.includes('tech') || text.includes('numérique') ||
        text.includes('digital') || text.includes('internet')) {
      return 'Technologie';
    }
    
    return null; // Pas de catégorie détectée
  }

  /**
   * 🔄 REQUALIFIER UN ARTICLE
   */
  async requalifyArticle(article) {
    try {
      // Extraire nouvelle catégorie depuis le contenu
      const newCategory = this.extractCategoryFromContent(article.title, article.summary);
      
      if (!newCategory) {
        // Garder la catégorie actuelle si aucune détection
        this.stats.unchanged++;
        return;
      }
      
      // Normaliser
      const normalizedCategory = this.normalizeCategory(newCategory);
      
      // Mettre à jour si différent
      if (normalizedCategory !== article.category) {
        const { error } = await supabaseService.supabase
          .from('articles')
          .update({ category: normalizedCategory })
          .eq('id', article.id);
        
        if (error) {
          console.error(`❌ Erreur update ${article.id}: ${error.message}`);
          this.stats.errors++;
        } else {
          console.log(`✅ ${article.id}: "${article.category}" → "${normalizedCategory}"`);
          this.stats.updated++;
        }
      } else {
        this.stats.unchanged++;
      }
      
    } catch (error) {
      console.error(`❌ Erreur traitement ${article.id}:`, error.message);
      this.stats.errors++;
    }
  }

  /**
   * 🚀 LANCER LA REQUALIFICATION
   */
  async run() {
    console.log('🏷️ DÉMARRAGE REQUALIFICATION DES CATÉGORIES');
    console.log('==============================================\n');
    
    try {
      // Récupérer tous les articles (triés par published_at pour prioriser articles récents affichés)
      const { data: articles, error } = await supabaseService.supabase
        .from('articles')
        .select('id, title, summary, category')
        .eq('is_published', true)
        .order('published_at', { ascending: false }) // ⚠️ Tri par published_at pour prioriser articles affichés
        .limit(5000); // Limiter à 5000 pour éviter timeout
      
      if (error) {
        console.error('❌ Erreur récupération articles:', error);
        return;
      }
      
      this.stats.total = articles.length;
      console.log(`📊 Articles à traiter: ${this.stats.total}\n`);
      
      // Traiter par lots de 50
      const batchSize = 50;
      for (let i = 0; i < articles.length; i += batchSize) {
        const batch = articles.slice(i, i + batchSize);
        console.log(`\n📦 Lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(articles.length/batchSize)} (articles ${i+1}-${Math.min(i+batchSize, articles.length)})`);
        
        await Promise.all(batch.map(article => this.requalifyArticle(article)));
        
        // Pause entre les lots
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Afficher statistiques finales
      console.log('\n==============================================');
      console.log('📊 STATISTIQUES FINALES:');
      console.log(`  Total traités: ${this.stats.total}`);
      console.log(`  ✅ Mis à jour: ${this.stats.updated}`);
      console.log(`  ⏸️  Inchangés: ${this.stats.unchanged}`);
      console.log(`  ❌ Erreurs: ${this.stats.errors}`);
      console.log(`  📈 Taux succès: ${((this.stats.updated / this.stats.total) * 100).toFixed(1)}%`);
      console.log('==============================================\n');
      
      // Afficher répartition par catégorie
      const { data: categoryStats } = await supabaseService.supabase
        .from('articles')
        .select('category')
        .eq('is_published', true);
      
      if (categoryStats) {
        const distribution = categoryStats.reduce((acc, article) => {
          acc[article.category] = (acc[article.category] || 0) + 1;
          return acc;
        }, {});
        
        console.log('📊 DISTRIBUTION PAR CATÉGORIE:');
        Object.entries(distribution)
          .sort(([,a], [,b]) => b - a)
          .forEach(([category, count]) => {
            const percentage = ((count / categoryStats.length) * 100).toFixed(1);
            console.log(`  ${category}: ${count} articles (${percentage}%)`);
          });
      }
      
    } catch (error) {
      console.error('❌ Erreur fatale:', error);
    }
  }
}

// Lancer le script
const requalifier = new CategoryRequalifier();
requalifier.run()
  .then(() => {
    console.log('\n✅ Script terminé avec succès');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur script:', error);
    process.exit(1);
  });
