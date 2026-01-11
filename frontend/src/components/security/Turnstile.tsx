'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

// Types pour Turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement | string, options: TurnstileOptions) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
      getResponse: (widgetId: string) => string | undefined
    }
    onTurnstileLoad?: () => void
  }
}

interface TurnstileOptions {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: (error: Error) => void
  'expired-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  size?: 'normal' | 'compact' | 'invisible'
  appearance?: 'always' | 'execute' | 'interaction-only'
  retry?: 'auto' | 'never'
  'retry-interval'?: number
  'refresh-expired'?: 'auto' | 'manual' | 'never'
  action?: string
  cData?: string
}

interface TurnstileProps {
  siteKey: string
  onVerify: (token: string) => void
  onError?: (error: Error) => void
  onExpire?: () => void
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'invisible'
  className?: string
  action?: string
}

export default function Turnstile({
  siteKey,
  onVerify,
  onError,
  onExpire,
  theme = 'auto',
  size = 'normal',
  className = '',
  action
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile) return

    // Ne pas re-render si le widget existe déjà
    if (widgetIdRef.current) {
      return
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setIsLoading(false)
          setHasError(false)
          onVerify(token)
        },
        'error-callback': (error: Error) => {
          setIsLoading(false)
          setHasError(true)
          onError?.(error)
        },
        'expired-callback': () => {
          setHasError(false)
          onExpire?.()
        },
        theme,
        size,
        language: 'fr',
        appearance: 'always',
        retry: 'auto',
        'retry-interval': 8000,
        'refresh-expired': 'manual', // Éviter le refresh auto qui cause le clignotement
        action
      })
      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
      setHasError(true)
      console.error('Erreur Turnstile:', error)
    }
  }, [siteKey, onVerify, onError, onExpire, theme, size, action])

  useEffect(() => {
    // Vérifier si le script est déjà chargé
    if (window.turnstile) {
      renderWidget()
      return
    }

    // Charger le script Turnstile
    const existingScript = document.querySelector('script[src*="turnstile"]')
    if (existingScript) {
      // Script existe mais pas encore chargé
      window.onTurnstileLoad = renderWidget
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    script.defer = true

    window.onTurnstileLoad = renderWidget

    script.onerror = () => {
      setIsLoading(false)
      setHasError(true)
      onError?.(new Error('Impossible de charger le captcha'))
    }

    document.head.appendChild(script)

    return () => {
      // Nettoyage
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current)
        } catch (e) {
          // Ignorer
        }
      }
    }
  }, [renderWidget, onError])

  // Fonction pour réinitialiser le widget (exposée via ref si nécessaire)
  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current)
    }
  }, [])

  return (
    <div className={`turnstile-container ${className}`}>
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
          <span className="ml-2 text-sm text-gray-400">Chargement de la vérification...</span>
        </div>
      )}

      {hasError && (
        <div className="text-center py-4">
          <p className="text-red-400 text-sm mb-2">Erreur de chargement du captcha</p>
          <button
            type="button"
            onClick={() => {
              setHasError(false)
              setIsLoading(true)
              renderWidget()
            }}
            className="text-orange-500 hover:text-orange-400 text-sm underline"
          >
            Réessayer
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={isLoading || hasError ? 'hidden' : ''}
      />
    </div>
  )
}

// Hook pour utiliser Turnstile de manière invisible
export function useTurnstile(siteKey: string) {
  const [token, setToken] = useState<string | null>(null)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleVerify = useCallback((newToken: string) => {
    setToken(newToken)
    setIsVerified(true)
    setError(null)
  }, [])

  const handleError = useCallback((err: Error) => {
    setError(err.message)
    setIsVerified(false)
  }, [])

  const handleExpire = useCallback(() => {
    setToken(null)
    setIsVerified(false)
  }, [])

  const reset = useCallback(() => {
    setToken(null)
    setIsVerified(false)
    setError(null)
  }, [])

  return {
    token,
    isVerified,
    error,
    handleVerify,
    handleError,
    handleExpire,
    reset,
    siteKey
  }
}
