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
    name: "Vox Populi",
    url: "https://vxp241.com/feed/",
    category: "Actualités"
  },
  {
    name: "Gabon Review", 
    url: "https://www.gabonreview.com/rss",
    category: "Économie"
  },
  {
    name: "L'Union",
    url: "http://fetchrss.com/rss/67d4a6e006e3a7e36007195367d8bc0f03e8d56c07092dd4.xml",
    category: "Actualités"
  },
  {
    name: "Les Echos de l'eco",
    url: "http://fetchrss.com/rss/67be6e73b69f5529a70bd83267be725718bb5241bb01c253.xml",
    category: "Économie"
  },
  {
    name: "AGP",
    url: "https://agpgabon.ga/feed/",
    category: "Actualités"
  },
  {
    name: "Media Poste Gabon",
    url: "https://fetchrss.com/rss/67be6e73b69f5529a70bd83267bf7a88afa07f54390eb7c2.xml",
    category: "Actualités"
  },
  {
    name: "Gabon Eco",
    url: "https://www.gaboneco.com/rss",
    category: "Économie"
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
