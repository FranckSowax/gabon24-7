'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, CheckCircle, AlertCircle, Rocket } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ActionPlanSteps from './ActionPlanSteps'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionPlanGeneratorProps {
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
}

interface GeneratedStep {
  step: number
  title: string
  objective: string
  duration: string
  icon: string
  checklist: Array<{
    id: string
    task: string
    description: string
    aiPrompt: string
    requiresDocument?: boolean
    documentType?: string
    placeholder: string
    estimatedTime: string
    priority: 'haute' | 'moyenne' | 'basse'
  }>
}

export default function ActionPlanGenerator({ projectData }: ActionPlanGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedSteps, setGeneratedSteps] = useState<GeneratedStep[]>([])
  const [isCheckingExisting, setIsCheckingExisting] = useState(true)

  // Vérifier au montage si un plan existe déjà et le charger
  React.useEffect(() => {
    const checkExistingPlan = async () => {
      try {
        console.log('🔍 Vérification plan existant pour projet:', projectData.projectId)
        
        const { data: existingPlan, error: fetchError } = await supabase
          .from('action_plan_checklists')
          .select(`
            id,
            step_number,
            step_title,
            step_objective,
            step_duration
          `)
          .eq('project_id', projectData.projectId)
          .order('step_number')

        if (fetchError) {
          console.error('❌ Erreur chargement plan:', fetchError)
          throw fetchError
        }

        if (existingPlan && existingPlan.length > 0) {
          console.log(`✅ Plan existant trouvé: ${existingPlan.length} étapes`)
          
          // Charger les items de chaque étape
          const stepsWithItems: GeneratedStep[] = []
          
          for (const step of existingPlan) {
            const { data: items } = await supabase
              .from('action_plan_checklist_items')
              .select('*')
              .eq('checklist_id', step.id)
              .order('order_index')
            
            stepsWithItems.push({
              step: step.step_number,
              title: step.step_title,
              objective: step.step_objective,
              duration: step.step_duration,
              icon: '🎯', // Icône par défaut
              checklist: (items || []).map((item: any) => ({
                id: item.item_id,
                task: item.task,
                description: item.description,
                aiPrompt: item.ai_prompt,
                requiresDocument: item.requires_document,
                documentType: item.document_type,
                placeholder: item.placeholder,
                estimatedTime: item.estimated_time,
                priority: item.priority
              }))
            })
          }
          
          setGeneratedSteps(stepsWithItems)
          setIsGenerated(true)
          console.log('📦 Étapes chargées depuis Supabase')
        } else {
          console.log('⚠️ Aucun plan existant trouvé')
        }
      } catch (err) {
        console.error('❌ Erreur vérification plan existant:', err)
      } finally {
        setIsCheckingExisting(false)
      }
    }

    checkExistingPlan()
  }, [projectData.projectId])

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setError(null)

    try {

      // Construire le contexte complet du projet
      const fullContext = `
INFORMATIONS DU PROJET:
- Titre: ${projectData.titre}
- Secteur: ${projectData.secteur}
- Budget: ${projectData.budget}
- Description: ${projectData.description}
${projectData.contexte ? `- Contexte: ${projectData.contexte}` : ''}
${projectData.problematique ? `- Problématique: ${projectData.problematique}` : ''}
${projectData.article ? `- Article de référence: ${projectData.article}` : ''}

MISSION:
Tu es un consultant expert en entrepreneuriat au Gabon. Génère un plan d'action personnalisé en 5 étapes pour ce projet spécifique.

CONTRAINTES:
- Adapte TOUTES les recommandations au contexte gabonais
- Utilise la devise FCFA
- Mentionne des institutions, quartiers, entreprises gabonaises réelles
- Considère les spécificités locales (climat, culture, réglementation)
- Chaque étape doit avoir 3-5 tâches concrètes et actionnables
- Les tâches doivent être spécifiques au projet, pas génériques

FORMAT ATTENDU (JSON):
{
  "steps": [
    {
      "step": 1,
      "title": "Titre de l'étape",
      "objective": "Objectif clair",
      "duration": "X semaines",
      "icon": "🔍",
      "checklist": [
        {
          "id": "unique_id",
          "task": "Tâche spécifique au projet",
          "description": "Description détaillée",
          "aiPrompt": "Prompt pour générer une réponse IA",
          "requiresDocument": false,
          "documentType": "",
          "placeholder": "Exemple de réponse",
          "estimatedTime": "X jours",
          "priority": "haute"
        }
      ]
    }
  ]
}

Génère maintenant les 5 étapes personnalisées pour ce projet.
`

      const response = await fetch(`${API_URL}/api/project-documents/generate-ai-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullContext,
          context: 'action_plan_generation'
        })
      })

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Parser la réponse IA (qui devrait être du JSON)
      let parsedSteps: GeneratedStep[]
      try {
        const aiResponse = typeof data.response === 'string' ? data.response : JSON.stringify(data.response)
        // Extraire le JSON de la réponse (au cas où il y aurait du texte avant/après)
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          parsedSteps = parsed.steps || []
        } else {
          throw new Error('Format de réponse invalide')
        }
      } catch (parseError) {
        console.error('Erreur parsing:', parseError)
        throw new Error('Impossible de parser la réponse IA')
      }

      if (!parsedSteps || parsedSteps.length === 0) {
        throw new Error('Aucune étape générée')
      }

      setGeneratedSteps(parsedSteps)
      setIsGenerated(true)

      // Créer les checklists en base de données
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      for (const step of parsedSteps) {
        // Créer la checklist
        const { data: checklist, error: checklistError } = await supabase
          .from('action_plan_checklists')
          .insert({
            project_id: projectData.projectId,
            user_id: user.id,
            step_number: step.step,
            step_title: step.title,
            step_objective: step.objective,
            step_duration: step.duration
          })
          .select('id')
          .single()

        if (checklistError) throw checklistError

        // Créer les items
        const items = step.checklist.map((item, index) => ({
          checklist_id: checklist.id,
          item_id: item.id,
          task: item.task,
          description: item.description,
          ai_prompt: item.aiPrompt,
          requires_document: item.requiresDocument || false,
          document_type: item.documentType || null,
          placeholder: item.placeholder,
          estimated_time: item.estimatedTime,
          priority: item.priority,
          order_index: index
        }))

        const { error: itemsError } = await supabase
          .from('action_plan_checklist_items')
          .insert(items)

        if (itemsError) throw itemsError
        
        console.log(`✅ Étape ${step.step} sauvegardée avec ${items.length} items`)
      }
      
      console.log('🎉 Plan d\'action complet sauvegardé dans Supabase!')

    } catch (err) {
      console.error('❌ Erreur génération plan:', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setIsGenerating(false)
    }
  }

  // Afficher un loader pendant la vérification
  if (isCheckingExisting) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-4">
        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center mb-3 sm:mb-4 shadow-sm">
          <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 animate-spin" />
        </div>
        <span className="text-sm sm:text-base text-gray-600 text-center">Vérification du plan d'action...</span>
      </div>
    )
  }

  if (isGenerated) {
    return (
      <ActionPlanSteps
        projectData={projectData}
        generatedSteps={generatedSteps.length > 0 ? generatedSteps : undefined}
      />
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Section - Ultra Responsive */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-violet-50 via-purple-50 to-orange-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-orange-200 sm:border-2 sm:border-orange-400 shadow-sm"
      >
        {/* Header avec icône - Stack sur mobile, row sur desktop */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
          {/* Icône - Centrée sur mobile, à gauche sur desktop */}
          <div className="flex justify-center sm:justify-start sm:flex-shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Rocket className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-white" />
            </div>
          </div>

          {/* Titre et description - Pleine largeur */}
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">
              Plan d'Action Personnalisé
            </h2>
            <p className="text-sm sm:text-base lg:text-lg text-gray-600 leading-relaxed">
              Générez un plan d'action en 5 étapes adapté à votre projet : <strong className="text-orange-700">{projectData.titre}</strong>
            </p>
          </div>
        </div>

        {/* Section "Ce qui sera pris en compte" */}
        <div className="bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-5 mb-4 sm:mb-6 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3">Ce qui sera pris en compte :</h3>
          <ul className="space-y-2 sm:space-y-2.5">
            <li className="flex items-start gap-2 sm:gap-3">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                Secteur d'activité : <strong className="text-gray-900">{projectData.secteur}</strong>
              </span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                Budget disponible : <strong className="text-gray-900">{projectData.budget}</strong>
              </span>
            </li>
            <li className="flex items-start gap-2 sm:gap-3">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">Description et objectifs du projet</span>
            </li>
            {projectData.contexte && (
              <li className="flex items-start gap-2 sm:gap-3">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">Contexte spécifique fourni</span>
              </li>
            )}
            {projectData.problematique && (
              <li className="flex items-start gap-2 sm:gap-3">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">Problématique identifiée</span>
              </li>
            )}
            {projectData.article && (
              <li className="flex items-start gap-2 sm:gap-3">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-gray-700 leading-relaxed">Article de référence analysé</span>
              </li>
            )}
          </ul>
        </div>

        {/* Bouton CTA - Toujours pleine largeur sur mobile */}
        <button
          onClick={handleGeneratePlan}
          disabled={isGenerating}
          className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-3.5 lg:py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-lg hover:shadow-xl text-sm sm:text-base"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              <span>Génération en cours...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Générer le Plan d'Action IA</span>
            </>
          )}
        </button>
      </motion.div>

      {/* Erreur */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-50 border border-red-200 sm:border-2 sm:border-red-400 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3"
        >
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-red-900 text-sm sm:text-base mb-1">Erreur de génération</h4>
            <p className="text-xs sm:text-sm text-red-700 break-words">{error}</p>
            <button
              onClick={handleGeneratePlan}
              className="mt-2 sm:mt-3 text-xs sm:text-sm text-red-600 hover:text-red-800 underline font-medium"
            >
              Réessayer
            </button>
          </div>
        </motion.div>
      )}

      {/* Info Section - Responsive */}
      <div className="bg-white rounded-xl p-4 sm:p-5 lg:p-6 border border-gray-200 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-3 sm:mb-4">Qu'est-ce qu'un Plan d'Action ?</h3>
        <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600">
          <p className="leading-relaxed">
            Un plan d'action est une feuille de route détaillée qui vous guide étape par étape dans la réalisation de votre projet.
          </p>
          <p className="leading-relaxed">
            Notre IA analysera votre projet et générera un plan personnalisé en 5 étapes, avec des tâches concrètes adaptées au contexte gabonais.
          </p>
          <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-lg p-3 sm:p-4 mt-3 sm:mt-4">
            <h4 className="font-semibold text-violet-900 text-xs sm:text-sm mb-2 sm:mb-3">Les 5 étapes typiques :</h4>
            <ol className="space-y-1.5 sm:space-y-2 text-violet-800">
              {[
                'Validation et Étude Préliminaire',
                'Structuration Juridique et Administrative',
                'Mise en Place Opérationnelle',
                'Stratégie Marketing et Commerciale',
                'Lancement et Suivi'
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 bg-violet-200 text-violet-800 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
