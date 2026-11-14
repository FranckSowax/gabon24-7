'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CreditCard, Shield, Lock, Check, AlertCircle, Smartphone, Banknote, Calendar, Clock, ShoppingCart, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { 
  getCart, 
  clearCart, 
  getCartTotal, 
  getCampaignTypeInfo, 
  formatPrice, 
  calculateEndDate,
  setCartItemCampaignId,
  type CartItem
} from '@/lib/cart'

export const dynamic = 'force-dynamic'

interface PaymentMethod {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  available: boolean
  instructions?: string
}

export default function CheckoutCampaignsPage() {
  const router = useRouter()
  const { user } = useAuth()
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('ebilling')
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    // Mobile Money
    mobileOperator: 'airtel',
    mobileNumber: '',
    // Cash
    pickupLocation: 'libreville',
    pickupNotes: ''
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadCart()
  }, [])

  useEffect(() => {
    // Pré-remplir avec les données utilisateur
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || '',
        fullName: user.user_metadata?.full_name || ''
        // phone reste vide, l'utilisateur le remplira
      }))
    }
  }, [user])

  const loadCart = () => {
    const cartItems = getCart()
    setCart(cartItems)
    setTotal(getCartTotal())

    if (cartItems.length === 0) {
      // Rediriger si panier vide
      setTimeout(() => {
        router.push('/marketing/publicite')
      }, 2000)
    }
  }

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'ebilling',
      name: 'Paiement en ligne',
      icon: <CreditCard className="w-6 h-6" />,
      description: 'Airtel Money, Moov Money, Visa, Mastercard',
      available: true,
      instructions: 'Vous serez redirigé vers le portail de paiement sécurisé'
    }
  ]

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Le nom complet est requis'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Le numéro de téléphone est requis'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handlePayment = async () => {
    if (!validateForm()) {
      alert('❌ Veuillez remplir tous les champs requis')
      return
    }

    if (cart.length === 0) {
      alert('❌ Votre panier est vide')
      return
    }

    setLoading(true)

    try {
      // Paiement via E-Billing uniquement. La campagne n'est validée qu'après
      // confirmation du paiement côté serveur.
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) {
        alert('❌ Connectez-vous pour finaliser votre commande')
        router.push('/auth/signin?redirectTo=/checkout-campaigns')
        return
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

      // Créer les campagnes côté serveur. Le prix, le statut et le propriétaire
      // sont fixés par le serveur : seuls le type, la durée, la date et le
      // contenu sont envoyés. Création une par une, et l'identifiant obtenu est
      // mémorisé dans le panier : en cas d'échec puis de relance, une campagne
      // déjà créée n'est pas recréée.
      const campaignIds: string[] = []
      for (const item of cart) {
        if (item.campaign_id) {
          campaignIds.push(item.campaign_id)
          continue
        }

        // L'aperçu local de l'image (encodé, parfois plusieurs Mo) et l'objet
        // fichier ne sont pas envoyés : le serveur n'accepte que des adresses http(s).
        const { article_image_preview, article_image_file, ...details } =
          item.details as Record<string, unknown>
        const campaignData: Record<string, unknown> = {
          ...details,
          campaign_type: item.campaign_type,
          name: item.name,
          duration_days: item.duration_days,
          start_date: item.start_date,
        }
        if (typeof article_image_preview === 'string' && /^https?:\/\//.test(article_image_preview)) {
          campaignData.article_image_url = article_image_preview
        }

        const response = await fetch(`${API_URL}/api/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(campaignData)
        })
        const created = await response.json().catch(() => null)

        if (!response.ok || !created?.campaign?.id) {
          throw new Error(`${item.name} : ${created?.error || 'création de la campagne impossible'}`)
        }

        setCartItemCampaignId(item.id, created.campaign.id)
        campaignIds.push(created.campaign.id)
      }

      // Initier le paiement via E-Billing
      const paymentResponse = await fetch(`${API_URL}/api/payments/campaign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          campaignIds,
          amount: total,
        })
      })

      const paymentResult = await paymentResponse.json()

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Erreur initiation paiement')
      }

      // Sauvegarder les infos de paiement
      localStorage.setItem('ebilling_payment_reference', paymentResult.data.reference)
      localStorage.setItem('ebilling_payment_type', 'campaign')
      if (paymentResult.data.payment_url) {
        localStorage.setItem('ebilling_payment_url', paymentResult.data.payment_url)
      }

      // Vider le panier
      clearCart()

      // Ouvrir le portail de paiement et rediriger vers la page d'attente
      if (paymentResult.data.payment_url) {
        window.open(paymentResult.data.payment_url, '_blank')
      }
      router.push(`/paiement/attente?reference=${paymentResult.data.reference}`)

    } catch (error: any) {
      console.error('Erreur paiement:', error)
      alert(`❌ Erreur: ${error.message || 'Erreur lors du paiement'}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        
        <div className="flex min-h-screen w-full">
          <Sidebar 
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
          />

          <main className="flex-1 lg:ml-64 flex items-center justify-center p-6">
            <div className="text-center">
              <ShoppingCart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Panier vide</h2>
              <p className="text-gray-600 mb-6">Ajoutez des campagnes pour continuer</p>
              <button
                onClick={() => router.push('/marketing/publicite')}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all font-semibold"
              >
                Voir les campagnes
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour
            </button>

            <div className="flex items-center gap-3">
              <Lock className="w-8 h-8 text-green-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Paiement Sécurisé</h1>
                <p className="text-gray-600">Finalisez votre commande</p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Formulaire */}
            <div className="lg:col-span-2 space-y-6">
              {/* Informations personnelles */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Vos informations</h2>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nom complet *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                        errors.fullName ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="Votre nom complet"
                    />
                    {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="votre@email.com"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Téléphone *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                        errors.phone ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="+241 XX XX XX XX"
                    />
                    {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                  </div>
                </div>
              </div>

              {/* Méthode de paiement */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Méthode de paiement</h2>
                
                <div className="space-y-4 mb-6">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        selectedPaymentMethod === method.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedPaymentMethod(method.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          selectedPaymentMethod === method.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {method.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{method.name}</h3>
                          <p className="text-sm text-gray-600">{method.description}</p>
                          {selectedPaymentMethod === method.id && method.instructions && (
                            <p className="text-xs text-orange-600 mt-1">💡 {method.instructions}</p>
                          )}
                        </div>
                        {selectedPaymentMethod === method.id && (
                          <Check className="w-6 h-6 text-orange-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info E-Billing */}
                {selectedPaymentMethod === 'ebilling' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-700">
                      Vous serez redirigé vers le portail de paiement sécurisé E-Billing
                      pour choisir votre méthode de paiement (Airtel Money, Moov Money, Visa, Mastercard).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Résumé */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 sticky top-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Résumé de commande</h3>

                <div className="space-y-3 mb-6">
                  {cart.map((item) => {
                    const typeInfo = getCampaignTypeInfo(item.campaign_type)
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{typeInfo.icon}</span>
                          <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(item.start_date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>{item.duration_days} jour{item.duration_days > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                          <span className="text-xs text-gray-600">Prix:</span>
                          <span className="font-bold text-orange-600">{formatPrice(item.budget)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-gray-200 pt-4 mb-6 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Sous-total</span>
                    <span className="font-semibold">{formatPrice(total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span className="text-orange-600">{formatPrice(total)}</span>
                  </div>
                </div>

                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Traitement...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      <span>Confirmer le paiement</span>
                    </>
                  )}
                </button>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                    <Shield className="w-4 h-4" />
                    <span>Paiement 100% sécurisé</span>
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Vos données sont protégées
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
