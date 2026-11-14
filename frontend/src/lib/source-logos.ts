/**
 * Logo des médias sources, affiché à la place de l'image quand un article
 * n'en a pas (voir SourcePlaceholder).
 *
 * WHY: certains médias ne sont suivis que par Google Actualités et n'exposent
 * ni API ni flux : leurs articles arrivent sans image. Plutôt qu'une carte
 * vide, on affiche le logo du média, qui dit aussi d'où vient l'article.
 *
 * Les adresses sont celles que chaque média publie comme icône de son propre
 * site (relevées le 14 novembre 2026). Si un logo ne se charge plus, les
 * initiales du média s'affichent à sa place : rien ne casse.
 *
 * @example
 *   getSourceLogo('Sport 241') // 'https://sport241.com/squelettes/img/favicon-sport241-192.png'
 *   getSourceLogo('Média inconnu') // undefined
 */

const SOURCE_LOGOS: Record<string, string> = {
  'sport 241': 'https://sport241.com/squelettes/img/favicon-sport241-192.png',
  'biba 241': 'https://biba241.com/assets/images/favicon.png',
  'gabonews': 'https://www.gabonews.com/squelettes/images/favicon.png',
  'l union': 'https://www.union.sonapresse.com/sites/default/files/FavLUnion50.png',
  'les echos de l eco': 'https://echosdeleco.com/icons/icon-192.png',
  'depeches 241': 'https://depeches241.com/wp-content/uploads/2026/10/cropped-Logo-D-turquoise-plume-rouge-et-241-1-192x192.png',
  'gabon media time': 'https://gabonmediatime.com/wp-content/uploads/2023/10/cropped-logo-gmt-300x300.png',
}

/** Nom de média réduit à ses lettres et chiffres (sans accents ni ponctuation). */
function normalizeSource(source: string): string {
  return source
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Adresse du logo d'un média, ou `undefined` s'il n'est pas répertorié. */
export function getSourceLogo(source?: string | null): string | undefined {
  if (!source) return undefined
  return SOURCE_LOGOS[normalizeSource(source)]
}

/** Initiales d'un média (2 caractères), pour l'affichage sans logo. */
export function getSourceInitials(source?: string | null): string {
  const words = normalizeSource(source || '').split(' ').filter((word) => word.length > 0)
  // Les petits mots de liaison ne font pas de bonnes initiales
  const significant = words.filter((word) => !['l', 'le', 'la', 'les', 'de', 'du', 'des', 'd'].includes(word))
  const picked = (significant.length > 0 ? significant : words).slice(0, 2)
  if (picked.length === 0) return 'GI'
  if (picked.length === 1) return picked[0].slice(0, 2).toUpperCase()
  return (picked[0][0] + picked[1][0]).toUpperCase()
}
