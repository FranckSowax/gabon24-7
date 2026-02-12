'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { CheckCircle, Gift, Sparkles, ArrowRight, CreditCard, Crown, Loader2 } from 'lucide-react'

function SuccesContent() {
  const { user, refreshSubscription } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams?.get('reference') || null

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [paymentType, setPaymentType] = useState<string | null>(null)

  useEffect(() => {
    // Récupérer le type de paiement depuis le localStorage
    const type = localStorage.getItem('ebilling_payment_type')
    setPaymentType(type)

    // Pour les paiements quiz, rediriger vers la page du jeu après 3 secondes
    if (type === 'quiz') {
      const gameSessionId = localStorage.getItem('game_session_id')
      if (gameSessionId) {
        setTimeout(() => {
          localStorage.removeItem('ebilling_payment_reference')
          localStorage.removeItem('ebilling_payment_type')
          localStorage.removeItem('ebilling_payment_url')
          router.push(`/jeu/${gameSessionId}?registered=true`)
        }, 3000)
      }
    } else {
      localStorage.removeItem('ebilling_payment_reference')
      localStorage.removeItem('ebilling_payment_type')
      localStorage.removeItem('ebilling_payment_url')
    }

    // Rafraîchir les données utilisateur (abonnement, crédits)
    if (refreshSubscription) {
      refreshSubscription()
    }

    // Animation de confettis (chargé dynamiquement)
    let interval: NodeJS.Timeout
    import('canvas-confetti').then(({ default: confetti }) => {
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#f97316', '#ef4444', '#22c55e', '#eab308']
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#f97316', '#ef4444', '#22c55e', '#eab308']
        })
      }, 250)
    })

    return () => { if (interval) clearInterval(interval) }
  }, [refreshSubscription, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen w-full">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto mt-8">
            {/* Carte principale */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {/* Header vert */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center text-white">
                <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 flex items-center justify-center backdrop-blur-sm">
                  <CheckCircle className="w-12 h-12" />
                </div>
                <h1 className="text-3xl font-bold mb-2">Paiement réussi !</h1>
                <p className="text-green-100">Merci pour votre confiance</p>
              </div>

              {/* Contenu */}
              <div className="p-8">
                {/* Message selon le type */}
                {paymentType === 'credits' && (
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Gift className="w-8 h-8 text-yellow-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      Vos crédits ont été ajoutés !
                    </h2>
                    <p className="text-gray-600">
                      Vous pouvez maintenant utiliser vos crédits pour générer du contenu IA,
                      des résumés audio, des business plans et bien plus.
                    </p>
                  </div>
                )}

                {paymentType === 'subscription' && (
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Crown className="w-8 h-8 text-purple-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      Abonnement activé !
                    </h2>
                    <p className="text-gray-600">
                      Profitez de tous les avantages de votre nouvel abonnement.
                      Vos crédits mensuels ont été crédités sur votre compte.
                    </p>
                  </div>
                )}

                {paymentType === 'quiz' && (
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      Inscription confirmée !
                    </h2>
                    <p className="text-gray-600">
                      Vous êtes inscrit au quiz. Préparez-vous à tester vos connaissances
                      et à gagner des prix !
                    </p>
                    <p className="text-sm text-orange-600 mt-3 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirection vers le jeu...
                    </p>
                  </div>
                )}

                {!paymentType && (
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <CreditCard className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      Transaction confirmée
                    </h2>
                    <p className="text-gray-600">
                      Votre paiement a été traité avec succès.
                    </p>
                  </div>
                )}

                {/* Référence */}
                {reference && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-500 text-center">
                      Référence de transaction: <span className="font-mono font-medium text-gray-700">{reference}</span>
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/mon-profil?tab=credits')}
                    className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-red-700 flex items-center justify-center gap-2 transition-all"
                  >
                    Voir mon solde
                    <ArrowRight className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => router.push('/')}
                    className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                  >
                    Retour à l'accueil
                  </button>
                </div>

                {/* Note */}
                <p className="text-center text-sm text-gray-500 mt-6">
                  Un email de confirmation vous sera envoyé dans les prochaines minutes.
                </p>
              </div>
            </div>

            {/* Suggestions */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/business/creer-projet')}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Business Plan IA</h3>
                    <p className="text-sm text-gray-500">Créer un projet</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/audio')}
                className="p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                    <span className="text-xl group-hover:scale-110 transition-transform">🎧</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Résumés Audio</h3>
                    <p className="text-sm text-gray-500">Écouter l'actu</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-green-500 mx-auto" />
        <p className="mt-4 text-gray-600">Chargement...</p>
      </div>
    </div>
  )
}

export default function PaiementSuccesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SuccesContent />
    </Suspense>
  )
}
