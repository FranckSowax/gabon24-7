#!/usr/bin/env node

/**
 * 🔄 FORÇAGE DE LA SYNCHRONISATION RSS AGRÉGÉE
 * Ce script force le traitement complet du flux RSS bundle
 * avec logs détaillés pour diagnostic
 */

const RSSAggregator = require('./rss-aggregator');

async function forceAggregatedRSSSync() {
  console.log('\n🚀 === FORÇAGE SYNCHRONISATION RSS AGRÉGÉE ===\n');
  console.log('📡 Source: https://rss.app/feeds/_SntJgjZXkqIWrDHq.xml');
  console.log('🎯 Objectif: Traiter TOUS les articles récents\n');
  
  try {
    // Créer une instance du processeur
    const aggregator = new RSSAggregator();
    
    // Forcer le traitement
    console.log('⏳ Traitement en cours...\n');
    const result = await aggregator.processAggregatedFeed();
    
    // Afficher les résultats
    console.log('\n📊 === RÉSULTATS ===');
    console.log(`✅ Succès: ${result.success}`);
    console.log(`📝 Nouveaux articles: ${result.newArticles || 0}`);
    console.log(`🔄 Articles mis à jour: ${result.updatedArticles || 0}`);
    console.log(`📦 Total traité: ${result.totalProcessed || 0}`);
    
    if (result.newArticles === 0 && result.updatedArticles === 0) {
      console.log('\n⚠️  ATTENTION: Aucun article ajouté/mis à jour !');
      console.log('Causes possibles:');
      console.log('  1. Articles déjà en base (doublons détectés)');
      console.log('  2. Articles trop anciens (> 48h)');
      console.log('  3. Problème de parsing/enrichissement');
      console.log('\n💡 Vérifiez les logs du processeur ci-dessus\n');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERREUR CRITIQUE:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Exécuter
forceAggregatedRSSSync();
