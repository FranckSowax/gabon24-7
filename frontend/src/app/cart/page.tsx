'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Minus, ShoppingCart, Trash2, CreditCard, Gift, Zap, Crown, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// Force dynamic rendering to avoid prerendering issues with searchParams
export const dynamic = 'force-dynamic'

interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
  features: string[]
  limitations: Record<string, number>
  is_popular: boolean
  sort_order: number
}

interface CartItem {
  plan: SubscriptionPlan
  billingCycle: 'monthly' | 'yearly'
  quantity: number
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      loadCartData()
    }
  }, [mounted])

  const loadCartData = async () => {
    try {
      // Charger les plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true })

      if (plansError) {
        console.error('Erreur chargement plans:', plansError)
        setLoading(false)
        return
      }

      if (plansData) {
        setPlans(plansData)

        // Vérifier si un plan est passé en paramètre
        const planSlug = searchParams?.get('plan')
        const billing = (searchParams?.get('billing') as 'monthly' | 'yearly') || 'monthly'

        if (planSlug) {
          const selectedPlan = plansData.find((p: SubscriptionPlan) => p.slug === planSlug)
          if (selectedPlan && selectedPlan.slug !== 'free') {
            setCartItems([{
              plan: selectedPlan,
              billingCycle: billing,
              quantity: 1
            }])
          }
        }
      }
    } catch (error) {
      console.error('Erreur chargement:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlanIcon = (slug: string) => {
    switch(slug) {
      case 'free': return <Gift className="w-6 h-6" />
      case 'premium': return <Zap className="w-6 h-6" />
      case 'pro': return <Crown className="w-6 h-6" />
      default: return <Check className="w-6 h-6" />
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price)
  }

  const calculateItemPrice = (item: CartItem) => {
    const price = item.billingCycle === 'yearly' ? item.plan.price_yearly : item.plan.price_monthly
    return price * item.quantity
  }

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + calculateItemPrice(item), 0)
  }

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return
    const updatedItems = [...cartItems]
    updatedItems[index].quantity = newQuantity
    setCartItems(updatedItems)
  }

  const removeItem = (index: number) => {
    const updatedItems = cartItems.filter((_, i) => i !== index)
    setCartItems(updatedItems)
  }

  const proceedToCheckout = () => {
    if (cartItems.length === 0) return

    // Construire les paramètres pour le checkout
    const checkoutParams = new URLSearchParams()
    cartItems.forEach((item, index) => {
      checkoutParams.append(`item_${index}_plan`, item.plan.slug)
      checkoutParams.append(`item_${index}_billing`, item.billingCycle)
      checkoutParams.append(`item_${index}_quantity`, item.quantity.toString())
    })

    router.push(`/checkout?${checkoutParams.toString()}`)
  }

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Retour</span>
              </button>
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-6 h-6 text-orange-500" />
                <h1 className="text-2xl font-bold text-gray-900">Panier</h1>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {cartItems.length} article{cartItems.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items du panier */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Articles sélectionnés</h2>
              </div>

              {cartItems.length === 0 ? (
                <div className="p-12 text-center">
                  <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Votre panier est vide</h3>
                  <p className="text-gray-600 mb-6">Ajoutez un abonnement pour commencer</p>
                  <button
                    onClick={() => router.push('/abonnement')}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium"
                  >
                    Voir les abonnements
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {cartItems.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6"
                    >
                      <div className="flex items-center space-x-4">
                        {/* Icône du plan */}
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center text-white">
                            {getPlanIcon(item.plan.slug)}
                          </div>
                        </div>

                        {/* Détails du plan */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900">{item.plan.name}</h3>
                            {item.plan.is_popular && (
                              <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium">
                                Populaire
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Facturation {item.billingCycle === 'monthly' ? 'mensuelle' : 'annuelle'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.plan.features.slice(0, 3).map((feature, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Contrôles quantité */}
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                            <button
                              onClick={() => updateQuantity(index, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(index, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Prix */}
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {formatPrice(calculateItemPrice(item))} XAF
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.billingCycle === 'monthly' ? '/mois' : '/an'}
                          </div>
                        </div>

                        {/* Bouton supprimer */}
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Résumé de commande */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sticky top-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Résumé de commande</h3>

              <div className="space-y-4 mb-6">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.plan.name} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatPrice(calculateItemPrice(item))} XAF
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatPrice(calculateTotal())} XAF
                  </span>
                </div>
              </div>

              <button
                onClick={proceedToCheckout}
                disabled={cartItems.length === 0}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <span>Procéder au paiement</span>
                <ArrowLeft className="w-5 h-5 rotate-180" />
              </button>

              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  Paiement sécurisé • Annulation à tout moment
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
