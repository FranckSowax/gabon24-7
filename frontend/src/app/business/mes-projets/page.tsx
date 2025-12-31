'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bookmark, Calendar, ArrowLeft, ExternalLink, Target, Sparkles, ChevronDown, Rocket, GraduationCap, FileText, Play, Zap, Award, TrendingUp, AlertCircle, MessageSquare, Trash2, Edit2, Send, RefreshCw, X, Briefcase, Clock, DollarSign, Building2, Star, Users, LayoutDashboard, User, StickyNote, CheckCircle, Menu, Database, Upload, Mail, Link, Copy, MessageCircle } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import ActionPlanGenerationModal from '@/components/business/ActionPlanGenerationModal'
import ApiErrorAlert from '@/components/common/ApiErrorAlert'
import { useAuth } from '@/contexts/AuthContext'
import { trackProjectAction } from '@/utils/project-tracking'
import { useRouter } from 'next/navigation'
import apiCall from '@/lib/api-client'
import { useSavedProjects, SavedProject } from '@/hooks/business/useSavedProjects'
import { useProjectDocuments } from '@/hooks/business/useProjectDocuments'
import ProgressBar, { ActionStep } from '@/components/business/ProgressBar'
import ProjectChatBot from '@/components/business/ProjectChatBot'
import ProjectTimeline from '@/components/business/ProjectTimeline'
import StepActionModal from '@/components/business/StepActionModal'
import BusinessPlanModal from '@/components/business/BusinessPlanModal'
import DocumentUploadModal from '@/components/collaboration/DocumentUploadModal'
import ActionPlanChecklistModal from '@/components/business/ActionPlanChecklistModal'
import ActionPlanGenerator from '@/components/business/ActionPlanGenerator'
import RelatedArticles from '@/components/business/RelatedArticles'
import DocumentViewer from '@/components/business/DocumentViewer'
import TrainingSummaryModal from '@/components/training/TrainingSummaryModal'
import ProjectCollaboration from '@/components/ProjectCollaboration'
import AIActionModal from '@/components/business/AIActionModal'
import SkillTestModal from '@/components/business/SkillTestModal'
import GenerateLetterModal from '@/components/business/GenerateLetterModal'
import ProjectDashboard from '@/components/business/ProjectDashboard'
import ProjectSidebar from '@/components/business/ProjectSidebar'
import ProjectCardOnboarding from '@/components/business/ProjectCardOnboarding'
import CollaborationSection from '@/components/business/CollaborationSection'
import { BUSINESS_PLAN_SECTIONS } from '@/types/business-plan-questions'
import { CREDIT_COSTS } from '@/types/business-tracking'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ProjectStats {
  total_projects: number
  projects_by_sector: Record<string, number>
  projects_by_budget: Record<string, number>
  recent_projects_count: number
}

interface ProjectAction {
  id: string
  action_type: string
  action_status: string
  action_reference_id: string | null
  created_at: string
}

interface ProjectNote {
  id: string
  project_id: string
  user_id: string
  note_content: string
  created_at: string
  updated_at: string
}

const PROJECT_SECTIONS = [
  {
    id: 'dashboard',
    title: 'Vue d\'ensemble',
    icon: LayoutDashboard,
    color: 'text-blue-400',
    description: 'Résumé du projet'
  },
  {
    id: 'overview',
    title: 'Informations Complètes',
    icon: Target,
    color: 'text-orange-400',
    description: 'Projet et contexte'
  },
  {
    id: 'plan-action',
    title: 'Plan d\'Action',
    icon: Briefcase,
    color: 'text-emerald-400',
    description: 'Roadmap du projet'
  },
  {
    id: 'actions',
    title: 'Actions IA',
    icon: Zap,
    color: 'text-yellow-400',
    description: 'Générations et outils IA'
  },
  {
    id: 'contexte',
    title: 'Contexte & Bibliothèque',
    icon: FileText,
    color: 'text-orange-400',
    description: 'Contexte cumulé pour IA'
  },
  {
    id: 'conseiller',
    title: 'Conseiller IA',
    icon: MessageSquare,
    color: 'text-cyan-400',
    description: 'Assistant intelligent'
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    icon: Users,
    color: 'text-emerald-400',
    description: 'Partager le projet'
  }
]

// Fonction pour traduire les noms d'actions
const getActionLabel = (actionType: string | undefined | null): string => {
  // Vérifier si actionType est valide
  if (!actionType || typeof actionType !== 'string') {
    return 'Document'
  }
  
  const labels: Record<string, string> = {
    'business-plan': 'Business Plan',
    'action-plan': 'Plan d\'Action',
    'skill-test': 'Test de Compétences',
    'custom-training': 'Formation sur Mesure',
    'etude-marche': 'Étude de Marché',
    'faisabilite': 'Étude de Faisabilité',
    'business-plan-section': 'Section Business Plan',
    'conversation-ai': 'Conversation Gabon Insight',
    'framework': 'Document Cadre'
  }
  return labels[actionType] || actionType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

const QUICK_ACTIONS = [
  {
    id: 'business-plan',
    title: 'Ébauche de Business Plan',
    description: '📊 Plan complet en 10 parties adapté au Gabon',
    icon: FileText,
    color: 'from-green-500 to-emerald-600',
    credits: 50
  },
  {
    id: 'generate-letter',
    title: 'Générer un courrier',
    description: '✉️ Courrier professionnel adapté au destinataire',
    icon: Mail,
    color: 'from-blue-500 to-cyan-600',
    credits: 15
  },
  {
    id: 'skill-test',
    title: 'Test de compétences',
    description: '🎯 Évaluez vos forces et faiblesses',
    icon: Award,
    color: 'from-purple-500 to-violet-600',
    credits: 20
  },
  {
    id: 'custom-training',
    title: 'Formation sur mesure',
    description: '🎓 Formation personnalisée selon vos besoins',
    icon: GraduationCap,
    color: 'from-orange-500 to-red-600',
    credits: 50
  }
]

export default function MesProjetsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  
  // Custom Hooks
  const { 
    projects, 
    loading: projectsLoading, 
    selectedProject, 
    stats, 
    setSelectedProject, 
    deleteProject: hookDeleteProject, 
    updateProjectStepStatus: hookUpdateStepStatus,
    refreshProjects 
  } = useSavedProjects(user?.id)

  const {
    projectDocuments,
    setProjectDocuments,
    newContext,
    setNewContext,
    showContextForm,
    setShowContextForm,
    selectedDocument,
    setSelectedDocument,
    fetchDocuments: hookFetchDocuments,
    addContextAndRegenerate: hookAddContext,
    deleteDocument: hookDeleteDocument,
    getDocumentIcon,
    getDocumentColor
  } = useProjectDocuments(user?.id)

  // Local States (non migrés)
  const [projectActions, setProjectActions] = useState<{[key: string]: ProjectAction[]}>({})
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({})
  const [projectNotes, setProjectNotes] = useState<{[key: string]: ProjectNote[]}>({})
  const [newNote, setNewNote] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  
  const [projectTimeline, setProjectTimeline] = useState<{[key: string]: any[]}>({})
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [stepActionModal, setStepActionModal] = useState<{ isOpen: boolean, step: any | null }>({ isOpen: false, step: null })
  const [businessPlanModal, setBusinessPlanModal] = useState<{ isOpen: boolean, section: any | null }>({ isOpen: false, section: null })
  const [businessPlanSelectorOpen, setBusinessPlanSelectorOpen] = useState(false)
  const [businessPlanProgress, setBusinessPlanProgress] = useState<{[key: string]: number}>({})
  const [actionPlanModal, setActionPlanModal] = useState<{ isOpen: boolean, stepNumber: number }>({ isOpen: false, stepNumber: 1 })
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false)
  const [selectedDocumentToView, setSelectedDocumentToView] = useState<any | null>(null)
  // États pour génération locale test et formation
  const [isGeneratingSkillTest, setIsGeneratingSkillTest] = useState(false)
  const [generatedSkillTest, setGeneratedSkillTest] = useState<any | null>(null)
  const [isGeneratingTraining, setIsGeneratingTraining] = useState(false)
  const [generatedTraining, setGeneratedTraining] = useState<any | null>(null)
  const [generatedTrainingId, setGeneratedTrainingId] = useState<string | null>(null)
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false)
  // États pour le modal de génération IA
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiModalStatus, setAiModalStatus] = useState<'generating' | 'success' | 'error'>('generating')
  const [aiModalProgress, setAiModalProgress] = useState(0)
  const [aiModalMessage, setAiModalMessage] = useState('')
  const [aiModalError, setAiModalError] = useState('')
  const [currentActionName, setCurrentActionName] = useState('')
  const [currentActionIcon, setCurrentActionIcon] = useState<React.ReactNode>(null)
  // État pour modal historique
  const [selectedHistoryEntry, setSelectedHistoryEntry] = useState<any | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  // États pour SkillTestModal
  const [skillTestModalOpen, setSkillTestModalOpen] = useState(false)
  // États pour GenerateLetterModal
  const [generateLetterModalOpen, setGenerateLetterModalOpen] = useState(false)
  // État pour filtre bibliothèque
  const [bibliothequeFilter, setBibliothequeFilter] = useState<string>('all')
  // État pour tabs contexte & bibliothèque
  const [contexteActiveTab, setContexteActiveTab] = useState<'contexte' | 'documents' | 'notes' | 'timeline'>('contexte')
  const [currentSkillTest, setCurrentSkillTest] = useState<any | null>(null)
  const [skillTestScores, setSkillTestScores] = useState<{[key: string]: any[]}>({})
  const [startTime, setStartTime] = useState<number>(0)
  // États pour la navigation par sections
  const [activeSection, setActiveSection] = useState<string>('dashboard') // dashboard, overview, context, actions, documents, timeline, notes
  // État pour le drawer mobile
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  // États pour les actions du projet
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  // État pour le modal de génération du plan d'action
  const [generatingActionPlan, setGeneratingActionPlan] = useState(false)
  // État pour la popup d'onboarding
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Vérifier si c'est la première visite de l'utilisateur sur une carte projet (une seule fois)
  useEffect(() => {
    if (selectedProject && typeof window !== 'undefined') {
      const hasSeenOnboarding = localStorage.getItem('project_card_onboarding_seen')
      if (!hasSeenOnboarding) {
        setShowOnboarding(true)
        // Marquer comme vu dès l'affichage pour ne plus jamais réafficher
        localStorage.setItem('project_card_onboarding_seen', 'true')
      }
    }
  }, [selectedProject])

  const handleDontShowOnboardingAgain = () => {
    // Déjà marqué comme vu, cette fonction peut rester pour compatibilité
    if (typeof window !== 'undefined') {
      localStorage.setItem('project_card_onboarding_seen', 'true')
    }
  }

  const fetchProjectActions = async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-actions/${projectId}`)
      const data = await response.json()
      if (data.success) {
        setProjectActions(prev => ({
          ...prev,
          [projectId]: data.actions || []
        }))
      }
    } catch (error) {
      console.error('Error fetching project actions:', error)
    }
  }

  const fetchProjectNotes = async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-notes/${projectId}`)
      const data = await response.json()
      if (data.success) {
        setProjectNotes(prev => ({
          ...prev,
          [projectId]: data.notes || []
        }))
      }
    } catch (error) {
      console.error('Error fetching project notes:', error)
    }
  }


  useEffect(() => {
    if (Array.isArray(projects) && projects.length > 0) {
      projects.forEach(project => {
        if (!projectDocuments[project.id]) hookFetchDocuments(project.id)
        if (!projectNotes[project.id]) fetchProjectNotes(project.id)
        if (!projectActions[project.id]) fetchProjectActions(project.id)
        if (!skillTestScores[project.id]) fetchSkillTestScores(project.id)
        if (!projectTimeline[project.id]) fetchProjectTimeline(project.id)
      })
    }
  }, [projects]) // Dépendance sur projects du hook

  // Ouvrir automatiquement la carte du projet si projectId est dans l'URL
  useEffect(() => {
    if (typeof window === 'undefined' || !Array.isArray(projects) || projects.length === 0) return
    
    const params = new URLSearchParams(window.location.search)
    const projectId = params.get('projectId')
    const openCard = params.get('openCard')
    const tab = params.get('tab')
    
    if (projectId && openCard === 'true') {
      const project = projects.find(p => p.id === projectId)
      if (project) {
        setSelectedProject(project)
        // Si un onglet spécifique est demandé, l'activer
        if (tab && ['dashboard', 'overview', 'plan-action', 'actions', 'contexte', 'conseiller', 'collaboration'].includes(tab)) {
          setActiveSection(tab)
        }
        // Nettoyer l'URL après ouverture
        window.history.replaceState({}, '', '/business/mes-projets')
      }
    }
  }, [projects, setSelectedProject])

  const restartAnalysis = async (projectId: string) => {
    if (!confirm('⚠️ Relancer l\'analyse va supprimer tous les documents et actions IA générés. Voulez-vous continuer ?')) {
      return
    }

    setIsRestarting(true)
    try {
      // Supprimer tous les documents et actions IA du projet
      const response = await fetch(`${API_URL}/api/projects/${projectId}/reset?userId=${user?.id}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Nettoyer les données locales
        setProjectActions(prev => ({
          ...prev,
          [projectId]: []
        }))
        // Note: projectDocuments est géré par le hook, on devrait peut-être le rafraîchir
        hookFetchDocuments(projectId) // Rafraîchir via le hook
        
        setProjectTimeline(prev => ({
          ...prev,
          [projectId]: []
        }))
        
        // Fermer le modal
        setSelectedProject(null)
        
        // Rediriger vers l'analyseur pour recommencer
        router.push(`/business/analyzer?projectId=${projectId}`)
      } else {
        throw new Error(data.error || 'Erreur lors de la réinitialisation')
      }
    } catch (error) {
      console.error('Error restarting analysis:', error)
      alert('❌ Erreur lors de la réinitialisation du projet')
    } finally {
      setIsRestarting(false)
    }
  }


  const fetchSkillTestScores = async (projectId: string) => {
    if (!user?.id) return
    try {
      const response = await fetch(`${API_URL}/api/skill-test/scores/${projectId}?userId=${user.id}`)
      const data = await response.json()
      if (data.success) {
        console.log(`🎯 Scores chargés pour projet ${projectId}:`, data.scores?.length || 0)
        setSkillTestScores(prev => ({
          ...prev,
          [projectId]: data.scores || []
        }))
      }
    } catch (error) {
      console.error('Error fetching skill test scores:', error)
    }
  }

  const markActionCompleted = async (projectId: string, actionType: string, referenceId?: string) => {
    if (!user?.id) return
    try {
      const response = await fetch(`${API_URL}/api/project-actions/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          actionType,
          referenceId
        })
      })
      const data = await response.json()
      if (data.success) {
        console.log(`✅ Action ${actionType} marquée comme completed`)
        // Recharger les documents
        hookFetchDocuments(projectId)
      }
    } catch (error) {
      console.error('Erreur marquage action:', error)
    }
  }

  const fetchProjectTimeline = async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-timeline/${projectId}`)
      const data = await response.json()
      if (data.success) {
        setProjectTimeline(prev => ({
          ...prev,
          [projectId]: data.timeline || []
        }))
      }
    } catch (error) {
      console.error('Error fetching project timeline:', error)
    }
  }

  const handleTimelineAddNote = async (projectId: string, note: string) => {
    if (!user?.id || !note.trim()) return
    
    try {
      const response = await fetch(`${API_URL}/api/project-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          noteContent: note.trim()
        })
      })

      const data = await response.json()
      if (data.success) {
        // Recharger la timeline
        await fetchProjectTimeline(projectId)
      }
    } catch (error) {
      console.error('Error adding note:', error)
      throw error
    }
  }

  const handleTimelineUploadFile = async (projectId: string, file: File) => {
    if (!user?.id) return
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', user.id)

      const response = await fetch(`${API_URL}/api/project-timeline/${projectId}/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (data.success) {
        // Recharger la timeline
        await fetchProjectTimeline(projectId)
      } else {
        throw new Error(data.error || 'Erreur upload')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  const handleTimelineDeleteEntry = async (entryId: string, projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/project-timeline/${entryId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        // Recharger la timeline
        await fetchProjectTimeline(projectId)
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
      throw error
    }
  }

  const handleOpenStepAction = (step: any) => {
    setStepActionModal({ isOpen: true, step })
  }

  const handleOpenBusinessPlanSection = (sectionNumber: number) => {
    const section = BUSINESS_PLAN_SECTIONS.find(s => s.section === sectionNumber)
    if (section) {
      setBusinessPlanModal({ isOpen: true, section })
    }
  }

  const handleCompleteBusinessPlanSection = async (projectId: string, section: any, answers: { [key: string]: string }) => {
    try {
      console.log(`✅ Section ${section.section} complétée:`, answers)
      
      // Créer le contenu du document à partir des réponses
      const answersText = Object.entries(answers)
        .map(([questionId, answer]) => {
          // Trouver la question correspondante
          const sectionData = BUSINESS_PLAN_SECTIONS.find(s => s.section === section.section)
          const question = sectionData?.questions.find(q => q.id === questionId)
          return `### ${question?.question || questionId}\n\n${answer}\n\n`
        })
        .join('\n')

      const fullContent = 
        `# ${section.title}\n\n` +
        `**Section ${section.section}**: ${section.objective}\n\n` +
        `---\n\n` +
        answersText +
        `---\n\n` +
        `*Section générée automatiquement pour le Business Plan*`

      // Sauvegarder dans Documents générés
      const response = await fetch(`${API_URL}/api/project-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user?.id,
          documentType: 'business-plan-section',
          title: `Business Plan - ${section.title}`,
          content: fullContent,
          promptUsed: `Section ${section.section} du Business Plan`,
          contextAdded: section.objective,
          metadata: {
            sectionNumber: section.section,
            sectionTitle: section.title,
            questionCount: Object.keys(answers).length,
            generatedFrom: 'mes-projets'
          }
        })
      })

      const data = await response.json()
      if (data.success) {
        console.log('✅ Section Business Plan sauvegardée dans Documents:', data.document.id)
        
        // Marquer l'action comme complétée
        await markActionCompleted(projectId, 'business-plan', data.document.id)
      }
      
      // Mettre à jour la progression du business plan
      setBusinessPlanProgress(prev => ({
        ...prev,
        [projectId]: Math.max(prev[projectId] || 0, section.section)
      }))

      // Rafraîchir les documents du projet
      await hookFetchDocuments(projectId)
    } catch (error) {
      console.error('Erreur completion section BP:', error)
      throw error
    }
  }

  const handleGenerateStepAIResponse = async (question: any, projectContext: string) => {
    if (!user?.id || !selectedProject) return ''

    try {
      const response = await fetch(`${API_URL}/api/project-chat/generate-quick-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          projectId: selectedProject.id,
          prompt: projectContext,
          modelType: 'nano-gpt5'
        })
      })

      const data = await response.json()
      if (data.success && data.response) {
        return data.response
      } else {
        throw new Error(data.error || 'Erreur génération')
      }
    } catch (error) {
      console.error('Error generating AI response:', error)
      throw error
    }
  }

  const handleCompleteStepAction = async (projectId: string, step: any, answers: { [key: string]: string }) => {
    if (!user?.id) return

    try {
      // Créer un document récapitulatif des réponses
      const answersText = Object.entries(answers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n\n')

      // Ajouter au contexte cumulatif via timeline
      const response = await fetch(`${API_URL}/api/project-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          noteContent: `📋 Étape ${step.step} complétée: ${step.title}\n\n${answersText}`
        })
      })

      const data = await response.json()
      if (data.success) {
        // Mettre à jour le statut de l'étape à completed
        await hookUpdateStepStatus(projectId, step.step)
        
        // Recharger la timeline
        await fetchProjectTimeline(projectId)

        // Track l'action
        await trackProjectAction({
          projectId,
          userId: user.id,
          actionType: 'step-completed' as any,
          metadata: {
            step_number: step.step,
            step_title: step.title,
            answers_count: Object.keys(answers).length
          }
        })
      }
    } catch (error) {
      console.error('Error completing step action:', error)
      throw error
    }
  }

  const handleAddNote = async (projectId: string) => {
    if (!user?.id || !newNote.trim()) return
    
    setIsAddingNote(true)
    try {
      const response = await fetch(`${API_URL}/api/project-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user.id,
          noteContent: newNote.trim()
        })
      })

      const data = await response.json()
      if (data.success) {
        // Ajouter la note localement
        setProjectNotes(prev => ({
          ...prev,
          [projectId]: [data.note, ...(prev[projectId] || [])]
        }))
        setNewNote('')
      } else {
        alert('Erreur lors de l\'ajout de la note')
      }
    } catch (error) {
      console.error('Error adding note:', error)
      alert('Erreur lors de l\'ajout de la note')
    } finally {
      setIsAddingNote(false)
    }
  }

  const handleUpdateNote = async (noteId: string, projectId: string) => {
    if (!user?.id || !editingNoteContent.trim()) return
    
    try {
      const response = await fetch(`${API_URL}/api/project-notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          noteContent: editingNoteContent.trim()
        })
      })

      const data = await response.json()
      if (data.success) {
        // Mettre à jour localement
        setProjectNotes(prev => ({
          ...prev,
          [projectId]: prev[projectId].map(note => 
            note.id === noteId ? data.note : note
          )
        }))
        setEditingNoteId(null)
        setEditingNoteContent('')
      } else {
        alert('Erreur lors de la modification')
      }
    } catch (error) {
      console.error('Error updating note:', error)
      alert('Erreur lors de la modification')
    }
  }

  const handleDeleteNote = async (noteId: string, projectId: string) => {
    if (!user?.id || !confirm('Supprimer cette note ?')) return
    
    try {
      const response = await fetch(`${API_URL}/api/project-notes/${noteId}?userId=${user.id}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      if (data.success) {
        // Supprimer localement
        setProjectNotes(prev => ({
          ...prev,
          [projectId]: prev[projectId].filter(note => note.id !== noteId)
        }))
      } else {
        alert('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleAddContextToDocument = async (documentId: string, projectId: string) => {
    if (!user?.id || !newContext.trim()) {
      alert('Veuillez ajouter du contexte')
      return
    }

    try {
      // 1. Récupérer le document actuel
      const docResponse = await fetch(`${API_URL}/api/project-documents/${documentId}`)
      const { document } = await docResponse.json()

      // 2. Récupérer les notes du projet comme contexte supplémentaire
      const notes = projectNotes[projectId] || []
      const notesContext = notes.map(note => note.note_content).join('\n\n')

      // 3. Construire le contexte enrichi
      const enrichedContext = [
        document.context_added,
        '--- Notes et commentaires du projet ---',
        notesContext,
        '--- Nouveau contexte ---',
        newContext
      ].filter(Boolean).join('\n\n')

      // 4. Construire le prompt enrichi
      const enhancedPrompt = `${document.prompt_used}\n\nCONTEXTE ADDITIONNEL:\n${enrichedContext}\n\nVeuillez régénérer le document complet en tenant compte de ces nouveaux éléments. Gardez le même format de sortie que précédemment.`

      // Appel à l'IA pour régénérer
      let newContent = null
      try {
        const aiRes = await fetch(`${API_URL}/api/ai/regenerate-document`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: enhancedPrompt })
        })
        const aiData = await aiRes.json()
        if (aiData.success) {
            newContent = aiData.content
        }
      } catch (e) {
        console.error('Erreur régénération IA:', e)
      }

      // 5. Mettre à jour avec le contexte et le nouveau contenu
      const updatePayload: any = {
        contextAdded: enrichedContext,
        promptUsed: enhancedPrompt
      }
      
      // Si on a réussi à générer du contenu, on le met à jour
      if (newContent) {
        // Tenter de parser si c'est censé être du JSON (selon le type de doc)
        // Pour l'instant on sauvegarde tel quel, le backend ou l'afficheur gérera
        updatePayload.content = newContent 
      }

      const updateResponse = await fetch(`${API_URL}/api/project-documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      })

      const { document: updatedDoc } = await updateResponse.json()
      
      // 6. Mettre à jour localement
      setProjectDocuments(prev => ({
        ...prev,
        [projectId]: prev[projectId].map(doc => 
          doc.id === documentId ? updatedDoc : doc
        )
      }))

      setNewContext('')
      setShowContextForm(false)
      alert(newContent ? 'Document régénéré avec succès !' : 'Contexte ajouté (Régénération IA échouée, réessayez plus tard)')

    } catch (error) {
      console.error('Error adding context:', error)
      alert('Erreur lors de l\'ajout du contexte')
    }
  }



  const handleGenerateActionPlan = async (project: SavedProject) => {
    if (!user?.id) return
    
    const actionKey = `${project.id}-action-plan`
    setActionLoading(prev => ({ ...prev, [actionKey]: true }))
    setGeneratingActionPlan(true) // Afficher le modal
    
    try {
      // Générer plan d'action de 10 étapes basé sur le projet
      const planSteps = [
        { step: 1, title: 'Étude de marché', description: `Analyser le marché ${project.secteur_selectionne} au Gabon`, status: 'todo' },
        { step: 2, title: 'Validation concept', description: 'Valider la faisabilité technique et financière', status: 'todo' },
        { step: 3, title: 'Business plan', description: 'Élaborer un business plan détaillé', status: 'todo' },
        { step: 4, title: 'Recherche financement', description: `Identifier sources de financement pour ${project.budget_selectionne}`, status: 'todo' },
        { step: 5, title: 'Formalités administratives', description: 'Créer la structure juridique et obtenir les autorisations', status: 'todo' },
        { step: 6, title: 'Partenariats clés', description: 'Établir des partenariats stratégiques', status: 'todo' },
        { step: 7, title: 'Infrastructure', description: 'Mettre en place l\'infrastructure nécessaire', status: 'todo' },
        { step: 8, title: 'Recrutement', description: 'Constituer l\'équipe initiale', status: 'todo' },
        { step: 9, title: 'Test pilote', description: 'Lancer un test pilote du produit/service', status: 'todo' },
        { step: 10, title: 'Lancement officiel', description: 'Lancer officiellement le projet', status: 'todo' }
      ]

      // Sauvegarder dans la BDD
      const response = await fetch(`${API_URL}/api/saved-projects/${project.id}/action-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          planSteps,
          creditsUsed: CREDIT_COSTS['action-plan'] || 25
        })
      })

      const data = await response.json()

      if (data.success) {
        // Rafraîchir la liste des projets
        refreshProjects()

        // Mettre à jour selectedProject si c'est le même
        if (selectedProject?.id === project.id) {
          const updatedProject = {
            ...selectedProject,
            plan_action_steps: planSteps,
            progress_percentage: 0,
            current_phase: 'planning',
            total_credits_used: (selectedProject.total_credits_used || 0) + (CREDIT_COSTS['action-plan'] || 25)
          }
          setSelectedProject(updatedProject as any)
        }

        // Tracker l'action
        await trackProjectAction({
          projectId: project.id,
          userId: user.id,
          actionType: 'action-plan',
          metadata: { steps_count: planSteps.length }
        })

        alert('✅ Plan d\'action généré avec succès !')
      } else {
        throw new Error(data.error || 'Erreur génération')
      }
      
    } catch (error) {
      console.error('Error generating action plan:', error)
      alert('Erreur lors de la génération du plan d\'action')
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }))
      setGeneratingActionPlan(false) // Fermer le modal
    }
  }

  const handleLaunchAction = async (projectId: string, actionId: string, project: SavedProject) => {
    if (!user?.id) return
    
    // Si c'est le business plan, ouvrir le sélecteur de sections
    if (actionId === 'business-plan') {
      setBusinessPlanSelectorOpen(true)
      return
    }
    
    // Si c'est le test de compétences, générer sur place
    if (actionId === 'skill-test') {
      return handleGenerateSkillTest(project)
    }
    
    // Si c'est la formation sur mesure, générer sur place
    if (actionId === 'custom-training') {
      return handleGenerateTraining(project)
    }
    
    const actionKey = `${projectId}-${actionId}`
    setActionLoading(prev => ({ ...prev, [actionKey]: true }))
    
    try {
      // Tracker l'action
      await trackProjectAction({
        projectId,
        userId: user.id,
        actionType: actionId as any,
        metadata: {
          proposition_titre: project.proposition_titre,
          secteur: project.secteur_selectionne,
          budget: project.budget_selectionne
        }
      })

      // Rediriger vers l'analyseur avec les données du projet
      const params = new URLSearchParams({
        projectId: project.id,
        action: actionId,
        secteur: project.secteur_selectionne,
        budget: project.budget_selectionne
      })
      
      router.push(`/business/analyzer?${params.toString()}`)
      
    } catch (error) {
      console.error('Error launching action:', error)
      alert('Erreur lors du lancement de l\'action')
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }))
      setOpenDropdown(null)
    }
  }
  
  // Générer test de compétences sur place
  const handleGenerateSkillTest = async (project: SavedProject, difficulty: 'facile' | 'moyen' | 'difficile' = 'moyen') => {
    if (!user?.id) return
    
    // Ouvrir le modal
    setCurrentActionName('Test de Compétences')
    setCurrentActionIcon(<GraduationCap className="w-6 h-6 text-white" />)
    setAiModalStatus('generating')
    setAiModalProgress(0)
    setAiModalMessage('Analyse de votre projet...')
    setAiModalOpen(true)
    
    setIsGeneratingSkillTest(true)
    
    try {
      // Simulation de progression
      setAiModalProgress(20)
      setAiModalMessage('Extraction des compétences requises...')
      
      const data = await apiCall('/api/skill-test/generate', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          articleId: project.id,
          difficulty,
          proposal: {
            titre: project.proposition_titre,
            description: project.proposition_description,
            secteur: project.secteur_selectionne,
            budget: project.budget_selectionne,
            premiers_investissements: project.proposition_investissement
          },
          userContext: project.user_context || {
            competences: '',
            experience_entrepreneuriale: '',
            disponibilite: ''
          },
          articleContext: {
            title: project.article_title,
            problematique: project.problematique_centrale
          },
          cumulativeContext: {
            article: {
              title: project.article_title,
              summary: project.article_summary,
              problematique: project.problematique_centrale
            },
            proposal: {
              titre: project.proposition_titre,
              description: project.proposition_description,
              secteur: project.secteur_selectionne,
              budget: project.budget_selectionne
            },
            userProfile: project.user_context,
            previousActions: projectActions[project.id] || [],
            relatedArticles: project.related_articles || [],
            businessPlanSections: projectDocuments[project.id]?.filter(d => d.document_type === 'business_plan').length || 0
          }
        }),
        timeout: 60000, // 60 secondes pour génération IA
        retries: 1
      })
      
      setAiModalProgress(60)
      setAiModalMessage('Génération des questions...')
      
      if (!data.success || !data.test) {
        throw new Error('Données de test invalides')
      }
      
      setCurrentSkillTest(data.test)
      
      setAiModalProgress(80)
      setAiModalMessage('Sauvegarde du test...')
      
      // Sauvegarder le test dans Documents générés
      let documentId = null
      if (data.test && data.testId) {
        documentId = await saveSkillTestToDocuments(data.test, data.testId, project.id, project)
      }
      
      setAiModalProgress(90)
      setAiModalMessage('Enregistrement de l\'action...')
      
      // Tracker l'action avec le documentId
      if (documentId) {
        console.log('📝 Tracking action skill-test avec documentId:', documentId)
        await trackProjectAction({
          projectId: project.id,
          userId: user.id,
          actionType: 'skill-test' as any,
          actionReferenceId: documentId
        })
        await fetchProjectActions(project.id)
      }
      
      setAiModalProgress(100)
      setAiModalStatus('success')
      setAiModalMessage('Test de compétences généré avec succès !')
      
      // Fermer modal IA et ouvrir modal test après 1s
      setTimeout(() => {
        setAiModalOpen(false)
        setSkillTestModalOpen(true)
        setStartTime(Date.now())
      }, 1000)
      
    } catch (error: any) {
      console.error('Erreur génération test:', error)
      setAiModalStatus('error')
      setAiModalError(error.message || 'Erreur lors de la génération du test de compétences')
    } finally {
      setIsGeneratingSkillTest(false)
    }
  }
  
  // Générer formation sur mesure sur place
  const handleGenerateTraining = async (project: SavedProject) => {
    if (!user?.id) return
    
    // Ouvrir le modal
    setCurrentActionName('Formation Personnalisée')
    setCurrentActionIcon(<Rocket className="w-6 h-6 text-white" />)
    setAiModalStatus('generating')
    setAiModalProgress(0)
    setAiModalMessage('Analyse de votre profil...')
    setAiModalOpen(true)
    
    setIsGeneratingTraining(true)
    setGeneratedTraining(null)
    
    try {
      setAiModalProgress(15)
      setAiModalMessage('Identification des compétences à développer...')
      
      const data = await apiCall('/api/training/generate', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          articleId: project.id,
          userAnalysis: {
            budget: project.budget_selectionne,
            currentSkills: '',
            launchDeadline: ''
          },
          article: {
            title: project.article_title,
            summary: project.article_summary,
            source: project.article_source,
            url: project.article_url
          },
          sectorResults: {
            selectedPropositions: [project.proposition_titre],
            localInsights: project.problematique_centrale
          }
        }),
        timeout: 60000, // 60 secondes pour génération IA
        retries: 1 // 1 retry pour génération IA
      })
      
      setAiModalProgress(50)
      setAiModalMessage('Création du parcours de formation...')
      setGeneratedTraining(data.training)
      setGeneratedTrainingId(data.trainingId)
      
      setAiModalProgress(80)
      setAiModalMessage('Sauvegarde de la formation...')
      
      // Sauvegarder dans Documents générés
      let documentId = null
      if (data.training && data.trainingId) {
        documentId = await saveTrainingSummaryToDocuments(data.training, data.trainingId, project.id, project)
      }
      
      setAiModalProgress(90)
      setAiModalMessage('Enregistrement de l\'action...')
      
      // Tracker l'action avec le documentId
      if (documentId) {
        console.log('📝 Tracking action custom-training avec documentId:', documentId)
        await trackProjectAction({
          projectId: project.id,
          userId: user.id,
          actionType: 'custom-training' as any,
          actionReferenceId: documentId
        })
        await fetchProjectActions(project.id)
      }
      
      setAiModalProgress(100)
      setAiModalStatus('success')
      setAiModalMessage('Formation personnalisée générée avec succès !')
      setIsTrainingModalOpen(true)
      
      // Fermer automatiquement après 2s
      setTimeout(() => {
        setAiModalOpen(false)
      }, 2000)
      
    } catch (error: any) {
      console.error('Erreur génération formation:', error)
      setAiModalStatus('error')
      setAiModalError(error.message || 'Erreur lors de la génération de la formation')
    } finally {
      setIsGeneratingTraining(false)
    }
  }
  
  // Fonction pour régénérer le test avec une nouvelle difficulté
  const handleRegenerateTest = async (difficulty: 'facile' | 'moyen' | 'difficile') => {
    if (!selectedProject) return
    await handleGenerateSkillTest(selectedProject, difficulty)
  }

  // Générer un courrier professionnel
  const handleGenerateLetter = (project: SavedProject) => {
    if (!user?.id) return
    setGenerateLetterModalOpen(true)
  }

  // Callback après succès de génération de courrier
  const handleLetterSuccess = async (letter: any) => {
    console.log('✅ Courrier généré:', letter)
    
    // Rafraîchir les documents et actions du projet
    if (selectedProject) {
      await hookFetchDocuments(selectedProject.id)
    }
    
    // Afficher notification de succès
    alert('✅ Courrier généré avec succès et ajouté à votre bibliothèque !')
  }

  // Fonction pour rendre le contenu selon la section active
  const renderSectionContent = () => {
    if (!selectedProject) return null

    switch (activeSection) {
      case 'dashboard':
        return (
          <ProjectDashboard
            project={selectedProject}
            actions={projectActions[selectedProject.id] || []}
            documents={projectDocuments[selectedProject.id] || []}
            timeline={projectTimeline[selectedProject.id] || []}
            notes={projectNotes[selectedProject.id] || []}
          />
        )
      
      case 'overview':
        return renderOverviewSection()
      
      case 'plan-action':
        return renderActionPlanSection()
      
      case 'actions':
        return renderActionsSection()
      
      case 'contexte':
        return renderContexteBibliothequeSection()
      
      case 'conseiller':
        return renderConseillerSection()
      
      case 'collaboration':
        return selectedProject ? <CollaborationSection selectedProject={selectedProject} user={user} /> : null
      
      default:
        return null
    }
  }

  // Sections individuelles
  const renderOverviewSection = () => {
    if (!selectedProject) return null

    return (
      <div className="space-y-6">
        {/* Header du projet */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl sm:rounded-2xl p-4 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-4">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 break-words">
                {selectedProject.proposition_titre}
              </h1>
              <p className="text-white/90 text-base sm:text-lg break-words">
                {selectedProject.proposition_description}
              </p>
            </div>
            <div className="text-right sm:ml-4 flex-shrink-0">
              <div className={`text-3xl sm:text-4xl font-bold ${
                selectedProject.proposition_score_faisabilite >= 80 ? 'text-green-400' :
                selectedProject.proposition_score_faisabilite >= 60 ? 'text-yellow-400' :
                'text-orange-400'
              }`}>
                {selectedProject.proposition_score_faisabilite}%
              </div>
              <div className="text-sm text-white/80">Faisabilité</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-xs text-white/70 mb-1">Secteur</div>
              <div className="text-white font-semibold">{selectedProject.secteur_selectionne}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-xs text-white/70 mb-1">Budget</div>
              <div className="text-white font-semibold">{selectedProject.budget_selectionne}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <div className="text-xs text-white/70 mb-1">Phase</div>
              <div className="text-white font-semibold capitalize">{selectedProject.current_phase || 'Idée'}</div>
            </div>
          </div>
        </motion.div>

        {/* Description du projet */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-400" />
            Description du Projet
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {selectedProject.proposition_description || 'Aucune description disponible pour ce projet.'}
          </p>
        </motion.div>

        {/* Problématique centrale */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-400" />
            Problématique Centrale
          </h2>
          <p className="text-gray-300 leading-relaxed">
            {selectedProject.problematique_centrale}
          </p>
        </motion.div>

        {/* Actions immédiates */}
        {selectedProject.proposition_actions_immediates && selectedProject.proposition_actions_immediates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Rocket className="w-6 h-6 text-orange-400" />
              Actions Immédiates Recommandées
            </h2>
            <div className="space-y-3">
              {selectedProject.proposition_actions_immediates.map((action: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-400 font-bold">{idx + 1}</span>
                  </div>
                  <p className="text-gray-300 flex-1">{action}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Avantages concurrentiels */}
        {selectedProject.proposition_avantages_concurrentiels && selectedProject.proposition_avantages_concurrentiels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
          >
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-400" />
              Avantages Concurrentiels
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedProject.proposition_avantages_concurrentiels.map((avantage: string, idx: number) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20"
                >
                  <CheckCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-300 text-sm">{avantage}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Article source */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl p-6 border border-blue-500/20"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ExternalLink className="w-6 h-6 text-blue-400" />
            Article Source
          </h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-400 mb-1">Titre</div>
              <div className="text-white font-medium">{selectedProject.article_title}</div>
            </div>
            <div>
              <div className="text-sm text-gray-400 mb-1">Résumé</div>
              <p className="text-gray-300 text-sm">{selectedProject.article_summary}</p>
            </div>
            {selectedProject.article_url ? (
              <a
                href={selectedProject.article_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Voir l'article original
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500/20 text-gray-500 rounded-lg cursor-not-allowed">
                <ExternalLink className="w-4 h-4" />
                Article source non disponible
              </span>
            )}
          </div>
        </motion.div>

        {/* Contexte Utilisateur */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-7 h-7 text-green-400" />
            Contexte Utilisateur
          </h2>

          {/* Grille d'informations contexte */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Situation */}
            {selectedProject.user_context?.situation && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Situation</h3>
                    <p className="text-white font-medium">{selectedProject.user_context.situation}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Disponibilité */}
            {selectedProject.user_context?.disponibilite && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Disponibilité</h3>
                    <p className="text-white font-medium">{selectedProject.user_context.disponibilite}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Expérience */}
            {selectedProject.user_context?.experience_entrepreneuriale && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Expérience Entrepreneuriale</h3>
                    <p className="text-white font-medium">{selectedProject.user_context.experience_entrepreneuriale}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Objectif délai */}
            {selectedProject.user_context?.objectif_delai && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-400 mb-1">Objectif de Lancement</h3>
                    <p className="text-white font-medium">{selectedProject.user_context.objectif_delai}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Compétences */}
          {selectedProject.user_context?.competences && selectedProject.user_context.competences.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-green-400" />
                Compétences
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedProject.user_context.competences.map((comp: string, idx: number) => (
                  <span
                    key={idx}
                    className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30"
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contraintes */}
          {selectedProject.user_context?.contraintes && (
            <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">Contraintes</h3>
                  <p className="text-white font-medium">{selectedProject.user_context.contraintes}</p>
                </div>
              </div>
            </div>
          )}

          {/* Budget */}
          <div className="mt-6 bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-400 mb-1">Budget de Démarrage</h3>
                <p className="text-white font-medium text-lg">
                  {selectedProject.budget_selectionne && selectedProject.budget_selectionne !== 'Non spécifié' 
                    ? selectedProject.budget_selectionne 
                    : <span className="text-gray-500 italic">Non spécifié</span>}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }
  const renderContextSection = () => {
    if (!selectedProject) return null

    const context = selectedProject.user_context || {}

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Contexte Utilisateur</h1>
          <p className="text-white/90">
            Vos compétences, situation et disponibilité pour ce projet
          </p>
        </motion.div>

        {/* Grille d'informations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Situation */}
          {context.situation && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">Situation</h3>
                  <p className="text-white font-medium">{context.situation}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Disponibilité */}
          {context.disponibilite && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">Disponibilité</h3>
                  <p className="text-white font-medium">{context.disponibilite}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Expérience */}
          {context.experience_entrepreneuriale && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">Expérience Entrepreneuriale</h3>
                  <p className="text-white font-medium">{context.experience_entrepreneuriale}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Objectif délai */}
          {context.objectif_delai && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-400 mb-1">Objectif de Lancement</h3>
                  <p className="text-white font-medium">{context.objectif_delai}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Compétences */}
        {context.competences && context.competences.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                <Star className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Compétences</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {context.competences.map((comp: string, idx: number) => (
                <span
                  key={idx}
                  className="px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30"
                >
                  {comp}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Contraintes */}
        {context.contraintes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-red-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-400 mb-1">Contraintes</h3>
                <p className="text-white font-medium">{context.contraintes}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Budget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-400 mb-1">Budget de Démarrage</h3>
              <p className="text-white font-medium text-lg">
                {selectedProject.budget_selectionne && selectedProject.budget_selectionne !== 'Non spécifié' 
                  ? selectedProject.budget_selectionne 
                  : <span className="text-gray-500 italic">Non spécifié</span>}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Message si pas de contexte */}
        {!context.situation && !context.disponibilite && !context.competences && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <User className="w-16 h-16 text-green-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Contexte non renseigné</h3>
            <p className="text-gray-400">
              Les informations de contexte utilisateur n'ont pas été collectées pour ce projet
            </p>
          </motion.div>
        )}
      </div>
    )
  }
  
  const renderActionPlanSection = () => {
    if (!selectedProject) return null

    return (
      <ActionPlanGenerator
        projectData={{
          titre: selectedProject.proposition_titre,
          secteur: selectedProject.secteur_selectionne,
          budget: selectedProject.budget_selectionne,
          description: selectedProject.proposition_description,
          projectId: selectedProject.id,
          userId: user?.id || '',
          contexte: selectedProject.proposition_description || '',
          problematique: selectedProject.proposition_problematique || '',
          article: `${selectedProject.article_title}\n\n${selectedProject.article_summary}` 
        }}
      />
    )
  }

  const renderActionsSection = () => {
    if (!selectedProject) return null

    const projectActionsData = projectActions[selectedProject.id] || []
    const completedActions = projectActionsData.filter(a => a.action_status === 'completed').length

    return (
      <div className="space-y-6 relative">
        {/* Arrière-plan avec dégradé bleu-violet */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-50 rounded-3xl -z-10"></div>
        
        {/* Header - Design Moderne avec dégradé */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 shadow-lg"
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Actions IA Disponibles</h1>
              <p className="text-blue-50 text-lg">
                Générez du contenu professionnel avec l'intelligence artificielle
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{completedActions}</div>
                <div className="text-blue-100 mt-1">Complétées</div>
              </div>
              <div className="w-px h-12 bg-white/30"></div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{projectActionsData.length}</div>
                <div className="text-blue-100 mt-1">Lancées</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Actions Grid avec cartes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {QUICK_ACTIONS.map((action, idx) => {
            const Icon = action.icon
            const actionCount = projectActionsData.filter(a => a.action_type === action.id).length
            const hasCompleted = projectActionsData.some(a => a.action_type === action.id && a.action_status === 'completed')

            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all border border-gray-100 group relative overflow-hidden"
              >
                {/* Dégradé bleu-violet en arrière-plan au hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-indigo-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-indigo-500/5 transition-all duration-500 rounded-2xl"></div>
                
                <div className="relative z-10">
                  {/* Header avec icône et badge */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    {hasCompleted && (
                      <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-xs font-semibold text-green-700">Complété</span>
                      </div>
                    )}
                  </div>

                  {/* Titre et description */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{action.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4 min-h-[40px]">
                    {action.description}
                  </p>

                  {/* Métadonnées */}
                  <div className="flex items-center gap-3 mb-5 pb-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{action.credits} crédits</span>
                    </div>
                    {actionCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full font-medium">
                        <span>Utilisé {actionCount}×</span>
                      </div>
                    )}
                  </div>

                  {/* Bouton d'action */}
                  <button
                    onClick={() => {
                      if (action.id === 'business-plan') {
                        setBusinessPlanSelectorOpen(true)
                      } else if (action.id === 'generate-letter') {
                        handleGenerateLetter(selectedProject)
                      } else if (action.id === 'skill-test') {
                        handleGenerateSkillTest(selectedProject)
                      } else if (action.id === 'custom-training') {
                        handleGenerateTraining(selectedProject)
                      }
                    }}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                  >
                    <span>Lancer l'action</span>
                    <ArrowLeft className="w-4 h-4 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Historique des actions */}
        {projectActionsData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Historique des Actions
            </h2>

            <div className="space-y-2">
              {projectActionsData.slice(0, 10).map((action: any) => (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {action.action_status === 'completed' ? (
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                    ) : action.action_status === 'in_progress' ? (
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <div className="text-gray-900 font-medium text-sm">
                        {getActionLabel(action.action_type)}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(action.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {action.action_reference_id && (
                      <button
                        onClick={() => {
                          // Ouvrir le document/résultat
                          if (action.action_type === 'business-plan') {
                            const doc = projectDocuments[selectedProject.id]?.find(
                              d => d.id === action.action_reference_id
                            )
                            if (doc) setSelectedDocument(doc)
                          }
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline"
                      >
                        Voir résultat
                      </button>
                    )}
                    <div className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      action.action_status === 'completed' 
                        ? 'bg-green-100 text-green-700' 
                        : action.action_status === 'in_progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {action.action_status === 'completed' ? 'Terminé' : 
                       action.action_status === 'in_progress' ? 'En cours' : 'Créé'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {projectActionsData.length > 10 && (
              <div className="mt-4 text-center">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium hover:underline">
                  Voir toutes les actions ({projectActionsData.length})
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Message si aucune action */}
        {projectActionsData.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-50 rounded-xl p-12 border border-gray-200 text-center"
          >
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucune action lancée</h3>
            <p className="text-gray-600">
              Commencez par générer du contenu avec l'une des actions ci-dessus
            </p>
          </motion.div>
        )}
      </div>
    )
  }
  const renderContexteBibliothequeSection = () => {
    if (!selectedProject) return null

    const projectDocs = projectDocuments[selectedProject.id] || []
    const testScores = skillTestScores[selectedProject.id] || []
    
    // Convertir les scores de tests en format document pour l'affichage
    const testDocs = testScores.map(score => ({
      id: score.id,
      project_id: selectedProject.id,
      document_type: 'skill-test',
      title: `Test de compétences - ${score.difficulty || 'Moyen'}`,
      content: `Score: ${score.score}% - ${score.questions_correct}/${score.questions_total} questions correctes`,
      metadata: {
        score: score.score,
        difficulty: score.difficulty,
        questionCount: score.questions_total,
        correctAnswers: score.questions_correct,
        timeSpent: score.time_spent
      },
      created_at: score.created_at
    }))
    
    // Combiner documents et tests
    const allDocs = [...projectDocs, ...testDocs]
    const notes = projectNotes[selectedProject.id] || []
    const timeline = projectTimeline[selectedProject.id] || []

    // Calculer contexte cumulé
    const contexteTotal = {
      documents: allDocs.length,
      notes: notes.length,
      evenements: timeline.length,
      mots: notes.reduce((acc, note) => acc + (note.note_content?.split(' ').length || 0), 0) +
            allDocs.reduce((acc, doc) => acc + (doc.content?.split(' ').length || 0), 0)
    }

    // Filtrer par type
    const filteredDocs = bibliothequeFilter === 'all' 
      ? allDocs 
      : allDocs.filter(d => {
          if (bibliothequeFilter === 'business-plan') return d.document_type === 'business-plan-section'
          if (bibliothequeFilter === 'formation') return d.document_type === 'custom-training'
          if (bibliothequeFilter === 'test') return d.document_type === 'skill-test'
          if (bibliothequeFilter === 'conversation') return d.document_type === 'conversation-ai'
          return d.document_type === bibliothequeFilter
        })

    const filters = [
      { id: 'all', label: 'Tous', count: allDocs.length },
      { id: 'business-plan', label: 'Business Plan', count: allDocs.filter(d => d.document_type === 'business-plan-section').length },
      { id: 'formation', label: 'Formations', count: allDocs.filter(d => d.document_type === 'custom-training').length },
      { id: 'test', label: 'Tests', count: allDocs.filter(d => d.document_type === 'skill-test').length },
      { id: 'conversation', label: 'Conversations', count: allDocs.filter(d => d.document_type === 'conversation-ai').length }
    ]

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl sm:rounded-2xl p-4 sm:p-6"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Contexte & Bibliothèque</h1>
          <p className="text-white/90">
            Contexte cumulé utilisable pour toutes les actions IA du projet
          </p>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-white/80 text-sm">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold">{contexteTotal.documents}</div>
              <div className="text-xs">Documents</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold">{contexteTotal.notes}</div>
              <div className="text-xs">Notes</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold">{contexteTotal.evenements}</div>
              <div className="text-xs">Événements</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-2xl font-bold">{Math.round(contexteTotal.mots / 1000)}k</div>
              <div className="text-xs">Mots</div>
            </div>
          </div>
        </motion.div>

        {/* Tabs Navigation */}
        <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
          <button
            onClick={() => setContexteActiveTab('contexte')}
            className={`px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap ${
              contexteActiveTab === 'contexte'
                ? 'text-orange-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Database className="w-5 h-5 inline mr-2" />
            Contexte Global
            {contexteActiveTab === 'contexte' && (
              <motion.div
                layoutId="contexteTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400"
              />
            )}
          </button>
          <button
            onClick={() => setContexteActiveTab('documents')}
            className={`px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap ${
              contexteActiveTab === 'documents'
                ? 'text-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-5 h-5 inline mr-2" />
            Documents ({allDocs.length})
            {contexteActiveTab === 'documents' && (
              <motion.div
                layoutId="contexteTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400"
              />
            )}
          </button>
          <button
            onClick={() => setContexteActiveTab('notes')}
            className={`px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap ${
              contexteActiveTab === 'notes'
                ? 'text-pink-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <StickyNote className="w-5 h-5 inline mr-2" />
            Notes ({notes.length})
            {contexteActiveTab === 'notes' && (
              <motion.div
                layoutId="contexteTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400"
              />
            )}
          </button>
          <button
            onClick={() => setContexteActiveTab('timeline')}
            className={`px-4 sm:px-6 py-3 font-medium transition-all relative whitespace-nowrap ${
              contexteActiveTab === 'timeline'
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5 inline mr-2" />
            Timeline ({timeline.length})
            {contexteActiveTab === 'timeline' && (
              <motion.div
                layoutId="contexteTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400"
              />
            )}
          </button>
        </div>

        {/* Contenu selon tab actif */}
        {contexteActiveTab === 'contexte' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-8 h-8 text-orange-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Contexte Cumulé du Projet</h2>
                <p className="text-gray-400 text-sm">Toutes les informations disponibles pour alimenter l'IA</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Résumé projet */}
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-400" />
                  Informations du Projet
                </h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>Titre:</strong> {selectedProject.proposition_titre}</p>
                  <p><strong>Secteur:</strong> {selectedProject.secteur_selectionne}</p>
                  <p><strong>Budget:</strong> {selectedProject.budget_selectionne}</p>
                  {selectedProject.proposition_description && (
                    <p><strong>Description:</strong> {selectedProject.proposition_description}</p>
                  )}
                </div>
              </div>

              {/* Documents disponibles */}
              {allDocs.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Documents Générés ({allDocs.length})
                  </h3>
                  <div className="space-y-2">
                    {allDocs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-300">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span>{doc.title}</span>
                        <span className="text-xs text-gray-500">({getActionLabel(doc.document_type)})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes disponibles */}
              {notes.length > 0 && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-pink-400" />
                    Notes Personnelles ({notes.length})
                  </h3>
                  <div className="space-y-2">
                    {notes.slice(0, 5).map(note => (
                      <div key={note.id} className="text-sm text-gray-300 bg-white/5 rounded p-2">
                        {note.note_content.substring(0, 100)}{note.note_content.length > 100 ? '...' : ''}
                      </div>
                    ))}
                    {notes.length > 5 && (
                      <p className="text-xs text-gray-500">+ {notes.length - 5} autres notes</p>
                    )}
                  </div>
                </div>
              )}

              {/* Statistiques */}
              <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-4 border border-orange-500/30">
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-400" />
                  Utilisation pour Actions IA
                </h3>
                <p className="text-gray-300 text-sm mb-3">
                  Ce contexte cumulé sera automatiquement utilisé pour améliorer la qualité et la pertinence de toutes les actions IA futures du projet.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-orange-400 font-bold">{contexteTotal.mots.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">Mots disponibles</div>
                  </div>
                  <div className="bg-white/10 rounded p-2">
                    <div className="text-orange-400 font-bold">{contexteTotal.documents + contexteTotal.notes}</div>
                    <div className="text-xs text-gray-400">Sources de données</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {contexteActiveTab === 'documents' && (
          <>
            {/* Filtres */}
            <div className="flex flex-wrap gap-2">
              {filters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setBibliothequeFilter(filter.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    bibliothequeFilter === filter.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            {/* Liste des documents */}
        {filteredDocs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDocs.map((doc, idx) => {
              const docType = (doc as any).document_type || (doc as any).type || 'default'
              const docIcon = getDocumentIcon(docType)
              const colorClass = getDocumentColor(docType)

              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10 hover:border-orange-500/30 transition-all cursor-pointer"
                  onClick={() => setSelectedDocument(doc as any)}
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-2xl">{docIcon}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1 line-clamp-2">{doc.title}</h3>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <ExternalLink className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </div>

                  {doc.content && (
                    <p className="text-gray-300 text-sm line-clamp-2 mb-3">
                      {doc.content.substring(0, 150)}...
                    </p>
                  )}

                  {doc.metadata && (
                    <div className="flex flex-wrap gap-2">
                      {(doc.metadata as any).moduleCount && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                          {(doc.metadata as any).moduleCount} modules
                        </span>
                      )}
                      {(doc.metadata as any).questionCount && (
                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                          {(doc.metadata as any).questionCount} questions
                        </span>
                      )}
                      {(doc.metadata as any).sectionNumber && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Section {(doc.metadata as any).sectionNumber}
                        </span>
                      )}
                      {(doc.metadata as any).score !== undefined && (
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          (doc.metadata as any).score >= 80 ? 'bg-green-500/20 text-green-400' :
                          (doc.metadata as any).score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {(doc.metadata as any).score}%
                        </span>
                      )}
                      {(doc.metadata as any).difficulty && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          (doc.metadata as any).difficulty === 'facile' ? 'bg-green-500/20 text-green-400' :
                          (doc.metadata as any).difficulty === 'moyen' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {(doc.metadata as any).difficulty.charAt(0).toUpperCase() + (doc.metadata as any).difficulty.slice(1)}
                        </span>
                      )}
                      {(doc.metadata as any).timeSpent && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                          ⏱️ {Math.floor((doc.metadata as any).timeSpent / 60)}min {(doc.metadata as any).timeSpent % 60}s
                        </span>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <FileText className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun document</h3>
            <p className="text-gray-400">
              Générez du contenu depuis l'onglet Actions IA
            </p>
          </motion.div>
        )}
          </>
        )}

        {contexteActiveTab === 'notes' && (
          <div className="space-y-4">
            {/* Formulaire ajout note */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ajouter une note personnelle..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors resize-none"
                rows={3}
              />
              <button
                onClick={() => handleAddNote(selectedProject.id)}
                disabled={!newNote.trim() || isAddingNote}
                className="mt-3 px-6 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingNote ? 'Ajout...' : 'Ajouter la note'}
              </button>
            </div>

            {/* Liste notes */}
            {notes.length > 0 ? (
              notes.map((note: any, idx: number) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
                >
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white resize-none mb-3"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateNote(selectedProject.id, note.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Sauvegarder
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-gray-300 flex-1">{note.note_content}</p>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id)
                              setEditingNoteContent(note.note_content)
                            }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(selectedProject.id, note.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(note.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center">
                <StickyNote className="w-16 h-16 text-pink-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-white mb-2">Aucune note</h3>
                <p className="text-gray-400">
                  Ajoutez des notes pour enrichir le contexte du projet
                </p>
              </div>
            )}
          </div>
        )}

        {contexteActiveTab === 'timeline' && (
          timeline.length > 0 ? (
            <div className="space-y-4">
              {timeline.map((event: any, idx: number) => {
                // Fonction pour obtenir l'icône et la couleur selon le type d'événement
                const getEventInfo = (type: string) => {
                  const eventTypes: Record<string, { icon: any, color: string, bgColor: string, title: string }> = {
                    'project_created': { 
                      icon: Rocket, 
                      color: 'text-green-400', 
                      bgColor: 'bg-green-500/20',
                      title: '🎉 Projet Créé'
                    },
                    'action_generated': { 
                      icon: Zap, 
                      color: 'text-yellow-400', 
                      bgColor: 'bg-yellow-500/20',
                      title: '⚡ Action IA Générée'
                    },
                    'document_created': { 
                      icon: FileText, 
                      color: 'text-blue-400', 
                      bgColor: 'bg-blue-500/20',
                      title: '📄 Document Créé'
                    },
                    'note_added': { 
                      icon: StickyNote, 
                      color: 'text-pink-400', 
                      bgColor: 'bg-pink-500/20',
                      title: '📝 Note Ajoutée'
                    },
                    'status_updated': { 
                      icon: TrendingUp, 
                      color: 'text-purple-400', 
                      bgColor: 'bg-purple-500/20',
                      title: '📊 Statut Mis à Jour'
                    },
                    'test_completed': { 
                      icon: Award, 
                      color: 'text-orange-400', 
                      bgColor: 'bg-orange-500/20',
                      title: '🏆 Test Complété'
                    },
                    'training_started': { 
                      icon: GraduationCap, 
                      color: 'text-cyan-400', 
                      bgColor: 'bg-cyan-500/20',
                      title: '🎓 Formation Démarrée'
                    },
                    'business_plan_generated': { 
                      icon: Briefcase, 
                      color: 'text-emerald-400', 
                      bgColor: 'bg-emerald-500/20',
                      title: '💼 Business Plan Généré'
                    },
                    'conversation_completed': { 
                      icon: MessageSquare, 
                      color: 'text-violet-400', 
                      bgColor: 'bg-violet-500/20',
                      title: '💬 Conversation Gabon Insight'
                    }
                  }
                  return eventTypes[type] || { 
                    icon: Clock, 
                    color: 'text-indigo-400', 
                    bgColor: 'bg-indigo-500/20',
                    title: '⏱️ Événement'
                  }
                }

                const eventInfo = getEventInfo(event.event_type)
                const EventIcon = eventInfo.icon

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl ${eventInfo.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <EventIcon className={`w-6 h-6 ${eventInfo.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-white font-bold text-lg">{eventInfo.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventInfo.bgColor} ${eventInfo.color}`}>
                            {event.event_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                          {event.event_description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {new Date(event.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })} à {new Date(event.created_at).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center">
              <Clock className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-white mb-2">Aucun historique</h3>
              <p className="text-gray-400">
                L'historique de vos actions apparaîtra ici
              </p>
            </div>
          )
        )}
      </div>
    )
  }

  const renderFormationSection = () => {
    if (!selectedProject) return null

    const formations = projectDocuments[selectedProject.id]?.filter(d => d.document_type === 'custom-training') || []

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl sm:rounded-2xl p-4 sm:p-6"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Formations Personnalisées</h1>
          <p className="text-white/90">
            Parcours de formation adaptés à votre projet
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/80 text-sm">
            <span>{formations.length} formation{formations.length > 1 ? 's' : ''}</span>
          </div>
        </motion.div>

        {/* Liste des formations */}
        {formations.length > 0 ? (
          <div className="space-y-4">
            {formations.map((formation, idx) => (
              <motion.div
                key={formation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10 hover:border-blue-500/30 transition-all cursor-pointer"
                onClick={() => setSelectedDocument(formation)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <GraduationCap className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">{formation.title}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(formation.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                {formation.content && (
                  <p className="text-gray-300 text-sm line-clamp-3 mb-4">
                    {formation.content.substring(0, 200)}...
                  </p>
                )}

                {formation.metadata && (
                  <div className="flex flex-wrap gap-2">
                    {formation.metadata.moduleCount && (
                      <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                        {formation.metadata.moduleCount} modules
                      </span>
                    )}
                    {formation.metadata.totalDuration && (
                      <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-xs font-medium">
                        {formation.metadata.totalDuration}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <GraduationCap className="w-16 h-16 text-blue-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucune formation</h3>
            <p className="text-gray-400">
              Générez une formation personnalisée depuis l'onglet Actions IA
            </p>
          </motion.div>
        )}
      </div>
    )
  }

  const renderTestCompetencesSection = () => {
    if (!selectedProject) return null

    const tests = projectDocuments[selectedProject.id]?.filter(d => d.document_type === 'skill-test') || []

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl sm:rounded-2xl p-4 sm:p-6"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Tests de Compétences</h1>
          <p className="text-white/90">
            Évaluations de vos compétences pour ce projet
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/80 text-sm">
            <span>{tests.length} test{tests.length > 1 ? 's' : ''}</span>
          </div>
        </motion.div>

        {/* Liste des tests */}
        {tests.length > 0 ? (
          <div className="space-y-4">
            {tests.map((test, idx) => (
              <motion.div
                key={test.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer"
                onClick={() => setSelectedDocument(test)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0">
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-1">{test.title}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(test.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>

                {test.content && (
                  <p className="text-gray-300 text-sm line-clamp-3 mb-4">
                    {test.content.substring(0, 200)}...
                  </p>
                )}

                {test.metadata && (
                  <div className="flex flex-wrap gap-2">
                    {test.metadata.score && (
                      <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                        Score: {test.metadata.score}%
                      </span>
                    )}
                    {test.metadata.difficulty && (
                      <span className="px-3 py-1 bg-violet-500/20 text-violet-400 rounded-full text-xs font-medium">
                        {test.metadata.difficulty}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <Award className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun test</h3>
            <p className="text-gray-400">
              Générez un test de compétences depuis l'onglet Actions IA
            </p>
          </motion.div>
        )}
      </div>
    )
  }

  const renderDocumentsSection = () => {
    if (!selectedProject) return null

    const projectDocs = projectDocuments[selectedProject.id] || []
    const docsByType = projectDocs.reduce((acc: any, doc: any) => {
      const type = doc.document_type || 'other'
      if (!acc[type]) acc[type] = []
      acc[type].push(doc)
      return acc
    }, {})

    const getDocumentTypeInfo = (type: string) => {
      const types: any = {
        'business-plan-section': { name: 'Business Plan', icon: FileText, color: 'from-green-500 to-emerald-600' },
        'etude-marche': { name: 'Étude de Marché', icon: TrendingUp, color: 'from-blue-500 to-cyan-600' },
        'faisabilite': { name: 'Faisabilité', icon: Target, color: 'from-purple-500 to-violet-600' },
        'formation': { name: 'Formation', icon: GraduationCap, color: 'from-orange-500 to-red-600' },
        'skill-test': { name: 'Test de Compétences', icon: Award, color: 'from-yellow-500 to-orange-600' },
        'other': { name: 'Autre', icon: FileText, color: 'from-gray-500 to-gray-600' }
      }
      return types[type] || types.other
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Documents Générés</h1>
          <p className="text-white/90">
            Tous les documents créés par l'IA pour votre projet
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/80 text-sm">
            <span>{projectDocs.length} document{projectDocs.length > 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{Object.keys(docsByType).length} type{Object.keys(docsByType).length > 1 ? 's' : ''}</span>
          </div>
        </motion.div>

        {/* Documents par type */}
        {Object.keys(docsByType).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(docsByType).map(([type, docs]: [string, any], idx) => {
              const typeInfo = getDocumentTypeInfo(type)
              const Icon = typeInfo.icon

              return (
                <motion.div
                  key={type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-white/10"
                >
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${typeInfo.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {typeInfo.name}
                    <span className="text-sm text-gray-400 ml-2">({docs.length})</span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {docs.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
                        onClick={() => setSelectedDocument(doc)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-white font-medium line-clamp-2 flex-1">
                            {doc.title || 'Document sans titre'}
                          </h3>
                          <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                        </div>
                        
                        {doc.content && (
                          <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                            {doc.content.substring(0, 100)}...
                          </p>
                        )}

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          </span>
                          {doc.content && (
                            <span>{Math.ceil(doc.content.length / 500)} min de lecture</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <FileText className="w-16 h-16 text-orange-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun document</h3>
            <p className="text-gray-400 mb-6">
              Générez du contenu avec les actions IA pour créer vos premiers documents
            </p>
            <button
              onClick={() => setActiveSection('actions')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all"
            >
              <Zap className="w-5 h-5" />
              Voir les actions IA
            </button>
          </motion.div>
        )}
      </div>
    )
  }
  const renderJournalSection = () => {
    if (!selectedProject) return null

    const timeline = projectTimeline[selectedProject.id] || []
    const notes = projectNotes[selectedProject.id] || []
    const [activeTab, setActiveTab] = useState<'timeline' | 'notes'>('timeline')

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl sm:rounded-2xl p-4 sm:p-6"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Journal du Projet</h1>
          <p className="text-white/90">
            Historique automatique et notes personnelles
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/80 text-sm">
            <span>{timeline.length} événements</span>
            <span>•</span>
            <span>{notes.length} notes</span>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-6 py-3 font-medium transition-all relative ${
              activeTab === 'timeline'
                ? 'text-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-5 h-5 inline mr-2" />
            Timeline ({timeline.length})
            {activeTab === 'timeline' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-6 py-3 font-medium transition-all relative ${
              activeTab === 'notes'
                ? 'text-pink-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <StickyNote className="w-5 h-5 inline mr-2" />
            Notes ({notes.length})
            {activeTab === 'notes' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-400"
              />
            )}
          </button>
        </div>

        {/* Contenu selon tab */}
        {activeTab === 'timeline' ? (
          timeline.length > 0 ? (
            <div className="space-y-4">
              {timeline.map((event: any, idx: number) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-semibold mb-1">{event.event_type}</h3>
                      <p className="text-gray-300 text-sm mb-2">{event.event_description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center">
              <Clock className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-white mb-2">Aucun historique</h3>
              <p className="text-gray-400">
                L'historique de vos actions apparaîtra ici
              </p>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {/* Formulaire ajout note */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ajouter une note personnelle..."
                className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors resize-none"
                rows={3}
              />
              <button
                onClick={() => handleAddNote(selectedProject.id)}
                disabled={!newNote.trim() || isAddingNote}
                className="mt-3 px-6 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingNote ? 'Ajout...' : 'Ajouter la note'}
              </button>
            </div>

            {/* Liste notes */}
            {notes.length > 0 ? (
              notes.map((note: any, idx: number) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
                >
                  {editingNoteId === note.id ? (
                    <div>
                      <textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white resize-none mb-3"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateNote(selectedProject.id, note.id)}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                        >
                          Sauvegarder
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-300 mb-3 whitespace-pre-wrap">{note.note_content}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          {new Date(note.created_at).toLocaleString('fr-FR')}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id)
                              setEditingNoteContent(note.note_content)
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(selectedProject.id, note.id)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center">
                <StickyNote className="w-16 h-16 text-pink-400 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-white mb-2">Aucune note</h3>
                <p className="text-gray-400">
                  Ajoutez votre première note ci-dessus
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderTimelineSection = () => {
    if (!selectedProject) return null

    const timeline = projectTimeline[selectedProject.id] || []

    const getEntryIcon = (type: string) => {
      const icons: any = {
        'project_created': Bookmark,
        'action_completed': CheckCircle,
        'document_generated': FileText,
        'business_plan_section': FileText,
        'conversation_ai': MessageSquare,
        'context_updated': RefreshCw,
        'note_added': Edit2,
        'default': Clock
      }
      return icons[type] || icons.default
    }

    const getEntryColor = (type: string) => {
      const colors: any = {
        'project_created': 'text-blue-400 bg-blue-500/20',
        'action_completed': 'text-green-400 bg-green-500/20',
        'document_generated': 'text-purple-400 bg-purple-500/20',
        'business_plan_section': 'text-green-400 bg-green-500/20',
        'conversation_ai': 'text-indigo-400 bg-indigo-500/20',
        'context_updated': 'text-orange-400 bg-orange-500/20',
        'note_added': 'text-yellow-400 bg-yellow-500/20',
        'default': 'text-gray-400 bg-gray-500/20'
      }
      return colors[type] || colors.default
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-6"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Historique du Projet</h1>
          <p className="text-white/90">
            Timeline chronologique de toutes les activités
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/80 text-sm">
            <span>{timeline.length} événement{timeline.length > 1 ? 's' : ''}</span>
            {timeline.length > 0 && (
              <>
                <span>•</span>
                <span>
                  Depuis le {new Date(selectedProject.created_at).toLocaleDateString('fr-FR')}
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* Timeline */}
        {timeline.length > 0 ? (
          <div className="relative">
            {/* Ligne verticale */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-transparent" />

            <div className="space-y-6">
              {timeline.map((entry: any, idx: number) => {
                const Icon = getEntryIcon(entry.entry_type)
                const colorClass = getEntryColor(entry.entry_type)

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative pl-16"
                  >
                    {/* Icône */}
                    <div className={`absolute left-0 w-12 h-12 rounded-full ${colorClass} flex items-center justify-center border-4 border-slate-900`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Contenu */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-white/10 hover:border-white/20 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white font-semibold">
                          {entry.title || 'Événement'}
                        </h3>
                        <span className="text-xs text-gray-400">
                          {new Date(entry.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {entry.content && (
                        <p className="text-gray-300 text-sm mb-2 line-clamp-3">
                          {entry.content}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(entry.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>

                        {entry.metadata && (
                          <button
                            onClick={() => {
                              setSelectedHistoryEntry(entry)
                              setIsHistoryModalOpen(true)
                            }}
                            className="text-indigo-400 hover:text-indigo-300 text-xs"
                          >
                            Voir détails →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <Clock className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucun historique</h3>
            <p className="text-gray-400">
              L'historique de vos actions apparaîtra ici au fur et à mesure
            </p>
          </motion.div>
        )}
      </div>
    )
  }
  const renderConseillerSection = () => {
    if (!selectedProject) return null

    return (
      <div className="h-full flex flex-col">
        {/* Chatbot IA en pleine page */}
        <ProjectChatBot
          projectId={selectedProject.id}
          userId={user?.id || ''}
          projectData={{
            titre: selectedProject.proposition_titre,
            description: selectedProject.proposition_description,
            secteur: selectedProject.secteur_selectionne,
            budget: selectedProject.budget_selectionne,
            phase: selectedProject.current_phase || 'ideation',
            progression: 0
          }}
          documents={projectDocuments[selectedProject.id] || []}
          notes={projectNotes[selectedProject.id] || []}
          userCredits={100}
        />
      </div>
    )
  }

  const renderNotesSection = () => {
    if (!selectedProject) return null

    const notes = projectNotes[selectedProject.id] || []

    return (
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-6"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Notes Personnelles</h1>
          <p className="text-white/90">
            Gardez une trace de vos idées et réflexions sur ce projet
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/80 text-sm">
            <span>{notes.length} note{notes.length > 1 ? 's' : ''}</span>
          </div>
        </motion.div>

        {/* Formulaire ajout note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10"
        >
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-pink-400" />
            {editingNoteId ? 'Modifier la note' : 'Ajouter une note'}
          </h3>
          <textarea
            value={editingNoteId ? editingNoteContent : newNote}
            onChange={(e) => editingNoteId ? setEditingNoteContent(e.target.value) : setNewNote(e.target.value)}
            placeholder="Écrivez votre note ici..."
            className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 transition-colors resize-none"
          />
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                if (editingNoteId) {
                  handleUpdateNote(editingNoteId, selectedProject.id)
                } else {
                  handleAddNote(selectedProject.id)
                }
              }}
              disabled={editingNoteId ? !editingNoteContent.trim() : !newNote.trim()}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {editingNoteId ? 'Mettre à jour' : 'Ajouter'}
            </button>
            {editingNoteId && (
              <button
                onClick={() => {
                  setEditingNoteId(null)
                  setEditingNoteContent('')
                }}
                className="px-6 py-3 bg-white/5 text-gray-300 font-semibold rounded-lg hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
            )}
          </div>
        </motion.div>

        {/* Liste des notes */}
        {notes.length > 0 ? (
          <div className="space-y-4">
            {notes.map((note: any, idx: number) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (idx + 2) * 0.05 }}
                className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 border border-white/10 hover:border-pink-500/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-5 h-5 text-pink-400" />
                    <span className="text-sm text-gray-400">
                      {new Date(note.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingNoteId(note.id)
                        setEditingNoteContent(note.note_content)
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id, selectedProject.id)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">{note.note_content}</p>
                {note.updated_at && note.updated_at !== note.created_at && (
                  <div className="mt-3 text-xs text-gray-500">
                    Modifiée le {new Date(note.updated_at).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-white/10 text-center"
          >
            <StickyNote className="w-16 h-16 text-pink-400 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Aucune note</h3>
            <p className="text-gray-400">
              Ajoutez votre première note pour garder une trace de vos idées
            </p>
          </motion.div>
        )}
      </div>
    )
  }

  // Fonction pour sauvegarder le score du test
  const handleSaveScore = async (score: number, answers: number[], timeSpent: number) => {
    if (!user?.id || !selectedProject || !currentSkillTest) return
    
    try {
      const questionsCorrect = answers.filter((a, i) => a === currentSkillTest.questions[i].correctAnswer).length
      
      const response = await fetch(`${API_URL}/api/skill-test/save-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          projectId: selectedProject.id,
          testId: currentSkillTest.id,
          score,
          difficulty: currentSkillTest.difficulty,
          questionsTotal: currentSkillTest.questions.length,
          questionsCorrect,
          timeSpent,
          answers
        })
      })
      
      const data = await response.json()
      if (data.success) {
        console.log('✅ Score sauvegardé:', score, '%')
        // Recharger les scores
        fetchSkillTestScores(selectedProject.id)
      }
    } catch (error) {
      console.error('Erreur sauvegarde score:', error)
    }
  }

  // Fonction pour sauvegarder le sommaire de formation dans Documents générés
  const saveSkillTestToDocuments = async (test: any, testId: string, projectId: string, project: any): Promise<string | null> => {
    try {
      const questionsText = test.questions?.map((q: any, idx: number) => 
        `### Question ${idx + 1}: ${q.question}\n` +
        `**Type**: ${q.type}\n` +
        (q.options ? `**Options**: ${q.options.join(', ')}\n` : '') +
        `**Compétence évaluée**: ${q.competence}\n\n`
      ).join('\n') || ''

      const fullContent = 
        `# Test de Compétences\n\n` +
        `**Projet**: ${project.proposition_titre}\n` +
        `**Difficulté**: ${test.difficulty || 'Moyen'}\n` +
        `**Nombre de questions**: ${test.questions?.length || 0}\n\n` +
        `---\n\n` +
        `## 📋 Questions\n\n` +
        questionsText +
        `---\n\n` +
        `*Test généré automatiquement pour évaluer vos compétences*`

      const response = await fetch(`${API_URL}/api/project-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user?.id,
          documentType: 'skill-test',
          title: `Test de Compétences - ${project.proposition_titre}`,
          content: fullContent,
          promptUsed: 'Test de compétences généré depuis Mes Projets',
          contextAdded: `Projet: ${project.proposition_titre}`,
          metadata: {
            testId,
            difficulty: test.difficulty,
            questionCount: test.questions?.length || 0,
            generatedFrom: 'mes-projets'
          }
        })
      })

      const data = await response.json()
      if (data.success && data.document) {
        console.log('✅ Test de compétences sauvegardé dans Documents:', data.document.id)
        // Recharger les documents
        await hookFetchDocuments(projectId)
        return data.document.id
      }
      return null
    } catch (error) {
      console.error('❌ Erreur sauvegarde test:', error)
      return null
    }
  }

  const saveTrainingSummaryToDocuments = async (training: any, trainingId: string, projectId: string, project: any): Promise<string | null> => {
    try {
      const modulesText = training.modules.map((m: any, idx: number) => 
        `### Module ${idx + 1}: ${m.competence}\n` +
        `**Priorité**: ${m.priority} | **Niveau**: ${m.level}\n` +
        `**Objectif**: ${m.objective}\n` +
        `**Durée estimée**: ${m.duration}\n\n`
      ).join('\n')

      const pricingText = training.pricing ? 
        `\n## 💰 Tarification\n\n` +
        `- **Par module**: ${training.pricing.per_module} crédits/module\n` +
        `- **Formation complète**: ${training.pricing.full_training} crédits\n` +
        `- **Économie**: ${training.pricing.savings} crédits\n\n` : ''

      const fullContent = 
        `# ${training.title}\n\n` +
        `**Durée totale**: ${training.total_duration || 'Non spécifiée'}\n` +
        `**Marge d'exécution**: ${training.execution_margin || 'Non spécifiée'}\n\n` +
        `---\n\n` +
        `## 📚 Modules de formation\n\n` +
        modulesText +
        pricingText +
        `---\n\n` +
        `*Formation générée automatiquement pour le projet: ${project.proposition_titre}*`

      const response = await fetch(`${API_URL}/api/project-documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          userId: user?.id,
          documentType: 'custom-training',
          title: training.title,
          content: fullContent,
          promptUsed: 'Formation générée depuis Mes Projets',
          contextAdded: `Proposition: ${project.proposition_titre}`,
          metadata: {
            trainingId,
            moduleCount: training.modules.length,
            totalDuration: training.total_duration,
            pricing: training.pricing,
            generatedFrom: 'mes-projets'
          }
        })
      })

      const data = await response.json()
      if (data.success && data.document) {
        console.log('✅ Sommaire de formation sauvegardé dans Documents générés:', data.document.id)
        // Recharger les documents
        await hookFetchDocuments(projectId)
        return data.document.id
      }
      return null
    } catch (error) {
      console.error('❌ Erreur sauvegarde sommaire formation:', error)
      return null
    }
  }

  const getActionStatus = (projectId: string, actionType: string): 'done' | 'pending' | 'none' => {
    const actions = projectActions[projectId] || []
    const action = actions.find(a => a.action_type === actionType)
    if (!action) return 'none'
    return action.action_status === 'completed' ? 'done' : 'pending'
  }

  const isActionRecommended = (projectId: string, actionId: string): boolean => {
    // Plus de système de recommandation automatique
    return false
  }

  const isActionLocked = (projectId: string, actionId: string): boolean => {
    // Toutes les actions sont débloquées
    return false
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getBudgetColor = (budget: string | null | undefined) => {
    if (!budget) return 'from-gray-500 to-gray-600'
    if (budget.includes('Micro') || budget.includes('0 - 500')) return 'from-green-500 to-emerald-600'
    if (budget.includes('Petit') || budget.includes('500') || budget.includes('2,000')) return 'from-blue-500 to-cyan-600'
    if (budget.includes('Moyen') || budget.includes('2') || budget.includes('10')) return 'from-purple-500 to-violet-600'
    if (budget.includes('Grand') || budget.includes('10+')) return 'from-orange-500 to-red-600'
    return 'from-gray-500 to-gray-600'
  }

  if (authLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Chargement des projets...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Connexion requise</h2>
          <p className="text-gray-300 mb-6">Veuillez vous connecter pour voir vos projets</p>
          <button
            onClick={() => router.push('/auth/signin')}
            className="px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all"
          >
            Se connecter
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header onMobileMenuToggle={() => setIsSidebarOpen(true)} />

      <div className="flex">
        <Sidebar 
          isMobileOpen={isSidebarOpen}
          onMobileClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full py-8 px-4 lg:px-8 max-w-7xl mx-auto">
            {!selectedProject ? (
              <>
                {/* Header */}
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mb-8"
                >
                  <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                      📁 Mes Dossiers Projets
                    </span>
                  </h1>
                  <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                    Tous vos projets d'opportunités avec historique des actions IA
                  </p>
                </motion.div>

                {/* Stats */}
                {stats && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
                  >
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                      <div className="text-3xl font-bold text-yellow-400">{stats.total_projects}</div>
                      <div className="text-gray-300 text-sm">Dossiers Total</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                      <div className="text-3xl font-bold text-green-400">{stats.recent_projects_count}</div>
                      <div className="text-gray-300 text-sm">Ce mois-ci</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                      <div className="text-3xl font-bold text-blue-400">
                        {stats.projects_by_sector ? Object.keys(stats.projects_by_sector).length : 0}
                      </div>
                      <div className="text-gray-300 text-sm">Secteurs</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                      <div className="text-3xl font-bold text-purple-400">
                        {Object.values(projectActions).reduce((sum, actions) => sum + actions.filter(a => a.action_status === 'completed').length, 0)}
                      </div>
                      <div className="text-gray-300 text-sm">Actions</div>
                    </div>
                  </motion.div>
                )}

                {/* Projects Grid */}
                {projects.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {projects.map((project, index) => {
                      const projectActionsData = projectActions[project.id] || []
                      const completedActions = projectActionsData.filter(a => a.action_status === 'completed').length
                      
                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ y: -4 }}
                          className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden group"
                        >
                          {/* Header Card */}
                          <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 leading-tight">
                                  {project.proposition_titre}
                                </h3>
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white bg-gradient-to-r ${getBudgetColor(project.budget_selectionne)}`}>
                                    {project.secteur_selectionne}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 ml-3">
                                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-400/20 rounded-lg">
                                  <Award className="w-4 h-4 text-yellow-400" />
                                  <span className="text-yellow-400 font-bold text-sm">
                                    {project.proposition_score_faisabilite}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Description */}
                            <p className="text-gray-300 text-sm mb-4 line-clamp-2 leading-relaxed">
                              {project.proposition_description}
                            </p>

                            {/* Problématique */}
                            <div className="bg-white/5 rounded-lg p-3 mb-4">
                              <p className="text-xs text-gray-400 mb-1">🎯 Problématique:</p>
                              <p className="text-sm text-gray-200 line-clamp-2">{project.problematique_centrale}</p>
                            </div>

                            {/* Progress Bar */}
                            {project.plan_action_steps && project.plan_action_steps.length > 0 && (
                              <div className="mb-4">
                                <ProgressBar 
                                  progress={project.progress_percentage || 0}
                                  totalSteps={project.plan_action_steps.length}
                                  completedSteps={project.plan_action_steps.filter((s: any) => s.status === 'completed').length}
                                  phase={project.current_phase || 'idea'}
                                  showDetails={false}
                                />
                              </div>
                            )}

                            {/* Actions Status */}
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              {QUICK_ACTIONS.slice(0, 4).map(action => {
                                const status = getActionStatus(project.id, action.id)
                                const ActionIcon = action.icon
                                const isRecommended = isActionRecommended(project.id, action.id)
                                return (
                                  <div
                                    key={action.id}
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      status === 'done' 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                        : status === 'pending'
                                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                        : isRecommended
                                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse'
                                        : 'bg-white/5 text-gray-400 border border-white/10'
                                    }`}
                                  >
                                    <ActionIcon className="w-3 h-3" />
                                    <span className="truncate">{action.title.split(' ')[0]}</span>
                                    {status === 'done' && <span>✓</span>}
                                    {isRecommended && status !== 'done' && <span>🎯</span>}
                                  </div>
                                )
                              })}
                            </div>

                            {/* Footer avec crédits et contexte */}
                            <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-white/10">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(project.created_at)}
                                </div>
                                {project.total_credits_used && project.total_credits_used > 0 && (
                                  <div className="flex items-center gap-1 text-yellow-400">
                                    <Zap className="w-3 h-3" />
                                    <span className="font-semibold">{project.total_credits_used} ⚡</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {project.context_updated_at && (
                                  <div className="flex items-center gap-1 text-blue-400">
                                    <RefreshCw className="w-3 h-3" />
                                    <span className="text-xs">{formatDate(project.context_updated_at)}</span>
                                  </div>
                                )}
                                <span className="text-gray-400">{completedActions} action{completedActions > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </div>

                          {/* Voir le Projet Button */}
                          <div className="relative px-5 pb-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProject(project)
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all shadow-lg group-hover:shadow-xl"
                            >
                              <Bookmark className="w-4 h-4" />
                              <span>Voir le Projet</span>
                            </button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-16"
                  >
                    <div className="text-6xl mb-4">📂</div>
                    <h3 className="text-2xl font-semibold text-white mb-3">
                      Aucun dossier projet
                    </h3>
                    <p className="text-gray-300 mb-6">
                      Créez votre premier dossier depuis l'analyseur business
                    </p>
                    <button
                      onClick={() => router.push('/business/analyzer')}
                      className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Sparkles className="w-5 h-5" />
                      Analyser une opportunité
                    </button>
                  </motion.div>
                )}
              </>
            ) : (
              /* Vue détaillée avec layout 1/3 - 2/3 */
              <div className="fixed left-0 lg:left-64 right-0 top-16 bottom-0 flex flex-col lg:flex-row bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                {/* Bouton Hamburger Mobile */}
                <button
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden fixed top-20 left-4 z-50 w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                >
                  <Menu className="w-6 h-6 text-white" />
                </button>

                {/* Overlay Mobile */}
                {isMobileSidebarOpen && (
                  <div
                    className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    onClick={() => setIsMobileSidebarOpen(false)}
                  />
                )}

                {/* Sidebar Navigation - Responsive */}
                <div className={`
                  fixed lg:relative inset-y-0 left-0 z-50
                  w-80 lg:w-1/3 max-w-md
                  transform transition-transform duration-300 ease-in-out
                  ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                  <ProjectSidebar
                    sections={PROJECT_SECTIONS}
                    activeSection={activeSection}
                    onSectionChange={(section) => {
                      setActiveSection(section)
                      setIsMobileSidebarOpen(false) // Fermer le drawer après sélection sur mobile
                    }}
                    onBack={() => {
                      setSelectedProject(null)
                      setActiveSection('dashboard')
                      setIsMobileSidebarOpen(false)
                    }}
                    projectTitle={selectedProject.proposition_titre}
                    completionStats={{
                      actions: projectActions[selectedProject.id]?.filter(a => a.action_status === 'completed').length || 0,
                      documents: projectDocuments[selectedProject.id]?.length || 0,
                      notes: projectNotes[selectedProject.id]?.length || 0
                    }}
                    onDeleteProject={() => hookDeleteProject(selectedProject.id)}
                    onRestartAnalysis={() => restartAnalysis(selectedProject.id)}
                    isDeleting={isDeleting}
                    isRestarting={isRestarting}
                  />
                </div>

                {/* Contenu Principal - Responsive avec scroll */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                  <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-20">
                    {renderSectionContent()}
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modal d'affichage du document avec formulaire de contexte */}
      <AnimatePresence>
        {selectedDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setSelectedDocument(null)
              setShowContextForm(false)
              setNewContext('')
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl border border-white/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${getDocumentColor(selectedDocument.document_type || selectedDocument.type || 'default')} flex items-center justify-center text-2xl`}>
                      {getDocumentIcon(selectedDocument.document_type || selectedDocument.type || 'default')}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedDocument.title}</h2>
                      <p className="text-sm text-gray-400">{formatDate(selectedDocument.created_at)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDocument(null)
                      setShowContextForm(false)
                      setNewContext('')
                    }}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="prose prose-invert max-w-none mb-6">
                  <div className="bg-white/5 rounded-lg p-6 text-gray-300 whitespace-pre-wrap">
                    {selectedDocument.content}
                  </div>
                </div>

                {/* Contexte actuel */}
                {selectedDocument.context_added && (
                  <div className="mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      Contexte enrichi
                    </h4>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedDocument.context_added}</p>
                  </div>
                )}

                {/* Formulaire d'ajout de contexte */}
                {!showContextForm ? (
                  <button
                    onClick={() => setShowContextForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all"
                  >
                    <Sparkles className="w-5 h-5" />
                    Ajouter du contexte et régénérer
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Ajoutez du contexte additionnel
                      </label>
                      <p className="text-sm text-gray-400 mb-3">
                        💡 Vos notes et commentaires seront automatiquement inclus dans le contexte
                      </p>
                      <textarea
                        value={newContext}
                        onChange={(e) => setNewContext(e.target.value)}
                        placeholder="Exemple: Ajoutez des détails sur votre situation, vos ressources disponibles, vos contraintes..."
                        className="w-full h-32 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowContextForm(false)
                          setNewContext('')
                        }}
                        className="flex-1 px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/20"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => selectedProject && handleAddContextToDocument(selectedDocument.id, selectedProject.id)}
                        disabled={!newContext.trim()}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                        Régénérer
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}


        {/* Modal Action Étape - Questionnaire avec IA */}
        {stepActionModal.isOpen && stepActionModal.step && selectedProject && (
          <StepActionModal
            isOpen={stepActionModal.isOpen}
            onClose={() => setStepActionModal({ isOpen: false, step: null })}
            step={stepActionModal.step}
            projectData={{
              titre: selectedProject.proposition_titre,
              secteur: selectedProject.secteur_selectionne,
              budget: selectedProject.budget_selectionne,
              description: selectedProject.proposition_description,
              projectId: selectedProject.id,
              userId: user?.id || ''
            }}
            onComplete={(answers) => handleCompleteStepAction(selectedProject.id, stepActionModal.step, answers)}
            onGenerateAIResponse={handleGenerateStepAIResponse}
          />
        )}

        {/* Sélecteur de sections Business Plan */}
        {businessPlanSelectorOpen && selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      📊 Ébauche de Business Plan
                    </h2>
                    <p className="text-gray-600">
                      Sélectionnez une section pour commencer à rédiger votre business plan professionnel
                    </p>
                  </div>
                  <button
                    onClick={() => setBusinessPlanSelectorOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Sections */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {BUSINESS_PLAN_SECTIONS.map((section) => {
                    const isCompleted = (businessPlanProgress[selectedProject.id] || 0) >= section.section
                    return (
                      <button
                        key={section.section}
                        onClick={() => {
                          setBusinessPlanSelectorOpen(false)
                          handleOpenBusinessPlanSection(section.section)
                        }}
                        className="text-left p-4 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:shadow-lg transition-all bg-white"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-300'
                          }`}>
                            {isCompleted ? '✓' : section.section}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {section.title}
                            </h3>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              🎯 {section.objective}
                            </p>
                            <p className="text-xs text-green-600 mt-2">
                              {section.questions.length} questions
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {businessPlanProgress[selectedProject.id] || 0}/10 sections complétées
                  </p>
                  <button
                    onClick={() => setBusinessPlanSelectorOpen(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Business Plan - Questionnaire par section */}
        {businessPlanModal.isOpen && businessPlanModal.section && selectedProject && (
          <BusinessPlanModal
            isOpen={businessPlanModal.isOpen}
            onClose={() => setBusinessPlanModal({ isOpen: false, section: null })}
            section={businessPlanModal.section}
            projectData={{
              titre: selectedProject.proposition_titre,
              secteur: selectedProject.secteur_selectionne,
              budget: selectedProject.budget_selectionne,
              description: selectedProject.proposition_description,
              projectId: selectedProject.id,
              userId: user?.id || ''
            }}
            onComplete={(answers) => handleCompleteBusinessPlanSection(selectedProject.id, businessPlanModal.section, answers)}
            onGenerateAIResponse={handleGenerateStepAIResponse}
          />
        )}

        {/* Modal Plan d'Action - Checklist par étape */}
        {actionPlanModal.isOpen && selectedProject && (
          <ActionPlanChecklistModal
            isOpen={actionPlanModal.isOpen}
            onClose={() => setActionPlanModal({ isOpen: false, stepNumber: 1 })}
            stepNumber={actionPlanModal.stepNumber}
            projectData={{
              titre: selectedProject.proposition_titre,
              secteur: selectedProject.secteur_selectionne,
              budget: selectedProject.budget_selectionne,
              description: selectedProject.proposition_description,
              projectId: selectedProject.id,
              userId: user?.id || ''
            }}
          />
        )}

        {/* Modal Visualisation de Document */}
        <DocumentViewer
          isOpen={documentViewerOpen}
          onClose={() => {
            setDocumentViewerOpen(false)
            setSelectedDocumentToView(null)
          }}
          document={selectedDocumentToView}
        />

        {/* Modal Formation sur mesure */}
        {selectedProject && (
          <TrainingSummaryModal
            open={isTrainingModalOpen}
            onClose={() => setIsTrainingModalOpen(false)}
            training={generatedTraining}
            trainingId={generatedTrainingId}
            userId={user?.id}
            onNeedsTopUp={() => {}}
          />
        )}

        {/* Modal Historique Détail */}
        <AnimatePresence>
          {isHistoryModalOpen && selectedHistoryEntry && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => {
                setIsHistoryModalOpen(false)
                setSelectedHistoryEntry(null)
              }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl border border-white/20 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/20 bg-gradient-to-r from-indigo-500/20 to-purple-500/20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">
                        {selectedHistoryEntry.entry_type === 'note' && '📝'}
                        {selectedHistoryEntry.entry_type === 'file' && '📄'}
                        {selectedHistoryEntry.entry_type === 'conversation_ai' && '🤖'}
                        {selectedHistoryEntry.entry_type === 'business_plan_section' && '📊'}
                        {selectedHistoryEntry.entry_type === 'step_completed' && '✅'}
                        {!['note', 'file', 'conversation_ai', 'business_plan_section', 'step_completed'].includes(selectedHistoryEntry.entry_type) && '📌'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">
                          {selectedHistoryEntry.title || (
                            selectedHistoryEntry.entry_type === 'note' ? 'Note' :
                            selectedHistoryEntry.entry_type === 'file' ? 'Fichier' :
                            selectedHistoryEntry.entry_type === 'conversation_ai' ? 'Conversation IA' :
                            selectedHistoryEntry.entry_type === 'business_plan_section' ? 'Business Plan' :
                            selectedHistoryEntry.entry_type === 'step_completed' ? 'Étape complétée' :
                            'Entrée'
                          )}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-400">
                          <span>
                            {new Date(selectedHistoryEntry.created_at).toLocaleDateString('fr-FR', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {selectedHistoryEntry.entry_type === 'conversation_ai' && (
                            <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-xs">
                              {selectedHistoryEntry.content.match(/\[user\]|\[assistant\]/gi)?.length || 0} messages
                            </span>
                          )}
                          {selectedHistoryEntry.entry_type === 'business_plan_section' && selectedHistoryEntry.metadata?.section_number && (
                            <span className="px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-xs">
                              Section {selectedHistoryEntry.metadata.section_number}/10
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsHistoryModalOpen(false)
                        setSelectedHistoryEntry(null)
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="prose prose-invert max-w-none">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                        {selectedHistoryEntry.content}
                      </pre>
                    </div>
                  </div>

                  {/* Metadata */}
                  {selectedHistoryEntry.metadata && Object.keys(selectedHistoryEntry.metadata).length > 0 && (
                    <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <h4 className="text-white font-semibold mb-2 text-sm">Métadonnées</h4>
                      <div className="space-y-1">
                        {Object.entries(selectedHistoryEntry.metadata).map(([key, value]) => (
                          <div key={key} className="flex items-start gap-2 text-xs">
                            <span className="text-gray-400 font-medium">{key}:</span>
                            <span className="text-gray-300">{JSON.stringify(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File info */}
                  {selectedHistoryEntry.file_url && (
                    <div className="mt-4">
                      <a
                        href={selectedHistoryEntry.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Télécharger le fichier
                      </a>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/20 bg-white/5">
                  <button
                    onClick={() => {
                      setIsHistoryModalOpen(false)
                      setSelectedHistoryEntry(null)
                    }}
                    className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>

      {/* Modal de génération IA */}
      <AIActionModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        actionName={currentActionName}
        actionIcon={currentActionIcon}
        status={aiModalStatus}
        progress={aiModalProgress}
        message={aiModalMessage}
        errorMessage={aiModalError}
      />

      {/* Modal Test de Compétences */}
      {selectedProject && (
        <SkillTestModal
          isOpen={skillTestModalOpen}
          onClose={() => {
            setSkillTestModalOpen(false)
            setCurrentSkillTest(null)
          }}
          test={currentSkillTest}
          onRegenerateTest={handleRegenerateTest}
          previousScores={skillTestScores[selectedProject.id]?.map(s => ({
            score: s.score,
            date: s.created_at,
            difficulty: s.difficulty
          })) || []}
        />
      )}

      {/* Modal Générer un courrier */}
      {selectedProject && user && (
        <GenerateLetterModal
          isOpen={generateLetterModalOpen}
          onClose={() => setGenerateLetterModalOpen(false)}
          project={selectedProject}
          userId={user.id}
          onSuccess={handleLetterSuccess}
        />
      )}

      {/* Modal de génération du plan d'action */}
      <ActionPlanGenerationModal isOpen={generatingActionPlan} />

      {/* Popup d'onboarding pour les nouveaux utilisateurs */}
      <ProjectCardOnboarding
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onDontShowAgain={handleDontShowOnboardingAgain}
      />
    </div>
  )
}
