'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

interface Poll {
  id: string
  question: string
  poll_type: 'yes_no' | 'mcq'
  options: string[]
  total_votes: number
  expires_at: string
  created_at: string
}

interface PollStats {
  response_value: string
  vote_count: number
  percentage: number
}

interface YesterdayPollWidgetProps {
  className?: string
}

export default function YesterdayPollWidget({ className = '' }: YesterdayPollWidgetProps) {
  const [yesterdayPoll, setYesterdayPoll] = useState<Poll | null>(null)
  const [pollStats, setPollStats] = useState<PollStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showResults, setShowResults] = useState(false)

  // Charger le sondage d'hier avec ses résultats
  const loadYesterdayPoll = async () => {
    try {
      setLoading(true)
      
      // Récupérer le sondage d'hier (le plus récent)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
      const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1)
      
      const { data: pollsData, error } = await supabase
        .from('polls')
        .select('*')
        .gte('created_at', startOfYesterday.toISOString())
        .lt('created_at', endOfYesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (error) {
        console.error('Erreur lors du chargement du sondage d\'hier:', error)
        return
      }
      
      if (pollsData && pollsData.length > 0) {
        setYesterdayPoll(pollsData[0])
        await loadPollStats(pollsData[0].id)
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  // Charger les statistiques d'un sondage spécifique
  const loadPollStats = async (pollId: string) => {
    try {
      const { data: stats, error: statsError } = await supabase
        .from('poll_stats')
        .select('*')
        .eq('poll_id', pollId)
        .order('vote_count', { ascending: false })
      
      if (statsError) {
        console.error('Erreur lors du chargement des stats:', statsError)
        return
      }
      
      setPollStats(stats || [])
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  // Afficher/masquer les résultats
  const toggleResults = () => {
    setShowResults(!showResults)
  }

  useEffect(() => {
    loadYesterdayPoll()
  }, [])

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-4"></div>
          <div className="h-3 bg-gray-100 rounded-lg w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-100 rounded-lg w-2/3"></div>
        </div>
      </div>
    )
  }

  if (!yesterdayPoll) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <span className="text-lg">📊</span>
          </div>
          <p className="text-xs">Aucun sondage d'hier</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow ${className}`}>
      {/* Header compact */}
      <div className="p-4 pb-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-bold">📊</span>
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Résultats d'Hier</h3>
          </div>
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-1 rounded-full shadow-sm">
            <span className="font-bold text-xs">{yesterdayPoll.total_votes || 0} votes</span>
          </div>
        </div>
        
        <div className="text-xs text-gray-500">
          {new Date(yesterdayPoll.created_at).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          })}
        </div>
      </div>

      {/* Question et résultats compacts */}
      <div className="p-4">
        <h4 className="font-medium text-sm text-gray-900 mb-3 leading-tight">
          {yesterdayPoll.question}
        </h4>
        
        {/* Résultats compacts */}
        <div className="space-y-2">
          {pollStats.slice(0, 3).map((stat, index) => {
            const displayValue = stat.response_value === 'yes' ? 'Oui' : stat.response_value === 'no' ? 'Non' : stat.response_value
            
            // Couleurs différenciées selon le type de réponse
            let barColor, bgColor
            if (stat.response_value === 'yes') {
              barColor = 'bg-green-500'
              bgColor = 'bg-green-50'
            } else if (stat.response_value === 'no') {
              barColor = 'bg-red-500'
              bgColor = 'bg-red-50'
            } else {
              // Pour les réponses MCQ, utiliser des couleurs variées
              const colors = [
                { bar: 'bg-blue-500', bg: 'bg-blue-50' },
                { bar: 'bg-purple-500', bg: 'bg-purple-50' },
                { bar: 'bg-indigo-500', bg: 'bg-indigo-50' },
                { bar: 'bg-teal-500', bg: 'bg-teal-50' },
                { bar: 'bg-orange-500', bg: 'bg-orange-50' }
              ]
              const colorIndex = index % colors.length
              barColor = colors[colorIndex].bar
              bgColor = colors[colorIndex].bg
            }
            
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className={`p-2 rounded-lg border ${bgColor} border-gray-200`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700 truncate">
                    {displayValue}
                  </span>
                  <span className="text-xs font-bold text-gray-900">
                    {(stat.percentage || 0).toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <motion.div
                    className={`h-1.5 rounded-full ${barColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.percentage || 0}%` }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
        
        {/* Footer avec total */}
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Total des votes</span>
            <span className="font-medium">{yesterdayPoll.total_votes || 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
