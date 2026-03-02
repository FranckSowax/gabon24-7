'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Clock, Bell, ArrowRight, CheckCircle, AlertTriangle, Search, BarChart3, ExternalLink } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

export default function VeilleDemoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <VeilleDemoContent />
    </Suspense>
  )
}

function VeilleDemoContent() {
  const searchParams = useSearchParams()
  const whatsapp = searchParams?.get('whatsapp') || ''

  const [trialEnd, setTrialEnd] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [keywords, setKeywords] = useState<string[]>([])
  const [matchCount, setMatchCount] = useState(0)
  const [hasAccount, setHasAccount] = useState(false)

  useEffect(() => {
    if (!whatsapp) {
      setLoading(false)
      return
    }

    fetch(`${API_URL}/api/veille/demo/status?whatsapp=${encodeURIComponent(whatsapp)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.found) {
          setTrialEnd(data.trial.trialEnd)
          setIsExpired(data.trial.isExpired)
          setKeywords(data.trial.keywords || [])
          setMatchCount(data.trial.matchCount || 0)
          setHasAccount(data.trial.hasAccount || false)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [whatsapp])

  // Countdown timer
  useEffect(() => {
    if (!trialEnd || isExpired) return

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const end = new Date(trialEnd).getTime()
      const diff = end - now

      if (diff <= 0) {
        setIsExpired(true)
        clearInterval(interval)
        return
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000)
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [trialEnd, isExpired])

  // Refresh match count every 2 minutes
  useEffect(() => {
    if (!whatsapp || isExpired) return

    const interval = setInterval(() => {
      fetch(`${API_URL}/api/veille/demo/status?whatsapp=${encodeURIComponent(whatsapp)}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.found) {
            setMatchCount(data.trial.matchCount || 0)
          }
        })
        .catch(() => {})
    }, 120000)

    return () => clearInterval(interval)
  }, [whatsapp, isExpired])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!whatsapp || !trialEnd) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Demo non trouvee</h1>
          <p className="text-gray-500 mb-6">
            Aucune demo active trouvee. Demarrez votre essai gratuit de 24h.
          </p>
          <Link
            href="/veille-alertes#demo"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl"
          >
            Demarrer la demo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Demo terminee</h1>
          <p className="text-gray-500 mb-4">
            Votre periode d&apos;essai de 24h est ecoulee. Abonnez-vous pour continuer
            a recevoir vos alertes sur WhatsApp.
          </p>
          {matchCount > 0 && (
            <p className="text-sm text-gray-400 mb-8">
              {matchCount} article{matchCount > 1 ? 's' : ''} detecte{matchCount > 1 ? 's' : ''} pendant votre demo.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/veille-alertes/subscribe?plan=particulier"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-50 text-blue-600 font-semibold rounded-xl hover:bg-blue-100 transition-colors"
            >
              Particulier - 2 000 FCFA/mois
            </Link>
            <Link
              href="/veille-alertes/subscribe?plan=entreprise"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-md transition-all"
            >
              Entreprise - 15 000 FCFA/mois
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <Link
          href="/veille-alertes"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8"
        >
          Retour
        </Link>

        {/* Status Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Demo active</h1>
          <p className="text-gray-500 mb-6">
            Vos alertes sont actives sur <strong>{whatsapp}</strong>
          </p>

          {/* Countdown */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <p className="text-sm text-gray-500 mb-3">Temps restant</p>
            <div className="flex items-center justify-center gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {String(timeLeft.hours).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400 mt-1">heures</div>
              </div>
              <span className="text-2xl text-gray-300">:</span>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400 mt-1">minutes</div>
              </div>
              <span className="text-2xl text-gray-300">:</span>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-400 mt-1">secondes</div>
              </div>
            </div>
          </div>
        </div>

        {/* Keywords & Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Keywords */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900">Vos mots-cles</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {keywords.length > 0 ? keywords.map((kw, i) => (
                <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 text-sm rounded-full font-medium">
                  {kw}
                </span>
              )) : (
                <span className="text-sm text-gray-400 italic">Non disponible</span>
              )}
            </div>
          </div>

          {/* Match count */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-900">Articles detectes</h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">{matchCount}</span>
              <span className="text-sm text-gray-400">article{matchCount !== 1 ? 's' : ''}</span>
            </div>
            {matchCount > 0 && (
              <p className="text-xs text-green-600 mt-1">Envoyes sur WhatsApp</p>
            )}
          </div>
        </div>

        {/* Dashboard link (only for users with accounts) */}
        {hasAccount && (
          <Link
            href="/veille"
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5 mb-6 hover:border-orange-300 hover:shadow-sm transition-all group"
          >
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                Tableau de bord Veille
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Voir vos alertes, articles detectes et statistiques
              </p>
            </div>
            <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-orange-500 transition-colors flex-shrink-0" />
          </Link>
        )}

        {/* What's happening */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-orange-500" />
            Ce qui se passe
          </h2>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
              Notre IA scanne les actualites gabonaises toutes les heures
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
              Les articles correspondant a vos mots-cles sont detectes
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
              Vous recevez un carrousel WhatsApp avec les articles (max 5 par envoi)
            </li>
          </ul>
        </div>

        {/* Subscribe CTA */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-center text-white">
          <h3 className="text-lg font-semibold mb-2">Satisfait ? Abonnez-vous !</h3>
          <p className="text-orange-100 text-sm mb-4">
            A partir de 2 000 FCFA/mois avec le plan Particulier
          </p>
          <Link
            href="/veille-alertes#tarifs"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-orange-600 font-semibold rounded-xl hover:shadow-md transition-all"
          >
            Voir les offres
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
