'use client'

import React from 'react'
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { motion } from 'framer-motion'

interface ApiErrorAlertProps {
  error: Error | string
  onRetry?: () => void
  showRetry?: boolean
}

export default function ApiErrorAlert({ error, onRetry, showRetry = true }: ApiErrorAlertProps) {
  const errorMessage = typeof error === 'string' ? error : error.message
  
  // Déterminer le type d'erreur
  const isNetworkError = errorMessage.includes('Failed to fetch') || errorMessage.includes('contacter le serveur')
  const isTimeoutError = errorMessage.includes('Timeout') || errorMessage.includes('trop de temps')
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4"
    >
      <div className="flex items-start gap-3">
        {/* Icône */}
        <div className="flex-shrink-0">
          {isNetworkError ? (
            <WifiOff className="w-6 h-6 text-red-600" />
          ) : isTimeoutError ? (
            <AlertCircle className="w-6 h-6 text-orange-600" />
          ) : (
            <AlertCircle className="w-6 h-6 text-red-600" />
          )}
        </div>
        
        {/* Contenu */}
        <div className="flex-1">
          <h3 className="text-red-900 font-semibold mb-1">
            {isNetworkError ? '🔌 Problème de connexion' : 
             isTimeoutError ? '⏱️ Délai d\'attente dépassé' : 
             '❌ Erreur'}
          </h3>
          
          <p className="text-red-800 text-sm mb-3">
            {errorMessage}
          </p>
          
          {/* Suggestions */}
          <div className="bg-white/50 rounded-lg p-3 mb-3">
            <p className="text-xs text-red-700 font-medium mb-2">💡 Suggestions :</p>
            <ul className="text-xs text-red-700 space-y-1">
              {isNetworkError && (
                <>
                  <li>• Vérifiez votre connexion internet</li>
                  <li>• Le serveur est peut-être temporairement indisponible</li>
                  <li>• Réessayez dans quelques instants</li>
                </>
              )}
              {isTimeoutError && (
                <>
                  <li>• Le serveur met trop de temps à répondre</li>
                  <li>• Votre connexion est peut-être lente</li>
                  <li>• Réessayez avec une meilleure connexion</li>
                </>
              )}
              {!isNetworkError && !isTimeoutError && (
                <>
                  <li>• Une erreur inattendue s'est produite</li>
                  <li>• Réessayez dans quelques instants</li>
                  <li>• Si le problème persiste, contactez le support</li>
                </>
              )}
            </ul>
          </div>
          
          {/* Bouton retry */}
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
