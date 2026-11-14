/**
 * Retrouver l'article d'origine d'un élément Google Actualités chez le média.
 * Le client HTTP est injecté : aucun appel réseau.
 */

const {
  isGoogleNewsUrl,
  isGoogleNewsPlaceholderImage,
  normalizeTitle,
  stripPublisherSuffix,
  titlesMatch,
  publisherOrigin,
  publisherUrlFromFeedItem,
  resolvePublisherArticle,
  _resetCaches,
} = require('../../services/publisher-article-resolver');

const GOOGLE_LINK = 'https://news.google.com/rss/articles/CBMiABC?oc=5';
const TITLE = 'Libreville : cinq nouveaux axes ciblés par les prochaines opérations de démolition';
const REAL_URL = 'https://gabonmediatime.com/libreville-cinq-nouveaux-axes-cibles/';

/** Faux client HTTP : `routes` associe un début d'adresse à une réponse. */
function makeGet(routes) {
  const calls = [];
  const get = async (url) => {
    calls.push(url);
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!key) return { status: 404, body: '<html>introuvable</html>' };
    const route = routes[key];
    if (route instanceof Error) throw route;
    return typeof route === 'string' ? { status: 200, body: route } : route;
  };
  return { get, calls };
}

const wpPosts = (posts) => JSON.stringify(posts);

describe('reconnaissance des liens et images Google Actualités', () => {
  it('reconnaît un lien d\'article Google Actualités', () => {
    expect(isGoogleNewsUrl(GOOGLE_LINK)).toBe(true);
    expect(isGoogleNewsUrl('https://gabonmediatime.com/article/')).toBe(false);
    expect(isGoogleNewsUrl('https://news.google.com.evil.example/x')).toBe(false);
    expect(isGoogleNewsUrl('pas une adresse')).toBe(false);
    expect(isGoogleNewsUrl(undefined)).toBe(false);
  });

  it('reconnaît l\'image générique servie par Google Actualités', () => {
    expect(isGoogleNewsPlaceholderImage('https://lh3.googleusercontent.com/J6_coFbogxhRI9iM=s0-w300')).toBe(true);
    expect(isGoogleNewsPlaceholderImage('https://agpgabon.ga/wp-content/uploads/a.jpg')).toBe(false);
    expect(isGoogleNewsPlaceholderImage('')).toBe(false);
  });
});

describe('comparaison des titres', () => {
  it('retire le suffixe « - Nom du média » ajouté par Google Actualités', () => {
    expect(stripPublisherSuffix(`${TITLE} - Gabon Media Time`, 'Gabon Media Time')).toBe(TITLE);
    expect(stripPublisherSuffix(`${TITLE} - gabon media time`, 'Gabon Media Time')).toBe(TITLE);
    expect(stripPublisherSuffix(`${TITLE} - Un Média`)).toBe(TITLE);
  });

  it('retire le nom du site ajouté après une barre verticale', () => {
    expect(stripPublisherSuffix('Karaté : Akanda honore ses champions | Lunion.ga | Actualités Gabon - L\'Union', 'L\'Union'))
      .toBe('Karaté : Akanda honore ses champions');
    expect(stripPublisherSuffix('SEEG : le drôle de patient | Lunion.ga | Actualités Gabon'))
      .toBe('SEEG : le drôle de patient');
    // Une barre en tout début de titre n'est pas un séparateur de nom de site
    expect(stripPublisherSuffix('Mbanié | Épisode 4/5 : comment le pétrole a ravivé le conflit')).toBe('Mbanié | Épisode 4/5 : comment le pétrole a ravivé le conflit');
  });

  it('ne coupe pas un titre qui contient simplement un tiret', () => {
    const title = 'Sport - Les Panthères';
    expect(stripPublisherSuffix(title)).toBe(title);
  });

  it('ignore accents, ponctuation, casse et entités HTML', () => {
    expect(normalizeTitle('L&#8217;économie : « ça repart » !')).toBe('l economie ca repart');
    expect(titlesMatch('Libreville : l’État démolit', 'LIBREVILLE - L\'Etat demolit')).toBe(true);
  });

  it('accepte un titre tronqué s\'il partage un long début', () => {
    expect(titlesMatch(TITLE, `${TITLE} dans la capitale`)).toBe(true);
    expect(titlesMatch('Libreville', 'Libreville accueille le salon')).toBe(false);
  });

  it('refuse deux titres différents ou vides', () => {
    expect(titlesMatch(TITLE, 'Port-Gentil : inauguration du nouveau marché central')).toBe(false);
    expect(titlesMatch('', TITLE)).toBe(false);
  });
});

describe('adresse du média', () => {
  it('lit la balise <source url> de l\'élément, sinon le critère site: du flux', () => {
    expect(publisherUrlFromFeedItem({ gnSource: { _: 'GMT', $: { url: 'https://gabonmediatime.com' } } }, 'https://x'))
      .toBe('https://gabonmediatime.com');
    expect(publisherUrlFromFeedItem({}, 'https://news.google.com/rss/search?q=site:sport241.com&hl=fr'))
      .toBe('https://sport241.com');
    expect(publisherUrlFromFeedItem({}, 'https://news.google.com/rss/search?q=gabon')).toBeNull();
    expect(publisherUrlFromFeedItem(null, 'adresse invalide')).toBeNull();
  });

  it.each([
    ['adresse interne', 'http://169.254.169.254/'],
    ['localhost', 'http://localhost:3001'],
    ['nom court interne', 'http://redis'],
    ['Google lui-même', 'https://news.google.com'],
    ['protocole fichier', 'file:///etc/passwd'],
    ['valeur vide', ''],
  ])('refuse comme site de média : %s', (label, url) => {
    expect(publisherOrigin(url)).toBeNull();
  });

  it('accepte un domaine public, avec ou sans protocole', () => {
    expect(publisherOrigin('https://gabonmediatime.com/rubrique')).toBe('https://gabonmediatime.com');
    expect(publisherOrigin('sport241.com')).toBe('https://sport241.com');
  });
});

describe('resolvePublisherArticle', () => {
  beforeEach(() => _resetCaches());

  const params = (overrides = {}) => ({
    title: `${TITLE} - Gabon Media Time`,
    publisherUrl: 'https://gabonmediatime.com',
    sourceName: 'Gabon Media Time',
    ...overrides,
  });

  it('trouve l\'article et son image par l\'API WordPress du média', async () => {
    const { get, calls } = makeGet({
      'https://gabonmediatime.com/wp-json/': wpPosts([
        { link: 'https://gabonmediatime.com/autre/', title: { rendered: 'Un autre article sans rapport aucun' } },
        { link: REAL_URL, title: { rendered: 'Libreville : cinq nouveaux axes ciblés par les prochaines opérations de démolition' }, jetpack_featured_media_url: 'https://gabonmediatime.com/wp-content/uploads/a.jpg' },
      ]),
    });

    const result = await resolvePublisherArticle(params(), { get });

    expect(result).toEqual({ url: REAL_URL, imageUrl: 'https://gabonmediatime.com/wp-content/uploads/a.jpg' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/wp-json/wp/v2/posts?search=Libreville');
    expect(calls[0]).not.toContain('Gabon%20Media%20Time');
  });

  it('renvoie le lien sans image quand l\'API n\'en fournit pas', async () => {
    const { get } = makeGet({
      'https://gabonmediatime.com/wp-json/': wpPosts([{ link: REAL_URL, title: { rendered: TITLE } }]),
    });

    expect(await resolvePublisherArticle(params(), { get })).toEqual({ url: REAL_URL, imageUrl: null });
  });

  it('ignore un résultat qui pointe vers un autre site', async () => {
    const { get } = makeGet({
      'https://gabonmediatime.com/wp-json/': wpPosts([{ link: 'https://evil.example/article/', title: { rendered: TITLE } }]),
    });

    expect(await resolvePublisherArticle(params(), { get })).toBeNull();
  });

  it('se rabat sur le flux RSS du média quand il n\'a pas d\'API WordPress', async () => {
    const feed = `<rss><channel>
      <item><title><![CDATA[Autre sujet du jour à Port-Gentil]]></title><link>https://www.union.sonapresse.com/autre</link></item>
      <item><title>Libreville : cinq nouveaux axes ciblés par les prochaines opérations de démolition</title><link>https://www.union.sonapresse.com/libreville-axes</link></item>
    </channel></rss>`;
    const { get, calls } = makeGet({ 'https://www.union.sonapresse.com/rss.xml': feed });

    const result = await resolvePublisherArticle(
      params({ title: `${TITLE} - L'Union`, publisherUrl: 'https://www.union.sonapresse.com', sourceName: 'L\'Union' }),
      { get }
    );

    expect(result).toEqual({ url: 'https://www.union.sonapresse.com/libreville-axes', imageUrl: null });
    expect(calls[0]).toContain('/wp-json/');
    expect(calls[1]).toBe('https://www.union.sonapresse.com/rss.xml');
  });

  it('renvoie null quand l\'article est introuvable chez le média', async () => {
    const { get } = makeGet({ 'https://gabonmediatime.com/wp-json/': wpPosts([]) });

    expect(await resolvePublisherArticle(params(), { get })).toBeNull();
  });

  it('ne lève jamais : site injoignable = null', async () => {
    const { get } = makeGet({ 'https://gabonmediatime.com/': new Error('ETIMEDOUT') });

    await expect(resolvePublisherArticle(params(), { get })).resolves.toBeNull();
  });

  it('n\'interroge aucun site pour une adresse de média interne ou absente', async () => {
    const { get, calls } = makeGet({});

    expect(await resolvePublisherArticle(params({ publisherUrl: 'http://169.254.169.254' }), { get })).toBeNull();
    expect(await resolvePublisherArticle(params({ publisherUrl: null }), { get })).toBeNull();
    expect(await resolvePublisherArticle(params({ title: 'Court' }), { get })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('garde le résultat en mémoire : un seul appel pour le même article', async () => {
    const { get, calls } = makeGet({
      'https://gabonmediatime.com/wp-json/': wpPosts([{ link: REAL_URL, title: { rendered: TITLE } }]),
    });

    await resolvePublisherArticle(params({ cacheKey: 'guid-1' }), { get });
    await resolvePublisherArticle(params({ cacheKey: 'guid-1' }), { get });

    expect(calls).toHaveLength(1);
  });

  it('ne réinterroge pas une API WordPress absente pour les articles suivants', async () => {
    const { get, calls } = makeGet({});

    await resolvePublisherArticle(params({ publisherUrl: 'https://biba241.com', cacheKey: 'a' }), { get });
    const afterFirst = calls.length;
    await resolvePublisherArticle(params({ publisherUrl: 'https://biba241.com', title: 'Un tout autre titre suffisamment long', cacheKey: 'b' }), { get });

    expect(afterFirst).toBe(3); // API WordPress, /rss.xml, /feed/
    expect(calls).toHaveLength(3); // rien de plus : le site est connu comme sans API ni flux
  });
});
