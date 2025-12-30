/**
 * 📺 EXTRACTEUR DE JOURNAL TV DEPUIS FLUX RSS
 * 
 * Extrait le journal TV depuis le flux RSS YouTube
 * et met à jour l'image dans Supabase
 */

const axios = require('axios');
const xml2js = require('xml2js');
const supabaseService = require('./supabase-config');

// Flux YouTube officiel (toujours à jour en temps réel)
const RSS_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UC7E__Dp9FSIgt6iMa5_uvlw';
// Fallback si YouTube bloque
const RSS_FALLBACK_URL = 'https://rss.app/feeds/8Zm0ezBRaaD2NiOF.xml';

async function extractJournalFromRSS() {
  console.log('\n📺 EXTRACTION DU JOURNAL TV DEPUIS RSS');
  console.log('='.repeat(80));
  
  try {
    // 1. Récupérer le flux RSS
    console.log(`\n🔄 Récupération du flux: ${RSS_URL}`);
    let response;
    try {
      response = await axios.get(RSS_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Gabon247Bot/1.0)'
        }
      });
    } catch (e) {
      console.log(`⚠️ Flux officiel inaccessible (${e.message}). Tentative fallback...`);
      response = await axios.get(RSS_FALLBACK_URL, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Gabon247Bot/1.0)'
        }
      });
      console.log('✅ Flux fallback récupéré');
    }
    
    // 2. Parser le XML
    const parser = new xml2js.Parser({
      explicitArray: true,
      trim: true,
      normalize: true,
      normalizeTags: false
    });
    
    let result;
    try {
      result = await parser.parseStringPromise(response.data);
    } catch (parseError) {
      console.error('❌ Erreur parsing XML:', parseError.message);
      return null;
    }
    
    // Gérer à la fois le format RSS et Atom (YouTube)
    let items = [];
    
    if (result.feed && result.feed.entry) {
      // Format Atom (YouTube officiel)
      items = result.feed.entry;
      console.log('📡 Format Atom (YouTube) détecté');
    } else if (result.rss && result.rss.channel && result.rss.channel[0] && result.rss.channel[0].item) {
      // Format RSS (RSS.app fallback)
      items = result.rss.channel[0].item;
      console.log('📡 Format RSS détecté');
    } else {
      console.error('❌ Structure XML invalide ou vide');
      console.error('Structure reçue:', JSON.stringify(result, null, 2).substring(0, 500));
      return null;
    }
    console.log(`✅ ${items.length} vidéos trouvées dans le flux RSS`);
    
    // 3. Analyser chaque item
    console.log('\n📊 ANALYSE DES VIDÉOS:\n');
    
    const videos = [];
    
    // Analyser jusqu'à 15 vidéos pour trouver le journal
    for (let i = 0; i < Math.min(items.length, 15); i++) {
      const item = items[i];
      
      // Extraire les données selon le format (RSS ou Atom)
      const video = {
        title: item.title ? item.title[0] : '',
        link: '',
        pubDate: '',
        description: '',
        thumbnail: null
      };
      
      // Link (différent entre RSS et Atom)
      if (item.link) {
        if (typeof item.link[0] === 'string') {
          // Format RSS : <link>url</link>
          video.link = item.link[0];
        } else if (item.link[0].$ && item.link[0].$.href) {
          // Format Atom : <link href="url" />
          video.link = item.link[0].$.href;
        }
      }
      
      // Date de publication (différent entre RSS et Atom)
      if (item.pubDate) {
        // Format RSS : <pubDate>
        video.pubDate = item.pubDate[0];
      } else if (item.published) {
        // Format Atom : <published>
        video.pubDate = item.published[0];
      }
      
      // Description
      if (item.description) {
        video.description = item.description[0];
      } else if (item.summary) {
        video.description = item.summary[0];
      } else if (item.content) {
        video.description = item.content[0];
      }
      
      // Extraire l'image depuis media:thumbnail ou media:content
      if (item['media:thumbnail']) {
        video.thumbnail = item['media:thumbnail'][0].$.url;
      } else if (item['media:content']) {
        video.thumbnail = item['media:content'][0].$.url;
      } else if (item['media:group'] && item['media:group'][0] && item['media:group'][0]['media:thumbnail']) {
        video.thumbnail = item['media:group'][0]['media:thumbnail'][0].$.url;
      } else if (item.enclosure) {
        video.thumbnail = item.enclosure[0].$.url;
      }
      
      // Si pas d'image mais URL YouTube, la construire
      if (!video.thumbnail && video.link && video.link.includes('youtube.com/watch')) {
        const match = video.link.match(/[?&]v=([^&]+)/);
        if (match) {
          video.thumbnail = `https://i.ytimg.com/vi/${match[1]}/maxresdefault.jpg`;
        }
      }
      
      videos.push(video);
    }
    
    console.log('\n📊 ANALYSE DES VIDÉOS TROUVÉES:\n');
    for (let i = 0; i < videos.length && i < 5; i++) {
      const video = videos[i];
      console.log(`${i + 1}. ${new Date(video.pubDate).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })} | Image: ${video.thumbnail ? '✅' : '❌'}`);
      console.log(`   📰 ${video.title.substring(0, 70)}${video.title.length > 70 ? '...' : ''}`);
      console.log('');
    }
    
    if (videos.length > 5) {
      console.log(`   ... et ${videos.length - 5} autres vidéos\n`);
    }
    
    // 4. Filtrer pour ne garder que les vrais journaux TV (pas les émissions spéciales)
    const journalKeywords = ['journal télévisé', 'journal tv', 'jt de', 'journal de'];
    const journalVideos = videos.filter(video => {
      const titleLower = video.title.toLowerCase();
      return journalKeywords.some(keyword => titleLower.includes(keyword));
    });
    
    console.log(`\n🔍 ${journalVideos.length} journaux TV identifiés sur ${videos.length} vidéos\n`);
    
    // 5. Trier les journaux par date de publication (plus récent en premier)
    journalVideos.sort((a, b) => {
      const dateA = new Date(a.pubDate);
      const dateB = new Date(b.pubDate);
      return dateB - dateA; // Tri décroissant (plus récent d'abord)
    });
    
    // 6. Prioriser les journaux de 20h et 23h (éditions principales)
    const priorityJournals = journalVideos.filter(video => {
      const titleLower = video.title.toLowerCase();
      return titleLower.includes('20h') || titleLower.includes('23h');
    });
    
    // Trier les journaux prioritaires par date (le plus récent en premier)
    // Ex: Si on a 23h et 20h du même jour, le 23h sera en premier
    if (priorityJournals.length > 0) {
      priorityJournals.sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateB - dateA; // Tri décroissant (plus récent d'abord)
      });
    }
    
    // Utiliser le journal prioritaire le plus récent, sinon le journal le plus récent tout court
    // Si aucun journal trouvé, utiliser la vidéo la plus récente (fallback)
    let sortedVideos = priorityJournals.length > 0 ? priorityJournals : journalVideos;
    
    if (sortedVideos.length === 0 && videos.length > 0) {
      console.log('⚠️ Aucun "Journal TV" identifié par mot-clé. Utilisation de la vidéo la plus récente.');
      // Trier toutes les vidéos par date
      videos.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
      sortedVideos = videos;
    }
    
    console.log('\n🔄 APRÈS TRI ET PRIORISATION:\n');
    for (let i = 0; i < Math.min(sortedVideos.length, 5); i++) {
      const video = sortedVideos[i];
      const isPriority = video.title.toLowerCase().includes('20h') || video.title.toLowerCase().includes('23h');
      console.log(`${i + 1}. ${new Date(video.pubDate).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })} ${isPriority ? '⭐' : '  '} | ${video.title.substring(0, 60)}...`);
    }
    
    // 7. Trouver le journal le plus récent
    const latestVideo = sortedVideos[0];
    
    if (!latestVideo) {
      console.log('❌ Aucune vidéo trouvée');
      return null;
    }
    
    console.log('='.repeat(80));
    console.log('\n🎯 JOURNAL LE PLUS RÉCENT:\n');
    console.log(`📰 ${latestVideo.title}`);
    console.log(`🔗 ${latestVideo.link}`);
    console.log(`📅 ${latestVideo.pubDate}`);
    console.log(`🖼️  ${latestVideo.thumbnail || 'PAS D\'IMAGE'}`);
    
    // 5. Vérifier si l'article existe déjà dans Supabase
    console.log('\n🔍 Recherche dans la base de données...');
    const { data: existingArticles, error: searchError } = await supabaseService.supabase
      .from('articles')
      .select('id, title, url, image_urls')
      .eq('url', latestVideo.link)
      .limit(1);
    
    if (searchError) {
      console.error('❌ Erreur recherche:', searchError.message);
      return null;
    }
    
    // 6. TOUJOURS sauvegarder dans youtube_cache pour le widget
    console.log('\n💾 Sauvegarde dans youtube_cache...');
    
    // Extraire video_id depuis l'URL YouTube
    const videoIdMatch = latestVideo.link.match(/[?&]v=([^&]+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    
    if (videoId) {
      const cacheData = {
        video_id: videoId,
        title: latestVideo.title,
        url: latestVideo.link,
        thumbnail: latestVideo.thumbnail,
        published_at: new Date(latestVideo.pubDate).toISOString(),
        extracted_at: new Date().toISOString(),
        is_active: true
      };
      
      // Upsert dans youtube_cache
      const { error: cacheError } = await supabaseService.supabase
        .from('youtube_cache')
        .upsert(cacheData, { 
          onConflict: 'video_id',
          ignoreDuplicates: false 
        });
      
      if (cacheError) {
        console.error('❌ Erreur sauvegarde cache:', cacheError.message);
      } else {
        console.log('✅ Journal sauvegardé dans youtube_cache');
      }
    }
    
    if (existingArticles && existingArticles.length > 0) {
      const article = existingArticles[0];
      console.log(`✅ Article trouvé dans la BDD (ID: ${article.id})`);
      
      // Mettre à jour l'image si elle n'existe pas
      const hasImage = article.image_urls && article.image_urls.length > 0;
      if (!hasImage && latestVideo.thumbnail) {
        console.log('🔄 Ajout de l\'image manquante...');
        
        const { error: updateError } = await supabaseService.supabase
          .from('articles')
          .update({ 
            image_urls: [latestVideo.thumbnail],
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id);
        
        if (updateError) {
          console.error('❌ Erreur mise à jour image:', updateError.message);
        } else {
          console.log('✅ Image ajoutée avec succès');
        }
      } else if (hasImage) {
        console.log('ℹ️  Image déjà présente');
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('🎉 JOURNAL TV SYNCHRONISÉ');
      console.log('='.repeat(80));
      return article;
    } else {
      console.log('⚠️  Article non trouvé dans la BDD');
      console.log('\n' + '='.repeat(80));
      console.log('📝 INFO: L\'article sera créé lors du prochain traitement RSS');
      console.log('   Le processeur RSS tourne toutes les 15 minutes');
      console.log('   ✅ Mais le journal est déjà disponible dans le cache pour le widget');
      console.log('='.repeat(80));
    }
    
    return latestVideo;
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data?.substring(0, 200));
    }
    return null;
  }
}

// 6. Fonction pour mettre à jour tous les journaux récents sans image
async function updateRecentJournalsImages() {
  console.log('\n\n🔄 MISE À JOUR DES IMAGES DES JOURNAUX RÉCENTS');
  console.log('='.repeat(80));
  
  try {
    // Récupérer le flux RSS
    const response = await axios.get(RSS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Gabon247Bot/1.0)'
      }
    });
    
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);
    const items = result.rss.channel[0].item;
    
    console.log(`\n📊 ${items.length} vidéos dans le flux RSS`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const item of items) {
      const link = item.link ? item.link[0] : '';
      if (!link) continue;
      
      // Construire l'image YouTube
      let thumbnail = null;
      if (item['media:thumbnail']) {
        thumbnail = item['media:thumbnail'][0].$.url;
      } else if (link.includes('youtube.com/watch')) {
        const match = link.match(/[?&]v=([^&]+)/);
        if (match) {
          thumbnail = `https://i.ytimg.com/vi/${match[1]}/maxresdefault.jpg`;
        }
      }
      
      if (!thumbnail) continue;
      
      // Chercher l'article dans Supabase
      const { data: articles } = await supabaseService.supabase
        .from('articles')
        .select('id, title, url, image_urls')
        .eq('url', link)
        .or('image_urls.is.null,image_urls.eq.{}')
        .limit(1);
      
      if (articles && articles.length > 0) {
        const article = articles[0];
        console.log(`\n🔄 Mise à jour: ${article.title.substring(0, 60)}...`);
        
        const { error } = await supabaseService.supabase
          .from('articles')
          .update({ 
            image_urls: [thumbnail],
            updated_at: new Date().toISOString()
          })
          .eq('id', article.id);
        
        if (!error) {
          console.log(`   ✅ Image ajoutée: ${thumbnail.substring(0, 60)}...`);
          updated++;
        } else {
          console.log(`   ❌ Erreur: ${error.message}`);
        }
        
        // Pause pour éviter de surcharger
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        skipped++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 RÉSULTAT:`);
    console.log(`   ✅ Images ajoutées: ${updated}`);
    console.log(`   ⏭️  Articles ignorés: ${skipped}`);
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
  }
}

// Exécuter si lancé directement
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--update-all')) {
    updateRecentJournalsImages()
      .then(() => {
        console.log('\n✅ Terminé !\n');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌', err);
        process.exit(1);
      });
  } else {
    extractJournalFromRSS()
      .then(() => {
        console.log('\n✅ Terminé !\n');
        process.exit(0);
      })
      .catch(err => {
        console.error('❌', err);
        process.exit(1);
      });
  }
}

module.exports = { extractJournalFromRSS, updateRecentJournalsImages };
