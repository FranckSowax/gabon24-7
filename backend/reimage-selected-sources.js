/**
 * 🖼️ Ré-enrichissement d'images pour sources spécifiques
 * Cible: Gabon Actu (gabonactu.com), L'Union (lunion.ga / lunion.sonapresse.com), Sport241 (sport241.com)
 *
 * Utilise la logique de scraping de rss-aggregator.js (scrapeImage) pour retrouver l'image principale
 * et met à jour la colonne image_url dans la table articles.
 *
 * IMPORTANT: Exécuter avec SUPABASE_SERVICE_ROLE_KEY défini pour contourner la RLS.
 * Exemple: SUPABASE_SERVICE_ROLE_KEY="<clé>" node reimage-selected-sources.js
 */

require('dotenv').config();
const supabaseService = require('./supabase-config');
const RSSAggregator = require('./rss-aggregator');

const aggregator = new RSSAggregator();

async function main() {
  console.log('🔄 Démarrage ré-enrichissement images (GabonActu, L\'Union, Sport241)');

  const patterns = [
    'gabonactu.com',
    'lunion.ga',
    'lunion.sonapresse.com',
    'sonapresse.com',
    'sport241.com',
    'fr.infosgabon.com'
  ];

  try {
    // 1) Récupération des articles candidats par domaines (union des résultats)
    const articlesMap = new Map();

    for (const pattern of patterns) {
      const { data, error } = await supabaseService.supabase
        .from('articles')
        .select('id, title, url, image_url')
        .ilike('url', `%${pattern}%`)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error(`❌ Erreur récupération articles pour pattern ${pattern}:`, error.message);
        continue;
      }

      (data || []).forEach(a => {
        // Dédupliquer par id
        if (!articlesMap.has(a.id)) {
          articlesMap.set(a.id, a);
        }
      });
    }

    const articles = Array.from(articlesMap.values());
    console.log(`📊 ${articles.length} articles candidats à analyser`);

    // 2) Filtrer ceux nécessitant une correction
    const needsFix = articles.filter(a => {
      const u = a.image_url || '';
      const isPlaceholder = typeof u === 'string' && (
        u.includes('facebook.com/images/default') ||
        u.includes('/safe_image.php') ||
        u.includes('/.netlify/functions/') ||
        u.includes('localhost:3002') ||
        u.startsWith('data:image') ||
        u.trim() === ''
      );
      const isMissing = !u || u === null;
      return isMissing || isPlaceholder;
    });

    console.log(`🛠️ ${needsFix.length} articles à corriger (image manquante/placeholder/ancien proxy)`);

    let checked = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    // 3) Traiter séquentiellement (plus simple et sûr)
    for (const a of needsFix) {
      checked++;
      try {
        const newImage = await aggregator.scrapeImage(a.url);
        if (newImage && typeof newImage === 'string') {
          const { error: upErr } = await supabaseService.supabase
            .from('articles')
            .update({ image_url: newImage })
            .eq('id', a.id);
          if (upErr) {
            failed++;
            if (failed <= 5) console.error('⚠️ Échec update image:', a.id, upErr.message);
          } else {
            updated++;
            if (updated <= 10) {
              console.log(`✅ MAJ: ${a.title?.substring(0, 60) || a.id}...`);
              console.log(`   → ${newImage.substring(0, 120)}...`);
            }
          }
        } else {
          skipped++;
          if (skipped <= 5) console.log('ℹ️ Impossible de trouver une image:', a.url);
        }
      } catch (e) {
        failed++;
        if (failed <= 5) console.error('❌ Erreur scraping:', a.url, e.message);
      }
    }

    console.log('\n📈 RÉSULTATS');
    console.log(`  Contrôlés: ${checked}`);
    console.log(`  Mis à jour: ${updated}`);
    console.log(`  Ignorés: ${skipped}`);
    console.log(`  Échecs: ${failed}`);

  } catch (e) {
    console.error('❌ Erreur générale:', e.message);
  }

  process.exit(0);
}

main();
