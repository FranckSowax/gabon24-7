/**
 * Vidéo récapitulative de l'actualité (« Récap 24 h »), produite chaque jour
 * par l'agent Hermes. Elle a son propre module et ne tourne plus dans le
 * carrousel de la section d'accueil.
 *
 * Même règle que le serveur (backend/services/recap-video.js) : un récap se
 * reconnaît à son titre, qui commence par « Récap ». Elle est reprise ici pour
 * que le site reste correct même face à un serveur pas encore mis à jour.
 *
 * @example
 *   const video = await fetchRecapVideo() // null s'il n'y a pas de récap récent
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/** Au-delà de cet âge, un « récap 24 h » n'est plus d'actualité. */
const RECAP_MAX_AGE_HOURS = 72

export interface RecapVideo {
  id: string
  title: string | null
  description: string | null
  cta_label: string | null
  cta_url: string | null
  video_url: string
  created_at?: string | null
}

/** Vrai si la vidéo est un récapitulatif d'actualité. */
export function isRecapVideo(video: { title?: string | null } | null | undefined): boolean {
  const title = (video?.title || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
  return /^recap(\b|itulatif)/.test(title)
}

/** Titres du jour : la description du récap les sépare par « · ». */
export function recapHeadlines(description: string | null | undefined, max = 4): string[] {
  return (description || '')
    .split(/\s+·\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, max)
}

let pending: Promise<RecapVideo | null> | null = null

async function loadRecapVideo(): Promise<RecapVideo | null> {
  // Route dédiée du serveur
  try {
    const response = await fetch(`${API_URL}/api/hero-videos/recap`)
    if (response.ok) {
      const data = await response.json()
      if (data?.success) return data.video ?? null
    }
  } catch {
    // on tente le repli ci-dessous
  }

  // Repli (serveur pas encore à jour) : le récap est encore dans la liste des
  // vidéos de la section d'accueil.
  try {
    const response = await fetch(`${API_URL}/api/hero-videos/active`)
    const data = await response.json()
    const recaps: RecapVideo[] = Array.isArray(data?.videos) ? data.videos.filter(isRecapVideo) : []
    const latest = recaps
      .map((video) => ({ video, time: video.created_at ? Date.parse(video.created_at) : NaN }))
      .sort((a, b) => (Number.isNaN(b.time) ? -1 : b.time) - (Number.isNaN(a.time) ? -1 : a.time))[0]
    if (!latest) return null
    const tooOld = !Number.isNaN(latest.time) && Date.now() - latest.time > RECAP_MAX_AGE_HOURS * 3600 * 1000
    return tooOld ? null : latest.video
  } catch {
    return null
  }
}

/** Récap du jour. Une seule requête, même si plusieurs modules le demandent. */
export function fetchRecapVideo(): Promise<RecapVideo | null> {
  if (!pending) pending = loadRecapVideo()
  return pending
}
