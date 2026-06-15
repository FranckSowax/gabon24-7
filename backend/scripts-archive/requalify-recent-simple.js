/**
 * 🔄 REQUALIFICATION SIMPLE DES ARTICLES RÉCENTS (36H)
 * Version simplifiée sans dépendance RSSProcessor
 */

const supabaseService = require('./supabase-config');

// Mots-clés par catégorie
const KEYWORDS = {
  'Sport': ['sport', 'football', 'match', 'ligue', 'champion', 'aubameyang', ' om ', 'ajax', 'équipe', 'joueur', 'but', 'victoire', 'défaite', 'coupe', 'tournoi'],
  'Politique': ['politique', 'gouvernement', 'ministre', 'election', 'electoral', 'scrutin', 'acer', 'referendum', 'président', 'assemblée', 'député', 'candidat', 'vote', 'législative', 'sénat', 'parlement', 'opposition', 'coalition'],
  'Économie': ['économie', 'economie', 'business', 'banque', 'mondiale', 'capital', 'croissance', 'développement', 'investissement', 'commerce', 'export', 'import', 'entreprise', 'industrie', 'pib', 'fmi', 'budget', 'finance'],
  'Santé': ['santé', 'sante', 'médical', 'hopital', 'hôpital', 'vaccin', 'maladie', 'docteur', 'patient'],
  'Culture': ['culture', 'musique', 'art', 'cinéma', 'cinema', 'festival', 'artiste', 'concert', 'spectacle'],
  'Technologie': ['technologie', 'tech', 'numérique', 'digital', 'internet', 'informatique', 'intelligence artificielle', 'smartphone', 'application']
};

function detectCategory(title, summary) {
  const text = `${title} ${summary}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'Actualités';
}

async function requalifyRecent() {
  console.log('🔄 REQUALIFICATION ARTICLES RÉCENTS (36H)\n');
  
  try {
    // Récupérer articles 36h
    const thirtySixHoursAgo = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, title, summary, category')
      .eq('is_published', true)
      .gte('published_at', thirtySixHoursAgo)
      .order('published_at', { ascending: false });
    
    if (error) {
      console.error('❌ Erreur:', error);
      return;
    }
    
    console.log(`📊 ${articles.length} articles trouvés\n`);
    
    let updated = 0;
    let errors = 0;
    
    for (const article of articles) {
      const newCategory = detectCategory(article.title, article.summary || '');
      
      if (newCategory && newCategory !== 'Actualités' && newCategory !== article.category) {
        const { error: updateError } = await supabaseService.supabase
          .from('articles')
          .update({ category: newCategory })
          .eq('id', article.id);
        
        if (updateError) {
          console.error(`❌ ${article.id}: ${updateError.message}`);
          errors++;
        } else {
          console.log(`✅ ${article.title.substring(0, 60)}... → ${newCategory}`);
          updated++;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RÉSULTATS:');
    console.log(`  Total: ${articles.length}`);
    console.log(`  ✅ Mis à jour: ${updated}`);
    console.log(`  ❌ Erreurs: ${errors}`);
    console.log(`  ⏭️  Inchangés: ${articles.length - updated - errors}`);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
  }
}

requalifyRecent()
  .then(() => {
    console.log('\n✅ Script terminé');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Erreur:', error);
    process.exit(1);
  });
