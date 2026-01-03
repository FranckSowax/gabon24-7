'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import AvatarUpload from '@/components/profile/AvatarUpload'
import TransactionHistory from '@/components/profile/TransactionHistory'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, CreditCard, Coins, FolderOpen, History, Settings,
  ChevronLeft, Camera, Mail, Phone, FileText, Globe, Lock,
  Bell, Palette, Shield, LogOut, Check, Crown, Zap, Sparkles,
  Calendar, Clock
} from 'lucide-react'

export const dynamic = 'force-dynamic'

interface UserProfile {
  id: string
  full_name: string
  email: string
  phone_number?: string
  avatar_url?: string
  bio?: string
  credits_balance?: number
  subscription_type?: string
}

interface CreditPackage {
  id: string
  name: string
  slug: string
  credits: number
  bonus_credits: number
  price_xaf: number
  is_popular: boolean
  is_active: boolean
}

const DEFAULT_CREDIT_PACKAGES = [
  { id: 'default-1', name: 'Découverte', slug: 'discovery', credits: 50, bonus_credits: 0, price_xaf: 1000, is_popular: false, is_active: true },
  { id: 'default-2', name: 'Standard', slug: 'standard', credits: 150, bonus_credits: 0, price_xaf: 2500, is_popular: true, is_active: true },
  { id: 'default-3', name: 'Premium', slug: 'premium', credits: 400, bonus_credits: 0, price_xaf: 5000, is_popular: false, is_active: true },
]

const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    slug: 'free',
    name: 'Freemium',
    price: 0,
    credits: 0,
    features: ['5 articles par jour', 'Accès limité', 'Support communautaire'],
    icon: User,
    gradient: 'from-gray-400 to-gray-500'
  },
  {
    id: 'premium',
    slug: 'discovery',
    name: 'Premium',
    price: 3000,
    credits: 300,
    features: ['300 crédits/mois', 'Articles illimités', 'WhatsApp Gabon Insight', 'Business Plan IA'],
    icon: Zap,
    gradient: 'from-blue-500 to-indigo-600',
    popular: true
  },
  {
    id: 'pro',
    slug: 'pro',
    name: 'Professionnel',
    price: 12000,
    credits: 1000,
    features: ['1000 crédits/mois', 'Tout Premium', 'Veille & Audio', 'Support prioritaire'],
    icon: Crown,
    gradient: 'from-orange-500 to-red-600'
  }
]

// Tab configuration
const TABS = [
  { id: 'profile', label: 'Profil', icon: User, disabled: false },
  { id: 'subscription', label: 'Abonnement', icon: CreditCard, disabled: false },
  { id: 'credits', label: 'Crédits', icon: Coins, disabled: false },
  { id: 'projets', label: 'Mes Projets', icon: FolderOpen, disabled: false },
  { id: 'history', label: 'Historique', icon: History, disabled: false },
  { id: 'notifications', label: 'Notifications', icon: Bell, disabled: true, comingSoon: true },
  { id: 'appearance', label: 'Apparence', icon: Palette, disabled: false },
  { id: 'security', label: 'Sécurité', icon: Shield, disabled: false },
] as const

type TabId = typeof TABS[number]['id']

export default function MonProfilPage() {
  const { user, subscription, subscriptionPlan, loading: authLoading } = useAuth()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [mobileTabsOpen, setMobileTabsOpen] = useState(false)

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>(DEFAULT_CREDIT_PACKAGES)

  // Notification settings state
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    whatsapp: true,
    newsletter: true
  })

  // Appearance settings state
  const [appearance, setAppearance] = useState({
    theme: 'light',
    language: 'fr'
  })

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      loadUserProfile()
      loadCreditPackages()
    }
  }, [user])

  const loadCreditPackages = async () => {
    try {
      const { data } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('is_active', true)
        .order('price_xaf', { ascending: true })

      if (data && data.length > 0) {
        setCreditPackages(data)
      }
    } catch (error) {
      console.error('Erreur chargement packages:', error)
    }
  }

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
      }
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCreditPurchase = (pkg: CreditPackage) => {
    const params = new URLSearchParams({
      type: 'credits',
      amount: pkg.price_xaf.toString(),
      packageId: pkg.id,
      credits: pkg.credits.toString(),
      bonus: (pkg.bonus_credits || 0).toString(),
      description: `${pkg.name} - ${pkg.credits + (pkg.bonus_credits || 0)} crédits`
    })
    router.push(`/paiement?${params.toString()}`)
  }

  const handleSubscriptionUpgrade = (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (plan.price === 0) return

    const params = new URLSearchParams({
      type: 'subscription',
      amount: plan.price.toString(),
      planSlug: plan.slug,
      planName: plan.name,
      credits: plan.credits.toString(),
      description: `Abonnement ${plan.name} - ${plan.credits} crédits/mois`
    })
    router.push(`/paiement?${params.toString()}`)
  }

  // Apply theme to document
  const applyTheme = (theme: string) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      localStorage.setItem('theme', 'system')
    }
  }

  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light'
    setAppearance(prev => ({ ...prev, theme: savedTheme }))
    applyTheme(savedTheme)
  }, [])

  // Handle theme change
  const handleThemeChange = (newTheme: string) => {
    setAppearance({ ...appearance, theme: newTheme })
    applyTheme(newTheme)
  }

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return
    if (!user) return

    setDeleting(true)
    try {
      // Soft delete - mark user as deleted instead of hard delete
      const { error } = await supabase
        .from('users')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          email: `deleted_${user.id}@deleted.gabon247.com`
        })
        .eq('id', user.id)

      if (error) throw error

      // Sign out the user
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Erreur suppression compte:', error)
      alert('Erreur lors de la suppression du compte. Veuillez réessayer.')
    } finally {
      setDeleting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const currentPlan = subscriptionPlan?.slug || 'free'
  const creditsBalance = profile?.credits_balance || 0
  const currentTabData = TABS.find(t => t.id === activeTab)

  // Calculer les jours restants avant expiration
  const getDaysRemaining = (): number => {
    if (!subscription?.current_period_end) return 0
    const endDate = new Date(subscription.current_period_end)
    const now = new Date()
    const diffTime = endDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  // Obtenir le vrai prix affiché selon le cycle de facturation
  const getDisplayPrice = (): { price: number; period: string; isYearly: boolean } => {
    if (!subscriptionPlan || subscriptionPlan.price_monthly === 0) {
      return { price: 0, period: 'mois', isYearly: false }
    }

    const isYearly = subscription?.billing_cycle === 'yearly'
    if (isYearly && subscriptionPlan.price_yearly) {
      return { price: subscriptionPlan.price_yearly, period: 'an', isYearly: true }
    }
    return { price: subscriptionPlan.price_monthly, period: 'mois', isYearly: false }
  }

  const daysRemaining = getDaysRemaining()
  const displayPrice = getDisplayPrice()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex min-h-screen">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64">
          {/* Mobile Header */}
          <div className="lg:hidden sticky top-16 z-40 bg-white border-b border-gray-200 px-4 py-3">
            <button
              onClick={() => setMobileTabsOpen(!mobileTabsOpen)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-3">
                {currentTabData && <currentTabData.icon className="w-5 h-5 text-orange-500" />}
                <span className="font-semibold text-gray-900">{currentTabData?.label}</span>
              </div>
              <ChevronLeft className={`w-5 h-5 text-gray-500 transition-transform ${mobileTabsOpen ? 'rotate-90' : '-rotate-90'}`} />
            </button>

            <AnimatePresence>
              {mobileTabsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 pb-1 space-y-1">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          if (!tab.disabled) {
                            setActiveTab(tab.id)
                            setMobileTabsOpen(false)
                          }
                        }}
                        disabled={tab.disabled}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          tab.disabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : activeTab === tab.id
                            ? 'bg-orange-50 text-orange-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <tab.icon className="w-5 h-5" />
                        <span className="font-medium">{tab.label}</span>
                        {'comingSoon' in tab && tab.comingSoon && (
                          <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Bientôt</span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="max-w-7xl mx-auto px-4 py-6 lg:px-8 lg:py-10">
            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
              {/* Desktop Sidebar Navigation */}
              <aside className="hidden lg:block w-64 flex-shrink-0">
                <div className="sticky top-24 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <nav className="p-2">
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                          tab.disabled
                            ? 'text-gray-400 cursor-not-allowed opacity-50'
                            : activeTab === tab.id
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id && !tab.disabled ? 'text-white' : ''}`} />
                        <span className="font-medium">{tab.label}</span>
                        {'comingSoon' in tab && tab.comingSoon && (
                          <span className="ml-auto text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Bientôt</span>
                        )}
                      </button>
                    ))}
                  </nav>

                  {/* Logout button */}
                  <div className="border-t border-gray-100 p-2">
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut()
                        router.push('/')
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all"
                    >
                      <LogOut className="w-5 h-5" />
                      <span className="font-medium">Déconnexion</span>
                    </button>
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 lg:p-8">
                          <div className="flex items-center justify-between mb-8">
                            <div>
                              <h1 className="text-2xl font-bold text-gray-900">Profil</h1>
                              <p className="text-gray-500 mt-1">Gérez vos informations personnelles</p>
                            </div>
                          </div>

                          {/* Avatar Section */}
                          <div className="mb-8">
                            <label className="block text-sm font-medium text-gray-700 mb-4">Photo de profil</label>
                            <div className="flex flex-wrap items-center gap-4">
                              {user && (
                                <AvatarUpload
                                  userId={user.id}
                                  currentAvatar={profile?.avatar_url}
                                  onUploadSuccess={(url) => {
                                    setProfile({ ...profile!, avatar_url: url })
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Form Fields */}
                          <div className="space-y-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nom complet
                              </label>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.full_name || ''}
                                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white transition-all"
                                  placeholder="Votre nom complet"
                                />
                              ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                                  {profile?.full_name || 'Non renseigné'}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4" />
                                  Email
                                </div>
                              </label>
                              <div className="px-4 py-3 bg-gray-100 rounded-xl text-gray-600">
                                {profile?.email}
                                <span className="ml-2 text-xs text-gray-400">(non modifiable)</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4" />
                                  Téléphone
                                </div>
                              </label>
                              {isEditing ? (
                                <input
                                  type="tel"
                                  value={editForm.phone_number || ''}
                                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white transition-all"
                                  placeholder="+241 XX XX XX XX"
                                />
                              ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900">
                                  {profile?.phone_number || 'Non renseigné'}
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  À propos
                                </div>
                              </label>
                              {isEditing ? (
                                <textarea
                                  value={editForm.bio || ''}
                                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                                  rows={4}
                                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent focus:bg-white transition-all resize-none"
                                  placeholder="Présentez-vous en quelques mots..."
                                />
                              ) : (
                                <div className="px-4 py-3 bg-gray-50 rounded-xl text-gray-900 min-h-[100px]">
                                  {profile?.bio || 'Non renseigné'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => {
                                    setIsEditing(false)
                                    setEditForm(profile || {})
                                  }}
                                  className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-all"
                                >
                                  Annuler
                                </button>
                                <button
                                  onClick={handleSaveProfile}
                                  disabled={saving}
                                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-lg shadow-orange-500/25"
                                >
                                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setIsEditing(true)}
                                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25"
                              >
                                Modifier le profil
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SUBSCRIPTION TAB */}
                    {activeTab === 'subscription' && (
                      <div className="space-y-6">
                        {/* Current Plan Banner */}
                        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-2xl p-6 lg:p-8 text-white shadow-xl shadow-orange-500/20">
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                              <div>
                                <p className="text-orange-100 text-sm font-medium mb-1">Abonnement actuel</p>
                                <h2 className="text-3xl font-bold">{subscriptionPlan?.name || 'Freemium'}</h2>
                                <div className="flex flex-wrap items-center gap-3 mt-2">
                                  <p className="text-orange-100">
                                    {displayPrice.price > 0 ? (
                                      <>
                                        <span className="text-white font-semibold">{displayPrice.price.toLocaleString('fr-FR')}</span> FCFA/{displayPrice.period}
                                      </>
                                    ) : (
                                      'Gratuit'
                                    )}
                                  </p>
                                  {displayPrice.isYearly && (
                                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">
                                      Abonnement annuel
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                                <Sparkles className="w-5 h-5" />
                                <span className="font-medium">{creditsBalance} crédits</span>
                              </div>
                            </div>

                            {/* Jours restants - affiché seulement pour les abonnés payants */}
                            {subscription && displayPrice.price > 0 && (
                              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/20">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-orange-200" />
                                  <span className="text-sm text-orange-100">
                                    Prochain renouvellement : <span className="text-white font-medium">
                                      {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                      })}
                                    </span>
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-orange-200" />
                                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                                    daysRemaining <= 7
                                      ? 'bg-red-500 text-white'
                                      : daysRemaining <= 14
                                      ? 'bg-yellow-500 text-yellow-900'
                                      : 'bg-white/20 text-white'
                                  }`}>
                                    {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                                  </span>
                                </div>
                                {displayPrice.isYearly && (
                                  <div className="flex items-center gap-2 text-xs text-orange-100">
                                    <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                                    Crédits renouvelés chaque mois
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Plans Grid */}
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-6">Choisir un plan</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                            {SUBSCRIPTION_PLANS.map((plan) => {
                              const Icon = plan.icon
                              const isCurrentPlan = currentPlan === plan.slug || (currentPlan === 'free' && plan.id === 'free')

                              return (
                                <div
                                  key={plan.id}
                                  className={`relative rounded-2xl border-2 p-6 transition-all duration-300 ${
                                    plan.popular
                                      ? 'border-orange-500 shadow-xl shadow-orange-500/10'
                                      : 'border-gray-200 hover:border-gray-300'
                                  } ${isCurrentPlan ? 'bg-orange-50' : 'bg-white'}`}
                                >
                                  {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                      <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                                        RECOMMANDÉ
                                      </span>
                                    </div>
                                  )}

                                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                                    <Icon className="w-6 h-6 text-white" />
                                  </div>

                                  <h4 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h4>
                                  <div className="mb-4">
                                    <span className="text-3xl font-bold text-gray-900">
                                      {plan.price.toLocaleString('fr-FR')}
                                    </span>
                                    <span className="text-gray-500 ml-1">FCFA/mois</span>
                                  </div>

                                  <ul className="space-y-3 mb-6">
                                    {plan.features.map((feature, index) => (
                                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                      </li>
                                    ))}
                                  </ul>

                                  {isCurrentPlan ? (
                                    <button
                                      disabled
                                      className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-medium cursor-not-allowed"
                                    >
                                      Plan actuel
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSubscriptionUpgrade(plan)}
                                      className={`w-full py-3 rounded-xl font-medium transition-all ${
                                        plan.popular
                                          ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25'
                                          : 'bg-gray-900 text-white hover:bg-gray-800'
                                      }`}
                                    >
                                      {plan.price === 0 ? 'Passer au gratuit' : 'Choisir ce plan'}
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CREDITS TAB */}
                    {activeTab === 'credits' && (
                      <div className="space-y-6">
                        {/* Credits Balance */}
                        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 lg:p-8 text-white shadow-xl shadow-emerald-500/20">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <p className="text-emerald-100 text-sm font-medium mb-1">Solde disponible</p>
                              <h2 className="text-4xl lg:text-5xl font-bold">{creditsBalance}</h2>
                              <p className="text-emerald-100 mt-1">crédits</p>
                            </div>
                            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                              <Coins className="w-10 h-10" />
                            </div>
                          </div>
                        </div>

                        {/* Credit Packages */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
                          <div className="flex items-center justify-between mb-6">
                            <div>
                              <h3 className="text-xl font-bold text-gray-900">Acheter des crédits</h3>
                              <p className="text-gray-500 text-sm mt-1">Packs de crédits à la carte</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {creditPackages.map((pkg) => (
                              <div
                                key={pkg.id}
                                className={`relative rounded-2xl border-2 p-6 transition-all duration-300 hover:shadow-lg ${
                                  pkg.is_popular
                                    ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/10'
                                    : 'border-gray-200 bg-white hover:border-emerald-300'
                                }`}
                              >
                                {pkg.is_popular && (
                                  <span className="absolute -top-2.5 right-4 bg-emerald-500 text-white px-3 py-0.5 rounded-full text-xs font-bold">
                                    Populaire
                                  </span>
                                )}

                                <div className="text-center mb-4">
                                  <p className="text-4xl font-bold text-gray-900">{pkg.credits}</p>
                                  <p className="text-sm text-gray-500">crédits</p>
                                  {pkg.bonus_credits > 0 && (
                                    <p className="text-xs text-emerald-600 font-medium mt-1">
                                      +{pkg.bonus_credits} bonus
                                    </p>
                                  )}
                                </div>

                                <div className="text-center mb-4">
                                  <p className="text-2xl font-bold text-orange-600">
                                    {pkg.price_xaf.toLocaleString('fr-FR')}
                                  </p>
                                  <p className="text-xs text-gray-500">FCFA</p>
                                </div>

                                <button
                                  onClick={() => handleCreditPurchase(pkg)}
                                  className={`w-full py-3 rounded-xl font-medium transition-all ${
                                    pkg.is_popular
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25'
                                      : 'bg-gray-900 text-white hover:bg-gray-800'
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
                      <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <h2 className="text-2xl font-bold mb-2">Mes Projets</h2>
                              <p className="text-blue-100">Gérez vos projets business</p>
                            </div>
                            <button
                              onClick={() => router.push('/business/mes-projets')}
                              className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                            >
                              Voir tous
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </button>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
                          <h3 className="text-lg font-bold text-gray-900 mb-6">Accès rapide</h3>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <a
                              href="/business/mes-projets"
                              className="group p-5 border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                                  <FolderOpen className="w-6 h-6 text-blue-600 group-hover:text-white" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">Tous mes projets</h4>
                                  <p className="text-sm text-gray-500">Liste complète</p>
                                </div>
                              </div>
                            </a>

                            <a
                              href="/business/creer-projet"
                              className="group p-5 border-2 border-dashed border-gray-300 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors">
                                  <span className="text-2xl group-hover:text-white">+</span>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 group-hover:text-green-600">Nouveau projet</h4>
                                  <p className="text-sm text-gray-500">Créer un projet</p>
                                </div>
                              </div>
                            </a>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && user && (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-6 lg:p-8 border-b border-gray-100">
                          <h2 className="text-xl font-bold text-gray-900">Historique des transactions</h2>
                          <p className="text-gray-500 mt-1">Vos paiements et achats de crédits</p>
                        </div>
                        <div className="p-6 lg:p-8">
                          <TransactionHistory userId={user.id} />
                        </div>
                      </div>
                    )}

                    {/* NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
                        <div className="mb-8">
                          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
                          <p className="text-gray-500 mt-1">Gérez vos préférences de notification</p>
                        </div>

                        <div className="space-y-6">
                          {[
                            { key: 'email', label: 'Notifications par email', desc: 'Recevez des mises à jour par email' },
                            { key: 'push', label: 'Notifications push', desc: 'Notifications sur votre appareil' },
                            { key: 'whatsapp', label: 'WhatsApp', desc: 'Alertes et veilles sur WhatsApp' },
                            { key: 'newsletter', label: 'Newsletter', desc: 'Actualités hebdomadaires' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
                              <div>
                                <h4 className="font-medium text-gray-900">{item.label}</h4>
                                <p className="text-sm text-gray-500">{item.desc}</p>
                              </div>
                              <button
                                onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                  notifications[item.key as keyof typeof notifications] ? 'bg-orange-500' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                    notifications[item.key as keyof typeof notifications] ? 'left-7' : 'left-1'
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end mt-8 pt-6 border-t border-gray-100">
                          <button className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25">
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === 'appearance' && (
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
                        <div className="mb-8">
                          <h2 className="text-xl font-bold text-gray-900">Apparence</h2>
                          <p className="text-gray-500 mt-1">Personnalisez l'apparence de l'application</p>
                        </div>

                        <div className="space-y-8">
                          {/* Theme */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-4">Thème</label>
                            <div className="grid grid-cols-3 gap-4">
                              {[
                                { value: 'light', label: 'Clair', icon: '☀️' },
                                { value: 'dark', label: 'Sombre', icon: '🌙' },
                                { value: 'system', label: 'Système', icon: '💻' },
                              ].map((theme) => (
                                <button
                                  key={theme.value}
                                  onClick={() => handleThemeChange(theme.value)}
                                  className={`p-4 rounded-xl border-2 transition-all ${
                                    appearance.theme === theme.value
                                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                                  }`}
                                >
                                  <span className="text-2xl mb-2 block">{theme.icon}</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{theme.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Language */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-4">
                              <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Langue
                              </div>
                            </label>
                            <select
                              value={appearance.language}
                              onChange={(e) => setAppearance({ ...appearance, language: e.target.value })}
                              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            >
                              <option value="fr">Français</option>
                              <option value="en">English</option>
                              <option value="zh">中文 (Chinois)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end mt-8 pt-6 border-t border-gray-100">
                          <button className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25">
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                      <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:p-8">
                          <div className="mb-8">
                            <h2 className="text-xl font-bold text-gray-900">Sécurité</h2>
                            <p className="text-gray-500 mt-1">Gérez la sécurité de votre compte</p>
                          </div>

                          <div className="space-y-4">
                            <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Lock className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                  <h4 className="font-medium text-gray-900">Changer le mot de passe</h4>
                                  <p className="text-sm text-gray-500">Dernière modification: jamais</p>
                                </div>
                              </div>
                              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                  <Shield className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="text-left">
                                  <h4 className="font-medium text-gray-900">Authentification à deux facteurs</h4>
                                  <p className="text-sm text-gray-500">Non activée</p>
                                </div>
                              </div>
                              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </button>

                            <button className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                  <History className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="text-left">
                                  <h4 className="font-medium text-gray-900">Sessions actives</h4>
                                  <p className="text-sm text-gray-500">1 session active</p>
                                </div>
                              </div>
                              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 lg:p-8">
                          <h3 className="text-lg font-bold text-red-600 mb-4">Zone dangereuse</h3>
                          <p className="text-gray-600 text-sm mb-4">
                            Ces actions sont irréversibles. Procédez avec précaution.
                          </p>

                          {!showDeleteConfirm ? (
                            <button
                              onClick={() => setShowDeleteConfirm(true)}
                              className="px-6 py-2.5 border-2 border-red-500 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-all"
                            >
                              Supprimer mon compte
                            </button>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-4">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <Shield className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-red-700">Êtes-vous sûr ?</h4>
                                  <p className="text-sm text-red-600 mt-1">
                                    Cette action est irréversible. Toutes vos données, crédits et abonnements seront perdus.
                                  </p>
                                </div>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-red-700 mb-2">
                                  Tapez <strong>SUPPRIMER</strong> pour confirmer
                                </label>
                                <input
                                  type="text"
                                  value={deleteConfirmText}
                                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                                  placeholder="SUPPRIMER"
                                  className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                              </div>

                              <div className="flex gap-3">
                                <button
                                  onClick={() => {
                                    setShowDeleteConfirm(false)
                                    setDeleteConfirmText('')
                                  }}
                                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                                >
                                  Annuler
                                </button>
                                <button
                                  onClick={handleDeleteAccount}
                                  disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                  {deleting ? 'Suppression...' : 'Supprimer définitivement'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
