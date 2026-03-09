'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BarChart3, ChevronLeft, ChevronRight, Clock, CheckCircle2, Vote } from 'lucide-react'
import AuthModal from '@/components/auth/AuthModal'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Poll {
  id: string
  question: string
  poll_type: 'yes_no' | 'mcq' | 'series'
  options: string[]
  total_votes: number
  expires_at: string
  created_at: string
  is_active: boolean
}

interface PollQuestion {
  id: string
  poll_id: string
  question_text: string
  question_type: 'yes_no' | 'mcq'
  options: string[]
  question_order: number
}

interface PollStats {
  response_value: string
  vote_count: number
  percentage: number
}

interface PollWidgetProps {
  articles?: any[]
  className?: string
}

export default function MultiQuestionPollWidget({ articles = [], className = '' }: PollWidgetProps) {
  const { user } = useAuth()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [pollQuestions, setPollQuestions] = useState<PollQuestion[]>([])
  const [questionStats, setQuestionStats] = useState<Record<string, any[]>>({})
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [votedQuestions, setVotedQuestions] = useState<Set<string>>(new Set())
  const [isVoting, setIsVoting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  // État pour les styles dynamiques basés sur l'heure (évite hydration mismatch)
  const [timeBasedStyles, setTimeBasedStyles] = useState({
    gradient: 'from-orange-50 via-rose-50 to-pink-50', // Valeur par défaut (jour)
    isNight: false
  })

  // Calculer le temps restant jusqu'au prochain sondage (19h UTC)
  const calculateTimeRemaining = () => {
    const now = new Date()
    const nextPoll = new Date()
    
    nextPoll.setUTCHours(19, 0, 0, 0)
    
    if (now.getTime() >= nextPoll.getTime()) {
      nextPoll.setUTCDate(nextPoll.getUTCDate() + 1)
    }
    
    const diff = nextPoll.getTime() - now.getTime()
    
    if (diff <= 0) {
      return '00:00:00'
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // Charger les sondages actifs
  const loadPolls = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`${API_URL}/api/polls`)
      const data = await response.json()
      
      if (!data.success) {
        console.error('Erreur lors du chargement des sondages:', data.error)
        return
      }

      console.log('📊 Sondages chargés:', data.polls)
      
      if (data.polls && data.polls.length > 0) {
        setPolls(data.polls)
        
        // Charger les questions pour le premier sondage actif
        const activePoll = data.polls.find((poll: Poll) => poll.is_active === true)
        console.log('🔍 Sondage actif trouvé:', activePoll)
        if (activePoll && activePoll.poll_type === 'series') {
          console.log('⏳ Chargement des questions pour le sondage:', activePoll.id)
          await loadPollQuestions(activePoll.id)

          // Vérifier si l'utilisateur a déjà voté pour ce sondage - seulement si connecté
          if (user) {
            await checkExistingVotes(activePoll.id)
          }
        } else if (activePoll && (activePoll.poll_type === 'mcq' || activePoll.poll_type === 'yes_no' || activePoll.poll_type)) {
          console.log(`✅ Sondage ${activePoll.poll_type} actif trouvé, création d'une question simple`)
          // Créer une question simple pour le sondage (mcq ou yes_no)
          const simpleQuestion: PollQuestion = {
            id: activePoll.id,
            poll_id: activePoll.id,
            question_text: activePoll.question,
            question_type: activePoll.poll_type === 'yes_no' ? 'yes_no' : 'mcq',
            options: activePoll.options || [],
            question_order: 1
          }
          setPollQuestions([simpleQuestion])
          await loadQuestionStats(activePoll.id)

          if (user) {
            await checkExistingVotes(activePoll.id)
          }
        } else {
          console.log('❌ Aucun sondage actif trouvé')
        }
      } else {
        console.log('❌ Aucun sondage disponible')
      }
      
    } catch (error) {
      console.error('Erreur lors du chargement des sondages:', error)
    } finally {
      setLoading(false)
    }
  }

  // Charger les questions d'un sondage
  const loadPollQuestions = async (pollId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/polls/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId })
      })
      
      const data = await response.json()
      
      if (data.success && data.questions) {
        setPollQuestions(data.questions)
        
        // Charger les statistiques pour chaque question
        for (const question of data.questions) {
          await loadQuestionStats(question.id)
        }
      }
      
    } catch (error) {
      console.error('Erreur lors du chargement des questions:', error)
    }
  }

  // Charger les statistiques d'une question
  const loadQuestionStats = async (questionId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/polls/stats?question_id=${questionId}`)
      const data = await response.json()
      
      if (data.success) {
        setQuestionStats(prev => ({
          ...prev,
          [questionId]: data.stats
        }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error)
    }
  }

  // Vérifier si l'utilisateur a déjà voté pour les questions du sondage
  const checkExistingVotes = async (pollId: string) => {
    if (!user) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/polls/check-votes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pollId: pollId,
          userId: user.id
        })
      })
      
      if (!response.ok) {
        console.error('Erreur HTTP lors de la vérification des votes:', response.status, response.statusText)
        return
      }

      const data = await response.json()
      
      if (data.success && data.votes && data.votes.length > 0) {
        // L'utilisateur a déjà voté pour certaines questions
        const votedSet = new Set<string>(data.votes.map((q: any) => String(q.question_id)))
        setVotedQuestions(votedSet)
        
        // Si l'utilisateur a voté pour toutes les questions, afficher directement les résultats
        if (votedSet.size === pollQuestions.length && pollQuestions.length > 0) {
          // Charger les statistiques pour toutes les questions
          for (const question of pollQuestions) {
            await loadQuestionStats(question.id)
          }
          setShowResults(true)
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des votes existants:', error)
    }
  }

  // Voter pour une question
  const voteForQuestion = async (questionId: string, answer: string) => {
    if (votedQuestions.has(questionId) || isVoting) return

    if (!user) {
      setShowAuthModal(true)
      return
    }

    try {
      setIsVoting(true)
      
      const response = await fetch(`${API_URL}/api/polls/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId,
          response: answer,
          userId: user.id,
          pollId: pollQuestions.find(q => q.id === questionId)?.poll_id
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setVotedQuestions(prev => new Set(Array.from(prev).concat(questionId)))
        
        // Mettre à jour les statistiques
        if (data.stats) {
          setQuestionStats(prev => ({
            ...prev,
            [questionId]: data.stats
          }))
        }
      } else {
        console.error('Erreur lors du vote:', data.error)
      }
      
    } catch (error) {
      console.error('Erreur lors du vote:', error)
    } finally {
      setIsVoting(false)
    }
  }

  // Navigation entre les questions
  const goToNext = () => {
    if (currentQuestionIndex < pollQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const goToPrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  // Gérer la sélection d'une réponse
  const handleAnswerSelect = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
    
    // Marquer automatiquement que toutes les questions ont été répondues si c'est le cas
    const updatedAnswers = { ...selectedAnswers, [questionId]: answer }
    const answeredCount = Object.keys(updatedAnswers).length
    
    if (answeredCount === pollQuestions.length) {
      setAllQuestionsAnswered(true)
    }
  }

  // Soumettre tous les votes
  const submitAllVotes = async () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }

    setIsVoting(true)
    
    try {
      let hasVotingErrors = false
      
      // Voter pour chaque question
      for (const question of pollQuestions) {
        const answer = selectedAnswers[question.id]
        if (answer && !votedQuestions.has(question.id)) {
          try {
            await voteForQuestion(question.id, answer)
          } catch (error) {
            // Si l'utilisateur a déjà voté, marquer comme voté et continuer
            if ((error as any)?.message?.includes('déjà voté')) {
              setVotedQuestions(prev => new Set(Array.from(prev).concat([question.id])))
            } else {
              hasVotingErrors = true
              console.error(`Erreur lors du vote pour la question ${question.id}:`, error)
            }
          }
        }
      }
      
      // Charger les statistiques finales
      for (const question of pollQuestions) {
        await loadQuestionStats(question.id)
      }
      
      // Afficher les résultats même s'il y a eu des erreurs de vote
      setShowResults(true)
      
    } catch (error) {
      console.error('Erreur générale lors du vote:', error)
    } finally {
      setIsVoting(false)
    }
  }

  useEffect(() => {
    loadPolls()
    
    // Mettre à jour le temps restant toutes les secondes
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Vérifier les votes quand l'utilisateur change
  useEffect(() => {
    if (user && polls.length > 0) {
      const activePoll = polls.find(poll => poll.is_active)
      if (activePoll) {
        checkExistingVotes(activePoll.id)
      }
    } else if (!user) {
      setVotedQuestions(new Set())
      setShowResults(false)
    }
  }, [user, polls])

  // Calcul des styles côté client uniquement (évite hydration mismatch)
  useEffect(() => {
    const updateTimeStyles = () => {
      const hour = new Date().getHours()
      let gradient = 'from-orange-50 via-rose-50 to-pink-50'
      if (hour >= 6 && hour < 12) gradient = 'from-orange-50 via-amber-50 to-yellow-50'
      else if (hour >= 12 && hour < 18) gradient = 'from-orange-50 via-rose-50 to-pink-50'
      else if (hour >= 18 && hour < 21) gradient = 'from-purple-100 via-pink-100 to-orange-100'
      else gradient = 'from-slate-800 via-purple-900 to-slate-900'

      setTimeBasedStyles({
        gradient,
        isNight: hour >= 21 || hour < 6
      })
    }

    updateTimeStyles()
    const interval = setInterval(updateTimeStyles, 60000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className={`rounded-3xl h-[500px] bg-gradient-to-br ${timeBasedStyles.gradient} shadow-xl border border-white/20 p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/30 rounded-xl w-2/3"></div>
          <div className="h-4 bg-white/20 rounded-lg w-1/2"></div>
          <div className="space-y-3 mt-8">
            <div className="h-12 bg-white/20 rounded-xl"></div>
            <div className="h-12 bg-white/20 rounded-xl"></div>
            <div className="h-12 bg-white/20 rounded-xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (pollQuestions.length === 0) {
    return (
      <div className={`rounded-3xl h-[500px] bg-gradient-to-br ${timeBasedStyles.gradient} ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-800'} shadow-xl border border-white/20 p-4 ${className}`}>
        <div className="h-full flex flex-col items-center justify-center text-center">
          <BarChart3 className="w-16 h-16 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Aucun sondage disponible</h3>
          <p className={`text-sm mb-4 ${timeBasedStyles.isNight ? 'text-white/60' : 'text-gray-500'}`}>
            Prochain sondage dans :
          </p>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${timeBasedStyles.isNight ? 'bg-white/10' : 'bg-white/50'}`}>
            <Clock className="w-5 h-5 text-orange-500" />
            <span className="text-xl font-mono font-bold text-orange-500">{timeRemaining}</span>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = pollQuestions[currentQuestionIndex]
  const hasVotedForCurrent = votedQuestions.has(currentQuestion?.id || '')
  const selectedAnswer = selectedAnswers[currentQuestion?.id || '']
  const currentStats = questionStats[currentQuestion?.id || ''] || []

  return (
    <div className={`rounded-3xl h-[500px] overflow-hidden bg-gradient-to-br ${timeBasedStyles.gradient} ${timeBasedStyles.isNight ? 'text-white' : 'text-gray-800'} shadow-xl border border-white/20 ${className}`}>
      {/* Contenu principal */}
      <div className="p-4 h-full box-border">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${timeBasedStyles.isNight ? 'bg-white/10' : 'bg-white/50'}`}>
              <BarChart3 className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Sondage du jour</h3>
              {pollQuestions.length > 1 && (
                <p className={`text-xs ${timeBasedStyles.isNight ? 'text-white/60' : 'text-gray-500'}`}>
                  Question {currentQuestionIndex + 1}/{pollQuestions.length}
                </p>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${timeBasedStyles.isNight ? 'bg-white/10' : 'bg-white/50'}`}>
            <Clock className="w-3 h-3 text-orange-500" />
            <span className="font-mono text-orange-500">{timeRemaining}</span>
          </div>
        </div>

        {/* Question */}
        <div className={`rounded-2xl p-3 mb-3 ${timeBasedStyles.isNight ? 'bg-white/5' : 'bg-white/40'}`}>
          <h4 className="text-sm font-medium mb-3">{currentQuestion?.question_text}</h4>

          {!hasVotedForCurrent && !showResults ? (
            <div className="space-y-2">
              {currentQuestion?.question_type === 'yes_no' ? (
                <>
                  <button
                    onClick={() => handleAnswerSelect(currentQuestion.id, 'Oui')}
                    className={`w-full p-3 text-left rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]
                      ${selectedAnswer === 'Oui'
                        ? `${timeBasedStyles.isNight ? 'bg-orange-500/30 border-orange-400' : 'bg-orange-100 border-orange-400'} border-2`
                        : `${timeBasedStyles.isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-white/50 hover:bg-white/70'} border-2 border-transparent`
                      }`}
                  >
                    ✅ Oui
                  </button>
                  <button
                    onClick={() => handleAnswerSelect(currentQuestion.id, 'Non')}
                    className={`w-full p-3 text-left rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]
                      ${selectedAnswer === 'Non'
                        ? `${timeBasedStyles.isNight ? 'bg-orange-500/30 border-orange-400' : 'bg-orange-100 border-orange-400'} border-2`
                        : `${timeBasedStyles.isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-white/50 hover:bg-white/70'} border-2 border-transparent`
                      }`}
                  >
                    ❌ Non
                  </button>
                </>
              ) : (
                currentQuestion?.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                    className={`w-full p-3 text-left rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98]
                      ${selectedAnswer === option
                        ? `${timeBasedStyles.isNight ? 'bg-orange-500/30 border-orange-400' : 'bg-orange-100 border-orange-400'} border-2`
                        : `${timeBasedStyles.isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-white/50 hover:bg-white/70'} border-2 border-transparent`
                      }`}
                  >
                    {option}
                  </button>
                ))
              )}

              {/* Bouton Voter */}
              {selectedAnswer && currentQuestionIndex === pollQuestions.length - 1 && allQuestionsAnswered && (
                <button
                  onClick={submitAllVotes}
                  disabled={isVoting}
                  className="w-full mt-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-200 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVoting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      <span>Envoi...</span>
                    </>
                  ) : (
                    <>
                      <Vote className="w-4 h-4" />
                      <span>Voter</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-500 text-sm font-medium mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Vous avez voté</span>
              </div>
              
              {currentStats.map((stat, index) => (
                <div key={index} className={`p-2 rounded-xl ${timeBasedStyles.isNight ? 'bg-white/5' : 'bg-white/50'}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{stat.response_value}</span>
                    <span className="text-orange-500 font-semibold">{stat.percentage.toFixed(0)}%</span>
                  </div>
                  <div className={`h-2 rounded-full ${timeBasedStyles.isNight ? 'bg-white/10' : 'bg-gray-200'}`}>
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500"
                      style={{ width: `${stat.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        {pollQuestions.length > 1 && (
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goToPrevious}
              disabled={currentQuestionIndex === 0}
              className={`p-2 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-30
                ${timeBasedStyles.isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-white/50 hover:bg-white/70'}`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex gap-1.5">
              {pollQuestions.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    index === currentQuestionIndex
                      ? 'bg-orange-500 w-4'
                      : votedQuestions.has(pollQuestions[index]?.id || '')
                      ? 'bg-green-500'
                      : timeBasedStyles.isNight ? 'bg-white/30' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={goToNext}
              disabled={currentQuestionIndex === pollQuestions.length - 1}
              className={`p-2 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-30
                ${timeBasedStyles.isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-white/50 hover:bg-white/70'}`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
    </div>
  )
}
