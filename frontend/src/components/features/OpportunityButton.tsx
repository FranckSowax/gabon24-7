import Link from 'next/link'
import { ArrowRight, Lightbulb } from 'lucide-react'

/**
 * Adresse de l'analyse d'opportunité pour un article.
 *
 * WHY: on vise l'écran de l'analyseur avec l'article présélectionné, pas la
 * page qui lance l'analyse dès son ouverture. L'analyse coûte des crédits :
 * l'utilisateur la confirme lui-même sur l'écran d'arrivée, un clic dans le fil
 * d'actualités ne débite jamais rien.
 */
export function opportunityHref(articleId: string | number): string {
  return `/business/analyzer?aid=${encodeURIComponent(String(articleId))}`
}

interface OpportunityButtonProps {
  articleId: string | number
  /** `pill` : pastille dans la ligne d'informations. `row` : ligne pleine largeur sous la carte. */
  variant?: 'pill' | 'row'
  className?: string
}

const LABEL = 'Trouver une opportunité dans cet article'

/**
 * Bouton « Trouver une opportunité » d'une carte d'article.
 * Toujours visible (le survol n'existe pas sur téléphone), discret au repos,
 * il se renforce au survol de la carte : le conteneur de la carte doit porter
 * la classe `group`.
 *
 * @example
 *   <OpportunityButton articleId={article.id} />
 */
export function OpportunityButton({ articleId, variant = 'pill', className = '' }: OpportunityButtonProps) {
  const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1'

  if (variant === 'row') {
    return (
      <Link
        href={opportunityHref(articleId)}
        prefetch={false}
        title={LABEL}
        aria-label={LABEL}
        onClick={(event) => event.stopPropagation()}
        className={`flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 group-hover:border-amber-300 ${focusRing} ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Lightbulb className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {/* Les cartes « à la une » sont étroites : libellé court, sur deux lignes au besoin. */}
          <span className="leading-tight">Trouver une opportunité</span>
        </span>
        <ArrowRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    )
  }

  return (
    <Link
      href={opportunityHref(articleId)}
      prefetch={false}
      title={LABEL}
      aria-label={LABEL}
      onClick={(event) => event.stopPropagation()}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 sm:px-2.5 sm:py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500 hover:border-amber-500 hover:text-white group-hover:border-amber-400 group-hover:bg-amber-100 ${focusRing} ${className}`}
    >
      <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      {/* Libellé court sur téléphone, complet dès que la place le permet. */}
      <span className="sm:hidden">Opportunité</span>
      <span className="hidden sm:inline">Trouver une opportunité</span>
      <ArrowRight className="w-3 h-3 flex-shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
