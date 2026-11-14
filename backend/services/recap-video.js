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

module.exports = { isRecapVideo, splitRecapVideos, RECAP_MAX_AGE_HOURS };
