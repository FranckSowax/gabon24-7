const { supabase } = require('../config/supabase');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuration multer pour upload en mémoire
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Types de fichiers acceptés
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
  
  const allAllowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
  
  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Type de fichier non autorisé. Images: JPG, PNG, WebP. Vidéos: MP4, MOV'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: fileFilter
});

/**
 * Upload un fichier vers Supabase Storage
 * @param {Buffer} fileBuffer - Buffer du fichier
 * @param {string} fileName - Nom original du fichier
 * @param {string} mimeType - Type MIME du fichier
 * @param {string} bucket - Bucket Supabase ('campaigns-images', 'campaigns-videos')
 * @returns {Promise<string>} URL publique du fichier
 */
async function uploadToSupabase(fileBuffer, fileName, mimeType, bucket = 'campaigns-images') {
  try {
    // Générer un nom de fichier unique
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const filePath = `${new Date().getFullYear()}/${new Date().getMonth() + 1}/${uniqueFileName}`;

    console.log(`📤 Upload vers Supabase: ${filePath} (${bucket})`);

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: mimeType,
        upsert: false
      });

    if (error) {
      console.error('❌ Erreur upload Supabase:', error);
      throw error;
    }

    // Récupérer l'URL publique
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log(`✅ Fichier uploadé: ${publicUrl}`);

    return publicUrl;

  } catch (error) {
    console.error('❌ Erreur uploadToSupabase:', error);
    throw error;
  }
}

/**
 * Upload une image de campagne
 * @param {Buffer} fileBuffer - Buffer de l'image
 * @param {string} fileName - Nom du fichier
 * @param {string} mimeType - Type MIME
 * @returns {Promise<string>} URL de l'image
 */
async function uploadCampaignImage(fileBuffer, fileName, mimeType) {
  return await uploadToSupabase(fileBuffer, fileName, mimeType, 'campaigns-images');
}

/**
 * Upload une vidéo de campagne
 * @param {Buffer} fileBuffer - Buffer de la vidéo
 * @param {string} fileName - Nom du fichier
 * @param {string} mimeType - Type MIME
 * @returns {Promise<string>} URL de la vidéo
 */
async function uploadCampaignVideo(fileBuffer, fileName, mimeType) {
  // Vérifier la taille (max 50MB)
  if (fileBuffer.length > 50 * 1024 * 1024) {
    throw new Error('La vidéo ne doit pas dépasser 50 MB');
  }

  return await uploadToSupabase(fileBuffer, fileName, mimeType, 'campaigns-videos');
}

/**
 * Supprimer un fichier de Supabase Storage
 * @param {string} fileUrl - URL complète du fichier
 * @param {string} bucket - Bucket Supabase
 * @returns {Promise<boolean>}
 */
async function deleteFile(fileUrl, bucket = 'campaigns-images') {
  try {
    // Extraire le chemin du fichier depuis l'URL
    const urlParts = fileUrl.split(`/${bucket}/`);
    if (urlParts.length < 2) {
      throw new Error('URL de fichier invalide');
    }
    
    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;

    console.log(`🗑️ Fichier supprimé: ${filePath}`);
    return true;

  } catch (error) {
    console.error('❌ Erreur suppression fichier:', error);
    return false;
  }
}

/**
 * Créer les buckets nécessaires (à exécuter une seule fois)
 */
async function createBuckets() {
  try {
    // Créer bucket pour images
    const { data: imageBucket, error: imageError } = await supabase.storage
      .createBucket('campaigns-images', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      });

    if (imageError && !imageError.message.includes('already exists')) {
      console.error('Erreur création bucket images:', imageError);
    } else {
      console.log('✅ Bucket campaigns-images créé ou existe déjà');
    }

    // Créer bucket pour vidéos
    const { data: videoBucket, error: videoError } = await supabase.storage
      .createBucket('campaigns-videos', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['video/mp4', 'video/quicktime']
      });

    if (videoError && !videoError.message.includes('already exists')) {
      console.error('Erreur création bucket vidéos:', videoError);
    } else {
      console.log('✅ Bucket campaigns-videos créé ou existe déjà');
    }

  } catch (error) {
    console.error('❌ Erreur création buckets:', error);
  }
}

/**
 * Valider une image (dimensions, format, taille)
 * @param {Buffer} imageBuffer - Buffer de l'image
 * @param {Object} requirements - Exigences { width, height, maxSize }
 * @returns {Promise<boolean>}
 */
async function validateImage(imageBuffer, requirements = {}) {
  try {
    const sharp = require('sharp');
    const metadata = await sharp(imageBuffer).metadata();

    // Vérifier les dimensions si spécifiées
    if (requirements.width && metadata.width !== requirements.width) {
      throw new Error(`Largeur invalide. Attendu: ${requirements.width}px, Reçu: ${metadata.width}px`);
    }

    if (requirements.height && metadata.height !== requirements.height) {
      throw new Error(`Hauteur invalide. Attendu: ${requirements.height}px, Reçu: ${metadata.height}px`);
    }

    // Vérifier la taille
    if (requirements.maxSize && imageBuffer.length > requirements.maxSize) {
      throw new Error(`Fichier trop volumineux. Max: ${requirements.maxSize / (1024 * 1024)}MB`);
    }

    return true;

  } catch (error) {
    console.error('❌ Validation image échouée:', error.message);
    throw error;
  }
}

/**
 * Redimensionner une image
 * @param {Buffer} imageBuffer - Buffer de l'image
 * @param {number} width - Largeur cible
 * @param {number} height - Hauteur cible
 * @returns {Promise<Buffer>}
 */
async function resizeImage(imageBuffer, width, height) {
  try {
    const sharp = require('sharp');
    
    const resizedBuffer = await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log(`🖼️ Image redimensionnée: ${width}x${height}`);
    return resizedBuffer;

  } catch (error) {
    console.error('❌ Erreur redimensionnement:', error);
    throw error;
  }
}

module.exports = {
  upload,
  uploadCampaignImage,
  uploadCampaignVideo,
  uploadToSupabase,
  deleteFile,
  createBuckets,
  validateImage,
  resizeImage
};
