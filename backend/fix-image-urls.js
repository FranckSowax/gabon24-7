/**
 * 🔧 SCRIPT DE MIGRATION DES URLs D'IMAGES
 * Remplace les anciennes URLs Netlify par les nouvelles URLs Express
 */
const supabaseService = require('./supabase-config');
const axios = require('axios');

async function fixImageUrls() {
  console.log("🔧 Début de la migration des URLs d'images...");
  
  try {
    // 1. Récupérer tous les articles avec image_url
    const { data: articles, error } = await supabaseService.supabase
      .from('articles')
      .select('id, image_url, title, url')
      .neq('image_url', null);

    if (error) {
      console.error('❌ Erreur récupération articles:', error);
      return;
    }

    console.log(`📊 ${articles.length} articles avec image_url à vérifier`);
    
    let fixed = 0;
    let already_good = 0;
    let needs_extraction = 0;

    // 2. Traiter chaque article
    for (const article of articles) {
      const imageUrl = article.image_url;
      let newUrl = null;
      
      // Cas 1: URL contient localhost:3002 (proxy ancien)
      if (imageUrl.includes('localhost:3002')) {
        // Extraire l'URL réelle de l'image
        const urlMatch = imageUrl.match(/url=([^&]+)/);
        if (urlMatch) {
          newUrl = decodeURIComponent(urlMatch[1]);
        }
      }
      // Cas 2: URL pointe vers l'ancien proxy Netlify
      else if (imageUrl.includes('/.netlify/functions/image-proxy')) {
        // Extraire l'URL réelle de l'image
        const urlMatch = imageUrl.match(/url=([^&]+)/);
        if (urlMatch) {
          newUrl = decodeURIComponent(urlMatch[1]);
        }
      }
      
      // Si on a trouvé une nouvelle URL, mettre à jour
      if (newUrl) {
        const { error: updateError } = await supabaseService.supabase
          .from('articles')
          .update({ image_url: newUrl })
          .eq('id', article.id);

        if (!updateError) {
          fixed++;
          if (fixed <= 5) {
            console.log(`✅ Corrigé: ${article.title.substring(0, 40)}...`);
            console.log(`   Ancienne: ${imageUrl.substring(0, 80)}...`);
            console.log(`   Nouvelle: ${newUrl.substring(0, 80)}...`);
          }
        }
      }
      // URL déjà correcte (commence par http et pas de proxy)
      else if ((imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) 
               && !imageUrl.includes('localhost:3002')
               && !imageUrl.includes('/.netlify/functions/')) {
        already_good++;
      }
      // URL invalide ou relative
      else {
        needs_extraction++;
        if (needs_extraction <= 3) {
          console.log(`⚠️ Image invalide: ${article.title.substring(0, 40)}...`);
          console.log(`   URL: ${imageUrl}`);
        }
      }
    }

    console.log('\n📊 RÉSULTATS (URLs legacy):');
    console.log(`  ✅ URLs corrigées: ${fixed}`);
    console.log(`  👍 URLs déjà bonnes: ${already_good}`);
    console.log(`  ⚠️ URLs à ré-extraire: ${needs_extraction}`);
    console.log(`  📈 Taux d'images valides: ${((fixed + already_good) * 100 / (articles?.length || 1)).toFixed(1)}%`);

    // 3. Correction spécifique des articles Facebook (image manquante/placeholder)
    console.log('\n🔧 Correction des images Facebook manquantes/placeholder...');
    const fbStats = await fixFacebookArticlesImages();
    console.log('📊 RÉSULTATS (Facebook):', fbStats);
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
  }
  
  process.exit(0);
}

// Lancer la migration
fixImageUrls();

/**
 * 🟦 Résoudre et corriger les images des articles Facebook
 * - Cible: articles dont l'URL contient facebook.com et image_url absente/placeholder/ancien proxy
 * - Méthode: utilise l'endpoint backend /api/image-proxy/facebook-og pour obtenir l'og:image
 */
async function fixFacebookArticlesImages() {
  const API_BASE = process.env.API_URL || 'http://localhost:3001';
  let checked = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const { data: fbArticles, error: fbErr } = await supabaseService.supabase
      .from('articles')
      .select('id, title, url, image_url')
      .ilike('url', '%facebook.com%')
      .limit(1000);

    if (fbErr) {
      console.error('❌ Erreur récupération articles Facebook:', fbErr);
      return { checked, updated, skipped, failed, error: fbErr.message };
    }

    console.log(`📘 ${fbArticles.length} articles Facebook à analyser`);

    for (const a of fbArticles) {
      checked++;
      const current = a.image_url || '';
      const isPlaceholder = typeof current === 'string' && (
        current.includes('facebook.com/images/default') ||
        current.includes('/safe_image.php') ||
        current.includes('/.netlify/functions/') ||
        current.includes('localhost:3002')
      );

      // Si déjà une URL HTTP(S) non-proxy et pas placeholder, passer
      if (current && (current.startsWith('http://') || current.startsWith('https://')) && !isPlaceholder) {
        skipped++;
        continue;
      }

      try {
        const resp = await axios.get(`${API_BASE}/api/image-proxy/facebook-og`, {
          params: { url: a.url },
          timeout: 20000,
        });
        const imageUrl = resp?.data?.imageUrl;
        if (imageUrl && typeof imageUrl === 'string') {
          const { error: upErr } = await supabaseService.supabase
            .from('articles')
            .update({ image_url: imageUrl })
            .eq('id', a.id);
          if (upErr) {
            failed++;
            if (failed <= 3) console.error('⚠️ Échec mise à jour FB:', a.id, upErr.message);
          } else {
            updated++;
            if (updated <= 5) {
              console.log(`✅ FB corrigé: ${a.title?.substring(0, 50) || a.id}...`);
              console.log(`   → ${imageUrl.substring(0, 100)}...`);
            }
          }
        } else {
          skipped++;
        }
      } catch (e) {
        failed++;
        if (failed <= 3) console.error('⚠️ Erreur résolution FB:', a.url, e.message);
      }
    }

    return { checked, updated, skipped, failed };
  } catch (e) {
    console.error('❌ Erreur fixFacebookArticlesImages:', e.message);
    return { checked, updated, skipped, failed, error: e.message };
  }
}
