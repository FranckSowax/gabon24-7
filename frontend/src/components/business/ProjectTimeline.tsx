'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  FileText, MessageSquare, Sparkles, Upload, 
  Calendar, Paperclip, Image, FileIcon, Send,
  Bot, CheckCircle, Clock, Trash2
} from 'lucide-react'

interface TimelineEntry {
  id: string
  entry_type: 'note' | 'document' | 'chat' | 'ai_action' | 'file_upload'
  title: string
  content: string
  created_at: string
  metadata?: any
  file_name?: string
  file_path?: string
}

interface ProjectTimelineProps {
  projectId: string
  timeline: TimelineEntry[]
  onAddNote: (note: string) => Promise<void>
  onUploadFile: (file: File) => Promise<void>
  onDeleteEntry: (entryId: string) => Promise<void>
  isLoading?: boolean
}

const getEntryIcon = (type: string) => {
  switch (type) {
    case 'note': return MessageSquare
    case 'document': return FileText
    case 'chat': return Bot
    case 'ai_action': return Sparkles
    case 'file_upload': return Paperclip
    default: return FileIcon
  }
}

const getEntryColor = (type: string) => {
  switch (type) {
    case 'note': return 'from-orange-500 to-yellow-500'
    case 'document': return 'from-blue-500 to-cyan-500'
    case 'chat': return 'from-purple-500 to-violet-500'
    case 'ai_action': return 'from-green-500 to-emerald-500'
    case 'file_upload': return 'from-pink-500 to-rose-500'
    default: return 'from-gray-500 to-gray-600'
  }
}

const getEntryLabel = (type: string) => {
  switch (type) {
    case 'note': return 'Note'
    case 'document': return 'Document IA'
    case 'chat': return 'Chat IA'
    case 'ai_action': return 'Action IA'
    case 'file_upload': return 'Fichier'
    default: return 'Entrée'
  }
}

export default function ProjectTimeline({
  projectId,
  timeline,
  onAddNote,
  onUploadFile,
  onDeleteEntry,
  isLoading = false
}: ProjectTimelineProps) {
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleAddNote = async () => {
    if (!newNote.trim() || isAdding) return
    setIsAdding(true)
    try {
      await onAddNote(newNote)
      setNewNote('')
    } catch (error) {
      console.error('Error adding note:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || isUploading) return
    
    setIsUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        await onUploadFile(files[i])
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <div className="space-y-4">
      {/* Formulaire ajout note + upload */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/10">
        <h4 className="text-white font-semibold mb-4 flex items-center gap-2 text-sm sm:text-base">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
          Ajouter au contexte
        </h4>

        {/* Zone d'upload drag & drop */}
        <div
          className={`mb-4 border-2 border-dashed rounded-lg p-4 sm:p-6 transition-all ${
            dragActive 
              ? 'border-purple-500 bg-purple-500/10' 
              : 'border-white/20 bg-white/5 hover:bg-white/10'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif"
            multiple
          />
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className={`w-8 h-8 sm:w-10 sm:h-10 mb-2 ${isUploading ? 'animate-bounce text-purple-400' : 'text-gray-400'}`} />
            <p className="text-white font-medium text-sm sm:text-base mb-1">
              {isUploading ? 'Upload en cours...' : 'Glissez vos fichiers ici'}
            </p>
            <p className="text-gray-400 text-xs sm:text-sm">
              ou cliquez pour parcourir (PDF, images, documents)
            </p>
          </label>
        </div>

        {/* Textarea note */}
        <div className="mb-3">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Ajoutez une note, une observation, une idée..."
            className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-white/10 text-white placeholder-gray-400 rounded-lg border border-white/20 focus:border-yellow-400 focus:outline-none resize-none text-sm sm:text-base"
            rows={3}
          />
        </div>

        <button
          onClick={handleAddNote}
          disabled={!newNote.trim() || isAdding}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
        >
          {isAdding ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {isAdding ? 'Ajout...' : 'Ajouter'}
        </button>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        <h4 className="text-white font-semibold flex items-center gap-2 px-2 text-sm sm:text-base">
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          Historique ({timeline.length})
        </h4>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-yellow-400 border-t-transparent mx-auto" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-8 sm:py-12 bg-white/5 rounded-lg border border-white/10">
            <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-400 text-sm sm:text-base">Aucun élément dans l'historique</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-2">Ajoutez des notes ou uploadez des fichiers</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {timeline.map((entry, index) => {
              const Icon = getEntryIcon(entry.entry_type)
              const colorClass = getEntryColor(entry.entry_type)
              const label = getEntryLabel(entry.entry_type)

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative"
                >
                  {/* Carte avec effet hover */}
                  <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-xl p-4 border-2 border-white/10 hover:border-white/30 hover:shadow-lg transition-all duration-300">
                    {/* Header avec icône, badge et actions */}
                    <div className="flex items-start gap-3 mb-3">
                      {/* Icône */}
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-r ${colorClass} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2.5 py-1 bg-gradient-to-r ${colorClass} text-white text-xs font-bold rounded-full shadow-sm`}>
                            {label}
                          </span>
                          <span className="text-gray-400 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(entry.created_at)}
                          </span>
                        </div>
                        {entry.title && (
                          <h5 className="text-white font-bold text-sm sm:text-base break-words">
                            {entry.title}
                          </h5>
                        )}
                      </div>

                      {/* Bouton supprimer */}
                      <button
                        onClick={() => {
                          if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
                            onDeleteEntry(entry.id)
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 flex-shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Contenu */}
                    {entry.content && (
                      <div className="bg-black/20 rounded-lg p-3 mb-3">
                        <p className="text-gray-300 text-sm leading-relaxed break-words whitespace-pre-wrap">
                          {entry.content}
                        </p>
                      </div>
                    )}

                    {/* Fichier attaché */}
                    {entry.file_name && (
                      <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-3">
                        <Paperclip className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="text-sm text-blue-300 truncate font-medium">{entry.file_name}</span>
                      </div>
                    )}

                    {/* Metadata badges */}
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {entry.metadata.document_type && (
                          <span className="text-xs px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-full font-medium">
                            📄 {entry.metadata.document_type}
                          </span>
                        )}
                        {entry.metadata.total_messages && (
                          <span className="text-xs px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-full font-medium">
                            💬 {entry.metadata.total_messages} messages
                          </span>
                        )}
                        {entry.metadata.file_size && (
                          <span className="text-xs px-2.5 py-1 bg-pink-500/20 text-pink-300 rounded-full font-medium">
                            📦 {(entry.metadata.file_size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
