const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const openaiApiKey = process.env.OPENAI_API_KEY
const deepseekApiKey = process.env.DEEPSEEK_API_KEY

// Fonction unifiée pour appeler les APIs IA
async function analyzeWithAI(secteur, budget, problematique, provider = 'openai') {
  const isOpenAI = provider === 'openai'
  const apiKey = isOpenAI ? openaiApiKey : deepseekApiKey
  const endpoint = isOpenAI 
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.deepseek.com/chat/completions'
  const model = isOpenAI ? 'gpt-3.5-turbo' : 'deepseek-chat'

  console.log(`🚀 Génération de propositions avec ${provider.toUpperCase()}...`)
  
  const prompt = `Tu es un expert en développement d'affaires au Gabon. 

CONTEXTE:
- Secteur d'activité: ${secteur}
- Budget de démarrage: ${budget}
- Problématique identifiée: ${problematique}

MISSION: Génère exactement 3 propositions de projets business concrets, réalisables et adaptés au contexte gabonais.

CONTRAINTES:
- Chaque proposition doit être adaptée au budget spécifié
- Solutions pratiques et réalistes pour le marché gabonais
- Focus sur la rentabilité rapide
- Réponse UNIQUEMENT en JSON valide, aucun autre texte

FORMAT JSON REQUIS:
{
  "propositions": [
    {
      "titre": "Nom du projet",
      "description": "Description courte et claire (max 150 mots)",
      "investissement_initial": "Montant en XAF",
      "rentabilite_prevue": "Délai en mois",
      "revenus_mensuels_estimes": "Montant en XAF/mois",
      "actions_immediates": ["Action 1", "Action 2", "Action 3"],
      "avantages_concurrentiels": ["Avantage 1", "Avantage 2"],
      "score_faisabilite": 85
    }
  ]
}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 25000)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.3
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 429) {
        console.log(`⏳ Rate limit ${provider}, attente 2s...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        return await analyzeWithAI(secteur, budget, problematique, provider)
      }
      throw new Error(`Erreur API ${provider}: ${response.status}`)
    }

    const data = await response.json()
    let content = data.choices[0].message.content.trim()
    
    // Nettoyage du JSON
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    if (content.startsWith('```')) content = content.substring(3)
    if (content.endsWith('```')) content = content.slice(0, -3)
    
    const result = JSON.parse(content)
    console.log(`✅ Propositions générées avec ${provider.toUpperCase()}`)
    return result

  } catch (error) {
    clearTimeout(timeoutId)
    console.error(`❌ Erreur ${provider}:`, error.message)
    throw error
  }
}

function generateDemoProposals(secteur, budget) {
  console.log('🎭 Génération de propositions DEMO')
  return {
    propositions: [
      {
        titre: "Solution Digitale Locale",
        description: "Développement d'une plateforme numérique adaptée au secteur " + secteur + " avec un budget " + budget + ". Solution mobile-first exploitant les opportunités du marché gabonais avec focus sur l'inclusion financière et l'accessibilité.",
        investissement_initial: "750,000 XAF",
        rentabilite_prevue: "6 mois",
        revenus_mensuels_estimes: "400,000 XAF/mois",
        actions_immediates: [
          "Étude de marché ciblée sur 50 clients potentiels",
          "Développement MVP avec fonctionnalités essentielles",
          "Partenariat avec opérateur mobile pour paiements"
        ],
        avantages_concurrentiels: [
          "Premier sur le marché gabonais",
          "Adaptation locale parfaite"
        ],
        score_faisabilite: 82
      },
      {
        titre: "Service de Proximité Innovant",
        description: "Création d'un service répondant aux besoins quotidiens des Gabonais dans le secteur " + secteur + ". Approche communautaire avec réseau de partenaires locaux et système de livraison optimisé pour les villes gabonaises.",
        investissement_initial: "500,000 XAF",
        rentabilite_prevue: "4 mois",
        revenus_mensuels_estimes: "300,000 XAF/mois",
        actions_immediates: [
          "Identifier 10 partenaires locaux stratégiques",
          "Lancer programme pilote dans un quartier",
          "Créer système de commande via WhatsApp"
        ],
        avantages_concurrentiels: [
          "Réseau local établi",
          "Coûts opérationnels réduits"
        ],
        score_faisabilite: 88
      },
      {
        titre: "Marketplace Gabonais Spécialisé",
        description: "Plateforme e-commerce dédiée au secteur " + secteur + " connectant producteurs et consommateurs gabonais. Interface bilingue français-langues locales avec système de paiement mobile et livraison adaptée au contexte local.",
        investissement_initial: "1,200,000 XAF",
        rentabilite_prevue: "8 mois",
        revenus_mensuels_estimes: "600,000 XAF/mois",
        actions_immediates: [
          "Recruter 20 vendeurs pilotes",
          "Développer interface utilisateur intuitive",
          "Négocier tarifs préférentiels avec transporteurs"
        ],
        avantages_concurrentiels: [
          "Spécialisation sectorielle",
          "Support client en langues locales"
        ],
        score_faisabilite: 75
      }
    ]
  }
}

function buildMCPContext(opportunityData) {
  let context = '\n**DONNÉES CONTEXTUELLES MCP :**\n';
  
  if (opportunityData.factual_data) {
    const factual = opportunityData.factual_data;
    if (factual.demographics) {
      context += `- Population cible: ${factual.demographics.population || 'N/A'}\n`;
      context += `- Densité: ${factual.demographics.density || 'N/A'}\n`;
    }
    if (factual.economic_indicators) {
      context += `- Économie locale: ${factual.economic_indicators.main_economy || 'N/A'}\n`;
      context += `- Devise: ${factual.economic_indicators.currency || 'XAF'}\n`;
    }
  }
  
  if (opportunityData.market_research) {
    const market = opportunityData.market_research;
    context += '\n**ANALYSE DE MARCHÉ MCP :**\n';
    
    if (market.market_size) {
      context += `- Taille de marché: ${market.market_size.estimated_value || 'En développement'}\n`;
    }
    
    if (market.growth_trends && market.growth_trends.length > 0) {
      context += `- Tendances: ${market.growth_trends.slice(0, 2).join(', ')}\n`;
    }
    
    if (market.customer_segments && market.customer_segments.length > 0) {
      const segments = market.customer_segments.map(s => `${s.name} (${s.potential || s.size || 'Potentiel à évaluer'})`).join(', ');
      context += `- Segments clients: ${segments}\n`;
    }
  }
  
  if (opportunityData.competitor_analysis && opportunityData.competitor_analysis.direct_competitors) {
    const competitors = opportunityData.competitor_analysis.direct_competitors;
    if (competitors.length > 0) {
      context += '\n**CONCURRENCE IDENTIFIÉE :**\n';
      competitors.slice(0, 2).forEach(comp => {
        context += `- ${comp.name}: ${comp.strengths ? comp.strengths.join(', ') : 'Concurrent actif'}\n`;
      });
    }
  }
  
  return context;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  try {
    const { secteur, budget, problematique, opportunityId } = JSON.parse(event.body)
    
    console.log('🎯 Génération de propositions pour:', { secteur, budget, problematique })

    // Récupérer les données d'enrichissement MCP si disponibles
    let mcpContext = '';
    if (opportunityId) {
      try {
        console.log('🔍 Récupération données MCP pour:', opportunityId);
        const { data: opportunityData } = await supabase
          .from('opportunity_analyses')
          .select('factual_data, market_research, competitor_analysis')
          .eq('id', opportunityId)
          .single();
    if (!secteur || !budget || !problematique) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Paramètres manquants: secteur, budget et problématique requis' 
        })
      }
    }

    console.log(`📊 Génération de propositions pour:`, { secteur, budget, problematique })

    let result

    // Tentative avec OpenAI
    if (openaiApiKey) {
      try {
        result = await analyzeWithAI(secteur, budget, problematique, 'openai')
      } catch (error) {
        console.log('⚠️ OpenAI échoué, tentative DeepSeek...')
        
        // Fallback vers DeepSeek
        if (deepseekApiKey) {
          try {
            result = await analyzeWithAI(secteur, budget, problematique, 'deepseek')
          } catch (deepseekError) {
            console.log('⚠️ DeepSeek échoué aussi, utilisation des données démo')
            result = generateDemoProposals(secteur, budget)
          }
        } else {
          console.log('⚠️ Pas de clé DeepSeek, utilisation des données démo')
          result = generateDemoProposals(secteur, budget)
        }
      }
    } else {
      console.log('⚠️ Pas de clé OpenAI, tentative DeepSeek...')
      
      if (deepseekApiKey) {
        try {
          result = await analyzeWithAI(secteur, budget, problematique, 'deepseek')
        } catch (error) {
          console.log('⚠️ DeepSeek échoué, utilisation des données démo')
          result = generateDemoProposals(secteur, budget)
        }
      } else {
        console.log('⚠️ Aucune clé API disponible, utilisation des données démo')
        result = generateDemoProposals(secteur, budget)
      }
    }

    // Sauvegarde optionnelle en base
    if (supabaseUrl && supabaseKey) {
      try {
        await supabase.from('project_proposals').insert({
          secteur,
          budget,
          problematique,
          propositions: result.propositions,
          created_at: new Date().toISOString()
        })
        console.log('💾 Propositions sauvegardées en base')
      } catch (dbError) {
        console.log('⚠️ Erreur sauvegarde base:', dbError.message)
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message 
      })
    }
  }
}
