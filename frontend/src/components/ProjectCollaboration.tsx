'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Users, 
  Mail, 
  MessageSquare, 
  Upload, 
  FileText, 
  Image as ImageIcon,
  Lightbulb,
  X,
  Send,
  Trash2,
  Eye
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Collaborator {
  id: string
  invited_email: string
  role: string
  status: string
  user?: {
    full_name: string
    avatar_url?: string
  }
  created_at: string
}

interface Comment {
  id: string
  comment_text: string
  user: {
    full_name: string
    avatar_url?: string
  }
  created_at: string
}

interface Document {
  id: string
  document_type: 'image' | 'document' | 'vision'
  file_name?: string
  file_url?: string
  vision_text?: string
  description?: string
  user: {
    full_name: string
  }
  created_at: string
}

interface ProjectCollaborationProps {
  projectId: string
  userId: string
  isOwner: boolean
}

export default function ProjectCollaboration({ projectId, userId, isOwner }: ProjectCollaborationProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'comments' | 'documents'>('team')
  
  // Team
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('viewer')
  const [inviting, setInviting] = useState(false)
  
  // Comments
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  
  // Documents
  const [documents, setDocuments] = useState<Document[]>([])
  const [visionText, setVisionText] = useState('')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadCollaborators()
    loadComments()
    loadDocuments()
  }, [projectId])

  const loadCollaborators = async () => {
    try {
      const response = await fetch(`${API_URL}/api/collaboration/collaborators/${projectId}`)
      const data = await response.json()
      if (data.success) {
        setCollaborators(data.collaborators)
      }
    } catch (error) {
      console.error('Erreur chargement collaborateurs:', error)
    }
  }

  const loadComments = async () => {
    try {
      const response = await fetch(`${API_URL}/api/collaboration/comments/${projectId}`)
      const data = await response.json()
      if (data.success) {
        setComments(data.comments)
      }
    } catch (error) {
      console.error('Erreur chargement commentaires:', error)
    }
  }

  const loadDocuments = async () => {
    try {
      const response = await fetch(`${API_URL}/api/collaboration/documents/${projectId}`)
      const data = await response.json()
      if (data.success) {
        setDocuments(data.documents)
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !isOwner) return
    
    setInviting(true)
    try {
      const response = await fetch(`${API_URL}/api/collaboration/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          email: inviteEmail.trim(),
          role: inviteRole,
          invitedBy: userId
        })
      })
      
      const data = await response.json()
      if (data.success) {
        alert(data.message)
        setInviteEmail('')
        loadCollaborators()
      } else {
        alert(data.error)
      }
    } catch (error) {
      console.error('Erreur invitation:', error)
      alert('Erreur lors de l\'invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!isOwner || !confirm('Retirer ce collaborateur ?')) return
    
    try {
      const response = await fetch(`${API_URL}/api/collaboration/remove/${collaboratorId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      const data = await response.json()
      if (data.success) {
        loadCollaborators()
      }
    } catch (error) {
      console.error('Erreur suppression:', error)
    }
  }

  const handlePostComment = async () => {
    if (!newComment.trim()) return
    
    setPosting(true)
    try {
      const response = await fetch(`${API_URL}/api/collaboration/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId,
          commentText: newComment.trim()
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setNewComment('')
        loadComments()
      }
    } catch (error) {
      console.error('Erreur commentaire:', error)
    } finally {
      setPosting(false)
    }
  }

  const handleAddVision = async () => {
    if (!visionText.trim()) return
    
    setUploading(true)
    try {
      const response = await fetch(`${API_URL}/api/collaboration/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId,
          documentType: 'vision',
          visionText: visionText.trim()
        })
      })
      
      const data = await response.json()
      if (data.success) {
        setVisionText('')
        loadDocuments()
        alert('✅ Vision ajoutée au contexte cumulé du projet')
      }
    } catch (error) {
      console.error('Erreur ajout vision:', error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-white/5 rounded-lg sm:rounded-xl border border-white/10 p-3 sm:p-6">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
        <h3 className="text-lg sm:text-xl font-bold text-white">Collaboration</h3>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 border-b border-white/10 overflow-x-auto">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-2 sm:px-4 py-2 font-medium transition-colors text-xs sm:text-base whitespace-nowrap ${
            activeTab === 'team'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Équipe ({collaborators.length})</span>
            <span className="sm:hidden">({collaborators.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`px-2 sm:px-4 py-2 font-medium transition-colors text-xs sm:text-base whitespace-nowrap ${
            activeTab === 'comments'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Commentaires ({comments.length})</span>
            <span className="sm:hidden">({comments.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-2 sm:px-4 py-2 font-medium transition-colors text-xs sm:text-base whitespace-nowrap ${
            activeTab === 'documents'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Documents ({documents.length})</span>
            <span className="sm:hidden">({documents.length})</span>
          </div>
        </button>
      </div>

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-4">
          {isOwner && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
              <h4 className="text-white font-medium mb-2 sm:mb-3 text-sm sm:text-base">Inviter un collaborateur</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@exemple.com"
                  className="flex-1 px-2 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 text-sm sm:text-base"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-2 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm sm:text-base"
                >
                  <option value="viewer">Lecteur</option>
                  <option value="editor">Éditeur</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-3 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 text-sm sm:text-base"
                >
                  {inviting ? '...' : <><Mail className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Inviter</span><span className="sm:hidden">OK</span></>}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {collaborators.map((collab) => (
              <div key={collab.id} className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm sm:text-base flex-shrink-0">
                    {collab.user?.full_name?.[0] || collab.invited_email[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-white font-medium text-sm sm:text-base truncate">
                      {collab.user?.full_name || collab.invited_email}
                    </div>
                    <div className="text-xs text-gray-400">
                      {collab.role === 'owner' ? 'Propriétaire' : collab.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                      {collab.status === 'pending' && ' • En attente'}
                    </div>
                  </div>
                </div>
                {isOwner && collab.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveCollaborator(collab.id)}
                    className="p-1.5 sm:p-2 hover:bg-red-500/20 rounded-lg text-red-400 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 sm:p-4">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Ajouter un commentaire..."
              rows={3}
              className="w-full px-2 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none text-sm sm:text-base"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handlePostComment}
                disabled={posting || !newComment.trim()}
                className="px-3 sm:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2 text-sm sm:text-base"
              >
                {posting ? '...' : <><Send className="w-3 h-3 sm:w-4 sm:h-4" /> Publier</>}
              </button>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-white/5 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">
                    {comment.user.full_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-medium text-sm sm:text-base">{comment.user.full_name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-xs sm:text-sm break-words">{comment.comment_text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-3 sm:space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              <h4 className="text-white font-medium text-sm sm:text-base">Partager votre vision</h4>
            </div>
            <textarea
              value={visionText}
              onChange={(e) => setVisionText(e.target.value)}
              placeholder="Décrivez votre vision pour enrichir le contexte du projet..."
              rows={4}
              className="w-full px-2 sm:px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 resize-none mb-2 text-sm sm:text-base"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddVision}
                disabled={uploading || !visionText.trim()}
                className="px-3 sm:px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 text-sm sm:text-base"
              >
                {uploading ? 'Ajout...' : 'Ajouter au contexte'}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white/5 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg flex-shrink-0">
                    {doc.document_type === 'vision' ? (
                      <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                    ) : doc.document_type === 'image' ? (
                      <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    ) : (
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-medium text-sm sm:text-base">{doc.user.full_name}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {doc.vision_text && (
                      <p className="text-gray-300 text-xs sm:text-sm break-words">{doc.vision_text}</p>
                    )}
                    {doc.file_name && (
                      <div className="text-xs sm:text-sm text-blue-400 mt-2 truncate">{doc.file_name}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
