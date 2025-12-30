'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Loader2, ChevronRight, AlertCircle, Briefcase, Clock } from 'lucide-react'
import { ACTION_PLAN_PHASES, ActionPlanQuestion } from '@/types/action-plan-questions'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionPlanModalProps {
  isOpen: boolean
  onClose: () => void
  phase: {
    phase: number
    title: string
    objective: string
    duration: string
  }
  projectData: {
    titre: string
    secteur: string
    budget: string
    description: string
    projectId?: string
    userId?: string
  }
  onComplete: (answers: { [key: string]: string }) => Promise<void>
  onGenerateAIResponse: (question: ActionPlanQuestion, projectContext: string) => Promise<string>
}

export default function ActionPlanModal({
  isOpen,
  onClose,
  phase,
  projectData,
  onComplete,
  onGenerateAIResponse
}: ActionPlanModalProps) {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const phaseData = ACTION_PLAN_PHASES.find(p => p.phase === phase.phase)
  const questions = phaseData?.questions || []
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length
  const allAnswered = answeredCount === questions.length

  // Grouper questions par catégorie (toutes visibles)
  const groupedQuestions = { 'Tâches à Accomplir': questions }

  // Ouvrir toutes les catégories par défaut
  React.useEffect(() => {
    setExpandedCategories(new Set(Object.keys(groupedQuestions)))
  }, [])

  const toggleCategory = (category: string) => {
    const newSet = new Set(expandedCategories)
    if (newSet.has(category)) {
      newSet.delete(category)
    } else {
      newSet.add(category)
    }
    setExpandedCategories(newSet)
  }

  const handleGenerateAI = async (question: ActionPlanQuestion) => {
    setGeneratingId(question.id)
    try {
      const projectContext = `Agis comme un consultant en entrepreneuriat spécialisé dans le contexte gabonais.

Projet: ${projectData.titre}
Secteur: ${projectData.secteur}
Budget disponible: ${projectData.budget}
Description: ${projectData.description}
Localisation: Gabon (Libreville, Port-Gentil, ou autre ville gabonaise)

Phase ${phase.phase}/5: ${phase.title}
Objectif: ${phase.objective}
Durée estimée: ${phase.duration}

Question: ${question.question}
Consigne: ${question.aiPrompt}

IMPORTANT:
- Adapte toutes les recommandations au contexte gabonais
- Utilise la devise FCFA pour tous les montants
- Mentionne des institutions, quartiers, entreprises gabonaises réelles quand pertinent
- Considère les spécificités locales (climat, culture, réglementation gabonaise)
- Sois concret et actionnable avec des tâches précises
- Propose des délais réalistes adaptés au rythme gabonais`

      const aiResponse = await onGenerateAIResponse(question, projectContext)
      setAnswers(prev => ({ ...prev, [question.id]: aiResponse }))
    } catch (error) {
      console.error('Error generating AI response:', error)
      alert('Erreur lors de la génération de la réponse')
    } finally {
      setGeneratingId(null)
    }
  }

  const handleSkip = (questionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: '' }))
  }

  const handleSubmit = async () => {
    if (!allAnswered) {
      alert(`Veuillez répondre à toutes les questions (${questions.length - answeredCount} restantes)`)
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Sauvegarder les réponses
      await onComplete(answers)

      // 2. Générer le document de la phase
      if (projectData.projectId && projectData.userId) {
        console.log(`📋 Génération de la phase "${phase.title}" du Plan d'Action...`)
        
        const response = await fetch(`${API_URL}/api/project-documents/generate-action-plan-phase`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectData.projectId,
            userId: projectData.userId,
            phase: {
              phase: phase.phase,
              title: phase.title,
              objective: phase.objective,
              duration: phase.duration
            },
            answers,
            projectData: {
              titre: projectData.titre,
              secteur: projectData.secteur,
              budget: projectData.budget,
              description: projectData.description
            }
          })
        })

        const data = await response.json()

        if (data.success) {
          console.log('✅ Document généré:', data.document.title)
          alert(`✅ Phase "${phase.title}" du Plan d'Action générée avec succès !\n\nRetrouvez-la dans l'onglet "Plan d'Action" de votre projet.`)
        } else {
          console.error('❌ Erreur génération document:', data.error)
          alert(`⚠️ Phase validée mais erreur lors de la génération du document: ${data.error}`)
        }
      }

      onClose()
    } catch (error) {
      console.error('Error submitting answers:', error)
      alert('Erreur lors de la validation')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-7 h-7 text-emerald-600" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Phase {phase.phase}/5: {phase.title}
                  </h2>
                </div>
                <p className="text-gray-700 mb-2">
                  🎯 {phase.objective}
                </p>
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Clock className="w-4 h-4" />
                  <span>Durée estimée: {phase.duration}</span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Alert Banner */}
          {!allAnswered && (
            <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-100">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm font-medium">
                  Toutes les tâches doivent être définies avant de continuer
                </span>
              </div>
            </div>
          )}

          {/* Questions */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {Object.entries(groupedQuestions).map(([category, categoryQuestions], catIndex) => {
              const isExpanded = expandedCategories.has(category)
              const categoryAnswered = categoryQuestions.filter(q => answers[q.id]?.trim()).length

              return (
                <div key={category} className="bg-emerald-50 rounded-lg border border-emerald-200">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full p-4 flex items-center justify-between hover:bg-emerald-100 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold text-gray-900">{category}</span>
                      <span className="px-2 py-1 bg-white rounded-full text-xs font-medium text-gray-600">
                        {categoryAnswered}/{categoryQuestions.length}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Category Questions */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-6 border-t border-emerald-200">
                          {categoryQuestions.map((question, qIndex) => {
                            const questionNumber = questions.findIndex(q => q.id === question.id) + 1
                            const hasAnswer = answers[question.id]?.trim()
                            const isGenerating = generatingId === question.id

                            return (
                              <div key={question.id} className="bg-white rounded-lg p-4 border border-gray-200">
                                {/* Question Header */}
                                <div className="flex items-start justify-between gap-4 mb-3">
                                  <h3 className="flex-1 text-base font-medium text-gray-900">
                                    {questionNumber}. {question.question}
                                  </h3>
                                  <div className="flex items-center gap-2">
                                    {hasAnswer && (
                                      <span className="text-emerald-600 text-sm">✓</span>
                                    )}
                                  </div>
                                </div>

                                {/* Answer Textarea */}
                                <textarea
                                  value={answers[question.id] || ''}
                                  onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                                  placeholder={question.placeholder}
                                  className="w-full min-h-[120px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-y"
                                  disabled={isGenerating}
                                />

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 mt-3">
                                  <button
                                    onClick={() => handleGenerateAI(question)}
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

                                  {!hasAnswer && (
                                    <button
                                      onClick={() => handleSkip(question.id)}
                                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                    >
                                      Passer
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium text-emerald-600">{answeredCount}</span>
                <span> / {questions.length} tâches définies</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={!allAnswered || isSubmitting}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Validation...</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5 h-5" />
                    <span>Terminer cette phase</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
