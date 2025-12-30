const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const supabaseService = require('../../supabase-config');
const router = express.Router();

const { supabase } = supabaseService;

// Configuration multer pour upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});

/**
 * GET /api/project-timeline/:projectId
 * Récupère la timeline complète d'un projet
 */
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { data, error } = await supabase
      .from('project_full_timeline')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erreur récupération timeline:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de la timeline'
      });
    }

    res.json({
      success: true,
      timeline: data || []
    });

  } catch (error) {
    console.error('❌ Erreur timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/project-timeline/:projectId/upload
 * Upload un fichier pour un projet
 */
router.post('/:projectId/upload', upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.body;
    const file = req.file;

    if (!file || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Fichier ou userId manquant'
      });
    }

    console.log(`📤 Upload fichier pour projet ${projectId}:`, file.originalname);

    // Créer un nom de fichier unique
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedName}`;
    const storagePath = `projects/${projectId}/${fileName}`;

    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erreur upload storage:', uploadError);
      
      // Si le bucket n'existe pas, le créer
      if (uploadError.message.includes('not found')) {
        console.log('📦 Création du bucket project-files...');
        const { error: bucketError } = await supabase.storage.createBucket('project-files', {
          public: false
        });
        
        if (bucketError) {
          console.error('❌ Erreur création bucket:', bucketError);
          return res.status(500).json({
            success: false,
            error: 'Erreur lors de la création du bucket de stockage'
          });
        }
        
        // Réessayer l'upload
        const { error: retryError } = await supabase.storage
          .from('project-files')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });
        
        if (retryError) {
          return res.status(500).json({
            success: false,
            error: 'Erreur lors du second upload'
          });
        }
      } else {
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de l\'upload'
        });
      }
    }

    // Déterminer le type de fichier
    let fileType = 'document';
    if (file.mimetype.startsWith('image/')) {
      fileType = 'image';
    } else if (file.mimetype === 'application/pdf') {
      fileType = 'pdf';
    }

    // Enregistrer dans la BDD
    const { data: fileData, error: dbError } = await supabase
      .from('project_files')
      .insert([{
        project_id: projectId,
        user_id: userId,
        file_name: file.originalname,
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        mime_type: file.mimetype
      }])
      .select()
      .single();

    if (dbError) {
      console.error('❌ Erreur enregistrement BDD:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'enregistrement'
      });
    }

    // Ajouter au contexte cumulatif du projet
    const { data: projectData } = await supabase
      .from('saved_projects')
      .select('cumulative_context')
      .eq('id', projectId)
      .single();

    const currentContext = projectData?.cumulative_context || [];
    const newContextEntry = {
      date: new Date().toISOString(),
      type: 'file_upload',
      content: `Fichier uploadé: ${file.originalname} (${fileType})`,
      author: userId,
      file_id: fileData.id
    };

    await supabase
      .from('saved_projects')
      .update({
        cumulative_context: [...currentContext, newContextEntry],
        context_updated_at: new Date().toISOString()
      })
      .eq('id', projectId);

    console.log('✅ Fichier uploadé et enregistré');

    res.json({
      success: true,
      file: fileData,
      message: 'Fichier uploadé avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur upload:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur'
    });
  }
});

/**
 * DELETE /api/project-timeline/:entryId
 * Supprime une entrée de la timeline
 */
router.delete('/:entryId', async (req, res) => {
  try {
    const { entryId } = req.params;

    // Récupérer l'entrée pour savoir si c'est un fichier
    const { data: entry } = await supabase
      .from('project_timeline')
      .select('entry_type, reference_id')
      .eq('id', entryId)
      .single();

    // Si c'est un fichier, supprimer du storage
    if (entry?.entry_type === 'file_upload' && entry.reference_id) {
      const { data: fileData } = await supabase
        .from('project_files')
        .select('storage_path')
        .eq('id', entry.reference_id)
        .single();

      if (fileData?.storage_path) {
        await supabase.storage
          .from('project-files')
          .remove([fileData.storage_path]);
      }

      // Supprimer de project_files (ce qui va trigger la suppression de la timeline)
      await supabase
        .from('project_files')
        .delete()
        .eq('id', entry.reference_id);
    } else if (entry?.entry_type === 'note' && entry.reference_id) {
      // Supprimer la note
      await supabase
        .from('project_notes')
        .delete()
        .eq('id', entry.reference_id);
    }

    // Supprimer l'entrée timeline
    const { error } = await supabase
      .from('project_timeline')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('❌ Erreur suppression:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression'
      });
    }

    res.json({
      success: true,
      message: 'Entrée supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
