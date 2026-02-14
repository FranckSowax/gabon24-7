'use client'

import { Suspense, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import {
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Lock,
  Wallet,
  ExternalLink
} from 'lucide-react'

type PaymentType = 'credits' | 'subscription' | 'quiz'

interface PaymentConfig {
  type: PaymentType
  amount: number
  description: string
  packageId?: string
  planSlug?: string
  quizId?: string
  credits?: number
  bonus?: number
  planName?: string
  duration?: number
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

function PaiementContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Récupérer les paramètres de paiement depuis l'URL
  useEffect(() => {
    if (!searchParams) {
      setIsInitializing(false)
      return
    }

    const type = searchParams.get('type') as PaymentType
    const amountStr = searchParams.get('amount')
    const amount = amountStr ? parseInt(amountStr) : 0
    const description = searchParams.get('description') || ''

    if (!type && !amountStr) {
      const timer = setTimeout(() => {
        setIsInitializing(false)
      }, 500)
      return () => clearTimeout(timer)
    }

    if (!type || !amount) {
      setError('Paramètres de paiement invalides. Veuillez retourner à la page précédente.')
      setIsInitializing(false)
      return
    }

    const config: PaymentConfig = {
      type,
      amount,
      description: decodeURIComponent(description),
      packageId: searchParams.get('packageId') || undefined,
      planSlug: searchParams.get('planSlug') || undefined,
      quizId: searchParams.get('quizId') || undefined,
      credits: parseInt(searchParams.get('credits') || '0') || undefined,
      bonus: parseInt(searchParams.get('bonus') || '0') || undefined,
      planName: searchParams.get('planName') || undefined,
      duration: parseInt(searchParams.get('duration') || '1') || 1,
    }

    setPaymentConfig(config)
    setError(null)
    setIsInitializing(false)
  }, [searchParams])

  // Rediriger si non connecté
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signup?redirect=/paiement?' + (searchParams?.toString() || ''))
    }
  }, [user, authLoading, router, searchParams])

  const handleSubmit = async () => {
    if (!user || !paymentConfig) return

    setIsLoading(true)
    setError(null)

    try {
      // Récupérer un token frais
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !sessionData.session) {
        setError('Votre session a expiré. Veuillez vous reconnecter.')
        setTimeout(() => {
          router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search))
        }, 2000)
        return
      }

      const token = sessionData.session.access_token

      let endpoint = ''
      let body: any = {}

      switch (paymentConfig.type) {
        case 'credits':
          endpoint = '/api/payments/credits'
          body.packageId = paymentConfig.packageId
          break
        case 'subscription':
          endpoint = '/api/payments/subscription'
          body.planSlug = paymentConfig.planSlug
          body.duration = paymentConfig.duration
          break
        case 'quiz':
          endpoint = '/api/payments/quiz'
          body.quizId = paymentConfig.quizId
          break
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de l\'initiation du paiement')
      }

      // Sauvegarder les infos pour les pages suivantes
      localStorage.setItem('ebilling_payment_reference', data.data.reference)
      localStorage.setItem('ebilling_payment_type', paymentConfig.type)
      if (data.data.payment_url) {
        localStorage.setItem('ebilling_payment_url', data.data.payment_url)
      }

      // Rediriger vers le portail E-Billing
      if (data.data.payment_url) {
        // Ouvrir le portail dans un nouvel onglet et naviguer vers la page d'attente
        window.open(data.data.payment_url, '_blank')
        router.push(`/paiement/attente?reference=${data.data.reference}`)
      } else {
        // Fallback: aller directement à la page d'attente
        router.push(`/paiement/attente?reference=${data.data.reference}`)
      }

    } catch (err: any) {
      console.error('Erreur paiement:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = () => {
    switch (paymentConfig?.type) {
      case 'credits':
        return <Zap className="w-6 h-6" />
      case 'subscription':
        return <CreditCard className="w-6 h-6" />
      case 'quiz':
        return <Wallet className="w-6 h-6" />
      default:
        return <CreditCard className="w-6 h-6" />
    }
  }

  const getTypeLabel = () => {
    switch (paymentConfig?.type) {
      case 'credits':
        return 'Achat de crédits'
      case 'subscription':
        return 'Abonnement'
      case 'quiz':
        return 'Inscription Quiz'
      default:
        return 'Paiement'
    }
  }

  const getTypeColor = () => {
    switch (paymentConfig?.type) {
      case 'credits':
        return 'from-yellow-500 to-orange-500'
      case 'subscription':
        return 'from-purple-500 to-indigo-500'
      case 'quiz':
        return 'from-blue-500 to-cyan-500'
      default:
        return 'from-orange-500 to-red-500'
    }
  }

  if (authLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-orange-500/30 rounded-full animate-pulse"></div>
            <Loader2 className="w-16 h-16 animate-spin text-orange-500 absolute top-0 left-0" />
          </div>
          <p className="mt-4 text-gray-400">Préparation du paiement...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  if (!paymentConfig && !isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        <div className="flex min-h-screen w-full">
          <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />
          <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-red-500/20 rounded-full mx-auto mb-6 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">Paramètres manquants</h1>
              <p className="text-gray-400 mb-6">
                Les informations de paiement sont incomplètes. Veuillez retourner à la page précédente et réessayer.
              </p>
              <button
                onClick={() => router.back()}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors"
              >
                Retour
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen w-full">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-lg mx-auto pt-4">
            {/* Header */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Retour</span>
            </button>

            {/* Carte de paiement */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-700/50 overflow-hidden shadow-2xl">
              {/* Header avec gradient */}
              <div className={`bg-gradient-to-r ${getTypeColor()} p-6`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    {getTypeIcon()}
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">{getTypeLabel()}</p>
                    <p className="text-3xl font-bold text-white">
                      {paymentConfig?.amount.toLocaleString('fr-FR')} <span className="text-lg">FCFA</span>
                    </p>
                  </div>
                </div>
                {paymentConfig?.description && (
                  <p className="mt-4 text-white/80 text-sm bg-white/10 rounded-xl px-4 py-2">
                    {paymentConfig.description}
                  </p>
                )}
              </div>

              {/* Contenu */}
              <div className="p-6 space-y-6">
                {/* Détails crédits */}
                {paymentConfig?.credits && (
                  <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                    <span className="text-gray-400">Crédits</span>
                    <span className="font-bold text-green-400">
                      +{paymentConfig.credits}{paymentConfig.bonus ? ` + ${paymentConfig.bonus} bonus` : ''} crédits
                    </span>
                  </div>
                )}

                {/* Redirection portail */}
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <ExternalLink className="w-5 h-5 text-orange-400" />
                    <h4 className="font-medium text-orange-300">Paiement sur portail sécurisé</h4>
                  </div>
                  <p className="text-sm text-gray-400">
                    Vous serez redirigé vers le portail sécurisé E-Billing pour finaliser votre paiement.
                    Vous pourrez y choisir votre moyen de paiement : Mobile Money (Airtel, Moov) ou Carte bancaire (Visa, Mastercard).
                  </p>
                </div>

                {/* Instructions */}
                <ol className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center text-xs text-orange-400 flex-shrink-0">1</span>
                    <span>Cliquez sur &quot;Payer&quot; ci-dessous</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center text-xs text-orange-400 flex-shrink-0">2</span>
                    <span>Choisissez votre moyen de paiement sur le portail E-Billing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center text-xs text-orange-400 flex-shrink-0">3</span>
                    <span>Votre paiement sera confirmé automatiquement</span>
                  </li>
                </ol>

                {/* Erreur */}
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {/* Bouton de paiement */}
                <button
                  onClick={handleSubmit}
                  disabled={isLoading || !paymentConfig}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/25"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Création de la facture...
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Payer {paymentConfig?.amount.toLocaleString('fr-FR')} FCFA
                      <ExternalLink className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Sécurité */}
                <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <Shield className="w-4 h-4" />
                  <span>Paiement sécurisé via E-Billing</span>
                </div>
              </div>
            </div>

            {/* Badges de confiance */}
            <div className="mt-6 flex items-center justify-center gap-6 text-gray-500">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                <span className="text-xs">SSL Sécurisé</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span className="text-xs">DriveBy Africa</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs">XAF</span>
              </div>
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
        <div className="relative">
          <div className="w-16 h-16 border-4 border-orange-500/30 rounded-full animate-pulse"></div>
          <Loader2 className="w-16 h-16 animate-spin text-orange-500 absolute top-0 left-0" />
        </div>
        <p className="mt-4 text-gray-400">Chargement...</p>
      </div>
    </div>
  )
}

export default function PaiementPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaiementContent />
    </Suspense>
  )
}
