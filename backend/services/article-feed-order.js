/**
 * Ordre d'affichage des articles de l'accueil.
 *
 * WHY: la liste était strictement triée par date. Quand un média publie (ou
 * qu'un agrégateur livre) vingt articles à la même minute, ils occupaient tout
 * le haut de la page : l'accueil ne montrait plus qu'une seule source. Et un
 * même article arrivé par deux flux apparaissait deux fois.
 *
 * Deux fonctions pures, sans accès à la base :
 *   - dedupeSameStory : un seul exemplaire d'un même article d'un même média ;
 *   - spreadBySource  : jamais plus de N articles de suite du même média.
 *
 * @example
 *   const ordered = spreadBySource(dedupeSameStory(articles), { maxConsecutive: 2 });
 */

function _normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Clé d'un média, insensible à la casse, aux accents et au suffixe « - Facebook ». */
function sourceKey(article) {
  return _normalize(String((article && article.source) || '').replace(/\s*-\s*facebook\s*$/i, ''));
}

function _hasImage(article) {
  return Boolean(article && (article.imageUrl || article.image_url));
}

/**
 * Retire les doublons d'un même article d'un même média (même titre, une fois
 * ignorés la casse, les accents et le suffixe « - Nom du média »). L'exemplaire
 * conservé garde la place du premier rencontré ; s'il n'a pas d'image et qu'un
 * doublon en a une, c'est celui avec image qui est gardé.
 */
function dedupeSameStory(articles) {
  const list = Array.isArray(articles) ? articles : [];
  const indexByKey = new Map();
  const result = [];

  for (const article of list) {
    const source = sourceKey(article);
    let title = _normalize(article && article.title);
    // « Titre - Nom du média » (ajout de Google Actualités) -> « Titre »
    if (source && title.endsWith(` ${source}`)) title = title.slice(0, -source.length).trim();

    // Titre trop court pour être sûr qu'il s'agit du même article : on garde tout
    if (title.length < 20) {
      result.push(article);
      continue;
    }

    const key = `${source}|${title}`;
    if (!indexByKey.has(key)) {
      indexByKey.set(key, result.length);
      result.push(article);
    } else if (!_hasImage(result[indexByKey.get(key)]) && _hasImage(article)) {
      result[indexByKey.get(key)] = article;
    }
  }

  return result;
}

/**
 * Réordonne une liste triée par date pour qu'un même média n'occupe jamais
 * plus de `maxConsecutive` places de suite. L'ordre chronologique est conservé
 * autant que possible : un article n'est reculé que le temps de laisser passer
 * un article d'un autre média. Aucun article n'est retiré.
 *
 * @param {object[]} articles liste déjà triée (la plus récente d'abord)
 * @param {{ maxConsecutive?: number }} [options] défaut : 2
 */
function spreadBySource(articles, options = {}) {
  const list = Array.isArray(articles) ? articles : [];
  const maxConsecutive = Number.isInteger(options.maxConsecutive) && options.maxConsecutive > 0
    ? options.maxConsecutive
    : 2;

  const pending = list.slice();
  const result = [];
  let lastSource = null;
  let run = 0;

  while (pending.length > 0) {
    let index = 0;
    if (run >= maxConsecutive) {
      // Le média en cours a atteint sa limite : prochain article d'un autre média
      const other = pending.findIndex((article) => sourceKey(article) !== lastSource);
      // S'il ne reste que ce média, on continue dans l'ordre : rien n'est caché
      index = other === -1 ? 0 : other;
    }

    const [next] = pending.splice(index, 1);
    const source = sourceKey(next);
    run = source === lastSource ? run + 1 : 1;
    lastSource = source;
    result.push(next);
  }

  return result;
}

module.exports = { dedupeSameStory, spreadBySource, sourceKey };
