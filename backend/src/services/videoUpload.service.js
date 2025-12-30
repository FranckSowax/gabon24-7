const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Utiliser la configuration Supabase existante du projet
const supabaseService = require('../../supabase-config');
const supabase = supabaseService.supabase;

// Configuration multer pour l'upload temporaire
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/temp/videos';
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

// Filtres de fichiers vidéo
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Type de fichier non autorisé. Utilisez MP4 ou WebM.'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB pour vidéos optimisées
  }
});

/**
 * Upload une vidéo vers Supabase Storage
 * @param {string} filePath - Chemin du fichier temporaire
 * @param {string} fileName - Nom du fichier
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadVideoToSupabase(filePath, fileName) {
  try {
    // Générer un nom unique
    const uniqueFileName = `video-${Date.now()}-${uuidv4()}${path.extname(fileName)}`;
    
    // Lire le fichier
    const fileBuffer = fs.readFileSync(filePath);
    
    // Obtenir le type MIME
    const contentType = getVideoContentType(fileName);
    
    // Upload vers Supabase Storage (bucket: video-campaigns)
    const { data, error } = await supabase.storage
      .from('video-campaigns')
      .upload(uniqueFileName, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('❌ Erreur upload vidéo Supabase:', error);
      throw error;
    }
    
    // Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from('video-campaigns')
      .getPublicUrl(uniqueFileName);
    
    const videoUrl = publicUrlData.publicUrl;
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn('⚠️ Erreur suppression fichier temporaire:', cleanupError);
    }

    console.log('✅ Vidéo uploadée vers Supabase:', videoUrl);

    return {
      success: true,
      url: videoUrl,
      fileName: uniqueFileName
    };

  } catch (error) {
    console.error('❌ Erreur upload vidéo vers Supabase Storage:', error);
    
    // Nettoyer le fichier temporaire en cas d'erreur
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn('⚠️ Erreur suppression fichier temporaire:', cleanupError);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Supprime une vidéo de Supabase Storage
 * @param {string} fileName - Nom du fichier à supprimer
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteVideoFromSupabase(fileName) {
  try {
    const { error } = await supabase.storage
      .from('video-campaigns')
      .remove([fileName]);

    if (error) {
      console.error('Erreur suppression vidéo Supabase:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur suppression vidéo:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtient le type MIME basé sur l'extension du fichier vidéo
 * @param {string} fileName - Nom du fichier
 * @returns {string} - Type MIME
 */
function getVideoContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime'
  };
  return mimeTypes[ext] || 'video/mp4';
}

/**
 * Valide une vidéo avant upload
 * @param {Object} file - Objet fichier multer
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validateVideo(file) {
  try {
    // Vérifier la taille (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { valid: false, error: 'Vidéo trop volumineuse (max 10MB pour un chargement rapide)' };
    }

    // Vérifier le type MIME
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Type de fichier non autorisé. Utilisez MP4 ou WebM.' };
    }

    // Vérifier l'extension
    const allowedExtensions = ['.mp4', '.webm', '.mov'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return { valid: false, error: 'Extension de fichier non autorisée' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Erreur validation fichier vidéo' };
  }
}

module.exports = {
  upload,
  uploadVideoToSupabase,
  deleteVideoFromSupabase,
  validateVideo
};
