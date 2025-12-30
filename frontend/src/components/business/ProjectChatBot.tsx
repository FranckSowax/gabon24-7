'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Zap, Sparkles, Bot, User, AlertCircle } from 'lucide-react'
import { AIModelType, ChatMessage, AI_MODELS, ChatContextData } from '@/types/project-chat'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ProjectChatBotProps {
  projectId: string
  userId: string
  projectData: {
    titre: string
    description: string
    secteur: string
    budget: string
    phase: string
    progression: number
    cumulative_context?: any[]
    plan_action_steps?: any[]
  }
  documents?: any[]
  notes?: any[]
  userCredits: number
}

export default function ProjectChatBot({
  projectId,
  userId,
  projectData,
  documents = [],
  notes = [],
  userCredits
}: ProjectChatBotProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [totalCreditsUsed, setTotalCreditsUsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const buildContextData = (): ChatContextData => {
    return {
      project: {
        titre: projectData.titre,
        description: projectData.description,
        secteur: projectData.secteur,
        budget: projectData.budget,
        phase: projectData.phase,
        progression: projectData.progression
      },
      cumulativeContext: (projectData.cumulative_context || []).map(ctx => ({
        type: ctx.type,
        content: ctx.content,
        date: ctx.date
      })),
      documents: documents.map(doc => ({
        type: doc.document_type,
        title: doc.title,
        summary: doc.content?.substring(0, 300) || ''
      })),
      planActionSteps: projectData.plan_action_steps,
      notes: notes?.map(note => ({
        content: note.note_content,
        date: note.created_at
      }))
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return

    // Pas de vérification de crédits pour Gabon Insight

    setIsSending(true)

    try {
      const response = await fetch(`${API_URL}/api/project-chat/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          projectId,
          userId,
          modelType: 'gpt-4o',
          message: inputMessage,
          contextData: buildContextData()
        })
      })

      const data = await response.json()

      if (data.success) {
        // Ajouter message utilisateur
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          conversation_id: data.conversationId,
          role: 'user',
          content: inputMessage,
          credits_consumed: 0,
          created_at: new Date().toISOString()
        }])

        // Ajouter réponse assistant
        setMessages(prev => [...prev, data.message])
        
        setConversationId(data.conversationId)
        setTotalCreditsUsed(prev => prev + data.creditsUsed)
        setInputMessage('')
      } else {
        alert(data.error || 'Erreur lors de l\'envoi du message')
      }
    } catch (error) {
      console.error('Erreur send message:', error)
      alert('Erreur réseau')
    } finally {
      setIsSending(false)
    }
  }

  const handleEndConversation = async () => {
    if (!conversationId) {
      setIsOpen(false)
      setMessages([])
      return
    }

    if (!confirm('Terminer la conversation ? Un rapport sera généré et ajouté au contexte du projet.')) {
      return
    }

    try {
      await fetch(`${API_URL}/api/project-chat/end-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, projectId })
      })

      setIsOpen(false)
      setMessages([])
      setConversationId(null)
      setTotalCreditsUsed(0)
    } catch (error) {
      console.error('Erreur end conversation:', error)
    }
  }

  return (
    <>
      {/* Modal Chat - Toujours ouvert */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex items-center justify-center"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl border border-white/20"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/20 flex items-center justify-between bg-gradient-to-r from-purple-500/20 to-violet-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center p-2">
                    <img src="/logo-gabon-insight.png" alt="Gabon Insight" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">Gabon Insight</h3>
                    <p className="text-xs text-gray-400">
                      Conseiller IA pour votre projet
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">🤖</div>
                        <h4 className="text-lg font-bold text-white mb-2">
                          Commencez la conversation
                        </h4>
                        <p className="text-gray-400 text-sm mb-3">
                          Posez toutes vos questions sur votre projet
                        </p>
                        <div className="max-w-md mx-auto p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                          <p className="text-xs text-blue-300">
                            💡 L'assistant a accès à tout le contexte : documents, historique, notes, plan d'action
                          </p>
                        </div>
                      </div>
                    )}

                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 p-1">
                            <img src="/logo-gabon-insight.png" alt="Gabon Insight" className="w-full h-full object-contain" />
                          </div>
                        )}
                        
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-purple-500' : 'bg-white/10'} rounded-2xl px-4 py-3`}>
                          <p className="text-white text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>

                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                    ))}

                    {isSending && (
                      <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center p-1">
                          <img src="/logo-gabon-insight.png" alt="Gabon Insight" className="w-full h-full object-contain" />
                        </div>
                        <div className="bg-white/10 rounded-2xl px-4 py-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-white/20 bg-white/5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder="Posez votre question..."
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
                        disabled={isSending}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={!inputMessage.trim() || isSending}
                        className="px-4 py-3 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl hover:from-purple-600 hover:to-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400 text-center">
                      Gabon Insight • Conseiller IA intelligent
                    </p>
                  </div>
                </>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }
