const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  console.log('🔄 Upload d\'image - Début');

  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gestion des requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Vérification de la méthode
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  try {
    // Vérification de la configuration Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration manquante',
          message: 'Variables d\'environnement Supabase non configurées'
        })
      };
    }

    // Parse du body
    const body = JSON.parse(event.body);
    const { fileName, fileData, fileType, imageType } = body;

    if (!fileName || !fileData || !fileType || !imageType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Données manquantes',
          message: 'fileName, fileData, fileType et imageType sont requis'
        })
      };
    }

    // Validation du type d'image
    if (!['banner', 'mobile'].includes(imageType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Type d\'image invalide',
          message: 'imageType doit être "banner" ou "mobile"'
        })
      };
    }

    // Décoder le fichier base64
    const base64Data = fileData.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = fileName.split('.').pop();
    const uniqueFileName = `slides/${imageType}-${timestamp}-${randomString}.${extension}`;

    console.log(`📤 Upload fichier: ${uniqueFileName} (${buffer.length} bytes)`);

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
      .from('promotional-images')
      .upload(uniqueFileName, buffer, {
        contentType: fileType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('❌ Erreur upload Supabase:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Erreur upload',
          message: error.message
        })
      };
    }

    // Récupérer l'URL publique
    const { data: urlData } = supabase.storage
      .from('promotional-images')
      .getPublicUrl(uniqueFileName);

    const publicUrl = urlData.publicUrl;

    console.log(`✅ Image uploadée avec succès: ${publicUrl}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        fileName: uniqueFileName,
        imageType: imageType
      })
    };

  } catch (error) {
    console.error('❌ Erreur générale:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur serveur',
        message: error.message
      })
    };
  }
};
