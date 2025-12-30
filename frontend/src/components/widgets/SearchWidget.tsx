import React, { useState, useEffect, useRef } from 'react'

interface SearchWidgetProps {
  onSearch: (query: string) => void
  searchQuery: string
  selectedSource: string
  onSourceChange: (source: string) => void
  selectedCategory: string
  onCategoryChange: (category: string) => void
  selectedDateRange?: string
  onDateRangeChange?: (range: string) => void
  selectedSortBy?: string
  onSortByChange?: (sort: string) => void
}

interface Suggestion {
  type: 'keyword' | 'category' | 'article'
  text: string
  label: string
}

// SOURCES SYNCHRONISÉES avec RSS.app (basé sur les captures)
const sources = [
  // Médias d'information générale
  '7 Jours Info',
  'G9 Infos', 
  'Actualités - Le Confidentiel du Gabon',
  'Actualités Gabon : Toutes les actualités du Gabon et d\'ailleurs',
  'Accueil - Gabon Actu',
  'Accueil - AGP - Agence Gabonaise de Presse',
  'Gabon All Sport',
  'Gabon Eco',
  'Mediaposte Gabon',
  'Accueil | Lunion.ga | Actualités Gabon',
  'Actualités',
  'Brice Clotaire Oligui Nguema (@oliguinguema) / Twitter',
  'Communication gouvernementale Page',
  'Le Courrier des Journalistes',
  'Direct Infos Gabon - L\'actualité économique et financière du Gabon',
  'Focus Groupe Media',
  'Gaboma Infos',
  'Gabon : actualité économique et politique au Gabon - La Tribune Afrique',
  'Gabon : actualités, podcasts, vidéos et analyses - RFI',
  'Gabon 24 Page',
  'Gabon Infos',
  'Gabon Mail Infos',
  'Gabon Newsroom',
  'Gabon Clic Infos',
  'Gabonreview.com | Actualité du Gabon, Politique, Economie, Société',
  'Gabonews - Pour l\'information juste !',
  'Dépêches 241',
  'Infos Gabon',
  'Insidenews - Insidenews241',
  'Journal du Gabon',
  'Kongossa News',
  'Le Touraco Vert',
  'Peuple Infos',
  'Relais Infos Gabon',
  'Sport 241',
  'Vox Populi 241',
  
  // Sources gouvernementales
  'Agence Equateur',
  'MINISTÈRE DE L\'AGRICULTURE, DE L\'ELEVAGE ET DU DÉVELOPPEMENT RURAL Page',
  'Ministère de l\'Economie Numérique Page',
  'Ministère de l\'Education Nationale, chargé de la Formation Civique et de la Jeunesse Page',
  'MINISTÈRE DE L\'ENSEIGNEMENT SUPERIEUR ET DE LA RECHERCHE SCIENTIFIQUE Page',
  'Ministère de l\'Industrie et de la Transformation Locale Page',
  'MINISTÈRE DE L\'INTERIEUR, DE LA SECURITE ET DE LA DECENTRALISATION Page',
  'MINISTÈRE DE LA COMMUNICATION ET DES MEDIAS Page',
  'MINISTÈRE DE LA JUSTICE, GARDE DES SCEAUX, CHARGE DES DROITS HUMAINS Page',
  'MINISTÈRE DES MINES ET DES RESSOURCES GEOLOGIQUES Page',
  'MINISTÈRE DES TRANSPORTS, DE LA MARINE MARCHANDE ET DE LA MER Page',
  'Ministère des Travaux Publics, de l\'Equipement et des Infrastructures Page',
  'Ministère du Commerce, des PME et PMI Page',
  'MINISTRE DU LOGEMENT, DE L\'HABITAT, DE L\'URBANISME ET DE L\'AMENAGEMENT DU TERRITOIRE Page',
  'Ministère l\'Energie et des Ressources Hydrauliques Page',
  'Ministère du Pétrole et du Gaz Page',
  'MINISTÈRE DU TOURISME DURABLE ET DE L\'ARTISANAT Page',
  'Ministère du Travail, du Plein Emploi et du Dialogue Social Page',
  'Présidence de la République Gabonaise',
  'Accueil | Lunion.ga | Actualités Gabon'
]

// 🤖 CATÉGORIES IA - Synchronisées avec article-ai-enrichment.js
const categories = [
  'Politique',
  'Économie',
  'Société',
  'Sport',
  'Culture',
  'Santé',
  'Éducation',
  'Énergie',
  'Agriculture',
  'Transport',
  'Justice',
  'Environnement',
  'Technologie',
  'International',
  'Général'
]

// Clé pour LocalStorage
const FILTERS_STORAGE_KEY = 'gabon247_search_filters'

// Interface pour les filtres sauvegardés
interface SavedFilters {
  source: string
  category: string
  dateRange: string
  sortBy: string
  savedAt: number
}

export default function SearchWidget({ 
  onSearch, 
  searchQuery, 
  selectedSource, 
  onSourceChange, 
  selectedCategory, 
  onCategoryChange,
  selectedDateRange = 'all',
  onDateRangeChange = () => {},
  selectedSortBy = 'recent',
  onSortByChange = () => {}
}: SearchWidgetProps) {
  const [query, setQuery] = useState(searchQuery || '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [trending, setTrending] = useState<string[]>([])
  const [filtersLoaded, setFiltersLoaded] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  // 💾 Charger les filtres sauvegardés au montage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FILTERS_STORAGE_KEY)
      if (saved) {
        const filters: SavedFilters = JSON.parse(saved)
        // Vérifier que les filtres ne sont pas trop vieux (7 jours max)
        const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 jours en ms
        if (Date.now() - filters.savedAt < maxAge) {
          if (filters.source) onSourceChange(filters.source)
          if (filters.category) onCategoryChange(filters.category)
          if (filters.dateRange) onDateRangeChange(filters.dateRange)
          if (filters.sortBy) onSortByChange(filters.sortBy)
        }
      }
    } catch (error) {
      console.warn('Erreur chargement filtres:', error)
    }
    setFiltersLoaded(true)
  }, [])

  // 💾 Sauvegarder les filtres quand ils changent
  useEffect(() => {
    if (!filtersLoaded) return // Ne pas sauvegarder avant le chargement initial
    
    try {
      const filters: SavedFilters = {
        source: selectedSource,
        category: selectedCategory,
        dateRange: selectedDateRange,
        sortBy: selectedSortBy,
        savedAt: Date.now()
      }
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
    } catch (error) {
      console.warn('Erreur sauvegarde filtres:', error)
    }
  }, [selectedSource, selectedCategory, selectedDateRange, selectedSortBy, filtersLoaded])

  // Synchroniser avec les props
  useEffect(() => {
    setQuery(searchQuery || '')
  }, [searchQuery])

  // Charger recherches tendances au montage
  useEffect(() => {
    fetchTrending()
  }, [])

  // Cacher suggestions et filtres si clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
      // Pour les filtres, ignorer les clics sur le bouton et sur le dropdown lui-même
      if (filtersRef.current && 
          !filtersRef.current.contains(event.target as Node) &&
          filterButtonRef.current && 
          !filterButtonRef.current.contains(event.target as Node)) {
        setShowFilters(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch suggestions avec debounce
  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(() => {
        fetchSuggestions(query)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [query])

  const fetchSuggestions = async (searchQuery: string) => {
    try {
      const res = await fetch(`${API_URL}/api/search/suggestions?query=${encodeURIComponent(searchQuery)}`)
      const data = await res.json()
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions)
        setShowSuggestions(data.suggestions.length > 0)
      }
    } catch (error) {
      console.error('Erreur suggestions:', error)
    }
  }

  const fetchTrending = async () => {
    try {
      const res = await fetch(`${API_URL}/api/search/trending`)
      const data = await res.json()
      if (data.success && data.trending) {
        setTrending(data.trending.slice(0, 5).map((t: any) => t.keyword))
      }
    } catch (error) {
      console.error('Erreur trending:', error)
    }
  }

  // Debounce: filtrage après un court délai pour éviter les recomputations à chaque frappe
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(query)
    }, 250)
    return () => clearTimeout(handler)
  }, [query])

  // Filtrage en temps réel à chaque changement (via debounce ci-dessus)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setQuery(suggestion.text)
    setShowSuggestions(false)
    onSearch(suggestion.text)
  }

  const handleTrendingClick = (keyword: string) => {
    setQuery(keyword)
    onSearch(keyword)
  }

  // Gestion du changement de source avec filtrage immédiat
  const handleSourceChange = (source: string) => {
    onSourceChange(source)
    // Redéclencher la recherche avec la nouvelle source
    onSearch(query)
  }

  // Gestion du changement de catégorie avec filtrage immédiat
  const handleCategoryChange = (category: string) => {
    onCategoryChange(category)
    // Redéclencher la recherche avec la nouvelle catégorie
    onSearch(query)
  }

  const handleSearch = () => {
    onSearch(query)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Compteur de filtres actifs
  const activeFiltersCount = [
    selectedSource !== 'all',
    selectedCategory !== 'all',
    selectedDateRange !== 'all',
    selectedSortBy !== 'recent'
  ].filter(Boolean).length

  return (
    <div className="w-full">
      {/* Barre de recherche et bouton filtres - Design compact */}
      <div className="flex gap-2 sm:gap-3 items-stretch">
        {/* Barre de recherche avec suggestions */}
        <div ref={searchRef} className="relative flex-1 min-w-0">
          <div className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-orange-400 z-10">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Recherche intelligente avec IA..."
            className="w-full pl-9 sm:pl-11 pr-4 py-2.5 sm:py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-200 focus:border-orange-400 focus:bg-white text-sm placeholder-gray-400 transition-all duration-200"
            value={query}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          />
          
          {/* Suggestions auto-complétion */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-gray-50 last:border-b-0 transition-colors"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <span className="text-sm text-gray-700">{suggestion.label}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Recherches tendances (si pas de query) - Masqué sur mobile pour économiser l'espace */}
          {!query && trending.length > 0 && !showFilters && (
            <div className="hidden sm:block absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-40">
              <div className="text-xs font-medium text-gray-500 mb-2">🔥 Tendances</div>
              <div className="flex flex-wrap gap-1.5">
                {trending.slice(0, 4).map((keyword, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTrendingClick(keyword)}
                    className="px-2.5 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-full text-xs font-medium transition-all"
                  >
                    {keyword}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Bouton Filtres compact */}
        <button
          ref={filterButtonRef}
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
            showFilters || activeFiltersCount > 0
              ? 'bg-orange-500 text-white shadow-md'
              : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
          </svg>
          <span className="hidden sm:inline">Filtres</span>
          {activeFiltersCount > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              showFilters || activeFiltersCount > 0 ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
            }`}>
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown des filtres - Design compact et responsive */}
      <div
        ref={filtersRef}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showFilters ? 'max-h-[600px] opacity-100 mt-3' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 sm:p-4 space-y-3">
          {/* Header compact */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
              </svg>
              Filtres
            </h3>
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  onSourceChange('all')
                  onCategoryChange('all')
                  onDateRangeChange('all')
                  onSortByChange('recent')
                }}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {/* Grille de filtres responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Filtre Source */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Source</label>
              <select 
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-200 focus:border-orange-400 text-sm bg-gray-50"
                value={selectedSource}
                onChange={(e) => handleSourceChange(e.target.value)}
              >
                <option value="all">Toutes les sources</option>
                {sources.slice(0, 15).map(source => (
                  <option key={source} value={source}>{source.length > 30 ? source.substring(0, 30) + '...' : source}</option>
                ))}
              </select>
            </div>

            {/* Filtre Catégorie */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Catégorie</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => onCategoryChange('all')}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Tout
                </button>
                {categories.slice(0, 6).map(category => (
                  <button
                    key={category}
                    onClick={() => onCategoryChange(category)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Période et Tri sur une ligne */}
          <div className="grid grid-cols-2 gap-3">
            {/* Filtre Date */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Période</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: 'all', label: 'Tout' },
                  { value: 'today', label: "Auj." },
                  { value: 'week', label: '7j' },
                  { value: 'month', label: '30j' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onDateRangeChange(value)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedDateRange === value
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tri */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Trier</label>
              <div className="flex flex-wrap gap-1">
                {[
                  { value: 'recent', label: '🕒 Récent' },
                  { value: 'popular', label: '🔥 Pop.' },
                  { value: 'relevant', label: '⭐ Pert.' }
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onSortByChange(value)}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      selectedSortBy === value
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bouton Appliquer */}
          <button
            onClick={() => {
              setShowFilters(false)
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 rounded-lg text-sm transition-all"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  )
}
