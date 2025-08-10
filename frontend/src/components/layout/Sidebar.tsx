import React from 'react'

interface SidebarProps {
  user?: {
    name: string
    email: string
    avatar?: string
  }
}

export default function Sidebar({ user }: SidebarProps) {
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
    <aside className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-16">
      <div className="p-6">
        {/* Profil Utilisateur */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-lg">{currentUser.avatar}</span>
          </div>
          <div>
            <div className="font-medium">{currentUser.name}</div>
            <div className="text-sm text-gray-500">{currentUser.email}</div>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                item.active
                  ? 'bg-orange-50 text-orange-600 border-l-4 border-orange-500'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <hr className="my-6" />

        {/* Nouvelles Tendances */}
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 mb-3">Nouvelles Tendances</h3>
          <div className="space-y-2">
            <a href="/categories" className="block text-sm text-gray-600 hover:text-gray-900">
              Catégories
            </a>
            <a href="/following" className="block text-sm text-gray-600 hover:text-gray-900">
              Suivis
            </a>
          </div>
        </div>

        <hr className="my-6" />

        {/* Paramètres */}
        <div className="space-y-2">
          {settingsItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center space-x-3 px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
    </aside>
  )
}
