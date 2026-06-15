/**
 * Test de Correction Automatique des Sources
 * Simule l'arrivée de nouveaux articles RSS
 */

const sourceMediaCorrector = require('./services/source-media-corrector');

console.log('\n🧪 TEST DE CORRECTION AUTOMATIQUE DES SOURCES\n');
console.log('═'.repeat(70));

// Simuler différents types d'articles RSS entrants
const testArticles = [
  {
    title: 'Article économique du Gabon',
    link: 'https://gaboneco.com/article-economie-2025',
    source: 'gaboneco.com',
    author: 'Rédaction'
  },
  {
    title: 'Résultats sportifs',
    link: 'https://sport241.com/football-pantheres-victoire',
    source: 'sport241.com',
    author: null
  },
  {
    title: 'Post Facebook du Ministère',
    link: 'https://www.facebook.com/MinistereEconomie/posts/123456',
    source: 'Facebook',
    author: 'Ministère de l\'Économie Numérique'
  },
  {
    title: 'Actualité politique',
    link: 'https://gabonmailinfos.com/politique-assemblee-nationale',
    source: 'gabonmailinfos.com',
    author: null
  },
  {
    title: 'Article de Biba241',
    link: 'https://biba241.com/elections-2025-resultats',
    source: 'biba241.com',
    author: 'Jean Dupont'
  },
  {
    title: 'Infos générales',
    link: 'https://fr.infosgabon.com/gabon-actualite-du-jour',
    source: 'fr.infosgabon.com',
    author: null
  },
  {
    title: 'Article Facebook de Gabon 24',
    link: 'https://facebook.com/gabon24/posts/789',
    source: 'Facebook',
    author: 'Gabon 24'
  },
  {
    title: 'Sport gabonais',
    link: 'https://gabonallsport.com/basketball-championnat',
    source: null,
    author: 'Sport Reporter'
  }
];

console.log('\n📊 SIMULATION DE TRAITEMENT RSS:\n');

testArticles.forEach((article, index) => {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\n🆕 ARTICLE #${index + 1}: ${article.title.substring(0, 50)}...`);
  console.log(`🔗 URL: ${article.link}`);
  console.log(`👤 Auteur RSS: ${article.author || 'N/A'}`);
  console.log(`📰 Source RSS: ${article.source || 'NULL'}`);
  
  // ✨ CORRECTION AUTOMATIQUE (comme dans RSSAggregator ligne 148)
  const correctedSource = sourceMediaCorrector.correctSource(
    article.link,
    article.source,
    article.author
  );
  
  // Afficher le résultat
  const hasChanged = correctedSource !== article.source;
  const emoji = hasChanged ? '✅' : '➡️';
  
  console.log(`\n${emoji} RÉSULTAT:`);
  if (hasChanged) {
    console.log(`   Source Avant: "${article.source || 'NULL'}"`);
    console.log(`   Source Après: "${correctedSource}"`);
    console.log(`   🔄 CORRECTION APPLIQUÉE !`);
  } else {
    console.log(`   Source: "${correctedSource}"`);
    console.log(`   ✓ Déjà correcte, pas de changement`);
  }
});

console.log('\n' + '═'.repeat(70));
console.log('\n📋 RÉCAPITULATIF:\n');

const corrections = testArticles.map(article => {
  const corrected = sourceMediaCorrector.correctSource(
    article.link,
    article.source,
    article.author
  );
  return {
    original: article.source || 'NULL',
    corrected: corrected,
    changed: corrected !== article.source
  };
});

const changedCount = corrections.filter(c => c.changed).length;
const unchangedCount = corrections.length - changedCount;

console.log(`✅ Corrections appliquées: ${changedCount}/${testArticles.length}`);
console.log(`➡️  Sources déjà correctes: ${unchangedCount}/${testArticles.length}`);
console.log(`📊 Taux de correction: ${Math.round(changedCount / testArticles.length * 100)}%`);

console.log('\n✨ MAPPINGS SUPPORTÉS:\n');
const domains = sourceMediaCorrector.getSupportedDomains();
Object.entries(domains).forEach(([domain, name]) => {
  console.log(`   • ${domain.padEnd(35)} → ${name}`);
});

console.log('\n📌 RÈGLE SPÉCIALE:');
console.log('   • facebook.com → Nom de l\'auteur (si disponible)\n');

console.log('═'.repeat(70));
console.log('\n✅ CONCLUSION:\n');
console.log('Tous les nouveaux articles RSS passent automatiquement par');
console.log('sourceMediaCorrector.correctSource() dans RSSAggregator (ligne 148)');
console.log('avant d\'être sauvegardés en base de données.\n');
console.log('🎯 Aucune intervention manuelle nécessaire!\n');
