'use client'
// Mode Demo - Création via RPC Supabase

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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('mobile_money')
  
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
      id: 'demo',
      name: '🎯 Paiement Demo (Test)',
      icon: <Check className="w-6 h-6" />,
      description: 'Validation instantanée pour tests',
      available: true,
      instructions: '✅ Votre campagne sera créée et validée instantanément (mode démo)'
    },
    {
      id: 'mobile_money',
      name: 'Mobile Money',
      icon: <Smartphone className="w-6 h-6" />,
      description: 'Airtel Money, Moov Money, MTN',
      available: true,
      instructions: 'Vous recevrez une notification push pour valider le paiement'
    },
    {
      id: 'card',
      name: 'Carte de Crédit',
      icon: <CreditCard className="w-6 h-6" />,
      description: 'Visa, Mastercard',
      available: true,
      instructions: 'Paiement sécurisé via notre partenaire de paiement'
    },
    {
      id: 'cash',
      name: 'Cash sur Place',
      icon: <Banknote className="w-6 h-6" />,
      description: 'Payer en espèces à nos bureaux',
      available: true,
      instructions: 'Vos campagnes seront activées après réception du paiement'
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

    if (selectedPaymentMethod === 'mobile_money' && !formData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Le numéro Mobile Money est requis'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const createCampaignsDirectly = async () => {
    // Mode DEMO: Création directe via Supabase (bypass API Railway)
    const createdCampaigns = []
    
    for (const item of cart) {
      const startDateObj = new Date(item.start_date)
      const endDateObj = new Date(startDateObj)
      endDateObj.setDate(endDateObj.getDate() + item.duration_days)

      // Cast details en any pour accéder aux propriétés dynamiques
      const details: any = item.details

      // Construire l'objet campagne
      const campaignData: any = {
        user_id: '00000000-0000-0000-0000-000000000001', // User système demo
        campaign_type: item.campaign_type,
        name: item.name,
        redirect_url: details.redirect_url,
        start_date: startDateObj.toISOString(),
        end_date: endDateObj.toISOString(),
        duration_days: item.duration_days,
        design_request: details.design_request || details.request_creation || false,
        design_request_notes: details.design_request_notes || details.design_notes || null,
        budget: item.budget,
        status: 'pending', // DEMO: directement en pending
        payment_status: 'completed', // DEMO: paiement validé
        views: 0,
        clicks: 0
      }

      // Ajouter champs spécifiques selon type
      if (item.campaign_type === 'article-trending') {
        campaignData.banner_title = details.article_title || item.name
        campaignData.banner_description = details.article_summary || details.article_subtitle || ''
      } else {
        campaignData.banner_title = details.banner_title || ''
        campaignData.banner_description = details.banner_description || ''
        if (details.desktop_image_url) campaignData.desktop_image_url = details.desktop_image_url
        if (details.mobile_image_url) campaignData.mobile_image_url = details.mobile_image_url
      }

      // Créer la campagne via fonction RPC (bypass RLS)
      const { data: campaign, error: campaignError } = await supabase
        .rpc('create_demo_campaign', {
          campaign_data: campaignData
        })

      if (campaignError) {
        console.error('❌ Erreur création campagne:', campaignError)
        throw new Error(`Erreur création campagne: ${campaignError.message}`)
      }

      console.log('✅ Campagne créée (DEMO):', campaign)
      createdCampaigns.push(campaign)

      // Si article sponsorisé, créer l'article
      if (item.campaign_type === 'article-trending' && details.article_title) {
        // Vérifier/créer flux Gabon Insight
        let { data: feed } = await supabase
          .from('rss_feeds')
          .select('id')
          .eq('name', 'Gabon Insight')
          .single()

        if (!feed) {
          const { data: newFeed } = await supabase
            .from('rss_feeds')
            .insert([{
              name: 'Gabon Insight',
              url: 'https://gabon-insight.netlify.app/sponsored',
              description: 'Articles sponsorisés et contenus partenaires',
              category: 'Sponsorisé',
              language: 'fr',
              country: 'GA',
              status: 'active',
              is_premium: true,
              priority: 1
            }])
            .select('id')
            .single()
          feed = newFeed
        }

        // Créer l'article
        const { data: article, error: articleError } = await supabase
          .from('articles')
          .insert([{
            feed_id: feed?.id,
            external_id: `sponsored-${campaign.id}`,
            title: details.article_title,
            summary: details.article_summary || details.article_subtitle,
            summary_ai: details.article_summary || details.article_subtitle,
            content: details.article_content,
            url: details.redirect_url,
            author: details.article_author || 'Gabon Insight',
            published_at: startDateObj.toISOString(),
            language: 'fr',
            category: details.article_category || 'business',
            keywords: [
              details.company_name,
              details.product_service,
              'sponsorisé',
              'publicité',
              details.target_audience
            ].filter(Boolean),
            sentiment_score: 0.85,
            read_time_minutes: Math.ceil((details.article_content?.length || 500) / 1000 * 5),
            image_urls: details.article_image_url ? [details.article_image_url] : 
                       (details.article_image_preview ? [details.article_image_preview] : []),
            is_trending: false, // Admin doit valider
            view_count: 0, // Compteur démarre après validation
            share_count: 0,
            whatsapp_share_count: 0,
            is_published: false // ⚠️ Attente validation admin
          }])
          .select()
          .single()

        if (articleError) {
          console.error('❌ Erreur création article:', articleError)
        } else {
          console.log('✅ Article sponsorisé créé (DEMO):', article.id)
        }
      }
    }

    return createdCampaigns
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
      // MODE DEMO: Création directe via Supabase
      if (selectedPaymentMethod === 'demo') {
        console.log('🎯 Mode DEMO activé - Création directe via Supabase')
        
        const campaigns = await createCampaignsDirectly()
        
        // Vider le panier
        clearCart()

        // Redirection vers page succès
        router.push(`/checkout/success-campaign?method=demo&payment_id=demo-${Date.now()}&count=${campaigns.length}`)
        return
      }

      // MODE NORMAL: Via API Railway
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

      // Créer les campagnes avec status 'unpaid'
      const campaignPromises = cart.map(async (item) => {
        const endDate = calculateEndDate(item.start_date, item.duration_days)

        const campaignData = {
          campaign_type: item.campaign_type,
          name: item.name,
          budget: item.budget,
          duration_days: item.duration_days,
          start_date: item.start_date,
          end_date: endDate,
          status: 'unpaid', // Status initial
          ...item.details,
          // Info paiement
          payment_method: selectedPaymentMethod,
          payment_status: 'pending',
          user_email: formData.email,
          user_phone: formData.phone,
          user_full_name: formData.fullName
        }

        const response = await fetch(`${API_URL}/api/campaigns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(campaignData)
        })

        if (!response.ok) {
          throw new Error('Erreur création campagne')
        }

        return await response.json()
      })

      const createdCampaigns = await Promise.all(campaignPromises)

      // Initier le paiement via le backend (Integration MyPvit)
      const paymentResponse = await fetch(`${API_URL}/api/payments/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          amount: total,
          method: selectedPaymentMethod,
          description: `Paiement ${createdCampaigns.length} campagne(s)`,
          metadata: {
            campaignIds: createdCampaigns.map(c => c.campaign.id),
            email: formData.email,
            customerName: formData.fullName
          },
          providerData: {
            phoneNumber: formData.mobileNumber,
            operator: formData.mobileOperator,
            pickupLocation: formData.pickupLocation // Pour Cash
          }
        })
      })

      const paymentResult = await paymentResponse.json()

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Erreur initiation paiement')
      }

      // Vider le panier
      clearCart()

      // Rediriger selon méthode de paiement
      if (paymentResult.transaction?.redirectUrl) {
        // Redirection (ex: Stripe)
        window.location.href = paymentResult.transaction.redirectUrl
      } else {
        // Succès / Instructions (ex: Mobile Money USSD Push)
        router.push(`/checkout/success?method=${selectedPaymentMethod}&payment_id=${paymentResult.transaction?.transactionId}&message=${encodeURIComponent(paymentResult.message || '')}`)
      }

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

                {/* Champs spécifiques Mobile Money */}
                {selectedPaymentMethod === 'mobile_money' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-4">Détails Mobile Money</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Opérateur
                        </label>
                        <select
                          value={formData.mobileOperator}
                          onChange={(e) => setFormData(prev => ({ ...prev, mobileOperator: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="airtel">Airtel Money</option>
                          <option value="moov">Moov Money</option>
                          <option value="mtn">MTN Mobile Money</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Numéro Mobile Money *
                        </label>
                        <input
                          type="tel"
                          value={formData.mobileNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, mobileNumber: e.target.value }))}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 ${
                            errors.mobileNumber ? 'border-red-500' : 'border-gray-300'
                          }`}
                          placeholder="+241 XX XX XX XX"
                        />
                        {errors.mobileNumber && <p className="mt-1 text-sm text-red-600">{errors.mobileNumber}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Champs spécifiques Cash */}
                {selectedPaymentMethod === 'cash' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-900 mb-4">💵 Paiement en espèces</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Bureau de paiement
                        </label>
                        <select
                          value={formData.pickupLocation}
                          onChange={(e) => setFormData(prev => ({ ...prev, pickupLocation: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="libreville">Libreville - Centre-ville</option>
                          <option value="port-gentil">Port-Gentil</option>
                          <option value="franceville">Franceville</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Notes (optionnel)
                        </label>
                        <textarea
                          value={formData.pickupNotes}
                          onChange={(e) => setFormData(prev => ({ ...prev, pickupNotes: e.target.value }))}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="Informations complémentaires..."
                        />
                      </div>
                      <p className="text-sm text-yellow-700">
                        📍 Nos bureaux sont ouverts du lundi au vendredi de 9h à 17h
                      </p>
                    </div>
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
