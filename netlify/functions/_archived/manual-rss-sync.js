const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

// Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const RSS_FEED_URL = 'https://rss.app/feeds/_SntJgjZXkqIWrDHq.xml';
const parser = new Parser();

// 🚀 Synchronisation manuelle RSS vers Supabase
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    console.log('🔄 [MANUAL-RSS-SYNC] Début synchronisation RSS vers Supabase');
    
    // 1. Récupérer le flux RSS
    const feed = await parser.parseURL(RSS_FEED_URL);
    console.log(`📡 RSS récupéré: ${feed.items.length} articles`);
    
    let stats = {
      processed: 0,
      inserted: 0,
      duplicates: 0,
      errors: 0
    };
    
    // 2. Traiter chaque article RSS
    for (const item of feed.items) {
      try {
        stats.processed++;
        
        // Vérifier si l'article existe déjà par URL (clé la plus stable)
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('url', item.link)
          .single();
        
        if (existingArticle) {
          stats.duplicates++;
          console.log(`⚠️ Article déjà existant: ${item.title?.substring(0, 50)}...`);
          continue;
        }
        
        // Extraire l'image depuis le contenu/description (fallback simple)
        let imageUrl = null;
        const htmlSource = item.content || item.description || '';
        if (htmlSource) {
          const imgMatch = htmlSource.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch && imgMatch[1]) imageUrl = imgMatch[1];
        }
        
        // Préparer l'article pour insertion avec données minimales
        const articleData = {
          title: (item.title || 'Sans titre').slice(0, 500),
          summary: (item.summary || item.content || 'Résumé non disponible').slice(0, 1000),
          content: (item.content || item.summary || '').slice(0, 10000),
          url: item.link || '',
          author: item.creator || item['dc:creator'] || 'Rédaction',
          published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          created_at: new Date().toISOString(),
          source: item.link ? new URL(item.link).hostname.replace('www.', '') : 'RSS',
          category: 'actualités',
          is_published: true,
          view_count: 0
        };
        
        // Ajouter image seulement si elle existe
        if (imageUrl) {
          articleData.image_url = imageUrl;
        }
        
        // Insérer l'article
        const { error: insertError } = await supabase
          .from('articles')
          .insert(articleData);
        
        if (insertError) {
          console.error(`❌ Erreur insertion article (url=${articleData.url}):`, insertError);
          console.error(`📄 Données article:`, JSON.stringify(articleData, null, 2));
          stats.errors++;
        } else {
          stats.inserted++;
          console.log(`✅ Article inséré: ${item.title?.substring(0, 50)}...`);
        }
        
      } catch (articleError) {
        console.error(`❌ Erreur traitement article:`, articleError);
        stats.errors++;
      }
    }
    
    // 3. Logs finaux
    console.log(`✅ [MANUAL-RSS-SYNC] Synchronisation terminée:`);
    console.log(`📊 Articles traités: ${stats.processed}`);
    console.log(`💾 Articles insérés: ${stats.inserted}`);
    console.log(`🔄 Doublons ignorés: ${stats.duplicates}`);
    console.log(`❌ Erreurs: ${stats.errors}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Synchronisation RSS vers Supabase terminée',
        stats: stats,
        rss_articles: feed.items.length
      })
    };
    
  } catch (error) {
    console.error('❌ [MANUAL-RSS-SYNC] Erreur générale:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        function: 'manual-rss-sync'
      })
    };
  }
};
