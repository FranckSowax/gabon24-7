const express = require('express');
const router = express.Router();
const uploadService = require('../services/upload-service');
const { requireAuth } = require('../middleware/auth');

// POST /api/upload/image - Upload une image
// 🔒 SÉCURISÉ: Authentification requise
router.post('/image', requireAuth, uploadService.upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Upload vers Supabase
    const url = await uploadService.uploadCampaignImage(buffer, originalname, mimetype);

    console.log(`✅ Image uploadée: ${originalname}`);

    res.json({
      success: true,
      url: url,
      filename: originalname,
      size: buffer.length
    });

  } catch (error) {
    console.error('❌ Erreur upload image:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload', 
      details: error.message 
    });
  }
});

// POST /api/upload/video - Upload une vidéo
// 🔒 SÉCURISÉ: Authentification requise
router.post('/video', requireAuth, uploadService.upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Vérifier que c'est bien une vidéo
    if (!mimetype.startsWith('video/')) {
      return res.status(400).json({ error: 'Le fichier doit être une vidéo' });
    }

    // Upload vers Supabase
    const url = await uploadService.uploadCampaignVideo(buffer, originalname, mimetype);

    console.log(`✅ Vidéo uploadée: ${originalname}`);

    res.json({
      success: true,
      url: url,
      filename: originalname,
      size: buffer.length
    });

  } catch (error) {
    console.error('❌ Erreur upload vidéo:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload', 
      details: error.message 
    });
  }
});

// POST /api/upload/resize - Upload et redimensionner une image
// 🔒 SÉCURISÉ: Authentification requise
router.post('/resize', requireAuth, uploadService.upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { width, height } = req.body;
    
    if (!width || !height) {
      return res.status(400).json({ error: 'Dimensions manquantes (width, height)' });
    }

    const { buffer, originalname, mimetype } = req.file;

    // Redimensionner
    const resizedBuffer = await uploadService.resizeImage(
      buffer, 
      parseInt(width), 
      parseInt(height)
    );

    // Upload la version redimensionnée
    const url = await uploadService.uploadCampaignImage(resizedBuffer, originalname, 'image/jpeg');

    console.log(`✅ Image redimensionnée et uploadée: ${width}x${height}`);

    res.json({
      success: true,
      url: url,
      originalSize: buffer.length,
      resizedSize: resizedBuffer.length,
      dimensions: { width: parseInt(width), height: parseInt(height) }
    });

  } catch (error) {
    console.error('❌ Erreur redimensionnement:', error);
    res.status(500).json({ 
      error: 'Erreur lors du redimensionnement', 
      details: error.message 
    });
  }
});

// POST /api/upload/multiple - Upload plusieurs fichiers
// 🔒 SÉCURISÉ: Authentification requise
router.post('/multiple', requireAuth, uploadService.upload.array('files', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      const { buffer, originalname, mimetype } = file;
      
      const url = await uploadService.uploadCampaignImage(buffer, originalname, mimetype);
      
      uploadedFiles.push({
        url: url,
        filename: originalname,
        size: buffer.length
      });
    }

    console.log(`✅ ${uploadedFiles.length} fichiers uploadés`);

    res.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    });

  } catch (error) {
    console.error('❌ Erreur upload multiple:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'upload', 
      details: error.message 
    });
  }
});

// DELETE /api/upload - Supprimer un fichier
// 🔒 SÉCURISÉ: Authentification requise
router.delete('/', requireAuth, async (req, res) => {
  try {
    const { url, bucket } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL manquante' });
    }

    const success = await uploadService.deleteFile(url, bucket || 'campaigns-images');

    if (success) {
      res.json({ success: true, message: 'Fichier supprimé' });
    } else {
      res.status(500).json({ error: 'Erreur lors de la suppression' });
    }

  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression', 
      details: error.message 
    });
  }
});

module.exports = router;
