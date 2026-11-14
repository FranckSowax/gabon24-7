/**
 * Lecture du bundle rss.app au format JSON Feed, et prise en compte du statut
 * des flux par l'import. Aucun appel réseau.
 */

const { isJsonFeedUrl, jsonFeedToItems, fetchBundleItems, xmlFallbackUrl } = require('../../services/bundle-feed');
const sourceMediaCorrector = require('../../services/source-media-corrector');

const BUNDLE_URL = 'https://rss.app/feeds/v1.1/_AbCdEf.json';

const sampleFeed = () => ({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'Gabon 24/7',
  items: [
    {
      id: 'a1',
      url: 'https://biba241.com/port-gentil-la-maison-d-arret',
      title: 'Port-Gentil : La maison d’arrêt pour mineurs attendue',
      content_text: 'Texte de l\'article.',
      content_html: '<p>Texte de l\'article.</p>',
      image: 'https://biba241.com/assets/images/article/pog.jpeg',
      date_published: '2026-11-14T19:38:40.000Z',
      authors: [{ name: 'BIBA 241' }],
    },
    {
      id: 'fb1',
      url: 'https://www.facebook.com/ministere/posts/123',
      content_text: 'Le ministre a reçu ce jour une délégation venue présenter le projet.',
      attachments: [{ url: 'https://scontent.xx.fbcdn.net/p.jpg', mime_type: 'image/jpeg' }],
      date_published: '2026-11-14T10:00:00.000Z',
      authors: [{ name: 'Ministère du Commerce' }],
    },
  ],
});

describe('jsonFeedToItems', () => {
  it('convertit un article vers la forme du lecteur RSS, image comprise', () => {
    const [item] = jsonFeedToItems(sampleFeed());

    expect(item).toMatchObject({
      title: 'Port-Gentil : La maison d’arrêt pour mineurs attendue',
      link: 'https://biba241.com/port-gentil-la-maison-d-arret',
      guid: 'a1',
      content: '<p>Texte de l\'article.</p>',
      contentSnippet: 'Texte de l\'article.',
      isoDate: '2026-11-14T19:38:40.000Z',
      pubDate: '2026-11-14T19:38:40.000Z',
      creator: 'BIBA 241',
      enclosure: { url: 'https://biba241.com/assets/images/article/pog.jpeg' },
    });
  });

  it('publication Facebook sans titre : début du texte en titre, image jointe reprise', () => {
    const item = jsonFeedToItems(sampleFeed())[1];

    expect(item.title).toBe('Le ministre a reçu ce jour une délégation venue présenter le projet.');
    expect(item.creator).toBe('Ministère du Commerce');
    expect(item.enclosure).toEqual({ url: 'https://scontent.xx.fbcdn.net/p.jpg' });
  });

  it.each([
    ['sans adresse', { id: 'x', title: 'Titre' }],
    ['adresse non http', { id: 'x', title: 'Titre', url: 'javascript:alert(1)' }],
    ['sans titre ni texte', { id: 'x', url: 'https://example.com/a' }],
    ['valeur nulle', null],
    ['chaîne', 'article'],
  ])('ignore un élément %s', (label, raw) => {
    expect(jsonFeedToItems({ items: [raw] })).toEqual([]);
  });

  it('ignore une image qui n\'est pas une adresse http(s) et une date illisible', () => {
    const [item] = jsonFeedToItems({
      items: [{ id: 'x', url: 'https://example.com/a', title: 'Titre', image: 'data:image/png;base64,AAAA', date_published: 'hier' }],
    });

    expect(item.enclosure).toBeUndefined();
    expect(item.isoDate).toBeUndefined();
  });

  it('supporte un document vide ou mal formé', () => {
    expect(jsonFeedToItems(null)).toEqual([]);
    expect(jsonFeedToItems({})).toEqual([]);
    expect(jsonFeedToItems({ items: 'non' })).toEqual([]);
  });
});

describe('fetchBundleItems', () => {
  it('renvoie les articles d\'une réponse JSON, objet ou texte', async () => {
    const asObject = await fetchBundleItems(BUNDLE_URL, { get: async () => ({ status: 200, data: sampleFeed() }) });
    const asText = await fetchBundleItems(BUNDLE_URL, { get: async () => ({ status: 200, data: JSON.stringify(sampleFeed()) }) });

    expect(asObject).toHaveLength(2);
    expect(asText).toHaveLength(2);
  });

  it.each([
    ['paiement requis', { status: 402, data: {} }, /HTTP 402/],
    ['réponse non JSON', { status: 200, data: '<html>erreur</html>' }, /illisible/],
    ['JSON sans articles', { status: 200, data: { title: 'x' } }, /sans liste/],
  ])('lève une erreur claire : %s', async (label, response, pattern) => {
    await expect(fetchBundleItems(BUNDLE_URL, { get: async () => response })).rejects.toThrow(pattern);
  });
});

describe('adresses du bundle', () => {
  it('reconnaît une adresse JSON', () => {
    expect(isJsonFeedUrl(BUNDLE_URL)).toBe(true);
    expect(isJsonFeedUrl('https://rss.app/feeds/_AbCdEf.xml')).toBe(false);
    expect(isJsonFeedUrl('pas une adresse')).toBe(false);
  });

  it('déduit l\'adresse XML de repli du même bundle', () => {
    expect(xmlFallbackUrl(BUNDLE_URL)).toBe('https://rss.app/feeds/_AbCdEf.xml');
    expect(xmlFallbackUrl('https://rss.app/feeds/_AbCdEf.json')).toBe('https://rss.app/feeds/_AbCdEf.xml');
    expect(xmlFallbackUrl('https://example.com/autre.json')).toBeNull();
    expect(xmlFallbackUrl('pas une adresse')).toBeNull();
  });
});

describe('nom du média d\'après l\'adresse de l\'article', () => {
  it.each([
    ['https://biba241.com/article', 'Biba 241'],
    ['https://gabonmediatime.com/article/', 'Gabon Media Time'],
    ['https://www.union.sonapresse.com/fr/article', 'L\'Union'],
    ['https://insidenews241.com/article/', 'Inside News 241'],
    ['https://m.gabonews.com/fr/actus/article', 'Gabonews'],
    ['https://sport241.com/article', 'Sport 241'],
    ['https://letouracovert.com/article/', 'Le Touraco Vert'],
    ['https://gabon24.tv/article', 'Gabon 24'],
  ])('%s -> %s', (url, expected) => {
    // « Gabon News » est la source par défaut que l'agrégateur passe en entrée
    expect(sourceMediaCorrector.correctSource(url, 'Gabon News', 'Rédaction')).toBe(expected);
  });

  it('publication Facebook : le nom de la page (auteur) sert de source', () => {
    expect(sourceMediaCorrector.correctSource('https://m.facebook.com/x/posts/1', 'Gabon News', 'Ministère du Commerce'))
      .toBe('Ministère du Commerce');
  });
});

describe('import : un flux désactivé n\'est plus lu', () => {
  it('syncAllFeeds ignore les flux au statut « inactive »', async () => {
    jest.resetModules();
    jest.doMock('../../openai-service', () => jest.fn().mockImplementation(() => ({})));
    jest.doMock('../../supabase-config', () => ({ supabase: {} }));
    const RSSParserService = require('../../rss-parser-service');

    const service = new RSSParserService({ updateRSSFeed: jest.fn().mockResolvedValue(null) });
    service.initializeFromDatabase = async () => {
      service.feedsCache = [
        { id: 1, name: 'Actif', url: 'https://a.example/feed', status: 'active' },
        { id: 2, name: 'Google désactivé', url: 'https://news.google.com/rss/search?q=site:x.com', status: 'inactive' },
        { id: 3, name: 'En erreur', url: 'https://c.example/feed', status: 'error' },
      ];
    };
    const parsed = [];
    service.parseFeed = async (feed) => { parsed.push(feed.name); return []; };
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.useFakeTimers();

    const run = service.syncAllFeeds();
    await jest.runAllTimersAsync();
    await run.catch(() => {});

    jest.useRealTimers();
    log.mockRestore();
    expect(parsed).toEqual(['Actif', 'En erreur']);
  });
});
