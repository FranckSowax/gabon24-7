'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2, CheckCircle, XCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react'

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

  const maxChecks = 60 // 10 minutes max (10s interval)

  const checkStatus = useCallback(async () => {
    if (!reference || checkCount >= maxChecks) return

    setIsChecking(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`${API_URL}/api/payments/status/${reference}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      })

      const data = await response.json()

      if (data.success && data.payment) {
        setStatus(data.payment.status)

        if (data.payment.status === 'completed') {
          setTimeout(() => {
            router.push(`/paiement/succes?reference=${reference}`)
          }, 1500)
        } else if (data.payment.status === 'failed' || data.payment.status === 'cancelled') {
          setTimeout(() => {
            router.push(`/paiement/echec?reference=${reference}&reason=${data.payment.status}`)
          }, 1500)
        }
      }
    } catch (error) {
      console.warn('Erreur vérification statut:', error)
    } finally {
      setIsChecking(false)
      setCheckCount(prev => prev + 1)
    }
  }, [reference, checkCount, maxChecks, router])

  useEffect(() => {
    if (!reference) {
      router.push('/mon-profil')
      return
    }

    // Vérifier immédiatement puis toutes les 10 secondes
    checkStatus()
    const interval = setInterval(checkStatus, 10000)

    return () => clearInterval(interval)
  }, [reference, checkStatus, router])

  const handleManualCheck = () => {
    setCheckCount(0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen w-full">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-lg mx-auto mt-12">
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-8 text-center">
              {/* Icône animée */}
              <div className="mb-8">
                {status === 'pending' && (
                  <div className="relative inline-block">
                    <div className="w-24 h-24 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center">
                      <Clock className="w-12 h-12 text-orange-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center animate-bounce">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  </div>
                )}

                {status === 'completed' && (
                  <div className="w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-400" />
                  </div>
                )}

                {(status === 'failed' || status === 'cancelled') && (
                  <div className="w-24 h-24 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-red-400" />
                  </div>
                )}
              </div>

              {/* Titre et message */}
              {status === 'pending' && (
                <>
                  <h1 className="text-2xl font-bold text-white mb-4">
                    En attente de paiement
                  </h1>
                  <p className="text-gray-400 mb-6">
                    Complétez votre paiement sur le portail E-Billing.
                    <br />
                    <strong className="text-gray-300">Cette page se mettra à jour automatiquement.</strong>
                  </p>

                  {/* Lien vers le portail */}
                  <div className="mb-6">
                    <p className="text-sm text-gray-500 mb-2">Le portail de paiement ne s&apos;est pas ouvert ?</p>
                    <button
                      onClick={() => {
                        const paymentUrl = localStorage.getItem('ebilling_payment_url')
                        if (paymentUrl) {
                          window.open(paymentUrl, '_blank')
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ouvrir le portail de paiement
                    </button>
                  </div>

                  {/* Animation d'attente */}
                  <div className="flex items-center justify-center gap-2 text-orange-400 mb-6">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Vérification en cours...</span>
                  </div>

                  {/* Indicateur de progression */}
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-6">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
                      style={{ width: `${Math.min((checkCount / maxChecks) * 100, 100)}%` }}
                    />
                  </div>

                  {/* Instructions */}
                  <div className="bg-gray-700/30 rounded-xl p-4 mb-6 text-left">
                    <p className="text-sm text-gray-400">
                      <strong className="text-gray-300">Référence:</strong> {reference}
                    </p>
                    <p className="text-sm text-gray-500 mt-3">
                      Si le paiement n&apos;aboutit pas:
                    </p>
                    <ul className="text-sm text-gray-500 list-disc list-inside mt-1 space-y-1">
                      <li>Vérifiez que vous avez bien complété le paiement sur le portail</li>
                      <li>Assurez-vous d&apos;avoir un solde suffisant</li>
                      <li>Essayez un autre moyen de paiement</li>
                    </ul>
                  </div>

                  {/* Boutons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleManualCheck}
                      disabled={isChecking}
                      className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                      Vérifier le statut
                    </button>
                    <button
                      onClick={() => router.push('/mon-profil')}
                      className="flex-1 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}

              {status === 'completed' && (
                <>
                  <h1 className="text-2xl font-bold text-green-400 mb-4">
                    Paiement réussi !
                  </h1>
                  <p className="text-gray-400 mb-6">
                    Votre paiement a été confirmé. Redirection en cours...
                  </p>
                  <Loader2 className="w-8 h-8 animate-spin text-green-400 mx-auto" />
                </>
              )}

              {(status === 'failed' || status === 'cancelled') && (
                <>
                  <h1 className="text-2xl font-bold text-red-400 mb-4">
                    {status === 'cancelled' ? 'Paiement annulé' : 'Paiement échoué'}
                  </h1>
                  <p className="text-gray-400 mb-6">
                    {status === 'cancelled'
                      ? 'Le paiement a été annulé.'
                      : 'Le paiement n\'a pas pu être traité.'}
                    <br />
                    Redirection en cours...
                  </p>
                  <Loader2 className="w-8 h-8 animate-spin text-red-400 mx-auto" />
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
        <p className="mt-4 text-gray-400">Chargement...</p>
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
