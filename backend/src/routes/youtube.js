const express = require('express');
const axios = require('axios');
const { DOMParser } = require('@xmldom/xmldom');
const supabaseService = require('../../supabase-config');
const redisCache = require('../../services/redis-cache.service');

const router = express.Router();

// Client Supabase partagé (même projet que le reste du backend)
const supabase = supabaseService.supabase;

/**
 * 📺 LOGIQUE DE SYNCHRONISATION DU JOURNAL TV
 * 
 * Horaires de synchronisation (heure Gabon = UTC+1):
 * - 14h30 : Affiche le journal de 13h
 * - 21h30 : Affiche le journal de 20h
 * - 00h00 : Affiche le dernier journal du soir
 * 
 * Le widget sélectionne le journal approprié selon l'heure actuelle
 */
function getTargetJournalTime() {
  // Heure actuelle au Gabon (UTC+1)
  const now = new Date();
  const gabonHour = (now.getUTCHours() + 1) % 24;
  const gabonMinutes = now.getUTCMinutes();
  const gabonTime = gabonHour + gabonMinutes / 60;
  
  // Déterminer quel journal afficher selon l'heure
  // Entre 14h30 et 21h30 → Journal de 13h
  // Entre 21h30 et minuit → Journal de 20h
  // Entre minuit et 14h30 → Dernier journal disponible (20h de la veille)
  
  if (gabonTime >= 14.5 && gabonTime < 21.5) {
    return { targetHour: 13, label: 'Journal de 13h' };
  } else if (gabonTime >= 21.5 || gabonTime < 0.5) {
    return { targetHour: 20, label: 'Journal de 20h' };
  } else {
    // Entre minuit et 14h30 → afficher le dernier journal (20h de la veille)
    return { targetHour: 20, label: 'Dernier journal', yesterday: true };
  }
}

// Endpoint pour récupérer le flux YouTube RSS - journal selon l'heure
router.get('/youtube', async (req, res) => {
  try {
    const targetJournal = getTargetJournalTime();

    // Cache Redis - 30 minutes pour YouTube
    const cacheKey = `youtube:journal:${targetJournal.targetHour}`;
    if (redisCache.isAvailable()) {
      const cached = await redisCache.get(cacheKey);
      if (cached) {
        console.log(`⚡ Cache HIT: ${cacheKey}`);
        return res.json(cached);
      }
    }

    // URL du flux RSS spécifié par l'utilisateur (RSS.app)
    const RSS_URL = 'https://rss.app/feeds/8Zm0ezBRaaD2NiOF.xml';

    console.log(`📺 Récupération du flux RSS - Cible: ${targetJournal.label}`);

    // Récupération directe sans proxy (Node.js n'a pas de restrictions CORS)
    const response = await axios.get(RSS_URL, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.data) {
      throw new Error('Pas de données reçues du flux RSS');
    }
    
    // Parser le XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(response.data, 'text/xml');
    
    // Extraire les items
    const items = xmlDoc.getElementsByTagName('item');
    const videos = [];
    
    // Mots-clés pour identifier les journaux TV (au cas où, mais le flux semble dédié)
    const journalKeywords = [
      'journal', 'jt', 'actualité', 'actualités', 'info', 'infos', 
      'télé', 'tv', 'édition', 'flash', 'bulletin', 'nouvelles', '20h', '13h', '19h'
    ];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      const titleNode = item.getElementsByTagName('title')[0];
      const linkNode = item.getElementsByTagName('link')[0];
      const pubDateNode = item.getElementsByTagName('pubDate')[0];
      const enclosureNode = item.getElementsByTagName('enclosure')[0];
      const descriptionNode = item.getElementsByTagName('description')[0];
      const mediaContentNode = item.getElementsByTagName('media:content')[0];
      const mediaThumbnailNode = item.getElementsByTagName('media:thumbnail')[0];
      
      const title = titleNode?.textContent || '';
      const link = linkNode?.textContent || '';
      const pubDate = pubDateNode?.textContent || '';
      const description = descriptionNode?.textContent || '';
      
      // Essayer plusieurs sources pour la miniature
      let thumbnail = enclosureNode?.getAttribute('url') || 
                      mediaThumbnailNode?.getAttribute('url') || 
                      mediaContentNode?.getAttribute('url') || 
                      '';
      
      // Extraire l'ID YouTube de l'URL
      const videoId = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1] || '';
      
      // Si pas de miniature trouvée mais qu'on a un ID YouTube, on la construit
      if (!thumbnail && videoId) {
        thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
      
      if (videoId) {
        // On prend tout ce qui vient de ce flux car l'utilisateur a spécifié ce flux précis
        // Mais on garde une priorité aux titres contenant des mots clés si besoin de trier
        videos.push({
          id: videoId,
          title: title.replace(/^\[CDATA\[|\]\]$/g, '').trim(),
          thumbnail: thumbnail,
          url: link,
          publishedAt: pubDate,
          description: description.replace(/^\[CDATA\[|\]\]$/g, '').trim()
        });
      }
    }
    
    // Trier par date de publication (plus récent en premier)
    videos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    console.log(`📺 Trouvé ${videos.length} vidéos dans le flux`);

    // Date du jour actuel (Gabon = UTC+1)
    const now = new Date();
    const todayGabon = new Date(now.getTime() + (1 * 60 * 60 * 1000)); // UTC+1
    const todayStr = todayGabon.toISOString().split('T')[0]; // "2025-12-30"

    // Sélectionner le journal approprié selon l'heure
    let selectedVideo = null;

    /**
     * 📺 NOUVELLE LOGIQUE DE SÉLECTION:
     *
     * 1. Si on cherche le journal de 20h → chercher le 20h du JOUR ACTUEL
     * 2. Si pas de 20h aujourd'hui → prendre le journal LE PLUS RÉCENT (peut être 13h d'aujourd'hui)
     * 3. Si on cherche le journal de 13h → chercher le 13h du JOUR ACTUEL
     * 4. Sinon → prendre le plus récent disponible
     *
     * Le principe: toujours afficher le contenu le plus frais possible
     */

    // Chercher le journal correspondant à l'heure cible POUR AUJOURD'HUI
    for (const video of videos) {
      const title = video.title.toLowerCase();
      const pubDate = new Date(video.publishedAt);
      const pubDateStr = pubDate.toISOString().split('T')[0];

      // Vérifier si c'est un journal d'aujourd'hui
      const isToday = pubDateStr === todayStr;

      // Vérifier si le titre contient l'heure cible
      const is13h = title.includes('13h') || title.includes('13 h') || title.includes('midi');
      const is20h = title.includes('20h') || title.includes('20 h') || title.includes('soir') || title.includes('19h') || title.includes('19 h');
      const is23h = title.includes('23h') || title.includes('23 h');

      // Priorité: Journal de l'heure cible pour aujourd'hui
      if (isToday) {
        if (targetJournal.targetHour === 13 && is13h) {
          selectedVideo = video;
          console.log(`📺 Journal de 13h d'aujourd'hui trouvé: ${video.title}`);
          break;
        } else if (targetJournal.targetHour === 20 && (is20h || is23h)) {
          selectedVideo = video;
          console.log(`📺 Journal de 20h/23h d'aujourd'hui trouvé: ${video.title}`);
          break;
        }
      }
    }

    // Si pas de journal de l'heure cible aujourd'hui → PRENDRE LE PLUS RÉCENT
    // C'est mieux d'avoir un journal de 13h du 30/12 qu'un journal de 20h du 27/12
    if (!selectedVideo && videos.length > 0) {
      selectedVideo = videos[0];
      console.log(`📺 Pas de ${targetJournal.label} aujourd'hui → Journal le plus récent: ${selectedVideo.title}`);
    }
    
    // Retourner les 3 derniers avec le journal sélectionné en premier
    const latestJournals = selectedVideo 
      ? [selectedVideo, ...videos.filter(v => v.id !== selectedVideo.id).slice(0, 2)]
      : videos.slice(0, 3);
    
    if (latestJournals.length > 0) {
      const latestVideo = latestJournals[0];
      console.log(`📺 Journal affiché: ${latestVideo.title} (${targetJournal.label})`);
      
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
              published_at: latestVideo.publishedAt, // Format date string compatible
              duration: latestVideo.duration || 'N/A',
              channel_name: 'Gabon Télévision',
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
      
      // Mettre en cache Redis - 30 minutes
      if (redisCache.isAvailable()) {
        await redisCache.set(cacheKey, latestJournals, 1800);
      }

      // Retourner le tableau des vidéos
      res.json(latestJournals);
      return;
    }
    
    // Si aucune vidéo trouvée dans le flux
    console.warn('⚠️ Aucune vidéo trouvée dans le flux RSS');
    
    // Tenter de récupérer depuis le cache si le flux est vide
    throw new Error('Flux vide');
    
  } catch (error) {
    console.error('❌ Erreur YouTube RSS:', error.message);
    
    // Essayer de récupérer la dernière vidéo depuis le cache Supabase en cas d'erreur
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
          
        if (cacheError) {
          console.error('❌ Erreur cache Supabase:', cacheError);
          throw cacheError;
        }
        
        if (cachedVideo) {
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
    
    // Fallback final avec une vraie image de journal TV gabonais
    console.log('⚠️ Utilisation du fallback final');
    res.json([{
      id: 'fallback-journal',
      title: 'Journal Télévisé - Gabon 24/7',
      thumbnail: '/369309819_1696052364152294_5673051963922538250_n.jpg', // Image existante dans public/
      url: 'https://youtube.com/channel/UCYourChannelID',
      publishedAt: new Date().toISOString(),
      duration: 'N/A'
    }]);
  }
});

module.exports = router;
