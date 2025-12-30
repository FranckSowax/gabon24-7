'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import AuthModal from '@/components/auth/AuthModal'
import { motion, AnimatePresence } from 'framer-motion'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Poll {
  id: string
  question: string
  poll_type: 'yes_no' | 'mcq'
  options: string[]
  total_votes: number
  expires_at: string
  created_at: string
  questions?: PollQuestion[]
}

interface PollQuestion {
  id: string
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

export default function PollWidget({ articles = [], className = '' }: PollWidgetProps) {
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [polls, setPolls] = useState<Poll[]>([])
  const [currentParentPollId, setCurrentParentPollId] = useState<string | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [pollStats, setPollStats] = useState<PollStats[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<{[questionId: string]: string}>({})
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasVoted, setHasVoted] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [allPollsStats, setAllPollsStats] = useState<{[questionId: string]: PollStats[]}>({})
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const [currentPollQuestions, setCurrentPollQuestions] = useState<PollQuestion[]>([])

  // Calculer le temps restant jusqu'au prochain sondage (19h UTC)
  const calculateTimeRemaining = () => {
    const now = new Date()
    const nextPoll = new Date()
    
    // Calculer la prochaine occurrence de 19h UTC
    nextPoll.setUTCHours(19, 0, 0, 0)
    
    // Si on est déjà passé 19h UTC aujourd'hui, passer au lendemain
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

  // Charger les sondages d'aujourd'hui
  const loadPolls = async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`${API_URL}/api/polls`)
      const data = await response.json()
      
      if (!data.success) {
        console.error('Erreur lors du chargement des sondages:', data.error)
        return
      }
      
      if (data.polls && data.polls.length > 0) {
        const poll = data.polls[0]
        setCurrentParentPollId(poll.id)
        
        // Si c'est un sondage de type "series", charger les questions
        if (poll.poll_type === 'series') {
          const questionsResponse = await fetch(`${API_URL}/api/polls/questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pollId: poll.id })
          })
          const questionsData = await questionsResponse.json()
          
          if (questionsData.success && questionsData.questions) {
            // Convertir les questions en format Poll pour compatibilité
            const pollQuestions = questionsData.questions.map((q: any) => ({
              id: q.id,
              question: q.question_text,
              poll_type: q.question_type,
              options: q.options || [],
              total_votes: 0,
              expires_at: poll.expires_at,
              created_at: poll.created_at
            }))
            setPolls(pollQuestions)
          }
        } else {
          setPolls(data.polls)
        }
        
        // Vérifier si l'utilisateur a déjà voté pour le premier sondage
        if (user) {
          const firstPollId = poll.poll_type === 'series' ? poll.id : data.polls[0].id
          const voteResponse = await fetch(`${API_URL}/api/polls/check-votes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, pollId: firstPollId })
          })
          const voteData = await voteResponse.json().catch(() => ({}))
          
          if (voteData.success && (voteData.hasVoted || (voteData.responses && voteData.responses.length > 0))) {
            setHasVoted(true)
            setShowResults(true)
          }
        }
        
        // Charger les statistiques du premier sondage
        const firstPollId = poll.poll_type === 'series' ? poll.id : data.polls[0].id
        await loadPollStats(firstPollId)
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }


  // Charger les statistiques du sondage
  const loadPollStats = async (pollId: string) => {
    try {
      // Récupérer la première question liée à ce sondage
      const qRes = await fetch(`${API_URL}/api/polls/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId })
      })
      const qData = await qRes.json().catch(() => ({}))
      const firstQuestionId = Array.isArray(qData?.questions) && qData.questions.length > 0 ? qData.questions[0].id : null
      if (!firstQuestionId) {
        setPollStats([])
        return
      }

      const response = await fetch(`${API_URL}/api/polls/stats?question_id=${firstQuestionId}`)
      const data = await response.json()
      
      if (!data.success) {
        console.error('Erreur lors du chargement des stats:', data.error)
        return
      }
      
      const raw = Array.isArray(data.stats) ? data.stats : []
      const total = raw.reduce((sum: number, s: any) => sum + (s.vote_count ?? s.count ?? 0), 0)
      const normalized = raw.map((s: any) => ({
        response_value: s.response_value ?? s.response,
        vote_count: s.vote_count ?? s.count ?? 0,
        percentage: total ? ((s.vote_count ?? s.count ?? 0) * 100) / total : 0
      }))
      setPollStats(normalized)
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  // Charger toutes les statistiques des sondages
  const loadAllPollsStats = async () => {
    const statsPromises = polls.map(async (poll) => {
      try {
        // Ici, polls peut représenter des questions (mode "series")
        const response = await fetch(`${API_URL}/api/polls/stats?question_id=${poll.id}`)
        const data = await response.json()
        if (data.success && Array.isArray(data.stats)) {
          const raw = data.stats
          const total = raw.reduce((sum: number, s: any) => sum + (s.vote_count ?? s.count ?? 0), 0)
          const normalized = raw.map((s: any) => ({
            response_value: s.response_value ?? s.response,
            vote_count: s.vote_count ?? s.count ?? 0,
            percentage: total ? ((s.vote_count ?? s.count ?? 0) * 100) / total : 0
          }))
          return { pollId: poll.id, stats: normalized }
        }
        return { pollId: poll.id, stats: [] }
      } catch (error) {
        console.error('Erreur:', error)
        return { pollId: poll.id, stats: [] }
      }
    })
    
    const results = await Promise.all(statsPromises)
    const statsMap: {[pollId: string]: PollStats[]} = {}
    results.forEach(result => {
      statsMap[result.pollId] = result.stats
    })
    setAllPollsStats(statsMap)
  }

  // (auth status check removed; no longer using Netlify functions here)

  // Gérer le clic sur le bouton Voter
  const handleVoteClick = async () => {
    const currentPoll = polls[currentIndex]
    if (!currentPoll || !selectedAnswer || hasVoted) return

    if (!user) {
      setShowAuthModal(true)
      return
    }

    // Procéder directement au vote
    await submitVote()
  }

  // Soumettre un vote
  const submitVote = async (pollId?: string, answer?: string) => {
    if (!user) return

    const currentPoll = polls[currentIndex]
    const voteData = {
      pollId: pollId || currentPoll?.id,
      answer: answer || selectedAnswer
    }
    
    if (!voteData.pollId || !voteData.answer || hasVoted) return
    
    try {
      setIsVoting(true)
      
      const normalizedValue = voteData.answer === 'Oui' ? 'yes' : voteData.answer === 'Non' ? 'no' : voteData.answer
      
      // Déterminer questionId et pollId serveur
      let questionId = currentPoll?.id
      let parentPollId = currentParentPollId || voteData.pollId
      // Si currentPoll.Id n'est pas une question (non-série), récupérer la première question
      if (!currentParentPollId || currentPollQuestions.length === 0) {
        const qRes = await fetch(`${API_URL}/api/polls/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pollId: voteData.pollId })
        })
        const qData = await qRes.json().catch(() => ({}))
        if (Array.isArray(qData?.questions) && qData.questions.length > 0) {
          questionId = qData.questions[0].id
          parentPollId = voteData.pollId
        }
      }

      const response = await fetch(`${API_URL}/api/polls/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          questionId,
          pollId: parentPollId,
          response: normalizedValue
        })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        console.error('Erreur lors du vote:', data.error)
        return
      }
      
      // Recharger les statistiques
      await loadPollStats(parentPollId || voteData.pollId)
      setHasVoted(true)
      setShowResults(true)
      
      // Vote soumis avec succès
      
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setIsVoting(false)
    }
  }


  // Navigation functions
  const goToNext = () => {
    if (currentQuestionIndex < currentPollQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const goToPrevious = async () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setSelectedAnswer('')
      setHasVoted(false)
      setShowResults(false)
      
      // Vérifier si l'utilisateur a voté pour ce sondage
      if (user) {
        const voteResponse = await fetch(`${API_URL}/api/polls/check-votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, pollId: currentParentPollId || polls[prevIndex].id })
        })
        const voteData = await voteResponse.json().catch(() => ({}))
        
        if (voteData.success && (voteData.hasVoted || (voteData.responses && voteData.responses.length > 0))) {
          setHasVoted(true)
          setShowResults(true)
        }
      }
      
      // Charger les statistiques
      await loadPollStats(currentParentPollId || polls[prevIndex].id)
    }
  }

  useEffect(() => {
    loadPolls()
    
    // Mettre à jour le timer toutes les secondes
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [user])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (!polls.length) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">📊</span>
          </div>
          <p className="text-sm">Aucun sondage disponible</p>
        </div>
      </div>
    )
  }

  const currentPoll = polls[currentIndex]

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow w-full max-w-full ${className}`}>
      {/* Header avec compteur et barre de progression */}
      <div className="p-3 sm:p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-bold">📊</span>
            </div>
            <h3 className="font-bold text-gray-900">Sondage du Jour</h3>
          </div>
          <div className="flex items-center space-x-2">
            {timeRemaining && (
              <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-2 py-1 rounded-full shadow-lg">
                <span className="font-bold text-xs tracking-wider">⏰ {timeRemaining}</span>
              </div>
            )}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1.5 rounded-full shadow-lg">
              <span className="font-bold text-xs tracking-wider">{currentIndex + 1}/{polls.length}</span>
            </div>
          </div>
        </div>
        
        {/* Barre de progression */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <motion.div 
            className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / polls.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        
        <div className="flex justify-between items-center text-xs text-gray-600">
          <span>Question {currentIndex + 1}</span>
          <span className="text-indigo-600 font-medium">{currentPoll.total_votes || 0} votes</span>
        </div>
      </div>

      {/* Question avec animation */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="p-3 sm:p-6"
        >
          <h4 className="font-bold text-lg text-gray-900 mb-4 leading-relaxed">
            {currentPoll.question}
          </h4>

        {!showResults ? (
          <div className="space-y-3">
            {/* Options de vote pour yes/no */}
            {currentPoll.poll_type === 'yes_no' ? (
              <div className="space-y-2">
                <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedAnswer === 'Oui' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                }`}>
                  <input
                    type="radio"
                    name="poll-answer"
                    value="Oui"
                    checked={selectedAnswer === 'Oui'}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    selectedAnswer === 'Oui' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                  }`}>
                    {selectedAnswer === 'Oui' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <span className="text-sm font-medium text-gray-700">Oui</span>
                </label>
                
                <label className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedAnswer === 'Non' 
                    ? 'border-red-500 bg-red-50' 
                    : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                }`}>
                  <input
                    type="radio"
                    name="poll-answer"
                    value="Non"
                    checked={selectedAnswer === 'Non'}
                    onChange={(e) => setSelectedAnswer(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                    selectedAnswer === 'Non' ? 'border-red-500 bg-red-500' : 'border-gray-300'
                  }`}>
                    {selectedAnswer === 'Non' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                  <span className="text-sm font-medium text-gray-700">Non</span>
                </label>
              </div>
            ) : (
              /* Options pour MCQ - Limité à 3 options maximum */
              <div className="space-y-2">
                {currentPoll.options.slice(0, 3).map((option, index) => {
                  const optionText = typeof option === 'string' ? option : (option as any)?.text || String(option);
                  return (
                  <label key={index} className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAnswer === optionText 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}>
                    <input
                      type="radio"
                      name="poll-answer"
                      value={optionText}
                      checked={selectedAnswer === optionText}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                      selectedAnswer === optionText ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {selectedAnswer === optionText && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{optionText}</span>
                  </label>
                  );
                })}
              </div>
            )}
            
            {/* Le bouton Voter n'apparaît que sur la dernière question */}
            {(currentIndex === polls.length - 1) && !hasVoted && (
              <button
                onClick={handleVoteClick}
                disabled={!selectedAnswer || isVoting}
                className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all mb-3 ${
                  !selectedAnswer || isVoting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
                }`}
              >
                {isVoting ? 'Vote en cours...' : 'Voter'}
              </button>
            )}
            
            {/* Slide final après le vote - "Voir tous les résultats" */}
            {hasVoted && currentIndex === polls.length - 1 && (
              <div className="text-center space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-center space-x-2 text-green-700">
                    <span className="text-2xl">✅</span>
                    <span className="font-semibold">Merci pour votre participation !</span>
                  </div>
                  <p className="text-sm text-green-600 mt-2">Vos réponses ont été enregistrées</p>
                </div>
                
                <button
                  onClick={async () => {
                    if (!showAllResults) {
                      await loadAllPollsStats()
                    }
                    setShowAllResults(!showAllResults)
                  }}
                  className="w-full bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border border-green-200 text-green-700 py-4 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  <span>📊</span>
                  <span>{showAllResults ? 'Masquer tous les résultats' : 'Voir tous les résultats'}</span>
                </button>
              </div>
            )}
          </div>
        ) : showAllResults ? (
          /* Vue de tous les résultats */
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h4 className="text-lg font-bold text-gray-900 mb-2">📊 Résultats de tous les sondages</h4>
              <p className="text-sm text-gray-600">Résultats en temps réel</p>
            </div>
            
            {polls.map((poll, pollIndex) => {
              const pollStatsData = allPollsStats[poll.id] || []
              return (
                <motion.div
                  key={poll.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: pollIndex * 0.2 }}
                  className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200"
                >
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-indigo-600">Question {pollIndex + 1}</span>
                      <span className="text-xs text-gray-500">{poll.total_votes || 0} votes</span>
                    </div>
                    <h5 className="font-semibold text-gray-900 text-sm leading-relaxed">
                      {poll.question}
                    </h5>
                  </div>
                  
                  <div className="space-y-2">
                    {pollStatsData.map((stat, statIndex) => {
                      const displayValue = stat.response_value === 'yes' ? 'Oui' : stat.response_value === 'no' ? 'Non' : stat.response_value
                      const barColor = stat.response_value === 'yes' ? 'bg-green-500' : stat.response_value === 'no' ? 'bg-red-500' : 'bg-blue-500'
                      
                      return (
                        <motion.div
                          key={statIndex}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: pollIndex * 0.2 + statIndex * 0.1 }}
                          className="bg-white p-2 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-700">
                              {displayValue}
                            </span>
                            <span className="text-xs font-bold text-gray-900">
                              {(stat.percentage || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <motion.div
                              className={`h-1.5 rounded-full ${barColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${stat.percentage || 0}%` }}
                              transition={{ duration: 0.8, delay: pollIndex * 0.2 + statIndex * 0.1 }}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {stat.vote_count || 0} vote{(stat.vote_count || 0) !== 1 ? 's' : ''}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )
            })}
            
            {/* Bouton pour revenir à la vue normale */}
            <button
              onClick={() => setShowAllResults(false)}
              className="w-full bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 border border-gray-300 text-gray-700 py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <span>↩️</span>
              <span>Retour au sondage</span>
            </button>
          </div>
        ) : (
          /* Résultats du sondage courant */
          <div className="space-y-3">
            {pollStats.map((stat, index) => {
              const isUserChoice = stat.response_value === (selectedAnswer === 'Oui' ? 'yes' : selectedAnswer === 'Non' ? 'no' : selectedAnswer)
              const displayValue = stat.response_value === 'yes' ? 'Oui' : stat.response_value === 'no' ? 'Non' : stat.response_value
              const barColor = stat.response_value === 'yes' ? 'bg-green-500' : stat.response_value === 'no' ? 'bg-red-500' : 'bg-blue-500'
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-3 rounded-lg border-2 ${
                    isUserChoice ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {displayValue} {isUserChoice && '✓'}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {(stat.percentage || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div
                      className={`h-2 rounded-full ${barColor}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.percentage || 0}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {stat.vote_count || 0} vote{(stat.vote_count || 0) !== 1 ? 's' : ''}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
          
          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goToPrevious}
              disabled={currentIndex === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                currentIndex === 0
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Précédent</span>
            </button>
            
            {/* Indicateurs et date */}
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">
                {new Date(currentPoll.created_at).toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short'
                })}
              </div>
              <div className="flex space-x-1">
                {polls.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentIndex ? 'bg-indigo-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
            
            <button
              onClick={goToNext}
              disabled={currentIndex === polls.length - 1}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
                currentIndex === polls.length - 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700'
              }`}
            >
              <span>Suivant</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false)
          // Le useEffect rechargera les sondages et les votes car 'user' changera
        }}
      />
    </div>
  )
}
