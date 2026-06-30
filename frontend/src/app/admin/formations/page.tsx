'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { GraduationCap, Loader2, Check, X, Clock, Star, MapPin, Mail, Phone } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Candidate {
  id: string
  full_name: string
  email: string
  phone?: string
  province?: string
  city?: string
  sector?: string
  project_title?: string
  project_stage?: string
  preferred_format?: string
  motivation?: string
  status: string
  created_at: string
}

const STATUS = [
  { key: '', label: 'Toutes' },
  { key: 'pending', label: 'En attente' },
  { key: 'selected', label: 'Sélectionnées' },
  { key: 'waitlist', label: "Liste d'attente" },
  { key: 'rejected', label: 'Refusées' },
]

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  selected: 'bg-green-100 text-green-700',
  waitlist: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function FormationsAdminPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const headers = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const h = await headers()
      const res = await fetch(`${API_URL}/api/formations/candidates${filter ? `?status=${filter}` : ''}`, { headers: h })
      const data = await res.json()
      if (data.success) { setCandidates(data.candidates); setCounts(data.counts || {}) }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [filter, headers])

  useEffect(() => { load() }, [load])

  const setStatus = async (id: string, status: string) => {
    const h = await headers()
    const res = await fetch(`${API_URL}/api/formations/candidates/${id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ status }) })
    const data = await res.json()
    if (data.success) setCandidates(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#697357]" /> Candidatures — Formations BCEG
        </h1>
        <p className="text-slate-500 text-sm mt-1">Sélectionnez le panel de candidats sur tout le pays.</p>
      </header>

      {/* Filtres + compteurs */}
      <div className="flex flex-wrap gap-2">
        {STATUS.map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${filter === s.key ? 'bg-[#697357] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {s.label}{s.key && counts[s.key] ? ` (${counts[s.key]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
      ) : candidates.length === 0 ? (
        <p className="text-slate-500 text-sm">Aucune candidature.</p>
      ) : (
        <div className="space-y-3">
          {candidates.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900">{c.full_name}</h3>
                    <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_BADGE[c.status] || 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                    <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{c.email}</span>
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{c.phone}</span>}
                    {(c.province || c.city) && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[c.city, c.province].filter(Boolean).join(', ')}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setStatus(c.id, 'selected')} title="Sélectionner" className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setStatus(c.id, 'waitlist')} title="Liste d'attente" className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Star className="w-4 h-4" /></button>
                  <button onClick={() => setStatus(c.id, 'pending')} title="En attente" className="p-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100"><Clock className="w-4 h-4" /></button>
                  <button onClick={() => setStatus(c.id, 'rejected')} title="Refuser" className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><X className="w-4 h-4" /></button>
                </div>
              </div>
              {(c.project_title || c.sector || c.project_stage) && (
                <div className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">{c.project_title || 'Projet'}</span>
                  {c.sector ? ` · ${c.sector}` : ''}{c.project_stage ? ` · ${c.project_stage}` : ''}{c.preferred_format ? ` · ${c.preferred_format}` : ''}
                </div>
              )}
              {c.motivation && <p className="mt-1.5 text-sm text-slate-500 line-clamp-3">{c.motivation}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
