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
    const { article, secteur, budget } = requestData

    console.log('📥 Received data:', { 
      article: article?.title, 
      secteur: secteur?.nom,
      budget: budget 
    })
    
    if (!article || !article.title) {
      console.log('❌ Missing article or title')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Article title is required' })
      }
    }

    if (!secteur || !secteur.nom) {
      console.log('❌ Missing secteur')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Secteur is required' })
      }
    }

    if (!budget) {
      console.log('❌ Missing budget')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Budget level is required' })
      }
    }

    // Check available AI APIs
    console.log('🔑 AI API Keys status:')
    console.log('OpenAI:', openaiApiKey ? `AVAILABLE (${openaiApiKey.length} chars)` : 'NOT FOUND')
    console.log('DeepSeek:', deepseekApiKey ? `AVAILABLE (${deepseekApiKey.length} chars)` : 'NOT FOUND')
    
    // Check if Replicate or OpenAI is available
    const hasReplicate = replicateToken && replicateToken.trim() !== '' && replicateToken !== 'undefined' && replicateToken !== 'null'
    const hasOpenAI = openaiApiKey && openaiApiKey.trim() !== '' && openaiApiKey !== 'undefined' && openaiApiKey !== 'null'
    
    if (!hasReplicate && !hasOpenAI) {
      console.log('⚠️ Using DEMO data - No AI API keys configured')
      const demoOpportunities = generateDemoOpportunities(article, secteur, budget)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(demoOpportunities)
      }
    }

    // Try GPT-5 Nano first (Replicate), fallback to OpenAI if needed
    console.log('🚀 Calling GPT-5 Nano (Replicate) for opportunities generation...')
    let opportunities
    try {
      opportunities = await generateOpportunitiesWithGPT5Nano(article, secteur, budget)
    } catch (error) {
      console.log('❌ GPT-5 Nano failed, using demo data')
      const demoOpportunities = generateDemoOpportunities(article, secteur, budget)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(demoOpportunities)
      }
    }

    console.log('✅ AI opportunities generation completed')

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(opportunities)
    }

  } catch (error) {
    console.error('❌ Error generating opportunities:', error)
    
    // Fallback to demo data
    console.log('🔄 Falling back to DEMO data due to error')
    const demoOpportunities = generateDemoOpportunities(
      { title: 'Article par défaut' }, 
      { nom: 'Secteur par défaut' }, 
      'micro'
    )
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(demoOpportunities)
    }
  }
}

async function generateOpportunitiesWithGPT5Nano(article, secteur, budget) {
  console.log('🚀 Starting GPT-5 Nano opportunities generation...')
  
  const budgetInfo = {
    micro: { range: '0-500K XAF', description: 'Micro-entrepreneur individuel' },
    petit: { range: '500K-2M XAF', description: 'Petite entreprise familiale' },
    moyen: { range: '2M-10M XAF', description: 'Entreprise de taille moyenne' },
    confortable: { range: '10M+ XAF', description: 'Grande entreprise/investissement' }
  }

  const prompt = `Tu es un expert business gabonais. Génère 3 opportunités d'affaires spécifiques pour le budget ${budget.toUpperCase()}.

**CONTEXTE GABONAIS :**
Population: 2.3M, Mobile: 85%, Internet: 62%
Économie: Pétrole, bois, manganèse, agriculture

**SECTEUR CHOISI :** ${secteur.nom}
**BUDGET :** ${budgetInfo[budget].range} (${budgetInfo[budget].description})

**ARTICLE ANALYSÉ :**
Titre: ${article.title}
Contenu: ${article.summary || article.content || 'Contenu non disponible'}

Réponds en JSON strict:
{
  "opportunites": [
    {
      "titre": "Nom de l'opportunité",
      "description": "Description adaptée au budget ${budget}",
      "investissement_initial": "Montant précis en XAF",
      "revenus_mensuels": "Estimation en XAF/mois",
      "actions_immediates": ["Action 1", "Action 2", "Action 3"],
      "ressources_necessaires": ["Ressource 1", "Ressource 2"],
      "delai_lancement": "X semaines/mois",
      "score_faisabilite": 8
    }
  ]
}

IMPORTANT: Réponds UNIQUEMENT avec le JSON, sans texte avant ou après.`

  try {
    // Appeler GPT-5 Nano avec fallback OpenAI
    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Expert business gabonais. Réponds en JSON strict uniquement.',
      maxTokens: 600,
      temperature: 0.5,
      returnJSON: true,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    })

    console.log('🎯 GPT-5 Nano response received')
    console.log('📊 Provider:', result.provider, '| Model:', result.model)
    console.log('⏱️  Elapsed:', result.elapsed_ms, 'ms')
    
    // Calculer le coût
    const cost = calculateCost(result.usage, result.provider, result.model)
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`, `(${result.provider})`)
    
    // Le contenu est déjà parsé en JSON par le helper
    const opportunitiesData = result.content
    console.log('✅ Successfully parsed AI response')
    
    return {
      id: `opportunities_${Date.now()}`,
      secteur: secteur.nom,
      budget: budget,
      ...opportunitiesData
    }

  } catch (error) {
    console.error('❌ AI API error:', error)
    throw error
  }
}

function generateDemoOpportunities(article, secteur, budget) {
  console.log('🎭 Generating DEMO opportunities data for:', { 
    article: article.title, 
    secteur: secteur.nom, 
    budget 
  })

  const budgetInfo = {
    micro: { range: '0-500K XAF', investment: '250,000 XAF', revenue: '50,000 XAF/mois' },
    petit: { range: '500K-2M XAF', investment: '1,200,000 XAF', revenue: '200,000 XAF/mois' },
    moyen: { range: '2M-10M XAF', investment: '5,000,000 XAF', revenue: '800,000 XAF/mois' },
    confortable: { range: '10M+ XAF', investment: '15,000,000 XAF', revenue: '2,500,000 XAF/mois' }
  }

  return {
    id: `demo_opportunities_${Date.now()}`,
    secteur: secteur.nom,
    budget: budget,
    opportunites: [
      {
        titre: `Opportunité ${secteur.nom} - Budget ${budget.toUpperCase()}`,
        description: `Solution d'affaires adaptée au budget ${budget} dans le secteur ${secteur.nom}, basée sur l'analyse de l'article "${article.title}".`,
        investissement_initial: budgetInfo[budget].investment,
        revenus_mensuels: budgetInfo[budget].revenue,
        actions_immediates: [
          "Étude de marché locale",
          "Identification des partenaires",
          "Préparation du business plan"
        ],
        ressources_necessaires: [
          "Capital de démarrage",
          "Expertise sectorielle",
          "Réseau commercial"
        ],
        delai_lancement: budget === 'micro' ? '4-6 semaines' : budget === 'petit' ? '2-3 mois' : '3-6 mois',
        score_faisabilite: 7
      },
      {
        titre: `Solution Digitale ${secteur.nom}`,
        description: `Approche numérique pour le secteur ${secteur.nom} avec un budget ${budget}, tirant parti des opportunités identifiées.`,
        investissement_initial: budgetInfo[budget].investment,
        revenus_mensuels: budgetInfo[budget].revenue,
        actions_immediates: [
          "Développement MVP",
          "Tests utilisateurs",
          "Stratégie marketing digital"
        ],
        ressources_necessaires: [
          "Compétences techniques",
          "Plateforme digitale",
          "Marketing en ligne"
        ],
        delai_lancement: budget === 'micro' ? '6-8 semaines' : budget === 'petit' ? '3-4 mois' : '4-8 mois',
        score_faisabilite: 8
      },
      {
        titre: `Service Local ${secteur.nom}`,
        description: `Service de proximité dans le secteur ${secteur.nom}, optimisé pour le budget ${budget} et les besoins locaux gabonais.`,
        investissement_initial: budgetInfo[budget].investment,
        revenus_mensuels: budgetInfo[budget].revenue,
        actions_immediates: [
          "Analyse des besoins locaux",
          "Formation équipe",
          "Lancement pilote"
        ],
        ressources_necessaires: [
          "Personnel qualifié",
          "Équipements de base",
          "Local commercial"
        ],
        delai_lancement: budget === 'micro' ? '3-4 semaines' : budget === 'petit' ? '1-2 mois' : '2-4 mois',
        score_faisabilite: 9
      }
    ]
  }
}
