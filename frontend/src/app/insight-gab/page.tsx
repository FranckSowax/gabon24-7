'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Send, Bot, User, Loader2, Info, Menu } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'

interface Message {
  role: 'user' | 'model'
  content: string
  timestamp: Date
}

export default function InsightGabPage() {
  const { user, subscriptionPlan, loading } = useAuth()
  const router = useRouter()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      content: 'Bonjour ! Je suis Insight Gab, votre assistant IA spécialisé sur l\'actualité du Gabon. Je peux rechercher des informations dans nos 20 000+ articles. Que souhaitez-vous savoir aujourd\'hui ?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    const newMessages = [
      ...messages,
      { role: 'user' as const, content: userMessage, timestamp: new Date() }
    ]
    setMessages(newMessages)
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/insight-gab/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          history: newMessages.slice(0, -1).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessages(prev => [
          ...prev,
          { role: 'model', content: data.response, timestamp: new Date() }
        ])
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'model', content: data.error || "Désolé, une erreur est survenue lors du traitement de votre demande.", timestamp: new Date() }
        ])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        { role: 'model', content: "Impossible de contacter le serveur pour le moment.", timestamp: new Date() }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Sidebar */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex flex-col h-screen bg-gray-50 lg:pl-64">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>

            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 rounded-lg text-white">
              <Bot size={24} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Insight Gab</h1>
              <p className="text-xs text-gray-500 flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
                <span className="hidden sm:inline">Connecté à la base de connaissance (20k+ articles)</span>
                <span className="sm:hidden">20k+ articles</span>
              </p>
            </div>
          </div>

          {/* Info/Limits */}
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
            <Info size={14} />
            <span>Propulsé par Gemini 1.5 RAG</span>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start space-x-2 sm:space-x-3 ${
                msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                ${msg.role === 'user' ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}
              `}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              {/* Message Bubble */}
              <div className={`
                max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm text-sm sm:text-base leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-orange-500 text-white rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}
              `}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-orange-100' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start space-x-2 sm:space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 sm:px-5 py-3 sm:py-4 shadow-sm">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-200 p-3 sm:p-6">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question sur l'actualité au Gabon..."
              className="w-full pl-4 sm:pl-5 pr-12 sm:pr-14 py-3 sm:py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm text-gray-800 placeholder-gray-400 text-sm sm:text-base"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg flex items-center justify-center transition-all"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
          <p className="text-center text-[10px] sm:text-xs text-gray-400 mt-2 sm:mt-3">
            Insight Gab peut faire des erreurs. Vérifiez les informations importantes.
          </p>
        </div>
      </div>
    </>
  )
}
