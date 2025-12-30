const { createClient } = require('@supabase/supabase-js')
const { callGPT5NanoWithFallback, calculateCost } = require('./utils/replicate-gpt5-helper')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const replicateToken = process.env.REPLICATE_API_TOKEN
const openaiApiKey = process.env.OPENAI_API_KEY

console.log('🔍 Environment variables check:')
console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING')
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'SET' : 'MISSING')
console.log('REPLICATE_API_TOKEN:', replicateToken ? `SET (${replicateToken.substring(0, 7)}...)` : 'MISSING')
console.log('OPENAI_API_KEY:', openaiApiKey ? `SET (${openaiApiKey.substring(0, 7)}...)` : 'MISSING (fallback)')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    console.log('📨 Raw event body:', event.body)
    const requestData = JSON.parse(event.body)
    console.log('📋 Parsed request data:', requestData)
    
    // Handle both formats: { article: {...} } and { title, summary, url }
    let article
    if (requestData.article) {
      article = requestData.article
    } else {
      article = {
        title: requestData.title,
        summary: requestData.summary,
        url: requestData.url
      }
    }

    console.log('📥 Received article data:', article)
    
    if (!article || !article.title) {
      console.log('❌ Missing article or title')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Article title is required' })
      }
    }
    
    // Handle missing summary/content gracefully
    if (!article.summary && !article.content) {
      console.log('⚠️ No summary or content, using title only')
      article.summary = article.title
    }

    // Check available AI APIs
    console.log('🔑 AI API Keys status:')
    console.log('Replicate:', replicateToken ? 'AVAILABLE' : 'NOT FOUND')
    console.log('OpenAI:', openaiApiKey ? 'AVAILABLE (fallback)' : 'NOT FOUND')
    console.log('📝 Article to analyze:', { title: article.title, source: article.source })
    
    // Check if Replicate or OpenAI is available
    const hasReplicate = replicateToken && replicateToken.trim() !== '' && replicateToken !== 'undefined' && replicateToken !== 'null'
    const hasOpenAI = openaiApiKey && openaiApiKey.trim() !== '' && openaiApiKey !== 'undefined' && openaiApiKey !== 'null'
    
    if (!hasReplicate && !hasOpenAI) {
      console.log('⚠️ Using DEMO data - No AI API keys configured')
      const demoOpportunity = generateDemoOpportunity(article)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(demoOpportunity)
      }
    }

    // Try GPT-5 Nano first (Replicate), fallback to OpenAI if needed
    console.log('🚀 Calling GPT-5 Nano (Replicate) for complex opportunity analysis...')
    let opportunity
    try {
      opportunity = await analyzeWithGPT5Nano(article)
    } catch (error) {
      console.log('❌ GPT-5 Nano failed, using demo data')
      const demoOpportunity = generateDemoOpportunity(article)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(demoOpportunity)
      }
    }
    console.log('✅ AI analysis completed:', { 
      analyse_contextuelle: opportunity.analyse_contextuelle?.secteur_principal,
      secteurs_count: opportunity.secteurs_opportunites?.length 
    })

    // Enrichissement préalable pour améliorer l'analyse IA
    let enrichmentData = {};
    try {
      console.log('🔍 Applying pre-analysis MCP enrichment...');
      const { OpportunityEnricher } = require('./lib/opportunity-enricher');
      const enricher = new OpportunityEnricher();
      
      // Créer un objet opportunité basique pour l'enrichissement préalable
      const basicOpportunity = {
        id: `temp_${Date.now()}`,
        title: article.title,
        description: article.summary,
        location: 'Libreville', // Par défaut
        sector: 'Général' // Sera affiné après analyse
      };

      // Enrichissement de base pour contextualiser l'analyse IA
      enrichmentData = await enricher.enrichOpportunity(basicOpportunity, 'basic');
      
      // Re-analyser avec le contexte enrichi
      if (Object.keys(enrichmentData).length > 0) {
        console.log('✅ MCP enrichment completed, re-analyzing with context...');
        opportunity = await analyzeWithEnrichedContext(article, enrichmentData);
      }
      
    } catch (enrichError) {
      console.log('⚠️ MCP enrichment failed, continuing with standard analysis:', enrichError.message);
    }

    // Save the analysis to database with enrichment data
    const { data: savedOpportunity, error: dbError } = await supabase
      .from('opportunity_analyses')
      .insert([{
        article_title: article.title,
        article_summary: article.summary,
        article_source: article.source,
        article_url: article.url,
        opportunity_title: opportunity.analyse_contextuelle?.secteur_principal || 'Opportunité',
        opportunity_description: opportunity.analyse_contextuelle?.problematique_centrale || '',
        category: opportunity.analyse_contextuelle?.secteur_principal || 'Général',
        confidence_score: opportunity.analyse_contextuelle?.urgence_score || 5,
        analysis_data: opportunity,
        // Ajout des données d'enrichissement légères
        enrichment_data: enrichmentData,
        factual_data: enrichmentData.factual_data || {},
        market_research: enrichmentData.market_research || {},
        enrichment_status: Object.keys(enrichmentData).length > 0 ? 'basic_completed' : 'none',
        enrichment_level: 'basic',
        data_sources: enrichmentData.data_sources || []
      }])
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Continue without saving to DB
    }

    // Retourner l'analyse enrichie (sans affichage séparé des données MCP)
    const response = {
      ...opportunity,
      saved_opportunity_id: savedOpportunity?.id || null,
      mcp_enhanced: Object.keys(enrichmentData).length > 0
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    }

  } catch (error) {
    console.error('❌ Error analyzing opportunity:', error)
    
    // Return demo data as fallback
    const article = JSON.parse(event.body).article
    console.log('🔄 Falling back to DEMO data due to error')
    const demoOpportunity = generateDemoOpportunity(article)
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(demoOpportunity)
    }
  }
}

async function analyzeWithEnrichedContext(article, enrichmentData, provider = 'openai') {
  console.log(`🚀 Starting ENRICHED ${provider.toUpperCase()} analysis with MCP data...`)
  
  // Construire le contexte enrichi à partir des données MCP
  let enrichedContext = '';
  
  if (enrichmentData.factual_data) {
    enrichedContext += `\n**DONNÉES CONTEXTUELLES MCP :**\n`;
    
    if (enrichmentData.factual_data.demographics) {
      const demo = enrichmentData.factual_data.demographics;
      enrichedContext += `- Population: ${demo.population || 'N/A'}\n`;
      enrichedContext += `- Densité: ${demo.density || 'N/A'}\n`;
    }
    
    if (enrichmentData.factual_data.economic_indicators) {
      const econ = enrichmentData.factual_data.economic_indicators;
      enrichedContext += `- Économie locale: ${econ.main_economy || 'N/A'}\n`;
      enrichedContext += `- Devise: ${econ.currency || 'XAF'}\n`;
    }
  }
  
  if (enrichmentData.market_research) {
    enrichedContext += `\n**ANALYSE DE MARCHÉ MCP :**\n`;
    
    if (enrichmentData.market_research.market_size) {
      enrichedContext += `- Taille de marché: ${enrichmentData.market_research.market_size.estimated_value || 'En développement'}\n`;
    }
    
    if (enrichmentData.market_research.growth_trends && enrichmentData.market_research.growth_trends.length > 0) {
      enrichedContext += `- Tendances: ${enrichmentData.market_research.growth_trends.slice(0, 2).join(', ')}\n`;
    }
    
    if (enrichmentData.market_research.customer_segments && enrichmentData.market_research.customer_segments.length > 0) {
      const segments = enrichmentData.market_research.customer_segments.map(s => `${s.name} (${s.potential || 'Potentiel à évaluer'})`).join(', ');
      enrichedContext += `- Segments clients: ${segments}\n`;
    }
  }

  const enhancedPrompt = `Tu es un expert multidisciplinaire en développement d'affaires au Gabon. Analyse cette actualité pour identifier des opportunités business concrètes en utilisant les données contextuelles fournies.

**CONTEXTE GABONAIS :**
Population: 2.3M, Mobile: 85%, Internet: 62%
Économie: Pétrole, bois, manganèse, agriculture
Défis: Diversification, emploi jeunes, infrastructures
${enrichedContext}

**EXPERTISE :**
Tech, Commerce, Agriculture, Finance, Tourisme, Éducation, Santé, Transport

**MISSION :**
1. Identifier problématique centrale (en utilisant les données contextuelles ci-dessus)
2. Analyser secteurs impactés avec les données de marché  
3. Proposer 3-4 secteurs d'opportunités maximum (intégrer les tendances MCP)

**ARTICLE À ANALYSER :**
Titre: ${article.title}
Résumé: ${article.summary}

Réponds en JSON strict:
{
  "analyse_contextuelle": {
    "secteur_principal": "Secteur principal identifié",
    "problematique_centrale": "Problème identifié ENRICHI avec données contextuelles",
    "acteurs_impactes": "Acteurs concernés + segments clients MCP",
    "urgence_score": 7,
    "ressources_disponibles": "Ressources + données démographiques/économiques MCP"
  },
  "secteurs_opportunites": [
    {
      "nom": "Nom du secteur",
      "description": "Description ENRICHIE avec tendances et données de marché MCP", 
      "score_potentiel": 8
    }
  ]
}`;

  return await callAI(enhancedPrompt, provider);
}

async function analyzeWithGPT5Nano(article) {
  console.log('🚀 Starting GPT-5 Nano analysis...')
  const prompt = `Tu es un expert multidisciplinaire en développement d'affaires au Gabon. Analyse cette actualité pour identifier des opportunités business concrètes.

**CONTEXTE GABONAIS :**
Population: 2.3M, Mobile: 85%, Internet: 62%
Économie: Pétrole, bois, manganèse, agriculture
Défis: Diversification, emploi jeunes, infrastructures

**EXPERTISE :**
Tech, Commerce, Agriculture, Finance, Tourisme, Éducation, Santé, Transport

**MISSION :**
1. Identifier problématique centrale
2. Analyser secteurs impactés  
3. Proposer 3-4 secteurs d'opportunités maximum

Réponds en JSON strict:
{
  "analyse_contextuelle": {
    "secteur_principal": "Secteur",
    "problematique_centrale": "Problème identifié",
    "acteurs_impactes": "Acteurs concernés",
    "urgence_score": 7,
    "ressources_disponibles": "Ressources"
  },
  "secteurs_opportunites": [
    {
      "nom": "Nom du secteur",
      "description": "Description courte du potentiel",
      "score_potentiel": 8
    }
  ]
}

**ARTICLE À ANALYSER :**
Titre: ${article.title}
Résumé: ${article.summary}

IMPORTANT: Réponds UNIQUEMENT avec le JSON demandé, sans texte avant ou après.`

  const result = await callGPT5NanoWithFallback(prompt, {
    systemPrompt: 'Expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens: 800,
    temperature: 0.7,
    returnJSON: true,
    fallbackToOpenAI: true,
    openaiModel: 'gpt-4o-mini'
  })

  console.log('✅ Analysis completed')
  console.log('📊 Provider:', result.provider, '| Model:', result.model)
  
  const cost = calculateCost(result.usage, result.provider, result.model)
  console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`)
  
  return result.content
}

// Fonction obsolète - conservée pour compatibilité
async function analyzeWithAI(article, provider = 'openai') {
  return await analyzeWithGPT5Nano(article)
}

// Fonction obsolète - conservée pour compatibilité
async function callAI(prompt, provider = 'openai') {
  const result = await callGPT5NanoWithFallback(prompt, {
    systemPrompt: 'Expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens: 800,
    temperature: 0.7,
    returnJSON: true,
    fallbackToOpenAI: true,
    openaiModel: 'gpt-4o-mini'
  })
  
  return result.content
}

function generateDemoOpportunity(article) {
  console.log('🎭 Generating DEMO analysis data for:', article.title)
  return {
    id: `demo_analysis_${Date.now()}`,
    analyse_contextuelle: {
      secteur_principal: "Secteur d'activité potentiel",
      problematique_centrale: "Une problématique a été identifiée dans cette actualité nécessitant une attention particulière.",
      acteurs_impactes: "Acteurs économiques locaux",
      urgence_score: 7,
      ressources_disponibles: "Ressources disponibles dans la région"
    },
    secteurs_opportunites: [
      {
        nom: "Technologies & Digital",
        description: "Solutions numériques adaptées au contexte gabonais",
        score_potentiel: 8
      },
      {
        nom: "Services Locaux",
        description: "Prestations de proximité pour les communautés",
        score_potentiel: 9
      },
      {
        nom: "Commerce & Distribution", 
        description: "Optimisation des circuits commerciaux",
        score_potentiel: 7
      }
    ]
  }
}
