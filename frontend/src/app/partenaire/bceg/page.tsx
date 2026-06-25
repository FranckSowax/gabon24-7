'use client'

import { useEffect, useState } from 'react'
import { Lock, Loader2, LogOut, ShieldCheck } from 'lucide-react'
import { BcegReviewDashboard } from '@/app/admin/bceg/page'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const CODE_KEY = 'bceg_portal_code'

export default function PartenaireBcegPortail() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(CODE_KEY)
      setAuthed(!!saved)
    } catch {
      setAuthed(false)
    }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim()
    if (!c) return
    setChecking(true)
    setError('')
    try {
      // Valide le code en interrogeant un endpoint protégé du portail
      const res = await fetch(`${API}/api/bceg/admin/stats`, { headers: { 'x-bceg-code': c } })
      if (res.ok) {
        sessionStorage.setItem(CODE_KEY, c)
        setAuthed(true)
      } else {
        setError("Code d'accès invalide.")
      }
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally {
      setChecking(false)
    }
  }

  const logout = () => {
    try { sessionStorage.removeItem(CODE_KEY) } catch {}
    setCode('')
    setAuthed(false)
  }

  // Évite le flash avant lecture du sessionStorage
  if (authed === null) return null

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#697357] to-[#4d553e] p-4">
        <form
          onSubmit={submit}
          className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7"
        >
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#697357]/10 text-[#697357] flex items-center justify-center mb-3">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Portail BCEG</h1>
            <p className="text-sm text-slate-500 mt-1">
              Espace de réception et de traitement des dossiers de financement.
            </p>
          </div>

          <label className="block text-xs font-semibold text-slate-600 mb-1">Code d'accès</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Saisissez le code partagé"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#697357] focus:ring-1 focus:ring-[#697357]"
            />
          </div>

          {error && <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={checking || !code.trim()}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#697357] to-[#4d553e] text-white font-bold text-sm shadow-md disabled:opacity-60"
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {checking ? 'Vérification…' : 'Accéder au portail'}
          </button>

          <p className="mt-4 text-[11px] text-slate-400 text-center leading-relaxed">
            Accès réservé aux agents BCEG habilités. Le code est confidentiel.
          </p>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-[#4d553e] text-white px-4 py-2 flex items-center justify-between text-sm">
        <span className="font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> Portail BCEG — Traitement des dossiers
        </span>
        <button onClick={logout} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold">
          <LogOut className="w-3.5 h-3.5" /> Quitter
        </button>
      </div>
      <BcegReviewDashboard />
    </div>
  )
}
