const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function callAI(prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Expert business gabonais spécialisé en personnalisation. Réponds en JSON strict uniquement.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.8
    })
  })

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    throw new Error('No valid JSON found in AI response')
  }
  
  return JSON.parse(jsonMatch[0])
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { 
      originalProposal, 
      userContext, 
      secteur, 
      budget, 
      problematique,
      userId = 'demo-user' // À remplacer par l'authentification réelle
    } = JSON.parse(event.body)

    if (!originalProposal || !userContext || !secteur) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      }
    }

    // 1. Sauvegarder le contexte utilisateur
    const { data: contextData, error: contextError } = await supabase
      .from('user_contexts')
      .upsert({
        user_id: userId,
        situation: userContext.situation,
        competences: userContext.competences,
        disponibilite: userContext.disponibilite,
        budget_personnel: userContext.budget_personnel,
        objectif_delai: userContext.objectif_delai,
        contraintes: userContext.contraintes,
        experience_entrepreneuriale: userContext.experience_entrepreneuriale,
        secteurs_interesse: [secteur],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (contextError) {
      console.error('Context save error:', contextError)
      // Continue malgré l'erreur de sauvegarde
    }

    // 2. Générer la proposition personnalisée avec IA
    const prompt = `Tu es un expert business gabonais spécialisé en personnalisation.

PROPOSITION ORIGINALE:
${JSON.stringify(originalProposal, null, 2)}

CONTEXTE UTILISATEUR:
- Situation: ${userContext.situation}
- Compétences: ${userContext.competences.join(', ')}
- Disponibilité: ${userContext.disponibilite}
- Budget personnel: ${userContext.budget_personnel}
- Objectif délai: ${userContext.objectif_delai}
- Expérience: ${userContext.experience_entrepreneuriale}
- Contraintes: ${userContext.contraintes || 'Aucune'}

BUDGET BUSINESS: ${budget}
SECTEUR: ${secteur}
PROBLÉMATIQUE: ${problematique}

MISSION: Personnalise complètement cette proposition business en l'adaptant au profil utilisateur.

RÈGLES DE PERSONNALISATION:
1. Adapte le titre et la description selon les compétences
2. Modifie les premiers investissements selon le budget personnel
3. Ajuste le délai de lancement selon l'objectif et la disponibilité  
4. Personnalise les avantages selon l'expérience
5. Adapte les défis selon la situation
6. Ajoute des recommandations spécifiques au profil
7. Respecte les contraintes mentionnées

Réponds en JSON strict:
{
  "titre": "Titre personnalisé intégrant les compétences",
  "description": "Description détaillée adaptée au profil (200-250 mots)",
  "premiers_investissements": "Liste adaptée au budget personnel et compétences",
  "delai_lancement": "Délai adapté à la disponibilité et expérience",
  "avantages": [
    "Avantage 1 personnalisé",
    "Avantage 2 selon compétences",
    "Avantage 3 selon situation"
  ],
  "defis": [
    "Défi 1 adapté au profil",
    "Défi 2 selon expérience"
  ],
  "score_faisabilite": 85,
  "adaptations_contexte": "Explication des adaptations apportées selon le profil",
  "recommandations_specifiques": [
    "Recommandation 1 personnalisée",
    "Recommandation 2 selon compétences",
    "Recommandation 3 selon contraintes"
  ],
  "etapes_prioritaires": [
    "Étape 1 prioritaire pour ce profil",
    "Étape 2 selon disponibilité",
    "Étape 3 selon expérience"
  ]
}

IMPORTANT: 
- Utilise les compétences existantes pour maximiser les chances
- Adapte selon la disponibilité (temps partiel = étapes plus étalées)
- Intègre les contraintes dans les solutions
- Sois concret et actionnable pour le Gabon`

    const personalizedData = await callAI(prompt)

    // 3. Sauvegarder la proposition personnalisée
    const { data: proposalData, error: proposalError } = await supabase
      .from('personalized_proposals')
      .insert({
        user_id: userId,
        context_id: contextData?.id,
        original_proposal_data: originalProposal,
        secteur,
        budget_range: budget,
        problematique,
        titre: personalizedData.titre,
        description: personalizedData.description,
        premiers_investissements: personalizedData.premiers_investissements,
        delai_lancement: personalizedData.delai_lancement,
        avantages: personalizedData.avantages,
        defis: personalizedData.defis,
        score_faisabilite: personalizedData.score_faisabilite,
        adaptations_contexte: personalizedData.adaptations_contexte,
        recommandations_specifiques: personalizedData.recommandations_specifiques,
        etapes_prioritaires: personalizedData.etapes_prioritaires,
        ai_model_used: 'gpt-4o-mini',
        generation_metadata: {
          original_score: originalProposal.score_faisabilite,
          personalization_factors: Object.keys(userContext),
          generated_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (proposalError) {
      console.error('Proposal save error:', proposalError)
      // Continue et retourne quand même les données
    }

    // 4. Logger l'interaction
    await supabase
      .from('proposal_interactions')
      .insert({
        user_id: userId,
        proposal_id: proposalData?.id,
        interaction_type: 'viewed',
        interaction_data: {
          personalization_requested: true,
          context_used: userContext
        }
      })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        personalized_proposal: {
          id: proposalData?.id,
          ...personalizedData
        },
        context_saved: !!contextData,
        proposal_saved: !!proposalData
      })
    }

  } catch (error) {
    console.error('Personalization error:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur lors de la personnalisation',
        details: error.message 
      })
    }
  }
}
