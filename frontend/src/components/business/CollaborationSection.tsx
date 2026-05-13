'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Users, MessageSquare, FileText, User, Trash2, Send, RefreshCw, Upload, Link, Copy, CheckCircle, MessageCircle, Mail } from 'lucide-react'
import DocumentUploadModal from '@/components/collaboration/DocumentUploadModal'
import { supabase } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface CollaborationSectionProps {
  selectedProject: {
    id: string
    proposition_titre?: string
  }
  user: {
    id: string
    email?: string
    user_metadata?: {
      full_name?: string
    }
  } | null
}

export default function CollaborationSection({ selectedProject, user }: CollaborationSectionProps) {
  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [collabDocuments, setCollabDocuments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [activeTab, setActiveTab] = useState<'collaborators' | 'comments' | 'documents'>('collaborators')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Helper pour obtenir les headers d'authentification
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  const loadCollaborators = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/list/${selectedProject.id}`, { headers })
      const data = await response.json()
      if (data.success) {
        setCollaborators(data.collaborators || [])
      }
    } catch (error) {
      console.error('Erreur chargement collaborateurs:', error)
    }
  }, [selectedProject?.id, getAuthHeaders])

  const loadComments = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/comments/${selectedProject.id}`, { headers })
      const data = await response.json()
      if (data.success) {
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Erreur chargement commentaires:', error)
    }
  }, [selectedProject?.id, getAuthHeaders])

  const loadCollabDocuments = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/documents/${selectedProject.id}`, { headers })
      const data = await response.json()
      if (data.success) {
        setCollabDocuments(data.documents || [])
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error)
    }
  }, [selectedProject?.id, getAuthHeaders])

  useEffect(() => {
    if (selectedProject?.id) {
      loadCollaborators()
      loadComments()
      loadCollabDocuments()
    }
  }, [selectedProject?.id, loadCollaborators, loadComments, loadCollabDocuments])

  const handleInviteCollaborator = async () => {
    if (!collaboratorEmail || !collaboratorEmail.includes('@') || !user?.id) return

    setIsInviting(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/invite`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: selectedProject.id,
          ownerId: user.id,
          collaboratorEmail,
          role: 'viewer',
          permissions: {
            can_view: true,
            can_comment: true,
            can_edit: false,
            can_add_documents: true
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        setCollaboratorEmail('')
        loadCollaborators()
        alert('✅ Invitation envoyée !')
      } else {
        alert('❌ ' + (data.error || 'Erreur'))
      }
    } catch (error) {
      console.error('Erreur invitation:', error)
      alert('❌ Erreur réseau')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!confirm('Retirer ce collaborateur ?')) return

    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/remove/${collaboratorId}`, {
        method: 'DELETE',
        headers
      })

      const data = await response.json()
      if (data.success) {
        loadCollaborators()
        alert('✅ Collaborateur retiré')
      }
    } catch (error) {
      console.error('Erreur suppression:', error)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !user?.id) return

    setIsAddingComment(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/comment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: selectedProject.id,
          userId: user.id,
          userEmail: user.email,
          userName: user.user_metadata?.full_name || user.email,
          content: newComment,
          commentType: 'general'
        })
      })

      const data = await response.json()
      if (data.success) {
        setNewComment('')
        loadComments()
        alert('✅ Commentaire ajouté au contexte !')
      }
    } catch (error) {
      console.error('Erreur ajout commentaire:', error)
    } finally {
      setIsAddingComment(false)
    }
  }

  const handleGenerateShareLink = async () => {
    if (!user?.id) return

    setIsGeneratingLink(true)
    try {
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/project-collaboration/generate-share-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: selectedProject.id,
          ownerId: user.id,
          expiresInDays: 7
        })
      })

      const data = await response.json()
      if (data.success) {
        setShareLink(data.shareLink.full_url)
      } else {
        alert('❌ ' + (data.error || 'Erreur génération lien'))
      }
    } catch (error) {
      console.error('Erreur génération lien:', error)
      alert('❌ Erreur réseau')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const handleCopyLink = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch (error) {
      console.error('Erreur copie:', error)
    }
  }

  const handleShareWhatsApp = () => {
    if (!shareLink) return
    const projectTitle = selectedProject.proposition_titre || 'Mon projet'
    const message = `🚀 Je t'invite à collaborer sur mon projet "${projectTitle}" sur Gabon Insight!\n\n👉 Clique sur ce lien pour rejoindre:\n${shareLink}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const handleShareEmail = () => {
    if (!shareLink) return
    const projectTitle = selectedProject.proposition_titre || 'Mon projet'
    const subject = `Invitation à collaborer sur "${projectTitle}"`
    const body = `Bonjour,\n\nJe t'invite à collaborer sur mon projet "${projectTitle}" sur Gabon Insight.\n\nClique sur ce lien pour rejoindre le projet:\n${shareLink}\n\nÀ bientôt!`
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#697357] to-[#4d553e] rounded-xl sm:rounded-2xl p-4 sm:p-6"
      >
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Partager le Projet</h1>
        <p className="text-white/90">
          Invitez des collaborateurs à consulter votre projet
        </p>
      </motion.div>

      {/* Section Partage par Lien */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white shadow-sm rounded-xl p-6 border border-slate-200"
      >
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Link className="w-5 h-5 text-blue-400" />
          Partager via lien
        </h3>
        
        {!shareLink ? (
          <button
            onClick={handleGenerateShareLink}
            disabled={isGeneratingLink}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#697357] to-[#4d553e] text-white font-semibold rounded-lg hover:from-[#4d553e] hover:to-[#3a4030] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGeneratingLink ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Génération du lien...
              </>
            ) : (
              <>
                <Link className="w-5 h-5" />
                Générer un lien de partage
              </>
            )}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={shareLink}
                readOnly
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-sm truncate"
              />
              <button
                onClick={handleCopyLink}
                className={`px-4 py-3 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  linkCopied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {linkCopied ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copier
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="px-4 py-3 bg-gradient-to-r from-[#697357] to-[#4d553e] text-white font-semibold rounded-lg hover:from-[#4d553e] hover:to-[#3a4030] transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </button>
              <button
                onClick={handleShareEmail}
                className="px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                Email
              </button>
            </div>

            <p className="text-xs text-slate-500 text-center">
              🔗 Ce lien expire dans 7 jours • Les invités pourront voir et commenter le projet
            </p>
          </div>
        )}
      </motion.div>

      {/* Formulaire d'ajout par email */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white shadow-sm rounded-xl p-6 border border-slate-200"
      >
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          Inviter par email
        </h3>
        
        <div className="flex gap-3">
          <input
            type="email"
            value={collaboratorEmail}
            onChange={(e) => setCollaboratorEmail(e.target.value)}
            placeholder="email@exemple.com"
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            onKeyPress={(e) => e.key === 'Enter' && handleInviteCollaborator()}
          />
          <button
            onClick={handleInviteCollaborator}
            disabled={!collaboratorEmail || !collaboratorEmail.includes('@') || isInviting}
            className="px-6 py-3 bg-gradient-to-r from-[#697357] to-[#4d553e] text-white font-semibold rounded-lg hover:from-[#4d553e] hover:to-[#3a4030] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isInviting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        <p className="text-sm text-slate-500 mt-2">
          💡 L'invité recevra un email avec un lien pour accepter l'invitation
        </p>
      </motion.div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
        <button
          onClick={() => setActiveTab('collaborators')}
          className={`px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
            activeTab === 'collaborators' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-5 h-5 inline mr-2" />
          Collaborateurs ({collaborators.length})
          {activeTab === 'collaborators' && (
            <motion.div layoutId="collabTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
            activeTab === 'comments' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-5 h-5 inline mr-2" />
          Commentaires ({comments.length})
          {activeTab === 'comments' && (
            <motion.div layoutId="collabTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-3 font-medium transition-all relative whitespace-nowrap ${
            activeTab === 'documents' ? 'text-violet-400' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-5 h-5 inline mr-2" />
          Documents ({collabDocuments.length})
          {activeTab === 'documents' && (
            <motion.div layoutId="collabTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />
          )}
        </button>
      </div>

      {/* Contenu selon tab actif */}
      {activeTab === 'collaborators' && (
        <>
          {collaborators.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {collaborators.map((collab: any) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-4 bg-white shadow-sm rounded-xl border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#697357] to-[#4d553e] flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-slate-900 font-semibold">{collab.collaborator_email}</div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className={`px-2 py-0.5 rounded-full ${
                          collab.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                          collab.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {collab.status === 'accepted' ? '✓ Actif' : 
                           collab.status === 'pending' ? '⏳ En attente' : 'Rejeté'}
                        </span>
                        <span>•</span>
                        <span>{collab.role}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCollaborator(collab.id)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Retirer"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow-sm rounded-xl p-8 border border-slate-200 text-center"
            >
              <Users className="w-16 h-16 text-emerald-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun collaborateur</h3>
              <p className="text-slate-500">
                Invitez des collaborateurs pour travailler ensemble sur ce projet
              </p>
            </motion.div>
          )}
        </>
      )}

      {/* Tab Commentaires */}
      {activeTab === 'comments' && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white shadow-sm rounded-xl p-6 border border-slate-200"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-400" />
              Ajouter un commentaire
            </h3>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Partagez vos idées, suggestions ou questions..."
              className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || isAddingComment}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-[#697357] to-[#4d553e] text-white font-semibold rounded-lg hover:from-[#4d553e] hover:to-[#3a4030] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAddingComment ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              {isAddingComment ? 'Envoi...' : 'Publier le commentaire'}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              💡 Les commentaires sont ajoutés automatiquement au contexte du projet
            </p>
          </motion.div>

          {comments.length > 0 ? (
            <div className="space-y-4">
              {comments.map((comment: any, idx: number) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white shadow-sm rounded-xl p-6 border border-slate-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#697357] to-[#4d553e] flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-slate-900 font-semibold">{comment.user_name || comment.user_email}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-300 leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow-sm rounded-xl p-8 border border-slate-200 text-center"
            >
              <MessageSquare className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun commentaire</h3>
              <p className="text-slate-500">
                Soyez le premier à commenter ce projet
              </p>
            </motion.div>
          )}
        </>
      )}

      {/* Tab Documents */}
      {activeTab === 'documents' && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white shadow-sm rounded-xl p-6 border border-slate-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Partager un Document</h3>
                <p className="text-sm text-gray-400">
                  Ajoutez des fichiers ou du contenu pour enrichir le projet
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Ajouter
              </button>
            </div>
          </motion.div>

          {collabDocuments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {collabDocuments.map((doc: any, idx: number) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white shadow-sm rounded-xl p-6 border border-slate-200 hover:border-[#697357]/40 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-semibold mb-1">{doc.document_title}</h4>
                      <p className="text-xs text-gray-400 mb-2">
                        Par {doc.collaborator_email} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </p>
                      {doc.document_content && (
                        <p className="text-sm text-gray-300 line-clamp-2">{doc.document_content}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white shadow-sm rounded-xl p-8 border border-slate-200 text-center"
            >
              <FileText className="w-16 h-16 text-violet-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun document</h3>
              <p className="text-slate-500">
                Les collaborateurs peuvent ajouter des documents pour enrichir le projet
              </p>
            </motion.div>
          )}
        </>
      )}

      {/* Modal Upload Document */}
      {user && (
        <DocumentUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          projectId={selectedProject.id}
          userId={user.id}
          userEmail={user.email || ''}
          onSuccess={() => {
            loadCollabDocuments()
            setShowUploadModal(false)
          }}
        />
      )}
    </div>
  )
}
