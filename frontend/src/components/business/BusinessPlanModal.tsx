'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Loader2, ChevronRight, AlertCircle, ArrowRight } from 'lucide-react'
import { BUSINESS_PLAN_SECTIONS, BusinessPlanQuestion } from '@/types/business-plan-questions'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface BusinessPlanModalProps {
  isOpen: boolean
  onClose: () => void
  section: {
    section: number
    title: string
    objective: string
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
  onGenerateAIResponse: (question: BusinessPlanQuestion, projectContext: string) => Promise<string>
}

// Les questions sont importées depuis business-plan-questions.ts

export default function BusinessPlanModal({
  isOpen,
  onClose,
  section,
  projectData,
  onComplete,
  onGenerateAIResponse
}: BusinessPlanModalProps) {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const sectionData = BUSINESS_PLAN_SECTIONS.find(s => s.section === section.section)
  const questions = sectionData?.questions || []
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length
  const allAnswered = answeredCount === questions.length

  // Grouper questions par catégorie
  // Pas de catégories pliables pour le business plan - toutes les questions sont affichées
  // On crée un groupe unique
  const groupedQuestions = { 'Questions': questions }

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

  const handleGenerateAI = async (question: BusinessPlanQuestion) => {
    setGeneratingId(question.id)
    try {
      const projectContext = `Agis comme un expert en stratégie et en création de business plans au Gabon.

Projet: ${projectData.titre}
Secteur: ${projectData.secteur}
Budget: ${projectData.budget}
Description: ${projectData.description}
Localisation: Gabon

Section ${section.section}: ${section.title}
Objectif: ${section.objective}
Question: ${question.question}
Consigne: ${question.aiPrompt}

Utilise un langage professionnel, la devise FCFA, et adapte au contexte gabonais.`
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

      // 2. Générer le document de l'étape
      if (projectData.projectId && projectData.userId) {
        console.log(`📄 Génération de la section "${section.title}" du Business Plan...`)
        
        const response = await fetch(`${API_URL}/api/project-documents/generate-business-plan-section`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectData.projectId,
            userId: projectData.userId,
            section: {
              section: section.section,
              title: section.title,
              objective: section.objective
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
          alert(`✅ Section "${section.title}" du Business Plan générée avec succès !\n\nRetrouvez-la dans l'onglet "Documents" de votre projet.`)
        } else {
          console.error('❌ Erreur génération document:', data.error)
          alert(`⚠️ Section validée mais erreur lors de la génération du document: ${data.error}`)
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
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Section {section.section}/10: {section.title}
                </h2>
                <p className="text-gray-600">
                  🎯 {section.objective}
                </p>
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
                  Toutes les questions doivent être répondues avant de continuer
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
                <div key={category} className="bg-gray-50 rounded-lg border border-gray-200">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t-lg"
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
                        <div className="p-4 space-y-6 border-t border-gray-200">
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
                                    <button
                                      onClick={() => handleSkip(question.id)}
                                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                      Skip
                                    </button>
                                    <button
                                      onClick={() => handleGenerateAI(question)}
                                      disabled={isGenerating}
                                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                      {isGenerating ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Génération...
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-4 h-4" />
                                          AI Answer
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Answer Textarea */}
                                <textarea
                                  value={answers[question.id] || ''}
                                  onChange={(e) => setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))}
                                  placeholder={question.placeholder}
                                  className="w-full px-4 py-3 bg-gray-50 text-gray-900 placeholder-gray-400 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none transition-colors"
                                  rows={4}
                                />

                                {hasAnswer && (
                                  <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                                    Réponse enregistrée
                                  </div>
                                )}
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                      style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 font-medium">
                    Section {section.section} sur 10
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!allAnswered || isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Génération...
                    </>
                  ) : (
                    <>
                      Valider et générer cette section
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
