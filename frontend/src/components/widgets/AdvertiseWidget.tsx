'use client'

import Link from 'next/link'

export default function AdvertiseWidget() {
  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-lg p-6 text-white shadow-lg">
      <div className="text-center">
        <div className="mb-4">
          <span className="text-3xl">📢</span>
        </div>
        
        <h3 className="text-xl font-bold mb-2">
          Faites connaître votre entreprise
        </h3>
        
        <p className="text-orange-100 text-sm mb-4">
          Atteignez des milliers de lecteurs avec nos slides publicitaires
        </p>
        
        <div className="space-y-2 text-sm text-orange-100 mb-6">
          <div className="flex items-center justify-center space-x-2">
            <span>✓</span>
            <span>Visibilité maximale</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <span>✓</span>
            <span>Tarifs abordables</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <span>✓</span>
            <span>Analytics détaillés</span>
          </div>
        </div>
        
        <Link 
          href="/advertise"
          className="inline-block bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold hover:bg-orange-50 transition-colors shadow-md"
        >
          Créer une campagne
        </Link>
        
        <p className="text-xs text-orange-200 mt-3">
          À partir de 25 000 FCFA
        </p>
      </div>
    </div>
  )
}
