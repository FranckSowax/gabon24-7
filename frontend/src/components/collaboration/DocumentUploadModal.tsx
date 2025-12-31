'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/auth'

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  userId: string
  userEmail: string
  onSuccess: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function DocumentUploadModal({
  isOpen,
  onClose,
  projectId,
  userId,
  userEmail,
  onSuccess
}: DocumentUploadModalProps) {
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentContent, setDocumentContent] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Helper pour obtenir les headers d'authentification
  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const { data: { session } } = await supabase.auth.getSession()
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validation taille (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Le fichier est trop volumineux (max 10MB)')
        return
      }

      // Validation type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png'
      ]

      if (!allowedTypes.includes(file.type)) {
        setError('Type de fichier non supporté. Utilisez PDF, Word, TXT ou images.')
        return
      }

      setDocumentFile(file)
      setError('')

      // Auto-remplir le titre si vide
      if (!documentTitle) {
        setDocumentTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = async () => {
    if (!documentTitle.trim()) {
      setError('Le titre est obligatoire')
      return
    }

    if (!documentContent.trim() && !documentFile) {
      setError('Ajoutez du contenu ou un fichier')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      let documentUrl = ''

      // Obtenir les headers d'authentification
      const authHeaders = await getAuthHeaders() as Record<string, string>

      // Upload fichier si présent
      if (documentFile) {
        const formData = new FormData()
        formData.append('file', documentFile)
        formData.append('projectId', projectId)

        // Pour FormData, on ne met pas Content-Type (le navigateur le gère)
        const uploadHeaders: Record<string, string> = {}
        if (authHeaders['Authorization']) {
          uploadHeaders['Authorization'] = authHeaders['Authorization']
        }

        const uploadResponse = await fetch(`${API_URL}/api/project-collaboration/upload-document`, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData
        })

        const uploadData = await uploadResponse.json()
        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Erreur upload fichier')
        }

        documentUrl = uploadData.file_url
      }

      // Créer document
      const response = await fetch(`${API_URL}/api/project-collaboration/document`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          projectId,
          collaboratorId: userId,
          collaboratorEmail: userEmail,
          documentTitle,
          documentContent,
          documentUrl,
          metadata: {
            file_name: documentFile?.name,
            file_size: documentFile?.size,
            file_type: documentFile?.type
          }
        })
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
          handleClose()
        }, 1500)
      } else {
        throw new Error(data.error || 'Erreur création document')
      }
    } catch (err: any) {
      console.error('Erreur upload document:', err)
      setError(err.message || 'Erreur réseau')
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    setDocumentTitle('')
    setDocumentContent('')
    setDocumentFile(null)
    setError('')
    setSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl w-full max-w-2xl border border-white/20 shadow-2xl"
        >
          {/* Header */}
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Ajouter un Document</h2>
                <p className="text-sm text-gray-400">Partagez un fichier ou du contenu avec l'équipe</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Success Message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 flex items-center gap-3"
              >
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-green-400 font-medium">Document ajouté avec succès !</p>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400">{error}</p>
              </motion.div>
            )}

            {/* Titre */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Titre du document *
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Ex: Analyse de marché, Budget prévisionnel..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Upload Fichier */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Fichier (optionnel)
              </label>
              <div className="border-2 border-dashed border-white/20 rounded-lg p-6 hover:border-violet-500 transition-colors">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <FileText className="w-12 h-12 text-violet-400" />
                  {documentFile ? (
                    <div className="text-center">
                      <p className="text-white font-medium">{documentFile.name}</p>
                      <p className="text-xs text-gray-400">
                        {(documentFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-white font-medium">Cliquez pour sélectionner un fichier</p>
                      <p className="text-xs text-gray-400">PDF, Word, TXT, Images (max 10MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Contenu Texte */}
            <div>
              <label className="block text-white font-semibold mb-2">
                Contenu / Description
              </label>
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                placeholder="Ajoutez des notes, un résumé ou du contenu textuel..."
                className="w-full h-40 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
              />
              <p className="text-xs text-gray-400 mt-2">
                💡 Le contenu sera ajouté automatiquement au contexte du projet
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading || success}
              className="px-8 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold rounded-lg hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Ajouter le document
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
