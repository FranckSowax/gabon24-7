/**
 * Tests de la protection SSRF du proxy d'images.
 */

const dns = require('dns');
const {
  assertPublicUrl,
  isPrivateAddress,
  safeLookup,
  safeRequestOptions,
  SsrfBlockedError,
} = require('../../utils/ssrf-guard');

describe('assertPublicUrl', () => {
  it.each([
    'https://www.example.com/image.jpg',
    'http://cdn.example.org:8080/a.png?x=1',
    'https://8.8.8.8/logo.png',
    'https://scontent.xx.fbcdn.net/v/t1.0-9/photo.jpg',
  ])('accepte %s', (url) => {
    expect(() => assertPublicUrl(url)).not.toThrow();
  });

  it.each([
    ['protocole file', 'file:///etc/passwd'],
    ['protocole gopher', 'gopher://example.com/'],
    ['localhost', 'http://localhost:3001/api/admin'],
    ['sous-domaine localhost', 'http://app.localhost/'],
    ['boucle locale', 'http://127.0.0.1/'],
    ['boucle locale abrégée', 'http://127.1/'],
    ['IP décimale', 'http://2130706433/'],
    ['IP hexadécimale', 'http://0x7f000001/'],
    ['réseau privé 10.x', 'http://10.0.0.5/'],
    ['réseau privé 172.16', 'http://172.16.4.1/'],
    ['réseau privé 192.168', 'http://192.168.1.1/'],
    ['métadonnées cloud', 'http://169.254.169.254/latest/meta-data/'],
    ['adresse 0.0.0.0', 'http://0.0.0.0/'],
    ['IPv6 locale', 'http://[::1]/'],
    ['IPv6 privée', 'http://[fd00::1]/'],
    ['IPv4 encapsulée en IPv6', 'http://[::ffff:127.0.0.1]/'],
    ['réseau interne Railway', 'http://backend.railway.internal:3001/'],
    ['nom court interne', 'http://redis:6379/'],
    ['domaine .local', 'http://imprimante.local/'],
    ['identifiants dans l\'URL', 'https://user:pass@example.com/'],
    ['URL invalide', 'pas une url'],
    ['chaîne vide', ''],
  ])('refuse %s', (label, url) => {
    expect(() => assertPublicUrl(url)).toThrow(SsrfBlockedError);
  });
});

describe('isPrivateAddress', () => {
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('%s est publique', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });

  it.each([
    '127.0.0.1', '10.1.2.3', '172.31.255.255', '192.168.0.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fc00::1',
    '::ffff:10.0.0.1', '::ffff:7f00:1', 'pas-une-ip',
  ])('%s est privée', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });
});

describe('safeLookup', () => {
  afterEach(() => jest.restoreAllMocks());

  const mockDns = (addresses) =>
    jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => callback(null, addresses));

  it('refuse un domaine public qui résout vers une adresse privée', (done) => {
    mockDns([{ address: '10.0.0.7', family: 4 }]);
    safeLookup('evil.example.com', {}, (error) => {
      expect(error).toBeInstanceOf(SsrfBlockedError);
      done();
    });
  });

  it('refuse si une seule des adresses résolues est privée', (done) => {
    mockDns([{ address: '93.184.216.34', family: 4 }, { address: '169.254.169.254', family: 4 }]);
    safeLookup('mixte.example.com', {}, (error) => {
      expect(error).toBeInstanceOf(SsrfBlockedError);
      done();
    });
  });

  it('laisse passer une adresse publique', (done) => {
    mockDns([{ address: '93.184.216.34', family: 4 }]);
    safeLookup('example.com', {}, (error, address, family) => {
      expect(error).toBeNull();
      expect(address).toBe('93.184.216.34');
      expect(family).toBe(4);
      done();
    });
  });

  it('respecte l\'option all', (done) => {
    mockDns([{ address: '93.184.216.34', family: 4 }]);
    safeLookup('example.com', { all: true }, (error, addresses) => {
      expect(error).toBeNull();
      expect(addresses).toEqual([{ address: '93.184.216.34', family: 4 }]);
      done();
    });
  });
});

describe('safeRequestOptions', () => {
  it('bloque une redirection vers une adresse interne', () => {
    const { beforeRedirect } = safeRequestOptions();
    expect(() => beforeRedirect({ protocol: 'http:', hostname: '169.254.169.254', path: '/latest' })).toThrow(SsrfBlockedError);
    expect(() => beforeRedirect({ protocol: 'http:', hostname: 'api.railway.internal', path: '/' })).toThrow(SsrfBlockedError);
    expect(() => beforeRedirect({ protocol: 'http:', hostname: '::1', path: '/' })).toThrow(SsrfBlockedError);
  });

  it('autorise une redirection vers un hôte public', () => {
    const { beforeRedirect } = safeRequestOptions();
    expect(() => beforeRedirect({ protocol: 'https:', hostname: 'cdn.example.com', path: '/a.jpg' })).not.toThrow();
  });

  it('fournit des agents à résolution filtrée et désactive le proxy système', () => {
    const options = safeRequestOptions();
    expect(options.httpAgent.options.lookup).toBe(safeLookup);
    expect(options.httpsAgent.options.lookup).toBe(safeLookup);
    expect(options.proxy).toBe(false);
  });
});
