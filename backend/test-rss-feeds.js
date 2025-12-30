const Parser = require('rss-parser');
const https = require('https');
const http = require('http');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'GabonNews RSS Checker/1.0'
  }
});

// Liste des flux RSS à tester
const rssFeeds = [
  {
    name: "AGP",
    url: "https://rss.app/feeds/XEAhuGTtWqAxVGmf.xml",
    category: "Actualités"
  },
  {
    name: "Kongossa News",
    url: "https://rss.app/feeds/kumDX1PvlGmQE9Ua.xml",
    category: "Actualités"
  },
  {
    name: "Gabon Actu",
    url: "https://rss.app/feeds/A1q87qnprkKnJX5H.xml",
    category: "Actualités"
  },
  {
    name: "Gaboneco",
    url: "https://rss.app/feeds/btvMPY8kQJjAwk2Y.xml",
    category: "Économie"
  },
  {
    name: "Infos Gabon",
    url: "https://rss.app/feeds/dF1NEbqOwOTS6Mn4.xml",
    category: "Actualités"
  },
  {
    name: "Gabonews",
    url: "https://rss.app/feeds/YNqDwUBLHNGdBmZk.xml",
    category: "Actualités"
  },
  {
    name: "MediaPoste Gabon",
    url: "https://rss.app/feeds/cD6UdphnTWSthlO5.xml",
    category: "Actualités"
  },
  {
    name: "Gabon Media Time",
    url: "https://rss.app/feeds/YZrtbmX63sgyaGU6.xml",
    category: "Actualités"
  },
  {
    name: "L'Union",
    url: "https://rss.app/feeds/j8B4wWUs83Kc8ABp.xml",
    category: "Actualités"
  },
  {
    name: "Direct Infos Gabon",
    url: "https://rss.app/feeds/S4hyKQHbbTvE5Fzh.xml",
    category: "Actualités"
  },
  {
    name: "Echos de l'eco",
    url: "https://rss.app/feeds/RGtSjzdHJuUahZ4k.xml",
    category: "Économie"
  },
  {
    name: "Vox Populi 241",
    url: "https://rss.app/feeds/rsiBwGi6F0SWvZ83.xml",
    category: "Actualités"
  }
];

async function testRSSFeed(feed) {
  console.log(`\n🧪 Test du flux: ${feed.name}`);
  console.log(`📡 URL: ${feed.url}`);
  console.log(`📂 Catégorie: ${feed.category}`);
  
  const startTime = Date.now();
  
  try {
    // Test de parsing RSS
    const rssFeed = await parser.parseURL(feed.url);
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Statut: SUCCÈS`);
    console.log(`⏱️  Temps de réponse: ${responseTime}ms`);
    console.log(`📰 Titre du flux: ${rssFeed.title || 'Non spécifié'}`);
    console.log(`📝 Description: ${rssFeed.description || 'Non spécifiée'}`);
    console.log(`📊 Nombre d'articles: ${rssFeed.items ? rssFeed.items.length : 0}`);
    
    if (rssFeed.items && rssFeed.items.length > 0) {
      const latestArticle = rssFeed.items[0];
      console.log(`📄 Dernier article: "${latestArticle.title || 'Titre non disponible'}"`);
      console.log(`📅 Date de publication: ${latestArticle.pubDate || latestArticle.isoDate || 'Non spécifiée'}`);
      
      // Vérifier la qualité du contenu
      if (latestArticle.contentSnippet && latestArticle.contentSnippet.length > 50) {
        console.log(`✅ Contenu: Riche (${latestArticle.contentSnippet.length} caractères)`);
      } else {
        console.log(`⚠️  Contenu: Limité`);
      }
    }
    
    return {
      name: feed.name,
      status: 'SUCCESS',
      responseTime,
      articlesCount: rssFeed.items ? rssFeed.items.length : 0,
      title: rssFeed.title,
      hasContent: rssFeed.items && rssFeed.items.length > 0
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`❌ Statut: ÉCHEC`);
    console.log(`⏱️  Temps de réponse: ${responseTime}ms`);
    console.log(`🚨 Erreur: ${error.message}`);
    
    // Détails supplémentaires selon le type d'erreur
    if (error.code === 'ENOTFOUND') {
      console.log(`🔍 Problème: Domaine non trouvé ou inaccessible`);
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`🔍 Problème: Connexion refusée par le serveur`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`🔍 Problème: Timeout de connexion`);
    } else if (error.message.includes('Invalid XML')) {
      console.log(`🔍 Problème: Format XML invalide`);
    }
    
    return {
      name: feed.name,
      status: 'ERROR',
      responseTime,
      error: error.message,
      errorCode: error.code
    };
  }
}

async function testAllFeeds() {
  console.log('🚀 Démarrage du test des flux RSS GabonNews');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const feed of rssFeeds) {
    const result = await testRSSFeed(feed);
    results.push(result);
    
    // Pause entre les tests pour éviter de surcharger les serveurs
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Résumé des résultats
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('=' .repeat(60));
  
  const successful = results.filter(r => r.status === 'SUCCESS');
  const failed = results.filter(r => r.status === 'ERROR');
  
  console.log(`✅ Flux fonctionnels: ${successful.length}/${results.length}`);
  console.log(`❌ Flux en erreur: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎉 FLUX FONCTIONNELS:');
    successful.forEach(result => {
      console.log(`  ✅ ${result.name} - ${result.articlesCount} articles (${result.responseTime}ms)`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n⚠️  FLUX EN ERREUR:');
    failed.forEach(result => {
      console.log(`  ❌ ${result.name} - ${result.error}`);
    });
  }
  
  // Recommandations
  console.log('\n💡 RECOMMANDATIONS:');
  if (successful.length === results.length) {
    console.log('  🎯 Tous les flux RSS fonctionnent parfaitement !');
    console.log('  🚀 Votre système GabonNews est prêt pour la production.');
  } else if (successful.length > failed.length) {
    console.log('  ✅ La majorité des flux fonctionnent bien.');
    console.log('  🔧 Vérifiez les flux en erreur et remplacez-les si nécessaire.');
  } else {
    console.log('  ⚠️  Plusieurs flux ont des problèmes.');
    console.log('  🔍 Vérifiez les URLs et contactez les propriétaires des sites si nécessaire.');
  }
  
  const totalArticles = successful.reduce((sum, result) => sum + result.articlesCount, 0);
  console.log(`\n📰 Total d'articles disponibles: ${totalArticles}`);
  
  const avgResponseTime = successful.length > 0 
    ? Math.round(successful.reduce((sum, result) => sum + result.responseTime, 0) / successful.length)
    : 0;
  console.log(`⏱️  Temps de réponse moyen: ${avgResponseTime}ms`);
}

// Démarrer les tests
testAllFeeds().catch(console.error);
