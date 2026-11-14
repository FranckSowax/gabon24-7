'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Play } from 'lucide-react'
import { fetchRecapVideo, recapHeadlines, type RecapVideo } from '@/lib/recap-video'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const DESKTOP_QUERY = '(min-width: 1024px)'

// Les récaps produits par l'agent sont verticaux (720 × 1280, format téléphone).
// Proportions supposées tant que la vidéo n'a pas communiqué les siennes, pour
// que le module ne change pas de taille au chargement.
const DEFAULT_RATIO = 9 / 16

// Instant de la vidéo montré comme vignette. Les récaps s'ouvrent sur un écran
// noir : on montre une image prise un peu plus loin, et la lecture repart du début.
const POSTER_SECONDS = 2

interface RecapVideoModuleProps {
  /**
   * `sidebar` : module de la barre latérale droite, affiché sur ordinateur.
   * `compact` : carte du fil principal, affichée sur mobile et tablette.
   */
  variant: 'sidebar' | 'compact'
}

/**
 * Module « Le récap vidéo » : la vidéo récapitulative de l'actualité du jour.
 *
 * Contrairement aux vidéos de la section d'accueil, elle ne démarre pas toute
 * seule : c'est un contenu à écouter, lancé par le lecteur, avec le son et les
 * commandes de lecture. Avant qu'il appuie sur lecture, seule la première
 * image est chargée.
 *
 * Le module ne s'affiche que sur la taille d'écran de sa variante, et se
 * masque entièrement s'il n'y a pas de récap récent.
 *
 * @example
 *   <RecapVideoModule variant="sidebar" />
 */
export default function RecapVideoModule({ variant }: RecapVideoModuleProps) {
  const [video, setVideo] = useState<RecapVideo | null>(null)
  // null tant que la taille d'écran n'est pas connue (rendu serveur, premier affichage)
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null)
  const [playing, setPlaying] = useState(false)
  const [ratio, setRatio] = useState(DEFAULT_RATIO)
  const videoRef = useRef<HTMLVideoElement>(null)
  const viewTracked = useRef(false)

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const visible = isDesktop !== null && (variant === 'sidebar') === isDesktop

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    fetchRecapVideo().then((result) => { if (!cancelled) setVideo(result) })
    return () => { cancelled = true }
  }, [visible])

  if (!visible || !video) return null

  const isSidebar = variant === 'sidebar'
  const collapsed = !isSidebar && !playing
  const isPortrait = ratio < 1
  const headlines = recapHeadlines(video.description, isSidebar ? 3 : 1)
  const title = video.title || 'Le récap de l\'actualité'

  // Taille du cadre vidéo. Une vidéo verticale est bornée en hauteur (sa largeur
  // en découle) pour ne pas remplir la barre latérale ni l'écran du téléphone ;
  // une vidéo horizontale prend la largeur disponible.
  const frameStyle: React.CSSProperties = { aspectRatio: String(ratio) }
  if (collapsed) {
    // Vignette de la carte repliée
    if (isPortrait) frameStyle.height = '7.5rem'
    else frameStyle.width = '8.5rem'
  } else if (isPortrait) {
    frameStyle.height = isSidebar ? '23rem' : 'min(70vh, 34rem)'
  } else {
    frameStyle.width = '100%'
  }

  // Appelé dans le geste du lecteur : indispensable pour que le navigateur
  // (notamment sur iPhone) autorise la lecture avec le son.
  const start = () => {
    setPlaying(true)
    const element = videoRef.current
    if (!element) return
    element.muted = false
    element.currentTime = 0 // la vignette était prise plus loin dans la vidéo
    const attempt = element.play()
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {})
  }

  const trackView = () => {
    if (viewTracked.current) return
    viewTracked.current = true
    try {
      const url = `${API_URL}/api/hero-videos/${video.id}/view`
      if (navigator.sendBeacon) navigator.sendBeacon(url)
      else fetch(url, { method: 'POST', keepalive: true }).catch(() => {})
    } catch { /* le suivi d'audience ne doit jamais gêner la lecture */ }
  }

  const label = <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Le récap vidéo</p>

  const cta = video.cta_label && video.cta_url ? (
    <a
      href={video.cta_url}
      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700"
    >
      {video.cta_label}
      <ArrowRight className="h-4 w-4" />
    </a>
  ) : null

  // Le même élément <video> sert à la vignette et à la lecture : seule la taille
  // de son cadre change. Le lancer dans le geste du lecteur reste ainsi possible.
  const frame = (
    <div className={`flex justify-center overflow-hidden rounded-lg bg-black ${collapsed ? 'flex-shrink-0' : 'w-full'}`}>
      <div className="relative max-w-full" style={frameStyle}>
        <video
          ref={videoRef}
          // `#t=…` : affiche une image de la vidéo sans la télécharger en entier
          src={`${video.video_url}#t=${POSTER_SECONDS}`}
          preload="metadata"
          playsInline
          controls={playing}
          onLoadedMetadata={(event) => {
            const { videoWidth, videoHeight } = event.currentTarget
            if (videoWidth > 0 && videoHeight > 0) setRatio(videoWidth / videoHeight)
          }}
          onPlay={() => { setPlaying(true); trackView() }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!playing && (
          <button
            type="button"
            onClick={start}
            aria-label={`Lire la vidéo : ${title}`}
            className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35"
          >
            <span className={`flex items-center justify-center rounded-full bg-white/95 shadow-lg ${collapsed ? 'h-9 w-9' : 'h-14 w-14'}`}>
              <Play className={`ml-0.5 fill-orange-600 text-orange-600 ${collapsed ? 'h-4 w-4' : 'h-6 w-6'}`} />
            </span>
          </button>
        )}
      </div>
    </div>
  )

  if (isSidebar) {
    return (
      <section aria-label="Récap vidéo de l'actualité" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          {label}
          <h2 className="text-sm font-bold leading-snug text-gray-900">{title}</h2>
        </div>
        {frame}
        {headlines.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {headlines.map((headline) => (
              <li key={headline} className="flex gap-2 text-xs leading-snug text-gray-600">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-orange-500" />
                <span className="line-clamp-2">{headline}</span>
              </li>
            ))}
          </ul>
        )}
        {cta}
      </section>
    )
  }

  // Mobile et tablette : carte repliée (vignette + titre) placée sous la section
  // d'accueil. Au premier appui, la vidéo s'agrandit dans la carte et se lance,
  // sans quitter le fil d'articles.
  return (
    <section aria-label="Récap vidéo de l'actualité" className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className={collapsed ? 'flex items-center gap-3' : 'flex flex-col gap-3'}>
        {frame}
        <div className="min-w-0 flex-1">
          {label}
          <h2 className="text-sm font-bold leading-snug text-gray-900">{title}</h2>
          {collapsed && headlines[0] && <p className="mt-1 line-clamp-2 text-xs text-gray-600">{headlines[0]}</p>}
          {collapsed ? (
            <button type="button" onClick={start} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600">
              <Play className="h-3.5 w-3.5 fill-orange-600" />
              Regarder le récap
            </button>
          ) : cta}
        </div>
      </div>
    </section>
  )
}
