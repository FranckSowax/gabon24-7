'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, X, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CreditAlertToastProps {
  show: boolean
  balance: number
  required: number
  onClose: () => void
}

export default function CreditAlertToast({ show, balance, required, onClose }: CreditAlertToastProps) {
  const router = useRouter()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (show) {
      setIsVisible(true)
    }
  }, [show])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose(), 300)
  }

  const handleTopUp = () => {
    handleClose()
    router.push('/credits')
  }

  if (!show && !isVisible) return null

  const missing = required - balance

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 pointer-events-none sm:items-start sm:justify-end sm:p-6">
      <div
        className={`max-w-sm w-full bg-white rounded-lg shadow-2xl border-2 border-red-500 overflow-hidden pointer-events-auto transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-white" />
            <h3 className="text-white font-semibold">Crédits insuffisants</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <p className="text-gray-700 text-sm">
            Vous n'avez pas assez de crédits pour effectuer cette action.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Solde actuel :</span>
              <span className="font-semibold text-red-600">{balance} crédits</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Requis :</span>
              <span className="font-semibold text-gray-900">{required} crédits</span>
            </div>
            <div className="h-px bg-red-200 my-2"></div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Manquant :</span>
              <span className="font-bold text-red-600">{missing} crédits</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTopUp}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <Wallet className="w-4 h-4" />
              <span>Recharger</span>
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
