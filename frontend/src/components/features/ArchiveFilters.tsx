'use client'

import { useState } from 'react'

interface ArchiveFiltersProps {
  filters: {
    dateFilter: string
    customStartDate: string
    customEndDate: string
    searchKeyword: string
  }
  onFiltersChange: (filters: any) => void
  onApplyFilters: () => void
}

export function ArchiveFilters({ filters, onFiltersChange, onApplyFilters }: ArchiveFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      dateFilter: 'all',
      customStartDate: '',
      customEndDate: '',
      searchKeyword: ''
    })
    onApplyFilters()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <span className="mr-2">🔍</span>
          Filtres de recherche
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-orange-600 hover:text-orange-700 font-medium text-sm"
        >
          {isExpanded ? 'Masquer' : 'Afficher'} les filtres
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Recherche par mots-clés */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recherche par mots-clés
            </label>
            <input
              type="text"
              value={filters.searchKeyword}
              onChange={(e) => handleFilterChange('searchKeyword', e.target.value)}
              placeholder="Rechercher dans le titre, résumé ou source..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          {/* Filtres de date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Période
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { value: 'all', label: 'Tout' },
                { value: 'yesterday', label: 'Hier' },
                { value: 'week', label: 'Semaine' },
                { value: 'month', label: 'Mois dernier' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleFilterChange('dateFilter', option.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filters.dateFilter === option.value
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Date personnalisée */}
            <button
              onClick={() => handleFilterChange('dateFilter', 'custom')}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-3 ${
                filters.dateFilter === 'custom'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              📅 Choisir une période personnalisée
            </button>

            {filters.dateFilter === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date de début</label>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
            <button
              onClick={onApplyFilters}
              className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              🔍 Appliquer les filtres
            </button>
            <button
              onClick={clearFilters}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              🗑️ Effacer les filtres
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
