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
      headers
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
    const { secteur, problematique, budget, userId } = JSON.parse(event.body)
    
    if (!secteur || !problematique) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Secteur et problématique requis' })
      }
    }

    console.log('🎯 Generating business ideas for:', { secteur: secteur.nom, problematique, budget, userId })

    // Credits: 2 credits (x10 unit) if userId is provided
    const requiredCredits = 2 * 10
    let hasCredits = true
    let balance = null
    if (userId) {
      const host = event.headers && (event.headers['x-forwarded-host'] || event.headers.host)
      const proto = (event.headers && (event.headers['x-forwarded-proto'] || 'https')) || 'https'
      const origin = host ? `${proto}://${host}` : ''
      try {
        const chkResp = await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_balance', userId, requiredCredits })
        })
        const chk = await chkResp.json()
        hasCredits = chk.hasCredits !== false
        balance = chk.balance ?? null
        if (!hasCredits) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: false, needsTopUp: true, requiredCredits, balance })
          }
        }
      } catch (e) {
        // tolerate credit check error
        hasCredits = true
      }
    }

    // Check if Replicate or OpenAI API key is available
    const hasReplicate = replicateToken && replicateToken.trim() !== ''
    const hasOpenAI = openaiApiKey && openaiApiKey.trim() !== ''
    
    if (!hasReplicate && !hasOpenAI) {
      console.log('⚠️ Using DEMO data - No AI API keys configured')
      const demoIdeas = generateDemoBusinessIdeas(secteur, problematique, budget)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(demoIdeas)
      }
    }

    console.log('🚀 Calling GPT-5 Nano (Replicate) for business ideas generation...')
    const businessIdeas = await generateWithGPT5Nano(secteur, problematique, budget)
    
    // Consume credits after success
    if (userId) {
      try {
        const host = event.headers && (event.headers['x-forwarded-host'] || event.headers.host)
        const proto = (event.headers && (event.headers['x-forwarded-proto'] || 'https')) || 'https'
        const origin = host ? `${proto}://${host}` : ''
        await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'consume_credits',
            userId,
            serviceName: 'gbi:ideas',
            amount: requiredCredits,
            referenceId: null,
            openaiUsage: { model: 'gpt-4o-mini', prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
          })
        })
      } catch (_) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(businessIdeas)
    }

  } catch (error) {
    console.error('❌ Error generating business ideas:', error)
    
    // Extract budget from the error context (if parsing failed, use null)
    let budgetFallback = null
    try {
      const requestData = JSON.parse(event.body)
      budgetFallback = requestData.budget
    } catch (parseError) {
      console.log('Could not extract budget for fallback')
    }
    
    // Fallback to demo data on error
    const demoIdeas = generateDemoBusinessIdeas(
      { nom: 'Secteur Général' }, 
      'Problématique générale',
      budgetFallback
    )
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(demoIdeas)
    }
  }
}

async function generateWithGPT5Nano(secteur, problematique, budget) {
  // Adapter le prompt selon le budget
  const budgetInfo = budget ? `
**BUDGET DISPONIBLE :** ${budget}
IMPORTANT: Adaptez absolument toutes les idées à ce budget spécifique. 
${budget.includes('50,000') || budget.includes('100,000') || budget.includes('200,000') ? 
  'BUDGET TRÈS SERRÉ - Proposez uniquement des idées nécessitant un investissement minimal (services, digital, compétences).' : 
  budget.includes('500,000') || budget.includes('1,000,000') ? 
  'BUDGET MODÉRÉ - Privilégiez les idées avec investissement équipement léger ou stock minimal.' :
  'BUDGET PLUS ÉLEVÉ - Vous pouvez inclure des idées nécessitant équipement ou local.'
}` : ''

  const prompt = `
Générez 3 idées de business concrètes pour le secteur "${secteur.nom}" au Gabon, en réponse à cette problématique : "${problematique}"
${budgetInfo}

Contexte du secteur :
- Description : ${secteur.description}
- Potentiel : ${secteur.potentiel}
- Problématique liée : ${secteur.problematique_liee}

Répondez UNIQUEMENT avec un objet JSON valide contenant :
{
  "secteur": "${secteur.nom}",
  "problematique": "${problematique}",
  "budget_cible": "${budget || 'Non spécifié'}",
  "idees": [
    {
      "titre": "Nom de l'idée business 1",
      "description": "Description détaillée de l'idée (150-200 mots)",
      "premiers_investissements": "Ordinateur, connexion internet, site web, marketing initial",
      "delai_lancement": "Délai de lancement estimé",
      "avantages": ["avantage1", "avantage2", "avantage3"],
      "defis": ["défi1", "défi2"],
      "score_faisabilite": 85
    },
    {
      "titre": "Nom de l'idée business 2", 
      "description": "Description détaillée",
      "premiers_investissements": "Liste des premiers achats/investissements nécessaires",
      "delai_lancement": "Délai",
      "avantages": ["avantage1", "avantage2", "avantage3"],
      "defis": ["défi1", "défi2"],
      "score_faisabilite": 78
    },
    {
      "titre": "Nom de l'idée business 3",
      "description": "Description détaillée", 
      "premiers_investissements": "Liste concrète des premiers investissements",
      "delai_lancement": "Délai",
      "avantages": ["avantage1", "avantage2", "avantage3"],
      "defis": ["défi1", "défi2"],
      "score_faisabilite": 72
    }
  ]
}

CONCENTREZ-VOUS SUR:
- Idées réalisables avec le budget spécifié
- Marchés gabonais spécifiques
- Évitez toute prévision de rentabilité ou revenus
- Listez concrètement les premiers investissements nécessaires`

  try {
    console.log('🚀 Calling GPT-5 Nano...')
    
    // Appeler GPT-5 Nano avec fallback OpenAI
    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: 'Vous êtes un expert en entrepreneuriat et développement économique au Gabon. Vous générez des idées de business concrètes et réalisables.',
      maxTokens: 1000,
      temperature: 0.8,
      returnJSON: true,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    })

    console.log('✅ Business ideas generated successfully')
    console.log('📊 Provider:', result.provider, '| Model:', result.model)
    console.log('⏱️  Elapsed:', result.elapsed_ms, 'ms')
    
    // Calculer le coût
    const cost = calculateCost(result.usage, result.provider, result.model)
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`, `(${result.provider})`)
    
    return result.content

  } catch (error) {
    console.error('❌ OpenAI API error:', error)
    throw error
  }
}

function generateDemoBusinessIdeas(secteur, problematique, budget) {
  // Adapter les idées selon le budget
  const isSmallBudget = budget && (budget.includes('50,000') || budget.includes('100,000') || budget.includes('200,000'))
  
  return {
    secteur: secteur.nom || 'Secteur Général',
    problematique: problematique || 'Problématique générale',
    budget_cible: budget || 'Non spécifié',
    idees: isSmallBudget ? [
      {
        titre: "Service de consultation en ligne",
        description: "Lancement d'un service de conseil spécialisé entièrement en ligne, sans local physique. Utilisation de votre expertise pour accompagner les entreprises locales via visioconférence, email et téléphone. Focus sur votre domaine de compétence avec des tarifs adaptés au marché gabonais.",
        premiers_investissements: "Smartphone avec forfait internet, ordinateur d'occasion, création site web simple, cartes de visite, marketing réseaux sociaux",
        delai_lancement: "2-4 semaines",
        avantages: ["Investissement minimal", "Démarrage immédiat", "Pas de local nécessaire"],
        defis: ["Crédibilité à établir", "Client acquisition"],
        score_faisabilite: 85
      },
      {
        titre: "Vente de produits numériques",
        description: "Création et vente de formations en ligne, guides pratiques ou templates dans votre domaine d'expertise. Plateforme de vente simple avec paiements mobiles pour le marché gabonais. Focus sur des besoins spécifiques identifiés localement.",
        premiers_investissements: "Forfait internet, outils création contenu gratuits, plateforme vente en ligne, marketing initial",
        delai_lancement: "4-6 semaines",
        avantages: ["Revenus passifs", "Scalable", "Coûts très faibles"],
        defis: ["Création contenu de qualité", "Marketing digital"],
        score_faisabilite: 78
      },
      {
        titre: "Service de livraison à domicile spécialisé",
        description: "Service de livraison ultra-local dans votre quartier pour un produit/service spécifique. Démarrage avec votre propre véhicule ou à pied selon la zone. Partenariats avec commerçants locaux pour créer un service de proximité unique.",
        premiers_investissements: "Téléphone, forfait, sacs de transport, flyers quartier, essence véhicule personnel",
        delai_lancement: "1-2 semaines",
        avantages: ["Démarrage rapide", "Marché local", "Relations directes"],
        defis: ["Dépendance météo", "Concurrence informelle"],
        score_faisabilite: 82
      }
    ] : [
      {
        titre: "Plateforme digitale de services",
        description: "Développement d'une plateforme numérique qui connecte les prestataires de services locaux avec les clients. Cette solution répond aux besoins de modernisation et d'efficacité identifiés dans l'actualité. La plateforme inclurait un système de réservation, de paiement mobile et d'évaluation des services.",
        premiers_investissements: "Ordinateur, connexion internet, développement site web, marketing initial, frais légaux création entreprise",
        delai_lancement: "4-6 mois",
        avantages: ["Faibles coûts opérationnels", "Scalabilité élevée", "Réponse aux besoins du marché"],
        defis: ["Adoption technologique", "Concurrence établie"],
        score_faisabilite: 82
      },
      {
        titre: "Centre de formation spécialisée",
        description: "Création d'un centre de formation qui développe les compétences techniques et entrepreneuriales nécessaires pour répondre aux défis identifiés. Le centre proposerait des formations courtes, certifiantes et adaptées aux besoins du marché local gabonais.",
        premiers_investissements: "Location local, équipement audiovisuel, matériel pédagogique, licensing, marketing ouverture",
        delai_lancement: "6-8 mois",
        avantages: ["Demande forte", "Impact social positif", "Revenus récurrents"],
        defis: ["Recrutement formateurs", "Certification officielle"],
        score_faisabilite: 75
      },
      {
        titre: "Service de consulting local",
        description: "Lancement d'un cabinet de conseil spécialisé dans l'accompagnement des entreprises locales pour résoudre les problématiques identifiées. Services incluant l'audit, l'optimisation des processus et la stratégie de développement adaptée au contexte gabonais.",
        premiers_investissements: "Bureau équipé, matériel informatique, site web professionnel, marketing ciblé, frais légaux",
        delai_lancement: "2-4 mois",
        avantages: ["Investissement modéré", "Expertise valorisée", "Réseau professionnel"],
        defis: ["Crédibilité à établir", "Concurrence consultants établis"],
        score_faisabilite: 78
      }
    ]
  }
}
