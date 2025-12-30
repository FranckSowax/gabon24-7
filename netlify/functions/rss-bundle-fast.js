const Parser = require('rss-parser');
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', {keepArray: true}],
      ['enclosure', 'enclosure'],
      ['media:thumbnail', 'media:thumbnail']
    ]
  }
});
const { createClient } = require('@supabase/supabase-js');

// Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Bundle RSS.app URL
const BUNDLE_URL = 'https://rss.app/feeds/_SntJgjZXkqIWrDHq.xml';

// 🎯 ULTRA-SIMPLE : Extraction d'images depuis RSS uniquement
function extractImageFromRSS(item) {
  // 1. Priorité : media:content (le plus fiable)
  if (item['media:content'] && item['media:content'].length > 0) {
    const mediaContent = item['media:content'][0];
    if (mediaContent.$ && mediaContent.$.url) {
      return mediaContent.$.url;
    }
  }
  
  // 2. Fallback : img dans description HTML
  if (item.description) {
    const imgMatch = item.description.match(/<img[^>]+src="([^"]+)"/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }
  
  // 3. Fallback : enclosure
  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }
  
  // 4. Pas d'image = null (PAS de fallback Unsplash)
  return null;
}

// 🛡️ Validation ultra-simple d'URL d'image
function isValidImageUrl(url) {
  if (!url) return false;
  
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  // Exclure seulement les images Facebook problématiques
  if (url.includes('safe_image') || url.includes('fbcdn.net') || url.includes('fbsbx.com')) {
    return false;
  }
  
  return true;
}

// 🔄 Proxy d'image UNIQUEMENT pour CORS
function processImageUrl(imageUrl) {
  if (!imageUrl || !isValidImageUrl(imageUrl)) {
    return null;
  }
  
  // Domaines nécessitant un proxy pour CORS
  const needsProxy = [
    'gabonews.com',
    'infogabon.ga',
    'gabon24.com',
    'union.sonapresse.com',
    'gabonactu.com'
  ];
  
  const needsProxyCheck = needsProxy.some(domain => imageUrl.includes(domain));
  
  if (needsProxyCheck) {
    return `/.netlify/functions/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }
  
  return imageUrl;
}

// 📍 Extraction de source depuis URL (gardé tel quel)
function extractSourceFromLink(link) {
  try {
    const url = new URL(link);
    const domain = url.hostname.replace('www.', '');
    
    const sourceMap = {
      'gabonreview.com': 'Gabon Review',
      'infogabon.ga': 'Info Gabon',
      'lalibreville.com': 'La Libreville',
      'gabon24.com': 'Gabon 24',
      'union.sonapresse.com': 'L\'Union',
      'gabon-eco.com': 'Gabon Eco',
      'actualite-gabon.com': 'Actualité Gabon',
      'directinfosgabon.com': 'Direct Infos Gabon',
      'gabonactu.com': 'Gabon Actu',
      'africaintelligence.fr': 'Africa Intelligence',
      'gabon24.tv': 'Gabon 24 TV',
      'focusgroupemedia.com': 'Focus Groupe Media',
      'gabonmediatime.com': 'Gabon Media Time',
      'facebook.com': 'Facebook',
      'echosdeleco.com': 'Echos de l\'Eco',
      'agpgabon.ga': 'AGP Gabon',
      'leconfidentiel.ga': 'Le Confidentiel',
      'gabonews.com': 'Gabonews',
      'insidenews241.com': 'Inside News 241'
    };
    
    // Détection spéciale pour Facebook ministériel
    if (domain === 'facebook.com' && link.includes('/posts/')) {
      if (link.includes('ministerelogementgabon') || link.includes('logement')) {
        return 'MINISTERE DU LOGEMENT, DE L\'HABITAT, DE L\'URBANISME ET DU CADASTRE';
      }
    }
    
    return sourceMap[domain] || domain;
  } catch (error) {
    return 'Source inconnue';
  }
}

// 📅 Formatage de date relative en français
function formatRelativeDate(dateString) {
  if (!dateString) return '—';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return 'À l\'instant';
    if (diffMinutes < 60) return `${diffMinutes} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    });
  } catch (error) {
    return '—';
  }
}

// 🎯 FONCTION PRINCIPALE ULTRA-SIMPLIFIÉE
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log('🚀 [RSS-BUNDLE-FAST] Début synchronisation RSS bundle ultra-simple...');
    
    // 1. Récupérer le flux RSS
    const feed = await parser.parseURL(BUNDLE_URL);
    console.log(`📡 Bundle récupéré: ${feed.items.length} articles`);
    
    // 2. Traitement ultra-simple des articles
    const processedArticles = [];
    let insertedToSupabase = 0;
    let imageStats = { found: 0, missing: 0, proxied: 0 };
    
    for (const item of feed.items.slice(0, 50)) { // Limiter à 50 articles
      // ✅ EXTRACTION D'IMAGE ULTRA-SIMPLE
      const rawImageUrl = extractImageFromRSS(item);
      const finalImageUrl = processImageUrl(rawImageUrl);
      
      // 📊 Statistiques
      if (rawImageUrl) {
        imageStats.found++;
        if (finalImageUrl && finalImageUrl.includes('image-proxy')) {
          imageStats.proxied++;
        }
      } else {
        imageStats.missing++;
      }
      
      // 📍 Source et métadonnées
      const source = extractSourceFromLink(item.link || '');
      const author = item['dc:creator'] || item.creator || source;
      
      // 🕐 Normaliser la date de publication au format ISO
      const publishedIso = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

      // 🏗️ Construction de l'article (structure identique à l'original)
      const article = {
        id: item.guid || item.link,
        title: item.title || 'Titre non disponible',
        summary: item.contentSnippet || item.description || 'Résumé non disponible',
        content: item.content || item.description || '',
        url: item.link,
        imageUrl: finalImageUrl, // ✅ Image RSS pure ou null
        author: author,
        publishedAt: formatRelativeDate(publishedIso),
        published_at: publishedIso,
        created_at: publishedIso,
        source: source,
        category: 'actualités',
        viewCount: '0 vue',
        view_count: 0,
        sentiment: 'neutre',
        keywords: [],
        readTime: '2 min',
        isMinisterial: source.toLowerCase().includes('ministere'),
        type: 'rss'
      };
      
      processedArticles.push(article);

      // 💾 Insertion Supabase (éviter doublons via URL)
      try {
        if (supabase) {
          const { data: existing, error: existErr } = await supabase
            .from('articles')
            .select('id')
            .eq('url', article.url)
            .single();

          if (existErr && existErr.code !== 'PGRST116') { // PGRST116: No rows found
            console.warn('⚠️ Vérification existence article échouée:', existErr.message || existErr);
          }

          if (!existing) {
            const { error: insertErr } = await supabase
              .from('articles')
              .insert({
                title: article.title?.slice(0, 500) || null,
                summary: article.summary?.slice(0, 1000) || null,
                content: article.content?.slice(0, 10000) || null,
                url: article.url || null,
                image_url: article.imageUrl || null,
                author: article.author || null,
                published_at: article.published_at,
                source: article.source || null,
                category: article.category || 'actualités',
                is_published: true,
                view_count: 0,
                created_at: new Date().toISOString()
              });

            if (insertErr) {
              console.error('❌ Erreur insertion Supabase:', insertErr.message || insertErr);
            } else {
              insertedToSupabase++;
              // Petit délai léger pour éviter surcharge (facultatif)
              await new Promise(r => setTimeout(r, 25));
            }
          }
        }
      } catch (dbErr) {
        console.warn('⚠️ Erreur DB non bloquante:', dbErr.message || dbErr);
      }
    }
    
    // 📊 Logs de performance
    console.log(`✅ [RSS-BUNDLE-FAST] ${processedArticles.length} articles traités`);
    console.log(`📸 Images: ${imageStats.found} trouvées, ${imageStats.missing} manquantes, ${imageStats.proxied} proxifiées`);
    console.log(`⚡ Performance: ${((imageStats.found / processedArticles.length) * 100).toFixed(1)}% d'articles avec images`);
    
    // 3. Réponse finale
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        articles: processedArticles,
        total: processedArticles.length,
        rss_count: processedArticles.length,
        supabase_count: insertedToSupabase,
        image_stats: imageStats,
        performance: {
          image_success_rate: `${((imageStats.found / processedArticles.length) * 100).toFixed(1)}%`,
          processing_method: 'RSS-BUNDLE-FAST ULTRA-SIMPLE',
          mcp_calls: 0,
          unsplash_fallbacks: 0,
          proxy_usage: imageStats.proxied
        },
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ [RSS-BUNDLE-FAST] Erreur:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur lors de la récupération du flux RSS',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
