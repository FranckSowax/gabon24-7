#!/usr/bin/env node
/**
 * Rattrapage des images des articles venus de Google Actualités.
 *
 * WHY: ces articles ont été enregistrés avec le lien de redirection de Google.
 * L'image récupérée à cette adresse est absente, ou c'est le logo de Google
 * Actualités. L'import est corrigé pour les nouveaux articles ; ce script
 * corrige ceux déjà en base : il retrouve l'article chez le média, y lit
 * l'image, puis met à jour `image_urls` et `url`.
 *
 * SANS OPTION, RIEN N'EST ÉCRIT : le script affiche ce qu'il ferait.
 *
 * Usage (depuis backend/, avec les variables Supabase du serveur) :
 *   node scripts/backfill-article-images.js              # simulation
 *   node scripts/backfill-article-images.js --apply      # écrit en base
 * Options :
 *   --days=N    articles des N derniers jours (défaut 7)
 *   --limit=N   nombre maximum d'articles examinés (défaut 300)
 */

require('dotenv').config();
const supabaseService = require('../supabase-config');
const { imageExtractor } = require('../services/image-extractor');
const {
  isGoogleNewsUrl,
  isGoogleNewsPlaceholderImage,
  publisherUrlFromFeedItem,
  resolvePublisherArticle,
} = require('../services/publisher-article-resolver');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const numberArg = (name, fallback) => {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`));
  const value = raw ? parseInt(raw.split('=')[1], 10) : NaN;
  return Number.isInteger(value) && value > 0 ? value : fallback;
};
const days = numberArg('days', 7);
const limit = numberArg('limit', 300);

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

/** Un article est à corriger s'il n'a pas d'image, ou seulement le logo de Google Actualités. */
function needsImage(article) {
  const images = Array.isArray(article.image_urls) ? article.image_urls.filter(Boolean) : [];
  return images.length === 0 || images.every((url) => isGoogleNewsPlaceholderImage(url));
}

async function main() {
  assertServiceKeyForWrite();
  const supabase = supabaseService.supabase;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  console.log(`Mode : ${apply ? 'ÉCRITURE en base' : 'simulation (aucune écriture)'} — ${days} jour(s), ${limit} article(s) maximum`);

  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, url, image_urls, feed_id, published_at, rss_feeds(name, url)')
    .like('url', 'https://news.google.com/%')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Lecture des articles impossible :', error.message);
    process.exit(1);
  }

  const candidates = (articles || []).filter((article) => isGoogleNewsUrl(article.url) && needsImage(article));
  console.log(`${(articles || []).length} article(s) Google Actualités lus, ${candidates.length} sans image valable.\n`);

  const stats = { fixed: 0, linkOnly: 0, notFound: 0, failed: 0 };

  for (const article of candidates) {
    const feed = article.rss_feeds || {};
    const label = `${(feed.name || '?').padEnd(22).slice(0, 22)} ${String(article.title || '').slice(0, 60)}`;

    const original = await resolvePublisherArticle({
      title: article.title,
      publisherUrl: publisherUrlFromFeedItem(null, feed.url),
      sourceName: feed.name,
      cacheKey: `backfill-${article.id}`,
    });

    if (!original) {
      stats.notFound += 1;
      console.log(`  introuvable   ${label}`);
      continue;
    }

    let imageUrl = original.imageUrl;
    if (!imageUrl) {
      try {
        const extracted = await imageExtractor.extractImage(original.url, { source: feed.name });
        imageUrl = extracted && extracted.imageUrl ? extracted.imageUrl : null;
      } catch (extractError) {
        imageUrl = null;
      }
    }

    const update = { url: original.url, updated_at: new Date().toISOString() };
    if (imageUrl) update.image_urls = [imageUrl];

    if (apply) {
      // `.select()` renvoie les lignes réellement modifiées : sans droit
      // d'écriture, la base ne renvoie pas d'erreur mais ne modifie rien.
      const { data: updated, error: updateError } = await supabase
        .from('articles')
        .update(update)
        .eq('id', article.id)
        .select('id');
      if (updateError || !updated || updated.length === 0) {
        stats.failed += 1;
        console.log(`  ÉCHEC         ${label} — ${updateError ? updateError.message : 'aucune ligne modifiée (droits insuffisants)'}`);
        continue;
      }
    }

    if (imageUrl) {
      stats.fixed += 1;
      console.log(`  image         ${label}`);
    } else {
      stats.linkOnly += 1;
      console.log(`  lien seul     ${label}`);
    }
  }

  console.log(`\nBilan : ${stats.fixed} image(s) trouvée(s), ${stats.linkOnly} lien(s) corrigé(s) sans image, ${stats.notFound} introuvable(s), ${stats.failed} échec(s).`);
  if (!apply) console.log('Simulation : rien n\'a été écrit. Relancez avec --apply pour enregistrer.');
}

main().catch((error) => {
  console.error('Erreur :', error.message);
  process.exit(1);
});
