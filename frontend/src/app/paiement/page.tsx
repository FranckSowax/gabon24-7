'use client'

import { Suspense, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import {
  Phone,
  CreditCard,
  Shield,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  Zap,
  Lock,
  Wallet
} from 'lucide-react'

// Types de paiement supportés
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-backend-production.up.railway.app'

function PaiementContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)
  const [selectedOperator, setSelectedOperator] = useState<'airtel' | 'moov' | null>(null)

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

    // Si on n'a pas encore les params, on attend (Suspense hydration)
    if (!type && !amountStr) {
      // Attendre un peu pour le hydration
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

  // Pré-remplir le téléphone depuis le profil
  useEffect(() => {
    const phoneNumber = (user?.user_metadata as any)?.phone_number
    if (phoneNumber) {
      setPhone(phoneNumber)
      // Détecter l'opérateur
      detectOperator(phoneNumber)
    }
  }, [user])

  const detectOperator = (phoneNumber: string) => {
    const digits = phoneNumber.replace(/\D/g, '')
    // Format international sans 0: 74, 77 = Airtel | 62, 66 = Moov
    // Format local avec 0: 074, 077 = Airtel | 062, 066 = Moov
    if (digits.startsWith('74') || digits.startsWith('77') || digits.startsWith('074') || digits.startsWith('077')) {
      setSelectedOperator('airtel')
    } else if (digits.startsWith('62') || digits.startsWith('66') || digits.startsWith('062') || digits.startsWith('066')) {
      setSelectedOperator('moov')
    } else {
      setSelectedOperator(null)
    }
  }

  const formatPhone = (value: string) => {
    let digits = value.replace(/\D/g, '')

    // Si l'utilisateur entre un 0 au début, on l'enlève (format international)
    if (digits.startsWith('0')) {
      digits = digits.slice(1)
    }

    // Format: XX XX XX XX (8 chiffres sans le 0)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`
    if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)}`
  }

  const handlePhoneChange = (value: string) => {
    let digits = value.replace(/\D/g, '')

    // Si l'utilisateur entre un 0 au début, on l'enlève automatiquement
    if (digits.startsWith('0')) {
      digits = digits.slice(1)
    }

    // Limiter à 8 chiffres (format international sans indicatif)
    digits = digits.slice(0, 8)
    setPhone(digits)
    detectOperator(digits)
  }

  const validatePhone = (phoneNumber: string) => {
    let digits = phoneNumber.replace(/\D/g, '')

    // Enlever le 0 initial si présent
    if (digits.startsWith('0')) {
      digits = digits.slice(1)
    }

    // Format international: 8 chiffres exactement
    if (digits.length !== 8) {
      return false
    }

    // Préfixes valides sans le 0 initial:
    // Airtel: 74, 77
    // Moov: 62, 66
    const validPrefixes = ['74', '77', '62', '66']
    return validPrefixes.some(prefix => digits.startsWith(prefix))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !paymentConfig) return

    if (!validatePhone(phone)) {
      setError('Numéro de téléphone invalide. Utilisez un numéro Airtel ou Moov Gabon.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('sb-access-token')

      let endpoint = ''
      let body: any = { phone: phone.replace(/\D/g, '') }

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

      localStorage.setItem('pvit_payment_reference', data.data.reference)
      localStorage.setItem('pvit_payment_type', paymentConfig.type)

      router.push(`/paiement/attente?reference=${data.data.reference}`)

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

  // Page d'erreur si pas de config
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
                {/* Détails */}
                {paymentConfig?.credits && (
                  <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-xl">
                    <span className="text-gray-400">Crédits</span>
                    <span className="font-bold text-green-400">
                      +{paymentConfig.credits}{paymentConfig.bonus ? ` + ${paymentConfig.bonus} bonus` : ''} crédits
                    </span>
                  </div>
                )}

                {/* Sélection opérateur */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Choisir votre opérateur
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedOperator('airtel')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedOperator === 'airtel'
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-xl font-bold text-white">A</span>
                        </div>
                        <span className={`font-medium ${selectedOperator === 'airtel' ? 'text-red-400' : 'text-gray-400'}`}>
                          Airtel Money
                        </span>
                        <span className="text-xs text-gray-500">74, 77</span>
                      </div>
                      {selectedOperator === 'airtel' && (
                        <CheckCircle2 className="w-5 h-5 text-red-500 absolute top-2 right-2" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedOperator('moov')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedOperator === 'moov'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-xl font-bold text-white">M</span>
                        </div>
                        <span className={`font-medium ${selectedOperator === 'moov' ? 'text-blue-400' : 'text-gray-400'}`}>
                          Moov Money
                        </span>
                        <span className="text-xs text-gray-500">62, 66</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Numéro de téléphone */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Numéro Mobile Money
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center">
                        <div className="h-full px-4 flex items-center bg-gray-700 rounded-l-xl border-r border-gray-600">
                          <span className="text-gray-300 font-medium flex items-center gap-2">
                            <Smartphone className="w-4 h-4" />
                            +241
                          </span>
                        </div>
                      </div>
                      <input
                        type="tel"
                        value={formatPhone(phone)}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="77 XX XX XX"
                        className="w-full pl-28 pr-4 py-4 bg-gray-700/50 border border-gray-600 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Erreur */}
                  {error && (
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <Phone className="w-5 h-5 text-orange-400" />
                      <h4 className="font-medium text-orange-300">Comment ça marche ?</h4>
                    </div>
                    <ol className="text-sm text-gray-400 space-y-2">
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center text-xs text-orange-400 flex-shrink-0">1</span>
                        <span>Cliquez sur "Payer maintenant"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center text-xs text-orange-400 flex-shrink-0">2</span>
                        <span>Vous recevrez une notification sur votre téléphone</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="w-5 h-5 bg-orange-500/20 rounded-full flex items-center justify-center text-xs text-orange-400 flex-shrink-0">3</span>
                        <span>Confirmez avec votre code PIN Mobile Money</span>
                      </li>
                    </ol>
                  </div>

                  {/* Bouton de paiement */}
                  <button
                    type="submit"
                    disabled={isLoading || !paymentConfig || !phone}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-orange-500/25"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Traitement en cours...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Payer {paymentConfig?.amount.toLocaleString('fr-FR')} FCFA
                      </>
                    )}
                  </button>

                  {/* Sécurité */}
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                    <Shield className="w-4 h-4" />
                    <span>Paiement sécurisé via PVIT</span>
                  </div>
                </form>
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
                <span className="text-xs">PVIT Certifié</span>
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
