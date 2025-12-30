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
    const uploadDir = 'uploads/temp';
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

// Filtres de fichiers
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Type de fichier non autorisé. Utilisez JPG, PNG, GIF ou WebP.'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

/**
 * Upload une image vers Supabase Storage
 * @param {string} filePath - Chemin du fichier temporaire
 * @param {string} fileName - Nom du fichier
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadToPublicFolder(filePath, fileName) {
  try {
    // Générer un nom unique
    const uniqueFileName = `campaign-${Date.now()}-${uuidv4()}${path.extname(fileName)}`;
    
    // Lire le fichier
    const fileBuffer = fs.readFileSync(filePath);
    
    // Obtenir le type MIME
    const contentType = getContentType(fileName);
    
    // Upload vers Supabase Storage (bucket: campaign-images)
    const { data, error } = await supabase.storage
      .from('campaign-images')
      .upload(uniqueFileName, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      console.error('❌ Erreur upload Supabase:', error);
      throw error;
    }
    
    // Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from('campaign-images')
      .getPublicUrl(uniqueFileName);
    
    const imageUrl = publicUrlData.publicUrl;
    
    // Supprimer le fichier temporaire
    try {
      fs.unlinkSync(filePath);
    } catch (cleanupError) {
      console.warn('⚠️ Erreur suppression fichier temporaire:', cleanupError);
    }

    console.log('✅ Image uploadée vers Supabase:', imageUrl);

    return {
      success: true,
      url: imageUrl,
      fileName: uniqueFileName
    };

  } catch (error) {
    console.error('❌ Erreur upload vers Supabase Storage:', error);
    
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
 * Supprime une image de Supabase Storage
 * @param {string} fileName - Nom du fichier à supprimer
 * @param {string} bucket - Nom du bucket
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteFromSupabase(fileName, bucket = 'campaign-images') {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      console.error('Erreur suppression Supabase:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Erreur suppression:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtient le type MIME basé sur l'extension du fichier
 * @param {string} fileName - Nom du fichier
 * @returns {string} - Type MIME
 */
function getContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

/**
 * Valide une image avant upload
 * @param {Object} file - Objet fichier multer
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validateImage(file) {
  try {
    // Vérifier la taille
    if (file.size > 5 * 1024 * 1024) {
      return { valid: false, error: 'Fichier trop volumineux (max 5MB)' };
    }

    // Vérifier le type MIME
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Type de fichier non autorisé' };
    }

    // Vérifier l'extension
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return { valid: false, error: 'Extension de fichier non autorisée' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Erreur validation fichier' };
  }
}

module.exports = {
  upload,
  uploadToPublicFolder,
  validateImage
};
