import React from 'react'

interface SidebarProps {
  user?: {
    name: string
    email: string
    avatar?: string
  }
  isMobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ user, isMobileOpen = false, onMobileClose }: SidebarProps) {
  const defaultUser = {
    name: 'Utilisateur',
    email: 'user@gabonnews.com',
    avatar: '👤'
  }

  const currentUser = user || defaultUser

  const menuItems = [
    { icon: '🏠', label: 'Accueil', href: '/', active: true },
    { icon: '🎧', label: 'Audio Books', href: '/audio' },
    { icon: '📖', label: 'Sauvegardé', href: '/saved' },
    { icon: '🕒', label: 'Historique', href: '/history' },
    { icon: '📥', label: 'Téléchargé', href: '/downloads' }
  ]

  const settingsItems = [
    { icon: '⚙️', label: 'Paramètres', href: '/settings' },
    { icon: '❓', label: 'Aide', href: '/help' },
    { icon: '📝', label: 'Envoyer Feedback', href: '/feedback' }
  ]

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onMobileClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 lg:top-16 left-0 z-50 lg:z-auto
        w-64 bg-white border-r border-gray-200 min-h-screen
        transform transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 sm:p-6">
          {/* Mobile Close Button */}
          <div className="lg:hidden flex justify-between items-center mb-4">
            <span className="font-semibold text-lg">Menu</span>
            <button 
              onClick={onMobileClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Profil Utilisateur */}
          <div className="flex items-center space-x-3 mb-6 sm:mb-8">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-base sm:text-lg">{currentUser.avatar}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm sm:text-base truncate">{currentUser.name}</div>
              <div className="text-xs sm:text-sm text-gray-500 truncate">{currentUser.email}</div>
            </div>
          </div>

          {/* Menu Navigation */}
          <nav className="space-y-1 sm:space-y-2">
            {menuItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm sm:text-base ${
                  item.active
                    ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-base sm:text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <hr className="my-4 sm:my-6" />

          {/* Nouvelles Tendances */}
          <div className="mb-4 sm:mb-6">
            <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base">Nouvelles Tendances</h3>
            <div className="space-y-1 sm:space-y-2">
              <a 
                href="/categories" 
                onClick={onMobileClose}
                className="block text-xs sm:text-sm text-gray-600 hover:text-gray-900 py-1"
              >
                Catégories
              </a>
              <a 
                href="/following" 
                onClick={onMobileClose}
                className="block text-xs sm:text-sm text-gray-600 hover:text-gray-900 py-1"
              >
                Suivis
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
                onClick={onMobileClose}
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
