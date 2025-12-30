'use client'

import { useState, useEffect } from 'react'
import { Package, Check, Star, TrendingUp, Sparkles } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface CreditPackage {
  id: string
  name: string
  slug: string
  credits: number
  bonus_credits: number
  price_xaf: number
  price_usd: number
  discount_percentage: number
  is_popular: boolean
  description: string
  features: string[]
}

interface CreditPackagesProps {
  onSelectPackage: (pkg: CreditPackage) => void
  selectedPackageId?: string
}

export default function CreditPackages({ onSelectPackage, selectedPackageId }: CreditPackagesProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPackages()
  }, [])

  const fetchPackages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/credits-premium/packages`)
      const data = await res.json()
      
      if (data.success) {
        setPackages(data.packages)
      }
    } catch (error) {
      console.error('Erreur chargement packages:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="p-6 bg-gray-100 rounded-xl animate-pulse">
            <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
            <div className="h-8 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-full"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {packages.map((pkg) => {
        const isSelected = selectedPackageId === pkg.id
        const totalCredits = pkg.credits + pkg.bonus_credits
        
        return (
          <div
            key={pkg.id}
            onClick={() => onSelectPackage(pkg)}
            className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-xl ${
              isSelected
                ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-yellow-50 shadow-lg scale-105'
                : pkg.is_popular
                ? 'border-orange-300 bg-gradient-to-br from-orange-50/50 to-yellow-50/50 hover:border-orange-400'
                : 'border-gray-200 bg-white hover:border-orange-300'
            }`}
          >
            {/* Badge populaire */}
            {pkg.is_popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-xs font-bold rounded-full shadow-md flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                POPULAIRE
              </div>
            )}

            {/* Badge économie */}
            {pkg.discount_percentage > 0 && (
              <div className="absolute -top-3 -right-3 w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                <div className="text-center">
                  <p className="text-white text-xs font-bold leading-none">-{pkg.discount_percentage}%</p>
                  <p className="text-white text-[8px] leading-none">ÉCONOMIE</p>
                </div>
              </div>
            )}

            {/* Icône */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
              isSelected || pkg.is_popular
                ? 'bg-gradient-to-br from-orange-500 to-yellow-500'
                : 'bg-gradient-to-br from-gray-400 to-gray-500'
            }`}>
              <Package className="w-6 h-6 text-white" />
            </div>

            {/* Nom */}
            <h3 className="text-xl font-bold text-gray-900 mb-2">{pkg.name}</h3>
            
            {/* Description */}
            <p className="text-sm text-gray-600 mb-4 min-h-[40px]">{pkg.description}</p>

            {/* Crédits */}
            <div className="mb-4 p-3 bg-white/80 rounded-lg border border-orange-200">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-orange-600">{totalCredits}</span>
                <span className="text-sm text-gray-600">crédits</span>
              </div>
              {pkg.bonus_credits > 0 && (
                <div className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                  <Sparkles className="w-3 h-3" />
                  <span>{pkg.credits} + {pkg.bonus_credits} bonus</span>
                </div>
              )}
            </div>

            {/* Prix */}
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{pkg.price_xaf.toLocaleString()}</span>
                <span className="text-sm text-gray-600">XAF</span>
              </div>
              <p className="text-xs text-gray-500">≈ ${pkg.price_usd} USD</p>
            </div>

            {/* Features */}
            <ul className="space-y-2 mb-4">
              {pkg.features.slice(0, 4).map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {/* Bouton */}
            <button
              className={`w-full py-3 rounded-lg font-semibold transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-md'
                  : pkg.is_popular
                  ? 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shadow-md hover:shadow-lg'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {isSelected ? (
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-5 h-5" />
                  Sélectionné
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Choisir ce pack
                </span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
