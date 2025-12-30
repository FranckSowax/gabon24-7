const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const qs = event.queryStringParameters || {};
    if (qs.health === '1') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, ts: new Date().toISOString(), fn: 'youtube-feed' })
      };
    }

    console.log('📺 Récupération du flux YouTube RSS...')

    // URLs des flux RSS
    const YOUTUBE_CHANNEL_RSS = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC8tPg9fQP4S7DtPgFqRqXQw';
    const RSS_FALLBACK_URL = 'https://rss.app/feeds/8Zm0ezBRaaD2NiOF.xml';
    
    let rssUrl = RSS_FALLBACK_URL; // Utiliser le flux RSS existant
    
    try {
      // Utiliser un proxy CORS pour récupérer le flux RSS
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
      const response = await axios.get(proxyUrl, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Gabon24-7 YouTube Fetcher'
        }
      });
      
      if (!response.data || !response.data.contents) {
        throw new Error('Pas de contenu RSS');
      }
      
      // Parser le XML avec une approche simple
      const xmlContent = response.data.contents;
      const videos = [];
      
      // Mots-clés pour identifier les journaux TV
      const journalKeywords = [
        'journal', 'jt', 'actualité', 'actualités', 'info', 'infos', 
        'télé', 'tv', 'édition', 'flash', 'bulletin', 'nouvelles'
      ];
      
      // Extraction simple avec regex
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>/;
      const linkRegex = /<link>(.*?)<\/link>/;
      const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;
      const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>/;
      
      let match;
      while ((match = itemRegex.exec(xmlContent)) !== null) {
        const itemContent = match[1];
        
        const titleMatch = itemContent.match(titleRegex);
        const linkMatch = itemContent.match(linkRegex);
        const pubDateMatch = itemContent.match(pubDateRegex);
        const descMatch = itemContent.match(descRegex);
        
        const title = titleMatch ? titleMatch[1] : '';
        const link = linkMatch ? linkMatch[1] : '';
        const pubDate = pubDateMatch ? pubDateMatch[1] : '';
        const description = descMatch ? descMatch[1] : '';
        
        // Vérifier si c'est un journal TV
        const isJournal = journalKeywords.some(keyword => 
          title.toLowerCase().includes(keyword) || 
          description.toLowerCase().includes(keyword)
        );
        
        // Extraire l'ID YouTube de l'URL
        const videoId = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || '';
        
        if (videoId && isJournal) {
          videos.push({
            id: videoId,
            title: title.trim(),
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            url: link,
            publishedAt: pubDate,
            description: description.trim(),
            duration: 'N/A'
          });
        }
      }
      
      // Trier par date de publication (plus récent en premier)
      videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      
      // Prendre seulement le dernier journal
      const latestJournals = videos.slice(0, 1);
      
      console.log(`📺 Trouvé ${latestJournals.length} journaux TV récents`);
      
      if (latestJournals.length > 0) {
        const latestVideo = latestJournals[0];
        console.log(`📺 Dernier journal: ${latestVideo.title}`);
        
        // Sauvegarder dans Supabase pour le cache
        try {
          // D'abord vérifier si la vidéo existe déjà
          const { data: existingVideo } = await supabase
            .from('youtube_cache')
            .select('id')
            .eq('video_id', latestVideo.id)
            .single();

          if (existingVideo) {
            // Mettre à jour la vidéo existante
            const { error } = await supabase
              .from('youtube_cache')
              .update({
                title: latestVideo.title,
                thumbnail: latestVideo.thumbnail,
                url: latestVideo.url,
                published_at: latestVideo.publishedAt,
                duration: latestVideo.duration,
                channel_name: 'Gabon Télévision',
                is_active: true,
                extracted_at: new Date().toISOString()
              })
              .eq('video_id', latestVideo.id);
              
            if (error) throw error;
          } else {
            // Insérer une nouvelle vidéo
            const { error } = await supabase
              .from('youtube_cache')
              .insert({
                video_id: latestVideo.id,
                title: latestVideo.title,
                thumbnail: latestVideo.thumbnail,
                url: latestVideo.url,
                published_at: latestVideo.publishedAt,
                duration: latestVideo.duration,
                channel_name: 'Gabon Télévision',
                is_active: true,
                extracted_at: new Date().toISOString()
              });
              
            if (error) throw error;
          }
          
          console.log('✅ Vidéo sauvegardée dans le cache Supabase');
        } catch (supabaseError) {
          console.error('❌ Erreur connexion Supabase:', supabaseError);
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(latestJournals)
        };
      }
      
    } catch (rssError) {
      console.error('❌ Erreur récupération RSS:', rssError.message);
    }
    
    // Essayer de récupérer depuis le cache Supabase
    try {
      console.log('🔄 Tentative de récupération depuis le cache Supabase...');
      
      const { data: cachedVideos, error: cacheError } = await supabase
        .from('youtube_cache')
        .select('*')
        .eq('is_active', true)
        .order('extracted_at', { ascending: false })
        .limit(1)

      if (!cacheError && cachedVideos && cachedVideos.length > 0) {
        console.log('✅ Vidéo récupérée depuis le cache')
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify([{
            id: cachedVideos[0].video_id,
            title: cachedVideos[0].title,
            thumbnail: cachedVideos[0].thumbnail,
            url: cachedVideos[0].url,
            publishedAt: cachedVideos[0].published_at,
            duration: cachedVideos[0].duration
          }])
        }
      }
    } catch (cacheError) {
      console.error('❌ Erreur cache Supabase:', cacheError);
    }

    // Fallback final avec données par défaut
    const fallbackVideo = {
      id: 'fallback-journal',
      title: 'Journal Télévisé - Gabon 24/7',
      thumbnail: '/369309819_1696052364152294_5673051963922538250_n.jpg',
      url: 'https://youtube.com/channel/UC8tPg9fQP4S7DtPgFqRqXQw',
      publishedAt: new Date().toISOString(),
      duration: 'N/A'
    };

    console.log('⚠️ Utilisation du fallback final')
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify([fallbackVideo])
    }

  } catch (error) {
    console.error('❌ Erreur YouTube feed:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Erreur lors de la récupération du flux YouTube',
        details: error.message
      })
    }
  }
};
