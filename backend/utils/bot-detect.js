/**
 * Reconnaît les robots (moteurs de recherche, aperçus de liens, outils) d'après
 * l'en-tête User-Agent.
 *
 * WHY: la page d'un article compte une vue dès qu'elle s'affiche. Depuis
 * qu'elle est rendue par le serveur pour le référencement, les robots qui
 * l'indexent étaient comptés comme des lecteurs (une vue par article), ce qui
 * faussait le classement « Tendances ».
 *
 * @example
 *   if (isBotUserAgent(req.headers['user-agent'])) return res.json({ counted: false });
 */

const BOT_PATTERN = new RegExp([
  'bot\\b', 'bot/', 'crawl', 'spider', 'slurp', 'mediapartners', 'adsbot',
  'googlebot', 'google-inspectiontool', 'googleother', 'bingbot', 'bingpreview', 'yandex', 'baiduspider',
  'duckduckbot', 'applebot', 'petalbot', 'ahrefs', 'semrush', 'mj12bot', 'dotbot', 'bytespider',
  'facebookexternalhit', 'facebookcatalog', 'meta-externalagent', 'whatsapp', 'telegrambot', 'twitterbot',
  'linkedinbot', 'slackbot', 'discordbot', 'skypeuripreview', 'pinterest', 'embedly', 'quora link preview',
  'headlesschrome', 'lighthouse', 'pagespeed', 'chrome-lighthouse', 'gtmetrix', 'pingdom', 'uptimerobot',
  'python-requests', 'python-urllib', 'curl/', 'wget/', 'axios/', 'node-fetch', 'go-http-client', 'java/',
  'okhttp', 'scrapy', 'httpclient', 'postmanruntime', 'gptbot', 'chatgpt-user', 'claudebot', 'anthropic-ai',
  'perplexitybot', 'ccbot', 'amazonbot',
].join('|'), 'i');

/** Vrai si l'agent est un robot connu, ou s'il est absent. */
function isBotUserAgent(userAgent) {
  const value = typeof userAgent === 'string' ? userAgent.trim() : '';
  if (!value) return true;
  return BOT_PATTERN.test(value);
}

module.exports = { isBotUserAgent };
