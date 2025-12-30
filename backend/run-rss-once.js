#!/usr/bin/env node

/**
 * 🔄 Exécution unique du processeur RSS
 * Traite tous les flux RSS une fois puis s'arrête
 */

const RSSProcessor = require('./rss-processor');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     📡 GABON24/7 - TRAITEMENT RSS UNIQUE              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const processor = new RSSProcessor();

(async () => {
  try {
    console.log('🚀 Démarrage du traitement...\n');
    console.log('='.repeat(60));
    
    await processor.processAllFeeds();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Traitement terminé avec succès !');
    console.log('👋 Processus arrêté\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erreur lors du traitement:', error);
    process.exit(1);
  }
})();
