/**
 * Routes pour la gestion des projets sauvegardés (Dossiers)
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');
const redisCache = require('../services/redis-cache.service');
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

// ==================== SCHÉMAS DE VALIDATION (.passthrough) ====================
const createProjectSchema = z.object({
  secteurSelectionne: z.string().max(200).optional().nullable(),
  budgetSelectionne: z.union([z.string().max(50), z.number()]).optional().nullable(),
}).passthrough();

const projectActionPlanSchema = z.object({
  planSteps: z.array(z.any()).max(200).optional(),
  creditsUsed: z.coerce.number().int().nonnegative().max(100000).optional().nullable(),
}).passthrough();

const updateStepsSchema = z.object({
  planSteps: z.array(z.any()).max(200).optional(),
  progressPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
}).passthrough();

const illustrationSchema = z.object({
  kind: z.enum(['logo', 'flyer', 'infographic']),
}).passthrough();

// Coût en crédits par type d'illustration
const ILLUSTRATION_CREDITS = { logo: 25, flyer: 30, infographic: 40 };

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
 * GET /api/saved-projects/global-stats
 * Statistiques globales des projets (admin dashboard)
 */
router.get('/global-stats', async (req, res) => {
  try {
    const cacheKey = 'projects:global-stats';

    // Vérifier le cache Redis
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    console.log('📊 Récupération stats globales des projets...');

    // Total projets
    const { count: totalProjects } = await supabaseService.supabase
      .from('saved_projects')
      .select('*', { count: 'exact', head: true });

    // Projets ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: projectsThisMonth } = await supabaseService.supabase
      .from('saved_projects')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth.toISOString());

    const response = {
      success: true,
      stats: {
        totalProjects: totalProjects || 0,
        projectsThisMonth: projectsThisMonth || 0
      }
    };

    // Mettre en cache Redis - 10 minutes
    if (redisCache.isAvailable()) {
      await redisCache.set(cacheKey, response, 600);
    }

    res.json(response);
  } catch (error) {
    console.error('❌ Erreur stats globales projets:', error);
    res.json({
      success: true,
      stats: { totalProjects: 0, projectsThisMonth: 0 }
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
router.post('/', requireAuth, validateBody(createProjectSchema), async (req, res) => {
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
router.post('/:projectId/action-plan', requireAuth, validateBody(projectActionPlanSchema), async (req, res) => {
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
router.patch('/:projectId/update-steps', requireAuth, validateBody(updateStepsSchema), async (req, res) => {
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

const ILLUSTRATION_LABELS = { logo: 'Logo', flyer: 'Flyer de présentation', infographic: 'Infographie — Mon business en 1 image' };

/**
 * POST /api/saved-projects/:projectId/illustration
 * Lance la génération d'une illustration (logo / flyer / infographie) via GPT Image 2.
 * ASYNCHRONE : répond immédiatement avec un documentId, puis génère en arrière-plan
 * (gpt-image-2 dépasse le timeout du proxy → réponse synchrone impossible).
 * Le frontend interroge GET .../illustration/:documentId jusqu'au statut 'done'.
 */
router.post('/:projectId/illustration', requireAuth, validateBody(illustrationSchema), async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const { kind } = req.body;
    const cost = ILLUSTRATION_CREDITS[kind] || 20;

    // 1. Projet (+ contrôle d'accès)
    const { data: project, error: pErr } = await supabaseService.supabase
      .from('saved_projects').select('*').eq('id', projectId).single();
    if (pErr || !project) return res.status(404).json({ success: false, error: 'Projet introuvable' });
    if (project.user_id && project.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Projet non autorisé' });
    }

    // 2. Créer le document "en génération" (visible dès maintenant)
    const { data: doc, error: insErr } = await supabaseService.supabase
      .from('project_documents')
      .insert([{
        project_id: projectId,
        user_id: userId,
        document_type: kind === 'infographic' ? 'illustration' : kind,
        title: ILLUSTRATION_LABELS[kind] || 'Illustration',
        content: '',
        prompt_used: '',
        context_added: '',
        metadata: { is_image: true, kind, status: 'generating' },
      }])
      .select('id').single();
    if (insErr) {
      console.error('❌ Insert project_documents (illustration) échoué:', JSON.stringify({ message: insErr.message, details: insErr.details, hint: insErr.hint, code: insErr.code }));
      return res.status(500).json({ success: false, error: insErr.message, code: insErr.code, details: insErr.details });
    }
    const documentId = doc.id;

    // 3. Répondre TOUT DE SUITE (évite le 502 du proxy sur les longues générations)
    res.json({ success: true, status: 'generating', documentId, kind });

    // 4. Génération en arrière-plan (ne bloque pas la réponse)
    (async () => {
      try {
        const { data: ctxDocs } = await supabaseService.supabase
          .from('project_documents')
          .select('document_type, title, content, metadata')
          .eq('project_id', projectId);

        const { generateIllustration } = require('../services/projectIllustration');
        const { buffer, promptJson } = await generateIllustration(kind, project, ctxDocs || []);

        const path = `${userId}/illustration-${kind}-${Date.now()}.png`;
        const { error: upErr } = await supabaseService.supabase.storage
          .from('due-diligence')
          .upload(path, buffer, { contentType: 'image/png', upsert: false });
        if (upErr) throw upErr;

        // URL signée longue durée pour l'affichage dans la bibliothèque
        let imageUrl = null;
        try {
          const { data: signed } = await supabaseService.supabase.storage
            .from('due-diligence').createSignedUrl(path, 31536000); // ~1 an
          imageUrl = signed?.signedUrl || null;
        } catch { /* ignore */ }

        await supabaseService.supabase
          .from('project_documents')
          .update({
            content: `Visuel généré (${ILLUSTRATION_LABELS[kind] || kind}).`,
            metadata: { is_image: true, kind, status: 'done', storage_path: path, bucket: 'due-diligence', image_url: imageUrl, prompt: promptJson },
          })
          .eq('id', documentId);

        // Infographie → pièce du dossier (nécessite doc_type 'illustration' autorisé en base)
        if (kind === 'infographic') {
          await supabaseService.supabase
            .from('due_diligence_documents')
            .insert({
              user_id: userId, project_id: projectId, doc_type: 'illustration',
              file_url: path, file_name: 'infographie-business.png',
              file_size: buffer.length, mime_type: 'image/png', verification_status: 'pending',
            })
            .then(() => {}, (e) => console.warn('⚠️ due_diligence illustration (contrainte doc_type ?):', e.message));
        }

        // Décompte crédits : solde utilisateur (user_credits via RPC) + compteur projet
        try {
          const creditManager = require('../services/credit-manager-premium');
          const r = await creditManager.consumeCredits(
            userId,
            `illustration-${kind}`,
            cost,
            `Génération ${ILLUSTRATION_LABELS[kind] || kind}`,
            documentId,
            { kind, project_id: projectId }
          );
          if (!r?.success) console.warn('⚠️ consumeCredits illustration:', r?.error);
        } catch (e) { console.warn('⚠️ consumeCredits illustration:', e.message); }

        const current = project.total_credits_used || 0;
        await supabaseService.supabase
          .from('saved_projects')
          .update({ total_credits_used: current + cost, context_updated_at: new Date().toISOString() })
          .eq('id', projectId);

        try {
          if (redisCache.isAvailable()) {
            await redisCache.delPattern(`projects:*:${userId}*`);
            await redisCache.del(getCacheKey.projectDetail(userId, projectId));
          }
        } catch { /* ignore */ }

        console.log(`🎨 [illustration] ${kind} terminé → ${path}`);
      } catch (e) {
        console.error('❌ [illustration] échec génération (bg):', e.message);
        await supabaseService.supabase
          .from('project_documents')
          .update({ metadata: { is_image: true, kind, status: 'error', error: String(e.message || 'Erreur').slice(0, 300) } })
          .eq('id', documentId)
          .then(() => {}, () => {});
      }
    })();
  } catch (error) {
    console.error('❌ Erreur lancement illustration:', error);
    res.status(500).json({ success: false, error: error?.message || 'Erreur génération illustration' });
  }
});

/**
 * GET /api/saved-projects/:projectId/illustration/:documentId
 * Statut de génération + URL signée quand prête (polling frontend).
 */
router.get('/:projectId/illustration/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { data: doc, error } = await supabaseService.supabase
      .from('project_documents')
      .select('id, user_id, metadata')
      .eq('id', documentId)
      .single();
    if (error || !doc) return res.status(404).json({ success: false, error: 'Document introuvable' });
    if (doc.user_id && doc.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Non autorisé' });

    const status = doc.metadata?.status || 'generating';
    let imageUrl = null;
    if (status === 'done' && doc.metadata?.storage_path) {
      try {
        const { data: signed } = await supabaseService.supabase.storage
          .from('due-diligence').createSignedUrl(doc.metadata.storage_path, 3600);
        imageUrl = signed?.signedUrl || null;
      } catch { /* ignore */ }
    }
    res.json({ success: true, status, imageUrl, error: doc.metadata?.error || null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
