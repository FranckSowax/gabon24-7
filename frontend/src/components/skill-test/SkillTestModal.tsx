'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, XCircle, Target, TrendingUp } from 'lucide-react'

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  category: string
}

interface SkillTest {
  title: string
  description: string
  questions: Question[]
  scoring: {
    excellent: { min: number; message: string }
    good: { min: number; message: string }
    average: { min: number; message: string }
    needsWork: { message: string }
  }
}

interface SkillTestModalProps {
  open: boolean
  onClose: () => void
  test: SkillTest | null
  proposalTitle: string
  testId?: string | null
  userId?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function SkillTestModal({ open, onClose, test, proposalTitle, testId, userId }: SkillTestModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({})
  const [showResults, setShowResults] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!open || !test) return null

  const currentQuestion = test.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / test.questions.length) * 100
  const isLastQuestion = currentQuestionIndex === test.questions.length - 1

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestion.id]: optionIndex
    })
  }

  const handleNext = async () => {
    if (isLastQuestion) {
      // Calculer le score avant de sauvegarder
      const score = calculateScore()
      
      // Sauvegarder les résultats si testId et userId sont disponibles
      if (testId && userId) {
        setSaving(true)
        try {
          await fetch(`${API_URL}/api/skill-test/${testId}/complete`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              userAnswers: selectedAnswers,
              score: score.correct,
              scorePercentage: score.percentage
            })
          })
          console.log('✅ Résultats sauvegardés')
        } catch (error) {
          console.error('❌ Erreur sauvegarde résultats:', error)
        } finally {
          setSaving(false)
        }
      }
      
      setShowResults(true)
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const calculateScore = () => {
    let correct = 0
    test.questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correct++
      }
    })
    return {
      correct,
      total: test.questions.length,
      percentage: Math.round((correct / test.questions.length) * 100)
    }
  }

  const getScoreMessage = (percentage: number) => {
    if (percentage >= test.scoring.excellent.min) return test.scoring.excellent.message
    if (percentage >= test.scoring.good.min) return test.scoring.good.message
    if (percentage >= test.scoring.average.min) return test.scoring.average.message
    return test.scoring.needsWork.message
  }

  const resetTest = () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswers({})
    setShowResults(false)
  }

  const handleClose = () => {
    resetTest()
    onClose()
  }

  if (showResults) {
    const score = calculateScore()
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">📊 Résultats du Test</h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 mb-4">
                <div className="text-4xl font-bold text-black">
                  {score.percentage}%
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {score.correct} / {score.total} réponses correctes
              </h3>
              <p className="text-gray-300 text-lg mb-4">
                {getScoreMessage(score.percentage)}
              </p>
              
              {/* Message de sauvegarde */}
              {testId && userId && (
                <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-green-300 text-sm font-medium">
                    Test enregistré dans "Mes Projets"
                  </span>
                </div>
              )}
            </div>

            {/* Détail des réponses */}
            <div className="space-y-4 mb-6">
              <h4 className="text-lg font-semibold text-white mb-4">📋 Détail des réponses</h4>
              {test.questions.map((question, index) => {
                const userAnswer = selectedAnswers[question.id]
                const isCorrect = userAnswer === question.correctAnswer
                
                return (
                  <div
                    key={question.id}
                    className={`p-4 rounded-xl border ${
                      isCorrect
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="text-white font-medium mb-2">
                          {index + 1}. {question.question}
                        </p>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-300">
                            <span className="font-semibold">Votre réponse :</span>{' '}
                            {question.options[userAnswer]}
                          </p>
                          {!isCorrect && (
                            <p className="text-green-300">
                              <span className="font-semibold">Bonne réponse :</span>{' '}
                              {question.options[question.correctAnswer]}
                            </p>
                          )}
                          <p className="text-gray-400 mt-2 italic">
                            {question.explanation}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetTest}
                className="flex-1 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-semibold"
              >
                Refaire le test
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-colors font-semibold"
              >
                Terminer
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-slate-900 to-purple-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <Target className="w-6 h-6 text-yellow-400" />
                {test.title}
              </h2>
              <p className="text-gray-300 text-sm">{proposalTitle}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm text-gray-300 mb-2">
              <span>Question {currentQuestionIndex + 1} / {test.questions.length}</span>
              <span>{Math.round(progress)}% complété</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Category badge */}
          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-sm">
              {currentQuestion.category}
            </span>
          </div>

          {/* Question */}
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-white mb-6">
              {currentQuestion.question}
            </h3>

            {/* Options */}
            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswers[currentQuestion.id] === index

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    className={`w-full p-4 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-yellow-400/20 border-2 border-yellow-400'
                        : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-yellow-400 border-yellow-400'
                            : 'border-white/30'
                        }`}
                      >
                        {isSelected && <CheckCircle className="w-5 h-5 text-yellow-400" />}
                      </div>
                      <span className="text-white flex-1">{option}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>

            <button
              onClick={handleNext}
              disabled={selectedAnswers[currentQuestion.id] === undefined}
              className="flex-1 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLastQuestion ? 'Voir les résultats →' : 'Suivant →'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
