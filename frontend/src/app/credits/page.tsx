'use client'

import { useState } from 'react'
import { Coins, Package, History, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import CreditBalance from '@/components/credits/CreditBalance'
import CreditPackages from '@/components/credits/CreditPackages'
import CreditHistory from '@/components/credits/CreditHistory'
import TopUpModal from '@/components/credits/TopUpModal'

export default function CreditsPage() {
  const { user } = useAuth()
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [selectedTab, setSelectedTab] = useState<'packages' | 'history'>('packages')

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Coins className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Connexion requise</h2>
          <p className="text-gray-600 mb-6">
            Connectez-vous pour accéder à vos crédits et recharger votre compte.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-lg transition-all"
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Coins className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Mes Crédits</h1>
              <p className="text-white/90 mt-1">Gérez votre solde et rechargez vos crédits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne gauche : Solde */}
          <div className="lg:col-span-1">
            <CreditBalance 
              onTopUp={() => setShowTopUpModal(true)}
              showDetails={true}
            />

            {/* Info */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                Comment ça marche ?
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 font-bold">1.</span>
                  <span>Achetez un package de crédits</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 font-bold">2.</span>
                  <span>Utilisez vos crédits pour accéder aux services premium</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-500 font-bold">3.</span>
                  <span>Les crédits bonus sont utilisés en premier</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Colonne droite : Packages et Historique */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 mb-6">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setSelectedTab('packages')}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
                    selectedTab === 'packages'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Package className="w-5 h-5" />
                  Packages
                </button>
                <button
                  onClick={() => setSelectedTab('history')}
                  className={`flex-1 px-6 py-4 font-semibold transition-colors flex items-center justify-center gap-2 ${
                    selectedTab === 'history'
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <History className="w-5 h-5" />
                  Historique
                </button>
              </div>

              <div className="p-6">
                {selectedTab === 'packages' ? (
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      Choisissez votre package
                    </h2>
                    <CreditPackages 
                      onSelectPackage={(pkg) => {
                        // Ouvrir le modal avec le package sélectionné
                        setShowTopUpModal(true)
                      }}
                    />
                  </div>
                ) : (
                  <CreditHistory />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de recharge */}
      <TopUpModal
        open={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
        onPurchased={(newBalance) => {
          console.log('Nouveau solde:', newBalance)
          // Le solde sera automatiquement rafraîchi par le composant CreditBalance
        }}
      />
    </div>
  )
}
