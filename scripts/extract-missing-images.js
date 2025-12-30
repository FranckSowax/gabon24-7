const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cheerio = require('cheerio');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc4ODkyNiwiZXhwIjoyMDcwMzY0OTI2fQ.VTlJyoM7Wd8Uf6_rYNdCYOhkPNwJhAZKsZSqJlBVE5E';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d\'environnement');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour extraire l'image principale d'un article
async function extractImageFromArticle(url) {
  try {
    console.log(`🔍 Extraction d'image pour: ${url}`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    let imageUrl = null;

    // Stratégies d'extraction par ordre de priorité
    const strategies = [
      // 1. Open Graph image
      () => $('meta[property="og:image"]').attr('content'),
      
      // 2. Twitter Card image
      () => $('meta[name="twitter:image"]').attr('content'),
      
      // 3. Article image (schema.org)
      () => $('meta[itemprop="image"]').attr('content'),
      
      // 4. Première image dans l'article
      () => $('article img').first().attr('src'),
      
      // 5. Première image dans le contenu principal
      () => $('.content img, .post-content img, .entry-content img').first().attr('src'),
      
      // 6. Première image de la page (en évitant logos/icônes)
      () => {
        const imgs = $('img').toArray();
        for (let img of imgs) {
          const src = $(img).attr('src');
          const alt = $(img).attr('alt') || '';
          const className = $(img).attr('class') || '';
          
          // Éviter les logos, icônes, avatars
          if (src && 
              !src.includes('logo') && 
              !src.includes('icon') && 
              !src.includes('avatar') &&
              !alt.toLowerCase().includes('logo') &&
              !className.toLowerCase().includes('logo')) {
            return src;
          }
        }
        return null;
      }
    ];

    // Essayer chaque stratégie jusqu'à trouver une image
    for (let strategy of strategies) {
      imageUrl = strategy();
      if (imageUrl) break;
    }

    if (!imageUrl) {
      console.log(`⚠️  Aucune image trouvée pour: ${url}`);
      return null;
    }

    // Normaliser l'URL de l'image
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      const urlObj = new URL(url);
      imageUrl = urlObj.origin + imageUrl;
    }

    // Valider que l'image est accessible
    try {
      await axios.head(imageUrl, { timeout: 5000 });
      console.log(`✅ Image trouvée: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      console.log(`❌ Image non accessible: ${imageUrl}`);
      return null;
    }

  } catch (error) {
    console.log(`❌ Erreur lors de l'extraction pour ${url}:`, error.message);
    return null;
  }
}

// Fonction pour traiter les articles sans images
async function processArticlesWithoutImages(limit = 50) {
  try {
    console.log(`🚀 Début du traitement des articles sans images (limite: ${limit})`);

    // Récupérer les articles sans images
    const { data: articles, error } = await supabase
      .from('articles')
      .select('id, url, title')
      .or('image_url.is.null,image_url.eq.')
      .limit(limit);

    if (error) {
      console.error('❌ Erreur lors de la récupération des articles:', error);
      return;
    }

    console.log(`📊 ${articles.length} articles à traiter`);

    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (let article of articles) {
      processed++;
      console.log(`\n[${processed}/${articles.length}] Traitement: ${article.title}`);

      const imageUrl = await extractImageFromArticle(article.url);

      if (imageUrl) {
        // Mettre à jour l'article avec l'image trouvée
        const { error: updateError } = await supabase
          .from('articles')
          .update({ image_url: imageUrl })
          .eq('id', article.id);

        if (updateError) {
          console.error(`❌ Erreur mise à jour article ${article.id}:`, updateError);
          failed++;
        } else {
          console.log(`✅ Article ${article.id} mis à jour avec l'image`);
          updated++;
        }
      } else {
        failed++;
      }

      // Pause pour éviter de surcharger les serveurs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n📈 Résultats:`);
    console.log(`   - Articles traités: ${processed}`);
    console.log(`   - Articles mis à jour: ${updated}`);
    console.log(`   - Échecs: ${failed}`);

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour traiter un article spécifique (pour les tests)
async function processSpecificArticle(articleId) {
  try {
    const { data: article, error } = await supabase
      .from('articles')
      .select('id, url, title, image_url')
      .eq('id', articleId)
      .single();

    if (error) {
      console.error('❌ Article non trouvé:', error);
      return;
    }

    console.log(`🔍 Test sur l'article: ${article.title}`);
    console.log(`   URL: ${article.url}`);
    console.log(`   Image actuelle: ${article.image_url || 'Aucune'}`);

    const imageUrl = await extractImageFromArticle(article.url);

    if (imageUrl) {
      console.log(`✅ Image extraite: ${imageUrl}`);
      
      // Demander confirmation avant mise à jour
      console.log('\n⚠️  Voulez-vous mettre à jour cet article ? (Modifiez le script pour confirmer)');
      
      // Décommentez la ligne suivante pour effectuer la mise à jour
      // const { error: updateError } = await supabase.from('articles').update({ image_url: imageUrl }).eq('id', articleId);
    } else {
      console.log('❌ Aucune image trouvée');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Exécution du script
async function main() {
  const args = process.argv.slice(2);
  
  if (args[0] === 'test' && args[1]) {
    // Mode test sur un article spécifique
    await processSpecificArticle(parseInt(args[1]));
  } else if (args[0] === 'run') {
    // Mode production
    const limit = args[1] ? parseInt(args[1]) : 50;
    await processArticlesWithoutImages(limit);
  } else {
    console.log(`
🔧 Script d'extraction d'images pour articles

Usage:
  node extract-missing-images.js test <article_id>  # Tester sur un article
  node extract-missing-images.js run [limit]        # Traiter les articles (défaut: 50)

Exemples:
  node extract-missing-images.js test 12345
  node extract-missing-images.js run 100
    `);
  }
}

main().catch(console.error);
