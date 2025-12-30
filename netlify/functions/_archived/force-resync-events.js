const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

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
    // Initialiser Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Variables d\'environnement Supabase manquantes');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log('🔄 FORCE RESYNC: Suppression de tous les événements existants...');
    
    // 1. Supprimer TOUS les événements existants
    const { error: deleteError } = await supabase
      .from('articles')
      .delete()
      .eq('category', 'événements');
      
    if (deleteError) {
      console.error('❌ Erreur suppression:', deleteError);
      throw deleteError;
    }
    
    console.log('✅ Tous les événements supprimés');
    
    // 2. Parser le flux RSS Eventime
    const parser = new Parser({
      customFields: {
        item: ['media:content', 'enclosure']
      }
    });
    
    const eventimeUrl = 'https://rss.app/feeds/S4lUk8j474PjWeYr.xml';
    const feed = await parser.parseURL(eventimeUrl);
    
    console.log(`📡 Flux RSS parsé: ${feed.items.length} événements trouvés`);
    
    let newArticles = 0;
    const results = [];
    
    // 3. Recréer tous les événements avec leurs images
    for (const item of feed.items) {
      try {
        const title = item.title || 'Sans titre';
        const description = item.contentSnippet || item.content || item.description || '';
        const url = item.link || '';
        const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();
        
        // Extraire l'image depuis media:content
        let imageUrl = null;
        
        if (item['media:content']) {
          if (Array.isArray(item['media:content'])) {
            imageUrl = item['media:content'][0]?.$ ? item['media:content'][0].$.url : null;
          } else if (item['media:content'].$ && item['media:content'].$.url) {
            imageUrl = item['media:content'].$.url;
          }
        }
        
        // Fallback sur enclosure
        if (!imageUrl && item.enclosure && item.enclosure.url) {
          imageUrl = item.enclosure.url;
        }
        
        // Fallback sur les images dans la description HTML
        if (!imageUrl && description) {
          const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
          if (imgMatch) {
            imageUrl = imgMatch[1];
          }
        }
        
        console.log(`🖼️ Image trouvée pour "${title}": ${imageUrl || 'AUCUNE'}`);
        
        // Nettoyer la description
        const cleanDescription = description
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 500);
        
        // Insérer le nouvel événement
        const { data: insertData, error: insertError } = await supabase
          .from('articles')
          .insert({
            title: title,
            summary: cleanDescription,
            url: url,
            image_urls: imageUrl ? [imageUrl] : [],
            published_at: publishedAt,
            category: 'événements',
            is_published: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.error('❌ Erreur insertion:', insertError);
          results.push({
            title: title,
            status: 'insert_error',
            error: insertError.message
          });
        } else {
          console.log(`✅ Événement créé avec image: ${title}`);
          newArticles++;
          results.push({
            title: title,
            status: 'created_with_image',
            image: imageUrl || 'none'
          });
        }
        
      } catch (itemError) {
        console.error('❌ Erreur traitement événement:', itemError);
        results.push({
          title: item.title || 'Titre inconnu',
          status: 'error',
          error: itemError.message
        });
      }
    }
    
    console.log(`🎉 FORCE RESYNC terminé: ${newArticles} événements recréés`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Force resync terminé: ${newArticles} événements recréés avec images`,
        stats: {
          totalProcessed: feed.items.length,
          newArticles: newArticles,
          source: 'Eventime.ga'
        },
        results: results
      })
    };
    
  } catch (error) {
    console.error('❌ Erreur force resync:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    };
  }
};
