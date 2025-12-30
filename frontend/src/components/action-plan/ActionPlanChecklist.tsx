'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Trash2,
  Send,
  Upload,
  X,
  Sparkles,
  Trophy,
  Zap,
  Target
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ActionItem {
  id: string
  order_index: number
  title: string
  description: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  estimated_duration: string
  is_completed: boolean
  completed_at: string | null
  comments?: Comment[]
  attachments?: Attachment[]
}

interface Comment {
  id: string
  content: string
  created_at: string
}

interface Attachment {
  id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  created_at: string
}

interface ActionPlan {
  id: string
  title: string
  description: string
  total_items: number
  completed_items: number
  progress_percentage: number
  status: string
  items: ActionItem[]
}

interface ActionPlanChecklistProps {
  planId: string
  userId: string
  onClose?: () => void
}

const PRIORITY_COLORS = {
  urgent: 'text-red-600 bg-red-100',
  high: 'text-orange-600 bg-orange-100',
  medium: 'text-blue-600 bg-blue-100',
  low: 'text-gray-600 bg-gray-100'
}

const CATEGORY_ICONS: Record<string, string> = {
  'Validation marché': '🎯',
  'Finance': '💰',
  'Marketing': '📢',
  'Juridique': '⚖️',
  'Opérations': '⚙️',
  'Ressources Humaines': '👥'
}

export default function ActionPlanChecklist({ planId, userId, onClose }: ActionPlanChecklistProps) {
  const [plan, setPlan] = useState<ActionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    fetchPlan()
  }, [planId])

  const fetchPlan = async () => {
    try {
      const response = await fetch(`${API_URL}/api/action-plans/${planId}?userId=${userId}`)
      const data = await response.json()
      
      if (data.success) {
        setPlan(data.plan)
      }
    } catch (error) {
      console.error('Erreur chargement plan:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = async (itemId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/action-plans/${planId}/items/${itemId}/toggle`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })

      const data = await response.json()
      
      if (data.success) {
        // Refresh plan
        await fetchPlan()
        
        // Check if completed
        if (data.item.is_completed) {
          // Animation celebration
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 3000)
        }
      }
    } catch (error) {
      console.error('Erreur toggle item:', error)
    }
  }

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const addComment = async (itemId: string) => {
    const content = newComment[itemId]?.trim()
    if (!content) return

    try {
      const response = await fetch(`${API_URL}/api/action-plans/${planId}/items/${itemId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content })
      })

      const data = await response.json()
      
      if (data.success) {
        setNewComment({ ...newComment, [itemId]: '' })
        await fetchPlan()
      }
    } catch (error) {
      console.error('Erreur ajout commentaire:', error)
    }
  }

  const getMotivationalMessage = (percentage: number) => {
    if (percentage === 0) return { icon: Target, message: "Prêt à commencer ? Chaque grand projet commence par un premier pas !", color: "text-blue-600" }
    if (percentage < 25) return { icon: Zap, message: "Excellent départ ! Continuez sur cette lancée 💪", color: "text-orange-600" }
    if (percentage < 50) return { icon: Sparkles, message: "Vous êtes en plein élan ! La moitié du chemin est proche 🚀", color: "text-purple-600" }
    if (percentage < 75) return { icon: Trophy, message: "Bravo ! Plus que quelques étapes et c'est dans la poche ! 🌟", color: "text-yellow-600" }
    if (percentage < 100) return { icon: Trophy, message: "Incroyable ! Vous êtes presque au sommet ! 🏆", color: "text-green-600" }
    return { icon: Trophy, message: "🎉 FÉLICITATIONS ! Vous avez terminé votre plan d'action ! 🎉", color: "text-green-600" }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="text-center p-12">
        <p className="text-gray-600">Plan d'action introuvable</p>
      </div>
    )
  }

  const motivation = getMotivationalMessage(plan.progress_percentage)
  const MotivationIcon = motivation.icon

  return (
    <div className="max-w-4xl mx-auto">
      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="text-8xl"
            >
              🎉
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-6 mb-6 text-black">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{plan.title}</h1>
            <p className="opacity-90">{plan.description}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="bg-white/20 rounded-full h-4 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${plan.progress_percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-white flex items-center justify-end pr-2"
          >
            {plan.progress_percentage > 10 && (
              <span className="text-xs font-bold text-black">{plan.progress_percentage}%</span>
            )}
          </motion.div>
        </div>

        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="font-semibold">
            {plan.completed_items} / {plan.total_items} actions terminées
          </span>
          {plan.progress_percentage === 100 && (
            <span className="px-3 py-1 bg-white/30 rounded-full font-bold">
              ✅ TERMINÉ
            </span>
          )}
        </div>
      </div>

      {/* Motivation Message */}
      <motion.div
        key={plan.progress_percentage}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 mb-6 flex items-center gap-3 ${motivation.color}`}
      >
        <MotivationIcon className="w-8 h-8 flex-shrink-0" />
        <p className="font-semibold text-lg">{motivation.message}</p>
      </motion.div>

      {/* Action Items */}
      <div className="space-y-4">
        {plan.items
          .sort((a, b) => a.order_index - b.order_index)
          .map((item, index) => {
            const isExpanded = expandedItems.has(item.id)
            const hasComments = item.comments && item.comments.length > 0
            const hasAttachments = item.attachments && item.attachments.length > 0

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${
                  item.is_completed
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                {/* Item Header */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item.id)}
                      className="flex-shrink-0 mt-1"
                    >
                      {item.is_completed ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-400 hover:text-orange-500 transition-colors" />
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3
                          className={`font-semibold text-gray-900 ${
                            item.is_completed ? 'line-through opacity-60' : ''
                          }`}
                        >
                          {index + 1}. {item.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${PRIORITY_COLORS[item.priority]}`}>
                          {item.priority}
                        </span>
                      </div>

                      <p className={`text-gray-600 text-sm mb-3 ${item.is_completed ? 'opacity-60' : ''}`}>
                        {item.description}
                      </p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium inline-flex items-center gap-1">
                          {CATEGORY_ICONS[item.category] || '📋'} {item.category}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                          ⏱️ {item.estimated_duration}
                        </span>
                      </div>

                      {/* Expand Button */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Masquer détails
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Voir détails
                            </>
                          )}
                        </button>

                        {(hasComments || hasAttachments) && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {hasComments && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {item.comments!.length}
                              </span>
                            )}
                            {hasAttachments && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                {item.attachments!.length}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 bg-gray-50"
                    >
                      <div className="p-4 space-y-4">
                        {/* Comments Section */}
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Commentaires
                          </h4>

                          {/* Existing Comments */}
                          {item.comments && item.comments.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {item.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="bg-white rounded-lg p-3 border border-gray-200"
                                >
                                  <p className="text-gray-700 text-sm">{comment.content}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Comment */}
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Ajouter un commentaire..."
                              value={newComment[item.id] || ''}
                              onChange={(e) =>
                                setNewComment({ ...newComment, [item.id]: e.target.value })
                              }
                              onKeyPress={(e) => e.key === 'Enter' && addComment(item.id)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                            />
                            <button
                              onClick={() => addComment(item.id)}
                              className="p-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Attachments Section */}
                        <div>
                          <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Paperclip className="w-4 h-4" />
                            Pièces jointes
                          </h4>

                          {item.attachments && item.attachments.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {item.attachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-white rounded-lg p-3 border border-gray-200 hover:border-orange-300 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Paperclip className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-700 truncate">
                                      {attachment.file_name}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {(attachment.file_size / 1024).toFixed(1)} KB
                                  </p>
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Add Attachment Button */}
                          <button
                            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors flex items-center justify-center gap-2 text-sm"
                          >
                            <Upload className="w-4 h-4" />
                            Ajouter une pièce jointe
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
      </div>

      {/* Completion Celebration */}
      {plan.progress_percentage === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="mt-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-8 text-white text-center"
        >
          <div className="text-6xl mb-4">🏆</div>
          <h2 className="text-3xl font-bold mb-2">Mission Accomplie !</h2>
          <p className="text-lg opacity-90 mb-6">
            Vous avez terminé toutes les actions de votre plan. Félicitations pour votre engagement ! 🎉
          </p>
          <div className="flex gap-3 justify-center">
            <button className="px-6 py-3 bg-white text-green-600 font-semibold rounded-lg hover:bg-green-50 transition-colors">
              Partager ma réussite
            </button>
            <button className="px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors">
              Créer un nouveau plan
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
