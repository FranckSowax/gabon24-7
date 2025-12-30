const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event, context) => {
  // Configuration CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Gérer les requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  // Vérifier que c'est une requête POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    // Initialiser Supabase
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      supabaseUrlLength: supabaseUrl?.length || 0,
      supabaseKeyLength: supabaseKey?.length || 0
    })

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Configuration manquante',
          details: {
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseKey
          }
        })
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parser les données de la requête
    const requestData = JSON.parse(event.body)
    console.log('Save project request:', JSON.stringify(requestData, null, 2))

    // Extraire les données requises
    const {
      userId,
      article,
      analysis,
      secteurSelectionne,
      budgetSelectionne,
      proposition
    } = requestData

    // Validation des données requises avec logging détaillé
    if (!userId || !article || !analysis || !secteurSelectionne || !budgetSelectionne || !proposition) {
      console.error('Missing required data:', {
        userId: !!userId,
        article: !!article,
        analysis: !!analysis,
        secteurSelectionne: !!secteurSelectionne,
        budgetSelectionne: !!budgetSelectionne,
        proposition: !!proposition
      })
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Données manquantes',
          required: ['userId', 'article', 'analysis', 'secteurSelectionne', 'budgetSelectionne', 'proposition'],
          received: {
            userId: !!userId,
            article: !!article,
            analysis: !!analysis,
            secteurSelectionne: !!secteurSelectionne,
            budgetSelectionne: !!budgetSelectionne,
            proposition: !!proposition
          }
        })
      }
    }

    // Préparer les données pour l'insertion avec gestion des erreurs
    const projectData = {
      user_id: userId,
      
      // Données de l'article
      article_title: article?.title || 'Titre non disponible',
      article_summary: article?.summary || '',
      article_url: article?.url || '',
      article_image_url: article?.image_url || null,
      article_source: article?.source || null,
      article_published_at: article?.published_at || null,
      
      // Analyse contextuelle avec fallbacks
      problematique_centrale: analysis?.analyse_contextuelle?.problematique_centrale || 
                             analysis?.problematique_centrale || 
                             'Problématique non définie',
      secteur_principal: analysis?.analyse_contextuelle?.secteur_principal || 
                        analysis?.secteur_principal || '',
      acteurs_impactes: Array.isArray(analysis?.analyse_contextuelle?.acteurs_impactes) 
                       ? analysis.analyse_contextuelle.acteurs_impactes.join(', ')
                       : (analysis?.acteurs_impactes || ''),
      urgence_score: analysis?.analyse_contextuelle?.urgence_score || 
                    analysis?.urgence_score || 0,
      
      // Secteur et budget sélectionnés
      secteur_selectionne: secteurSelectionne,
      budget_selectionne: budgetSelectionne,
      
      // Proposition sauvegardée avec fallbacks
      proposition_titre: proposition?.titre || 'Proposition sans titre',
      proposition_description: proposition?.description || '',
      proposition_investissement: proposition?.investissement_initial || 
                                 proposition?.investissement || '',
      proposition_rentabilite: proposition?.rentabilite_prevue || 
                              proposition?.rentabilite || '',
      proposition_revenus_mensuels: proposition?.revenus_mensuels_estimes || 
                                   proposition?.revenus_mensuels || '',
      proposition_actions_immediates: Array.isArray(proposition?.actions_immediates) 
                                     ? proposition.actions_immediates 
                                     : [],
      proposition_avantages_concurrentiels: Array.isArray(proposition?.avantages_concurrentiels) 
                                           ? proposition.avantages_concurrentiels 
                                           : [],
      proposition_score_faisabilite: proposition?.score_faisabilite || 0
    }

    console.log('Prepared project data:', JSON.stringify(projectData, null, 2))

    // Insérer le projet dans Supabase
    const { data, error } = await supabase
      .from('saved_projects')
      .insert([projectData])
      .select()

    if (error) {
      console.error('Supabase error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Erreur lors de la sauvegarde',
          details: error.message 
        })
      }
    }

    console.log('Project saved successfully:', data[0]?.id)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Projet sauvegardé avec succès',
        projectId: data[0]?.id
      })
    }

  } catch (error) {
    console.error('Error saving project:', error)
    console.error('Error stack:', error.stack)
    console.error('Request body:', event.body)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur interne du serveur',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  }
}
