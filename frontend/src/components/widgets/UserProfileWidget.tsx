'use client'

import { useState, useRef, useEffect } from 'react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import { User, Settings, LogOut, Crown, Calendar, Eye, EyeOff, Wallet, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from '@/components/auth/AuthModal'
import SubscriptionModal from '@/components/subscription/SubscriptionModal'

interface UserProfile {
  id: string
  full_name?: string
  email?: string
  phone_number?: string
  avatar_url?: string
  subscription_plan?: string
  subscription_status?: string
}

export default function UserProfileWidget() {
  const { user: authUser, loading: authLoading, signOut, subscription, subscriptionPlan } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Crédit utilisateur
  const [credit, setCredit] = useState<number | null>(null)
  const [creditLoading, setCreditLoading] = useState(false)
  const [creditMasked, setCreditMasked] = useState(true)
  const [creditError, setCreditError] = useState<string | null>(null)

  // Utiliser les données de l'utilisateur authentifié comme source de vérité
  const user = authUser

  // Assurer le rendu côté client
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Charger le solde de crédit de l'utilisateur (système premium)
  useEffect(() => {
    if (!isClient) return
    if (!authUser?.id) return

    let cancelled = false
    const load = async () => {
      try {
        setCreditLoading(true)
        setCreditError(null)
        const url = `${API_URL}/api/credits-premium/balance/${encodeURIComponent(authUser.id)}`
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const total = json?.total_balance
        if (!cancelled) {
          setCredit(typeof total === 'number' ? total : 0)
        }
      } catch (e: any) {
        if (!cancelled) {
          setCreditError(e?.message || 'Erreur chargement crédit')
          setCredit(null)
        }
      } finally {
        if (!cancelled) setCreditLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [isClient, authUser?.id])

  // Fermer le dropdown quand on clique à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Empêcher le rendu pendant l'hydration pour éviter le mismatch
  if (!isClient) {
    return null
  }

  // Afficher un loader seulement si vraiment en cours de chargement ET pas d'utilisateur ET pas en cours de déconnexion
  if (authLoading && !user && !isSigningOut) {
    return (
      <div className="flex items-center justify-center p-4 space-x-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        <span className="text-white/80 text-sm">Chargement...</span>
      </div>
    )
  }

  // Afficher un état de déconnexion
  if (isSigningOut) {
    return (
      <div className="flex items-center justify-center p-4 space-x-3 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
        <span className="text-white/80 text-sm">Déconnexion...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-full">
        {/* Desktop Login */}
        <div className="hidden lg:block bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="text-center">
            <User className="w-8 h-8 mx-auto mb-2 text-white/60" />
            <p className="text-white/80 text-sm mb-3">Connectez-vous pour accéder à votre profil</p>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="w-full bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Se connecter
            </button>
          </div>
        </div>

        {/* Mobile Login */}
        <div className="lg:hidden bg-white/10 backdrop-blur-lg rounded-lg p-3 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-6 h-6 text-white/60" />
              <span className="text-white/80 text-sm">Non connecté</span>
            </div>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="bg-white/20 hover:bg-white/30 text-white text-xs py-1.5 px-3 rounded-lg transition-colors"
            >
              Connexion
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleDropdownToggle = () => {
    setShowDropdown(!showDropdown)
  }

  const handleSignOut = async () => {
    if (isSigningOut) return // Éviter les clics multiples
    
    setIsSigningOut(true)
    setShowDropdown(false)
    
    try {
      console.log('Début de la déconnexion...')
      const result = await signOut()
      console.log('Résultat signOut:', result)
      
      // Force le rechargement de la page pour nettoyer complètement l'état
      window.location.reload()
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      setIsSigningOut(false)
      // En cas d'erreur, essayer quand même de rediriger
      window.location.href = '/'
    }
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (email) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  const getPlanColor = (plan?: string) => {
    switch (plan?.toLowerCase()) {
      case 'premium': return 'text-orange-600 bg-orange-100'
      case 'pro': return 'text-purple-600 bg-purple-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPlanIcon = (plan?: string) => {
    if (plan?.toLowerCase() === 'premium' || plan?.toLowerCase() === 'pro') {
      return <Crown className="w-3 h-3" />
    }
    return null
  }



  if (!user) {
    return (
      <div className="w-full">
        {/* Desktop Login */}
        <div className="hidden lg:block bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
          <div className="text-center">
            <User className="w-8 h-8 mx-auto mb-2 text-white/60" />
            <p className="text-white/80 text-sm mb-3">Connectez-vous pour accéder à votre profil</p>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="w-full bg-white/20 hover:bg-white/30 text-white text-sm py-2 px-4 rounded-lg transition-colors"
            >
              Se connecter
            </button>
          </div>
        </div>

        {/* Mobile Login */}
        <div className="lg:hidden bg-white/10 backdrop-blur-lg rounded-lg p-3 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-6 h-6 text-white/60" />
              <span className="text-white/80 text-sm">Non connecté</span>
            </div>
            <button
              onClick={() => window.location.href = '/auth/signin'}
              className="bg-white/20 hover:bg-white/30 text-white text-xs py-1.5 px-3 rounded-lg transition-colors"
            >
              Connexion
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full relative z-50">
      {/* Desktop Layout */}
      <div className="hidden lg:block bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
        <div className="flex items-center space-x-3">
          {user.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt={user.user_metadata?.full_name || 'Avatar'}
              className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-medium truncate">
              {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'}
            </h3>
            <p className="text-white/70 text-sm truncate">
              {subscriptionPlan?.name || 'Plan gratuit'}
            </p>
            {/* Crédit utilisateur (Desktop) */}
            <div className="mt-1 flex items-center gap-2 text-xs">
              <Wallet className="w-3.5 h-3.5 text-white/80" />
              <span className={`px-2 py-0.5 rounded border ${
                !creditLoading && !creditMasked && credit !== null && credit < 10 
                  ? 'bg-red-500/20 border-red-500/40 text-red-100' 
                  : 'bg-white/10 border-white/20 text-white/90'
              }`}>
                {creditLoading ? '•••' : creditMasked ? '••••' : (credit ?? 0)}
              </span>
              {!creditLoading && !creditMasked && credit !== null && credit < 10 && (
                <span title="Crédits faibles">
                  <AlertCircle className="w-3.5 h-3.5 text-red-300" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setCreditMasked(v => !v)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label={creditMasked ? 'Afficher le crédit' : 'Masquer le crédit'}
                title={creditMasked ? 'Afficher le crédit' : 'Masquer le crédit'}
              >
                {creditMasked ? <Eye className="w-3.5 h-3.5 text-white/80" /> : <EyeOff className="w-3.5 h-3.5 text-white/80" />}
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {(subscriptionPlan?.slug === 'premium' || subscriptionPlan?.slug === 'pro') && (
              <Crown className="w-4 h-4 text-yellow-400" />
            )}
            <span className="text-white/80 text-sm">
              {subscriptionPlan?.name || 'Gratuit'}
            </span>
          </div>

          {/* Menu Button */}
          <button
            ref={buttonRef}
            onClick={handleDropdownToggle}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden bg-white/10 backdrop-blur-lg rounded-lg p-3 border border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.user_metadata?.full_name || 'Avatar'}
                className="w-8 h-8 rounded-full object-cover border-2 border-white/30"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-medium text-sm truncate">
                {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'}
              </h3>
            </div>
            
            <div className="flex flex-col items-end space-y-1">
              <div className="flex items-center space-x-1">
                {(subscriptionPlan?.slug === 'premium' || subscriptionPlan?.slug === 'pro') && (
                  <Crown className="w-3 h-3 text-yellow-400" />
                )}
                <span className="text-white/80 text-xs">
                  {subscriptionPlan?.name || 'Gratuit'}
                </span>
              </div>
              {/* Crédit utilisateur (Mobile) sous le type d'abonnement */}
              <div className="flex items-center gap-1 text-[11px]">
                <Wallet className="w-3 h-3 text-white/80" />
                <span className={`px-1.5 py-0.5 rounded border ${
                  !creditLoading && !creditMasked && credit !== null && credit < 10 
                    ? 'bg-red-500/20 border-red-500/40 text-red-100' 
                    : 'bg-white/10 border-white/20 text-white/90'
                }`}>
                  {creditLoading ? '•••' : creditMasked ? '••••' : (credit ?? 0)}
                </span>
                {!creditLoading && !creditMasked && credit !== null && credit < 10 && (
                  <span title="Crédits faibles">
                    <AlertCircle className="w-3 h-3 text-red-300" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setCreditMasked(v => !v)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                  aria-label={creditMasked ? 'Afficher le crédit' : 'Masquer le crédit'}
                  title={creditMasked ? 'Afficher le crédit' : 'Masquer le crédit'}
                >
                  {creditMasked ? <Eye className="w-3 h-3 text-white/80" /> : <EyeOff className="w-3 h-3 text-white/80" />}
                </button>
              </div>
            </div>
          </div>

          {/* Menu Button */}
          <button
            ref={buttonRef}
            onClick={handleDropdownToggle}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div 
          ref={dropdownRef}
          className="w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-10 overflow-hidden"
        >
          <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-orange-50 to-red-50">
            <div className="flex items-center space-x-3">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt={user.user_metadata?.full_name || 'Avatar'}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold">
                  {getInitials(user.user_metadata?.full_name, user.email)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-gray-900 truncate">
                  {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur'}
                </h4>
                <p className="text-sm text-gray-600 truncate">{user.email}</p>
                <p className="text-xs text-orange-600 font-medium">
                  {subscriptionPlan?.name || 'Plan Gratuit'}
                </p>
              </div>
            </div>
          </div>

          <div className="py-2">
            <button
              onClick={() => {
                setShowDropdown(false)
                window.location.href = '/profil'
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <User className="w-4 h-4" />
              <span>Mon profil</span>
            </button>
            
            <button
              onClick={() => {
                setShowDropdown(false)
                window.location.href = '/abonnement'
              }}
              className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Crown className="w-4 h-4" />
              <span>Abonnement</span>
            </button>
            
            <button
              onClick={() => {
                setShowDropdown(false)
                window.location.href = '/credits'
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <Wallet className="w-4 h-4" />
                <span>Mes Crédits</span>
              </div>
              {!creditLoading && credit !== null && (
                <span className={`text-xs px-2 py-0.5 rounded ${
                  credit < 10 
                    ? 'bg-red-100 text-red-600 font-semibold' 
                    : 'bg-orange-100 text-orange-600'
                }`}>
                  {credit}
                </span>
              )}
            </button>
            
            <hr className="my-2" />
            
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSigningOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  <span>Déconnexion...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Se déconnecter</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <SubscriptionModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
        />
      )}
    </div>
  )
}
