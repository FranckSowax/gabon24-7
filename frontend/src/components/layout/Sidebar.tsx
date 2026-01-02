'use client'

import React from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useModal } from '@/contexts/ModalContext'
import { useRouter, usePathname } from 'next/navigation'
import { Lock } from 'lucide-react'

interface SidebarProps {
  isMobileOpen?: boolean
  onMobileClose?: () => void
  searchWidget?: React.ReactNode
}

export default function Sidebar({ isMobileOpen = false, onMobileClose, searchWidget }: SidebarProps) {
  const { user, subscriptionPlan, signOut, loading } = useAuth()
  const { openSubscriptionModal } = useModal()
  const router = useRouter()
  const pathname = usePathname()
  const [isClient, setIsClient] = React.useState(false)
  const [showCredit, setShowCredit] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const [touchStart, setTouchStart] = React.useState<number | null>(null)
  const sidebarRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Fermer automatiquement la sidebar lors d'un changement de route
  React.useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gestion du swipe pour fermer (glisser vers la gauche)
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Si on glisse vers la gauche de plus de 50px, fermer la sidebar
    if (diff > 50 && onMobileClose) {
      onMobileClose();
    }

    setTouchStart(null);
  };

  // Bloquer le scroll du body quand la sidebar est ouverte sur mobile
  React.useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);
  
  // Données utilisateur par défaut si non connecté
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Invité'
  const displayEmail = user?.email || 'Non connecté'
  
  // Crédit récupéré depuis Supabase
  const [userCredit, setUserCredit] = React.useState<number>(0)
  
  // Type d'abonnement
  const planName = subscriptionPlan?.name || 'Freemium'
  const planColor = 'text-yellow-400' // Couleur jaune pour tous les abonnements
  const isPro = subscriptionPlan?.slug === 'pro'

  // Fonction de déconnexion
  const handleSignOut = async () => {
    try {
      setIsSigningOut(true)
      await signOut()
      router.push('/')
      if (onMobileClose) onMobileClose()
    } catch (error) {
      console.error('Erreur déconnexion:', error)
    } finally {
      setIsSigningOut(false)
    }
  }
  
  // Fonction pour aller au profil
  const handleViewProfile = () => {
    router.push('/mon-profil')
    if (onMobileClose) onMobileClose()
  }

  const handleToolClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    if (!isPro) {
      openSubscriptionModal()
      if (onMobileClose) onMobileClose()
      return
    }
    router.push(path)
    if (onMobileClose) onMobileClose()
  }
  
  // Charger le solde de crédits depuis Supabase avec rafraîchissement automatique
  React.useEffect(() => {
    const loadCredits = async () => {
      if (user) {
        try {
          const { getCreditBalance } = await import('@/lib/creditManager')
          const balance = await getCreditBalance(user.id)
          setUserCredit(balance)
        } catch (error) {
          console.error('Erreur récupération solde:', error)
          // Ne pas bloquer l'UI en cas d'erreur
        }
      }
    }
    
    loadCredits()
    
    // Rafraîchir toutes les 2 minutes (réduit la charge serveur)
    const interval = setInterval(() => {
      if (user) {
        loadCredits()
      }
    }, 120000)
    
    return () => clearInterval(interval)
  }, [user])

  const menuItems = [
    { icon: '🏠', label: 'Accueil', href: '/', active: true },
    { icon: '🕒', label: 'Historique', href: '/historique' },
    { icon: '🎮', label: 'Jeu Quiz', href: '/jeu', badge: 'NEW' }
  ]

  const settingsItems = [
    { icon: '📝', label: 'Envoyer Feedback', href: '/feedback' }
  ]

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`lg:hidden fixed inset-0 bg-black transition-opacity duration-300 ease-in-out ${
          isMobileOpen 
            ? 'opacity-50 z-40 pointer-events-auto' 
            : 'opacity-0 -z-10 pointer-events-none'
        }`}
        onClick={onMobileClose}
        style={{ 
          zIndex: isMobileOpen ? 9998 : -1,
          visibility: isMobileOpen ? 'visible' : 'hidden'
        }}
      />
      
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`
          fixed top-0 left-0
          w-64 bg-white border-r border-gray-200 h-screen
          transition-all duration-300 ease-in-out lg:translate-x-0 lg:block
          overflow-y-auto
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{
          zIndex: isMobileOpen ? 9999 : 40
        }}
      >
        {/* Mobile Close Button - Sticky header inside sidebar */}
        <div className={`lg:hidden sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm ${isMobileOpen ? '' : 'hidden'}`} style={{ zIndex: 10 }}>
          <span className="font-semibold text-lg text-gray-900">Menu</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onMobileClose) {
                onMobileClose();
              }
            }}
            className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors active:bg-gray-300"
            aria-label="Fermer le menu"
          >
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          
          {/* Widget Profil Moderne avec Authentification */}
          <div className="mb-6">
            <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-2xl p-4 shadow-lg">
              {/* Infos utilisateur */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-bold text-base truncate">
                    {displayName}
                  </h3>
                  {user && (
                    <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <p className={`text-xs font-medium truncate ${planColor}`}>
                  {planName}
                </p>
                <p className="text-orange-100 text-[11px] truncate mt-1">
                  {displayEmail}
                </p>
              </div>

              {/* Solde Crédit */}
              {user && (
                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-1">
                      <div className="flex-1">
                        <p className="text-orange-100 text-[10px]">Solde crédit</p>
                        {showCredit ? (
                          <p className="text-white text-sm font-bold">
                            {userCredit.toLocaleString('fr-FR')}
                          </p>
                        ) : (
                          <p className="text-white text-sm font-bold">••••••</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCredit(!showCredit)}
                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                      title={showCredit ? 'Masquer' : 'Afficher'}
                    >
                      {showCredit ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {user ? (
                  <>
                    <button
                      onClick={handleViewProfile}
                      className="w-full bg-white hover:bg-gray-50 text-orange-600 font-medium text-sm py-2 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center"
                    >
                      <span>Voir mon profil</span>
                    </button>
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="w-full bg-red-500/20 hover:bg-red-500/30 text-white font-medium text-sm py-2 px-4 rounded-lg transition-all duration-200 border border-red-300/30 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>{isSigningOut ? 'Déconnexion...' : 'Déconnexion'}</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      window.location.href = '/auth/signin/'
                      if (onMobileClose) onMobileClose()
                    }}
                    className="w-full bg-white hover:bg-gray-50 text-orange-600 font-medium text-sm py-2 px-4 rounded-lg transition-all duration-200 shadow-sm hover:shadow flex items-center justify-center"
                  >
                    <span>Se connecter</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu Navigation */}
          <nav className="space-y-1 sm:space-y-2">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                }}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm sm:text-base ${
                  item.active
                    ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-base sm:text-lg">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full animate-pulse">
                    {item.badge}
                  </span>
                )}
              </a>
            ))}
          </nav>

          <hr className="my-4 sm:my-6" />

          {/* Search Widget */}
          {searchWidget && (
            <div className="mb-4 sm:mb-6">
              {searchWidget}
            </div>
          )}

          {/* Business */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Business
            </h3>
            <div className="space-y-2">
              <a
                href="/business/live-opportunities"
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                }}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium bg-gradient-to-r from-purple-600 via-violet-600 to-purple-700 bg-clip-text text-transparent animate-pulse rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span>🤖</span>
                <span>Opportunités IA</span>
              </a>
              <a
                href="/business/creer-projet"
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                }}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span>🚀</span>
                <span>Créer un Projet</span>
              </a>
              <a
                href="/business/mes-projets"
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                }}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <span>📁</span>
                <span>Mes Projets</span>
              </a>
            </div>
          </div>

          <hr className="my-4 sm:my-6" />

          {/* Outils */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Outils
            </h3>
            <div className="space-y-2">
              <a
                href="/veille"
                onClick={(e) => handleToolClick(e, '/veille')}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <span>🔔</span>
                <span className="flex-1">Veille & Alertes</span>
                {!isPro && <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500" />}
              </a>
              <a
                href="/actu-plus"
                onClick={(e) => handleToolClick(e, '/actu-plus')}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <span>📰</span>
                <span className="flex-1">Actu+</span>
                {!isPro && <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
              </a>
              <a
                href="/audio/daily"
                onClick={(e) => handleToolClick(e, '/audio/daily')}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <span>🎧</span>
                <span className="flex-1">Résumés audio</span>
                {!isPro && <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
              </a>
              <a
                href="/archives-generales"
                onClick={(e) => handleToolClick(e, '/archives-generales')}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <span>🗄️</span>
                <span className="flex-1">Archives</span>
                {!isPro && <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
              </a>
            </div>
          </div>

          <hr className="my-4 sm:my-6" />

          {/* Marketing */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Marketing
            </h3>
            <div className="space-y-2">
              <a
                href="/marketing/publicite"
                onClick={(e) => handleToolClick(e, '/marketing/publicite')}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <span>📢</span>
                <span className="flex-1">Publicité</span>
                {!isPro && <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
              </a>
              <a
                href="/sondages"
                onClick={(e) => handleToolClick(e, '/sondages')}
                className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors group"
              >
                <span>📊</span>
                <span className="flex-1">Sondages</span>
                {!isPro && <Lock className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />}
              </a>
            </div>
          </div>

          <hr className="my-4 sm:my-6" />

          {/* Paramètres */}
          <div className="space-y-1 sm:space-y-2">
            {settingsItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                }}
                className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm sm:text-base"
              >
                <span className="text-base sm:text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}
