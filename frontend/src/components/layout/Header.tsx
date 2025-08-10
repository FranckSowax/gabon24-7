import React, { useState } from 'react'

interface HeaderProps {
  onMobileMenuToggle?: () => void
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      console.log('Recherche:', searchQuery)
    }
  }

  const handleSubscribe = () => {
    window.open('https://wa.me/24177123456?text=Je%20veux%20m\'abonner%20à%20GabonNews%20Premium', '_blank')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      {/* Main Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3">
        {/* Left: Menu + Logo */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Menu hamburger pour mobile */}
          <button 
            onClick={onMobileMenuToggle}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          {/* Logo */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">🇬🇦</span>
            </div>
            <span className="font-semibold text-base sm:text-lg">GabonNews</span>
          </div>
        </div>
        
        {/* Center: Desktop Search */}
        <div className="hidden md:flex flex-1 max-w-md mx-4 lg:mx-8">
          <form onSubmit={handleSearch} className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des actualités"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              className="absolute left-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Mobile Search Toggle */}
          <button 
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          {/* Subscribe Button */}
          <button 
            onClick={handleSubscribe}
            className="bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm font-medium"
          >
            <span className="hidden sm:inline">S'abonner</span>
            <span className="sm:hidden">📱</span>
          </button>
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      {showMobileSearch && (
        <div className="md:hidden px-3 sm:px-4 pb-3">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher des actualités"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              autoFocus
            />
            <button
              type="submit"
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </header>
  )
}
