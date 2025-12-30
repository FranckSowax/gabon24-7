'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, XCircle, RefreshCw, Trophy, Target, Zap } from 'lucide-react'

interface Question {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  category: string
}

interface SkillTest {
  title: string
  description: string
  difficulty: 'facile' | 'moyen' | 'difficile'
  questions: Question[]
  passingScore: number
}

interface SkillTestModalProps {
  isOpen: boolean
  onClose: () => void
  test: SkillTest | null
  onRegenerateTest: (difficulty: 'facile' | 'moyen' | 'difficile') => void
  previousScores?: Array<{ score: number, date: string, difficulty: string }>
}

export default function SkillTestModal({
  isOpen,
  onClose,
  test,
  onRegenerateTest,
  previousScores = []
}: SkillTestModalProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [showResults, setShowResults] = useState(false)
  const [score, setScore] = useState(0)
  const [showDifficultySelector, setShowDifficultySelector] = useState(false)

  if (!test) return null

  const handleAnswerSelect = (answerIndex: number) => {
    const newAnswers = [...selectedAnswers]
    newAnswers[currentQuestion] = answerIndex
    setSelectedAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      calculateScore()
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }

  const calculateScore = () => {
    let correct = 0
    test.questions.forEach((q, index) => {
      if (selectedAnswers[index] === q.correctAnswer) {
        correct++
      }
    })
    const finalScore = Math.round((correct / test.questions.length) * 100)
    setScore(finalScore)
    setShowResults(true)
  }

  const resetTest = () => {
    setCurrentQuestion(0)
    setSelectedAnswers([])
    setShowResults(false)
    setScore(0)
  }

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'facile': return 'text-green-400 bg-green-500/20 border-green-500/30'
      case 'moyen': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'difficile': return 'text-red-400 bg-red-500/20 border-red-500/30'
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-400'
    if (s >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-white/10"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{test.title}</h2>
                  <p className="text-white/80 text-sm">{test.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-4">
                {test.difficulty && (
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getDifficultyColor(test.difficulty)}`}>
                    {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                  </span>
                )}
                <span className="text-white/80 text-sm">
                  {test.questions.length} questions • Score minimum: {test.passingScore || 70}%
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {!showResults ? (
                <>
                  {/* Progress */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm text-gray-400 mb-2">
                      <span>Question {currentQuestion + 1} / {test.questions.length}</span>
                      <span>{selectedAnswers.filter(a => a !== undefined).length} réponses</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / test.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-6">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold">{currentQuestion + 1}</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">
                          {test.questions[currentQuestion].category}
                        </span>
                        <h3 className="text-lg font-semibold text-white mt-1">
                          {test.questions[currentQuestion].question}
                        </h3>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      {test.questions[currentQuestion].options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleAnswerSelect(index)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            selectedAnswers[currentQuestion] === index
                              ? 'border-blue-500 bg-blue-500/20'
                              : 'border-white/10 bg-white/5 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              selectedAnswers[currentQuestion] === index
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-500'
                            }`}>
                              {selectedAnswers[currentQuestion] === index && (
                                <div className="w-3 h-3 bg-white rounded-full" />
                              )}
                            </div>
                            <span className="text-white">{option}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="flex justify-between">
                    <button
                      onClick={handlePrevious}
                      disabled={currentQuestion === 0}
                      className="px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Précédent
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={selectedAnswers[currentQuestion] === undefined}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {currentQuestion === test.questions.length - 1 ? 'Terminer' : 'Suivant'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Results */}
                  <div className="text-center mb-8">
                    <div className="w-24 h-24 mx-auto mb-4 relative">
                      <svg className="transform -rotate-90 w-24 h-24">
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 40}`}
                          strokeDashoffset={`${2 * Math.PI * 40 * (1 - score / 100)}`}
                          className={getScoreColor(score)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-3xl font-bold ${getScoreColor(score)}`}>
                          {score}%
                        </span>
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-2">
                      {score >= test.passingScore ? '🎉 Félicitations !' : '💪 Continuez vos efforts !'}
                    </h3>
                    <p className="text-gray-400">
                      {score >= test.passingScore
                        ? `Vous avez réussi le test avec ${score}% !`
                        : `Vous avez obtenu ${score}%. Score minimum requis: ${test.passingScore}%`}
                    </p>
                  </div>

                  {/* Detailed Results */}
                  <div className="space-y-4 mb-6">
                    {test.questions.map((q, index) => {
                      const isCorrect = selectedAnswers[index] === q.correctAnswer
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${
                            isCorrect
                              ? 'border-green-500/30 bg-green-500/10'
                              : 'border-red-500/30 bg-red-500/10'
                          }`}
                        >
                          <div className="flex items-start gap-3 mb-2">
                            {isCorrect ? (
                              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="text-white font-medium mb-1">{q.question}</p>
                              <p className="text-sm text-gray-400 mb-2">
                                Votre réponse: {q.options[selectedAnswers[index]]}
                              </p>
                              {!isCorrect && (
                                <p className="text-sm text-green-400 mb-2">
                                  Bonne réponse: {q.options[q.correctAnswer]}
                                </p>
                              )}
                              <p className="text-sm text-gray-300 italic">
                                {q.explanation}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={resetTest}
                      className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Refaire
                    </button>
                    <button
                      onClick={() => setShowDifficultySelector(true)}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Zap className="w-5 h-5" />
                      Nouveau test
                    </button>
                  </div>
                </>
              )}

              {/* Previous Scores */}
              {previousScores.length > 0 && !showResults && (
                <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h4 className="font-semibold text-white">Scores précédents</h4>
                  </div>
                  <div className="space-y-2">
                    {previousScores.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          {new Date(s.date).toLocaleDateString('fr-FR')} • {s.difficulty}
                        </span>
                        <span className={getScoreColor(s.score)}>{s.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Difficulty Selector */}
              {showDifficultySelector && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-10" onClick={() => setShowDifficultySelector(false)}>
                  <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-white mb-4">Choisir la difficulté</h3>
                    <div className="space-y-3">
                      {(['facile', 'moyen', 'difficile'] as const).map((diff) => (
                        <button
                          key={diff}
                          onClick={() => {
                            onRegenerateTest(diff)
                            setShowDifficultySelector(false)
                            resetTest()
                          }}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all hover:scale-105 ${getDifficultyColor(diff)}`}
                        >
                          <div className="font-bold text-lg mb-1">
                            {diff.charAt(0).toUpperCase() + diff.slice(1)}
                          </div>
                          <div className="text-sm opacity-80">
                            {diff === 'facile' && '10 questions • Concepts de base'}
                            {diff === 'moyen' && '15 questions • Application pratique'}
                            {diff === 'difficile' && '20 questions • Expertise avancée'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
