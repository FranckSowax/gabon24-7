/**
 * Événements à venir : lecture du flux Eventime, reconstruction de la date et
 * du lieu, et enregistrement en base. Réseau et Supabase simulés.
 */

const {
  loadEvents,
  parseFeed,
  extractJsonLdEvent,
  parseFrenchDate,
  parseLocationFromText,
  buildEvent,
  getEventsFeedUrl,
  DEFAULT_EVENTS_RSS_URL,
} = require('../../services/eventime-events');
const { extractEventsFromRSS } = require('../../events-rss-extractor');

const NOW = new Date('2026-11-16T09:00:00Z');
const PAGE_A = 'https://www.eventime.ga/access/Table-ronde-2050/AAA';
const PAGE_B = 'https://www.eventime.ga/access/Festival-animation/BBB';

const item = (title, link, description, image = 'https://www.eventime.ga/img/a.webp') => `
  <item>
    <title><![CDATA[${title}]]></title>
    <description><![CDATA[<div><img src="${image}" /><div>${description}</div></div>]]></description>
    <link>${link}</link>
    <guid isPermaLink="false">${link.slice(-3)}</guid>
    <dc:creator><![CDATA[eventime.ga]]></dc:creator>
    <media:content medium="image" url="${image}"/>
  </item>`;

const FEED = `<?xml version="1.0"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/" version="2.0"><channel>
  <title>Eventime</title>
  ${item('Table ronde : le monde en 2050', PAGE_A, 'Le mercredi 18 novembre, c’est ton tour de parler du futur !...')}
  ${item('Festival du cinéma d’animation', PAGE_B, '🎬 Du 18 au 21 novembre, un festival d’animés !...')}
  ${item('Doublon', PAGE_A, 'même adresse que le premier')}
</channel></rss>`;

const jsonLdPage = (event) => `<html><head>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Eventime"}</script>
  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Event', ...event })}</script>
</head><body></body></html>`;

const PAGE_A_HTML = jsonLdPage({
  name: 'Table ronde : le monde en 2050 ?',
  description: 'Table ronde interactive.\r\n📅 Mer. 18 novembre 2026, 14h30',
  startDate: '2026-11-18T14:30:00+01:00',
  endDate: '2026-11-18T16:00:00+01:00',
  location: { '@type': 'Place', name: 'Institut français du Gabon', address: 'Institut français du Gabon' },
  image: ['https://www.eventime.ga/img/a-large.webp'],
});

describe('lecture du flux', () => {
  it('reprend titre, lien et image de chaque élément', async () => {
    const items = await parseFeed(FEED);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ title: 'Table ronde : le monde en 2050', link: PAGE_A, image: 'https://www.eventime.ga/img/a.webp' });
    expect(items[0].descriptionHtml).toContain('18 novembre');
  });

  it('utilise le nouveau flux par défaut, ou celui de EVENTS_RSS_URL', () => {
    expect(DEFAULT_EVENTS_RSS_URL).toBe('https://rss.app/feeds/kshgXqmChHpaDaU3.xml');
    expect(getEventsFeedUrl({})).toBe(DEFAULT_EVENTS_RSS_URL);
    expect(getEventsFeedUrl({ EVENTS_RSS_URL: 'https://rss.app/feeds/autre.xml' })).toBe('https://rss.app/feeds/autre.xml');
  });
});

describe('balisage schema.org de la page', () => {
  it('trouve l\'événement parmi plusieurs blocs', () => {
    expect(extractJsonLdEvent(PAGE_A_HTML)).toMatchObject({
      name: 'Table ronde : le monde en 2050 ?',
      startDate: '2026-11-18T14:30:00+01:00',
      locationName: 'Institut français du Gabon',
      image: 'https://www.eventime.ga/img/a-large.webp',
    });
  });

  it('lit une adresse structurée et un type d\'événement précis', () => {
    const html = jsonLdPage({ '@type': 'MusicEvent', startDate: '2026-12-01T20:00:00+01:00', location: { name: 'Salle X', address: { streetAddress: 'Bd Triomphal', addressLocality: 'Libreville' } } });
    expect(extractJsonLdEvent(html)).toMatchObject({ locationName: 'Salle X', address: 'Bd Triomphal, Libreville' });
  });

  it('renvoie null sans balisage, ou avec un balisage illisible', () => {
    expect(extractJsonLdEvent('<html></html>')).toBeNull();
    expect(extractJsonLdEvent('<script type="application/ld+json">{pas du json</script>')).toBeNull();
    expect(extractJsonLdEvent('')).toBeNull();
  });
});

describe('date écrite en français', () => {
  it('lit jour, mois, année et heure', () => {
    expect(parseFrenchDate('📅 Mer. 18 novembre 2026, 14h30', NOW)).toBe('2026-11-18T13:30:00.000Z');
    expect(parseFrenchDate('18 Nov. 2026 16:30', NOW)).toBe('2026-11-18T15:30:00.000Z');
    expect(parseFrenchDate('le 1er décembre 2026 à 9h', NOW)).toBe('2026-12-01T08:00:00.000Z');
  });

  it('prend le premier jour d\'une période', () => {
    expect(parseFrenchDate('Du 18 au 21 novembre, un festival', NOW)).toBe('2026-11-17T23:00:00.000Z');
  });

  it('sans année, prend la prochaine occurrence', () => {
    expect(parseFrenchDate('Le mercredi 18 novembre', NOW)).toBe('2026-11-17T23:00:00.000Z');
    expect(parseFrenchDate('Rendez-vous le 10 janvier', NOW)).toBe('2027-01-09T23:00:00.000Z');
  });

  it('ignore les dates impossibles et les textes sans date', () => {
    expect(parseFrenchDate('Le 31 février', NOW)).toBeNull();
    expect(parseFrenchDate('À 25h00 le 3 mars 2026', NOW)).toBe('2026-03-02T23:00:00.000Z');
    expect(parseFrenchDate('De Antonin Baudry, en 1940', NOW)).toBeNull();
    expect(parseFrenchDate('', NOW)).toBeNull();
  });
});

describe('lieu écrit dans le texte', () => {
  it('reconnaît les formes usuelles', () => {
    expect(parseLocationFromText('📍 Institut français du Gabon\nEntrée libre')).toBe('Institut français du Gabon');
    expect(parseLocationFromText('Lieu : Stade de Nzeng-Ayong')).toBe('Stade de Nzeng-Ayong');
    expect(parseLocationFromText('Rien à signaler')).toBeNull();
  });
});

describe('assemblage d\'un événement', () => {
  const feedItem = { title: 'Festival', link: PAGE_B, descriptionHtml: '<div>Du 18 au 21 novembre !...</div>', image: 'https://www.eventime.ga/img/b.webp' };

  it('privilégie la date, le lieu et le titre complet de la page', () => {
    const event = buildEvent(
      { ...feedItem, title: 'Festival du cinéma d’animation' },
      { name: 'Festival du cinéma d’animation : Planètes', startDate: '2026-11-20T09:30:00+01:00', locationName: 'Le Lab', address: 'Quartier Louis', description: 'Projection.' },
      NOW,
    );
    expect(event).toMatchObject({
      title: 'Festival du cinéma d’animation : Planètes',
      event_date: '2026-11-20T08:30:00.000Z',
      location: 'Le Lab, Quartier Louis',
      description: 'Projection.',
      image_url: 'https://www.eventime.ga/img/b.webp',
      dateSource: 'page',
    });
  });

  it('se rabat sur le texte du flux quand la page manque', () => {
    expect(buildEvent(feedItem, null, NOW)).toMatchObject({ event_date: '2026-11-17T23:00:00.000Z', location: null, dateSource: 'texte' });
  });

  it('laisse la date vide plutôt que d\'inventer', () => {
    expect(buildEvent({ ...feedItem, descriptionHtml: 'Un film de Antonin Baudry' }, null, NOW)).toMatchObject({ event_date: null, dateSource: 'aucune' });
  });
});

describe('chargement complet', () => {
  function fakeGet(pages) {
    const calls = [];
    const get = async (url) => {
      calls.push(url);
      if (url in pages) {
        if (pages[url] instanceof Error) throw pages[url];
        return pages[url];
      }
      throw new Error(`URL inattendue ${url}`);
    };
    return { get, calls };
  }

  it('lit chaque page une seule fois et retire les doublons', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { get, calls } = fakeGet({ feed: FEED, [PAGE_A]: PAGE_A_HTML, [PAGE_B]: new Error('timeout') });
    const { events } = await loadEvents({ feedUrl: 'feed', get, now: NOW });
    warn.mockRestore();

    expect(calls.filter((url) => url === PAGE_A)).toHaveLength(1);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ url: PAGE_A, event_date: '2026-11-18T13:30:00.000Z', location: 'Institut français du Gabon', dateSource: 'page' });
    expect(events[1]).toMatchObject({ url: PAGE_B, dateSource: 'texte' });
  });

  it('ne lit pas les pages d\'un autre site', async () => {
    const feed = FEED.split(PAGE_B).join('https://evil.example/page').split(PAGE_A).join('http://www.eventime.ga/access/x');
    const { get, calls } = fakeGet({ feed });
    const { events } = await loadEvents({ feedUrl: 'feed', get, now: NOW });
    expect(calls).toEqual(['feed']);
    expect(events.every((event) => event.dateSource !== 'page')).toBe(true);
  });
});

describe('enregistrement en base', () => {
  function fakeSupabase(rows) {
    const ops = [];
    return {
      ops,
      from: () => {
        const builder = { op: 'select', payload: null };
        builder.select = () => builder;
        builder.limit = () => builder;
        builder.insert = (payload) => { ops.push({ op: 'insert', payload }); return Promise.resolve({ error: null }); };
        builder.update = (payload) => { builder.op = 'update'; builder.payload = payload; return builder; };
        builder.eq = (column, value) => {
          if (builder.op === 'update') { ops.push({ op: 'update', id: value, payload: builder.payload }); return Promise.resolve({ error: null }); }
          builder.filter = [column, value];
          return builder;
        };
        builder.limit = () => Promise.resolve({ data: rows.filter((row) => row[builder.filter[0]] === builder.filter[1]), error: null });
        return builder;
      },
    };
  }

  const event = (overrides = {}) => ({
    title: 'Table ronde', description: 'Desc', url: PAGE_A, image_url: 'https://www.eventime.ga/img/a.webp',
    event_date: '2026-11-18T13:30:00.000Z', location: 'Institut français du Gabon', category: 'Événement', organizer: 'Eventime.ga', dateSource: 'page', ...overrides,
  });

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('ajoute un nouvel événement, sans le champ technique de provenance', async () => {
    const supabase = fakeSupabase([]);
    const result = await extractEventsFromRSS({ supabase, load: async () => ({ feedUrl: 'f', events: [event()] }) });
    expect(result).toMatchObject({ success: true, inserted: 1, updated: 0 });
    expect(supabase.ops[0].payload).toMatchObject({ url: PAGE_A, event_date: '2026-11-18T13:30:00.000Z', is_active: true });
    expect(supabase.ops[0].payload).not.toHaveProperty('dateSource');
  });

  it('corrige un événement enregistré avec une mauvaise date ou sans lieu', async () => {
    const supabase = fakeSupabase([{ id: 'e1', url: PAGE_A, title: 'Table ronde', description: 'Desc', image_url: 'https://www.eventime.ga/img/a.webp', event_date: '2026-11-10T08:00:00+00:00', location: '' }]);
    const result = await extractEventsFromRSS({ supabase, load: async () => ({ feedUrl: 'f', events: [event()] }) });
    expect(result).toMatchObject({ inserted: 0, updated: 1 });
    expect(supabase.ops[0]).toMatchObject({ op: 'update', id: 'e1' });
    expect(supabase.ops[0].payload.location).toBe('Institut français du Gabon');
  });

  it('ne réécrit pas un événement identique (même instant, autre écriture)', async () => {
    const supabase = fakeSupabase([{ id: 'e1', url: PAGE_A, title: 'Table ronde', description: 'Desc', image_url: 'https://www.eventime.ga/img/a.webp', event_date: '2026-11-18T13:30:00+00:00', location: 'Institut français du Gabon' }]);
    const result = await extractEventsFromRSS({ supabase, load: async () => ({ feedUrl: 'f', events: [event()] }) });
    expect(result).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 });
    expect(supabase.ops).toHaveLength(0);
  });

  it('compte les événements sans date', async () => {
    const supabase = fakeSupabase([]);
    const result = await extractEventsFromRSS({ supabase, load: async () => ({ feedUrl: 'f', events: [event({ event_date: null, url: PAGE_B })] }) });
    expect(result.withoutDate).toBe(1);
  });

  it('signale l\'échec quand le flux est injoignable', async () => {
    const result = await extractEventsFromRSS({ supabase: fakeSupabase([]), load: async () => { throw new Error('ENOTFOUND'); } });
    expect(result).toMatchObject({ success: false, message: 'ENOTFOUND' });
  });
});
