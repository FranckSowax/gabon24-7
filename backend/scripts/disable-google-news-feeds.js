#!/usr/bin/env node
/**
 * Désactive les flux Google Actualités des médias désormais couverts par le
 * bundle rss.app.
 *
 * WHY: ces médias étaient suivis via Google Actualités, dont les articles
 * arrivent sans image. Ils sont maintenant dans le bundle, avec leurs images.
 * Si le flux Google reste actif, chaque article arrive deux fois (une fois avec
 * image, une fois sans).
 *
 * Par défaut, seuls les flux dont le média APPARAÎT DANS LE BUNDLE sont
 * désactivés : désactiver les autres ferait disparaître ces médias du site.
 *
 * SANS OPTION, RIEN N'EST ÉCRIT : le script affiche ce qu'il ferait.
 *
 * Usage (depuis backend/, avec les variables Supabase du serveur) :
 *   node scripts/disable-google-news-feeds.js            # simulation
 *   node scripts/disable-google-news-feeds.js --apply    # désactive les flux couverts par le bundle
 *   node scripts/disable-google-news-feeds.js --apply --all   # désactive TOUS les flux Google Actualités
 *
 * Retour arrière : repasser `status` à 'active' sur les lignes concernées de `rss_feeds`.
 */

require('dotenv').config();
const supabaseService = require('../supabase-config');
const { fetchBundleItems } = require('../services/bundle-feed');
const { isGoogleNewsUrl } = require('../services/publisher-article-resolver');

const BUNDLE_URL = process.env.RSS_BUNDLE_URL || 'https://rss.app/feeds/v1.1/_SntJgjZXkqIWrDHq.json';

// Domaine de chaque média, pour les flux dont l'adresse ne contient pas « site: ».
const DOMAIN_BY_NAME = {
  'gabon media time': 'gabonmediatime.com',
  'l union': 'union.sonapresse.com',
  'biba 241': 'biba241.com',
  'inside news 241': 'insidenews241.com',
  'sport 241': 'sport241.com',
  'gabonews': 'gabonews.com',
  'les echos de l eco': 'echosdeleco.com',
  'le touraco vert': 'letouracovert.com',
  'kongossa news': 'kongossanews.info',
  'depeches 241': 'depeches241.com',
  'vox populi': 'vxp241.com',
};

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const all = args.includes('--all');

/**
 * L'écriture exige la clé de service : avec la clé publique, les règles
 * d'accès de la base peuvent refuser une modification sans renvoyer d'erreur.
 */
function assertServiceKeyForWrite() {
  if (!apply) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Écriture impossible : la variable SUPABASE_SERVICE_ROLE_KEY est absente de cet environnement.');
    console.error('Le script tournerait avec la clé publique, que la base n\'autorise pas à modifier ces tables.');
    console.error('Lancez-le là où la clé de service est définie (variables du serveur), sans la recopier ailleurs.');
    process.exit(1);
  }
}

function normalize(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
}

/** Domaine du média suivi par un flux Google Actualités (critère « site: », sinon nom du flux). */
function publisherDomain(feed) {
  try {
    const query = new URL(feed.url).searchParams.get('q') || '';
    const match = /site:([a-z0-9.-]+\.[a-z]{2,})/i.exec(query);
    if (match) return match[1].toLowerCase().replace(/^www\./, '');
  } catch {
    // adresse illisible : on se rabat sur le nom
  }
  return DOMAIN_BY_NAME[normalize(feed.name)] || null;
}

async function main() {
  assertServiceKeyForWrite();
  const supabase = supabaseService.supabase;
  console.log(`Mode : ${apply ? (all ? 'ÉCRITURE — tous les flux Google Actualités' : 'ÉCRITURE — flux couverts par le bundle') : 'simulation (aucune écriture)'}\n`);

  let bundleHosts = new Set();
  try {
    const items = await fetchBundleItems(BUNDLE_URL);
    bundleHosts = new Set(items.map((item) => hostOf(item.link)).filter(Boolean));
    console.log(`Bundle lu : ${items.length} article(s), ${bundleHosts.size} site(s) : ${[...bundleHosts].join(', ')}\n`);
  } catch (error) {
    console.error(`Bundle illisible (${error.message}).`);
    if (!all) {
      console.error('Impossible de savoir quels médias il couvre : rien ne sera désactivé. Relancez plus tard, ou utilisez --all en connaissance de cause.');
      process.exit(1);
    }
  }

  const { data: feeds, error } = await supabase.from('rss_feeds').select('id, name, url, status').order('name');
  if (error) {
    console.error('Lecture des flux impossible :', error.message);
    process.exit(1);
  }

  const googleFeeds = (feeds || []).filter((feed) => isGoogleNewsUrl(feed.url));
  console.log(`${(feeds || []).length} flux en base, dont ${googleFeeds.length} via Google Actualités.\n`);

  const stats = { disabled: 0, already: 0, keptUncovered: 0, failed: 0 };

  for (const feed of googleFeeds) {
    const domain = publisherDomain(feed);
    const covered = Boolean(domain) && [...bundleHosts].some((host) => host === domain || host.endsWith(`.${domain}`));
    const label = `${String(feed.name).padEnd(40).slice(0, 40)} ${String(domain || 'domaine inconnu').padEnd(24)}`;

    if (feed.status === 'inactive') {
      stats.already += 1;
      console.log(`  déjà inactif        ${label}`);
      continue;
    }
    if (!covered && !all) {
      stats.keptUncovered += 1;
      console.log(`  CONSERVÉ (absent du bundle)  ${label}`);
      continue;
    }

    if (apply) {
      // `.select()` renvoie les lignes réellement modifiées : sans droit
      // d'écriture, la base ne renvoie pas d'erreur mais ne modifie rien.
      const { data: updated, error: updateError } = await supabase
        .from('rss_feeds')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('id', feed.id)
        .select('id');
      if (updateError || !updated || updated.length === 0) {
        stats.failed += 1;
        console.log(`  ÉCHEC               ${label} — ${updateError ? updateError.message : 'aucune ligne modifiée (droits insuffisants)'}`);
        continue;
      }
    }
    stats.disabled += 1;
    console.log(`  ${apply ? 'désactivé' : 'à désactiver'}${covered ? '' : ' (absent du bundle)'}  ${label}`);
  }

  console.log(`\nBilan : ${stats.disabled} flux ${apply ? 'désactivé(s)' : 'à désactiver'}, ${stats.already} déjà inactif(s), ${stats.keptUncovered} conservé(s) car absent(s) du bundle, ${stats.failed} échec(s).`);
  if (stats.keptUncovered > 0) {
    console.log('Les médias conservés ne sont pas dans le bundle : les désactiver les ferait disparaître du site. Ajoutez-les au bundle, puis relancez.');
  }
  if (!apply) console.log('Simulation : rien n\'a été écrit. Relancez avec --apply pour enregistrer.');
}

main().catch((error) => {
  console.error('Erreur :', error.message);
  process.exit(1);
});
