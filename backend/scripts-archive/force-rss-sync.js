#!/usr/bin/env node

const supabaseService = require('./supabase-config');
const RSSParserService = require('./rss-parser-service');

async function forceFullRSSSync() {
  console.log('🚀 Démarrage de la synchronisation RSS complète depuis zéro...');
  
  try {
    // Initialiser les services
    const rssService = new RSSParserService(supabaseService);
    
    // Attendre l'initialisation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Vider complètement le cache et resynchroniser
    await rssService.clearCacheAndResync();
    
    console.log('✅ Synchronisation RSS complète terminée !');
    console.log(`📊 Dernière mise à jour: ${rssService.getFormattedLastUpdateTime()}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation RSS:', error);
    process.exit(1);
  }
}

// Exécuter la synchronisation
forceFullRSSSync();
