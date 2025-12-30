#!/usr/bin/env node

/**
 * 📊 GÉNÉRATEUR DE RAPPORT COÛTS IA
 * 
 * Analyse l'utilisation réelle de l'IA et génère un rapport détaillé
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gzjjkqmgvqfmqjbvnfmv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Tarifs OpenAI (USD par 1M tokens)
const PRICING = {
  'gpt-4o-mini': { input: 0.150, output: 0.600 },
  'gpt-3.5-turbo': { input: 0.500, output: 1.500 },
  'gpt-3.5-turbo-0125': { input: 0.500, output: 1.500 },
  'gpt-4o': { input: 5.000, output: 15.000 },
  'deepseek-chat': { input: 0.140, output: 0.280 },
  'tts-1': { input: 0, output: 15.00 } // Par 1M caractères
};

const XAF_TO_USD = 600;

async function getAIUsageStats(days = 30) {
  console.log(`\n📊 Analyse des ${days} derniers jours...\n`);
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Récupérer les transactions avec usage OpenAI
  const { data: transactions, error } = await supabase
    .from('credit_transactions')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .not('openai_usage', 'is', null);
  
  if (error) {
    console.error('❌ Erreur:', error.message);
    return null;
  }
  
  console.log(`✅ ${transactions.length} transactions IA trouvées\n`);
  
  // Analyser par service
  const byService = {};
  const byModel = {};
  let totalCost = 0;
  
  transactions.forEach(tx => {
    const service = tx.service_name || 'unknown';
    const usage = tx.openai_usage || {};
    const model = usage.model || 'unknown';
    
    // Calculer coût
    const pricing = PRICING[model] || PRICING['gpt-4o-mini'];
    const inputCost = (usage.prompt_tokens || 0) / 1_000_000 * pricing.input;
    const outputCost = (usage.completion_tokens || 0) / 1_000_000 * pricing.output;
    const cost = inputCost + outputCost;
    
    totalCost += cost;
    
    // Par service
    if (!byService[service]) {
      byService[service] = {
        count: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        credits: 0
      };
    }
    byService[service].count++;
    byService[service].cost += cost;
    byService[service].inputTokens += usage.prompt_tokens || 0;
    byService[service].outputTokens += usage.completion_tokens || 0;
    byService[service].credits += Math.abs(tx.amount || 0);
    
    // Par modèle
    if (!byModel[model]) {
      byModel[model] = {
        count: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0
      };
    }
    byModel[model].count++;
    byModel[model].cost += cost;
    byModel[model].inputTokens += usage.prompt_tokens || 0;
    byModel[model].outputTokens += usage.completion_tokens || 0;
  });
  
  return {
    transactions,
    byService,
    byModel,
    totalCost,
    days
  };
}

function printReport(stats) {
  if (!stats) return;
  
  const { byService, byModel, totalCost, days } = stats;
  
  console.log('='.repeat(80));
  console.log('📊 RAPPORT COÛTS IA');
  console.log('='.repeat(80));
  console.log(`\nPériode: ${days} derniers jours`);
  console.log(`Coût total: $${totalCost.toFixed(4)} USD (~${(totalCost * XAF_TO_USD).toFixed(0)} XAF)`);
  console.log(`Coût/jour: $${(totalCost / days).toFixed(4)} USD`);
  console.log(`Projection mensuelle: $${(totalCost / days * 30).toFixed(2)} USD\n`);
  
  // Par service
  console.log('─'.repeat(80));
  console.log('📋 PAR SERVICE\n');
  
  const services = Object.entries(byService)
    .sort((a, b) => b[1].cost - a[1].cost);
  
  services.forEach(([service, data]) => {
    const percent = (data.cost / totalCost * 100).toFixed(1);
    const avgCost = data.cost / data.count;
    const revenue = data.credits * 100; // XAF
    const profit = revenue - (data.cost * XAF_TO_USD);
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
    
    console.log(`${service}`);
    console.log(`  Requêtes: ${data.count}`);
    console.log(`  Coût: $${data.cost.toFixed(4)} (${percent}%)`);
    console.log(`  Coût/requête: $${avgCost.toFixed(6)}`);
    console.log(`  Tokens: ${data.inputTokens.toLocaleString()} in + ${data.outputTokens.toLocaleString()} out`);
    console.log(`  Crédits: ${data.credits} (${revenue} XAF)`);
    console.log(`  Marge: ${margin}%`);
    console.log('');
  });
  
  // Par modèle
  console.log('─'.repeat(80));
  console.log('🤖 PAR MODÈLE\n');
  
  const models = Object.entries(byModel)
    .sort((a, b) => b[1].cost - a[1].cost);
  
  models.forEach(([model, data]) => {
    const percent = (data.cost / totalCost * 100).toFixed(1);
    const pricing = PRICING[model] || {};
    
    console.log(`${model}`);
    console.log(`  Requêtes: ${data.count}`);
    console.log(`  Coût: $${data.cost.toFixed(4)} (${percent}%)`);
    console.log(`  Tokens: ${data.inputTokens.toLocaleString()} in + ${data.outputTokens.toLocaleString()} out`);
    console.log(`  Tarif: $${pricing.input}/$${pricing.output} par 1M tokens`);
    console.log('');
  });
  
  // Recommandations
  console.log('─'.repeat(80));
  console.log('💡 RECOMMANDATIONS\n');
  
  // Détecter usage gpt-3.5-turbo
  if (byModel['gpt-3.5-turbo'] || byModel['gpt-3.5-turbo-0125']) {
    const gpt35Cost = (byModel['gpt-3.5-turbo']?.cost || 0) + 
                      (byModel['gpt-3.5-turbo-0125']?.cost || 0);
    const savings = gpt35Cost * 0.70; // 70% économie avec gpt-4o-mini
    console.log(`⚠️  Migration gpt-3.5-turbo → gpt-4o-mini`);
    console.log(`   Économie potentielle: $${savings.toFixed(4)} (~${(savings * XAF_TO_USD).toFixed(0)} XAF)`);
    console.log('');
  }
  
  // Détecter services coûteux
  const topService = services[0];
  if (topService && topService[1].cost > totalCost * 0.3) {
    console.log(`⚠️  Service "${topService[0]}" = ${(topService[1].cost / totalCost * 100).toFixed(0)}% des coûts`);
    console.log(`   Considérer: cache, rate limiting, ou optimisation prompts`);
    console.log('');
  }
  
  // Projection croissance
  const monthlyProjection = (totalCost / days * 30);
  if (monthlyProjection > 50) {
    console.log(`⚠️  Projection mensuelle élevée: $${monthlyProjection.toFixed(2)}`);
    console.log(`   Mettre en place monitoring et alertes`);
    console.log('');
  }
  
  console.log('='.repeat(80));
}

async function generateReport() {
  try {
    const stats = await getAIUsageStats(30);
    printReport(stats);
    
    // Sauvegarder le rapport
    const report = {
      generated_at: new Date().toISOString(),
      period_days: 30,
      total_cost_usd: stats.totalCost,
      total_cost_xaf: stats.totalCost * XAF_TO_USD,
      by_service: stats.byService,
      by_model: stats.byModel
    };
    
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '../reports/ai-cost-report-latest.json');
    
    // Créer le dossier si nécessaire
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✅ Rapport sauvegardé: ${reportPath}\n`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

// Exécuter
if (require.main === module) {
  generateReport();
}

module.exports = { getAIUsageStats, printReport };
