/**
 * Protection SSRF pour les requêtes sortantes vers une URL fournie par un client.
 *
 * Deux niveaux de contrôle :
 *   1. assertPublicUrl(url)  — contrôle statique : protocole, identifiants dans
 *      l'URL, noms internes, adresses IP littérales privées.
 *   2. agents HTTP(S) dont la résolution DNS refuse toute adresse privée. Le
 *      contrôle se fait au moment de la connexion, donc à chaque redirection et
 *      sans fenêtre de "DNS rebinding".
 *
 * WHY: une liste noire de noms d'hôtes ne suffit pas, n'importe quel domaine
 * public pouvant pointer vers 10.x, 169.254.169.254 ou *.railway.internal.
 *
 * @example
 *   const { assertPublicUrl, safeRequestOptions } = require('./utils/ssrf-guard');
 *   assertPublicUrl(url);
 *   await axios({ url, ...safeRequestOptions() });
 */

const dns = require('dns');
const http = require('http');
const https = require('https');
const net = require('net');

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.intranet', '.corp'];

class SsrfBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SsrfBlockedError';
    this.code = 'SSRF_BLOCKED';
  }
}

function isPrivateIPv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true; // Forme inattendue : refus par prudence
  }
  const [a, b] = parts;
  return (
    a === 0 ||                          // "ce réseau"
    a === 10 ||                         // privé classe A
    a === 127 ||                        // boucle locale
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||         // lien local (métadonnées cloud)
    (a === 172 && b >= 16 && b <= 31) ||  // privé classe B
    (a === 192 && b === 168) ||         // privé classe C
    (a === 192 && b === 0) ||           // 192.0.0.0/24 et 192.0.2.0/24
    (a === 198 && (b === 18 || b === 19)) || // bancs de test
    a >= 224                            // multicast et réservé
  );
}

function isPrivateIPv6(address) {
  const value = address.toLowerCase().split('%')[0];
  if (value === '::' || value === '::1') return true;

  // IPv4 encapsulée (::ffff:a.b.c.d ou ::ffff:hhhh:hhhh)
  const mapped = value.match(/^::ffff:(.+)$/);
  if (mapped) {
    const tail = mapped[1];
    if (net.isIPv4(tail)) return isPrivateIPv4(tail);
    const hex = tail.split(':');
    if (hex.length === 2) {
      const high = parseInt(hex[0], 16);
      const low = parseInt(hex[1], 16);
      return isPrivateIPv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return true;
  }

  const first = parseInt(value.split(':')[0] || '0', 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7  adresses locales uniques
    (first & 0xffc0) === 0xfe80 || // fe80::/10 lien local
    (first & 0xff00) === 0xff00 || // ff00::/8  multicast
    value.startsWith('64:ff9b:') || // NAT64
    value.startsWith('2001:db8:')   // documentation
  );
}

/**
 * Indique si une adresse IP (v4 ou v6) est privée, locale ou réservée.
 * Toute valeur qui n'est pas une IP valide est considérée comme privée.
 */
function isPrivateAddress(address) {
  if (net.isIPv4(address)) return isPrivateIPv4(address);
  if (net.isIPv6(address)) return isPrivateIPv6(address);
  return true;
}

/**
 * Contrôle statique d'une URL fournie par un client.
 * @throws {SsrfBlockedError} si l'URL ne désigne pas une ressource HTTP(S) publique
 * @returns {URL} l'URL analysée
 */
function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch (error) {
    throw new SsrfBlockedError('URL invalide');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new SsrfBlockedError('Protocole non autorisé');
  }
  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError('Identifiants dans l\'URL non autorisés');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname) {
    throw new SsrfBlockedError('Hôte manquant');
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new SsrfBlockedError('Adresse interne non autorisée');
    return parsed;
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
    !hostname.includes('.') // nom court = résolution interne (ex: "redis", "postgres")
  ) {
    throw new SsrfBlockedError('Hôte interne non autorisé');
  }

  return parsed;
}

/**
 * Résolution DNS qui refuse toute adresse privée. Signature compatible avec
 * l'option `lookup` des agents HTTP de Node.
 */
function safeLookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : (options || {});

  dns.lookup(hostname, { ...opts, all: true }, (error, addresses) => {
    if (error) return cb(error);

    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: net.isIPv6(addresses) ? 6 : 4 }];
    if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
      return cb(new SsrfBlockedError('Adresse interne non autorisée'));
    }

    if (opts.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
}

const safeHttpAgent = new http.Agent({ lookup: safeLookup });
const safeHttpsAgent = new https.Agent({ lookup: safeLookup });

/**
 * Options à fusionner dans un appel axios pour le rendre résistant au SSRF :
 * résolution DNS filtrée, et contrôle statique de chaque redirection (couvre
 * les redirections vers une IP littérale, que la résolution DNS ne voit pas).
 */
function safeRequestOptions() {
  return {
    httpAgent: safeHttpAgent,
    httpsAgent: safeHttpsAgent,
    proxy: false,
    beforeRedirect: (options) => {
      const protocol = options.protocol || 'http:';
      const host = options.hostname || options.host || '';
      const bracketed = net.isIPv6(host) ? `[${host}]` : host;
      assertPublicUrl(`${protocol}//${bracketed}${options.path || '/'}`);
    },
  };
}

module.exports = {
  SsrfBlockedError,
  assertPublicUrl,
  isPrivateAddress,
  safeLookup,
  safeRequestOptions,
};
