'use client'

import { useState, useEffect } from 'react'
import { X, Check, Crown, Zap, Users } from 'lucide-react'
import { getSubscriptionPlans, createUserSubscription, SubscriptionPlan } from '@/lib/subscription'
import { useAuth } from '@/contexts/AuthContext'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function SubscriptionModal({ isOpen, onClose, onSuccess }: SubscriptionModalProps) {
  const { user, refreshSubscription } = useAuth()
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadPlans()
    }
  }, [isOpen])

  const loadPlans = async () => {
    try {
      const subscriptionPlans = await getSubscriptionPlans()
      setPlans(subscriptionPlans)
    } catch (err) {
      console.error('Erreur chargement plans:', err)
      setError('Erreur lors du chargement des plans')
    }
  }

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      setError('Vous devez être connecté pour vous abonner')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: subscriptionError } = await createUserSubscription(
        user.id,
        planId,
        billingCycle
      )

      if (subscriptionError) {
        setError(subscriptionError.message)
      } else {
        await refreshSubscription()
        onSuccess?.()
        onClose()
      }
    } catch (err) {
      setError('Erreur lors de la souscription')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(price)
  }

  const getPlanIcon = (slug: string) => {
    switch (slug) {
      case 'free':
        return <Zap className="w-6 h-6" />
      case 'discovery':
        return <Crown className="w-6 h-6" />
      case 'pro':
        return <Users className="w-6 h-6" />
      default:
        return <Check className="w-6 h-6" />
    }
  }

  const getPlanColor = (slug: string) => {
    switch (slug) {
      case 'free':
        return 'border-gray-200 bg-gray-50'
      case 'discovery':
        return 'border-orange-500 bg-orange-50 ring-2 ring-orange-500'
      case 'pro':
        return 'border-blue-500 bg-blue-50'
      default:
        return 'border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Choisissez votre abonnement
              </h2>
              <p className="text-gray-600 mt-1">
                Accédez à toutes les actualités gabonaises
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Toggle billing cycle */}
          <div className="flex items-center justify-center mt-6">
            <div className="bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Annuel
                <span className="ml-1 text-xs text-green-600">-17%</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="p-6">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-6 ${getPlanColor(plan.slug)} ${
                  plan.is_popular ? 'transform scale-105' : ''
                }`}
              >
                {plan.is_popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Populaire
                    </span>
                  </div>
                )}

                <div className="text-center">
                  <div className={`inline-flex p-3 rounded-full mb-4 ${
                    plan.slug === 'free' ? 'bg-gray-200 text-gray-600' :
                    plan.slug === 'discovery' ? 'bg-orange-100 text-orange-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {getPlanIcon(plan.slug)}
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>

                  <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price_monthly === 0 ? 'Gratuit' : formatPrice(
                        billingCycle === 'yearly' && plan.price_yearly 
                          ? plan.price_yearly / 12 
                          : plan.price_monthly
                      )}
                    </span>
                    {plan.price_monthly > 0 && (
                      <span className="text-gray-600 ml-1">/mois</span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 text-left">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading || plan.slug === 'free'}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      plan.slug === 'free'
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : plan.is_popular
                        ? 'bg-orange-500 text-white hover:bg-orange-600'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {loading ? 'Chargement...' : 
                     plan.slug === 'free' ? 'Plan actuel' : 'Choisir ce plan'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center text-sm text-gray-600">
            <p>
              Tous les plans incluent un accès sécurisé et la synchronisation multi-appareils.
              <br />
              Vous pouvez annuler votre abonnement à tout moment.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
