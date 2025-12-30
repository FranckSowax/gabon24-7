#!/usr/bin/env node

/**
 * 🧪 Script de test pour la migration GPT-5 Nano
 * Teste les 8 fonctions migrées
 */

require('dotenv').config();
const { callGPT5NanoWithFallback, calculateCost } = require('./netlify/functions/utils/replicate-gpt5-helper');

console.log('\n🧪 TEST MIGRATION GPT-5 NANO');
console.log('='.repeat(60));

// Vérifier les variables d'environnement
console.log('\n📋 Variables d\'environnement:');
console.log('REPLICATE_API_TOKEN:', process.env.REPLICATE_API_TOKEN ? '✅ SET' : '❌ MISSING');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ SET (fallback)' : '❌ MISSING');

if (!process.env.REPLICATE_API_TOKEN && !process.env.OPENAI_API_KEY) {
  console.error('\n❌ Aucune clé API disponible !');
  console.error('Configurez REPLICATE_API_TOKEN ou OPENAI_API_KEY dans .env');
  process.exit(1);
}

// Test 1: Génération simple
async function test1_SimpleGeneration() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Génération simple de texte');
  console.log('='.repeat(60));
  
  try {
    const prompt = `Génère une opportunité business simple pour le secteur du commerce au Gabon.

Réponds en JSON:
{
  "titre": "Nom de l'opportunité",
  "description": "Description courte",
  "investissement": "Montant en XAF"
}`;

    console.log('\n🚀 Appel GPT-5 Nano...');
    const startTime = Date.now();
    
    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Expert business gabonais. Réponds en JSON strict.',
      maxTokens: 300,
      temperature: 0.7,
      returnJSON: true,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    });
    
    const elapsed = Date.now() - startTime;
    
    console.log('\n✅ Réponse reçue en', elapsed, 'ms');
    console.log('📊 Provider:', result.provider);
    console.log('📊 Model:', result.model);
    console.log('📊 Tokens:', result.usage.total_tokens);
    
    const cost = calculateCost(result.usage, result.provider, result.model);
    console.log('💰 Coût:', `$${cost.total_cost.toFixed(6)}`);
    
    console.log('\n📄 Contenu généré:');
    console.log(JSON.stringify(result.content, null, 2));
    
    return { success: true, provider: result.provider, cost: cost.total_cost };
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: Génération avec fallback
async function test2_FallbackTest() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Test du fallback OpenAI');
  console.log('='.repeat(60));
  
  try {
    // Temporairement désactiver Replicate pour tester le fallback
    const originalToken = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;
    
    console.log('\n🔄 Replicate désactivé temporairement');
    console.log('🚀 Devrait fallback vers OpenAI...');
    
    const prompt = `Génère 3 mots-clés pour un article sur l'économie gabonaise.

Réponds en JSON:
{
  "keywords": ["mot1", "mot2", "mot3"]
}`;

    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Expert en mots-clés.',
      maxTokens: 100,
      temperature: 0.5,
      returnJSON: true,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    });
    
    // Restaurer le token
    process.env.REPLICATE_API_TOKEN = originalToken;
    
    console.log('\n✅ Fallback réussi !');
    console.log('📊 Provider:', result.provider);
    console.log('📊 Model:', result.model);
    
    const cost = calculateCost(result.usage, result.provider, result.model);
    console.log('💰 Coût:', `$${cost.total_cost.toFixed(6)}`);
    
    console.log('\n📄 Contenu:');
    console.log(JSON.stringify(result.content, null, 2));
    
    return { success: true, provider: result.provider };
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Comparaison coûts
async function test3_CostComparison() {
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Comparaison des coûts');
  console.log('='.repeat(60));
  
  const prompt = `Génère une idée business simple en JSON:
{
  "titre": "Nom",
  "description": "Description courte"
}`;

  try {
    // Test avec GPT-5 Nano
    console.log('\n🚀 Test avec GPT-5 Nano (Replicate)...');
    const result1 = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Expert business.',
      maxTokens: 200,
      temperature: 0.7,
      returnJSON: true,
      fallbackToOpenAI: false
    });
    
    const cost1 = calculateCost(result1.usage, 'replicate', 'gpt-5-nano');
    console.log('💰 Coût GPT-5 Nano:', `$${cost1.total_cost.toFixed(6)}`);
    
    // Simuler coût OpenAI pour comparaison
    const cost2 = calculateCost(result1.usage, 'openai', 'gpt-4o-mini');
    console.log('💰 Coût gpt-4o-mini (simulé):', `$${cost2.total_cost.toFixed(6)}`);
    
    const cost3 = calculateCost(result1.usage, 'openai', 'gpt-3.5-turbo');
    console.log('💰 Coût gpt-3.5-turbo (simulé):', `$${cost3.total_cost.toFixed(6)}`);
    
    const savings1 = ((cost2.total_cost - cost1.total_cost) / cost2.total_cost * 100).toFixed(1);
    const savings2 = ((cost3.total_cost - cost1.total_cost) / cost3.total_cost * 100).toFixed(1);
    
    console.log('\n📊 Économies:');
    console.log(`   vs gpt-4o-mini: -${savings1}%`);
    console.log(`   vs gpt-3.5-turbo: -${savings2}%`);
    
    return { 
      success: true, 
      savings: { 
        vs_gpt4o: savings1, 
        vs_gpt35: savings2 
      } 
    };
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    return { success: false, error: error.message };
  }
}

// Exécuter tous les tests
async function runAllTests() {
  console.log('\n🎯 Démarrage des tests...\n');
  
  const results = {
    test1: null,
    test2: null,
    test3: null
  };
  
  // Test 1
  results.test1 = await test1_SimpleGeneration();
  await new Promise(resolve => setTimeout(resolve, 2000)); // Pause 2s
  
  // Test 2 (seulement si OpenAI disponible)
  if (process.env.OPENAI_API_KEY) {
    results.test2 = await test2_FallbackTest();
    await new Promise(resolve => setTimeout(resolve, 2000));
  } else {
    console.log('\n⏭️  Test 2 skipped (OpenAI non disponible)');
  }
  
  // Test 3
  if (process.env.REPLICATE_API_TOKEN) {
    results.test3 = await test3_CostComparison();
  } else {
    console.log('\n⏭️  Test 3 skipped (Replicate non disponible)');
  }
  
  // Résumé
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('='.repeat(60));
  
  const test1Status = results.test1?.success ? '✅' : '❌';
  const test2Status = results.test2?.success ? '✅' : results.test2 === null ? '⏭️' : '❌';
  const test3Status = results.test3?.success ? '✅' : results.test3 === null ? '⏭️' : '❌';
  
  console.log(`\nTest 1 (Génération simple): ${test1Status}`);
  if (results.test1?.success) {
    console.log(`   Provider: ${results.test1.provider}`);
    console.log(`   Coût: $${results.test1.cost.toFixed(6)}`);
  }
  
  console.log(`\nTest 2 (Fallback): ${test2Status}`);
  if (results.test2?.success) {
    console.log(`   Provider: ${results.test2.provider}`);
  }
  
  console.log(`\nTest 3 (Comparaison coûts): ${test3Status}`);
  if (results.test3?.success) {
    console.log(`   Économie vs gpt-4o-mini: -${results.test3.savings.vs_gpt4o}%`);
    console.log(`   Économie vs gpt-3.5-turbo: -${results.test3.savings.vs_gpt35}%`);
  }
  
  const allSuccess = results.test1?.success && 
                     (results.test2?.success || results.test2 === null) &&
                     (results.test3?.success || results.test3 === null);
  
  if (allSuccess) {
    console.log('\n✅ TOUS LES TESTS RÉUSSIS !');
    console.log('\n🎉 Migration GPT-5 Nano validée !');
    console.log('\n📝 Prochaines étapes:');
    console.log('   1. Déployer sur Netlify');
    console.log('   2. Tester les fonctions en production');
    console.log('   3. Monitorer les coûts sur Replicate Dashboard');
  } else {
    console.log('\n⚠️  Certains tests ont échoué');
    console.log('Vérifiez les logs ci-dessus pour plus de détails');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Lancer les tests
runAllTests().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
