const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const supabaseService = require('../../supabase-config');
const { requireAuth } = require('../../middleware/auth');
const {
  sendCollaboratorInvitation,
  sendCommentNotification,
  sendDocumentNotification,
  sendInvitationAcceptedNotification
} = require('../../services/emailService');

const { supabase } = supabaseService;

// Configuration Multer pour upload fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/temp/collaboration');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté'));
    }
  }
});

// Inviter un collaborateur
// 🔒 SÉCURISÉ: Authentification requise
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { projectId, ownerId, collaboratorEmail, role = 'viewer', permissions } = req.body;

    if (!projectId || !ownerId || !collaboratorEmail) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    // Vérifier que l'utilisateur authentifié est bien le owner
    if (req.user.id !== ownerId) {
      return res.status(403).json({ success: false, error: 'Non autorisé' });
    }

    // Vérifier si le collaborateur existe déjà
    const { data: existing } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', projectId)
      .eq('collaborator_email', collaboratorEmail)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, error: 'Collaborateur déjà invité' });
    }

    // Chercher l'utilisateur par email
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('email', collaboratorEmail)
      .single();

    // Créer l'invitation
    const { data: collaborator, error } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: projectId,
        owner_id: ownerId,
        collaborator_email: collaboratorEmail,
        collaborator_id: userData?.id || null,
        role,
        status: 'pending',
        permissions: permissions || {
          can_view: true,
          can_comment: true,
          can_edit: false,
          can_add_documents: true
        }
      })
      .select()
      .single();

    if (error) throw error;

    // Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: projectId,
        user_id: ownerId,
        event_type: 'collaborator_invited',
        event_description: `Collaborateur invité: ${collaboratorEmail}`,
        created_at: new Date().toISOString()
      });

    // Récupérer infos projet pour email
    const { data: project } = await supabase
      .from('saved_projects')
      .select('title, description')
      .eq('id', projectId)
      .single();

    // Récupérer nom propriétaire
    const { data: owner } = await supabase
      .from('users')
      .select('user_metadata')
      .eq('id', ownerId)
      .single();

    const ownerName = owner?.user_metadata?.full_name || 'Un utilisateur';
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const acceptUrl = `${baseUrl}/collaboration/invitation/${collaborator.id}`;
    const rejectUrl = `${baseUrl}/collaboration/invitation/${collaborator.id}`;

    // Envoyer email d'invitation (async, ne bloque pas)
    sendCollaboratorInvitation({
      collaboratorEmail,
      ownerName,
      projectTitle: project?.title || 'Projet',
      projectDescription: project?.description,
      invitationId: collaborator.id,
      acceptUrl,
      rejectUrl
    }).catch(err => console.error('Erreur envoi email:', err));

    console.log('✅ Collaborateur invité:', collaboratorEmail);

    res.json({ 
      success: true, 
      collaborator,
      message: 'Invitation envoyée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur invite collaborator:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Lister les collaborateurs d'un projet
// 🔒 SÉCURISÉ: Authentification requise
router.get('/list/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: collaborators, error } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, collaborators });

  } catch (error) {
    console.error('❌ Erreur list collaborators:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Accepter une invitation
// 🔒 SÉCURISÉ: Authentification requise
router.post('/accept', requireAuth, async (req, res) => {
  try {
    const { collaboratorId, userId } = req.body;

    const { data, error } = await supabase
      .from('project_collaborators')
      .update({
        status: 'accepted',
        collaborator_id: userId,
        accepted_at: new Date().toISOString()
      })
      .eq('id', collaboratorId)
      .select()
      .single();

    if (error) throw error;

    // Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: data.project_id,
        user_id: userId,
        event_type: 'collaborator_joined',
        event_description: `${data.collaborator_email} a rejoint le projet`,
        created_at: new Date().toISOString()
      });

    // Récupérer infos pour email au propriétaire
    const { data: project } = await supabase
      .from('saved_projects')
      .select('title, user_id')
      .eq('id', data.project_id)
      .single();

    const { data: owner } = await supabase
      .from('users')
      .select('email, user_metadata')
      .eq('id', project?.user_id)
      .single();

    const { data: collaborator } = await supabase
      .from('users')
      .select('user_metadata')
      .eq('id', userId)
      .single();

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const projectUrl = `${baseUrl}/business/mes-projets`;

    // Envoyer email au propriétaire (async)
    if (owner?.email) {
      sendInvitationAcceptedNotification({
        ownerEmail: owner.email,
        ownerName: owner.user_metadata?.full_name,
        collaboratorName: collaborator?.user_metadata?.full_name,
        collaboratorEmail: data.collaborator_email,
        projectTitle: project?.title || 'Projet',
        projectUrl
      }).catch(err => console.error('Erreur envoi email:', err));
    }

    res.json({ success: true, collaborator: data });

  } catch (error) {
    console.error('❌ Erreur accept invitation:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Supprimer un collaborateur
// 🔒 SÉCURISÉ: Authentification requise
router.delete('/remove/:collaboratorId', requireAuth, async (req, res) => {
  try {
    const { collaboratorId } = req.params;

    const { error } = await supabase
      .from('project_collaborators')
      .delete()
      .eq('id', collaboratorId);

    if (error) throw error;

    res.json({ success: true, message: 'Collaborateur retiré' });

  } catch (error) {
    console.error('❌ Erreur remove collaborator:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Ajouter un commentaire
// 🔒 SÉCURISÉ: Authentification requise
router.post('/comment', requireAuth, async (req, res) => {
  try {
    const { projectId, userId, userEmail, userName, content, commentType = 'general', targetId, metadata } = req.body;

    if (!projectId || !userId || !content) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    const now = new Date().toISOString();

    // Créer le commentaire
    const { data: comment, error } = await supabase
      .from('project_collaboration_comments')
      .insert({
        project_id: projectId,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        comment_type: commentType,
        target_id: targetId,
        content,
        metadata: metadata || {},
        created_at: now
      })
      .select()
      .single();

    if (error) throw error;

    // Ajouter au contexte cumulatif
    const { data: project } = await supabase
      .from('saved_projects')
      .select('cumulative_context')
      .eq('id', projectId)
      .single();

    const currentContext = project?.cumulative_context || [];
    const contextEntry = {
      date: now,
      type: 'collaboration_comment',
      content: `Commentaire de ${userName || userEmail}: ${content}`,
      author: userName || userEmail,
      comment_id: comment.id
    };

    await supabase
      .from('saved_projects')
      .update({
        cumulative_context: [...currentContext, contextEntry],
        context_updated_at: now
      })
      .eq('id', projectId);

    // Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: projectId,
        user_id: userId,
        event_type: 'collaboration_comment',
        event_description: `${userName || userEmail} a ajouté un commentaire`,
        created_at: now
      });

    console.log('✅ Commentaire ajouté:', comment.id);

    res.json({ 
      success: true, 
      comment,
      message: 'Commentaire ajouté au contexte'
    });

  } catch (error) {
    console.error('❌ Erreur add comment:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Lister les commentaires d'un projet
// 🔒 SÉCURISÉ: Authentification requise
router.get('/comments/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: comments, error } = await supabase
      .from('project_collaboration_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, comments });

  } catch (error) {
    console.error('❌ Erreur list comments:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Upload fichier document
// 🔒 SÉCURISÉ: Authentification requise
router.post('/upload-document', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }

    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID manquant' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;
    const originalName = req.file.originalname;

    // Lire le fichier
    const fileBuffer = fs.readFileSync(filePath);

    // Upload vers Supabase Storage
    const storagePath = `collaboration-documents/${projectId}/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('project-files')
      .upload(storagePath, fileBuffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erreur upload Supabase:', uploadError);
      // Nettoyer fichier temporaire
      fs.unlinkSync(filePath);
      return res.status(500).json({ success: false, error: 'Erreur upload fichier' });
    }

    // Obtenir URL publique
    const { data: { publicUrl } } = supabase
      .storage
      .from('project-files')
      .getPublicUrl(storagePath);

    // Nettoyer fichier temporaire
    fs.unlinkSync(filePath);

    console.log('✅ Fichier uploadé:', publicUrl);

    res.json({
      success: true,
      file_url: publicUrl,
      file_name: originalName,
      file_size: req.file.size,
      file_type: req.file.mimetype
    });

  } catch (error) {
    console.error('❌ Erreur upload document:', error);
    // Nettoyer fichier temporaire en cas d'erreur
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Ajouter un document
// 🔒 SÉCURISÉ: Authentification requise
router.post('/document', requireAuth, async (req, res) => {
  try {
    const { projectId, collaboratorId, collaboratorEmail, documentTitle, documentContent, documentUrl, metadata } = req.body;

    if (!projectId || !collaboratorId || !documentTitle) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    const now = new Date().toISOString();

    // Créer le document de collaboration
    const { data: collabDoc, error: collabError } = await supabase
      .from('project_collaboration_documents')
      .insert({
        project_id: projectId,
        collaborator_id: collaboratorId,
        collaborator_email: collaboratorEmail,
        document_title: documentTitle,
        document_content: documentContent,
        document_url: documentUrl,
        metadata: metadata || {},
        created_at: now
      })
      .select()
      .single();

    if (collabError) throw collabError;

    // Ajouter aussi dans project_documents (bibliothèque)
    const { data: document, error: docError } = await supabase
      .from('project_documents')
      .insert({
        project_id: projectId,
        user_id: collaboratorId,
        document_type: 'collaboration-document',
        title: `[Collaborateur] ${documentTitle}`,
        content: documentContent || '',
        metadata: {
          ...metadata,
          collaboration_doc_id: collabDoc.id,
          added_by: collaboratorEmail
        },
        created_at: now
      })
      .select()
      .single();

    if (docError) console.error('⚠️ Erreur ajout document bibliothèque:', docError);

    // Ajouter au contexte cumulatif
    const { data: project } = await supabase
      .from('saved_projects')
      .select('cumulative_context')
      .eq('id', projectId)
      .single();

    const currentContext = project?.cumulative_context || [];
    const contextEntry = {
      date: now,
      type: 'collaboration_document',
      content: `Document ajouté par ${collaboratorEmail}: ${documentTitle}`,
      author: collaboratorEmail,
      document_id: document?.id,
      collaboration_doc_id: collabDoc.id
    };

    await supabase
      .from('saved_projects')
      .update({
        cumulative_context: [...currentContext, contextEntry],
        context_updated_at: now
      })
      .eq('id', projectId);

    // Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: projectId,
        user_id: collaboratorId,
        event_type: 'collaboration_document',
        event_description: `${collaboratorEmail} a ajouté un document: ${documentTitle}`,
        created_at: now
      });

    console.log('✅ Document collaboration ajouté:', collabDoc.id);

    res.json({ 
      success: true, 
      document: collabDoc,
      libraryDocument: document,
      message: 'Document ajouté au contexte et à la bibliothèque'
    });

  } catch (error) {
    console.error('❌ Erreur add document:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Lister les documents de collaboration
// 🔒 SÉCURISÉ: Authentification requise
router.get('/documents/:projectId', requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data: documents, error } = await supabase
      .from('project_collaboration_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, documents });

  } catch (error) {
    console.error('❌ Erreur list documents:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer détails invitation
router.get('/invitation/:invitationId', async (req, res) => {
  try {
    const { invitationId } = req.params;

    const { data: invitation, error } = await supabase
      .from('project_collaborators')
      .select(`
        *,
        saved_projects!inner(title, description)
      `)
      .eq('id', invitationId)
      .single();

    if (error || !invitation) {
      return res.status(404).json({ success: false, error: 'Invitation introuvable' });
    }

    // Récupérer nom propriétaire
    const { data: owner } = await supabase
      .from('users')
      .select('user_metadata, email')
      .eq('id', invitation.owner_id)
      .single();

    res.json({
      success: true,
      invitation: {
        ...invitation,
        project_title: invitation.saved_projects?.title,
        project_description: invitation.saved_projects?.description,
        owner_name: owner?.user_metadata?.full_name,
        owner_email: owner?.email
      }
    });

  } catch (error) {
    console.error('❌ Erreur get invitation:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Refuser invitation
// 🔒 SÉCURISÉ: Authentification requise
router.post('/reject', requireAuth, async (req, res) => {
  try {
    const { collaboratorId } = req.body;

    const { data, error } = await supabase
      .from('project_collaborators')
      .update({
        status: 'rejected'
      })
      .eq('id', collaboratorId)
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Invitation refusée:', collaboratorId);

    res.json({ success: true, message: 'Invitation refusée' });

  } catch (error) {
    console.error('❌ Erreur reject invitation:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Générer un lien de partage unique pour un projet
// 🔒 SÉCURISÉ: Authentification requise
router.post('/generate-share-link', requireAuth, async (req, res) => {
  try {
    const { projectId, ownerId, expiresInDays = 90 } = req.body;

    if (!projectId || !ownerId) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    // Générer un token unique
    const shareToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Vérifier si un lien existe déjà pour ce projet
    const { data: existingLink } = await supabase
      .from('project_share_links')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .single();

    let shareLink;

    if (existingLink) {
      // Mettre à jour le lien existant
      const { data, error } = await supabase
        .from('project_share_links')
        .update({
          share_token: shareToken,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLink.id)
        .select()
        .single();

      if (error) throw error;
      shareLink = data;
    } else {
      // Créer un nouveau lien
      const { data, error } = await supabase
        .from('project_share_links')
        .insert({
          project_id: projectId,
          owner_id: ownerId,
          share_token: shareToken,
          expires_at: expiresAt.toISOString(),
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      shareLink = data;
    }

    // Récupérer infos projet pour le message
    const { data: project } = await supabase
      .from('saved_projects')
      .select('title, proposition_titre')
      .eq('id', projectId)
      .single();

    const baseUrl = process.env.FRONTEND_URL || 'https://gabon24-7.netlify.app';
    const fullShareUrl = `${baseUrl}/collaboration/join/${shareToken}`;

    console.log('✅ Lien de partage généré:', fullShareUrl);

    res.json({
      success: true,
      shareLink: {
        ...shareLink,
        full_url: fullShareUrl,
        project_title: project?.proposition_titre || project?.title || 'Projet'
      }
    });

  } catch (error) {
    console.error('❌ Erreur generate share link:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Rejoindre un projet via lien de partage
// 🔒 SÉCURISÉ: Authentification requise (l'utilisateur doit avoir un compte)
router.post('/join-via-link', requireAuth, async (req, res) => {
  try {
    const { shareToken, userId, userEmail } = req.body;

    if (!shareToken || !userId || !userEmail) {
      return res.status(400).json({ success: false, error: 'Paramètres manquants' });
    }

    // Vérifier le lien de partage
    const { data: shareLink, error: linkError } = await supabase
      .from('project_share_links')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .single();

    if (linkError || !shareLink) {
      return res.status(404).json({ success: false, error: 'Lien de partage invalide ou expiré' });
    }

    // Vérifier expiration
    if (new Date(shareLink.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Ce lien de partage a expiré' });
    }

    // Vérifier si l'utilisateur est le propriétaire
    if (shareLink.owner_id === userId) {
      return res.status(400).json({ success: false, error: 'Vous êtes déjà le propriétaire de ce projet' });
    }

    // Vérifier si déjà collaborateur
    const { data: existingCollab } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('project_id', shareLink.project_id)
      .eq('collaborator_email', userEmail)
      .single();

    if (existingCollab) {
      if (existingCollab.status === 'accepted') {
        return res.status(400).json({ success: false, error: 'Vous êtes déjà collaborateur sur ce projet' });
      }
      // Mettre à jour le statut si pending
      const { data: updated, error: updateError } = await supabase
        .from('project_collaborators')
        .update({
          status: 'accepted',
          collaborator_id: userId,
          accepted_at: new Date().toISOString()
        })
        .eq('id', existingCollab.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.json({
        success: true,
        collaborator: updated,
        message: 'Vous avez rejoint le projet avec succès'
      });
    }

    // Créer le collaborateur directement accepté
    const { data: collaborator, error: collabError } = await supabase
      .from('project_collaborators')
      .insert({
        project_id: shareLink.project_id,
        owner_id: shareLink.owner_id,
        collaborator_email: userEmail,
        collaborator_id: userId,
        role: 'viewer',
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        permissions: {
          can_view: true,
          can_comment: true,
          can_edit: false,
          can_add_documents: true
        }
      })
      .select()
      .single();

    if (collabError) throw collabError;

    // Incrémenter le compteur d'utilisation du lien
    await supabase
      .from('project_share_links')
      .update({
        use_count: (shareLink.use_count || 0) + 1
      })
      .eq('id', shareLink.id);

    // Créer événement timeline
    await supabase
      .from('project_timeline')
      .insert({
        project_id: shareLink.project_id,
        user_id: userId,
        event_type: 'collaborator_joined',
        event_description: `${userEmail} a rejoint le projet via lien de partage`,
        created_at: new Date().toISOString()
      });

    console.log('✅ Collaborateur ajouté via lien:', userEmail);

    res.json({
      success: true,
      collaborator,
      projectId: shareLink.project_id,
      message: 'Vous avez rejoint le projet avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur join via link:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer infos d'un lien de partage (pour preview avant de rejoindre)
router.get('/share-link/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;

    const { data: shareLink, error } = await supabase
      .from('project_share_links')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .single();

    if (error || !shareLink) {
      return res.status(404).json({ success: false, error: 'Lien de partage invalide' });
    }

    // Vérifier expiration
    if (new Date(shareLink.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Ce lien de partage a expiré' });
    }

    // Récupérer infos projet
    const { data: project } = await supabase
      .from('saved_projects')
      .select('id, proposition_titre, proposition_description, secteur_selectionne, budget_selectionne')
      .eq('id', shareLink.project_id)
      .single();

    // Récupérer nom propriétaire
    const { data: owner } = await supabase
      .from('users')
      .select('user_metadata, email')
      .eq('id', shareLink.owner_id)
      .single();

    res.json({
      success: true,
      shareLink: {
        ...shareLink,
        project: project,
        owner_name: owner?.user_metadata?.full_name || 'Utilisateur',
        owner_email: owner?.email
      }
    });

  } catch (error) {
    console.error('❌ Erreur get share link:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// Récupérer les projets partagés avec un utilisateur
// 🔒 SÉCURISÉ: Authentification requise
router.get('/shared-with-me/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Récupérer les collaborations acceptées
    const { data: collaborations, error } = await supabase
      .from('project_collaborators')
      .select('*')
      .eq('collaborator_id', userId)
      .eq('status', 'accepted');

    // Gérer le cas où la table n'existe pas encore
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('⚠️ Table project_collaborators non trouvée, retour tableau vide');
        return res.json({ success: true, projects: [] });
      }
      throw error;
    }

    if (!collaborations || collaborations.length === 0) {
      return res.json({ success: true, projects: [] });
    }

    // Récupérer les projets correspondants
    const projectIds = collaborations.map(c => c.project_id);
    const { data: projects, error: projectsError } = await supabase
      .from('saved_projects')
      .select('*')
      .in('id', projectIds);

    if (projectsError) throw projectsError;

    // Enrichir avec infos collaboration
    const enrichedProjects = (projects || []).map(project => {
      const collab = collaborations.find(c => c.project_id === project.id);
      return {
        ...project,
        collaboration: {
          role: collab?.role,
          permissions: collab?.permissions,
          joined_at: collab?.accepted_at
        },
        is_shared: true
      };
    });

    res.json({ success: true, projects: enrichedProjects });

  } catch (error) {
    console.error('❌ Erreur get shared projects:', error);
    // En cas d'erreur, retourner un tableau vide plutôt qu'un 500
    // pour éviter de bloquer le chargement de la page
    res.json({ success: true, projects: [], error: error.message });
  }
});

module.exports = router;
