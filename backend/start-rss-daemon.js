#!/usr/bin/env node

/**
 * 🚀 DAEMON RSS - Processeur automatique d'articles
 * Lance le processeur RSS en mode continu avec refresh toutes les heures
 */

const RSSProcessor = require('./rss-processor');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     🚀 GABON24/7 - DAEMON RSS PROCESSOR               ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const processor = new RSSProcessor();

// Gestion des signaux pour arrêt propre
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Arrêt du daemon RSS demandé...');
  console.log('👋 Au revoir !\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Arrêt du daemon RSS (SIGTERM)...');
  process.exit(0);
});

// Démarrage du processeur automatique
(async () => {
  try {
    console.log('⏰ Intervalle: 60 minutes');
    console.log('📡 Mode: Récupération continue\n');
    console.log('💡 Appuyez sur Ctrl+C pour arrêter\n');
    console.log('='.repeat(60));
    
    await processor.startAutomaticProcessing();
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
})();
