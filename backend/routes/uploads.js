/**
 * 📤 ROUTES UPLOADS
 * Endpoints pour l'upload d'images et vidéos
 */

const express = require('express');
const router = express.Router();
const imageUploadService = require('../src/services/imageUpload.service');
const videoUploadService = require('../src/services/videoUpload.service');
const supabaseService = require('../supabase-config');

// POST /api/admin/upload-image - Upload d'image vers Supabase Storage
router.post('/upload-image', imageUploadService.upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier fourni'
      });
    }

    // Valider l'image
    const validation = await imageUploadService.validateImage(req.file);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    // Upload vers Supabase Storage
    const uploadResult = await imageUploadService.uploadToPublicFolder(
      req.file.path,
      req.file.originalname
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: uploadResult.error || 'Erreur lors de l\'upload'
      });
    }

    res.json({
      success: true,
      message: 'Image uploadée avec succès',
      image_url: uploadResult.url,
      file_name: uploadResult.fileName
    });

  } catch (error) {
    console.error('❌ Erreur upload image:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'upload'
    });
  }
});

// DELETE /api/admin/delete-image/:fileName - Supprimer une image
router.delete('/delete-image/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Nom de fichier requis'
      });
    }

    // Supprimer de Supabase Storage
    const { error } = await supabaseService.supabase.storage
      .from('campaign-images')
      .remove([fileName]);

    if (error) {
      console.error('❌ Erreur suppression Supabase:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.json({
      success: true,
      message: 'Image supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression image:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
});

// POST /api/admin/upload-video - Upload de vidéo vers Supabase Storage
router.post('/upload-video', videoUploadService.upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier vidéo fourni'
      });
    }

    // Upload vers Supabase Storage
    const uploadResult = await videoUploadService.uploadToSupabase(
      req.file.path,
      req.file.originalname
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: uploadResult.error || 'Erreur lors de l\'upload vidéo'
      });
    }

    res.json({
      success: true,
      message: 'Vidéo uploadée avec succès',
      video_url: uploadResult.url,
      file_name: uploadResult.fileName
    });

  } catch (error) {
    console.error('❌ Erreur upload vidéo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'upload vidéo'
    });
  }
});

// DELETE /api/admin/delete-video/:fileName - Supprimer une vidéo
router.delete('/delete-video/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    
    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'Nom de fichier requis'
      });
    }

    // Supprimer de Supabase Storage
    const { error } = await supabaseService.supabase.storage
      .from('campaign-videos')
      .remove([fileName]);

    if (error) {
      console.error('❌ Erreur suppression vidéo Supabase:', error);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la suppression'
      });
    }

    res.json({
      success: true,
      message: 'Vidéo supprimée avec succès'
    });

  } catch (error) {
    console.error('❌ Erreur suppression vidéo:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression'
    });
  }
});

module.exports = router;
