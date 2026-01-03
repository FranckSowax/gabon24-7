/**
 * Routes pour la gestion des projets sauvegardés (Dossiers)
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');
const redisCache = require('../services/redis-cache.service');

// Constantes de cache
const CACHE_TTL = {
  PROJECTS_LIST: 60,      // 1 minute pour la liste
  PROJECT_DETAIL: 120,    // 2 minutes pour le détail
  STATS: 300              // 5 minutes pour les stats
};

// Helpers pour les clés de cache
const getCacheKey = {
  projectsList: (userId) => `projects:list:${userId}`,
  projectDetail: (userId, projectId) => `projects:detail:${userId}:${projectId}`,
  projectStats: (userId) => `projects:stats:${userId}`
};

/**
 * GET /api/saved-projects
 * Récupère tous les projets de l'utilisateur connecté
 * Query params:
 *  - full=true : retourne tous les champs (pour affichage détaillé)
 *  - include_shared=true : inclut les projets partagés en une seule requête
 *  - nocache=true : ignore le cache Redis
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { full, include_shared, nocache } = req.query;

    // Clé de cache unique par utilisateur et options
    const cacheKey = getCacheKey.projectsList(userId) + (full === 'true' ? ':full' : '') + (include_shared === 'true' ? ':shared' : '');

    // Vérifier le cache Redis (sauf si nocache)
    if (nocache !== 'true' && redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    // Champs minimaux pour l'affichage des cartes (performance)
    const cardFields = `
      id,
      proposition_titre,
      proposition_description,
      proposition_score_faisabilite,
      secteur_selectionne,
      budget_selectionne,
      article_image_url,
      article_title,
      created_at,
      progress_percentage,
      current_phase,
      plan_action_steps
    `;

    // Champs complets si demandé
    const selectFields = full === 'true' ? '*' : cardFields;

    // Récupérer les projets personnels
    const { data: personalProjects, error } = await supabaseService.supabase
      .from('saved_projects')
      .select(selectFields)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération projets:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des projets'
      });
    }

    let allProjects = personalProjects || [];

    // Inclure les projets partagés si demandé
    if (include_shared === 'true') {
      try {
        const { data: sharedProjects } = await supabaseService.supabase
          .from('project_collaborators')
          .select(`
            role,
            permissions,
            joined_at,
            saved_projects!inner (${selectFields})
          `)
          .eq('user_id', userId)
          .eq('status', 'accepted');

        if (sharedProjects && sharedProjects.length > 0) {
          const existingIds = new Set(allProjects.map(p => p.id));
          const formattedShared = sharedProjects
            .filter(collab => collab.saved_projects && !existingIds.has(collab.saved_projects.id))
            .map(collab => ({
              ...collab.saved_projects,
              is_shared: true,
              collaboration: {
                role: collab.role,
                permissions: collab.permissions,
                joined_at: collab.joined_at
              }
            }));
          allProjects = [...allProjects, ...formattedShared];
        }
      } catch (sharedError) {
        console.warn('⚠️ Erreur projets partagés:', sharedError.message);
      }
    }

    const response = {
      success: true,
      projects: allProjects,
      count: allProjects.length,
      cached: false
    };

    // Mettre en cache Redis
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, { ...response, cached: true }, CACHE_TTL.PROJECTS_LIST);
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Erreur serveur récupération projets:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/saved-projects/stats
 * Récupère les statistiques des projets de l'utilisateur connecté
 * Query params:
 *  - nocache=true : ignore le cache Redis
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { nocache } = req.query;
    const cacheKey = getCacheKey.projectStats(userId);

    // Vérifier le cache Redis (sauf si nocache)
    if (nocache !== 'true' && redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT stats: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération stats pour userId:', userId);

    const { data: projects, error } = await supabaseService.supabase
      .from('saved_projects')
      .select('secteur_selectionne, budget_selectionne, created_at')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur récupération stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }

    // Calculer les stats
    const stats = {
      total_projects: projects?.length || 0,
      recent_projects_count: 0,
      projects_by_sector: {},
      projects_by_budget: {}
    };

    // Date il y a 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    projects?.forEach(project => {
      // Compter les projets récents
      if (project.created_at && new Date(project.created_at) >= thirtyDaysAgo) {
        stats.recent_projects_count++;
      }

      // Grouper par secteur
      if (project.secteur_selectionne) {
        stats.projects_by_sector[project.secteur_selectionne] =
          (stats.projects_by_sector[project.secteur_selectionne] || 0) + 1;
      }

      // Grouper par budget
      if (project.budget_selectionne) {
        stats.projects_by_budget[project.budget_selectionne] =
          (stats.projects_by_budget[project.budget_selectionne] || 0) + 1;
      }
    });

    console.log('✅ Stats calculées:', stats);

    // Mettre en cache Redis (TTL plus long pour les stats)
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, stats, CACHE_TTL.STATS);
    }

    res.json(stats);

  } catch (error) {
    console.error('❌ Erreur serveur calcul stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/saved-projects/:projectId
 * Récupère un projet spécifique par son ID
 */
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    console.log('📂 Récupération projet:', projectId, 'pour userId:', userId);

    const { data, error } = await supabaseService.supabase
      .from('saved_projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ Erreur récupération projet:', error);
      return res.status(404).json({
        success: false,
        error: 'Projet non trouvé'
      });
    }

    console.log('✅ Projet trouvé:', data?.proposition_titre);

    res.json({
      success: true,
      project: data
    });

  } catch (error) {
    console.error('❌ Erreur serveur récupération projet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/saved-projects/:projectId/stats
 * Récupère les statistiques d'un projet spécifique
 */
router.get('/:projectId/stats', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    console.log('📊 Récupération stats projet:', projectId);

    const { data, error } = await supabaseService.supabase
      .from('saved_projects')
      .select('actions_count, total_credits_used, last_action_at, created_at')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('❌ Erreur récupération stats projet:', error);
      return res.status(404).json({
        success: false,
        error: 'Projet non trouvé'
      });
    }

    const stats = {
      actions_count: data?.actions_count || 0,
      total_credits_used: data?.total_credits_used || 0,
      last_action_at: data?.last_action_at,
      created_at: data?.created_at,
      days_since_creation: data?.created_at
        ? Math.floor((Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0
    };

    console.log('✅ Stats projet:', stats);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Erreur serveur stats projet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/saved-projects
 * Sauvegarde un nouveau projet
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const {
      article,
      analysis,
      secteurSelectionne,
      budgetSelectionne,
      proposition,
      userContext
    } = req.body;

    console.log('💾 Sauvegarde projet pour userId:', userId);
    console.log('📋 Contexte utilisateur:', userContext ? 'Présent' : 'Absent');

    // Validation
    if (!article || !analysis || !secteurSelectionne || !budgetSelectionne || !proposition) {
      console.error('❌ Données manquantes:', {
        article: !!article,
        analysis: !!analysis,
        secteurSelectionne: !!secteurSelectionne,
        budgetSelectionne: !!budgetSelectionne,
        proposition: !!proposition
      });
      return res.status(400).json({ 
        success: false,
        error: 'Données manquantes',
        required: ['article', 'analysis', 'secteurSelectionne', 'budgetSelectionne', 'proposition']
      });
    }

    // Préparer les données pour l'insertion
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
                                 proposition?.investissement || 
                                 proposition?.premiers_investissements || '',
      proposition_rentabilite: proposition?.rentabilite_prevue || 
                              proposition?.rentabilite || '',
      proposition_revenus_mensuels: proposition?.revenus_mensuels_estimes || 
                                   proposition?.revenus_mensuels || '',
      proposition_actions_immediates: Array.isArray(proposition?.actions_immediates) 
                                     ? proposition.actions_immediates 
                                     : [],
      proposition_avantages_concurrentiels: Array.isArray(proposition?.avantages_concurrentiels) 
                                           ? proposition.avantages_concurrentiels 
                                           : (Array.isArray(proposition?.avantages) ? proposition.avantages : []),
      proposition_score_faisabilite: proposition?.score_faisabilite || 0,
      
      // Contexte utilisateur complet
      user_context: userContext || null,
      actions_count: 0,
      last_action_at: null
    };

    console.log('📝 Données projet préparées:', projectData.proposition_titre);

    // Insérer le projet dans Supabase
    const { data, error } = await supabaseService.supabase
      .from('saved_projects')
      .insert([projectData])
      .select();

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la sauvegarde',
        details: error.message 
      });
    }

    console.log('✅ Projet sauvegardé, ID:', data[0]?.id);

    // Invalider le cache Redis pour cet utilisateur
    if (redisCache.isAvailable()) {
      await redisCache.delPattern(`projects:*:${userId}*`);
      console.log('🗑️ Cache invalidé pour userId:', userId);
    }

    res.json({
      success: true,
      message: 'Projet sauvegardé avec succès',
      project: data[0],
      projectId: data[0]?.id
    });

  } catch (error) {
    console.error('❌ Erreur serveur sauvegarde projet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * DELETE /api/saved-projects/:projectId
 * Supprime un projet (vérifie que l'utilisateur est propriétaire)
 */
router.delete('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    console.log('🗑️ Suppression projet:', projectId, 'par userId:', userId);

    // Supprimer seulement si l'utilisateur est propriétaire
    const { error } = await supabaseService.supabase
      .from('saved_projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur suppression projet:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression'
      });
    }

    console.log('✅ Projet supprimé');

    // Invalider le cache Redis pour cet utilisateur
    if (redisCache.isAvailable()) {
      await redisCache.delPattern(`projects:*:${userId}*`);
      await redisCache.del(getCacheKey.projectDetail(userId, projectId));
      console.log('🗑️ Cache invalidé après suppression');
    }

    res.json({
      success: true,
      message: 'Projet supprimé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur serveur suppression projet:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/saved-projects/:projectId/action-plan
 * Génère et sauvegarde le plan d'action d'un projet
 */
router.post('/:projectId/action-plan', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id; // Extrait du JWT
    const { planSteps, creditsUsed } = req.body;

    console.log(`📋 Génération plan d'action pour projet ${projectId}`);

    if (!planSteps || !Array.isArray(planSteps)) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    // Récupérer crédits actuels
    const { data: projectData } = await supabaseService.supabase
      .from('saved_projects')
      .select('total_credits_used')
      .eq('id', projectId)
      .single();

    const currentCredits = projectData?.total_credits_used || 0;

    // Sauvegarder le plan d'action
    const { data, error } = await supabaseService.supabase
      .from('saved_projects')
      .update({
        plan_action_steps: planSteps,
        progress_percentage: 0,
        current_phase: 'planning',
        total_credits_used: currentCredits + (creditsUsed || 25),
        context_updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur sauvegarde plan:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la sauvegarde du plan'
      });
    }

    console.log('✅ Plan d\'action sauvegardé');

    // Invalider le cache Redis pour cet utilisateur
    if (redisCache.isAvailable()) {
      await redisCache.delPattern(`projects:*:${userId}*`);
      await redisCache.del(getCacheKey.projectDetail(userId, projectId));
      console.log('🗑️ Cache invalidé après plan d\'action');
    }

    // 🔔 NOTIFICATION EN TEMPS RÉEL
    try {
      const notificationHelper = require('../utils/notificationHelper');
      await notificationHelper.notifyActionPlanReady(
        userId,
        projectId,
        data.project_name || 'Votre projet',
        planSteps.length
      );
      console.log('✅ Notification plan d\'action envoyée');
    } catch (notifError) {
      console.warn('⚠️ Erreur notification:', notifError.message);
    }

    res.json({
      success: true,
      project: data,
      message: 'Plan d\'action généré avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur génération plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * PATCH /api/saved-projects/:projectId/update-steps
 * Met à jour les étapes du plan d'action
 */
router.patch('/:projectId/update-steps', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { planSteps, progressPercentage } = req.body;

    if (!planSteps || !Array.isArray(planSteps)) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    // Vérifier que l'utilisateur est propriétaire du projet
    const { data, error } = await supabaseService.supabase
      .from('saved_projects')
      .update({
        plan_action_steps: planSteps,
        progress_percentage: progressPercentage || 0,
        context_updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour steps:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour'
      });
    }

    // Invalider le cache Redis pour cet utilisateur
    if (redisCache.isAvailable()) {
      await redisCache.delPattern(`projects:list:${userId}*`);
      await redisCache.del(getCacheKey.projectDetail(userId, projectId));
      console.log('🗑️ Cache invalidé après mise à jour steps');
    }

    res.json({
      success: true,
      project: data
    });

  } catch (error) {
    console.error('❌ Erreur update steps:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
