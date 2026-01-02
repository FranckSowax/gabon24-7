'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import AvatarUpload from '@/components/profile/AvatarUpload'
import TransactionHistory from '@/components/profile/TransactionHistory'

export const dynamic = 'force-dynamic'

interface UserProfile {
  id: string
  full_name: string
  email: string
  phone_number?: string
  avatar_url?: string
  bio?: string
  credits_balance?: number
}

// Packages cohérents avec abonnements: Premium=300cr/5000F, Pro=1000cr/10000F
// Ratio achat ponctuel: ~20 FCFA/crédit (légèrement plus cher que abonnement)
const CREDIT_PACKAGES = [
  { fcfa: 1000, credits: 50, popular: false, label: 'Découverte' },
  { fcfa: 5000, credits: 300, bonus: 50, popular: true, label: 'Standard' },
  { fcfa: 10000, credits: 650, bonus: 150, popular: false, label: 'Premium' },
  { fcfa: 25000, credits: 1750, bonus: 500, popular: false, label: 'Business' },
]

// Abonnements avec crédits mensuels inclus
const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Freemium',
    price: 0,
    credits: 0,
    features: ['5 articles par jour', 'Accès limité', 'Support communautaire'],
    color: 'gray'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 5000,
    credits: 300,
    features: ['300 crédits/mois', 'Articles illimités', 'Accès chaîne WhatsApp', 'Business Plan IA'],
    color: 'yellow',
    popular: true
  },
  {
    id: 'pro',
    name: 'Professionnel',
    price: 10000,
    credits: 1000,
    features: ['1000 crédits/mois', 'Tout Premium', 'Veille & Audio', 'Publicités & Sondages', 'Support prioritaire'],
    color: 'purple'
  }
]

export default function MonProfilPage() {
  const { user, subscriptionPlan, loading: authLoading } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'subscription' | 'credits' | 'history' | 'projets' | 'settings'>('profile')
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadUserProfile()
    }
  }, [user])

  const loadUserProfile = async () => {
    if (!user) return

    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setEditForm(data)
      } else {
        const defaultProfile = {
          id: user.id,
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
          phone_number: (user.user_metadata as any)?.phone_number || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          bio: '',
          credits_balance: 0
        }
        setProfile(defaultProfile)
        setEditForm(defaultProfile)
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error)
    }
  }

  const handleSaveProfile = async () => {
    if (!user || !editForm) return
    
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          ...editForm,
          updated_at: new Date().toISOString()
        })

      if (!error) {
        setProfile(editForm as UserProfile)
        setIsEditing(false)
      } else {
        alert('Erreur lors de la sauvegarde')
      }
    } catch (error) {
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const handleCreditPurchase = (pkg: typeof CREDIT_PACKAGES[0]) => {
    alert(`Achat de ${pkg.credits} crédits pour ${pkg.fcfa} FCFA\nIntégration paiement à venir`)
  }

  const handleSubscriptionUpgrade = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    alert(`Upgrade vers ${plan.name} à ${plan.price} FCFA/mois\nIntégration paiement à venir`)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const currentPlan = subscriptionPlan?.slug || 'free'
  const creditsBalance = profile?.credits_balance || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <div className="mb-8">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Retour
            </button>
            
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Mon Profil</h1>
            <p className="text-gray-600">Gérez votre compte, abonnement et crédits</p>
          </div>

          {/* Tabs */}
          <div className="mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto scrollbar-hide">
            <div className="flex space-x-4 sm:space-x-8 min-w-max px-1">
              {
                [
                  { id: 'profile', label: '👤 Profil' },
                  { id: 'subscription', label: '👑 Abonnement' },
                  { id: 'credits', label: '💰 Crédits' },
                  { id: 'projets', label: '📁 Mes Projets' },
                  { id: 'history', label: '📊 Historique' },
                  { id: 'settings', label: '⚙️ Paramètres' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`pb-3 sm:pb-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {/* PROFIL TAB */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Informations du profil</h2>
                  {!isEditing && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Avatar Upload Component */}
                  {user && (
                    <AvatarUpload
                      userId={user.id}
                      currentAvatar={profile?.avatar_url}
                      onUploadSuccess={(url) => {
                        setProfile({ ...profile!, avatar_url: url })
                      }}
                    />
                  )}

                  {/* Fields */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.full_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900">{profile?.full_name || 'Non renseigné'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <p className="text-gray-900">{profile?.email}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={editForm.phone_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900">{profile?.phone_number || 'Non renseigné'}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                    {isEditing ? (
                      <textarea
                        value={editForm.bio || ''}
                        onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      />
                    ) : (
                      <p className="text-gray-900">{profile?.bio || 'Non renseigné'}</p>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-3 pt-4">
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                      >
                        {saving ? 'Enregistrement...' : '💾 Enregistrer'}
                      </button>
                      <button
                        onClick={() => {
                          setIsEditing(false)
                          setEditForm(profile || {})
                        }}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        ❌ Annuler
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUBSCRIPTION TAB */}
            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
                  <h2 className="text-2xl font-bold mb-2">Abonnement actuel</h2>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl font-bold">{subscriptionPlan?.name || 'Freemium'}</span>
                      <span className="text-xl font-bold">{subscriptionPlan?.price_monthly || 0} FCFA/mois</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Plans disponibles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        className={`relative rounded-xl border-2 p-6 ${
                          plan.popular ? 'border-orange-500 shadow-lg' : 'border-gray-200'
                        } ${currentPlan === plan.id ? 'bg-orange-50' : 'bg-white'}`}
                      >
                        {plan.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-xs font-bold">
                            ⭐ POPULAIRE
                          </div>
                        )}
                        
                        <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
                        <div className="mb-4">
                          <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                          <span className="text-gray-600"> FCFA/mois</span>
                        </div>
                        
                        <ul className="space-y-2 mb-6">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2 text-sm text-gray-700">
                              <span className="text-green-500">✓</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                        
                        {currentPlan === plan.id ? (
                          <button disabled className="w-full py-2 bg-gray-300 text-gray-600 rounded-lg font-medium cursor-not-allowed">
                            Plan actuel
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSubscriptionUpgrade(plan)}
                            className={`w-full py-2 rounded-lg font-medium ${
                              plan.popular
                                ? 'bg-orange-500 text-white hover:bg-orange-600'
                                : 'bg-gray-900 text-white hover:bg-gray-800'
                            }`}
                          >
                            {plan.price === 0 ? 'Downgrade' : 'Upgrade'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CREDITS TAB */}
            {activeTab === 'credits' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                  <h2 className="text-2xl font-bold mb-2">Solde de crédits</h2>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
                    <div className="text-center">
                      <p className="text-5xl font-bold">{creditsBalance}</p>
                      <p className="text-sm text-green-100 mt-1">crédits</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900">Acheter des crédits</h3>
                    <span className="text-sm text-gray-600">1000 FCFA = 50 crédits</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {CREDIT_PACKAGES.map((pkg, index) => (
                      <div
                        key={index}
                        className={`relative rounded-xl border-2 p-6 ${
                          pkg.popular ? 'border-green-500 shadow-lg bg-green-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        {pkg.popular && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                            MEILLEUR
                          </div>
                        )}
                        
                        <div className="text-center mb-4">
                          <p className="text-3xl font-bold text-gray-900">{pkg.credits}</p>
                          <p className="text-sm text-gray-600">crédits</p>
                          {pkg.bonus && <p className="text-xs text-green-600 font-medium mt-1">+{pkg.bonus} bonus 🎁</p>}
                        </div>
                        
                        <div className="text-center mb-4">
                          <p className="text-2xl font-bold text-orange-600">{pkg.fcfa}</p>
                          <p className="text-xs text-gray-600">FCFA</p>
                        </div>
                        
                        <button
                          onClick={() => handleCreditPurchase(pkg)}
                          className={`w-full py-2 rounded-lg font-medium ${
                            pkg.popular ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-900 text-white hover:bg-gray-800'
                          }`}
                        >
                          Acheter
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PROJETS TAB */}
            {activeTab === 'projets' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-4 sm:p-6 text-white">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">📁 Mes Projets</h2>
                      <p className="text-sm sm:text-base text-blue-100">Gérez et accédez à vos projets business</p>
                    </div>
                    <button
                      onClick={() => router.push('/business/mes-projets')}
                      className="w-full sm:w-auto bg-white text-blue-600 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <span>Voir tous</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Accès rapide</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <a
                      href="/business/mes-projets"
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                          <span className="text-xl group-hover:scale-110 transition-transform">📁</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">Tous mes projets</h4>
                          <p className="text-xs text-gray-500">Liste complète</p>
                        </div>
                      </div>
                    </a>
                    
                    <a
                      href="/business/creer-projet"
                      className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors">
                          <span className="text-xl group-hover:scale-110 transition-transform">➕</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 group-hover:text-green-600">Nouveau projet</h4>
                          <p className="text-xs text-gray-500">Créer un projet</p>
                        </div>
                      </div>
                    </a>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-4">💡 <strong>Astuce :</strong> Accédez rapidement à vos projets depuis la sidebar</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                        📊 Suivez vos KPIs
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                        📈 Analysez les tendances
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                        🤝 Collaborez en équipe
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* HISTORY TAB */}
            {activeTab === 'history' && user && (
              <TransactionHistory userId={user.id} />
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🌍 Langue</h3>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="zh">中文 (Chinois)</option>
                  </select>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">🔒 Sécurité</h3>
                  <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg">
                    <p className="font-medium text-gray-900">Changer le mot de passe</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
