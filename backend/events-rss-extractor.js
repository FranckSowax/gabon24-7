/**
 * 🎉 EXTRACTEUR D'ÉVÉNEMENTS DEPUIS FLUX RSS
 * 
 * Extrait les événements depuis le flux RSS Eventime.ga
 * et les synchronise dans Supabase
 */

const axios = require('axios');
const xml2js = require('xml2js');
const supabaseService = require('./supabase-config');

const RSS_URL = 'https://rss.app/feeds/S4lUk8j474PjWeYr.xml';

async function extractEventsFromRSS() {
  console.log('\n🎉 EXTRACTION DES ÉVÉNEMENTS DEPUIS RSS');
  console.log('='.repeat(80));
  
  try {
    // 1. Récupérer le flux RSS
    console.log(`\n🔄 Récupération du flux: ${RSS_URL}`);
    const response = await axios.get(RSS_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Gabon247Bot/1.0)'
      }
    });
    
    // 2. Parser le XML
    const parser = new xml2js.Parser({
      explicitArray: true,
      mergeAttrs: true
    });
    const result = await parser.parseStringPromise(response.data);
    
    if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
      console.error('❌ Structure RSS invalide');
      return { success: false, message: 'Structure RSS invalide' };
    }
    
    const items = result.rss.channel[0].item;
    console.log(`✅ ${items.length} événements trouvés dans le flux RSS`);
    
    // 3. Analyser chaque événement
    console.log('\n📊 ANALYSE DES ÉVÉNEMENTS:\n');
    
    const events = [];
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      const event = {
        title: item.title ? item.title[0] : '',
        description: item.description ? item.description[0] : '',
        link: item.link ? item.link[0] : '',
        pubDate: item.pubDate ? item.pubDate[0] : new Date().toISOString(),
        image: null,
        location: null
      };
      
      // Extraire l'image depuis media:thumbnail, media:content ou enclosure
      if (item['media:thumbnail']) {
        const thumb = item['media:thumbnail'][0];
        event.image = typeof thumb === 'string' ? thumb : (thumb.url || thumb.$ || null);
      } else if (item['media:content']) {
        const content = item['media:content'][0];
        event.image = typeof content === 'string' ? content : (content.url || content.$ || null);
      } else if (item.enclosure) {
        const enc = item.enclosure[0];
        event.image = typeof enc === 'string' ? enc : (enc.url || enc.$ || null);
      }
      
      // Si c'est toujours un objet, essayer d'extraire l'URL
      if (event.image && typeof event.image === 'object') {
        event.image = event.image.url || event.image.href || null;
      }
      
      // Extraire l'image depuis la description si pas trouvée
      if (!event.image && event.description) {
        const imgMatch = event.description.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (imgMatch) {
          event.image = imgMatch[1];
        }
      }
      
      // Extraire le lieu depuis la description ou le contenu
      if (event.description) {
        // Chercher des patterns comme "Lieu :", "Location:", "📍"
        const locationMatch = event.description.match(/(?:Lieu\s*:\s*|Location\s*:\s*|📍\s*)([^<\n]+)/i);
        if (locationMatch) {
          event.location = locationMatch[1].trim();
        }
      }
      
      events.push(event);
      
      const pubDate = new Date(event.pubDate);
      console.log(`${i + 1}. ${pubDate.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })} | Image: ${event.image ? '✅ OUI' : '❌ NON'}`);
      console.log(`   📰 ${event.title}`);
      if (event.location) {
        console.log(`   📍 ${event.location}`);
      }
      if (event.image && typeof event.image === 'string') {
        console.log(`   🖼️  ${event.image.substring(0, 60)}...`);
      }
      console.log('');
    }
    
    // 4. Synchroniser avec Supabase
    console.log('='.repeat(80));
    console.log('\n💾 SYNCHRONISATION AVEC SUPABASE:\n');
    
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    
    for (const event of events) {
      try {
        // Vérifier si l'événement existe déjà
        const { data: existing, error: searchError } = await supabaseService.supabase
          .from('events')
          .select('id, title, image_url')
          .eq('url', event.link)
          .limit(1);
        
        if (searchError) {
          console.error(`❌ Erreur recherche: ${searchError.message}`);
          errors++;
          continue;
        }
        
        const eventData = {
          title: event.title,
          description: event.description,
          url: event.link,
          image_url: event.image,
          location: event.location || '',
          event_date: event.pubDate,
          category: 'Événement',
          organizer: 'Eventime.ga',
          is_active: true,
          updated_at: new Date().toISOString()
        };
        
        if (existing && existing.length > 0) {
          // Mettre à jour si l'image a changé ou si les données sont différentes
          const existingEvent = existing[0];
          if (existingEvent.image_url !== event.image || existingEvent.title !== event.title) {
            const { error: updateError } = await supabaseService.supabase
              .from('events')
              .update(eventData)
              .eq('id', existingEvent.id);
            
            if (updateError) {
              console.log(`❌ Erreur mise à jour: ${event.title.substring(0, 40)}...`);
              errors++;
            } else {
              console.log(`🔄 Mis à jour: ${event.title.substring(0, 50)}...`);
              updated++;
            }
          } else {
            console.log(`⏭️  Identique: ${event.title.substring(0, 50)}...`);
          }
        } else {
          // Insérer nouvel événement
          const { error: insertError } = await supabaseService.supabase
            .from('events')
            .insert(eventData);
          
          if (insertError) {
            console.log(`❌ Erreur insertion: ${event.title.substring(0, 40)}...`);
            console.log(`   ${insertError.message}`);
            errors++;
          } else {
            console.log(`✅ Ajouté: ${event.title.substring(0, 50)}...`);
            inserted++;
          }
        }
        
        // Pause pour éviter de surcharger
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.error(`❌ Erreur: ${err.message}`);
        errors++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n📊 RÉSULTAT DE LA SYNCHRONISATION:\n');
    console.log(`   ✅ Événements ajoutés: ${inserted}`);
    console.log(`   🔄 Événements mis à jour: ${updated}`);
    console.log(`   ❌ Erreurs: ${errors}`);
    console.log(`   📊 Total traité: ${events.length}`);
    
    return {
      success: true,
      inserted,
      updated,
      errors,
      total: events.length
    };
    
  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data?.substring(0, 200));
    }
    return {
      success: false,
      message: error.message
    };
  }
}

// Fonction pour nettoyer les vieux événements (plus de 30 jours)
async function cleanOldEvents() {
  console.log('\n🧹 NETTOYAGE DES VIEUX ÉVÉNEMENTS');
  console.log('='.repeat(80));
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Nettoyer basé sur created_at car event_date peut être null
    const { data, error } = await supabaseService.supabase
      .from('events')
      .delete()
      .lt('created_at', thirtyDaysAgo.toISOString());
    
    if (error) {
      console.error('❌ Erreur nettoyage:', error.message);
    } else {
      console.log(`✅ Événements de plus de 30 jours supprimés`);
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

// Exécuter si lancé directement
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--clean')) {
    cleanOldEvents()
      .then(() => extractEventsFromRSS())
      .then((result) => {
        console.log('\n✅ Terminé !\n');
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('❌', err);
        process.exit(1);
      });
  } else {
    extractEventsFromRSS()
      .then((result) => {
        console.log('\n✅ Terminé !\n');
        process.exit(result.success ? 0 : 1);
      })
      .catch(err => {
        console.error('❌', err);
        process.exit(1);
      });
  }
}

module.exports = { extractEventsFromRSS, cleanOldEvents };
