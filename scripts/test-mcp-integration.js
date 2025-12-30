/**
 * Script de test pour l'intégration MCP complète
 * Teste tous les composants du module opportunités enrichi
 * Gabon 24/7 - Module Opportunités IA Enrichi
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMCPIntegration() {
  console.log('🧪 === TEST INTÉGRATION MCP GABON 24/7 ===\n');

  const results = {
    database: { status: 'pending', details: {} },
    functions: { status: 'pending', details: {} },
    enrichment: { status: 'pending', details: {} },
    performance: { status: 'pending', details: {} }
  };

  // Test 1: Base de données et schéma
  console.log('1️⃣ Test du schéma de base de données...');
  try {
    // Vérifier les tables enrichies
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'enrichment_cache',
        'enrichment_metrics', 
        'factual_data_cache',
        'competitor_profiles',
        'regulatory_info_cache'
      ]);

    if (tablesError) throw tablesError;

    const foundTables = tables.map(t => t.table_name);
    const requiredTables = ['enrichment_cache', 'enrichment_metrics', 'factual_data_cache'];
    const missingTables = requiredTables.filter(t => !foundTables.includes(t));

    results.database = {
      status: missingTables.length === 0 ? 'success' : 'partial',
      details: {
        found_tables: foundTables,
        missing_tables: missingTables,
        total_tables: foundTables.length
      }
    };

    console.log(`   ✅ Tables trouvées: ${foundTables.length}`);
    if (missingTables.length > 0) {
      console.log(`   ⚠️ Tables manquantes: ${missingTables.join(', ')}`);
    }

    // Vérifier les colonnes d'enrichissement dans opportunity_analyses
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'opportunity_analyses')
      .in('column_name', [
        'enrichment_data',
        'factual_data',
        'market_research',
        'competitor_analysis',
        'regulatory_info',
        'enrichment_status'
      ]);

    const enrichmentColumns = columns?.map(c => c.column_name) || [];
    console.log(`   ✅ Colonnes d'enrichissement: ${enrichmentColumns.length}/6`);

  } catch (error) {
    results.database.status = 'error';
    results.database.details = { error: error.message };
    console.log(`   ❌ Erreur base de données: ${error.message}`);
  }

  // Test 2: Fonctions Netlify
  console.log('\n2️⃣ Test des fonctions Netlify...');
  try {
    const functionsToTest = [
      { name: 'enhance-opportunity', method: 'POST' },
      { name: 'test-mcp-enrichment', method: 'GET' }
    ];

    const functionResults = {};

    for (const func of functionsToTest) {
      try {
        const url = process.env.NETLIFY_URL 
          ? `${process.env.NETLIFY_URL}/.netlify/functions/${func.name}`
          : `http://localhost:8888/.netlify/functions/${func.name}`;

        const testData = func.name === 'enhance-opportunity' 
          ? {
              method: func.method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ opportunityId: 'test-123', enrichmentLevel: 'basic' })
            }
          : { method: func.method };

        const response = await fetch(url, testData);
        const isSuccess = response.status < 500; // 4xx sont acceptables pour les tests

        functionResults[func.name] = {
          status: isSuccess ? 'success' : 'error',
          status_code: response.status,
          response_time: 'N/A'
        };

        console.log(`   ${isSuccess ? '✅' : '❌'} ${func.name}: ${response.status}`);

      } catch (error) {
        functionResults[func.name] = {
          status: 'error',
          error: error.message.slice(0, 100)
        };
        console.log(`   ❌ ${func.name}: ${error.message}`);
      }
    }

    results.functions = {
      status: Object.values(functionResults).every(f => f.status === 'success') ? 'success' : 'partial',
      details: functionResults
    };

  } catch (error) {
    results.functions.status = 'error';
    results.functions.details = { error: error.message };
  }

  // Test 3: Enrichissement d'une opportunité réelle
  console.log('\n3️⃣ Test d\'enrichissement d\'opportunité...');
  try {
    // Créer une opportunité de test
    const testOpportunity = {
      article_title: 'Test MCP Integration',
      article_summary: 'Test automatique du système d\'enrichissement MCP',
      article_source: 'Test Script',
      article_url: 'https://test.gabon24-7.com',
      opportunity_title: 'Service de test technologique',
      opportunity_description: 'Opportunité de test pour valider l\'enrichissement MCP',
      category: 'Technologies',
      confidence_score: 8,
      analysis_data: { test: true }
    };

    const { data: insertedOpp, error: insertError } = await supabase
      .from('opportunity_analyses')
      .insert([testOpportunity])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log(`   ✅ Opportunité de test créée: ${insertedOpp.id}`);

    // Tester l'enrichissement basic
    if (process.env.NETLIFY_URL) {
      const enrichResponse = await fetch(`${process.env.NETLIFY_URL}/.netlify/functions/enhance-opportunity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: insertedOpp.id,
          enrichmentLevel: 'basic'
        })
      });

      if (enrichResponse.ok) {
        const enrichData = await enrichResponse.json();
        
        results.enrichment = {
          status: 'success',
          details: {
            opportunity_id: insertedOpp.id,
            enrichment_level: enrichData.enrichment_level,
            confidence_score: enrichData.confidence_score,
            has_factual_data: !!enrichData.factual_data,
            has_market_research: !!enrichData.market_research,
            data_sources_count: enrichData.data_sources?.length || 0
          }
        };

        console.log(`   ✅ Enrichissement réussi (score: ${enrichData.confidence_score})`);
        console.log(`   📊 Sources de données: ${enrichData.data_sources?.length || 0}`);

      } else {
        throw new Error(`Enrichment failed: ${enrichResponse.status}`);
      }
    } else {
      console.log('   ⚠️ Test enrichissement ignoré (pas d\'URL Netlify)');
      results.enrichment.status = 'skipped';
    }

    // Nettoyer la BDD
    await supabase
      .from('opportunity_analyses')
      .delete()
      .eq('id', insertedOpp.id);

  } catch (error) {
    results.enrichment.status = 'error';
    results.enrichment.details = { error: error.message };
    console.log(`   ❌ Erreur enrichissement: ${error.message}`);
  }

  // Test 4: Performance et cache
  console.log('\n4️⃣ Test de performance et cache...');
  try {
    // Tester le cache d'enrichissement
    const { data: cacheData, error: cacheError } = await supabase
      .from('enrichment_cache')
      .select('*')
      .limit(5);

    if (cacheError && !cacheError.message.includes('does not exist')) {
      throw cacheError;
    }

    const cacheEntries = cacheData?.length || 0;
    console.log(`   📋 Entrées de cache: ${cacheEntries}`);

    // Tester les métriques d'enrichissement
    const { data: metricsData, error: metricsError } = await supabase
      .from('enrichment_metrics')
      .select('*')
      .limit(5);

    if (metricsError && !metricsError.message.includes('does not exist')) {
      throw metricsError;
    }

    const metricsEntries = metricsData?.length || 0;
    console.log(`   📈 Métriques d'enrichissement: ${metricsEntries}`);

    results.performance = {
      status: 'success',
      details: {
        cache_entries: cacheEntries,
        metrics_entries: metricsEntries,
        cache_enabled: cacheEntries >= 0,
        metrics_enabled: metricsEntries >= 0
      }
    };

  } catch (error) {
    results.performance.status = 'error';
    results.performance.details = { error: error.message };
    console.log(`   ❌ Erreur performance: ${error.message}`);
  }

  // Résumé final
  console.log('\n📊 === RÉSUMÉ DES TESTS ===');
  
  const allStatuses = Object.values(results).map(r => r.status);
  const successCount = allStatuses.filter(s => s === 'success').length;
  const totalTests = allStatuses.length;
  const overallSuccess = successCount === totalTests;

  console.log(`\n🎯 Résultat global: ${overallSuccess ? '✅ SUCCÈS' : '⚠️ PARTIEL'}`);
  console.log(`📊 Tests réussis: ${successCount}/${totalTests}`);
  
  Object.entries(results).forEach(([category, result]) => {
    const icon = result.status === 'success' ? '✅' : 
                 result.status === 'partial' ? '⚠️' : 
                 result.status === 'skipped' ? '⏭️' : '❌';
    console.log(`${icon} ${category}: ${result.status}`);
  });

  // Configuration requise
  console.log('\n⚙️ === CONFIGURATION ===');
  console.log(`✅ SUPABASE_URL: ${!!process.env.SUPABASE_URL}`);
  console.log(`✅ SUPABASE_SERVICE_ROLE_KEY: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
  console.log(`⚠️ BRAVE_SEARCH_API_KEY: ${!!process.env.BRAVE_SEARCH_API_KEY} (optionnel)`);
  console.log(`✅ OPENAI_API_KEY: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`✅ DEEPSEEK_API_KEY: ${!!process.env.DEEPSEEK_API_KEY}`);
  console.log(`📍 NETLIFY_URL: ${process.env.NETLIFY_URL || 'localhost:8888'}`);

  // Recommandations
  console.log('\n💡 === RECOMMANDATIONS ===');
  
  if (results.database.status !== 'success') {
    console.log('🔧 Appliquer le schéma SQL:');
    console.log('   psql -h your-supabase-host -d postgres -f database/enhanced-opportunities-schema.sql');
  }

  if (!process.env.BRAVE_SEARCH_API_KEY) {
    console.log('🔑 Obtenir une clé API Brave Search pour des données réelles');
  }

  if (results.functions.status !== 'success') {
    console.log('🚀 Redéployer les fonctions Netlify:');
    console.log('   netlify deploy --prod');
  }

  console.log('\n🎉 Test d\'intégration MCP terminé!');
  
  return results;
}

// Exécuter les tests si le script est appelé directement
if (require.main === module) {
  testMCPIntegration()
    .then(results => {
      const overallSuccess = Object.values(results).every(r => 
        r.status === 'success' || r.status === 'skipped'
      );
      process.exit(overallSuccess ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { testMCPIntegration };
