const supabaseService = require('./supabase-config');

async function checkAllArticles() {
  try {
    const { data: allArticles, error: allError } = await supabaseService.supabase
      .from('articles')
      .select('id, title, created_at, is_published, rss_feeds(name)')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (allError) {
      console.error('Erreur:', allError);
      return;
    }
    
    console.log('=== TOUS LES ARTICLES ===');
    console.log('Total articles trouvés:', allArticles.length);
    
    const published = allArticles.filter(a => a.is_published);
    const unpublished = allArticles.filter(a => !a.is_published);
    
    console.log('Articles publiés:', published.length);
    console.log('Articles non publiés:', unpublished.length);
    
    console.log('\n=== ARTICLES RÉCENTS (tous) ===');
    allArticles.slice(0, 15).forEach((article, i) => {
      const status = article.is_published ? '✅' : '❌';
      const source = article.rss_feeds?.name || 'Inconnu';
      const date = new Date(article.created_at);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      console.log(`${i+1}. ${status} ${article.title.substring(0, 60)}... (${source}) - ${diffHours}h ago`);
    });
    
    // Vérifier les articles récents non publiés
    const recentUnpublished = unpublished.filter(article => {
      const date = new Date(article.created_at);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      return diffHours < 24;
    });
    
    if (recentUnpublished.length > 0) {
      console.log('\n=== ARTICLES RÉCENTS NON PUBLIÉS (< 24h) ===');
      recentUnpublished.forEach((article, i) => {
        const source = article.rss_feeds?.name || 'Inconnu';
        const date = new Date(article.created_at);
        const now = new Date();
        const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
        console.log(`${i+1}. ${article.title.substring(0, 60)}... (${source}) - ${diffHours}h ago`);
      });
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  }
}

checkAllArticles();
