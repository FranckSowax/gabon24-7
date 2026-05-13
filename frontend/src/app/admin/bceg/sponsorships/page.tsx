'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift, Plus, RefreshCw, X, Loader2, Award, UserPlus, Calendar,
  CheckCircle2, AlertCircle, TrendingUp
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Sponsorship {
  id: string
  campaign_name: string
  description: string | null
  credits_offered: number
  total_budget: number
  credits_used: number
  target_sectors: string[] | null
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  starts_at: string | null
  ends_at: string | null
  created_at: string
}

const SECTORS = [
  'agriculture', 'elevage', 'aviculture', 'peche', 'btp', 'commerce',
  'transport', 'restauration', 'beaute', 'artisanat', 'tech', 'education',
  'sante', 'tourisme', 'industrie',
]

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  paused: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  completed: 'bg-blue-500/15 text-blue-300 border-blue-400/30',
  cancelled: 'bg-rose-500/15 text-rose-300 border-rose-400/30',
}

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

function formatXAF(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR').format(n) + ' XAF'
}

export default function AdminSponsorshipsPage() {
  const [list, setList] = useState<Sponsorship[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showGrant, setShowGrant] = useState<Sponsorship | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/admin/sponsorships`, { headers })
      const json = await res.json()
      if (json?.success) setList(json.sponsorships || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalBudget = useMemo(() => list.reduce((s, c) => s + (c.total_budget || 0), 0), [list])
  const totalUsed = useMemo(() => list.reduce((s, c) => s + (c.credits_used || 0), 0), [list])
  const activeCount = useMemo(() => list.filter(c => c.status === 'active').length, [list])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Gift className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="text-2xl font-black">BCEG Sponsoring</h1>
              <p className="text-sm text-white/60">Campagnes de crédits offerts par BCEG aux entrepreneurs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
              aria-label="Rafraîchir"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-bold text-sm hover:from-amber-500 hover:to-orange-600"
            >
              <Plus className="w-4 h-4" /> Nouvelle campagne
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <KpiCard icon={<Award className="w-4 h-4" />} label="Campagnes actives" value={activeCount.toString()} />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Budget total" value={formatXAF(totalBudget)} />
          <KpiCard icon={<CheckCircle2 className="w-4 h-4" />} label="Crédits distribués" value={formatXAF(totalUsed)} />
        </div>

        {loading ? (
          <div className="text-center py-12 text-white/50">
            <Loader2 className="w-6 h-6 animate-spin inline" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {list.map(s => (
              <SponsorshipCard key={s.id} sponsorship={s} onGrant={() => setShowGrant(s)} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); load() }}
          />
        )}
        {showGrant && (
          <GrantModal
            sponsorship={showGrant}
            onClose={() => setShowGrant(null)}
            onGranted={() => { setShowGrant(null); load() }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-xs text-white/60 mb-1">{icon} {label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16 rounded-xl border border-dashed border-white/15 bg-white/5">
      <Gift className="w-10 h-10 mx-auto mb-3 text-white/30" />
      <p className="text-white/80 font-medium mb-1">Aucune campagne de sponsoring</p>
      <p className="text-sm text-white/50 mb-4">Crée une campagne BCEG pour offrir des crédits à des secteurs ciblés.</p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-bold text-sm"
      >
        <Plus className="w-4 h-4" /> Créer une campagne
      </button>
    </div>
  )
}

function SponsorshipCard({ sponsorship: s, onGrant }: { sponsorship: Sponsorship; onGrant: () => void }) {
  const pct = s.total_budget > 0 ? Math.min(100, Math.round((s.credits_used / s.total_budget) * 100)) : 0
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/5 p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-base">{s.campaign_name}</h3>
          {s.description && <p className="text-xs text-white/60 mt-1 line-clamp-2">{s.description}</p>}
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border font-bold ${STATUS_TONE[s.status] || 'bg-white/5 text-white/60 border-white/15'}`}>
          {s.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div>
          <div className="text-white/50">Crédit / bénéficiaire</div>
          <div className="font-bold text-amber-300">{formatXAF(s.credits_offered)}</div>
        </div>
        <div>
          <div className="text-white/50">Budget total</div>
          <div className="font-bold">{formatXAF(s.total_budget)}</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span>Utilisé</span>
          <span>{pct}% — {formatXAF(s.credits_used)}</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {s.target_sectors && s.target_sectors.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {s.target_sectors.map(sec => (
            <span key={sec} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-400/20">
              {sec}
            </span>
          ))}
        </div>
      )}

      {s.ends_at && (
        <div className="flex items-center gap-1 text-[11px] text-white/50 mb-3">
          <Calendar className="w-3 h-3" /> Fin : {new Date(s.ends_at).toLocaleDateString('fr-FR')}
        </div>
      )}

      <button
        onClick={onGrant}
        disabled={s.status !== 'active'}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <UserPlus className="w-4 h-4" /> Octroyer à un utilisateur
      </button>
    </motion.div>
  )
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [credits, setCredits] = useState<number>(500000)
  const [budget, setBudget] = useState<number>(5000000)
  const [endsAt, setEndsAt] = useState('')
  const [sectors, setSectors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleSector = (s: string) => {
    setSectors(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  const submit = async () => {
    if (!name.trim() || !credits || !budget) {
      setError('Nom, crédit unitaire et budget sont obligatoires')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/admin/sponsorships`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          campaign_name: name.trim(),
          description: description.trim() || null,
          credits_offered: credits,
          total_budget: budget,
          target_sectors: sectors.length > 0 ? sectors : null,
          ends_at: endsAt || null,
          status: 'active',
        }),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Erreur création campagne')
      onCreated()
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-bold flex items-center gap-2"><Plus className="w-4 h-4 text-amber-300" /> Nouvelle campagne</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nom de la campagne *">
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: PME Agriculture 2026"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Objectifs de la campagne, public visé…"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Crédit / bénéficiaire (XAF) *">
              <input
                type="number" value={credits} onChange={e => setCredits(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
              />
            </Field>
            <Field label="Budget total (XAF) *">
              <input
                type="number" value={budget} onChange={e => setBudget(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
              />
            </Field>
          </div>
          <Field label="Date de fin (optionnel)">
            <input
              type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
            />
          </Field>
          <Field label="Secteurs ciblés (laisser vide = tous)">
            <div className="flex flex-wrap gap-1.5">
              {SECTORS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSector(s)}
                  className={`text-xs px-2 py-1 rounded-full border ${
                    sectors.includes(s)
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </Field>
          {budget > 0 && credits > 0 && (
            <div className="text-xs text-white/60 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              ≈ <span className="font-bold text-amber-300">{Math.floor(budget / credits)}</span> bénéficiaires possibles
            </div>
          )}
          {error && (
            <div className="text-xs text-rose-300 flex items-center gap-1.5 bg-rose-500/10 border border-rose-400/20 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-bold hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer la campagne
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function GrantModal({ sponsorship, onClose, onGranted }: {
  sponsorship: Sponsorship
  onClose: () => void
  onGranted: () => void
}) {
  const [userId, setUserId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!userId.trim()) {
      setError('user_id requis')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/admin/sponsorships/${sponsorship.id}/grant`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId.trim(), reason: reason.trim() || null }),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Erreur octroi')
      onGranted()
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="font-bold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-amber-300" /> Octroyer un crédit
          </h3>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs text-white/60 bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="font-bold text-white mb-1">{sponsorship.campaign_name}</div>
            Crédit offert : <span className="font-bold text-amber-300">{formatXAF(sponsorship.credits_offered)}</span>
          </div>
          <Field label="User ID (UUID Supabase) *">
            <input
              value={userId} onChange={e => setUserId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono focus:outline-none focus:border-amber-400/50"
            />
          </Field>
          <Field label="Motif (optionnel)">
            <textarea
              value={reason} onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="Ex: BCEG Score > 75, secteur prioritaire…"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
            />
          </Field>
          {error && (
            <div className="text-xs text-rose-300 flex items-center gap-1.5 bg-rose-500/10 border border-rose-400/20 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 font-bold hover:from-amber-500 hover:to-orange-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmer l'octroi
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/70 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
