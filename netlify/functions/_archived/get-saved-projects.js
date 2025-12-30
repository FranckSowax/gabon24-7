const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event, context) => {
  // Configuration CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  // Vérifier que c'est une requête GET
  if (event.httpMethod !== 'GET') {
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

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration')
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuration manquante' })
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Récupérer les paramètres de la requête
    const { userId, limit = 20, offset = 0 } = event.queryStringParameters || {}

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'userId requis' })
      }
    }

    // Récupérer les projets sauvegardés de l'utilisateur
    const { data: projects, error } = await supabase
      .from('saved_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    if (error) {
      console.error('Supabase error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Erreur lors de la récupération des projets',
          details: error.message 
        })
      }
    }

    // Calculer les statistiques manuellement pour éviter les erreurs de fonction
    const { data: allProjects, error: allProjectsError } = await supabase
      .from('saved_projects')
      .select('secteur_selectionne, budget_selectionne, created_at')
      .eq('user_id', userId)

    let stats = {
      total_projects: 0,
      projects_by_sector: {},
      projects_by_budget: {},
      recent_projects_count: 0
    }

    if (!allProjectsError && allProjects) {
      stats.total_projects = allProjects.length
      
      // Compter par secteur
      const sectorCounts = {}
      const budgetCounts = {}
      let recentCount = 0
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      allProjects.forEach(project => {
        // Secteurs
        const sector = project.secteur_selectionne || 'Non défini'
        sectorCounts[sector] = (sectorCounts[sector] || 0) + 1
        
        // Budgets
        const budget = project.budget_selectionne || 'Non défini'
        budgetCounts[budget] = (budgetCounts[budget] || 0) + 1
        
        // Projets récents
        if (new Date(project.created_at) >= thirtyDaysAgo) {
          recentCount++
        }
      })

      stats.projects_by_sector = sectorCounts
      stats.projects_by_budget = budgetCounts
      stats.recent_projects_count = recentCount
    }

    console.log(`Retrieved ${projects.length} saved projects for user ${userId}`)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        projects: projects || [],
        stats: stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: projects?.length || 0
        }
      })
    }

  } catch (error) {
    console.error('Error retrieving saved projects:', error)
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
