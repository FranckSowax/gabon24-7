'use client'

import React, { useState, useEffect } from 'react'
import { Save, Trash2, Clock, User, Briefcase } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface SavedContext {
  id: string
  context_name: string
  situation: string
  competences: string[]
  disponibilite: string
  objectif_delai: string
  experience_entrepreneuriale: string
  contraintes: string
  budget_principal: string
  created_at: string
}

interface SavedContextsManagerProps {
  userId: string | null
  currentContext: any
  onLoadContext: (context: SavedContext) => void
  onSaveContext: (contextName: string) => void
}

export default function SavedContextsManager({
  userId,
  currentContext,
  onLoadContext,
  onSaveContext
}: SavedContextsManagerProps) {
  const [savedContexts, setSavedContexts] = useState<SavedContext[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [contextName, setContextName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Charger les contextes sauvegardés
  useEffect(() => {
    if (userId) {
      loadContexts()
    }
  }, [userId])

  const loadContexts = async () => {
    if (!userId) return
    
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/user-contexts?userId=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setSavedContexts(data.contexts || [])
      }
    } catch (error) {
      console.error('Erreur chargement contextes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveContext = async () => {
    if (!userId || !contextName.trim()) {
      setError('Veuillez entrer un nom pour ce contexte')
      return
    }

    if (savedContexts.length >= 3) {
      setError('Limite de 3 contextes atteinte. Supprimez-en un pour continuer.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/user-contexts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          contextName: contextName.trim(),
          ...currentContext
        })
      })

      const data = await response.json()

      if (data.success) {
        await loadContexts()
        setShowSaveModal(false)
        setContextName('')
        onSaveContext(contextName.trim())
      } else {
        setError(data.error || 'Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Erreur sauvegarde contexte:', error)
      setError('Erreur lors de la sauvegarde')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteContext = async (contextId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce contexte ?')) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/user-contexts/${contextId}?userId=${userId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        await loadContexts()
      }
    } catch (error) {
      console.error('Erreur suppression contexte:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!userId) return null

  // Si aucun contexte sauvegardé, ne rien afficher
  if (savedContexts.length === 0 && !showSaveModal) return null

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-yellow-400" />
          Mes Contextes Sauvegardés ({savedContexts.length}/3)
        </h3>
      </div>

      {/* Liste des contextes sauvegardés */}
      {savedContexts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {savedContexts.map((context) => (
            <div
              key={context.id}
              className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer group"
              onClick={() => onLoadContext(context)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-white mb-1">{context.context_name}</h4>
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(context.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteContext(context.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                {context.situation && (
                  <div className="flex items-start gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400 mt-0.5" />
                    <p className="text-gray-300 line-clamp-2">{context.situation}</p>
                  </div>
                )}
                {context.budget_principal && (
                  <div className="text-yellow-400 font-medium">
                    Budget: {context.budget_principal}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
          <User className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">Aucun contexte sauvegardé</p>
          <p className="text-sm text-gray-500 mt-1">
            Remplissez le formulaire et sauvegardez votre profil pour gagner du temps
          </p>
        </div>
      )}

      {/* Modal de sauvegarde */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-white/10">
            <h3 className="text-xl font-bold text-white mb-4">Sauvegarder ce contexte</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom du contexte
              </label>
              <input
                type="text"
                value={contextName}
                onChange={(e) => setContextName(e.target.value)}
                placeholder="Ex: Profil Entrepreneur Tech"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
                maxLength={50}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSaveModal(false)
                  setContextName('')
                  setError(null)
                }}
                className="flex-1 px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveContext}
                disabled={isLoading || !contextName.trim()}
                className="flex-1 px-4 py-2 bg-yellow-500 text-black font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
