'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Sparkles, Loader2, ChevronDown, ChevronUp, 
  CheckCircle, Circle, Upload, FileText, Trash2, 
  Download, Clock, AlertCircle, Briefcase 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ACTION_PLAN_STEPS, ChecklistItem } from '@/types/action-plan-checklist'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionPlanChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  stepNumber: number
  projectData: {
    titre: string
    secteur: string
    budget: string
    description: string
    projectId: string
    userId: string
  }
}

interface ChecklistItemState {
  item_id: string
  answer: string
  is_completed: boolean
  document_urls: string[]
  document_names: string[]
}

export default function ActionPlanChecklistModal({
  isOpen,
  onClose,
  stepNumber,
  projectData
}: ActionPlanChecklistModalProps) {
  // Using singleton supabase from @/lib/supabase
  const [checklistId, setChecklistId] = useState<string | null>(null)
  const [itemStates, setItemStates] = useState<{[key: string]: ChecklistItemState}>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const stepData = ACTION_PLAN_STEPS.find(s => s.step === stepNumber)
  if (!stepData) return null

  const checklist = stepData.checklist
  const completedCount = Object.values(itemStates).filter(s => s.is_completed).length
  const progressPercentage = checklist.length > 0 
    ? Math.round((completedCount / checklist.length) * 100) 
    : 0

  // Charger ou créer la checklist
  useEffect(() => {
    if (isOpen && projectData.projectId && projectData.userId) {
      loadOrCreateChecklist()
    }
  }, [isOpen, projectData.projectId, stepNumber])

  const loadOrCreateChecklist = async () => {
    try {
      setLoading(true)

      // Chercher checklist existante
      const { data: existing, error: fetchError } = await supabase
        .from('action_plan_checklists')
        .select('id')
        .eq('project_id', projectData.projectId)
        .eq('step_number', stepNumber)
        .maybeSingle()

      if (fetchError) throw fetchError

      let currentChecklistId = existing?.id

      // Créer si n'existe pas
      if (!currentChecklistId) {
        const { data: newChecklist, error: createError } = await supabase
          .from('action_plan_checklists')
          .insert({
            project_id: projectData.projectId,
            user_id: projectData.userId,
            step_number: stepNumber,
            step_title: stepData.title,
            step_objective: stepData.objective,
            step_duration: stepData.duration
          })
          .select('id')
          .single()

        if (createError) throw createError
        currentChecklistId = newChecklist.id

        // Créer les items
        const items = checklist.map((item, index) => ({
          checklist_id: currentChecklistId,
          item_id: item.id,
          task: item.task,
          description: item.description,
          ai_prompt: item.aiPrompt,
          requires_document: item.requiresDocument || false,
          document_type: item.documentType,
          placeholder: item.placeholder,
          estimated_time: item.estimatedTime,
          priority: item.priority,
          order_index: index
        }))

        const { error: itemsError } = await supabase
          .from('action_plan_checklist_items')
          .insert(items)

        if (itemsError) throw itemsError
      }

      setChecklistId(currentChecklistId)

      // Charger les items
      const { data: items, error: itemsError } = await supabase
        .from('action_plan_checklist_items')
        .select('*')
        .eq('checklist_id', currentChecklistId)
        .order('order_index')

      if (itemsError) throw itemsError

      // Initialiser les états
      const states: {[key: string]: ChecklistItemState} = {}
      items?.forEach((item: any) => {
        states[item.item_id] = {
          item_id: item.item_id,
          answer: item.answer || '',
          is_completed: item.is_completed || false,
          document_urls: item.document_urls || [],
          document_names: item.document_names || []
        }
      })
      setItemStates(states)

      // Ouvrir le premier item non complété
      const firstIncomplete = items?.find((i: any) => !i.is_completed)
      if (firstIncomplete) {
        setExpandedItems(new Set([firstIncomplete.item_id]))
      }

    } catch (error) {
      console.error('Erreur chargement checklist:', error)
      alert('Erreur lors du chargement de la checklist')
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (itemId: string) => {
    const newSet = new Set(expandedItems)
    if (newSet.has(itemId)) {
      newSet.delete(itemId)
    } else {
      newSet.add(itemId)
    }
    setExpandedItems(newSet)
  }

  const handleAnswerChange = (itemId: string, value: string) => {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], answer: value }
    }))
    
    // Debounce la sauvegarde automatique
    if (typeof window !== 'undefined') {
      const timeoutId = (window as any)[`saveTimeout_${itemId}`]
      if (timeoutId) clearTimeout(timeoutId)
      
      ;(window as any)[`saveTimeout_${itemId}`] = setTimeout(() => {
        saveItemToDatabase(itemId)
      }, 1000) // Sauvegarde après 1 seconde d'inactivité
    }
  }

  const handleGenerateAI = async (item: ChecklistItem) => {
    setGeneratingId(item.id)
    try {
      const projectContext = `Agis comme un consultant en entrepreneuriat spécialisé dans le contexte gabonais.

Projet: ${projectData.titre}
Secteur: ${projectData.secteur}
Budget disponible: ${projectData.budget}
Description: ${projectData.description}
Localisation: Gabon (Libreville, Port-Gentil, ou autre ville gabonaise)

Étape ${stepNumber}/5: ${stepData.title}
Objectif: ${stepData.objective}

Tâche: ${item.task}
Description: ${item.description}
Consigne: ${item.aiPrompt}

IMPORTANT:
- Adapte toutes les recommandations au contexte gabonais
- Utilise la devise FCFA pour tous les montants
- Mentionne des institutions, quartiers, entreprises gabonaises réelles quand pertinent
- Considère les spécificités locales (climat, culture, réglementation gabonaise)
- Sois concret et actionnable
- Propose des délais réalistes adaptés au rythme gabonais`

      const response = await fetch(`${API_URL}/api/project-documents/generate-ai-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: projectContext })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`)
      }

      const data = await response.json()
      if (data.success && data.response) {
        handleAnswerChange(item.id, data.response)
        // Sauvegarder immédiatement après génération IA
        await saveItemToDatabase(item.id)
      } else {
        throw new Error(data.error || 'Réponse IA invalide')
      }
    } catch (error: any) {
      console.error('Erreur génération IA:', error)
      const errorMessage = error.message || 'Erreur inconnue'
      alert(`❌ Erreur génération IA:\n${errorMessage}\n\nVeuillez réessayer ou remplir manuellement.`)
    } finally {
      setGeneratingId(null)
    }
  }

  const handleFileUpload = async (itemId: string, file: File) => {
    if (!checklistId) return

    setUploadingId(itemId)
    try {
      // Upload vers Supabase Storage
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${projectData.userId}/${projectData.projectId}/${itemId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('action-plan-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Obtenir URL signée (bucket privé)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('action-plan-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365) // 1 an

      if (urlError) throw urlError

      const fileUrl = urlData.signedUrl

      // Mettre à jour l'état local
      setItemStates(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          document_urls: [...(prev[itemId]?.document_urls || []), fileUrl],
          document_names: [...(prev[itemId]?.document_names || []), file.name]
        }
      }))

      // Sauvegarder en DB
      await saveItemToDatabase(itemId)

    } catch (error) {
      console.error('Erreur upload:', error)
      alert('Erreur lors de l\'upload du fichier')
    } finally {
      setUploadingId(null)
    }
  }

  const handleDeleteDocument = async (itemId: string, index: number) => {
    if (!confirm('Supprimer ce document ?')) return

    try {
      const state = itemStates[itemId]
      const newUrls = [...state.document_urls]
      const newNames = [...state.document_names]
      
      newUrls.splice(index, 1)
      newNames.splice(index, 1)

      setItemStates(prev => ({
        ...prev,
        [itemId]: {
          ...prev[itemId],
          document_urls: newUrls,
          document_names: newNames
        }
      }))

      await saveItemToDatabase(itemId)
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleToggleComplete = async (itemId: string) => {
    const newCompleted = !itemStates[itemId]?.is_completed

    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], is_completed: newCompleted }
    }))

    await saveItemToDatabase(itemId)
  }

  const saveItemToDatabase = async (itemId: string) => {
    if (!checklistId) return

    try {
      const state = itemStates[itemId]
      
      const { error } = await supabase
        .from('action_plan_checklist_items')
        .update({
          answer: state.answer,
          is_completed: state.is_completed,
          document_urls: state.document_urls,
          document_names: state.document_names,
          completed_at: state.is_completed ? new Date().toISOString() : null
        })
        .eq('checklist_id', checklistId)
        .eq('item_id', itemId)

      if (error) throw error
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'haute': return 'bg-red-100 text-red-700 border-red-300'
      case 'moyenne': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'basse': return 'bg-green-100 text-green-700 border-green-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col my-8"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-3xl">{stepData.icon}</span>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Étape {stepNumber}/5: {stepData.title}
                  </h2>
                </div>
                <p className="text-gray-700 mb-3">
                  🎯 {stepData.objective}
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Clock className="w-4 h-4" />
                    <span>Durée: {stepData.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Briefcase className="w-4 h-4" />
                    <span>{completedCount}/{checklist.length} tâches complétées</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression</span>
                <span className="text-sm font-bold text-emerald-600">{progressPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-600"
                />
              </div>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <div className="space-y-3">
                {checklist.map((item, index) => {
                  const isExpanded = expandedItems.has(item.id)
                  const state = itemStates[item.id] || {
                    answer: '',
                    is_completed: false,
                    document_urls: [],
                    document_names: []
                  }
                  const isGenerating = generatingId === item.id
                  const isUploading = uploadingId === item.id

                  return (
                    <div
                      key={item.id}
                      className={`border-2 rounded-xl transition-all ${
                        state.is_completed
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* Item Header */}
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-t-xl"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleComplete(item.id)
                            }}
                            className="flex-shrink-0"
                          >
                            {state.is_completed ? (
                              <CheckCircle className="w-6 h-6 text-emerald-600" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-400" />
                            )}
                          </button>

                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">
                                {index + 1}. {item.task}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                                {item.priority}
                              </span>
                              {item.requiresDocument && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300">
                                  📎 Document requis
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{item.description}</p>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span>⏱️ {item.estimatedTime}</span>
                              {state.document_urls.length > 0 && (
                                <span>📎 {state.document_urls.length} document(s)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
                        )}
                      </button>

                      {/* Item Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 space-y-4">
                              {/* Textarea */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Votre réponse:
                                </label>
                                <textarea
                                  value={state.answer}
                                  onChange={(e) => handleAnswerChange(item.id, e.target.value)}
                                  placeholder={item.placeholder}
                                  className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                                  disabled={isGenerating}
                                />
                              </div>

                              {/* AI Button */}
                              <button
                                onClick={() => handleGenerateAI(item)}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Génération...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Générer avec IA</span>
                                  </>
                                )}
                              </button>

                              {/* Upload Section */}
                              {item.requiresDocument && (
                                <div className="border-t border-gray-200 pt-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Documents ({item.documentType}):
                                  </label>

                                  {/* Uploaded Files */}
                                  {state.document_urls.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                      {state.document_urls.map((url, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                                        >
                                          <div className="flex items-center gap-2 flex-1">
                                            <FileText className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm text-gray-700 truncate">
                                              {state.document_names[idx]}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <a
                                              href={url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                                            >
                                              <Download className="w-4 h-4 text-blue-600" />
                                            </a>
                                            <button
                                              onClick={() => handleDeleteDocument(item.id, idx)}
                                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                                            >
                                              <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Upload Button */}
                                  <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer">
                                    <input
                                      type="file"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        if (file) handleFileUpload(item.id, file)
                                      }}
                                      className="hidden"
                                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                                      disabled={isUploading}
                                    />
                                    {isUploading ? (
                                      <>
                                        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                                        <span className="text-sm font-medium text-emerald-600">
                                          Upload en cours...
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="w-5 h-5 text-gray-500" />
                                        <span className="text-sm font-medium text-gray-700">
                                          Ajouter un document
                                        </span>
                                      </>
                                    )}
                                  </label>
                                  <p className="text-xs text-gray-500 mt-1">
                                    PDF, Word, Excel, Images (max 10MB)
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {progressPercentage === 100 ? (
                  <span className="text-emerald-600 font-semibold">
                    ✅ Étape complétée !
                  </span>
                ) : (
                  <span>
                    Complétez toutes les tâches pour passer à l'étape suivante
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
