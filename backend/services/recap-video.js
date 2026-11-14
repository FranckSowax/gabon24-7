/**
 * Vidéo récapitulative de l'actualité (« Récap 24 h »), produite chaque jour
 * par l'agent Hermes.
 *
 * WHY: l'agent dépose cette vidéo dans la même table que les vidéos
 * publicitaires de la section d'accueil (hero_videos), sans marque propre.
 * Elle tournait donc dans le carrousel, mêlée aux publicités. Elle a désormais
 * son propre module (barre latérale sur ordinateur, carte sur mobile) : il
 * faut la distinguer des autres. Seul son titre le permet aujourd'hui
 * (« Récap 24 h — 14/11/2026 »).
 *
 * Convention à conserver côté agent : le titre commence par « Récap ».
 *
 * @example
 *   const { recap, heroVideos } = splitRecapVideos(rows);
 */

/** Au-delà de cet âge, un « récap 24 h » n'est plus d'actualité : le module se masque. */
const RECAP_MAX_AGE_HOURS = 72;

/** Vrai si la vidéo est un récapitulatif d'actualité (titre commençant par « Récap »). */
function isRecapVideo(video) {
  const title = String((video && video.title) || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return /^recap(\b|itulatif)/.test(title);
}

/**
 * Sépare les vidéos actives : le récap le plus récent (ou null s'il n'y en a
 * pas, ou s'il est trop ancien) et les vidéos de la section d'accueil.
 * Les anciens récaps ne retournent jamais dans le carrousel.
 */
function splitRecapVideos(videos, now = new Date()) {
  const list = Array.isArray(videos) ? videos : [];
  const heroVideos = list.filter((video) => !isRecapVideo(video));

  const latest = list
    .filter(isRecapVideo)
    .map((video) => ({ video, time: Date.parse(video.created_at) }))
    .filter((entry) => !Number.isNaN(entry.time))
    .sort((a, b) => b.time - a.time)[0];

  const fresh = latest && now.getTime() - latest.time <= RECAP_MAX_AGE_HOURS * 60 * 60 * 1000;
  return { recap: fresh ? latest.video : null, heroVideos };
}

/**
 * Titre d'un récap pour une date donnée : « Récap 24 h — JJ/MM/AAAA », à l'heure
 * de Libreville. Le serveur le construit lui-même : le module reconnaît le récap
 * à ce titre, et il ne dépend ainsi plus de ce qu'envoie l'agent.
 */
function buildRecapTitle(date = new Date()) {
  const day = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Libreville',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return `Récap 24 h — ${day}`;
}

const MAX_HEADLINES = 6;
const MAX_HEADLINE_LENGTH = 160;

/**
 * Met en forme les titres du jour envoyés par l'agent : une liste (tableau, ou
 * texte séparé par « · » ou des retours à la ligne) devient
 * « Titre 1 · Titre 2 · Titre 3 ». Renvoie '' s'il n'y a aucun titre exploitable.
 * Les balises et les caractères de contrôle sont retirés.
 */
function normalizeRecapHeadlines(input) {
  const parts = Array.isArray(input) ? input : String(input == null ? '' : input).split(/\s+·\s+|\r?\n/);
  return parts
    .map((part) => String(part == null ? '' : part)
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s*·\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_HEADLINE_LENGTH))
    .filter((part) => part.length > 0)
    .slice(0, MAX_HEADLINES)
    .join(' · ');
}

module.exports = {
  isRecapVideo,
  splitRecapVideos,
  buildRecapTitle,
  normalizeRecapHeadlines,
  RECAP_MAX_AGE_HOURS,
};
