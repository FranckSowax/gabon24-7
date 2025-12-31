'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { motion } from 'framer-motion'
import { Users, Briefcase, CheckCircle, XCircle, Loader2, LogIn, ArrowRight } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Supabase client pour récupérer le token
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface ShareLinkInfo {
  project: {
    id: string
    proposition_titre: string
    proposition_description: string
    secteur_selectionne: string
    budget_selectionne: string
  }
  owner_name: string
  owner_email: string
  expires_at: string
}

export default function JoinProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const token = params?.token as string

  const [linkInfo, setLinkInfo] = useState<ShareLinkInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Charger les infos du lien de partage
  useEffect(() => {
    const fetchLinkInfo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/project-collaboration/share-link/${token}`)
        const data = await response.json()

        if (data.success) {
          setLinkInfo(data.shareLink)
        } else {
          setError(data.error || 'Lien invalide ou expiré')
        }
      } catch (err) {
        console.error('Erreur chargement lien:', err)
        setError('Erreur de connexion au serveur')
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      fetchLinkInfo()
    }
  }, [token])

  // Helper pour obtenir les headers d'authentification
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  // Rejoindre le projet
  const handleJoinProject = async () => {
    if (!user) {
      // Rediriger vers login avec retour ici
      router.push(`/login?redirect=/collaboration/join/${token}`)
      return
    }

    setIsJoining(true)
    setError(null)

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/join-via-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          shareToken: token,
          userId: user.id,
          userEmail: user.email
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        // Rediriger vers Mes Projets après 2 secondes
        setTimeout(() => {
          router.push('/business/mes-projets')
        }, 2000)
      } else {
        setError(data.error || 'Erreur lors de la jonction au projet')
      }
    } catch (err) {
      console.error('Erreur jonction:', err)
      setError('Erreur de connexion au serveur')
    } finally {
      setIsJoining(false)
    }
  }

  // Loading state
  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white/70">Chargement...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !linkInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full text-center border border-white/20"
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Lien invalide</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Retour à l'accueil
          </button>
        </motion.div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md w-full text-center border border-white/20"
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Vous avez rejoint le projet !</h1>
          <p className="text-gray-400 mb-6">
            Redirection vers vos projets...
          </p>
          <Loader2 className="w-6 h-6 text-white animate-spin mx-auto" />
        </motion.div>
      </div>
    )
  }

  // Main view - invitation preview
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-lg w-full border border-white/20"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invitation à collaborer</h1>
          <p className="text-gray-400">
            <span className="text-emerald-400 font-semibold">{linkInfo?.owner_name}</span> vous invite à rejoindre son projet
          </p>
        </div>

        {/* Project Info */}
        {linkInfo?.project && (
          <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-2">
              {linkInfo.project.proposition_titre || 'Projet'}
            </h2>
            {linkInfo.project.proposition_description && (
              <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                {linkInfo.project.proposition_description}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {linkInfo.project.secteur_selectionne && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                  <Briefcase className="w-3 h-3 inline mr-1" />
                  {linkInfo.project.secteur_selectionne}
                </span>
              )}
              {linkInfo.project.budget_selectionne && (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                  💰 {linkInfo.project.budget_selectionne}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Permissions info */}
        <div className="bg-emerald-500/10 rounded-xl p-4 mb-6 border border-emerald-500/20">
          <h3 className="text-sm font-semibold text-emerald-400 mb-2">En rejoignant, vous pourrez :</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>✓ Visualiser tous les détails du projet</li>
            <li>✓ Ajouter des commentaires</li>
            <li>✓ Partager des documents</li>
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Action buttons */}
        {user ? (
          <button
            onClick={handleJoinProject}
            disabled={isJoining}
            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isJoining ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Jonction en cours...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Rejoindre le projet
              </>
            )}
          </button>
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/login?redirect=/collaboration/join/${token}`)}
              className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Se connecter pour rejoindre
            </button>
            <p className="text-center text-gray-500 text-sm">
              Vous devez être connecté pour rejoindre ce projet
            </p>
          </div>
        )}

        {/* Expiration info */}
        {linkInfo?.expires_at && (
          <p className="text-center text-gray-500 text-xs mt-4">
            Ce lien expire le {new Date(linkInfo.expires_at).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        )}
      </motion.div>
    </div>
  )
}
