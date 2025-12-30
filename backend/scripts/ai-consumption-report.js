/**
 * RAPPORT DE CONSOMMATION IA
 * Analyse toutes les fonctions utilisant l'IA et génère un rapport détaillé
 */

const fs = require('fs');
const path = require('path');

// Prix OpenAI (au 1er novembre 2024)
const PRICING = {
  'gpt-4': {
    input: 0.03,  // $ par 1K tokens
    output: 0.06
  },
  'gpt-4-turbo': {
    input: 0.01,
    output: 0.03
  },
  'gpt-3.5-turbo': {
    input: 0.0005,
    output: 0.0015
  },
  'gpt-3.5-turbo-16k': {
    input: 0.003,
    output: 0.004
  },
  'text-embedding-ada-002': {
    input: 0.0001,
    output: 0
  }
};

// Configuration des fonctions IA
const AI_FUNCTIONS = [
  {
    name: 'Enrichissement Articles IA',
    file: 'services/article-ai-enrichment.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 800,
    avgOutputTokens: 200,
    frequency: 'Toutes les 3 minutes (automatique)',
    estimatedCallsPerDay: 480,
    description: 'Analyse et enrichit les articles avec métadonnées IA (catégorie, sentiment, importance, keywords)'
  },
  {
    name: 'Génération Business Plan',
    file: 'src/routes/project-documents.js',
    model: 'Replicate (GPT-5 Nano)',
    avgInputTokens: 1500,
    avgOutputTokens: 800,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 10,
    description: 'Génère les 10 sections du business plan (Executive Summary, Analyse marché, etc.)'
  },
  {
    name: 'Génération Formation',
    file: 'routes/training.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1200,
    avgOutputTokens: 600,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 5,
    description: 'Génère des formations personnalisées avec modules et contenus pédagogiques'
  },
  {
    name: 'Génération Test Compétences',
    file: 'routes/skill-test.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1000,
    avgOutputTokens: 500,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 5,
    description: 'Génère des tests de compétences (QCM, questions ouvertes) avec 3 niveaux de difficulté'
  },
  {
    name: 'Génération Courrier',
    file: 'routes/generate-letter.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 800,
    avgOutputTokens: 400,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 3,
    description: 'Génère des courriers professionnels personnalisés'
  },
  {
    name: 'Chat Projet IA',
    file: 'src/routes/project-chat.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1500,
    avgOutputTokens: 300,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 20,
    description: 'Assistant conversationnel pour aider sur les projets business'
  },
  {
    name: 'Génération Plan d\'Action',
    file: 'routes/action-plans.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1200,
    avgOutputTokens: 600,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 5,
    description: 'Génère un plan d\'action détaillé avec étapes, délais et ressources'
  },
  {
    name: 'Analyse Opportunités',
    file: 'routes/opportunities.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1000,
    avgOutputTokens: 400,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 10,
    description: 'Analyse et génère des opportunités d\'affaires basées sur les articles'
  },
  {
    name: 'Business Intelligence',
    file: 'services/daily-news-analyzer.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 2000,
    avgOutputTokens: 600,
    frequency: 'Quotidien (automatique)',
    estimatedCallsPerDay: 1,
    description: 'Analyse quotidienne des tendances et génère insights business'
  },
  {
    name: 'Génération Sondage Audio',
    file: 'services/poll-generator-from-audio.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 500,
    avgOutputTokens: 200,
    frequency: 'À la demande (admin)',
    estimatedCallsPerDay: 1,
    description: 'Génère des sondages à partir de transcriptions audio'
  },
  {
    name: 'Résumés Custom',
    file: 'services/custom-summary-generator.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 800,
    avgOutputTokens: 200,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 5,
    description: 'Génère des résumés personnalisés d\'articles'
  },
  {
    name: 'Framework Projet',
    file: 'services/projectFrameworkGenerator.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1000,
    avgOutputTokens: 500,
    frequency: 'À la demande (utilisateur)',
    estimatedCallsPerDay: 3,
    description: 'Génère le framework initial d\'un projet business'
  },
  {
    name: 'Actu Plus (Analyse Approfondie)',
    file: 'routes/actu-plus.js',
    model: 'gpt-3.5-turbo',
    avgInputTokens: 1500,
    avgOutputTokens: 800,
    frequency: 'À la demande (utilisateur premium)',
    estimatedCallsPerDay: 10,
    description: 'Analyse approfondie d\'articles avec contexte, implications, perspectives'
  }
];

function calculateCost(model, inputTokens, outputTokens) {
  if (model.includes('Replicate')) {
    // Replicate pricing (approximatif)
    return (inputTokens + outputTokens) / 1000 * 0.002;
  }
  
  const pricing = PRICING[model] || PRICING['gpt-3.5-turbo'];
  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

function generateReport() {
  console.log('\n='.repeat(80));
  console.log('📊 RAPPORT DE CONSOMMATION IA - GABON 24/7');
  console.log('='.repeat(80));
  console.log(`Date: ${new Date().toLocaleString('fr-FR')}`);
  console.log('='.repeat(80));

  let totalDailyCost = 0;
  let totalDailyTokens = 0;
  const reportData = [];

  AI_FUNCTIONS.forEach((func, index) => {
    const dailyCost = calculateCost(
      func.model,
      func.avgInputTokens * func.estimatedCallsPerDay,
      func.avgOutputTokens * func.estimatedCallsPerDay
    );
    
    const dailyTokens = (func.avgInputTokens + func.avgOutputTokens) * func.estimatedCallsPerDay;
    
    totalDailyCost += dailyCost;
    totalDailyTokens += dailyTokens;

    reportData.push({
      index: index + 1,
      ...func,
      costPerCall: calculateCost(func.model, func.avgInputTokens, func.avgOutputTokens),
      dailyCost,
      dailyTokens,
      monthlyCost: dailyCost * 30,
      monthlyTokens: dailyTokens * 30
    });
  });

  // Trier par coût quotidien décroissant
  reportData.sort((a, b) => b.dailyCost - a.dailyCost);

  console.log('\n📋 DÉTAIL PAR FONCTION:\n');
  
  reportData.forEach(func => {
    console.log(`${func.index}. ${func.name}`);
    console.log(`   ├─ Fichier: ${func.file}`);
    console.log(`   ├─ Modèle: ${func.model}`);
    console.log(`   ├─ Tokens moyens: ${func.avgInputTokens} input + ${func.avgOutputTokens} output = ${func.avgInputTokens + func.avgOutputTokens} total`);
    console.log(`   ├─ Fréquence: ${func.frequency}`);
    console.log(`   ├─ Appels estimés/jour: ${func.estimatedCallsPerDay}`);
    console.log(`   ├─ Coût par appel: $${func.costPerCall.toFixed(6)}`);
    console.log(`   ├─ Coût quotidien: $${func.dailyCost.toFixed(4)} (${func.dailyTokens.toLocaleString()} tokens)`);
    console.log(`   ├─ Coût mensuel: $${func.monthlyCost.toFixed(2)} (${func.monthlyTokens.toLocaleString()} tokens)`);
    console.log(`   └─ Description: ${func.description}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log('💰 RÉSUMÉ FINANCIER');
  console.log('='.repeat(80));
  console.log(`Total quotidien:    $${totalDailyCost.toFixed(2)} (${totalDailyTokens.toLocaleString()} tokens)`);
  console.log(`Total mensuel:      $${(totalDailyCost * 30).toFixed(2)} (${(totalDailyTokens * 30).toLocaleString()} tokens)`);
  console.log(`Total annuel:       $${(totalDailyCost * 365).toFixed(2)} (${(totalDailyTokens * 365).toLocaleString()} tokens)`);
  console.log('='.repeat(80));

  console.log('\n📈 RÉPARTITION PAR TYPE:');
  console.log('─'.repeat(80));

  const byType = {
    'Automatique': reportData.filter(f => f.frequency.includes('automatique')),
    'À la demande': reportData.filter(f => f.frequency.includes('À la demande'))
  };

  Object.entries(byType).forEach(([type, funcs]) => {
    const typeCost = funcs.reduce((sum, f) => sum + f.dailyCost, 0);
    const typeTokens = funcs.reduce((sum, f) => sum + f.dailyTokens, 0);
    console.log(`\n${type}:`);
    console.log(`  • Fonctions: ${funcs.length}`);
    console.log(`  • Coût quotidien: $${typeCost.toFixed(2)}`);
    console.log(`  • Coût mensuel: $${(typeCost * 30).toFixed(2)}`);
    console.log(`  • Tokens/jour: ${typeTokens.toLocaleString()}`);
    console.log(`  • Part du budget: ${((typeCost / totalDailyCost) * 100).toFixed(1)}%`);
  });

  console.log('\n📊 TOP 5 FONCTIONS LES PLUS COÛTEUSES:');
  console.log('─'.repeat(80));
  reportData.slice(0, 5).forEach((func, i) => {
    const percentage = (func.dailyCost / totalDailyCost) * 100;
    console.log(`${i + 1}. ${func.name}`);
    console.log(`   $${func.dailyCost.toFixed(4)}/jour | ${percentage.toFixed(1)}% du budget`);
  });

  console.log('\n💡 RECOMMANDATIONS:');
  console.log('─'.repeat(80));
  console.log('1. Enrichissement Articles (automatique) = coût principal');
  console.log('   → Optimiser la fréquence ou utiliser du caching');
  console.log('   → Envisager un modèle plus économique pour cette tâche répétitive');
  console.log('');
  console.log('2. Business Plan utilise Replicate au lieu d\'OpenAI');
  console.log('   → Vérifier les coûts réels Replicate vs OpenAI');
  console.log('   → Possible migration vers GPT-3.5-turbo pour économiser');
  console.log('');
  console.log('3. Chat Projet IA a un volume élevé');
  console.log('   → Implémenter un système de cache pour questions récurrentes');
  console.log('   → Limiter le contexte pour réduire les tokens input');
  console.log('');
  console.log('4. Considérer des modèles alternatifs:');
  console.log('   → Mixtral 8x7B (open-source, moins cher)');
  console.log('   → Claude 3 Haiku (rapide et économique)');
  console.log('   → Llama 3.1 via Replicate');
  console.log('');

  console.log('='.repeat(80));
  console.log('✅ Rapport généré avec succès !');
  console.log('='.repeat(80) + '\n');

  // Sauvegarder en JSON
  const jsonReport = {
    generated_at: new Date().toISOString(),
    summary: {
      total_functions: AI_FUNCTIONS.length,
      daily_cost: totalDailyCost,
      monthly_cost: totalDailyCost * 30,
      annual_cost: totalDailyCost * 365,
      daily_tokens: totalDailyTokens,
      monthly_tokens: totalDailyTokens * 30,
      annual_tokens: totalDailyTokens * 365
    },
    functions: reportData,
    pricing: PRICING
  };

  const reportPath = path.join(__dirname, '../reports/ai-consumption-report.json');
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));
  console.log(`📄 Rapport JSON sauvegardé: ${reportPath}\n`);

  return jsonReport;
}

// Exécution
if (require.main === module) {
  generateReport();
}

module.exports = { generateReport, AI_FUNCTIONS, PRICING };
