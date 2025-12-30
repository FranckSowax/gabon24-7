#!/usr/bin/env node
/**
 * 🔄 SCRIPT DE SYNCHRONISATION COMPLÈTE
 * 
 * Synchronise TOUT le contenu:
 * 1. Extraction journaux TV depuis RSS
 * 2. Génération résumés audio quotidiens (FR, EN, ZH)
 * 
 * Usage: node scripts/sync-all-content.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'https://gabon-insight-production.up.railway.app';

async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('🔄 SYNCHRONISATION COMPLÈTE DU CONTENU');
  console.log('═'.repeat(80));
  console.log(`🕐 ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Libreville' })} (WAT)`);
  console.log('');

  let totalSuccess = 0;
  let totalFailed = 0;

  // ============================================================
  // 1. EXTRACTION JOURNAUX TV
  // ============================================================
  console.log('📺 ÉTAPE 1/2: EXTRACTION JOURNAUX TV');
  console.log('─'.repeat(80));
  
  try {
    const { extractJournalFromRSS } = require('../youtube-journal-extractor');
    
    console.log('🔄 Extraction du dernier journal depuis RSS...');
    const journal = await extractJournalFromRSS();
    
    if (journal) {
      console.log('✅ Journal TV extrait avec succès');
      totalSuccess++;
    } else {
      console.log('⚠️  Aucun nouveau journal trouvé');
    }
  } catch (error) {
    console.error('❌ Erreur extraction journal TV:', error.message);
    totalFailed++;
  }
  
  console.log('');

  // ============================================================
  // 2. GÉNÉRATION RÉSUMÉS AUDIO (FR, EN, ZH)
  // ============================================================
  console.log('🔊 ÉTAPE 2/2: GÉNÉRATION RÉSUMÉS AUDIO');
  console.log('─'.repeat(80));
  
  const languages = ['fr', 'en', 'zh'];
  
  for (const lang of languages) {
    try {
      console.log(`\n🌍 Génération résumé ${lang.toUpperCase()}...`);
      
      const response = await axios.post(
        `${API_URL}/api/audio/generate-test-summary`,
        { language: lang },
        {
          timeout: 180000, // 3 minutes max
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data.success) {
        console.log(`✅ Résumé ${lang.toUpperCase()} généré`);
        console.log(`   📝 Texte: ${response.data.summary.text_summary?.substring(0, 80)}...`);
        if (response.data.summary.audio_url) {
          console.log(`   🎵 Audio: ${response.data.summary.audio_url.substring(0, 80)}...`);
        }
        totalSuccess++;
      } else {
        console.log(`⚠️  ${lang.toUpperCase()}: ${response.data.message}`);
        totalFailed++;
      }
      
      // Pause 2s entre chaque génération
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Erreur résumé ${lang.toUpperCase()}:`, error.message);
      totalFailed++;
    }
  }

  // ============================================================
  // RÉSUMÉ FINAL
  // ============================================================
  console.log('\n' + '═'.repeat(80));
  console.log('📊 RÉSUMÉ DE LA SYNCHRONISATION:');
  console.log('─'.repeat(80));
  console.log(`   ✅ Réussis: ${totalSuccess}`);
  console.log(`   ❌ Échoués: ${totalFailed}`);
  console.log('═'.repeat(80));
  console.log('');
  
  if (totalSuccess > 0) {
    console.log('🎉 Synchronisation terminée avec succès !');
    console.log('');
    console.log('🔗 Vérifier sur:');
    console.log('   📺 Journal TV: https://gabon-insight.netlify.app/');
    console.log('   🔊 Résumés audio: https://gabon-insight.netlify.app/audio/daily');
    console.log('');
  } else {
    console.log('⚠️  Aucune synchronisation n\'a réussi');
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

// Exécuter
main().catch(error => {
  console.error('\n❌ ERREUR CRITIQUE:', error);
  process.exit(1);
});
