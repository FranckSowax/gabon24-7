'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Loader2, ChevronRight, AlertCircle, Copy, ArrowLeft, ArrowRight } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface StepQuestion {
  id: string
  question: string
  placeholder: string
  aiPrompt: string
  category?: string
}

interface StepActionModalProps {
  isOpen: boolean
  onClose: () => void
  step: {
    step: number
    title: string
    description: string
    status: string
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
  onGenerateAIResponse: (question: StepQuestion, projectContext: string) => Promise<string>
}

// Questions par type d'étape
const STEP_QUESTIONS: { [key: number]: StepQuestion[] } = {
  1: [ // Étude de marché
    {
      id: 'market_size',
      question: 'Quelle est la taille estimée du marché au Gabon ?',
      placeholder: 'Ex: Le marché de l\'agriculture bio au Gabon représente...',
      aiPrompt: 'Estime la taille du marché au Gabon avec des chiffres réalistes',
      category: 'Marché'
    },
    {
      id: 'target_customers',
      question: 'Qui sont vos clients cibles ?',
      placeholder: 'Ex: Particuliers, entreprises, restaurants...',
      aiPrompt: 'Identifie les segments de clients cibles pour ce projet',
      category: 'Clientèle'
    },
    {
      id: 'competitors',
      question: 'Qui sont vos principaux concurrents ?',
      placeholder: 'Ex: Noms d\'entreprises concurrentes...',
      aiPrompt: 'Liste les principaux concurrents potentiels au Gabon',
      category: 'Concurrence'
    },
    {
      id: 'market_trends',
      question: 'Quelles sont les tendances du marché ?',
      placeholder: 'Ex: Croissance de la demande bio...',
      aiPrompt: 'Décris les tendances actuelles du marché gabonais',
      category: 'Tendances'
    }
  ],
  2: [ // Validation concept
    {
      id: 'technical_feasibility',
      question: 'Le projet est-il techniquement réalisable ?',
      placeholder: 'Ex: Oui, avec les ressources disponibles...',
      aiPrompt: 'Analyse la faisabilité technique du projet',
      category: 'Technique'
    },
    {
      id: 'required_resources',
      question: 'Quelles ressources sont nécessaires ?',
      placeholder: 'Ex: Terrain, équipement, personnel...',
      aiPrompt: 'Liste les ressources nécessaires pour démarrer',
      category: 'Ressources'
    },
    {
      id: 'timeline',
      question: 'Quel est le calendrier de mise en œuvre ?',
      placeholder: 'Ex: 6 mois de préparation, lancement au T3...',
      aiPrompt: 'Propose un calendrier réaliste de mise en œuvre',
      category: 'Planning'
    }
  ],
  3: [ // Business plan
    {
      id: 'revenue_model',
      question: 'Quel est votre modèle de revenus ?',
      placeholder: 'Ex: Vente directe, abonnements...',
      aiPrompt: 'Décris le modèle de revenus adapté à ce projet',
      category: 'Revenus'
    },
    {
      id: 'cost_structure',
      question: 'Quelle est la structure de coûts ?',
      placeholder: 'Ex: Coûts fixes, variables...',
      aiPrompt: 'Détaille la structure de coûts prévue',
      category: 'Coûts'
    },
    {
      id: 'break_even',
      question: 'Quand atteindrez-vous la rentabilité ?',
      placeholder: 'Ex: 18 mois après le lancement...',
      aiPrompt: 'Estime le délai de rentabilité réaliste',
      category: 'Rentabilité'
    }
  ],
  4: [ // Recherche financement
    {
      id: 'funding_sources',
      question: 'Quelles sources de financement visez-vous ?',
      placeholder: 'Ex: Banques, investisseurs, subventions...',
      aiPrompt: 'Identifie les sources de financement disponibles au Gabon',
      category: 'Sources'
    },
    {
      id: 'funding_amount',
      question: 'Quel montant devez-vous lever ?',
      placeholder: 'Ex: 50 millions FCFA...',
      aiPrompt: 'Calcule le besoin de financement basé sur le budget',
      category: 'Montant'
    },
    {
      id: 'guarantees',
      question: 'Quelles garanties pouvez-vous offrir ?',
      placeholder: 'Ex: Apport personnel, caution, actifs...',
      aiPrompt: 'Liste les garanties possibles pour obtenir un financement',
      category: 'Garanties'
    }
  ],
  5: [ // Formalités administratives
    {
      id: 'legal_structure',
      question: 'Quelle structure juridique choisir ?',
      placeholder: 'Ex: SARL, SA, Entreprise individuelle...',
      aiPrompt: 'Recommande la structure juridique adaptée au Gabon',
      category: 'Juridique'
    },
    {
      id: 'licenses',
      question: 'Quelles licences/autorisations sont nécessaires ?',
      placeholder: 'Ex: Licence commerciale, permis...',
      aiPrompt: 'Liste les licences et autorisations requises au Gabon',
      category: 'Autorisations'
    },
    {
      id: 'registration_steps',
      question: 'Quelles sont les étapes d\'enregistrement ?',
      placeholder: 'Ex: RCCM, CNSS, impôts...',
      aiPrompt: 'Décris les étapes d\'enregistrement d\'entreprise au Gabon',
      category: 'Enregistrement'
    }
  ],
  6: [ // Partenariats clés
    {
      id: 'key_partners',
      question: 'Qui sont vos partenaires stratégiques ?',
      placeholder: 'Ex: Fournisseurs, distributeurs...',
      aiPrompt: 'Identifie les partenaires clés nécessaires',
      category: 'Partenaires'
    },
    {
      id: 'partnership_terms',
      question: 'Quels sont les termes de partenariat ?',
      placeholder: 'Ex: Accords commerciaux, contrats...',
      aiPrompt: 'Propose des termes de partenariat équitables',
      category: 'Termes'
    }
  ],
  7: [ // Infrastructure
    {
      id: 'location',
      question: 'Où sera localisé le projet ?',
      placeholder: 'Ex: Libreville, Zone industrielle...',
      aiPrompt: 'Recommande une localisation optimale au Gabon',
      category: 'Localisation'
    },
    {
      id: 'equipment',
      question: 'Quel équipement est nécessaire ?',
      placeholder: 'Ex: Machines, véhicules, outils...',
      aiPrompt: 'Liste l\'équipement nécessaire pour démarrer',
      category: 'Équipement'
    },
    {
      id: 'infrastructure_cost',
      question: 'Quel est le coût de l\'infrastructure ?',
      placeholder: 'Ex: Location, aménagement...',
      aiPrompt: 'Estime le coût de mise en place de l\'infrastructure',
      category: 'Coûts'
    }
  ],
  8: [ // Recrutement
    {
      id: 'team_size',
      question: 'Combien de personnes recruter ?',
      placeholder: 'Ex: 5 employés au départ...',
      aiPrompt: 'Recommande la taille d\'équipe initiale',
      category: 'Équipe'
    },
    {
      id: 'key_positions',
      question: 'Quels sont les postes clés ?',
      placeholder: 'Ex: Manager, techniciens, commerciaux...',
      aiPrompt: 'Identifie les postes clés à recruter en priorité',
      category: 'Postes'
    },
    {
      id: 'salary_budget',
      question: 'Quel est le budget salarial ?',
      placeholder: 'Ex: 2 millions FCFA/mois...',
      aiPrompt: 'Calcule le budget salarial mensuel',
      category: 'Salaires'
    }
  ],
  9: [ // Test pilote
    {
      id: 'pilot_scope',
      question: 'Quel sera le périmètre du test ?',
      placeholder: 'Ex: 100 premiers clients, 3 mois...',
      aiPrompt: 'Définis un périmètre de test pilote réaliste',
      category: 'Périmètre'
    },
    {
      id: 'success_metrics',
      question: 'Quels indicateurs de succès ?',
      placeholder: 'Ex: Taux de satisfaction, chiffre d\'affaires...',
      aiPrompt: 'Propose des indicateurs de succès mesurables',
      category: 'Métriques'
    }
  ],
  10: [ // Lancement officiel
    {
      id: 'launch_date',
      question: 'Quelle est la date de lancement ?',
      placeholder: 'Ex: 1er janvier 2026...',
      aiPrompt: 'Propose une date de lancement réaliste',
      category: 'Planning'
    },
    {
      id: 'marketing_strategy',
      question: 'Quelle est votre stratégie marketing ?',
      placeholder: 'Ex: Réseaux sociaux, événement...',
      aiPrompt: 'Décris une stratégie marketing de lancement',
      category: 'Marketing'
    },
    {
      id: 'launch_budget',
      question: 'Quel est le budget de lancement ?',
      placeholder: 'Ex: 5 millions FCFA...',
      aiPrompt: 'Estime le budget nécessaire pour le lancement',
      category: 'Budget'
    }
  ]
}

export default function StepActionModal({
  isOpen,
  onClose,
  step,
  projectData,
  onComplete,
  onGenerateAIResponse
}: StepActionModalProps) {
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const questions = STEP_QUESTIONS[step.step] || []
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.trim()).length
  const allAnswered = answeredCount === questions.length

  // Grouper questions par catégorie
  const groupedQuestions = questions.reduce((acc, q) => {
    const cat = q.category || 'Général'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(q)
    return acc
  }, {} as { [key: string]: StepQuestion[] })

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

  const handleGenerateAI = async (question: StepQuestion) => {
    setGeneratingId(question.id)
    try {
      const projectContext = `
Projet: ${projectData.titre}
Secteur: ${projectData.secteur}
Budget: ${projectData.budget}
Description: ${projectData.description}

Étape ${step.step}: ${step.title}
Question: ${question.question}
Consigne: ${question.aiPrompt}
`
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
        console.log(`📄 Génération du document pour l'étape "${step.title}"...`)
        
        const response = await fetch(`${API_URL}/api/project-documents/generate-from-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: projectData.projectId,
            userId: projectData.userId,
            step: {
              step: step.step,
              title: step.title,
              description: step.description
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
          alert(`✅ Document "${step.title}" généré avec succès !\n\nRetrouvez-le dans l'onglet "Documents" de votre projet.`)
        } else {
          console.error('❌ Erreur génération document:', data.error)
          alert(`⚠️ Étape validée mais erreur lors de la génération du document: ${data.error}`)
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
                  Étape {step.step}: {step.title}
                </h2>
                <p className="text-gray-600">
                  {step.description}
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
                    Étape {step.step} sur 10
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
                      Valider et générer le document
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
