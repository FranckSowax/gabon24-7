'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Users, FileText, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function InvitationPage() {
  const params = useParams<{ id?: string }>()
  const router = useRouter()
  const { user } = useAuth()
  
  // Guard against null params
  if (!params?.id) {
    notFound()
  }
  
  const invitationId = params.id

  const [invitation, setInvitation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [action, setAction] = useState<'accept' | 'reject' | null>(null)

  // Helper pour obtenir les headers d'authentification
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  useEffect(() => {
    if (invitationId) {
      loadInvitation()
    }
  }, [invitationId])

  const loadInvitation = async () => {
    try {
      const response = await fetch(`${API_URL}/api/project-collaboration/invitation/${invitationId}`)
      const data = await response.json()

      if (data.success) {
        setInvitation(data.invitation)
      } else {
        setError(data.error || 'Invitation introuvable')
      }
    } catch (err) {
      console.error('Erreur chargement invitation:', err)
      setError('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!user) {
      alert('Vous devez être connecté pour accepter cette invitation')
      router.push('/login')
      return
    }

    setProcessing(true)
    setAction('accept')

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/accept`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collaboratorId: invitationId,
          userId: user.id
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/business/mes-projets')
        }, 2000)
      } else {
        setError(data.error || 'Erreur lors de l\'acceptation')
      }
    } catch (err) {
      console.error('Erreur acceptation:', err)
      setError('Erreur réseau')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    setProcessing(true)
    setAction('reject')

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          collaboratorId: invitationId
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        setError(data.error || 'Erreur lors du refus')
      }
    } catch (err) {
      console.error('Erreur refus:', err)
      setError('Erreur réseau')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Chargement de l'invitation...</p>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full border border-white/10 text-center"
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invitation Invalide</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-green-600 transition-all"
          >
            Retour à l'accueil
          </button>
        </motion.div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full border border-white/10 text-center"
        >
          {action === 'accept' ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Invitation Acceptée !</h1>
              <p className="text-gray-400 mb-4">
                Vous êtes maintenant collaborateur sur ce projet.
              </p>
              <p className="text-sm text-gray-500">
                Redirection vers vos projets...
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2">Invitation Refusée</h1>
              <p className="text-gray-400 mb-4">
                L'invitation a été déclinée.
              </p>
              <p className="text-sm text-gray-500">
                Redirection vers l'accueil...
              </p>
            </>
          )}
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-2xl w-full border border-white/10 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-8 text-center">
          <Users className="w-16 h-16 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Invitation à Collaborer</h1>
          <p className="text-white/90">
            Vous avez été invité à rejoindre un projet
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Project Info */}
          <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
            <h2 className="text-2xl font-bold text-white mb-4">
              {invitation?.project_title || 'Projet'}
            </h2>
            {invitation?.project_description && (
              <p className="text-gray-300 mb-4">{invitation.project_description}</p>
            )}
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span>Invité par:</span>
              <span className="text-emerald-400 font-semibold">
                {invitation?.owner_name || invitation?.owner_email}
              </span>
            </div>
          </div>

          {/* Permissions */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">
              En tant que collaborateur, vous pourrez :
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Visualiser le projet</p>
                  <p className="text-gray-400 text-sm">Accès complet au contenu et à l'avancement</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Ajouter des commentaires</p>
                  <p className="text-gray-400 text-sm">Partagez vos idées et suggestions</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Partager des documents</p>
                  <p className="text-gray-400 text-sm">Enrichissez le projet avec vos fichiers</p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleAccept}
              disabled={processing}
              className="flex-1 px-8 py-4 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing && action === 'accept' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Acceptation...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Accepter l'invitation
                </>
              )}
            </button>
            <button
              onClick={handleReject}
              disabled={processing}
              className="flex-1 px-8 py-4 bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold rounded-xl hover:from-red-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing && action === 'reject' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Refus...
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5" />
                  Refuser
                </>
              )}
            </button>
          </div>

          <p className="text-center text-gray-500 text-sm mt-6">
            💡 Cette invitation est personnelle et ne peut pas être transférée
          </p>
        </div>
      </motion.div>
    </div>
  )
}
