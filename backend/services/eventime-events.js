/**
 * Événements à venir : lecture du flux RSS Eventime et reconstruction de la
 * date et du lieu de chaque événement.
 *
 * WHY: le flux RSS ne donne ni la date de l'événement (pas même de date de
 * publication) ni son lieu, seulement un résumé tronqué. La page de chaque
 * événement sur eventime.ga contient en revanche un balisage schema.org
 * `Event` (startDate, endDate, location). On lit donc cette page ; si elle ne
 * répond pas, on cherche la date et le lieu dans le texte du résumé.
 *
 * @example
 *   const { loadEvents } = require('./services/eventime-events');
 *   const { events } = await loadEvents();
 */

const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');

const DEFAULT_EVENTS_RSS_URL = 'https://rss.app/feeds/kshgXqmChHpaDaU3.xml';
// Seules les pages de ce site sont lues (le flux pourrait contenir d'autres liens).
const ALLOWED_PAGE_HOSTS = new Set(['www.eventime.ga', 'eventime.ga']);
const REQUEST_TIMEOUT_MS = 10000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_PARALLEL_PAGES = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; GabonInsightBot/1.0; +https://gaboninsight.com)';
// Heure de Libreville (UTC+1, sans heure d'été).
const LIBREVILLE_OFFSET = '+01:00';

const MONTHS = {
  janvier: 1, janv: 1, jan: 1,
  fevrier: 2, fevr: 2, fev: 2,
  mars: 3, mar: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  decembre: 12, dec: 12,
};

function getEventsFeedUrl(env = process.env) {
  return env.EVENTS_RSS_URL || DEFAULT_EVENTS_RSS_URL;
}

function _stripAccents(value) {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Texte brut d'un fragment HTML (balises retirées, entités décodées, espaces réduits). */
function htmlToText(html) {
  if (!html) return '';
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  $('br').replaceWith('\n');
  return $('#root').text().replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function _first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function _attr(node, name) {
  if (!node) return null;
  if (typeof node === 'string') return null;
  return (node.$ && node.$[name]) || node[name] || null;
}

/**
 * Lit le XML du flux et renvoie ses éléments.
 * @returns {Promise<Array<{title: string, link: string, guid: string, descriptionHtml: string, image: string|null}>>}
 */
async function parseFeed(xml) {
  const parsed = await new xml2js.Parser({ explicitArray: true }).parseStringPromise(xml);
  const items = parsed?.rss?.channel?.[0]?.item || [];
  return items.map((item) => {
    const descriptionHtml = String(_first(item.description) || '');
    const media = _first(item['media:content']) || _first(item['media:thumbnail']) || _first(item.enclosure);
    const imgInDescription = descriptionHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    const guid = _first(item.guid);
    return {
      title: String(_first(item.title) || '').trim(),
      link: String(_first(item.link) || '').trim(),
      guid: String(typeof guid === 'object' && guid ? guid._ || '' : guid || '').trim(),
      descriptionHtml,
      image: _attr(media, 'url') || (imgInDescription ? imgInDescription[1] : null),
    };
  });
}

/** Renvoie le premier objet schema.org de type Event trouvé dans la page, ou null. */
function extractJsonLdEvent(html) {
  if (!html) return null;
  const $ = cheerio.load(html);
  const candidates = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const data = JSON.parse($(element).contents().text());
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const node = stack.shift();
        if (!node || typeof node !== 'object') continue;
        if (Array.isArray(node['@graph'])) stack.push(...node['@graph']);
        const types = [].concat(node['@type'] || []).map(String);
        if (types.some((type) => /Event$/.test(type))) candidates.push(node);
      }
    } catch {
      // Balisage mal formé : ignoré, on garde les autres blocs.
    }
  });
  const event = candidates[0];
  if (!event) return null;

  const location = [].concat(event.location || [])[0];
  let locationName = null;
  let address = null;
  if (typeof location === 'string') {
    locationName = location;
  } else if (location && typeof location === 'object') {
    locationName = location.name || null;
    const rawAddress = location.address;
    if (typeof rawAddress === 'string') address = rawAddress;
    else if (rawAddress && typeof rawAddress === 'object') {
      address = [rawAddress.streetAddress, rawAddress.addressLocality].filter(Boolean).join(', ') || null;
    }
  }

  return {
    name: event.name || null,
    description: typeof event.description === 'string' ? event.description : null,
    startDate: event.startDate || null,
    endDate: event.endDate || null,
    locationName,
    address,
    image: [].concat(event.image || [])[0] || null,
  };
}

function _toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function _pad(number) {
  return String(number).padStart(2, '0');
}

/**
 * Cherche une date d'événement écrite en français dans un texte
 * (« Mer. 18 novembre 2026, 14h30 », « Du 18 au 21 novembre »,
 * « 18 Nov. 2026 16:30 »…). Sans année, prend la prochaine occurrence
 * (une date de plus de 60 jours dans le passé passe à l'année suivante).
 * Sans heure, l'événement est daté de minuit, heure de Libreville.
 *
 * @returns {string|null} date ISO (UTC)
 */
function parseFrenchDate(text, now = new Date()) {
  if (!text) return null;
  const source = _stripAccents(text).toLowerCase();
  const pattern = /\b(\d{1,2})(?:er)?(?:\s*(?:au|-|et)\s*\d{1,2}(?:er)?)?\s+([a-z]{3,9})\.?(?:\s+(\d{4}))?(?:[^\d\n]{0,12}?(\d{1,2})\s*(?:h|:)\s*(\d{2})?)?/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const [, dayText, monthText, yearText, hourText, minuteText] = match;
    const month = MONTHS[monthText];
    const day = Number(dayText);
    if (!month || day < 1 || day > 31) continue;
    const hour = hourText !== undefined ? Number(hourText) : 0;
    const minute = minuteText !== undefined ? Number(minuteText) : 0;
    if (hour > 23 || minute > 59) continue;

    let year = yearText ? Number(yearText) : now.getUTCFullYear();
    // Jour inexistant (31 février…) : le calendrier le décalerait, on l'écarte.
    const calendarDay = new Date(Date.UTC(year, month - 1, day));
    if (calendarDay.getUTCMonth() !== month - 1 || calendarDay.getUTCDate() !== day) continue;
    const build = (y) => new Date(`${y}-${_pad(month)}-${_pad(day)}T${_pad(hour)}:${_pad(minute)}:00${LIBREVILLE_OFFSET}`);
    let date = build(year);
    if (Number.isNaN(date.getTime())) continue;
    if (!yearText && now.getTime() - date.getTime() > 60 * 24 * 60 * 60 * 1000) {
      year += 1;
      date = build(year);
    }
    return date.toISOString();
  }
  return null;
}

/** Lieu écrit dans un texte (« 📍 Institut français », « Lieu : … »), ou null. */
function parseLocationFromText(text) {
  if (!text) return null;
  const match = String(text).match(/(?:📍|Lieu\s*:|Adresse\s*:|Où\s*\?\s*)\s*([^\n|]{3,120})/i);
  return match ? match[1].trim().replace(/[.…]+$/, '') : null;
}

function _cleanText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Assemble l'événement à enregistrer à partir de l'élément du flux et, si elle
 * a pu être lue, des données de sa page.
 */
function buildEvent(item, pageEvent, now = new Date()) {
  const summary = htmlToText(item.descriptionHtml);
  const fullDescription = pageEvent?.description ? pageEvent.description.trim() : summary;
  const textForDates = `${item.title}\n${fullDescription}`;

  const fromPage = _toIso(pageEvent?.startDate);
  const eventDate = fromPage || parseFrenchDate(textForDates, now);

  let location = null;
  if (pageEvent?.locationName) {
    location = pageEvent.locationName;
    if (pageEvent.address && !pageEvent.address.toLowerCase().includes(pageEvent.locationName.toLowerCase())) {
      location = `${pageEvent.locationName}, ${pageEvent.address}`;
    }
  } else if (pageEvent?.address) {
    location = pageEvent.address;
  } else {
    location = parseLocationFromText(fullDescription);
  }

  return {
    // Le titre de la page est souvent plus complet (« Festival … : nom du film »).
    title: _cleanText(
      pageEvent?.name && pageEvent.name.trim().length > item.title.trim().length ? pageEvent.name : item.title,
      300,
    ),
    description: _cleanText(fullDescription, 2000),
    url: item.link,
    image_url: item.image || pageEvent?.image || null,
    event_date: eventDate,
    location: location ? _cleanText(location, 255) : null,
    category: 'Événement',
    organizer: 'Eventime.ga',
    dateSource: fromPage ? 'page' : eventDate ? 'texte' : 'aucune',
  };
}

function _isAllowedPage(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_PAGE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

async function _defaultGet(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: MAX_PAGE_BYTES,
    responseType: 'text',
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
  });
  return response.data;
}

async function _mapLimited(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Lit le flux, puis la page de chaque événement, et renvoie les événements
 * prêts à enregistrer (sans doublon d'adresse).
 *
 * @param {{feedUrl?: string, get?: (url: string) => Promise<string>, now?: Date}} [options]
 */
async function loadEvents({ feedUrl = getEventsFeedUrl(), get = _defaultGet, now = new Date() } = {}) {
  const items = (await parseFeed(await get(feedUrl))).filter((item) => item.title && item.link);

  const seen = new Set();
  const unique = items.filter((item) => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  const events = await _mapLimited(unique, MAX_PARALLEL_PAGES, async (item) => {
    let pageEvent = null;
    if (_isAllowedPage(item.link)) {
      try {
        pageEvent = extractJsonLdEvent(await get(item.link));
      } catch (error) {
        console.warn(`⚠️ Page d'événement illisible (${item.link}) : ${error.message}`);
      }
    }
    return buildEvent(item, pageEvent, now);
  });

  return { feedUrl, events };
}

module.exports = {
  loadEvents,
  parseFeed,
  extractJsonLdEvent,
  parseFrenchDate,
  parseLocationFromText,
  buildEvent,
  htmlToText,
  getEventsFeedUrl,
  DEFAULT_EVENTS_RSS_URL,
};
