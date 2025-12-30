/**
 * Routes pour les notes/commentaires sur les projets
 */

const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/project-notes/:projectId
 * Récupère toutes les notes d'un projet
 * 🔒 SÉCURISÉ: Authentification requise
 */
router.get('/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabaseService.supabase
      .from('project_notes')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération notes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des notes'
      });
    }

    res.json({
      success: true,
      notes: data || [],
      count: data?.length || 0
    });

  } catch (error) {
    console.error('❌ Erreur récupération notes:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/project-notes - Créer une note
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id; // Extrait du JWT
    const { projectId, noteContent } = req.body;

    // Validation
    if (!projectId || !noteContent || !noteContent.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Données manquantes',
        required: ['projectId', 'noteContent']
      });
    }

    console.log(`📝 Ajout note au projet ${projectId}`);

    // Insérer la note
    const { data: noteData, error: noteError } = await supabaseService.supabase
      .from('project_notes')
      .insert({
        project_id: projectId,
        user_id: userId,
        note_content: noteContent.trim()
      })
      .select()
      .single();

    if (noteError) {
      console.error('❌ Erreur insertion note:', noteError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'ajout de la note'
      });
    }

    console.log('✅ Note ajoutée:', noteData.id);

    res.json({
      success: true,
      note: noteData,
      message: 'Note ajoutée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur ajout note:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'ajout'
    });
  }
});

/**
 * PUT /api/project-notes/:noteId - Modifier une note
 */
router.put('/:noteId', requireAuth, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id; // Extrait du JWT
    const { noteContent } = req.body;

    if (!noteContent || !noteContent.trim()) {
      return res.status(400).json({
        success: false,
        error: 'noteContent requis'
      });
    }

    // Vérifier que la note appartient à l'utilisateur
    const { data: existingNote, error: checkError } = await supabaseService.supabase
      .from('project_notes')
      .select('user_id')
      .eq('id', noteId)
      .single();

    if (checkError || !existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note non trouvée'
      });
    }

    if (existingNote.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas la permission de modifier cette note'
      });
    }

    // Mettre à jour la note
    const { data, error } = await supabaseService.supabase
      .from('project_notes')
      .update({ note_content: noteContent.trim() })
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur mise à jour note:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour'
      });
    }

    res.json({
      success: true,
      note: data
    });

  } catch (error) {
    console.error('❌ Erreur update note:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * DELETE /api/project-notes/:noteId - Supprimer une note
 */
router.delete('/:noteId', requireAuth, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id; // Extrait du JWT

    // Vérifier que la note appartient à l'utilisateur
    const { data: existingNote, error: checkError } = await supabaseService.supabase
      .from('project_notes')
      .select('user_id')
      .eq('id', noteId)
      .single();

    if (checkError || !existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note non trouvée'
      });
    }

    if (existingNote.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'avez pas la permission de supprimer cette note'
      });
    }

    // Supprimer la note
    const { error } = await supabaseService.supabase
      .from('project_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.error('❌ Erreur suppression note:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression'
      });
    }

    res.json({
      success: true,
      message: 'Note supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur delete note:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
