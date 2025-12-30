const { callGPT5NanoWithFallback, calculateCost } = require('./utils/replicate-gpt5-helper')

const replicateToken = process.env.REPLICATE_API_TOKEN
const openaiApiKey = process.env.OPENAI_API_KEY

console.log('🔍 Environment check:')
console.log('REPLICATE_API_TOKEN:', replicateToken ? 'SET' : 'MISSING')
console.log('OPENAI_API_KEY:', openaiApiKey ? 'SET (fallback)' : 'MISSING')

// Returns parsed JSON and usage tokens using GPT-5 Nano
async function callAI(prompt) {
  console.log('🚀 Calling GPT-5 Nano for project proposals...')
  
  const result = await callGPT5NanoWithFallback(prompt, {
    systemPrompt: 'Expert business gabonais. Réponds en JSON strict uniquement.',
    maxTokens: 1200,
    temperature: 0.7,
    returnJSON: true,
    fallbackToOpenAI: true,
    openaiModel: 'gpt-4o-mini'
  })

  console.log('✅ Proposals generated')
  console.log('📊 Provider:', result.provider, '| Model:', result.model)
  console.log('⏱️  Elapsed:', result.elapsed_ms, 'ms')
  
  const cost = calculateCost(result.usage, result.provider, result.model)
  console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`, `(${result.provider})`)
  
  return { json: result.content, usage: result.usage }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { secteur, budget, problematique, userContext, article, userId } = JSON.parse(event.body)
    
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

    if (!secteur || !budget || !problematique) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      }
    }

    const articleInfo = article ? `
ARTICLE DE RÉFÉRENCE:
- Titre: ${article.title || ''}
- Source: ${article.source || ''}
- Résumé: ${article.summary || ''}
` : ''

    const userInfo = userContext ? `
PROFIL UTILISATEUR:
- Situation: ${userContext.situation || ''}
- Compétences: ${(userContext.competences || []).join(', ')}
- Disponibilité: ${userContext.disponibilite || ''}
- Objectif délai: ${userContext.objectif_delai || ''}
- Expérience entrepreneuriale: ${userContext.experience_entrepreneuriale || ''}
- Contraintes: ${userContext.contraintes || ''}
` : ''

    const prompt = `Tu es un expert en developpement d'affaires au Gabon.
${budgetInfo}
${articleInfo}
${userInfo}

CONTEXTE GÉNÉRAL:
- Secteur d'activite: ${secteur}
- Budget de demarrage: ${budget}
- Problematique identifiee: ${problematique}

MISSION: Genere exactement 3 propositions de projets business concrets et adaptés au profil utilisateur et à l'article de référence si fourni.

Reponds en JSON strict:
{
  "propositions": [
    {
      "titre": "Nom du projet",
      "description": "Description detaillee du projet (150-200 mots)",
      "premiers_investissements": "Liste concise des 3-6 éléments nécessaires au démarrage (SANS mentionner les coûts ou montants)",
      "delai_lancement": "Delai de lancement estime",
      "avantages": [
        "Avantage 1",
        "Avantage 2",
        "Avantage 3"
      ],
      "defis": [
        "Defi 1",
        "Defi 2"
      ],
      "score_faisabilite": 85
    }
  ]
}

CONCENTREZ-VOUS SUR:
- Idées strictement réalisables avec le budget spécifié
- Adapter aux compétences, à la disponibilité et à l'expérience de l'utilisateur
- Si des contraintes sont présentes, proposer des alternatives compatibles
- Référencer implicitement le contexte de l'article (marché gabonais, acteurs, enjeux)
- Évitez toute prévision de rentabilité ou revenus
- Listez concrètement les premiers investissements nécessaires SANS JAMAIS mentionner de coûts, prix ou montants estimés
- Pour premiers_investissements, listez uniquement les éléments (ex: "Ordinateur portable", "Connexion internet", "Stock initial de produits") SANS aucun chiffre

IMPORTANT: Reponds UNIQUEMENT avec le JSON demande.`

    // Optional credit check (3 credits * 10 units)
    const requiredCredits = 3 * 10
    if (userId) {
      try {
        const host = event.headers && (event.headers['x-forwarded-host'] || event.headers.host)
        const proto = (event.headers && (event.headers['x-forwarded-proto'] || 'https')) || 'https'
        const origin = host ? `${proto}://${host}` : ''
        const chk = await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_balance', userId, requiredCredits })
        }).then(r => r.json())
        if (chk?.hasCredits === false) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: false, needsTopUp: true, requiredCredits, balance: chk.balance ?? 0 })
          }
        }
      } catch (_) {}
    }

    const ai = await callAI(prompt)
    const result = ai.json

    // Valider le format de la réponse
    if (!result || !result.propositions || !Array.isArray(result.propositions)) {
      console.error('❌ Format de réponse invalide:', result)
      throw new Error('Format de réponse AI invalide: propositions manquantes ou invalides')
    }

    // Valider chaque proposition
    const validPropositions = result.propositions.filter(p => {
      const isValid = p.titre && p.description && typeof p.score_faisabilite === 'number'
      if (!isValid) {
        console.warn('⚠️ Proposition invalide ignorée:', p)
      }
      return isValid
    }).map(p => {
      // Nettoyer les coûts estimés dans premiers_investissements
      if (p.premiers_investissements && typeof p.premiers_investissements === 'string') {
        // Supprimer les mentions de coûts (patterns: "— coût estimé: X XAF", "coût: X", "prix: X", etc.)
        p.premiers_investissements = p.premiers_investissements
          .replace(/\s*[—–-]\s*coût\s+estimé\s*:\s*[\d\s]+XAF/gi, '')
          .replace(/\s*[—–-]\s*prix\s*:\s*[\d\s]+XAF/gi, '')
          .replace(/\s*[—–-]\s*montant\s*:\s*[\d\s]+XAF/gi, '')
          .replace(/\s*\(\s*[\d\s]+XAF\s*\)/gi, '')
          .replace(/\s*coût\s*:\s*[\d\s]+XAF/gi, '')
          .replace(/\s*prix\s*:\s*[\d\s]+XAF/gi, '')
          .trim()
      }
      return p
    })

    if (validPropositions.length === 0) {
      console.error('❌ Aucune proposition valide')
      throw new Error('Format de réponse AI invalide: aucune proposition valide')
    }

    console.log(`✅ ${validPropositions.length} propositions valides`)

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
            serviceName: 'projects:proposals',
            amount: requiredCredits,
            referenceId: null,
            openaiUsage: ai.usage ? {
              model: 'gpt-4o-mini',
              prompt_tokens: ai.usage.prompt_tokens || 0,
              completion_tokens: ai.usage.completion_tokens || 0,
              total_tokens: ai.usage.total_tokens || 0
            } : undefined
          })
        })
      } catch (_) {}
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        propositions: validPropositions 
      })
    }

  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message
      })
    }
  }
}
