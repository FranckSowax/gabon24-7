const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Variables d\'environnement Supabase manquantes');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Gabon24-7-RSS-Bot/1.0'
  }
});

exports.handler = async (event, context) => {
  // Configuration CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Gestion des requêtes OPTIONS (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const eventimeUrl = 'https://rss.app/feeds/S4lUk8j474PjWeYr.xml';
    
    console.log('🎉 Début synchronisation manuelle Eventime...');
    
    // Parser le flux RSS
    let feed;
    try {
      feed = await parser.parseURL(eventimeUrl);
      console.log(`✅ Flux RSS parsé: ${feed.items.length} articles trouvés`);
    } catch (parseError) {
      console.error('❌ Erreur parsing RSS:', parseError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Erreur lors du parsing du flux RSS'
        })
      };
    }

    let newArticles = 0;
    const results = [];

    // Traiter chaque article
    for (const item of feed.items) {
      try {
        // Extraire les données de l'article
        const title = item.title || 'Sans titre';
        const description = item.contentSnippet || item.content || item.description || '';
        const url = item.link || '';
        const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
        
        // Extraire l'image depuis media:content ou description
        let imageUrl = null;
        
        // 1. Priorité aux balises media:content du RSS
        if (item['media:content']) {
          if (Array.isArray(item['media:content'])) {
            // Si c'est un tableau, prendre le premier élément
            imageUrl = item['media:content'][0]?.$ ? item['media:content'][0].$.url : null;
          } else if (item['media:content'].$ && item['media:content'].$.url) {
            // Si c'est un objet direct
            imageUrl = item['media:content'].$.url;
          }
        }
        
        // 2. Fallback sur enclosure
        if (!imageUrl && item.enclosure && item.enclosure.url) {
          imageUrl = item.enclosure.url;
        }
        
        // 3. Fallback sur les images dans la description HTML
        if (!imageUrl && description) {
          const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }
        }
        
        console.log(`📸 Image extraite pour "${title}": ${imageUrl || 'aucune image'}`);

        // Nettoyer la description
        const cleanDescription = description
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 500);

        // Extraire le lieu depuis la description
        let location = 'Gabon';
        const locationMatch = cleanDescription.match(/(?:à|au|chez|dans)\s+([A-Za-zÀ-ÿ\s]+?)(?:\s|,|\.|\n|$)/i);
        if (locationMatch) {
          location = locationMatch[1].trim();
        }

        // Vérifier si l'article existe déjà
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('url', url)
          .single();

        if (!existingArticle) {
          // Insérer le nouvel article
          const { error: insertError } = await supabase
            .from('articles')
            .insert([{
              title: title,
              summary: cleanDescription,
              content: cleanDescription,
              url: url,
              category: 'événements',
              published_at: publishedAt,
              image_urls: imageUrl ? [imageUrl] : [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (insertError) {
            console.error('❌ Erreur insertion article:', insertError);
            results.push({
              title: title,
              status: 'error',
              error: insertError.message
            });
          } else {
            console.log(`✅ Nouvel événement ajouté: ${title}`);
            newArticles++;
            results.push({
              title: title,
              status: 'inserted'
            });
          }
        } else {
          // FORCER la mise à jour de l'image pour tous les événements existants
          if (imageUrl) {
            const { error: updateError } = await supabase
              .from('articles')
              .update({ 
                image_urls: [imageUrl],
                updated_at: new Date().toISOString()
              })
              .eq('id', existingArticle.id);

            if (updateError) {
              console.error('❌ Erreur mise à jour image:', updateError);
              results.push({
                title: title,
                status: 'update_error',
                error: updateError.message
              });
            } else {
              console.log(`🖼️ Image FORCÉE pour l'événement: ${title}`);
              results.push({
                title: title,
                status: 'image_forced_update'
              });
            }
          } else {
            console.log(`⏭️ Événement existant sans image: ${title}`);
            results.push({
              title: title,
              status: 'exists_no_image'
            });
          }
        }

      } catch (itemError) {
        console.error('❌ Erreur traitement article:', itemError);
        results.push({
          title: item.title || 'Titre inconnu',
          status: 'error',
          error: itemError.message
        });
      }
    }

    console.log(`✅ Synchronisation terminée: ${newArticles} nouveaux événements`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Synchronisation Eventime terminée: ${newArticles} nouveaux événements`,
        stats: {
          totalProcessed: feed.items.length,
          newArticles: newArticles,
          source: 'Eventime.ga'
        },
        results: results
      })
    };

  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur serveur interne',
        details: error.message
      })
    };
  }
};
