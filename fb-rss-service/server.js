/**
 * fb-rss-service — Microservice de génération RSS depuis pages Facebook publiques
 *
 * Stratégie : scrape mbasic.facebook.com (version mobile HTML légère)
 * avec un cookie de session FB fourni via env var.
 *
 * Routes :
 *   GET /             → health check
 *   GET /feed/:slug   → RSS XML des derniers posts de la page Facebook <slug>
 *
 * Cache mémoire 1h par slug pour limiter le rate sur Facebook.
 */

const express = require('express');
const cheerio = require('cheerio');

const PORT = process.env.PORT || 3000;
const FB_COOKIE = process.env.FB_COOKIE || '';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 60 * 60 * 1000); // 1h
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS || 15000);
const USER_AGENT = process.env.USER_AGENT ||
  'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36';

if (!FB_COOKIE) {
  console.warn('⚠️  FB_COOKIE non configuré — les requêtes Facebook seront probablement bloquées');
}

const cache = new Map(); // slug -> { xml, expiresAt }

const app = express();

app.get('/', (_, res) => {
  res.json({
    service: 'fb-rss-service',
    status: 'ok',
    cookie_configured: !!FB_COOKIE,
    cache_size: cache.size,
    cache_ttl_minutes: CACHE_TTL_MS / 60000,
  });
});

app.get('/feed/:slug', async (req, res) => {
  const slug = req.params.slug.replace(/[^A-Za-z0-9._-]/g, '');
  if (!slug) {
    return res.status(400).json({ error: 'slug invalide' });
  }

  // Cache
  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('X-Cache', 'HIT');
    return res.send(cached.xml);
  }

  try {
    const xml = await buildFeedFromFacebook(slug);
    cache.set(slug, { xml, expiresAt: Date.now() + CACHE_TTL_MS });
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('X-Cache', 'MISS');
    res.send(xml);
  } catch (err) {
    console.error(`❌ /feed/${slug}:`, err.message);
    res.status(502).json({ error: err.message, slug });
  }
});

async function buildFeedFromFacebook(slug) {
  const url = `https://mbasic.facebook.com/${slug}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html;
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cookie': FB_COOKIE,
      },
      redirect: 'follow',
    });
    if (!resp.ok) {
      throw new Error(`Facebook a renvoyé HTTP ${resp.status}`);
    }
    html = await resp.text();
  } finally {
    clearTimeout(t);
  }

  // Détection page de login (cookies invalides / expirés)
  if (/<title[^>]*>(Connexion|Log in to Facebook)/i.test(html) || /name="login"/i.test(html)) {
    throw new Error('Facebook a renvoyé une page de login (cookie expiré ou invalide)');
  }

  const $ = cheerio.load(html);

  const pageTitle = $('title').first().text().replace(' | Facebook', '').trim() || slug;
  const pageUrl = `https://www.facebook.com/${slug}`;

  // mbasic structure les posts dans des conteneurs avec data-ft, data-actorid, ou role=article
  // On essaie plusieurs sélecteurs et on déduplique par URL/contenu.
  const items = [];
  const seen = new Set();

  $('div[role="article"], article, div[data-ft], div[data-actorid]').each((_, el) => {
    const $el = $(el);

    // Texte du post (premier paragraphe non vide)
    let text = '';
    $el.find('p, div').each((__, p) => {
      const t = $(p).text().trim();
      if (t.length > 30 && t.length > text.length) text = t;
    });
    if (!text) text = $el.text().trim();
    if (!text || text.length < 20) return;

    // Lien vers le post
    const link = $el.find('a[href*="/story.php"], a[href*="/permalink"], a[href*="/posts/"]')
      .first().attr('href');
    const fullLink = link
      ? (link.startsWith('http') ? link : `https://mbasic.facebook.com${link}`)
      : pageUrl;

    // Image éventuelle (preview ou img du post)
    const img = $el.find('img[src*="scontent"], img[src*="fbcdn"]').first().attr('src');

    // Dedup
    const key = fullLink + '|' + text.slice(0, 60);
    if (seen.has(key)) return;
    seen.add(key);

    items.push({
      title: text.slice(0, 120) + (text.length > 120 ? '…' : ''),
      description: img ? `<img src="${escapeXml(img)}" /><br/>${escapeXml(text)}` : escapeXml(text),
      link: fullLink,
      pubDate: new Date().toUTCString(), // mbasic ne fournit pas toujours de date exploitable
    });
  });

  if (items.length === 0) {
    throw new Error('Aucun post trouvé sur cette page (DOM Facebook a peut-être changé, ou page vide/restreinte)');
  }

  // Limite à 20 posts max
  const finalItems = items.slice(0, 20);

  // Génère RSS 2.0
  const itemsXml = finalItems.map(it => `
    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <guid isPermaLink="false">${escapeXml(it.link)}#${hash(it.title)}</guid>
      <pubDate>${it.pubDate}</pubDate>
      <description><![CDATA[${it.description}]]></description>
    </item>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(pageTitle)}</title>
    <link>${escapeXml(pageUrl)}</link>
    <description>Flux RSS auto-généré depuis ${escapeXml(pageTitle)}</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${itemsXml}
  </channel>
</rss>`;
}

function escapeXml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

app.listen(PORT, () => {
  console.log(`🟢 fb-rss-service en écoute sur le port ${PORT}`);
  console.log(`   FB_COOKIE configuré: ${!!FB_COOKIE}`);
  console.log(`   Cache TTL: ${CACHE_TTL_MS / 60000} min`);
});

process.on('uncaughtException', (err) => {
  console.error('❌ uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ unhandledRejection:', reason);
});
