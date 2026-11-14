/**
 * Ordre d'affichage de l'accueil : alternance des médias, doublons, et limite
 * de rafale à l'import du bundle. Fonctions pures, aucun appel réseau.
 */

const { dedupeSameStory, spreadBySource, sourceKey } = require('../../services/article-feed-order');
const { limitSourceBursts } = require('../../services/bundle-feed');

const art = (id, source, extra = {}) => ({ id, source, title: `Titre de l'article numéro ${id} suffisamment long`, ...extra });
const ids = (list) => list.map((a) => a.id);
const sources = (list) => list.map((a) => a.source);

/** Plus longue série d'articles consécutifs du même média. */
function longestRun(list) {
  let best = 0;
  let run = 0;
  let last = null;
  for (const article of list) {
    const key = sourceKey(article);
    run = key === last ? run + 1 : 1;
    last = key;
    best = Math.max(best, run);
  }
  return best;
}

describe('spreadBySource', () => {
  it('une rafale de 20 articles d\'un média ne monopolise plus le haut de la page', () => {
    const list = [
      art('a1', 'AGP'), art('a2', 'AGP'),
      ...Array.from({ length: 20 }, (_, i) => art(`b${i}`, 'BIBA 241')),
      art('m1', 'Ministère du Commerce'), art('g1', 'Gabon 24'), art('g2', 'Gabon 24'),
      art('r1', 'Gabon Review'), art('u1', 'L\'Union'), art('i1', 'Infos Gabon'),
    ];

    const ordered = spreadBySource(list);

    expect(sources(ordered.slice(0, 8))).toEqual([
      'AGP', 'AGP', 'BIBA 241', 'BIBA 241', 'Ministère du Commerce', 'BIBA 241', 'BIBA 241', 'Gabon 24',
    ]);
  });

  it('ne retire ni ne duplique aucun article', () => {
    const list = [...Array.from({ length: 12 }, (_, i) => art(`b${i}`, 'Biba')), art('x', 'AGP'), art('y', 'RFI')];

    const ordered = spreadBySource(list);

    expect(ordered).toHaveLength(list.length);
    expect(ids(ordered).slice().sort()).toEqual(ids(list).slice().sort());
  });

  it('garde l\'ordre d\'origine quand les médias alternent déjà', () => {
    const list = [art(1, 'A'), art(2, 'B'), art(3, 'A'), art(4, 'A'), art(5, 'C'), art(6, 'B')];

    expect(ids(spreadBySource(list))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('conserve l\'ordre chronologique à l\'intérieur de chaque média', () => {
    const list = [art(1, 'A'), art(2, 'A'), art(3, 'A'), art(4, 'A'), art(5, 'B'), art(6, 'B'), art(7, 'C')];

    const ordered = spreadBySource(list);

    expect(ids(ordered.filter((a) => a.source === 'A'))).toEqual([1, 2, 3, 4]);
    expect(ids(ordered.filter((a) => a.source === 'B'))).toEqual([5, 6]);
  });

  it('respecte la limite tant qu\'il reste un autre média à intercaler', () => {
    const list = [
      ...Array.from({ length: 6 }, (_, i) => art(`a${i}`, 'A')),
      ...Array.from({ length: 6 }, (_, i) => art(`b${i}`, 'B')),
      ...Array.from({ length: 6 }, (_, i) => art(`c${i}`, 'C')),
    ];

    // La limite n'est dépassée que lorsqu'il ne reste plus aucun autre média
    // après : les articles restants sont alors affichés à la suite.
    for (const maxConsecutive of [1, 2, 3]) {
      const ordered = spreadBySource(list, { maxConsecutive });
      let run = 0;
      let last = null;
      ordered.forEach((article, index) => {
        run = article.source === last ? run + 1 : 1;
        last = article.source;
        if (run > maxConsecutive) {
          const othersLeft = ordered.slice(index).some((next) => next.source !== article.source);
          expect(othersLeft).toBe(false);
        }
      });
    }
  });

  it('alterne parfaitement des médias de volume égal publiés en même temps', () => {
    const list = [];
    for (let i = 0; i < 6; i += 1) list.push(art(`a${i}`, 'A'), art(`b${i}`, 'B'), art(`c${i}`, 'C'));
    // Entrée volontairement regroupée par paires : A A B B C C ...
    const paired = [...list].sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1)));

    expect(longestRun(spreadBySource(paired, { maxConsecutive: 1 }))).toBe(1);
  });

  it('s\'il ne reste qu\'un média, ses articles sont affichés à la suite plutôt que cachés', () => {
    const list = [art(1, 'A'), art(2, 'A'), art(3, 'A'), art(4, 'A'), art(5, 'B')];

    expect(ids(spreadBySource(list))).toEqual([1, 2, 5, 3, 4]);
  });

  it('traite comme un seul média deux écritures du même nom', () => {
    const list = [art(1, 'BIBA 241'), art(2, 'Biba 241'), art(3, 'biba 241'), art(4, 'Gabon 24 - Facebook'), art(5, 'Gabon 24')];

    expect(ids(spreadBySource(list))).toEqual([1, 2, 4, 3, 5]);
  });

  it('supporte une liste vide ou absente', () => {
    expect(spreadBySource([])).toEqual([]);
    expect(spreadBySource(undefined)).toEqual([]);
  });
});

describe('dedupeSameStory', () => {
  const title = 'Gabon-Lesotho : Sébastien Migné réclame plus de soutien du public';

  it('ne garde qu\'un exemplaire d\'un article arrivé par deux flux', () => {
    const list = [
      { id: 'bundle', source: 'BIBA 241', title, imageUrl: 'https://biba241.com/a.jpg' },
      { id: 'autre', source: 'AGP', title: 'Un article différent de l\'agence de presse' },
      { id: 'google', source: 'Biba 241', title: `${title} - Biba 241`, imageUrl: null },
    ];

    expect(ids(dedupeSameStory(list))).toEqual(['bundle', 'autre']);
  });

  it('garde l\'exemplaire avec image, à la place du premier rencontré', () => {
    const list = [
      { id: 'sans-image', source: 'Biba 241', title, imageUrl: null },
      { id: 'autre', source: 'AGP', title: 'Un article différent de l\'agence de presse' },
      { id: 'avec-image', source: 'BIBA 241', title, image_url: 'https://biba241.com/a.jpg' },
    ];

    expect(ids(dedupeSameStory(list))).toEqual(['avec-image', 'autre']);
  });

  it('ne fusionne pas le même titre publié par deux médias différents', () => {
    const list = [{ id: 1, source: 'AGP', title }, { id: 2, source: 'L\'Union', title }];

    expect(dedupeSameStory(list)).toHaveLength(2);
  });

  it('ne fusionne pas des titres trop courts pour être sûrs', () => {
    const list = [{ id: 1, source: 'AGP', title: 'Communiqué' }, { id: 2, source: 'AGP', title: 'Communiqué' }];

    expect(dedupeSameStory(list)).toHaveLength(2);
  });

  it('supporte une liste vide ou absente', () => {
    expect(dedupeSameStory([])).toEqual([]);
    expect(dedupeSameStory(null)).toEqual([]);
  });
});

describe('limitSourceBursts — import du bundle', () => {
  const item = (id, link, isoDate) => ({ guid: id, link, isoDate });
  const guids = (list) => list.map((i) => i.guid);

  it('un site livré en rafale avec la même date ne garde que ses 3 premiers articles', () => {
    const burst = Array.from({ length: 20 }, (_, i) => item(`b${i}`, `https://biba241.com/article-${i}`, `2026-11-14T19:38:${String(38 + (i % 3)).padStart(2, '0')}.000Z`));
    const list = [item('a1', 'https://agpgabon.ga/a1', '2026-11-14T19:50:00.000Z'), ...burst, item('g1', 'https://gabonmediatime.com/g1', '2026-11-14T18:00:00.000Z')];

    expect(guids(limitSourceBursts(list))).toEqual(['a1', 'b0', 'b1', 'b2', 'g1']);
  });

  it('laisse passer un média qui publie régulièrement', () => {
    const list = Array.from({ length: 8 }, (_, i) => item(`a${i}`, `https://agpgabon.ga/a${i}`, new Date(Date.UTC(2026, 10, 14, 19, 50 - i * 12)).toISOString()));

    expect(limitSourceBursts(list)).toHaveLength(8);
  });

  it('ne regroupe pas les publications Facebook (pages distinctes sur un même domaine)', () => {
    const list = Array.from({ length: 6 }, (_, i) => item(`f${i}`, `https://www.facebook.com/page${i}/posts/1`, '2026-11-14T10:00:00.000Z'));

    expect(limitSourceBursts(list)).toHaveLength(6);
  });

  it('garde les articles sans date ou sans adresse lisible', () => {
    const list = [item('x', 'https://biba241.com/x', undefined), item('y', 'pas une adresse', '2026-11-14T10:00:00.000Z')];

    expect(limitSourceBursts(list)).toHaveLength(2);
  });

  it('donne le même résultat au passage suivant (les 3 gardés restent les mêmes)', () => {
    const burst = Array.from({ length: 10 }, (_, i) => item(`b${i}`, `https://www.biba241.com/a-${i}`, '2026-11-14T19:38:40.000Z'));

    expect(guids(limitSourceBursts(burst))).toEqual(guids(limitSourceBursts(burst.slice())));
    expect(limitSourceBursts(burst)).toHaveLength(3);
  });
});
