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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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

    // Rafraîchir quand les crédits sont mis à jour (après paiement)
    const handleCreditsUpdated = () => { if (user) loadUserProfile() }
    window.addEventListener('credits-updated', handleCreditsUpdated)
    return () => window.removeEventListener('credits-updated', handleCreditsUpdated)
  }, [user])

  // Auto-reconcile pending payments when user visits credits or history tab
  useEffect(() => {
    if (!user || (activeTab !== 'credits' && activeTab !== 'history')) return
    const reconcile = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) return
        await fetch(`${API_URL}/api/payments/reconcile`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        })
        // Silently refresh profile to get updated credits_balance
        loadUserProfile()
      } catch (_) { /* silent */ }
    }
    reconcile()
  }, [user, activeTab])

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

      // Récupérer le vrai solde depuis user_credits (source de vérité)
      const { data: creditData } = await supabase
        .from('user_credits')
        .select('balance, bonus_balance')
        .eq('user_id', user.id)
        .single()

      const realBalance = (creditData?.balance || 0) + (creditData?.bonus_balance || 0)

      if (data) {
        setProfile({ ...data, credits_balance: realBalance })
        setEditForm({ ...data, credits_balance: realBalance })
      } else {
        const defaultProfile = {
          id: user.id,
          full_name: user.user_metadata?.full_name || '',
          email: user.email || '',
          phone_number: (user.user_metadata as any)?.phone_number || '',
          avatar_url: user.user_metadata?.avatar_url || '',
          bio: '',
          credits_balance: realBalance
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
  const getDisplayPrice = (): {
    price: number;
    period: string;
    isYearly: boolean;
    monthlyEquivalent?: number;
    discount?: number;
  } => {
    if (!subscriptionPlan || subscriptionPlan.price_monthly === 0) {
      return { price: 0, period: 'mois', isYearly: false }
    }

    const isYearly = subscription?.billing_cycle === 'yearly'
    if (isYearly && subscriptionPlan.price_yearly) {
      const monthlyEquivalent = Math.round(subscriptionPlan.price_yearly / 12)
      const normalYearlyPrice = subscriptionPlan.price_monthly * 12
      const discount = Math.round(((normalYearlyPrice - subscriptionPlan.price_yearly) / normalYearlyPrice) * 100)
      return {
        price: subscriptionPlan.price_yearly,
        period: 'an',
        isYearly: true,
        monthlyEquivalent,
        discount
      }
    }
    return { price: subscriptionPlan.price_monthly, period: 'mois', isYearly: false }
  }

  const daysRemaining = getDaysRemaining()
  const displayPrice = getDisplayPrice()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 min-h-[calc(100vh-4rem)]">
          {/* ============================================ */}
          {/* HERO BANNER */}
          {/* ============================================ */}
          <div className="border-b border-gray-100 bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden ring-4 ring-orange-100 bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl sm:text-3xl text-white font-bold">
                        {profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                </div>

                {/* Name + Plan Badge */}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                    {profile?.full_name || 'Utilisateur'}
                  </h1>
                  <p className="text-sm text-gray-500 truncate">{profile?.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      currentPlan === 'pro'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white'
                        : currentPlan === 'discovery'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {currentPlan === 'pro' && <Crown className="w-3 h-3" />}
                      {currentPlan === 'discovery' && <Zap className="w-3 h-3" />}
                      {subscriptionPlan?.name || 'Freemium'}
                    </span>
                  </div>
                </div>

                {/* Quick Stats Pills */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{creditsBalance} crédits</span>
                  </div>
                  {subscription && daysRemaining > 0 && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                      daysRemaining <= 7
                        ? 'bg-red-50 text-red-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{daysRemaining}j restants</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Depuis {(user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '...'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* HORIZONTAL TAB BAR (sticky) */}
          {/* ============================================ */}
          <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Mobile: icon-only grid tabs */}
              <div className="flex sm:hidden items-center justify-between py-2 gap-0.5" role="tablist">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-label={tab.label}
                    className={`relative flex flex-col items-center gap-0.5 flex-1 py-2 rounded-lg transition-all duration-200 ${
                      tab.disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : activeTab === tab.id
                        ? 'text-orange-600'
                        : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className={`text-[10px] font-medium leading-tight ${
                      activeTab === tab.id ? 'text-orange-600' : 'text-gray-400'
                    }`}>
                      {tab.label.length > 8 ? tab.label.slice(0, 7) + '.' : tab.label}
                    </span>
                    {activeTab === tab.id && !tab.disabled && (
                      <motion.div
                        layoutId="activeTabMobile"
                        className="absolute inset-0 bg-orange-50 rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Desktop/Tablet: full label tabs */}
              <nav className="hidden sm:flex items-center gap-1 overflow-x-auto scrollbar-hide py-2" role="tablist">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => !tab.disabled && setActiveTab(tab.id)}
                    disabled={tab.disabled}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      tab.disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : activeTab === tab.id
                        ? 'text-orange-600'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {'comingSoon' in tab && tab.comingSoon && (
                      <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-400 rounded">Bientôt</span>
                    )}
                    {activeTab === tab.id && !tab.disabled && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-orange-50 rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* ============================================ */}
          {/* TAB CONTENT */}
          {/* ============================================ */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              >

                {/* ========== PROFILE TAB ========== */}
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                      <div className="px-6 py-4">
                        <h2 className="text-base font-semibold text-gray-900">Informations personnelles</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Vos informations de base sur la plateforme</p>
                      </div>

                      <div className="px-6 py-5 space-y-5">
                        {/* Avatar upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Photo de profil</label>
                          <div className="flex items-center gap-4">
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

                        {/* Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom complet</label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.full_name || ''}
                              onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-gray-400"
                              placeholder="Votre nom complet"
                            />
                          ) : (
                            <p className="px-3.5 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900 border border-transparent">
                              {profile?.full_name || <span className="text-gray-400 italic">Non renseigné</span>}
                            </p>
                          )}
                        </div>

                        {/* Email */}
                        <div>
                          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </label>
                          <div className="flex items-center gap-2">
                            <p className="flex-1 px-3.5 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-500 border border-transparent">
                              {profile?.email}
                            </p>
                            <span className="px-2 py-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 rounded">Vérifié</span>
                          </div>
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                            <Phone className="w-3.5 h-3.5" />
                            Téléphone
                          </label>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={editForm.phone_number || ''}
                              onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-gray-400"
                              placeholder="+241 XX XX XX XX"
                            />
                          ) : (
                            <p className="px-3.5 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900 border border-transparent">
                              {profile?.phone_number || <span className="text-gray-400 italic">Non renseigné</span>}
                            </p>
                          )}
                        </div>

                        {/* Bio */}
                        <div>
                          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            À propos
                          </label>
                          {isEditing ? (
                            <textarea
                              value={editForm.bio || ''}
                              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                              rows={3}
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none placeholder:text-gray-400"
                              placeholder="Présentez-vous en quelques mots..."
                            />
                          ) : (
                            <p className="px-3.5 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-900 border border-transparent min-h-[80px]">
                              {profile?.bio || <span className="text-gray-400 italic">Non renseigné</span>}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Action footer */}
                      <div className="px-6 py-4 bg-gray-50/50 flex items-center justify-end gap-3">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => { setIsEditing(false); setEditForm(profile || {}) }}
                              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={handleSaveProfile}
                              disabled={saving}
                              className="px-4 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
                            >
                              {saving ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-4 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                          >
                            Modifier le profil
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== SUBSCRIPTION TAB ========== */}
                {activeTab === 'subscription' && (
                  <div className="space-y-6">
                    {/* Current Plan Banner */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-xl p-5 lg:p-6 text-white">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                      <div className="relative">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div>
                            <p className="text-orange-200 text-xs font-medium uppercase tracking-wider mb-1">Plan actuel</p>
                            <h2 className="text-2xl font-bold">{subscriptionPlan?.name || 'Freemium'}</h2>
                            <div className="flex flex-wrap items-center gap-3 mt-2">
                              {displayPrice.price > 0 ? (
                                displayPrice.isYearly ? (
                                  <div className="space-y-1">
                                    <p className="text-orange-100">
                                      <span className="text-white font-semibold">{displayPrice.price.toLocaleString('fr-FR')}</span> FCFA/an
                                      <span className="ml-2 text-xs">({displayPrice.monthlyEquivalent?.toLocaleString('fr-FR')} FCFA/mois)</span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                        -{displayPrice.discount}% économisé
                                      </span>
                                      <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-medium">
                                        Abonnement annuel
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-orange-100">
                                    <span className="text-white font-semibold">{displayPrice.price.toLocaleString('fr-FR')}</span> FCFA/mois
                                  </p>
                                )
                              ) : (
                                <p className="text-orange-100">Gratuit</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm">
                            <Sparkles className="w-4 h-4" />
                            <span className="font-semibold">{creditsBalance} crédits</span>
                          </div>
                        </div>

                        {/* Days remaining */}
                        {subscription && displayPrice.price > 0 && (
                          <div className="flex flex-wrap items-center gap-4 pt-3 mt-3 border-t border-white/20">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-orange-200" />
                              <span className="text-sm text-orange-100">
                                Renouvellement : <span className="text-white font-medium">
                                  {new Date(subscription.current_period_end).toLocaleDateString('fr-FR', {
                                    day: 'numeric', month: 'long', year: 'numeric'
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
                                <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full" />
                                Crédits renouvelés chaque mois
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Plans Grid */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choisir un plan</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {SUBSCRIPTION_PLANS.map((plan, index) => {
                          const Icon = plan.icon
                          const isCurrentPlan = currentPlan === plan.slug || (currentPlan === 'free' && plan.id === 'free')

                          return (
                            <motion.div
                              key={plan.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`relative rounded-xl border p-5 transition-all duration-200 ${
                                isCurrentPlan
                                  ? 'border-orange-300 bg-orange-50/50 ring-1 ring-orange-200'
                                  : plan.popular
                                  ? 'border-orange-200 bg-white hover:border-orange-300 hover:shadow-md'
                                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                              }`}
                            >
                              {plan.popular && !isCurrentPlan && (
                                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                                  <span className="bg-orange-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold shadow-sm">
                                    RECOMMANDÉ
                                  </span>
                                </div>
                              )}
                              {isCurrentPlan && (
                                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                                  <span className="bg-green-500 text-white px-3 py-0.5 rounded-full text-[11px] font-bold shadow-sm flex items-center gap-1">
                                    <Check className="w-3 h-3" /> ACTUEL
                                  </span>
                                </div>
                              )}

                              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-3`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>

                              <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
                              <div className="mt-1 mb-3">
                                <span className="text-2xl font-bold text-gray-900">{plan.price.toLocaleString('fr-FR')}</span>
                                <span className="text-sm text-gray-500 ml-1">FCFA/mois</span>
                              </div>

                              <ul className="space-y-2 mb-5">
                                {plan.features.map((feature, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                    <span>{feature}</span>
                                  </li>
                                ))}
                              </ul>

                              {isCurrentPlan ? (
                                <button disabled className="w-full py-2.5 text-sm bg-gray-100 text-gray-400 rounded-lg font-medium cursor-not-allowed">
                                  Plan actuel
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSubscriptionUpgrade(plan)}
                                  className={`w-full py-2.5 text-sm rounded-lg font-medium transition-all ${
                                    plan.popular
                                      ? 'bg-orange-500 text-white hover:bg-orange-600'
                                      : 'bg-gray-900 text-white hover:bg-gray-800'
                                  }`}
                                >
                                  {plan.price === 0 ? 'Passer au gratuit' : 'Choisir ce plan'}
                                </button>
                              )}
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== CREDITS TAB ========== */}
                {activeTab === 'credits' && (
                  <div className="space-y-6">
                    {/* Credits Balance */}
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl p-5 text-white flex items-center justify-between">
                      <div>
                        <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Solde disponible</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-3xl sm:text-4xl font-bold">{creditsBalance}</span>
                          <span className="text-emerald-200 text-sm">crédits</span>
                        </div>
                      </div>
                      <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <Coins className="w-7 h-7" />
                      </div>
                    </div>

                    {/* Credit Packages */}
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                      <div className="px-6 py-4">
                        <h3 className="text-base font-semibold text-gray-900">Acheter des crédits</h3>
                        <p className="text-sm text-gray-500 mt-0.5">Packs de crédits à la carte</p>
                      </div>
                      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {creditPackages.map((pkg, index) => (
                          <motion.div
                            key={pkg.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`relative rounded-xl border p-5 text-center transition-all duration-200 ${
                              pkg.is_popular
                                ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                                : 'border-gray-200 hover:border-emerald-200 hover:shadow-sm'
                            }`}
                          >
                            {pkg.is_popular && (
                              <span className="absolute -top-2.5 right-3 bg-emerald-500 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                                Populaire
                              </span>
                            )}

                            <p className="text-3xl font-bold text-gray-900">{pkg.credits}</p>
                            <p className="text-xs text-gray-500 mb-1">crédits</p>
                            {pkg.bonus_credits > 0 && (
                              <p className="text-xs text-emerald-600 font-medium">+{pkg.bonus_credits} bonus</p>
                            )}

                            <div className="my-3 pt-3 border-t border-gray-100">
                              <p className="text-xl font-bold text-orange-600">{pkg.price_xaf.toLocaleString('fr-FR')}</p>
                              <p className="text-[11px] text-gray-400">FCFA ({Math.round(pkg.price_xaf / (pkg.credits + (pkg.bonus_credits || 0)))} FCFA/crédit)</p>
                            </div>

                            <button
                              onClick={() => handleCreditPurchase(pkg)}
                              className={`w-full py-2.5 text-sm rounded-lg font-medium transition-colors ${
                                pkg.is_popular
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                  : 'bg-gray-900 text-white hover:bg-gray-800'
                              }`}
                            >
                              Acheter
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Recent Transactions Preview */}
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                      <div className="px-6 py-4 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-900">Transactions récentes</h3>
                        <button
                          onClick={() => setActiveTab('history')}
                          className="text-sm text-orange-500 hover:text-orange-600 font-medium"
                        >
                          Voir tout
                        </button>
                      </div>
                      <div className="px-6 py-4">
                        <p className="text-sm text-gray-400 text-center py-3">
                          Consultez l'onglet Historique pour voir vos transactions
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== PROJETS TAB ========== */}
                {activeTab === 'projets' && (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold mb-1">Mes Projets</h2>
                        <p className="text-blue-100 text-sm">Gérez vos projets business</p>
                      </div>
                      <button
                        onClick={() => router.push('/business/mes-projets')}
                        className="bg-white text-blue-600 px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                      >
                        Voir tous
                        <ChevronLeft className="w-4 h-4 rotate-180" />
                      </button>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                      <div className="px-6 py-4">
                        <h3 className="text-base font-semibold text-gray-900">Accès rapide</h3>
                      </div>
                      <div className="p-5 grid gap-4 sm:grid-cols-2">
                        <a
                          href="/business/mes-projets"
                          className="group p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                              <FolderOpen className="w-5 h-5 text-blue-600 group-hover:text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600">Tous mes projets</h4>
                              <p className="text-xs text-gray-500">Liste complète</p>
                            </div>
                          </div>
                        </a>

                        <a
                          href="/business/creer-projet"
                          className="group p-4 border border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50/50 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors">
                              <span className="text-xl text-green-600 group-hover:text-white">+</span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm text-gray-900 group-hover:text-green-600">Nouveau projet</h4>
                              <p className="text-xs text-gray-500">Créer un projet</p>
                            </div>
                          </div>
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== HISTORY TAB ========== */}
                {activeTab === 'history' && user && (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <div className="px-6 py-4">
                      <h2 className="text-base font-semibold text-gray-900">Historique des transactions</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Vos paiements et achats de crédits</p>
                    </div>
                    <div className="p-6">
                      <TransactionHistory userId={user.id} />
                    </div>
                  </div>
                )}

                {/* ========== NOTIFICATIONS TAB ========== */}
                {activeTab === 'notifications' && (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <div className="px-6 py-4">
                      <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Gérez vos préférences de notification</p>
                    </div>

                    <div className="px-6 py-2">
                      {[
                        { key: 'email', label: 'Notifications par email', desc: 'Recevez des mises à jour par email' },
                        { key: 'push', label: 'Notifications push', desc: 'Notifications sur votre appareil' },
                        { key: 'whatsapp', label: 'WhatsApp', desc: 'Alertes et veilles sur WhatsApp' },
                        { key: 'newsletter', label: 'Newsletter', desc: 'Actualités hebdomadaires' },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{item.label}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                          </div>
                          <button
                            onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${
                              notifications[item.key as keyof typeof notifications] ? 'bg-orange-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                                notifications[item.key as keyof typeof notifications] ? 'left-6' : 'left-1'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="px-6 py-4 bg-gray-50/50 flex justify-end">
                      <button className="px-4 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}

                {/* ========== APPEARANCE TAB ========== */}
                {activeTab === 'appearance' && (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <div className="px-6 py-4">
                      <h2 className="text-base font-semibold text-gray-900">Apparence</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Personnalisez l'apparence de l'application</p>
                    </div>

                    <div className="px-6 py-5 space-y-6">
                      {/* Theme */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">Thème</label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { value: 'light', label: 'Clair', icon: '☀️' },
                            { value: 'dark', label: 'Sombre', icon: '🌙' },
                            { value: 'system', label: 'Système', icon: '💻' },
                          ].map((theme) => (
                            <button
                              key={theme.value}
                              onClick={() => handleThemeChange(theme.value)}
                              className={`p-3 rounded-lg border transition-all text-center ${
                                appearance.theme === theme.value
                                  ? 'border-orange-400 bg-orange-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span className="text-xl mb-1 block">{theme.icon}</span>
                              <span className="text-xs font-medium text-gray-700">{theme.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Language */}
                      <div>
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
                          <Globe className="w-3.5 h-3.5" />
                          Langue
                        </label>
                        <select
                          value={appearance.language}
                          onChange={(e) => setAppearance({ ...appearance, language: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        >
                          <option value="fr">Français</option>
                          <option value="en">English</option>
                          <option value="zh">中文 (Chinois)</option>
                        </select>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50/50 flex justify-end">
                      <button className="px-4 py-2.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}

                {/* ========== SECURITY TAB ========== */}
                {activeTab === 'security' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                      <div className="px-6 py-4">
                        <h2 className="text-base font-semibold text-gray-900">Sécurité</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Gérez la sécurité de votre compte</p>
                      </div>

                      <div className="p-2">
                        <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Lock className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-sm font-medium text-gray-900">Changer le mot de passe</h4>
                              <p className="text-xs text-gray-500">Dernière modification: jamais</p>
                            </div>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </button>

                        <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                              <Shield className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-sm font-medium text-gray-900">Authentification à deux facteurs</h4>
                              <p className="text-xs text-gray-500">Non activée</p>
                            </div>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </button>

                        <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-all group">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center">
                              <History className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-sm font-medium text-gray-900">Sessions actives</h4>
                              <p className="text-xs text-gray-500">1 session active</p>
                            </div>
                          </div>
                          <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-white rounded-xl border border-red-200 divide-y divide-red-100">
                      <div className="px-6 py-4">
                        <h3 className="text-sm font-semibold text-red-600">Zone dangereuse</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Ces actions sont irréversibles</p>
                      </div>

                      <div className="px-6 py-4">
                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-all"
                          >
                            Supprimer mon compte
                          </button>
                        ) : (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Shield className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-red-700">Êtes-vous sûr ?</h4>
                                <p className="text-xs text-red-600 mt-0.5">
                                  Toutes vos données, crédits et abonnements seront perdus.
                                </p>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-red-700 mb-1.5">
                                Tapez <strong>SUPPRIMER</strong> pour confirmer
                              </label>
                              <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                placeholder="SUPPRIMER"
                                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                              />
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                                className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
                              >
                                Annuler
                              </button>
                              <button
                                onClick={handleDeleteAccount}
                                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                                className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                              >
                                {deleting ? 'Suppression...' : 'Supprimer'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Logout (mobile-friendly) */}
                    <button
                      onClick={async () => {
                        await supabase.auth.signOut()
                        router.push('/')
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 transition-all font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  )
}
