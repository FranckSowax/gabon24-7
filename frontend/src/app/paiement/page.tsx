'use client'

import { Suspense, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Phone, CreditCard, Shield, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'

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

  // Récupérer les paramètres de paiement depuis l'URL
  useEffect(() => {
    if (!searchParams) return

    const type = searchParams.get('type') as PaymentType
    const amount = parseInt(searchParams.get('amount') || '0')
    const description = searchParams.get('description') || ''

    if (!type || !amount) {
      setError('Paramètres de paiement invalides')
      return
    }

    const config: PaymentConfig = {
      type,
      amount,
      description,
      packageId: searchParams.get('packageId') || undefined,
      planSlug: searchParams.get('planSlug') || undefined,
      quizId: searchParams.get('quizId') || undefined,
      credits: parseInt(searchParams.get('credits') || '0') || undefined,
      bonus: parseInt(searchParams.get('bonus') || '0') || undefined,
      planName: searchParams.get('planName') || undefined,
      duration: parseInt(searchParams.get('duration') || '1') || 1,
    }

    setPaymentConfig(config)
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
    }
  }, [user])

  const formatPhone = (value: string) => {
    // Garder uniquement les chiffres
    const digits = value.replace(/\D/g, '')
    // Limiter à 9 chiffres (format Gabon sans indicatif)
    return digits.slice(0, 9)
  }

  const validatePhone = (phoneNumber: string) => {
    const digits = phoneNumber.replace(/\D/g, '')
    // Vérifier que c'est un numéro gabonais valide (commence par 0, 6 ou 7)
    if (digits.length < 8 || digits.length > 9) {
      return false
    }
    // Vérifier le préfixe (Airtel: 074, 077 / Moov: 062, 066)
    const validPrefixes = ['074', '077', '062', '066', '06', '07']
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
      // Récupérer le token d'authentification Supabase
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('sb-access-token')

      let endpoint = ''
      let body: any = { phone }

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

      // Stocker la référence pour la page de succès
      localStorage.setItem('pvit_payment_reference', data.data.reference)
      localStorage.setItem('pvit_payment_type', paymentConfig.type)

      // Rediriger vers la page d'attente ou afficher le message
      router.push(`/paiement/attente?reference=${data.data.reference}`)

    } catch (err: any) {
      console.error('Erreur paiement:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen w-full">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft className="w-5 h-5" />
                Retour
              </button>

              <h1 className="text-3xl font-bold text-gray-900 mb-2">Paiement Mobile Money</h1>
              <p className="text-gray-600">Payez en toute sécurité avec Airtel Money ou Moov Money</p>
            </div>

            {/* Récapitulatif */}
            {paymentConfig && (
              <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h2>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Type</span>
                    <span className="font-medium text-gray-900">
                      {paymentConfig.type === 'credits' && 'Achat de crédits'}
                      {paymentConfig.type === 'subscription' && 'Abonnement'}
                      {paymentConfig.type === 'quiz' && 'Inscription Quiz'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Description</span>
                    <span className="font-medium text-gray-900">{paymentConfig.description}</span>
                  </div>

                  {paymentConfig.credits && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Crédits</span>
                      <span className="font-medium text-green-600">
                        {paymentConfig.credits} crédits
                        {paymentConfig.bonus ? ` + ${paymentConfig.bonus} bonus` : ''}
                      </span>
                    </div>
                  )}

                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-orange-600">
                        {paymentConfig.amount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Numéro de téléphone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro de téléphone Mobile Money
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">+241</span>
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      placeholder="07 XX XX XX"
                      className="w-full pl-24 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                      required
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Airtel Money (074, 077) ou Moov Money (062, 066)
                  </p>
                </div>

                {/* Erreur */}
                {error && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Instructions */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h3 className="font-medium text-orange-800 mb-2">Comment ça marche ?</h3>
                  <ol className="text-sm text-orange-700 space-y-1 list-decimal list-inside">
                    <li>Entrez votre numéro Mobile Money</li>
                    <li>Cliquez sur "Payer maintenant"</li>
                    <li>Vous recevrez une notification sur votre téléphone</li>
                    <li>Confirmez le paiement avec votre code PIN</li>
                    <li>Vos crédits/abonnement seront activés automatiquement</li>
                  </ol>
                </div>

                {/* Bouton de paiement */}
                <button
                  type="submit"
                  disabled={isLoading || !paymentConfig}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-lg font-semibold text-lg hover:from-orange-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Traitement en cours...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Payer {paymentConfig?.amount.toLocaleString('fr-FR')} FCFA
                    </>
                  )}
                </button>

                {/* Sécurité */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Shield className="w-4 h-4" />
                  <span>Paiement sécurisé via PVIT</span>
                </div>
              </form>
            </div>

            {/* Logos opérateurs */}
            <div className="mt-6 flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-red-600">A</span>
                </div>
                <p className="text-xs text-gray-600">Airtel Money</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-blue-600">M</span>
                </div>
                <p className="text-xs text-gray-600">Moov Money</p>
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto" />
        <p className="mt-4 text-gray-600">Chargement...</p>
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
