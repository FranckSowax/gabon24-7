'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, Loader2, ChevronDown, ChevronUp, 
  CheckCircle, Circle, Upload, FileText, Trash2, 
  Clock, AlertCircle, Briefcase, Check
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ACTION_PLAN_STEPS, ChecklistItem, getPersonalizedActionPlan, ActionStep } from '@/types/action-plan-checklist'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionPlanStepsProps {
  projectData: {
    titre: string
    secteur: string
    budget: string
    description: string
    projectId: string
    userId: string
    contexte?: string
    problematique?: string
    article?: string
  }
  generatedSteps?: ActionStep[]
}

interface ChecklistItemState {
  item_id: string
  answer: string
  is_completed: boolean
  document_urls: string[]
  document_names: string[]
  checked_subtasks: number[] // Indices des sous-tâches cochées
}

interface StepProgress {
  checklistId: string | null
  items: {[key: string]: ChecklistItemState}
  progress: number
  status: 'not_started' | 'in_progress' | 'completed'
}

export default function ActionPlanSteps({ projectData, generatedSteps }: ActionPlanStepsProps) {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [stepsProgress, setStepsProgress] = useState<{[key: number]: StepProgress}>({})
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [generatingDocId, setGeneratingDocId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Utiliser les étapes générées par IA si disponibles, sinon utiliser le plan personnalisé par défaut
  const personalizedSteps = generatedSteps || getPersonalizedActionPlan(projectData)

  // Calculer la progression globale
  const totalSteps = personalizedSteps.length
  const completedSteps = Object.values(stepsProgress).filter(s => s.status === 'completed').length
  const globalProgress = Math.round((completedSteps / totalSteps) * 100)

  // Charger toutes les checklists au montage
  useEffect(() => {
    if (projectData.projectId && projectData.userId) {
      loadAllChecklists()
    }
  }, [projectData.projectId])

  const loadAllChecklists = async () => {
    try {
      setLoading(true)
      const progress: {[key: number]: StepProgress} = {}

      for (const step of personalizedSteps) {
        const stepProgress = await loadOrCreateChecklist(step.step)
        progress[step.step] = stepProgress
      }

      setStepsProgress(progress)
    } catch (error) {
      console.error('Erreur chargement checklists:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOrCreateChecklist = async (stepNumber: number): Promise<StepProgress> => {
    try {
      const stepData = ACTION_PLAN_STEPS.find(s => s.step === stepNumber)
      if (!stepData) throw new Error('Step not found')

      // Récupérer l'utilisateur actuel depuis Supabase
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('User not authenticated')

      // Chercher checklist existante
      const { data: existing, error: fetchError } = await supabase
        .from('action_plan_checklists')
        .select('id, status, progress_percentage')
        .eq('project_id', projectData.projectId)
        .eq('step_number', stepNumber)
        .maybeSingle()

      if (fetchError) throw fetchError

      let currentChecklistId = existing?.id
      let status = existing?.status || 'not_started'

      // Créer si n'existe pas
      if (!currentChecklistId) {
        const { data: newChecklist, error: createError } = await supabase
          .from('action_plan_checklists')
          .insert({
            project_id: projectData.projectId,
            user_id: currentUser.id, // Utiliser l'utilisateur authentifié actuel
            step_number: stepNumber,
            step_title: stepData.title,
            step_objective: stepData.objective,
            step_duration: stepData.duration
          })
          .select('id')
          .single()

        if (createError) {
          console.error(`Erreur chargement step ${stepNumber}:`, createError)
          throw createError
        }
        currentChecklistId = newChecklist.id

        // Créer les items
        const items = stepData.checklist.map((item, index) => ({
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

      // Charger les items
      const { data: items, error: itemsError } = await supabase
        .from('action_plan_checklist_items')
        .select('*')
        .eq('checklist_id', currentChecklistId)
        .order('order_index')

      if (itemsError) throw itemsError

      // Initialiser les états
      const itemStates: {[key: string]: ChecklistItemState} = {}
      items?.forEach((item: any) => {
        itemStates[item.item_id] = {
          item_id: item.item_id,
          answer: item.answer || '',
          is_completed: item.is_completed || false,
          document_urls: item.document_urls || [],
          document_names: item.document_names || [],
          checked_subtasks: item.checked_subtasks || []
        }
      })

      const completedCount = Object.values(itemStates).filter(s => s.is_completed).length
      const progress = stepData.checklist.length > 0 
        ? Math.round((completedCount / stepData.checklist.length) * 100) 
        : 0

      return {
        checklistId: currentChecklistId,
        items: itemStates,
        progress,
        status: progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started'
      }
    } catch (error) {
      console.error(`Erreur chargement step ${stepNumber}:`, error)
      return {
        checklistId: null,
        items: {},
        progress: 0,
        status: 'not_started'
      }
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

  const handleAnswerChange = (stepNumber: number, itemId: string, value: string) => {
    setStepsProgress(prev => ({
      ...prev,
      [stepNumber]: {
        ...prev[stepNumber],
        items: {
          ...prev[stepNumber].items,
          [itemId]: { ...prev[stepNumber].items[itemId], answer: value }
        }
      }
    }))
    
    // Debounce la sauvegarde
    if (typeof window !== 'undefined') {
      const timeoutId = (window as any)[`saveTimeout_${itemId}`]
      if (timeoutId) clearTimeout(timeoutId)
      
      ;(window as any)[`saveTimeout_${itemId}`] = setTimeout(() => {
        saveItemToDatabase(stepNumber, itemId)
      }, 1000)
    }
  }

  // Fonction pour vérifier si toutes les sous-tâches sont cochées et auto-compléter la tâche principale
  const checkAndAutoCompleteTask = (stepNumber: number, itemId: string, answer: string) => {
    if (!answer) return false

    // Compter le nombre total de sous-tâches valides
    const totalSubtasks = answer.split('\n')
      .filter(line => {
        const trimmed = line.trim()
        if (!trimmed) return false
        if (trimmed.length < 10) return false
        if (trimmed.endsWith(':')) return false
        if (/^[A-Z\s]+:?$/.test(trimmed)) return false
        
        const lowerLine = trimmed.toLowerCase()
        if (lowerLine.startsWith('voici')) return false
        if (lowerLine.includes('plan d\'action') || lowerLine.includes('plan de tâches')) return false
        if (lowerLine.includes('en respectant') || lowerLine.includes('conformité')) return false
        if (lowerLine.startsWith('ce plan') || lowerLine.startsWith('ces étapes')) return false
        if (lowerLine.includes('bonne chance') || lowerLine.includes('bon courage')) return false
        if (lowerLine.includes('n\'hésitez pas') || lowerLine.includes('contactez')) return false
        
        return /^[\d•\-\*]/.test(trimmed)
      }).length

    const checkedSubtasks = stepsProgress[stepNumber]?.items[itemId]?.checked_subtasks?.length || 0
    
    // Si toutes les sous-tâches sont cochées, retourner true
    return totalSubtasks > 0 && checkedSubtasks >= totalSubtasks
  }

  const handleGenerateAI = async (stepNumber: number, item: ChecklistItem) => {
    setGeneratingId(item.id)
    try {
      const stepData = personalizedSteps.find(s => s.step === stepNumber)
      if (!stepData) throw new Error('Step not found')

      // Utiliser le prompt IA personnalisé qui contient déjà le contexte du projet
      const projectContext = `Agis comme un consultant en entrepreneuriat spécialisé dans le contexte gabonais.

Étape ${stepNumber}/5: ${stepData.title}
Objectif: ${stepData.objective}

Tâche: ${item.task}
Description: ${item.description}

${item.aiPrompt}

IMPORTANT - FORMAT DE RÉPONSE:
- Génère un plan d'action concret avec MAXIMUM 10 tâches à effectuer
- Chaque tâche doit être une action simple et claire (une ligne)
- Format: Liste numérotée (1. 2. 3. etc.) ou à puces (- ou •)
- Sois concis: 5-8 tâches suffisent sauf si vraiment nécessaire
- Adapte au contexte gabonais (FCFA, institutions locales, réalités terrain)
- Chaque tâche doit être actionnable et mesurable
- Évite les tâches trop générales ou vagues

Exemple de format attendu:
1. Identifier les 3 principaux quartiers d'Akanda à forte demande
2. Lister 10 distributeurs locaux (supermarchés, dépôts)
3. Préparer un document de présentation (1 page)
4. Contacter les points de vente par téléphone
5. Organiser 5 rendez-vous de prospection`

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
        // Mettre à jour l'état local
        setStepsProgress(prev => ({
          ...prev,
          [stepNumber]: {
            ...prev[stepNumber],
            items: {
              ...prev[stepNumber].items,
              [item.id]: { 
                ...prev[stepNumber].items[item.id], 
                answer: data.response 
              }
            }
          }
        }))
        
        // Sauvegarder immédiatement en base de données
        const stepProgress = stepsProgress[stepNumber]
        if (stepProgress?.checklistId) {
          const { error } = await supabase
            .from('action_plan_checklist_items')
            .update({
              answer: data.response,
              is_completed: false,
              document_urls: [],
              document_names: [],
              checked_subtasks: [], // Réinitialiser les sous-tâches cochées
              completed_at: null
            })
            .eq('checklist_id', stepProgress.checklistId)
            .eq('item_id', item.id)
          
          if (error) {
            console.error('Erreur sauvegarde:', error)
            throw new Error('Erreur lors de la sauvegarde en base de données')
          }
          
          console.log(`✅ Plan d'action sauvegardé pour ${item.id}`)
        } else {
          console.warn(`⚠️ Impossible de sauvegarder: checklist non trouvée pour step ${stepNumber}`)
          // Essayer de créer la checklist si elle n'existe pas
          await loadOrCreateChecklist(stepNumber)
          // Réessayer la sauvegarde
          const retryProgress = stepsProgress[stepNumber]
          if (retryProgress?.checklistId) {
            await supabase
              .from('action_plan_checklist_items')
              .update({
                answer: data.response,
                is_completed: false,
                checked_subtasks: [],
                completed_at: null
              })
              .eq('checklist_id', retryProgress.checklistId)
              .eq('item_id', item.id)
            console.log(`✅ Plan d'action sauvegardé après retry pour ${item.id}`)
          }
        }
      } else {
        throw new Error(data.error || 'Réponse IA invalide')
      }
    } catch (error: any) {
      console.error('Erreur génération IA:', error)
      alert(`❌ Erreur génération IA:\n${error.message}\n\nVeuillez réessayer ou remplir manuellement.`)
    } finally {
      setGeneratingId(null)
    }
  }

  const handleFileUpload = async (stepNumber: number, itemId: string, file: File) => {
    const stepProgress = stepsProgress[stepNumber]
    if (!stepProgress?.checklistId) return

    setUploadingId(itemId)
    try {
      const fileName = `${Date.now()}-${file.name}`
      const filePath = `${projectData.userId}/${projectData.projectId}/${itemId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('action-plan-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: urlData, error: urlError } = await supabase.storage
        .from('action-plan-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365)

      if (urlError) throw urlError

      const fileUrl = urlData.signedUrl

      setStepsProgress(prev => ({
        ...prev,
        [stepNumber]: {
          ...prev[stepNumber],
          items: {
            ...prev[stepNumber].items,
            [itemId]: {
              ...prev[stepNumber].items[itemId],
              document_urls: [...(prev[stepNumber].items[itemId]?.document_urls || []), fileUrl],
              document_names: [...(prev[stepNumber].items[itemId]?.document_names || []), file.name]
            }
          }
        }
      }))

      await saveItemToDatabase(stepNumber, itemId)
    } catch (error) {
      console.error('Erreur upload:', error)
      alert('Erreur lors de l\'upload du fichier')
    } finally {
      setUploadingId(null)
    }
  }

  // Génération de document avec IA (coût: 5 crédits)
  const handleGenerateDocument = async (stepNumber: number, itemId: string, documentType: string, taskDescription: string) => {
    const stepProgress = stepsProgress[stepNumber]
    if (!stepProgress?.checklistId) return

    setGeneratingDocId(itemId)
    try {
      // Récupérer le token d'authentification
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Token d\'authentification manquant')
      }

      // Trouver l'étape actuelle pour le contexte
      const currentStepData = personalizedSteps.find(s => s.step === stepNumber)

      const response = await fetch(`${API_URL}/api/ai/generate-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          projectId: projectData.projectId,
          userId: projectData.userId,
          documentType,
          taskDescription,
          stepTitle: currentStepData?.title || '',
          stepDescription: currentStepData?.objective || '',
          projectContext: {
            titre: projectData.titre,
            secteur: projectData.secteur,
            budget: projectData.budget,
            description: projectData.description,
            problematique: projectData.problematique,
            contexte: projectData.contexte
          }
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la génération du document')
      }

      // Ajouter le document généré à la liste
      setStepsProgress(prev => ({
        ...prev,
        [stepNumber]: {
          ...prev[stepNumber],
          items: {
            ...prev[stepNumber].items,
            [itemId]: {
              ...prev[stepNumber].items[itemId],
              document_urls: [...(prev[stepNumber].items[itemId]?.document_urls || []), data.documentUrl],
              document_names: [...(prev[stepNumber].items[itemId]?.document_names || []), data.documentName]
            }
          }
        }
      }))

      await saveItemToDatabase(stepNumber, itemId)

      alert(`✅ Document "${data.documentName}" généré avec succès!\n\n💰 5 crédits utilisés\n📁 Disponible dans votre bibliothèque`)
    } catch (error) {
      console.error('Erreur génération document:', error)
      alert(`❌ Erreur: ${error instanceof Error ? error.message : 'Erreur lors de la génération du document'}`)
    } finally {
      setGeneratingDocId(null)
    }
  }

  const handleToggleComplete = async (stepNumber: number, itemId: string) => {
    const currentState = stepsProgress[stepNumber].items[itemId]
    const newCompleted = !currentState?.is_completed

    setStepsProgress(prev => ({
      ...prev,
      [stepNumber]: {
        ...prev[stepNumber],
        items: {
          ...prev[stepNumber].items,
          [itemId]: { ...prev[stepNumber].items[itemId], is_completed: newCompleted }
        }
      }
    }))

    await saveItemToDatabase(stepNumber, itemId)
    
    // Recalculer la progression
    setTimeout(() => {
      loadOrCreateChecklist(stepNumber).then(newProgress => {
        setStepsProgress(prev => ({
          ...prev,
          [stepNumber]: newProgress
        }))
      })
    }, 500)
  }

  const saveItemToDatabase = async (stepNumber: number, itemId: string) => {
    const stepProgress = stepsProgress[stepNumber]
    if (!stepProgress?.checklistId) {
      console.warn(`No checklist found for step ${stepNumber}`)
      return
    }

    try {
      const state = stepProgress.items[itemId]
      
      // Vérifier que l'item existe avant de sauvegarder
      if (!state) {
        console.warn(`Item ${itemId} not found in step ${stepNumber}. Available items:`, Object.keys(stepProgress.items))
        return
      }
      
      // Vérifier que l'item existe dans la définition du step
      const stepData = ACTION_PLAN_STEPS.find(s => s.step === stepNumber)
      const itemExists = stepData?.checklist.some(item => item.id === itemId)
      if (!itemExists) {
        console.warn(`Item ${itemId} not found in ACTION_PLAN_STEPS for step ${stepNumber}. Skipping save.`)
        return
      }
      
      const { error } = await supabase
        .from('action_plan_checklist_items')
        .update({
          answer: state.answer || '',
          is_completed: state.is_completed || false,
          document_urls: state.document_urls || [],
          document_names: state.document_names || [],
          checked_subtasks: state.checked_subtasks || [],
          completed_at: state.is_completed ? new Date().toISOString() : null
        })
        .eq('checklist_id', stepProgress.checklistId)
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
      case 'basse': return 'bg-[#697357]/15 text-[#4d553e] border-[#697357]/40'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-[#697357] animate-spin" />
        <span className="ml-3 text-gray-600">Chargement du plan d'action...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Barre de progression globale */}
      <div className="bg-gradient-to-r from-[#697357]/10 to-[#8a9576]/10 rounded-xl p-6 border-2 border-[#697357]/40">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Progression Globale</h3>
            <p className="text-sm text-gray-600 mt-1">
              {completedSteps} sur {totalSteps} étapes complétées
            </p>
          </div>
          <div className="text-3xl font-bold text-[#697357]">
            {globalProgress}%
          </div>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#697357] to-yellow-500"
            initial={{ width: 0 }}
            animate={{ width: `${globalProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Navigation des étapes */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {personalizedSteps.map((step) => {
          const stepProgress = stepsProgress[step.step]
          const isActive = currentStep === step.step
          const isCompleted = stepProgress?.status === 'completed'
          
          return (
            <button
              key={step.step}
              onClick={() => setCurrentStep(step.step)}
              className={`flex-shrink-0 px-4 py-3 rounded-lg border-2 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-[#697357] to-yellow-500 border-[#697357] text-white'
                  : isCompleted
                  ? 'bg-[#697357]/10 border-[#697357]/40 text-[#697357]'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-[#697357]/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{step.icon}</span>
                <div className="text-left">
                  <div className="font-semibold text-sm">Étape {step.step}</div>
                  <div className="text-xs opacity-90">{stepProgress?.progress || 0}%</div>
                </div>
                {isCompleted && <CheckCircle className="w-4 h-4" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Contenu de l'étape actuelle */}
      <AnimatePresence mode="wait">
        {personalizedSteps.map((step) => {
          if (step.step !== currentStep) return null
          
          const stepProgress = stepsProgress[step.step]
          if (!stepProgress) return null

          return (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {/* Header de l'étape */}
              <div className="bg-gradient-to-br from-[#697357]/10 to-[#8a9576]/10 rounded-xl p-6 border-2 border-[#697357]/40">
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{step.icon}</span>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {step.title}
                    </h2>
                    <p className="text-gray-600 mb-4">{step.objective}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-[#697357]">
                        <Clock className="w-4 h-4" />
                        <span>{step.duration}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{stepProgress.progress}% complété</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barre de progression de l'étape */}
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#697357] to-yellow-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${stepProgress.progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Checklist items */}
              <div className="space-y-3">
                {step.checklist.map((item, index) => {
                  const itemState = stepProgress.items[item.id]
                  const isExpanded = expandedItems.has(item.id)
                  const isGenerating = generatingId === item.id
                  const isUploading = uploadingId === item.id

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-xl border-2 transition-all ${
                        itemState?.is_completed
                          ? 'border-[#697357]/40 bg-[#697357]/10'
                          : 'border-[#697357]/20 hover:border-[#697357]/30'
                      }`}
                    >
                      {/* Header de l'item */}
                      <div
                        className="p-4 cursor-pointer"
                        onClick={() => toggleItem(item.id)}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleComplete(step.step, item.id)
                            }}
                            className="flex-shrink-0 mt-1"
                          >
                            {itemState?.is_completed ? (
                              <CheckCircle className="w-6 h-6 text-[#697357]" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-400 hover:text-[#697357]" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h3 className={`font-semibold ${
                                  itemState?.is_completed ? 'text-[#697357] line-through' : 'text-gray-900'
                                }`}>
                                  {item.task}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(item.priority)}`}>
                                  {item.priority}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {item.estimatedTime}
                              </div>
                              {item.requiresDocument && (
                                <div className="flex items-center gap-1 text-[#697357]">
                                  <FileText className="w-3 h-3" />
                                  Document requis
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contenu étendu */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-200 overflow-hidden"
                          >
                            <div className="p-4 space-y-4">
                              {/* Tâches à effectuer */}
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-3 block">
                                  Tâches à effectuer
                                </label>
                                
                                {!itemState?.answer ? (
                                  // Bouton pour générer le plan d'action
                                  <div className="border-2 border-dashed border-[#697357]/40 rounded-xl p-8 text-center bg-gradient-to-br from-[#697357]/10 to-pink-50">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-[#697357] to-pink-500 rounded-full mb-4">
                                      <Sparkles className="w-8 h-8 text-white" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                                      Générer les tâches avec l'IA
                                    </h4>
                                    <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                                      L'assistant IA va créer une liste de tâches détaillées et concrètes pour accomplir cette étape
                                    </p>
                                    <button
                                      onClick={() => handleGenerateAI(step.step, item)}
                                      disabled={isGenerating}
                                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#697357] to-pink-500 text-white rounded-lg hover:from-[#4d553e] hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
                                    >
                                      {isGenerating ? (
                                        <>
                                          <Loader2 className="w-5 h-5 animate-spin" />
                                          Génération des tâches...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-5 h-5" />
                                          Générer les tâches avec IA
                                        </>
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  // Affichage du plan d'action généré sous forme de checklist
                                  <div className="space-y-3">
                                    <div className="bg-gradient-to-br from-[#697357]/10 to-pink-50 rounded-xl p-4 border-2 border-[#697357]/20">
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-[#697357] to-pink-500 rounded-full">
                                            <Sparkles className="w-4 h-4 text-white" />
                                          </div>
                                          <span className="text-sm font-medium text-[#4d553e]">
                                            Plan de tâches à effectuer
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => handleGenerateAI(step.step, item)}
                                          disabled={isGenerating}
                                          className="text-xs text-[#697357] hover:text-[#4d553e] underline"
                                        >
                                          Régénérer
                                        </button>
                                      </div>
                                      
                                      {/* Checklist des sous-étapes */}
                                      <div className="bg-white rounded-lg p-4 space-y-3">
                                        {itemState.answer.split('\n')
                                          .filter(line => {
                                            const trimmed = line.trim()
                                            // Filtrer: garder seulement les lignes qui sont des tâches
                                            if (!trimmed) return false
                                            if (trimmed.length < 10) return false
                                            if (trimmed.endsWith(':')) return false
                                            if (/^[A-Z\s]+:?$/.test(trimmed)) return false
                                            
                                            // Exclure les phrases d'introduction/conclusion
                                            const lowerLine = trimmed.toLowerCase()
                                            if (lowerLine.startsWith('voici')) return false
                                            if (lowerLine.includes('plan d\'action') || lowerLine.includes('plan de tâches')) return false
                                            if (lowerLine.includes('en respectant') || lowerLine.includes('conformité')) return false
                                            if (lowerLine.startsWith('ce plan') || lowerLine.startsWith('ces étapes')) return false
                                            if (lowerLine.includes('bonne chance') || lowerLine.includes('bon courage')) return false
                                            if (lowerLine.includes('n\'hésitez pas') || lowerLine.includes('contactez')) return false
                                            
                                            // Garder uniquement les lignes avec numéro ou puce au début
                                            return /^[\d•\-\*]/.test(trimmed)
                                          })
                                          .map((substep, idx) => {
                                            const isChecked = itemState.checked_subtasks?.includes(idx) || false
                                            
                                            return (
                                              <label
                                                key={idx}
                                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={async (e) => {
                                                    const newProgress = { ...stepsProgress }
                                                    const checkedSubtasks = newProgress[step.step].items[item.id].checked_subtasks || []
                                                    
                                                    if (e.target.checked) {
                                                      // Ajouter l'indice de la sous-tâche
                                                      newProgress[step.step].items[item.id].checked_subtasks = [...checkedSubtasks, idx]
                                                    } else {
                                                      // Retirer l'indice de la sous-tâche
                                                      newProgress[step.step].items[item.id].checked_subtasks = checkedSubtasks.filter(i => i !== idx)
                                                    }
                                                    
                                                    // Vérifier si toutes les sous-tâches sont cochées
                                                    const allChecked = checkAndAutoCompleteTask(
                                                      step.step, 
                                                      item.id, 
                                                      itemState.answer
                                                    )
                                                    
                                                    // Si toutes les sous-tâches sont cochées, marquer la tâche principale comme complétée
                                                    if (allChecked && e.target.checked) {
                                                      newProgress[step.step].items[item.id].is_completed = true
                                                    } else if (!allChecked) {
                                                      // Si pas toutes cochées, décocher la tâche principale
                                                      newProgress[step.step].items[item.id].is_completed = false
                                                    }
                                                    
                                                    setStepsProgress(newProgress)
                                                    await saveItemToDatabase(step.step, item.id)
                                                    
                                                    // Recalculer la progression de l'étape
                                                    setTimeout(() => {
                                                      loadOrCreateChecklist(step.step).then(newStepProgress => {
                                                        setStepsProgress(prev => ({
                                                          ...prev,
                                                          [step.step]: newStepProgress
                                                        }))
                                                      })
                                                    }, 500)
                                                  }}
                                                  className="mt-1 w-5 h-5 text-[#697357] border-gray-300 rounded focus:ring-[#697357]"
                                                />
                                                <span className={`text-sm flex-1 ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                                  {substep.replace(/^[-•\*]\s*/, '').replace(/^\d+\.\s*/, '')}
                                                </span>
                                              </label>
                                            )
                                          })}
                                      </div>
                                      
                                      {/* Progression du plan */}
                                      <div className="mt-3 pt-3 border-t border-[#697357]/20">
                                        {(() => {
                                          // Utiliser le même filtre que pour l'affichage des tâches
                                          const totalSteps = itemState.answer.split('\n')
                                            .filter(line => {
                                              const trimmed = line.trim()
                                              if (!trimmed) return false
                                              if (trimmed.length < 10) return false
                                              if (trimmed.endsWith(':')) return false
                                              if (/^[A-Z\s]+:?$/.test(trimmed)) return false
                                              
                                              // Exclure les phrases d'introduction/conclusion
                                              const lowerLine = trimmed.toLowerCase()
                                              if (lowerLine.startsWith('voici')) return false
                                              if (lowerLine.includes('plan d\'action') || lowerLine.includes('plan de tâches')) return false
                                              if (lowerLine.includes('en respectant') || lowerLine.includes('conformité')) return false
                                              if (lowerLine.startsWith('ce plan') || lowerLine.startsWith('ces étapes')) return false
                                              if (lowerLine.includes('bonne chance') || lowerLine.includes('bon courage')) return false
                                              if (lowerLine.includes('n\'hésitez pas') || lowerLine.includes('contactez')) return false
                                              
                                              // Garder uniquement les lignes avec numéro ou puce au début
                                              return /^[\d•\-\*]/.test(trimmed)
                                            }).length
                                          const completedSteps = itemState.checked_subtasks?.length || 0
                                          const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
                                          
                                          return (
                                            <div className="flex items-center gap-3">
                                              <div className="flex-1">
                                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                                  <span>Progression</span>
                                                  <span className="font-medium">{completedSteps}/{totalSteps} étapes</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                  <div
                                                    className="bg-gradient-to-r from-[#697357] to-pink-500 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                  />
                                                </div>
                                              </div>
                                              <span className="text-lg font-bold text-[#697357]">{progress}%</span>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Upload de documents */}
                              {item.requiresDocument && (
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                                    Documents ({item.documentType})
                                  </label>
                                  
                                  <div className="space-y-2">
                                    {itemState?.document_names?.map((name, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                          <FileText className="w-4 h-4 text-gray-600" />
                                          <span className="text-sm text-gray-700">{name}</span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const newUrls = [...itemState.document_urls]
                                            const newNames = [...itemState.document_names]
                                            newUrls.splice(idx, 1)
                                            newNames.splice(idx, 1)
                                            setStepsProgress(prev => ({
                                              ...prev,
                                              [step.step]: {
                                                ...prev[step.step],
                                                items: {
                                                  ...prev[step.step].items,
                                                  [item.id]: {
                                                    ...prev[step.step].items[item.id],
                                                    document_urls: newUrls,
                                                    document_names: newNames
                                                  }
                                                }
                                              }
                                            }))
                                            saveItemToDatabase(step.step, item.id)
                                          }}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ))}
                                    
                                    {/* Bouton Générer document avec IA */}
                                    <button
                                      onClick={() => handleGenerateDocument(step.step, item.id, item.documentType || 'Document', item.task)}
                                      disabled={generatingDocId === item.id}
                                      className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#697357]/40 rounded-lg hover:border-[#697357] hover:bg-[#697357]/10 transition-all w-full"
                                    >
                                      {generatingDocId === item.id ? (
                                        <>
                                          <Loader2 className="w-5 h-5 text-[#697357] animate-spin" />
                                          <span className="text-sm text-[#697357]">Génération en cours...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-5 h-5 text-[#697357]" />
                                          <span className="text-sm text-[#697357] font-medium">Générer le document avec IA</span>
                                          <span className="text-xs text-[#8a9576] ml-1">(5 crédits)</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
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

              {/* Navigation entre étapes */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  disabled={currentStep === 1}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  ← Étape précédente
                </button>
                
                <button
                  onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
                  disabled={currentStep === totalSteps}
                  className="px-6 py-3 bg-gradient-to-r from-[#697357] to-[#697357] text-white rounded-lg hover:from-[#4d553e] hover:to-[#4d553e] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Étape suivante →
                </button>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Page de synthèse finale - Affichée quand toutes les étapes sont complétées */}
      {globalProgress === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 bg-gradient-to-br from-[#697357]/10 via-[#8a9576]/10 to-[#8a9576]/10 rounded-2xl p-8 border-2 border-[#697357]/40"
        >
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#697357] rounded-full">
              <Check className="w-12 h-12 text-white" />
            </div>
            
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                🎉 Félicitations !
              </h2>
              <p className="text-lg text-gray-700">
                Vous avez complété toutes les étapes de votre plan d'action
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">📊 Résumé de votre progression</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-[#697357]/10 rounded-lg">
                  <div className="text-3xl font-bold text-[#697357]">{totalSteps}</div>
                  <div className="text-sm text-gray-600 mt-1">Étapes complétées</div>
                </div>
                <div className="text-center p-4 bg-[#697357]/10 rounded-lg">
                  <div className="text-3xl font-bold text-[#697357]">
                    {Object.values(stepsProgress).reduce((acc, step) => 
                      acc + Object.values(step.items).filter(item => item.is_completed).length, 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Actions réalisées</div>
                </div>
                <div className="text-center p-4 bg-[#697357]/10 rounded-lg">
                  <div className="text-3xl font-bold text-[#697357]">
                    {Object.values(stepsProgress).reduce((acc, step) => 
                      acc + Object.values(step.items).reduce((sum, item) => 
                        sum + (item.document_urls?.length || 0), 0
                      ), 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Documents ajoutés</div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#697357]/15 to-yellow-100 rounded-xl p-6 border-2 border-[#697357]/30">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">🚀 Prochaines étapes recommandées</h3>
              <ul className="text-left space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#697357] mt-1">•</span>
                  <span>Téléchargez un récapitulatif PDF de votre plan d'action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#697357] mt-1">•</span>
                  <span>Partagez votre projet avec des collaborateurs potentiels</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#697357] mt-1">•</span>
                  <span>Consultez les ressources de formation adaptées à votre projet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#697357] mt-1">•</span>
                  <span>Explorez les opportunités de financement disponibles</span>
                </li>
              </ul>
            </div>

            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all flex items-center gap-2"
              >
                <FileText className="w-5 h-5" />
                Télécharger PDF
              </button>
              <button
                onClick={() => window.location.href = '/business/mes-projets'}
                className="px-6 py-3 bg-gradient-to-r from-[#697357] to-yellow-500 text-white rounded-lg hover:from-[#4d553e] hover:to-yellow-600 transition-all flex items-center gap-2"
              >
                <Briefcase className="w-5 h-5" />
                Voir mes projets
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
