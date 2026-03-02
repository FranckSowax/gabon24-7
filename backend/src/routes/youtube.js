const express = require('express');
const axios = require('axios');
const { DOMParser } = require('@xmldom/xmldom');
const supabaseService = require('../../supabase-config');
const redisCache = require('../../services/redis-cache.service');

const router = express.Router();

// Client Supabase partagé (même projet que le reste du backend)
const supabase = supabaseService.supabase;

// Extraire l'ID vidéo YouTube depuis une URL (lien ou thumbnail)
function extractVideoId(url) {
  if (!url) return null;
  // Depuis un lien youtube.com/watch?v=...
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // Depuis un lien youtu.be/...
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // Depuis une thumbnail ytimg.com/vi/VIDEO_ID/...
  const thumbMatch = url.match(/ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/);
  if (thumbMatch) return thumbMatch[1];
  // Depuis un embed youtube.com/embed/...
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

// Endpoint pour récupérer le flux Gabon 24 RSS - tous les journaux TV
router.get('/youtube', async (req, res) => {
  try {
    // Cache Redis - 15 minutes
    const cacheKey = 'youtube:gabon24:latest';
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    // Flux RSS Gabon 24 (rss.app)
    const RSS_FEED_URL = 'https://rss.app/feeds/JMQQ0e08D1OlELDI.xml';

    console.log('📺 Récupération du flux Gabon 24 RSS...');

    const response = await axios.get(RSS_FEED_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GabonInsight/1.0)'
      }
    });

    if (!response.data) {
      throw new Error('Pas de données reçues du flux RSS');
    }

    // Parser le XML RSS 2.0
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');

    const items = xmlDoc.getElementsByTagName('item');
    const videos = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const titleNode = item.getElementsByTagName('title')[0];
      const linkNode = item.getElementsByTagName('link')[0];
      const pubDateNode = item.getElementsByTagName('pubDate')[0];
      const descNode = item.getElementsByTagName('description')[0];

      const title = titleNode?.textContent || '';
      const link = linkNode?.textContent || '';
      const pubDate = pubDateNode?.textContent || '';

      // Extraire la thumbnail depuis media:content ou enclosure
      let thumbnail = '';
      const mediaContent = item.getElementsByTagName('media:content')[0];
      const enclosure = item.getElementsByTagName('enclosure')[0];

      if (mediaContent) {
        thumbnail = mediaContent.getAttribute('url') || '';
      }
      if (!thumbnail && enclosure) {
        thumbnail = enclosure.getAttribute('url') || '';
      }

      // Extraire le videoId depuis le lien, la description (iframe embed), ou la thumbnail
      let videoId = extractVideoId(link);
      if (!videoId && descNode?.textContent) {
        videoId = extractVideoId(descNode.textContent);
      }
      if (!videoId && thumbnail) {
        videoId = extractVideoId(thumbnail);
      }

      // Construire la thumbnail HD si on a un videoId
      if (videoId && !thumbnail) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }

      // URL YouTube directe
      const youtubeUrl = videoId
        ? `https://www.youtube.com/watch?v=${videoId}`
        : link;

      if (title) {
        videos.push({
          id: videoId || `rss-${i}`,
          title: title.trim(),
          thumbnail: thumbnail,
          url: youtubeUrl,
          publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
        });
      }
    }

    // Trier par date de publication (plus récent en premier)
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    console.log(`📺 ${videos.length} vidéos Gabon 24 trouvées dans le flux`);

    // Retourner les 5 dernières
    const latestVideos = videos.slice(0, 5);

    if (latestVideos.length > 0) {
      const latestVideo = latestVideos[0];
      console.log(`📺 Dernier journal: ${latestVideo.title}`);

      // Sauvegarder dans Supabase pour le cache
      if (supabase) {
        try {
          const { error } = await supabase
            .from('youtube_cache')
            .upsert({
              video_id: latestVideo.id,
              title: latestVideo.title,
              thumbnail: latestVideo.thumbnail,
              url: latestVideo.url,
              published_at: latestVideo.publishedAt,
              duration: 'N/A',
              channel_name: 'Gabon 24',
              is_active: true
            }, {
              onConflict: 'video_id'
            });

          if (error) {
            console.error('❌ Erreur sauvegarde Supabase:', error.message);
          } else {
            console.log('✅ Vidéo sauvegardée dans le cache Supabase');
          }
        } catch (supabaseError) {
          console.error('❌ Erreur connexion Supabase:', supabaseError);
        }
      }

      // Mettre en cache Redis - 15 minutes
      if (redisCache.isAvailable()) {
        await redisCache.set(cacheKey, latestVideos, 900);
      }

      res.json(latestVideos);
      return;
    }

    // Flux vide
    console.warn('⚠️ Aucune vidéo trouvée dans le flux Gabon 24');
    throw new Error('Flux vide');

  } catch (error) {
    console.error('❌ Erreur Gabon 24 RSS:', error.message);

    // Fallback: cache Supabase
    if (supabase) {
      try {
        console.log('🔄 Tentative de récupération depuis le cache Supabase...');

        const { data: cachedVideo, error: cacheError } = await supabase
          .from('youtube_cache')
          .select('*')
          .eq('is_active', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .single();

        if (!cacheError && cachedVideo) {
          console.log('✅ Vidéo récupérée depuis le cache:', cachedVideo.title);

          res.json([{
            id: cachedVideo.video_id,
            title: cachedVideo.title,
            thumbnail: cachedVideo.thumbnail,
            url: cachedVideo.url,
            publishedAt: cachedVideo.published_at,
            duration: cachedVideo.duration
          }]);
          return;
        }
      } catch (cacheError) {
        console.error('❌ Impossible de récupérer le cache:', cacheError);
      }
    }

    // Fallback final
    console.log('⚠️ Utilisation du fallback final');
    res.json([{
      id: 'fallback-journal',
      title: 'Journal Télévisé - Gabon 24',
      thumbnail: '/369309819_1696052364152294_5673051963922538250_n.jpg',
      url: 'https://www.youtube.com/@gabon24',
      publishedAt: new Date().toISOString(),
      duration: 'N/A'
    }]);
  }
});

module.exports = router;
