const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Fonction pour traiter l'image avec proxy si nécessaire (basée sur homepage-articles-new.js)
function processImageUrl(imageUrl, link) {
  if (!imageUrl) return null; // Pas de fallback placeholder selon vos exigences
  
  // Éviter le double proxy - si l'URL contient déjà image-proxy, la retourner telle quelle
  if (imageUrl.includes('/.netlify/functions/image-proxy')) {
    return imageUrl;
  }
  
  // Forcer HTTPS pour éviter les erreurs Mixed Content
  if (imageUrl.startsWith('http://')) {
    imageUrl = imageUrl.replace('http://', 'https://');
  }
  
  try {
    const articleUrl = new URL(link);
    const imageUrlObj = new URL(imageUrl);
    
    // Si l'image vient d'Info Gabon, utiliser le proxy
    if (articleUrl.hostname.includes('infogabon') && imageUrlObj.hostname.includes('infogabon')) {
      return `/.netlify/functions/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    
    // Utiliser le proxy pour TOUTES les images Facebook (fbcdn.net, facebook.com, external-*.xx.fbcdn.net)
    if (imageUrl.includes('fbcdn.net') || 
        imageUrl.includes('facebook.com') || 
        imageUrl.includes('safe_image.php') ||
        imageUrl.includes('gabonmediatime.com') ||
        imageUrl.includes('tvgabon24.com') ||
        imageUrl.includes('gabon24.com') ||
        imageUrl.includes('gabonactu.com') ||
        imageUrl.includes('leconfidentiel.ga') ||
        imageUrl.includes('courrierdesjournalistes.net') ||
        imageUrl.includes('depeches241.com')) {
      return `/.netlify/functions/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    }
    
    return imageUrl;
  } catch (error) {
    console.log('⚠️ URL image invalide:', imageUrl);
    return null; // Pas de fallback selon vos exigences
  }
}

// Fonction pour valider une URL d'image (accepte Facebook safe_image)
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  // Extensions d'images classiques
  const hasExt = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  
  // Domaines sûrs
  const safeDomains = ['fbcdn.net', 'fbsbx.com', 'facebook.com', 'cloudinary.com', 'googleusercontent.com'];
  const hasDomain = safeDomains.some(d => url.includes(d));
  
  // Cas spécial Facebook: safe_image.php sans extension
  const isSafeImage = url.includes('facebook.com') && url.includes('safe_image.php');
  
  return hasExt || hasDomain || isSafeImage;
}

// Fonction pour normaliser et valider les URLs d'images
function normalizeImageUrl(url, source = '') {
  if (!url || typeof url !== 'string') return null;
  
  // Nettoyer l'URL
  let cleanUrl = url.trim();
  
  // Ajouter le protocole si manquant
  if (cleanUrl.startsWith('//')) {
    cleanUrl = 'https:' + cleanUrl;
  } else if (cleanUrl.startsWith('/')) {
    // URL relative - essayer de construire l'URL complète
    if (source.includes('infosgabon.com')) {
      cleanUrl = 'https://www.infosgabon.com' + cleanUrl;
    } else if (source.includes('gabonreview.com')) {
      cleanUrl = 'https://www.gabonreview.com' + cleanUrl;
    } else {
      return null; // Impossible de résoudre l'URL relative
    }
  }
  
  // Vérifier que c'est une URL valide
  try {
    new URL(cleanUrl);
  } catch {
    return null;
  }
  
  // Validation stricte des images Facebook
  const isFacebookImage = cleanUrl.includes('facebook.com') || 
                         cleanUrl.includes('fbcdn.net') || 
                         cleanUrl.includes('fbsbx.com');
  
  if (isFacebookImage) {
    // Accepter uniquement les images safe_image de Facebook
    if (!cleanUrl.includes('safe_image') && 
        !cleanUrl.includes('scontent') && 
        !cleanUrl.includes('fbcdn.net')) {
      console.log(`❌ Image Facebook non-safe rejetée: ${cleanUrl}`);
      return null;
    }
  }
  
  // Proxy pour les domaines sensibles
  const sensitivePatterns = [
    /infosgabon\.com/i,
    /\.gov\.ga$/i
  ];
  
  const needsProxy = sensitivePatterns.some(pattern => pattern.test(cleanUrl));
  if (needsProxy) {
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=400&h=300&fit=cover&a=attention`;
  }
  
  return cleanUrl;
}

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  }

  // Gérer les requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  try {
    // Vérifier l'authentification
    const authHeader = event.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token d\'authentification requis' })
      }
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Vérifier le token avec Supabase Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Token invalide ou expiré' })
      }
    }

    const userId = user.id
    const method = event.httpMethod
    const body = event.body ? JSON.parse(event.body) : {}

    switch (method) {
      case 'GET':
        // Récupérer les favoris de l'utilisateur
        const { data: favorites, error: getFavError } = await supabase
          .from('user_favorites')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (getFavError) {
          console.error('Erreur récupération favoris:', getFavError)
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erreur lors de la récupération des favoris' })
          }
        }

        // Map to consistent client fields
        const favoriteData = favorites.map(fav => ({
          id: fav.id,
          article_id: fav.article_id,
          title: fav.article_title,
          url: fav.article_url,
          source: fav.article_source,
          image_url: fav.article_image_url && isValidImageUrl(fav.article_image_url) ? processImageUrl(fav.article_image_url, fav.article_url) : null,
          created_at: fav.created_at
        }))

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ favorites: favoriteData })
        }

      case 'POST':
        // Ajouter un article aux favoris
        const { articleId, articleTitle, articleUrl, articleSource, articleImageUrl } = body

        if (!articleId || !articleTitle) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'articleId et articleTitle sont requis' })
          }
        }

        // Vérifier si l'article n'est pas déjà en favoris
        const { data: existingFav } = await supabase
          .from('user_favorites')
          .select('id')
          .eq('user_id', userId)
          .eq('article_id', articleId)
          .single()

        if (existingFav) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ error: 'Article déjà en favoris' })
          }
        }

        // Ajouter aux favoris
        const { data: insertData, error: insertError } = await supabase
          .from('user_favorites')
          .insert({
            user_id: userId,
            article_id: articleId,
            article_title: articleTitle,
            article_url: articleUrl,
            article_source: articleSource,
            article_image_url: articleImageUrl
          })
          .select()
          .single()

        if (insertError) {
          console.error('Erreur ajout favori:', insertError)
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erreur lors de l\'ajout aux favoris' })
          }
        }

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ favorite: insertData, message: 'Article ajouté aux favoris' })
        }

      case 'DELETE':
        // Supprimer un article des favoris
        const { articleId: deleteArticleId } = body

        if (!deleteArticleId) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'articleId requis' })
          }
        }

        const { error: deleteError } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('article_id', deleteArticleId)

        if (deleteError) {
          console.error('Erreur suppression favori:', deleteError)
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erreur lors de la suppression du favori' })
          }
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Article supprimé des favoris' })
        }

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Méthode non autorisée' })
        }
    }

  } catch (error) {
    console.error('Erreur fonction favorites:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur interne du serveur' })
    }
  }
}
