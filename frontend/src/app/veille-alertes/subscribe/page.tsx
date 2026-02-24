'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'
const EBILLING_PORTAL = process.env.NEXT_PUBLIC_EBILLING_PORTAL_URL || 'https://app.billing-easy.net'

interface VeillePlan {
  id: string
  slug: string
  name: string
  price_monthly: number
  features: string[]
}

export default function VeilleSubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    }>
      <VeilleSubscribeContent />
    </Suspense>
  )
}

function VeilleSubscribeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const planSlug = searchParams?.get('plan') || 'particulier'

  const [plans, setPlans] = useState<VeillePlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState(planSlug)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle')

  // Charger les plans
  useEffect(() => {
    fetch(`${API_URL}/api/veille/plans`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.plans) setPlans(data.plans)
      })
      .catch(() => {})
  }, [])

  // Rediriger si pas connecte
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/signin?redirect=/veille-alertes/subscribe?plan=${planSlug}`)
    }
  }, [authLoading, user, router, planSlug])

  const currentPlan = plans.find(p => p.slug === selectedPlan) || plans[0]

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!whatsappNumber.trim()) {
      setError('Veuillez entrer votre numero WhatsApp')
      return
    }

    const cleanNumber = whatsappNumber.replace(/[\s\-()]/g, '')
    if (!/^\+[1-9]\d{6,14}$/.test(cleanNumber)) {
      setError('Format invalide. Utilisez le format international: +241...')
      return
    }

    setLoading(true)

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession?.access_token) {
        setError('Vous devez etre connecte pour vous abonner')
        setLoading(false)
        return
      }

      const res = await fetch(`${API_URL}/api/veille/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession.access_token}`
        },
        body: JSON.stringify({
          planSlug: selectedPlan,
          whatsappNumber: cleanNumber
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Erreur lors de l\'initiation du paiement')
        return
      }

      // Ouvrir le portail E-Billing dans un popup
      setPaymentRef(data.reference)
      setPaymentStatus('pending')

      const paymentUrl = data.payment_url || `${EBILLING_PORTAL}/pay/${data.bill_id}`
      window.open(paymentUrl, '_blank', 'width=600,height=700,scrollbars=yes')

    } catch {
      setError('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setLoading(false)
    }
  }

  // Polling du statut de paiement
  const pollPaymentStatus = useCallback(async () => {
    if (!paymentRef) return

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession?.access_token) return

      const res = await fetch(`${API_URL}/api/payments/status/${paymentRef}`, {
        headers: { 'Authorization': `Bearer ${currentSession.access_token}` }
      })
      const data = await res.json()

      if (data.status === 'completed') {
        setPaymentStatus('success')
        setTimeout(() => router.push('/veille'), 2000)
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        setPaymentStatus('failed')
        setError('Le paiement a echoue ou a ete annule.')
      }
    } catch {
      // Silently retry
    }
  }, [paymentRef, router])

  useEffect(() => {
    if (paymentStatus !== 'pending') return

    const interval = setInterval(pollPaymentStatus, 5000)
    return () => clearInterval(interval)
  }, [paymentStatus, pollPaymentStatus])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  // Success state
  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Abonnement active !</h1>
          <p className="text-gray-500 mb-4">
            Votre abonnement Veille & Alertes est actif. Vous allez etre redirige vers votre tableau de bord.
          </p>
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-10 sm:py-16">
        <Link
          href="/veille-alertes"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          S&apos;abonner a Veille & Alertes
        </h1>
        <p className="text-gray-500 mb-8">
          Connecte en tant que <strong>{user.email}</strong>
        </p>

        {/* Waiting for payment */}
        {paymentStatus === 'pending' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
            <h3 className="font-semibold text-amber-900 mb-1">Paiement en cours...</h3>
            <p className="text-sm text-amber-700">
              Completez votre paiement dans la fenetre E-Billing.
              Cette page se mettra a jour automatiquement.
            </p>
          </div>
        )}

        <form onSubmit={handleSubscribe} className="space-y-6">
          {/* Plan Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Plan choisi
            </label>
            <div className="grid grid-cols-2 gap-3">
              {plans.map(plan => (
                <button
                  key={plan.slug}
                  type="button"
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedPlan === plan.slug
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900">{plan.name}</div>
                  <div className="text-sm text-gray-500">
                    {plan.price_monthly.toLocaleString('fr-FR')} FCFA/mois
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numero WhatsApp *
            </label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={e => setWhatsappNumber(e.target.value)}
              placeholder="+241 XX XX XX XX"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Format international requis (ex: +24177123456)
            </p>
          </div>

          {/* Summary */}
          {currentPlan && (
            <div className="bg-gray-50 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Resume</h3>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Plan {currentPlan.name}</span>
                <span className="font-semibold text-gray-900">
                  {currentPlan.price_monthly.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                <span>Duree</span>
                <span>1 mois</span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-gray-900">
                    {currentPlan.price_monthly.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || paymentStatus === 'pending'}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Preparation...' : `Payer ${currentPlan?.price_monthly?.toLocaleString('fr-FR') || ''} FCFA`}
          </button>

          <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
            <Shield className="w-3 h-3" />
            Paiement securise via E-Billing (Airtel Money, Moov Money, Visa, Mastercard)
          </div>
        </form>
      </div>
    </div>
  )
}
