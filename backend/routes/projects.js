/**
 * 📁 ROUTES PROJETS - Gestion des propositions sauvegardées
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/projects
 * Récupère tous les projets sauvegardés d'un utilisateur
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { data: projects, error } = await supabaseService.supabase
      .from('saved_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      projects: projects || []
    });

  } catch (error) {
    console.error('❌ Erreur récupération projets:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/projects/:id/reset
 * Réinitialise un projet (supprime tous les documents et actions IA)
 */
router.post('/:id/reset', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Extrait du JWT

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    // Supprimer tous les documents liés au projet
    const { error: docsError } = await supabaseService.supabase
      .from('project_documents')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userId);

    if (docsError) {
      console.error('❌ Erreur suppression documents:', docsError);
    }

    // Supprimer toutes les actions liées au projet
    const { error: actionsError } = await supabaseService.supabase
      .from('project_actions')
      .delete()
      .eq('project_id', id);

    if (actionsError) {
      console.error('❌ Erreur suppression actions:', actionsError);
    }

    // Supprimer les notes du projet
    const { error: notesError } = await supabaseService.supabase
      .from('project_notes')
      .delete()
      .eq('project_id', id)
      .eq('user_id', userId);

    if (notesError) {
      console.error('❌ Erreur suppression notes:', notesError);
    }

    // Réinitialiser les champs du projet
    const { error: updateError } = await supabaseService.supabase
      .from('projects')
      .update({
        current_phase: 'idea',
        progress_percentage: 0,
        total_credits_used: 0,
        plan_action_steps: [],
        cumulative_context: [],
        action_plan_id: null,
        training_id: null,
        skill_test_id: null,
        status: 'active'
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    console.log('✅ Projet réinitialisé:', id);

    res.json({
      success: true,
      message: 'Projet réinitialisé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur réinitialisation projet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Supprime un projet
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Extrait du JWT

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId requis'
      });
    }

    const { error } = await supabaseService.supabase
      .from('saved_projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Projet supprimé'
    });

  } catch (error) {
    console.error('❌ Erreur suppression projet:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
