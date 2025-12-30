/**
 * Routes pour le tracking des actions sur les projets sauvegardés
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');

/**
 * POST /api/project-actions/track
 * Enregistre une action effectuée sur un projet
 */
router.post('/track', async (req, res) => {
  try {
    const {
      projectId,
      userId,
      actionType, // 'action-plan', 'skill-test', 'custom-training', 'business-plan'
      actionReferenceId, // ID de l'objet créé
      metadata
    } = req.body;

    console.log(`📊 Tracking action: ${actionType} pour projet ${projectId}`);

    // Validation
    if (!projectId || !userId || !actionType) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        required: ['projectId', 'userId', 'actionType']
      });
    }

    // Enregistrer l'action
    const { data: actionData, error: actionError } = await supabaseService.supabase
      .from('project_actions')
      .insert({
        project_id: projectId,
        user_id: userId,
        action_type: actionType,
        action_status: actionReferenceId ? 'completed' : 'pending',
        action_reference_id: actionReferenceId || null,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (actionError) {
      console.error('❌ Erreur insertion action:', actionError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'enregistrement de l\'action'
      });
    }

    // Mettre à jour le projet: incrémenter actions_count et last_action_at
    // Récupérer le count actuel
    const { data: projectData } = await supabaseService.supabase
      .from('saved_projects')
      .select('actions_count')
      .eq('id', projectId)
      .single();

    const currentCount = projectData?.actions_count || 0;

    // Incrémenter manuellement
    const { error: updateError } = await supabaseService.supabase
      .from('saved_projects')
      .update({
        actions_count: currentCount + 1,
        last_action_at: new Date().toISOString()
      })
      .eq('id', projectId);

    if (updateError) {
      console.warn('⚠️ Erreur mise à jour compteur projet:', updateError);
    }

    console.log('✅ Action trackée:', actionData.id);

    res.json({
      success: true,
      action: actionData,
      message: 'Action enregistrée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur tracking action:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors du tracking'
    });
  }
});

/**
 * GET /api/project-actions/:projectId
 * Récupère toutes les actions d'un projet
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabaseService.supabase
      .from('project_actions')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération actions:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des actions'
      });
    }

    res.json({
      success: true,
      actions: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('❌ Erreur récupération actions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/project-actions/user/:userId/summary
 * Résumé des actions par utilisateur
 */
router.get('/user/:userId/summary', async (req, res) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabaseService.supabase
      .from('project_actions')
      .select('action_type, action_status')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erreur récupération summary:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du résumé'
      });
    }

    // Calculer les statistiques
    const summary = {
      total: data?.length || 0,
      byType: {},
      byStatus: {},
      completed: 0,
      pending: 0
    };

    data?.forEach(action => {
      // Par type
      summary.byType[action.action_type] = (summary.byType[action.action_type] || 0) + 1;
      
      // Par status
      summary.byStatus[action.action_status] = (summary.byStatus[action.action_status] || 0) + 1;
      
      if (action.action_status === 'completed') {
        summary.completed++;
      } else {
        summary.pending++;
      }
    });

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('❌ Erreur summary actions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * PATCH /api/project-actions/:actionId/status
 * Met à jour le statut d'une action
 */
router.patch('/:actionId/status', async (req, res) => {
  try {
    const { actionId } = req.params;
    const { status, referenceId } = req.body;

    const updateData = {
      action_status: status,
      updated_at: new Date().toISOString()
    };

    if (referenceId) {
      updateData.action_reference_id = referenceId;
    }

    const { data, error } = await supabaseService.supabase
      .from('project_actions')
      .update(updateData)
      .eq('id', actionId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour action:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour'
      });
    }

    res.json({
      success: true,
      action: data
    });

  } catch (error) {
    console.error('❌ Erreur update action:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/project-actions/complete
 * Marque une action comme completed
 */
router.post('/complete', async (req, res) => {
  try {
    const { projectId, userId, actionType, referenceId } = req.body;

    if (!projectId || !userId || !actionType) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    console.log(`✅ Marquage action comme completed: ${actionType} pour projet ${projectId}`);

    // Chercher l'action existante
    const { data: existingAction } = await supabaseService.supabase
      .from('project_actions')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('action_type', actionType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingAction) {
      // Mettre à jour l'action existante
      const { data, error } = await supabaseService.supabase
        .from('project_actions')
        .update({
          action_status: 'completed',
          action_reference_id: referenceId || existingAction.action_reference_id,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAction.id)
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Action mise à jour:', data.id);

      return res.json({
        success: true,
        action: data,
        message: 'Action marquée comme completed'
      });
    } else {
      // Créer une nouvelle action completed
      const { data, error } = await supabaseService.supabase
        .from('project_actions')
        .insert({
          project_id: projectId,
          user_id: userId,
          action_type: actionType,
          action_status: 'completed',
          action_reference_id: referenceId,
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Nouvelle action completed créée:', data.id);

      return res.json({
        success: true,
        action: data,
        message: 'Action créée et marquée comme completed'
      });
    }

  } catch (error) {
    console.error('❌ Erreur marquage action completed:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
