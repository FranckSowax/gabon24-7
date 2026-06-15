const express = require('express');
const router = express.Router();
const supabaseService = require('../supabase-config');
const { requireAuth } = require('../middleware/auth');
const supabase = supabaseService.supabase;
const { validateBody } = require('../middleware/validation');
const { z } = require('zod');

// ==================== SCHÉMAS DE VALIDATION (.passthrough) ====================
const inviteSchema = z.object({
  projectId: z.string().uuid('projectId invalide'),
  email: z.string().email('email invalide').max(255),
  role: z.string().max(50).optional(),
  invitedBy: z.string().uuid().optional().nullable(),
}).passthrough();

const commentSchema = z.object({
  projectId: z.string().uuid('projectId invalide'),
  userId: z.string().uuid('userId invalide'),
  commentText: z.string().min(1, 'commentText requis').max(10000),
  parentCommentId: z.string().uuid().optional().nullable(),
}).passthrough();

const collabDocSchema = z.object({
  projectId: z.string().uuid('projectId invalide'),
  userId: z.string().uuid('userId invalide'),
  documentType: z.string().min(1).max(100),
  fileName: z.string().max(255).optional().nullable(),
  fileUrl: z.string().max(2000).optional().nullable(),
  fileSize: z.coerce.number().int().nonnegative().optional().nullable(),
}).passthrough();

// Collaboration sur projets : auth obligatoire pour toutes routes
router.use(requireAuth);

// POST /api/collaboration/invite - Inviter un collaborateur
router.post('/invite', validateBody(inviteSchema), async (req, res) => {
  try {
    const { projectId, email, role = 'viewer', invitedBy } = req.body;

    if (!projectId || !email || !invitedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId, email et invitedBy requis' 
      });
    }

    // Vérifier que l'utilisateur est le propriétaire du projet
    const { data: project } = await supabase
      .from('saved_projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (!project || project.user_id !== invitedBy) {
      return res.status(403).json({ 
        success: false, 
        error: 'Seul le propriétaire peut inviter des collaborateurs' 
      });
    }

    // Vérifier si l'utilisateur existe
    const { data: invitedUser } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    // Créer l'invitation
    const { data: invitation, error } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: projectId,
        user_id: invitedUser?.id || null,
        invited_email: email,
        role: role,
        invited_by: invitedBy,
        status: invitedUser ? 'accepted' : 'pending' // Auto-accept si user existe
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Duplicate
        return res.status(400).json({ 
          success: false, 
          error: 'Cet utilisateur est déjà collaborateur' 
        });
      }
      throw error;
    }

    // 🔔 NOTIFICATION EN TEMPS RÉEL
    if (invitedUser) {
      try {
        // Récupérer le nom du projet
        const { data: projectData } = await supabase
          .from('saved_projects')
          .select('project_name')
          .eq('id', projectId)
          .single();

        // Récupérer le nom de celui qui invite
        const { data: inviterData } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', invitedBy)
          .single();

        const notificationHelper = require('../utils/notificationHelper');
        await notificationHelper.notifyProjectShared(
          invitedUser.id,
          projectId,
          projectData?.project_name || 'Un projet',
          inviterData?.full_name || inviterData?.email || 'Un utilisateur'
        );
        console.log('✅ Notification partage projet envoyée');
      } catch (notifError) {
        console.warn('⚠️ Erreur notification:', notifError.message);
      }
    }

    // TODO: Envoyer email de notification si user n'existe pas encore

    res.json({ 
      success: true, 
      invitation,
      message: invitedUser 
        ? 'Collaborateur ajouté avec succès' 
        : 'Invitation envoyée par email'
    });

  } catch (error) {
    console.error('Erreur invitation collaborateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/collaboration/collaborators/:projectId - Liste des collaborateurs
router.get('/collaborators/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: collaborators, error } = await supabase
      .from('project_collaborators')
      .select(`
        *,
        user:user_id(id, email, full_name, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, collaborators });

  } catch (error) {
    console.error('Erreur récupération collaborateurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/collaboration/remove/:collaboratorId - Retirer un collaborateur
router.delete('/remove/:collaboratorId', async (req, res) => {
  try {
    const { collaboratorId } = req.params;
    const { userId } = req.body;

    // Vérifier que l'utilisateur est le propriétaire
    const { data: collaborator } = await supabase
      .from('project_collaborators')
      .select('project_id')
      .eq('id', collaboratorId)
      .single();

    const { data: project } = await supabase
      .from('saved_projects')
      .select('user_id')
      .eq('id', collaborator.project_id)
      .single();

    if (project.user_id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Seul le propriétaire peut retirer des collaborateurs' 
      });
    }

    const { error } = await supabase
      .from('project_collaborators')
      .delete()
      .eq('id', collaboratorId);

    if (error) throw error;

    res.json({ success: true, message: 'Collaborateur retiré' });

  } catch (error) {
    console.error('Erreur suppression collaborateur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/collaboration/comments - Ajouter un commentaire
router.post('/comments', validateBody(commentSchema), async (req, res) => {
  try {
    const { projectId, userId, commentText, parentCommentId } = req.body;

    if (!projectId || !userId || !commentText) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId, userId et commentText requis' 
      });
    }

    const { data: comment, error } = await supabase
      .from('project_comments')
      .insert({
        project_id: projectId,
        user_id: userId,
        comment_text: commentText,
        parent_comment_id: parentCommentId || null
      })
      .select(`
        *,
        user:user_id(id, email, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    // 🔔 NOTIFICATION EN TEMPS RÉEL pour le propriétaire et collaborateurs
    try {
      // Récupérer le projet et son propriétaire
      const { data: projectData } = await supabase
        .from('saved_projects')
        .select('user_id, project_name')
        .eq('id', projectId)
        .single();

      // Récupérer tous les collaborateurs
      const { data: collaborators } = await supabase
        .from('project_collaborators')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('status', 'accepted');

      // Récupérer le nom de l'auteur du commentaire
      const { data: authorData } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      const authorName = authorData?.full_name || authorData?.email || 'Un utilisateur';
      const projectName = projectData?.project_name || 'Un projet';
      const commentPreview = commentText.length > 100 
        ? commentText.substring(0, 100) + '...' 
        : commentText;

      const notificationHelper = require('../utils/notificationHelper');

      // Notifier le propriétaire (si ce n'est pas lui qui commente)
      if (projectData?.user_id && projectData.user_id !== userId) {
        await notificationHelper.notifyCommentAdded(
          projectData.user_id,
          projectId,
          projectName,
          authorName,
          commentPreview
        );
      }

      // Notifier tous les collaborateurs (sauf l'auteur)
      if (collaborators && collaborators.length > 0) {
        for (const collab of collaborators) {
          if (collab.user_id && collab.user_id !== userId) {
            await notificationHelper.notifyCommentAdded(
              collab.user_id,
              projectId,
              projectName,
              authorName,
              commentPreview
            );
          }
        }
      }

      console.log('✅ Notifications commentaire envoyées');
    } catch (notifError) {
      console.warn('⚠️ Erreur notification:', notifError.message);
    }

    res.json({ success: true, comment });

  } catch (error) {
    console.error('Erreur ajout commentaire:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/collaboration/comments/:projectId - Liste des commentaires
router.get('/comments/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: comments, error } = await supabase
      .from('project_comments')
      .select(`
        *,
        user:user_id(id, email, full_name, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ success: true, comments });

  } catch (error) {
    console.error('Erreur récupération commentaires:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/collaboration/documents - Ajouter un document/vision
router.post('/documents', validateBody(collabDocSchema), async (req, res) => {
  try {
    const { 
      projectId, 
      userId, 
      documentType, 
      fileName, 
      fileUrl, 
      fileSize,
      visionText,
      description 
    } = req.body;

    if (!projectId || !userId || !documentType) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId, userId et documentType requis' 
      });
    }

    const { data: document, error } = await supabase
      .from('project_shared_documents')
      .insert({
        project_id: projectId,
        user_id: userId,
        document_type: documentType,
        file_name: fileName,
        file_url: fileUrl,
        file_size: fileSize,
        vision_text: visionText,
        description: description
      })
      .select(`
        *,
        user:user_id(id, email, full_name, avatar_url)
      `)
      .single();

    if (error) throw error;

    // Mettre à jour le contexte cumulé du projet
    if (visionText) {
      const { data: project } = await supabase
        .from('saved_projects')
        .select('cumulative_context')
        .eq('id', projectId)
        .single();

      const currentContext = project?.cumulative_context || {};
      const visions = currentContext.visions || [];
      
      await supabase
        .from('saved_projects')
        .update({
          cumulative_context: {
            ...currentContext,
            visions: [...visions, {
              text: visionText,
              author: userId,
              date: new Date().toISOString()
            }]
          },
          context_updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
    }

    res.json({ success: true, document });

  } catch (error) {
    console.error('Erreur ajout document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/collaboration/documents/:projectId - Liste des documents
router.get('/documents/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: documents, error } = await supabase
      .from('project_shared_documents')
      .select(`
        *,
        user:user_id(id, email, full_name, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, documents });

  } catch (error) {
    console.error('Erreur récupération documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
