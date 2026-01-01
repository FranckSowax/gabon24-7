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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex flex-col justify-end sm:justify-center sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.98 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden border border-white/10 flex flex-col"
          >
            {/* Header - Compact sur mobile */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 sm:p-6 relative flex-shrink-0">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="flex items-start gap-2 sm:gap-3 pr-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                  <Target className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-2xl font-bold text-white leading-tight line-clamp-2">{test.title}</h2>
                  <p className="text-white/80 text-xs sm:text-sm mt-1 line-clamp-2">{test.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4">
                {test.difficulty && (
                  <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium border ${getDifficultyColor(test.difficulty)}`}>
                    {test.difficulty.charAt(0).toUpperCase() + test.difficulty.slice(1)}
                  </span>
                )}
                <span className="text-white/80 text-xs sm:text-sm">
                  {test.questions.length} questions • Score minimum: {test.passingScore || 70}%
                </span>
              </div>
            </div>

            {/* Body - Scroll optimisé mobile */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
              {!showResults ? (
                <>
                  {/* Progress */}
                  <div className="mb-4 sm:mb-6">
                    <div className="flex justify-between text-xs sm:text-sm text-gray-400 mb-2">
                      <span>Question {currentQuestion + 1} / {test.questions.length}</span>
                      <span>{selectedAnswers.filter(a => a !== undefined).length} réponses</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / test.questions.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Question */}
                  <div className="bg-white/5 rounded-xl p-4 sm:p-6 border border-white/10 mb-4 sm:mb-6">
                    <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm sm:text-base">{currentQuestion + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                          {test.questions[currentQuestion].category}
                        </span>
                        <h3 className="text-sm sm:text-lg font-semibold text-white mt-1 leading-snug">
                          {test.questions[currentQuestion].question}
                        </h3>
                      </div>
                    </div>

                    {/* Options - Responsive */}
                    <div className="space-y-2 sm:space-y-3">
                      {test.questions[currentQuestion].options.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleAnswerSelect(index)}
                          className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all ${
                            selectedAnswers[currentQuestion] === index
                              ? 'border-blue-500 bg-blue-500/20'
                              : 'border-white/10 bg-white/5 hover:border-white/30 active:bg-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              selectedAnswers[currentQuestion] === index
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-500'
                            }`}>
                              {selectedAnswers[currentQuestion] === index && (
                                <div className="w-2 h-2 sm:w-3 sm:h-3 bg-white rounded-full" />
                              )}
                            </div>
                            <span className="text-white text-sm sm:text-base leading-snug">{option}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Results - Responsive */}
                  <div className="text-center mb-6 sm:mb-8">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 relative">
                      <svg className="transform -rotate-90 w-20 h-20 sm:w-24 sm:h-24">
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          className="text-gray-700 sm:hidden"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="32"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 32}`}
                          strokeDashoffset={`${2 * Math.PI * 32 * (1 - score / 100)}`}
                          className={`${getScoreColor(score)} sm:hidden`}
                          strokeLinecap="round"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="40"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-700 hidden sm:block"
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
                          className={`${getScoreColor(score)} hidden sm:block`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-2xl sm:text-3xl font-bold ${getScoreColor(score)}`}>
                          {score}%
                        </span>
                      </div>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                      {score >= test.passingScore ? 'Félicitations !' : 'Continuez vos efforts !'}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-400">
                      {score >= test.passingScore
                        ? `Vous avez réussi le test avec ${score}% !`
                        : `Vous avez obtenu ${score}%. Score minimum requis: ${test.passingScore}%`}
                    </p>
                  </div>

                  {/* Detailed Results - Responsive */}
                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    {test.questions.map((q, index) => {
                      const isCorrect = selectedAnswers[index] === q.correctAnswer
                      return (
                        <div
                          key={index}
                          className={`p-3 sm:p-4 rounded-lg border-2 ${
                            isCorrect
                              ? 'border-green-500/30 bg-green-500/10'
                              : 'border-red-500/30 bg-red-500/10'
                          }`}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            {isCorrect ? (
                              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            ) : (
                              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium text-sm sm:text-base mb-1 leading-snug">{q.question}</p>
                              <p className="text-xs sm:text-sm text-gray-400 mb-1 sm:mb-2">
                                Votre réponse: {q.options[selectedAnswers[index]]}
                              </p>
                              {!isCorrect && (
                                <p className="text-xs sm:text-sm text-green-400 mb-1 sm:mb-2">
                                  Bonne réponse: {q.options[q.correctAnswer]}
                                </p>
                              )}
                              <p className="text-xs sm:text-sm text-gray-300 italic leading-snug">
                                {q.explanation}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Actions - Responsive */}
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={resetTest}
                      className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline">Refaire</span>
                      <span className="sm:hidden">Refaire</span>
                    </button>
                    <button
                      onClick={() => setShowDifficultySelector(true)}
                      className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                      Nouveau test
                    </button>
                  </div>
                </>
              )}

              {/* Previous Scores - Responsive */}
              {previousScores.length > 0 && !showResults && (
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                    <h4 className="font-semibold text-white text-sm sm:text-base">Scores précédents</h4>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    {previousScores.slice(0, 3).map((s, i) => (
                      <div key={i} className="flex justify-between text-xs sm:text-sm">
                        <span className="text-gray-400">
                          {new Date(s.date).toLocaleDateString('fr-FR')} • {s.difficulty}
                        </span>
                        <span className={getScoreColor(s.score)}>{s.score}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Navigation - Sticky sur mobile */}
            {!showResults && (
              <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/10 bg-gray-900/95 backdrop-blur-sm flex-shrink-0">
                <div className="flex justify-between gap-3">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestion === 0}
                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={selectedAnswers[currentQuestion] === undefined}
                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    {currentQuestion === test.questions.length - 1 ? 'Terminer' : 'Suivant'}
                  </button>
                </div>
              </div>
            )}

            {/* Difficulty Selector Modal - Responsive */}
            {showDifficultySelector && (
              <div className="fixed inset-0 bg-black/50 flex flex-col justify-end sm:justify-center sm:items-center z-10" onClick={() => setShowDifficultySelector(false)}>
                <div
                  className="bg-gray-800 rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full sm:max-w-md sm:mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-3 sm:mb-4">Choisir la difficulté</h3>
                  <div className="space-y-2 sm:space-y-3">
                    {(['facile', 'moyen', 'difficile'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => {
                          onRegenerateTest(diff)
                          setShowDifficultySelector(false)
                          resetTest()
                        }}
                        className={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-all active:scale-[0.98] ${getDifficultyColor(diff)}`}
                      >
                        <div className="font-bold text-base sm:text-lg mb-0.5 sm:mb-1">
                          {diff.charAt(0).toUpperCase() + diff.slice(1)}
                        </div>
                        <div className="text-xs sm:text-sm opacity-80">
                          {diff === 'facile' && '10 questions • Concepts de base'}
                          {diff === 'moyen' && '15 questions • Application pratique'}
                          {diff === 'difficile' && '20 questions • Expertise avancée'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowDifficultySelector(false)}
                    className="w-full mt-3 sm:mt-4 px-4 py-2.5 sm:py-3 bg-gray-700 text-white rounded-lg font-medium hover:bg-gray-600 transition-all text-sm sm:text-base"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
