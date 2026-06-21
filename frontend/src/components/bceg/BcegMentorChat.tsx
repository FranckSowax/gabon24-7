'use client'

import React, { useEffect, useRef, useState } from 'react'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface BcegMentorChatProps {
  projectContext?: any
  initialOpen?: boolean
  placement?: 'fixed' | 'inline'
}

const SUGGESTIONS = [
  'Quel apport personnel BCEG attend ?',
  'Comment améliorer mon BCEG Score ?',
  'Mon projet est-il éligible aux crédits subventionnés ?',
  'Quelles garanties demande la BCEG ?',
]

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const { supabase } = await import('@/lib/auth')
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {}
  return headers
}

export default function BcegMentorChat({
  projectContext,
  initialOpen = false,
  placement = 'fixed',
}: BcegMentorChatProps) {
  const [open, setOpen] = useState(initialOpen)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const send = async (text: string) => {
    const message = text.trim()
    if (!message || loading) return
    const userMsg: Message = { role: 'user', content: message, ts: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const headers = await authHeaders()
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetchWithTimeout(`${API}/api/bceg/mentor-chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message, history, project_context: projectContext }),
      })
      const json = await res.json()
      if (json?.success && json.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply, ts: Date.now() }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Désolé, le service est momentanément indisponible. (${json?.error || 'erreur inconnue'})`, ts: Date.now() }])
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erreur réseau : ${e?.message || 'connexion impossible'}`, ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  if (placement === 'fixed') {
    return (
      <>
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen(!open)}
          className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center ${
            open ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600'
          }`}
          aria-label={open ? 'Fermer le mentor' : 'Ouvrir le mentor BCEG'}
        >
          {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-slate-950" />}
          {!open && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-pulse" />
          )}
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-24 right-5 z-50 w-[min(420px,calc(100vw-2.5rem))] h-[min(640px,calc(100vh-8rem))] bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <ChatHeader onClose={() => setOpen(false)} />
              <ChatBody messages={messages} loading={loading} scrollRef={scrollRef} onSuggestion={(s) => send(s)} />
              <ChatInput input={input} setInput={setInput} onSend={() => send(input)} onKeyDown={handleKeyDown} loading={loading} />
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[600px]">
      <ChatHeader />
      <ChatBody messages={messages} loading={loading} scrollRef={scrollRef} onSuggestion={(s) => send(s)} />
      <ChatInput input={input} setInput={setInput} onSend={() => send(input)} onKeyDown={handleKeyDown} loading={loading} />
    </div>
  )
}

function ChatHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/15 border-b border-white/10">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xl">🏦</div>
        <div>
          <div className="font-bold text-white text-sm">Conseiller BCEG</div>
          <div className="text-[10px] text-emerald-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            En ligne · Powered by Gemini
          </div>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function ChatBody({
  messages,
  loading,
  scrollRef,
  onSuggestion,
}: {
  messages: Message[]
  loading: boolean
  scrollRef: React.RefObject<HTMLDivElement>
  onSuggestion: (s: string) => void
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-2">👋</div>
        <p className="text-white font-medium mb-1">Salut !</p>
        <p className="text-xs text-white/60 mb-4 leading-relaxed">
          Je suis ton conseiller BCEG. Pose-moi tes questions sur le financement de ton projet, l'apport conseillé, les critères de la banque…
        </p>
        <div className="space-y-1.5 w-full">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(s)}
              className="block w-full text-left px-3 py-2 text-xs text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
            >
              <Sparkles className="inline w-3 h-3 mr-1.5 text-amber-300" />
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((m, i) => (
        <MessageBubble key={i} message={m} />
      ))}
      {loading && (
        <div className="flex items-center gap-1.5 text-white/60 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Le conseiller réfléchit…
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? 'bg-gradient-to-br from-amber-400 to-orange-400 text-slate-950'
            : 'bg-white/10 border border-white/10 text-white'
        }`}
      >
        <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
      </div>
    </motion.div>
  )
}

function ChatInput({
  input,
  setInput,
  onSend,
  onKeyDown,
  loading,
}: {
  input: string
  setInput: (s: string) => void
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  loading: boolean
}) {
  return (
    <div className="border-t border-white/10 p-3 bg-slate-950">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pose ta question…"
          disabled={loading}
          className="flex-1 px-3 py-2.5 bg-white/5 border border-white/15 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 disabled:opacity-50"
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
          className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 flex items-center justify-center transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-white/30 text-center">
        Conseils indicatifs — pas un engagement de financement
      </p>
    </div>
  )
}
