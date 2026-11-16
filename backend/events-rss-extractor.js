/**
 * 🎉 SYNCHRONISATION DES ÉVÉNEMENTS À VENIR
 *
 * Lit le flux Eventime (services/eventime-events.js : date et lieu repris de la
 * page de chaque événement) et l'enregistre dans la table `events`.
 * Appelée par la tâche quotidienne de 6 h et par POST /api/events/sync.
 */

const supabaseService = require('./supabase-config');
const { loadEvents } = require('./services/eventime-events');

const COMPARED_FIELDS = ['title', 'description', 'image_url', 'location'];

function _sameDate(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

function _hasChanged(existing, data) {
  return !_sameDate(existing.event_date, data.event_date)
    || COMPARED_FIELDS.some((field) => (existing[field] || '') !== (data[field] || ''));
}

/**
 * Synchronise les événements du flux avec la base.
 * Un événement déjà connu (même adresse) est mis à jour dès que sa date, son
 * lieu, son titre, son image ou sa description changent : les lignes
 * enregistrées avec une mauvaise date sont ainsi corrigées.
 *
 * @param {{supabase?: object, load?: Function}} [deps] dépendances (tests)
 */
async function extractEventsFromRSS({ supabase = supabaseService.supabase, load = loadEvents } = {}) {
  try {
    const { feedUrl, events } = await load();
    console.log(`🎉 ${events.length} événements lus depuis ${feedUrl}`);

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    const withoutDate = events.filter((event) => !event.event_date).length;

    for (const event of events) {
      const { dateSource, ...fields } = event;
      const data = { ...fields, is_active: true };
      try {
        const { data: existing, error: searchError } = await supabase
          .from('events')
          .select('id, title, description, image_url, event_date, location')
          .eq('url', event.url)
          .limit(1);
        if (searchError) throw searchError;

        if (existing && existing.length > 0) {
          if (!_hasChanged(existing[0], data)) {
            unchanged += 1;
            continue;
          }
          const { error } = await supabase
            .from('events')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', existing[0].id);
          if (error) throw error;
          updated += 1;
        } else {
          const { error } = await supabase.from('events').insert(data);
          if (error) throw error;
          inserted += 1;
        }
      } catch (error) {
        errors += 1;
        console.error(`❌ Événement « ${String(event.title).slice(0, 50)} » : ${error.message}`);
      }
    }

    console.log(`✅ Événements : ${inserted} ajoutés, ${updated} mis à jour, ${unchanged} inchangés, ${errors} erreurs, ${withoutDate} sans date`);
    return { success: errors < events.length || events.length === 0, inserted, updated, unchanged, errors, withoutDate, total: events.length };
  } catch (error) {
    console.error('❌ Synchronisation des événements impossible :', error.message);
    return { success: false, message: error.message, inserted: 0, updated: 0 };
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
