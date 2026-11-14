/**
 * Lecture du bundle rss.app au format JSON Feed (https://jsonfeed.org).
 *
 * WHY: le bundle regroupe les médias sans flux RSS direct et les pages
 * Facebook des ministères. Sa version XML ne renvoie qu'une poignée
 * d'articles ; la version JSON en renvoie 50, chacun avec son image. Les
 * éléments sont convertis vers la forme produite par le lecteur RSS, pour que
 * le reste de l'import (dédoublonnage, source, enrichissement) ne change pas.
 *
 * @example
 *   const items = await fetchBundleItems('https://rss.app/feeds/v1.1/XXXX.json');
 *   // -> [{ title, link, guid, content, contentSnippet, isoDate, creator, enclosure: { url } }]
 */

const axios = require('axios');

const REQUEST_TIMEOUT_MS = 15000;
const MAX_ITEMS = 200;

function _text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function _httpUrl(value) {
  const url = _text(value);
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol) ? url : '';
  } catch {
    return '';
  }
}

/** Vrai si l'adresse désigne la version JSON d'un flux. */
function isJsonFeedUrl(url) {
  try {
    return new URL(String(url)).pathname.toLowerCase().endsWith('.json');
  } catch {
    return false;
  }
}

/**
 * Convertit un document JSON Feed en éléments au format du lecteur RSS.
 * Les éléments sans adresse ou sans titre sont ignorés.
 */
function jsonFeedToItems(feed) {
  const rawItems = feed && Array.isArray(feed.items) ? feed.items.slice(0, MAX_ITEMS) : [];
  const items = [];

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;

    const link = _httpUrl(raw.url) || _httpUrl(raw.external_url);
    const contentText = _text(raw.content_text);
    const contentHtml = _text(raw.content_html);
    // Les publications Facebook n'ont pas de titre : on prend le début du texte
    const title = _text(raw.title) || contentText.slice(0, 120);
    if (!link || !title) continue;

    const attachments = Array.isArray(raw.attachments) ? raw.attachments : [];
    const attachedImage = attachments.find(
      (attachment) => attachment && /^image\//i.test(_text(attachment.mime_type)) && _httpUrl(attachment.url)
    );
    const image = _httpUrl(raw.image) || _httpUrl(raw.banner_image) || (attachedImage ? _httpUrl(attachedImage.url) : '');

    const authors = Array.isArray(raw.authors) ? raw.authors : (raw.author ? [raw.author] : []);
    const creator = _text(authors[0] && authors[0].name);

    const published = _text(raw.date_published) || _text(raw.date_modified);
    const isoDate = published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : undefined;

    items.push({
      title,
      link,
      guid: _text(raw.id) || link,
      content: contentHtml || contentText,
      contentSnippet: contentText,
      description: contentText,
      isoDate,
      pubDate: isoDate,
      creator: creator || undefined,
      enclosure: image ? { url: image } : undefined,
    });
  }

  return items;
}

async function _defaultGet(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: 10 * 1024 * 1024,
    headers: { 'User-Agent': 'GabonNews RSS Aggregator/1.0', Accept: 'application/json' },
    validateStatus: () => true,
  });
  return { status: response.status, data: response.data };
}

/**
 * Télécharge le bundle JSON et renvoie ses éléments.
 * @throws {Error} si le flux est injoignable, refusé ou illisible (l'appelant
 *   peut alors se rabattre sur la version XML)
 */
async function fetchBundleItems(url, deps = {}) {
  const get = deps.get || _defaultGet;
  const { status, data } = await get(url);

  if (status !== 200) {
    throw new Error(`Bundle JSON indisponible (HTTP ${status})`);
  }

  let feed = data;
  if (typeof data === 'string') {
    try {
      feed = JSON.parse(data);
    } catch {
      throw new Error('Bundle JSON illisible');
    }
  }
  if (!feed || !Array.isArray(feed.items)) {
    throw new Error('Bundle JSON sans liste d\'articles');
  }

  return jsonFeedToItems(feed);
}

// Au-delà de ce nombre d'articles d'un même site datés de la même minute, on
// considère que l'agrégateur vient de rattraper l'historique du site.
const MAX_BURST_ITEMS = 3;
const BURST_WINDOW_MS = 2 * 60 * 1000;

function _hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^(www|m)\./, '');
  } catch {
    return '';
  }
}

/**
 * Limite les rafales : quand un même site livre d'un coup plus de 3 articles
 * portant la même date à deux minutes près, seuls les 3 premiers du flux (les
 * plus récents) sont gardés.
 *
 * WHY: quand un site est ajouté au bundle, rss.app livre tout son historique
 * récent avec, comme date, l'heure de la récupération. Importés tels quels,
 * vingt vieux articles apparaissaient en tête de l'accueil comme publiés « à
 * l'instant ». Les vrais nouveaux articles arrivent ensuite un par un et ne
 * sont pas concernés. Les publications Facebook (pages distinctes sur un même
 * domaine) ne sont pas regroupées.
 */
function limitSourceBursts(items, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const maxItems = Number.isInteger(options.maxItems) && options.maxItems > 0 ? options.maxItems : MAX_BURST_ITEMS;
  const windowMs = Number.isFinite(options.windowMs) && options.windowMs > 0 ? options.windowMs : BURST_WINDOW_MS;

  const kept = [];
  const seenByHost = new Map(); // site -> dates des articles déjà gardés

  for (const item of list) {
    const host = _hostOf(item && item.link);
    const time = Date.parse((item && (item.isoDate || item.pubDate)) || '');
    if (!host || Number.isNaN(time) || host.endsWith('facebook.com')) {
      kept.push(item);
      continue;
    }

    const times = seenByHost.get(host) || [];
    const sameMoment = times.filter((other) => Math.abs(other - time) <= windowMs).length;
    if (sameMoment >= maxItems) continue; // rafale : article ignoré

    times.push(time);
    seenByHost.set(host, times);
    kept.push(item);
  }

  return kept;
}

/** Adresse XML équivalente d'un bundle rss.app (…/feeds/v1.1/ID.json -> …/feeds/ID.xml), ou null. */
function xmlFallbackUrl(jsonUrl) {
  try {
    const parsed = new URL(String(jsonUrl));
    const match = /^\/feeds\/(?:v[\d.]+\/)?([^/]+)\.json$/i.exec(parsed.pathname);
    return match ? `${parsed.origin}/feeds/${match[1]}.xml` : null;
  } catch {
    return null;
  }
}

module.exports = { isJsonFeedUrl, jsonFeedToItems, fetchBundleItems, xmlFallbackUrl, limitSourceBursts };
