'use client'

import { useState } from 'react'
import { getSourceInitials, getSourceLogo } from '@/lib/source-logos'

interface SourcePlaceholderProps {
  /** Nom du média d'origine de l'article */
  source?: string | null
  /** `large` : grande carte ; `small` : vignette carrée des listes */
  size?: 'large' | 'small'
}

/**
 * Remplace l'image d'un article qui n'en a pas : logo du média d'origine, ou
 * ses initiales si le logo est inconnu ou ne se charge pas.
 *
 * @example
 *   <SourcePlaceholder source={article.source} size="large" />
 */
export default function SourcePlaceholder({ source, size = 'large' }: SourcePlaceholderProps) {
  const logo = getSourceLogo(source)
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = Boolean(logo) && !logoFailed
  const isLarge = size === 'large'

  return (
    <div
      className="w-full h-full flex items-center justify-center bg-gray-100"
      role="img"
      aria-label={source ? `Article de ${source}, sans image` : 'Article sans image'}
    >
      {showLogo ? (
        <img
          src={logo}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
          className={isLarge
            ? 'w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-xl bg-white p-2 shadow-sm -mt-8'
            : 'w-10 h-10 sm:w-12 sm:h-12 object-contain'}
        />
      ) : (
        <span
          className={isLarge
            ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white shadow-sm flex items-center justify-center text-2xl sm:text-3xl font-bold text-gray-500 -mt-8'
            : 'text-base sm:text-lg font-bold text-gray-500'}
        >
          {getSourceInitials(source)}
        </span>
      )}
    </div>
  )
}
