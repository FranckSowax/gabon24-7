'use client'

/**
 * Galerie « Tendances » : les articles les plus lus de la semaine, en bandeau
 * horizontal glissable, insérée dans le fil de l'accueil.
 * Elle remplace l'ancien onglet Tendances.
 */

import { Flame } from 'lucide-react'

interface TrendingArticle {
  id: string
  title: string
  category?: string
  source?: string
  image_url?: string | null
  imageUrl?: string | null
  view_count?: number | string
  viewCount?: number | string
}

interface TrendingGalleryProps {
  articles: TrendingArticle[]
  onArticleClick: (article: TrendingArticle) => void
  /** En dessous de ce nombre d'articles, la galerie ne s'affiche pas. */
  minItems?: number
}

const MAX_ITEMS = 10

export default function TrendingGallery({ articles, onArticleClick, minItems = 3 }: TrendingGalleryProps) {
  const items = (articles || []).filter((article) => article && article.id && article.title).slice(0, MAX_ITEMS)
  if (items.length < minItems) return null

  return (
    <section aria-labelledby="trending-gallery-title" className="my-2">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 id="trending-gallery-title" className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Flame className="w-5 h-5 text-orange-500" aria-hidden="true" />
            Tendances
          </h2>
          <p className="text-xs text-gray-500">Les articles les plus lus de la semaine</p>
        </div>
        <span className="hidden sm:block text-[11px] text-gray-400" aria-hidden="true">Faites glisser →</span>
      </div>

      <ol className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scrollbar-hide">
        {items.map((article, index) => {
          const image = article.image_url || article.imageUrl || null
          const views = Number(article.view_count ?? article.viewCount ?? 0)
          return (
            <li key={article.id} className="snap-start flex-shrink-0 w-56 sm:w-60">
              <button
                type="button"
                onClick={() => onArticleClick(article)}
                className="group w-full text-left rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
              >
                <div className="relative h-32 bg-gray-100">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(event) => { event.currentTarget.style.display = 'none' }}
                    />
                  ) : null}
                  <span
                    className="absolute top-2 left-2 w-7 h-7 rounded-full bg-gray-900/85 text-white text-sm font-bold flex items-center justify-center"
                    aria-label={`Numéro ${index + 1}`}
                  >
                    {index + 1}
                  </span>
                </div>
                <div className="p-3">
                  {article.category && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 mb-1 truncate">
                      {article.category}
                    </p>
                  )}
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-3 min-h-[3.75rem]">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-[11px] text-gray-500 truncate">
                    {article.source}
                    {/* Le nombre de lectures n'est montré que s'il veut dire quelque chose. */}
                    {views >= 10 && <span> · {views.toLocaleString('fr-FR')} lectures</span>}
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
