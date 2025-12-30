'use client'

import React, { useState } from 'react'
import { Sparkles, X, ExternalLink } from 'lucide-react'

interface TLDRButtonProps {
  articleId: string
  articleTitle: string
  articleContent: string
  articleUrl?: string
  tldrPoints?: string[] | null  // Points pré-générés depuis Supabase
  onAuthRequired?: () => void
}

// Icône personnalisée pour le résumé (3 lignes avec points)
const SummaryIcon = ({ className }: { className?: string }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* 3 lignes avec puces */}
    <circle cx="4" cy="6" r="1.5" fill="currentColor" />
    <line x1="8" y1="6" x2="20" y2="6" />
    <circle cx="4" cy="12" r="1.5" fill="currentColor" />
    <line x1="8" y1="12" x2="20" y2="12" />
    <circle cx="4" cy="18" r="1.5" fill="currentColor" />
    <line x1="8" y1="18" x2="20" y2="18" />
  </svg>
)

export function TLDRButton({ 
  articleId, 
  articleTitle, 
  articleContent,
  articleUrl,
  tldrPoints,
  onAuthRequired 
}: TLDRButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Ne pas afficher le bouton si pas de TL;DR pré-généré
  if (!tldrPoints || tldrPoints.length < 3) {
    return null
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
  }

  const openFullArticle = () => {
    if (articleUrl) {
      window.open(articleUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <>
      {/* Bouton TL;DR avec icône résumé */}
      <button
        onClick={handleClick}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors"
        title="Résumé en 3 points"
      >
        <SummaryIcon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Résumé</span>
      </button>

      {/* Modal TL;DR */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SummaryIcon className="w-5 h-5" />
                  <h3 className="font-bold text-lg">Résumé Express</h3>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">GRATUIT</span>
                </div>
                <button 
                  onClick={closeModal}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-purple-100 text-sm mt-1">
                L'essentiel en 3 points • Économisez votre data
              </p>
            </div>

            {/* Contenu */}
            <div className="p-4">
              {/* Titre de l'article */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Article</p>
                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                  {articleTitle}
                </p>
              </div>

              {/* Les 3 points TL;DR */}
              <div className="space-y-2 mb-4">
                {tldrPoints.map((point, index) => (
                  <div 
                    key={index}
                    className="flex gap-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">
                      {point}
                    </p>
                  </div>
                ))}
              </div>

              {/* Avantages */}
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Résumé IA • Économisez votre forfait data</span>
                </div>
              </div>

              {/* Bouton Lire l'article complet */}
              {articleUrl && (
                <button
                  onClick={openFullArticle}
                  className="w-full py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl"
                >
                  <ExternalLink className="w-4 h-4" />
                  Lire l'article complet
                </button>
              )}

              <p className="text-xs text-gray-400 text-center mt-3">
                Cliquez pour accéder à la source originale
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
