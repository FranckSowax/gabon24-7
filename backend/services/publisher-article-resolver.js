/**
 * Retrouve l'article d'origine (adresse et image) d'un élément de flux
 * Google Actualités, en interrogeant le site du média lui-même.
 *
 * WHY: plusieurs médias gabonais n'ont pas de flux RSS exploitable et sont
 * suivis via Google Actualités. Le lien fourni par ce flux mène à une page de
 * redirection de Google, pas à l'article : l'image qu'on y trouve est le logo
 * de Google Actualités, ou rien. Résultat sur l'accueil : des articles sans
 * image, et d'autres avec le même logo Google.
 *
 * Deux moyens, dans l'ordre, tous deux publics et côté média :
 *   1. l'API de recherche des sites WordPress (/wp-json/wp/v2/posts?search=) ;
 *   2. le flux RSS du média (/rss.xml, /feed/), comparé par titre.
 * Aucun appel aux interfaces internes de Google.
 *
 * @example
 *   const original = await resolvePublisherArticle({
 *     title: 'Libreville : cinq nouveaux axes ciblés - Gabon Media Time',
 *     publisherUrl: 'https://gabonmediatime.com',
 *     sourceName: 'Gabon Media Time',
 *   });
 *   // -> { url: 'https://gabonmediatime.com/libreville-...', imageUrl: null } ou null
 */

const axios = require('axios');
const { assertPublicUrl, safeRequestOptions } = require('../utils/ssrf-guard');

const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GabonInsightBot/1.0; +https://gaboninsight.com)';
const FEED_PATHS = ['/rss.xml', '/feed/'];

// Mémoire des résultats : l'import repasse sur les mêmes articles toutes les
// 15 minutes, on n'interroge donc chaque média qu'une fois par article.
const HIT_TTL_MS = 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 2 * 60 * 60 * 1000;
const ENDPOINT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 5000;

const resultCache = new Map();
const endpointCache = new Map();

/** Vrai pour un lien d'article Google Actualités (page de redirection). */
function isGoogleNewsUrl(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase() === 'news.google.com';
  } catch {
    return false;
  }
}

/** Vrai pour l'image générique que Google Actualités sert à la place de celle de l'article. */
function isGoogleNewsPlaceholderImage(url) {
  try {
    const host = new URL(String(url)).hostname.toLowerCase();
    return host === 'news.google.com' || /^lh\d+\.googleusercontent\.com$/.test(host);
  } catch {
    return false;
  }
}

function _decodeEntities(text) {
  return String(text || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&rsquo;|&lsquo;/gi, '\'')
    .replace(/&hellip;/gi, '...')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/** Titre réduit à ses lettres et chiffres, pour comparer deux écritures du même titre. */
function normalizeTitle(title) {
  return _decodeEntities(title)
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Retire le suffixe « - Nom du média » que Google Actualités ajoute aux titres. */
function stripPublisherSuffix(title, sourceName) {
  let raw = String(title || '').trim();
  // Certains médias ajoutent eux-mêmes leur nom après une barre verticale :
  // « Titre | Lunion.ga | Actualités Gabon - L'Union ». Le titre est avant.
  const pipe = raw.indexOf(' | ');
  if (pipe >= 15) raw = raw.slice(0, pipe).trim();
  if (sourceName) {
    const suffix = ` - ${sourceName}`;
    if (raw.toLowerCase().endsWith(suffix.toLowerCase())) return raw.slice(0, -suffix.length).trim();
  }
  const index = raw.lastIndexOf(' - ');
  // Sans nom de média connu, on ne coupe que si la fin ressemble à un nom court.
  if (index > 20 && raw.length - index <= 45) return raw.slice(0, index).trim();
  return raw;
}

/** Deux titres désignent-ils le même article ? */
function titlesMatch(a, b) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;
  // Un des deux peut être tronqué : on exige alors un long début commun.
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.length >= 25 && longer.startsWith(shorter);
}

/** Adresse du site du média, validée (publique, http/https), ou null. */
function publisherOrigin(publisherUrl) {
  try {
    const withProtocol = /^https?:\/\//i.test(String(publisherUrl)) ? String(publisherUrl) : `https://${publisherUrl}`;
    const parsed = assertPublicUrl(withProtocol);
    if (isGoogleNewsUrl(parsed.href) || parsed.hostname.toLowerCase().endsWith('.google.com')) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Adresse du média pour un élément de flux : balise <source url="..."> de
 * l'élément, sinon le critère « site: » de l'adresse du flux Google Actualités.
 */
function publisherUrlFromFeedItem(item, feedUrl) {
  const source = item && (item.gnSource || item.source);
  const fromItem = source && typeof source === 'object' ? (source.$ && source.$.url) || source.url : null;
  if (fromItem) return fromItem;
  try {
    const query = new URL(String(feedUrl)).searchParams.get('q') || '';
    const match = /site:([a-z0-9.-]+\.[a-z]{2,})/i.exec(query);
    return match ? `https://${match[1]}` : null;
  } catch {
    return null;
  }
}

async function _defaultGet(url, { accept } = {}) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxRedirects: 3,
    maxContentLength: 3 * 1024 * 1024,
    responseType: 'text',
    transformResponse: [(data) => data],
    validateStatus: () => true,
    headers: { 'User-Agent': USER_AGENT, Accept: accept || '*/*' },
    ...safeRequestOptions(),
  });
  return { status: response.status, body: typeof response.data === 'string' ? response.data : '' };
}

function _endpointState(origin) {
  const cached = endpointCache.get(origin);
  if (cached && Date.now() - cached.checkedAt < ENDPOINT_TTL_MS) return cached;
  const fresh = { checkedAt: Date.now(), wordpress: undefined, feedPath: undefined };
  endpointCache.set(origin, fresh);
  return fresh;
}

function _sameSite(url, origin) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    const expected = new URL(origin).hostname.toLowerCase().replace(/^www\./, '');
    return host === expected || host.endsWith(`.${expected}`);
  } catch {
    return false;
  }
}

async function _searchWordPress(origin, title, get) {
  const state = _endpointState(origin);
  if (state.wordpress === false) return null;

  const query = encodeURIComponent(title.slice(0, 120));
  const url = `${origin}/wp-json/wp/v2/posts?search=${query}&per_page=5&_fields=link,title,jetpack_featured_media_url`;
  const { status, body } = await get(url, { accept: 'application/json' });

  let posts;
  try {
    posts = JSON.parse(body);
  } catch {
    posts = null;
  }
  if (status !== 200 || !Array.isArray(posts)) {
    state.wordpress = false; // pas un site WordPress, ou API fermée
    return null;
  }
  state.wordpress = true;

  for (const post of posts) {
    const postTitle = post && post.title && (post.title.rendered || post.title);
    if (post && typeof post.link === 'string' && titlesMatch(postTitle, title) && _sameSite(post.link, origin)) {
      const image = typeof post.jetpack_featured_media_url === 'string' ? post.jetpack_featured_media_url : '';
      return { url: post.link, imageUrl: /^https?:\/\//i.test(image) ? image : null };
    }
  }
  return null;
}

function _parseFeedItems(xml) {
  const items = [];
  const pattern = /<item\b[\s\S]*?<\/item>/gi;
  let match;
  while ((match = pattern.exec(xml)) && items.length < 100) {
    const block = match[0];
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(block);
    const link = /<link\b[^>]*>([\s\S]*?)<\/link>/i.exec(block);
    if (title && link) {
      items.push({ title: _decodeEntities(title[1]).trim(), link: _decodeEntities(link[1]).trim() });
    }
  }
  return items;
}

async function _searchFeed(origin, title, get) {
  const state = _endpointState(origin);
  if (state.feedPath === null) return null;

  const paths = state.feedPath ? [state.feedPath] : FEED_PATHS;
  for (const path of paths) {
    const { status, body } = await get(`${origin}${path}`, { accept: 'application/rss+xml, application/xml, text/xml' });
    if (status !== 200 || !/<item\b/i.test(body)) continue;

    state.feedPath = path;
    const found = _parseFeedItems(body).find((item) => titlesMatch(item.title, title) && _sameSite(item.link, origin));
    return found ? { url: found.link, imageUrl: null } : null;
  }
  state.feedPath = null; // aucun flux exploitable sur ce site
  return null;
}

function _remember(key, value) {
  if (!key) return;
  if (resultCache.size >= MAX_CACHE_ENTRIES) {
    resultCache.delete(resultCache.keys().next().value);
  }
  resultCache.set(key, { value, expiresAt: Date.now() + (value ? HIT_TTL_MS : MISS_TTL_MS) });
}

/**
 * Cherche l'article d'origine sur le site du média. Ne lève jamais : renvoie
 * `{ url, imageUrl }` ou `null` (site injoignable, article introuvable).
 *
 * @param {{ title: string, publisherUrl: string, sourceName?: string, cacheKey?: string }} params
 * @param {{ get?: Function }} [deps] client HTTP injectable pour les tests
 */
async function resolvePublisherArticle({ title, publisherUrl, sourceName, cacheKey } = {}, deps = {}) {
  const get = deps.get || _defaultGet;
  const origin = publisherOrigin(publisherUrl);
  const cleanTitle = stripPublisherSuffix(title, sourceName);
  if (!origin || normalizeTitle(cleanTitle).length < 10) return null;

  const key = cacheKey || `${origin}|${normalizeTitle(cleanTitle)}`;
  const cached = resultCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let result = null;
  for (const search of [_searchWordPress, _searchFeed]) {
    try {
      result = await search(origin, cleanTitle, get);
    } catch (error) {
      result = null; // site lent ou injoignable : on essaie le moyen suivant
    }
    if (result) break;
  }

  _remember(key, result);
  return result;
}

/** Vide les mémoires (tests). */
function _resetCaches() {
  resultCache.clear();
  endpointCache.clear();
}

module.exports = {
  isGoogleNewsUrl,
  isGoogleNewsPlaceholderImage,
  normalizeTitle,
  stripPublisherSuffix,
  titlesMatch,
  publisherOrigin,
  publisherUrlFromFeedItem,
  resolvePublisherArticle,
  _resetCaches,
};
