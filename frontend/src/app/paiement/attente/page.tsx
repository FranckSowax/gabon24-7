'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2, Phone, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

type PaymentStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

function AttenteContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const reference = searchParams?.get('reference') || null

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [checkCount, setCheckCount] = useState(0)
  const [isChecking, setIsChecking] = useState(false)

  const maxChecks = 30 // 5 minutes max (10s interval)

  useEffect(() => {
    if (!reference) {
      router.push('/mon-profil')
      return
    }

    // Vérifier le statut périodiquement
    const checkStatus = async () => {
      if (checkCount >= maxChecks) return

      setIsChecking(true)
      try {
        const token = localStorage.getItem('supabase_token')
        const response = await fetch(`${API_URL}/api/payments/pvit-status/${reference}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        const data = await response.json()

        if (data.success && data.payment) {
          setStatus(data.payment.status)

          if (data.payment.status === 'completed') {
            // Rediriger vers la page de succès
            setTimeout(() => {
              router.push(`/paiement/succes?reference=${reference}`)
            }, 1500)
          } else if (data.payment.status === 'failed' || data.payment.status === 'cancelled') {
            // Rediriger vers la page d'échec
            setTimeout(() => {
              router.push(`/paiement/echec?reference=${reference}&reason=${data.payment.status}`)
            }, 1500)
          }
        }
      } catch (error) {
        console.error('Erreur vérification statut:', error)
      } finally {
        setIsChecking(false)
        setCheckCount(prev => prev + 1)
      }
    }

    // Vérifier immédiatement puis toutes les 10 secondes
    checkStatus()
    const interval = setInterval(checkStatus, 10000)

    return () => clearInterval(interval)
  }, [reference, checkCount, router])

  const handleManualCheck = async () => {
    setCheckCount(0) // Reset le compteur pour permettre plus de vérifications
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen w-full">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-lg mx-auto mt-12">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              {/* Icône animée */}
              <div className="mb-8">
                {status === 'pending' && (
                  <div className="relative">
                    <div className="w-24 h-24 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                      <Phone className="w-12 h-12 text-orange-500" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center animate-bounce">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  </div>
                )}

                {status === 'completed' && (
                  <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                )}

                {(status === 'failed' || status === 'cancelled') && (
                  <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-red-500" />
                  </div>
                )}
              </div>

              {/* Titre et message */}
              {status === 'pending' && (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">
                    Vérifiez votre téléphone
                  </h1>
                  <p className="text-gray-600 mb-6">
                    Une demande de paiement a été envoyée sur votre téléphone.
                    <br />
                    <strong>Composez votre code PIN</strong> pour confirmer.
                  </p>

                  {/* Animation d'attente */}
                  <div className="flex items-center justify-center gap-2 text-orange-600 mb-6">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm">En attente de confirmation...</span>
                  </div>

                  {/* Indicateur de progression */}
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min((checkCount / maxChecks) * 100, 100)}%` }}
                    />
                  </div>

                  {/* Instructions */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                    <p className="text-sm text-gray-600">
                      <strong>Référence:</strong> {reference}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Si vous ne recevez pas de notification, vérifiez:
                    </p>
                    <ul className="text-sm text-gray-500 list-disc list-inside mt-1">
                      <li>Que votre numéro est correct</li>
                      <li>Que vous avez suffisamment de solde</li>
                      <li>Que votre réseau fonctionne</li>
                    </ul>
                  </div>

                  {/* Boutons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleManualCheck}
                      disabled={isChecking}
                      className="flex-1 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                      Vérifier le statut
                    </button>
                    <button
                      onClick={() => router.push('/mon-profil')}
                      className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}

              {status === 'completed' && (
                <>
                  <h1 className="text-2xl font-bold text-green-600 mb-4">
                    Paiement réussi !
                  </h1>
                  <p className="text-gray-600 mb-6">
                    Votre paiement a été confirmé. Redirection en cours...
                  </p>
                  <Loader2 className="w-8 h-8 animate-spin text-green-500 mx-auto" />
                </>
              )}

              {(status === 'failed' || status === 'cancelled') && (
                <>
                  <h1 className="text-2xl font-bold text-red-600 mb-4">
                    {status === 'cancelled' ? 'Paiement annulé' : 'Paiement échoué'}
                  </h1>
                  <p className="text-gray-600 mb-6">
                    {status === 'cancelled'
                      ? 'Vous avez annulé le paiement.'
                      : 'Le paiement n\'a pas pu être traité.'}
                    <br />
                    Redirection en cours...
                  </p>
                  <Loader2 className="w-8 h-8 animate-spin text-red-500 mx-auto" />
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
        <p className="mt-4 text-gray-600">Chargement...</p>
      </div>
    </div>
  )
}

export default function AttentePaiementPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AttenteContent />
    </Suspense>
  )
}
