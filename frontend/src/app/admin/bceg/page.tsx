'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, RefreshCw, Search, Download, X, Loader2,
  CheckCircle2, XCircle, Clock, Send, FileEdit, ExternalLink, FileText, Eye
} from 'lucide-react'
import BcegScoreBadge from '@/components/bceg/BcegScoreBadge'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Status = 'draft' | 'submitted' | 'in_review' | 'accepted' | 'rejected'

interface Submission {
  id: string
  user_id: string
  project_id: string | null
  simulation_id: string | null
  status: Status
  bceg_reference: string | null
  montant_demande: number | null
  bceg_score: number | null
  admin_notes: string | null
  pdf_url: string | null
  submitted_at: string | null
  decision_at: string | null
  created_at: string
  updated_at: string
  saved_projects?: {
    article_title?: string
    proposition_titre?: string
    secteur_selectionne?: string
    problematique_centrale?: string
    proposition_description?: string
  }
  bceg_simulations?: {
    montant_demande?: number
    apport_personnel?: number
    apport_pct?: number
    duree_mois?: number
    mensualite?: number
    total_a_rembourser?: number
    type?: 'particulier' | 'entreprise'
    taux_annuel?: number
  }
}

interface Stats {
  total: number
  by_status: Record<Status, number>
  acceptance_rate: number | null
  total_funded_xaf: number
  avg_accepted_score: number | null
}

const STATUS_COLUMNS: { key: Status; label: string; emoji: string; tone: string }[] = [
  { key: 'draft',      label: 'Brouillon',  emoji: '📝', tone: 'bg-slate-500/10 border-slate-400/30 text-slate-200' },
  { key: 'submitted',  label: 'Soumis',     emoji: '📤', tone: 'bg-blue-500/10 border-blue-400/30 text-blue-200' },
  { key: 'in_review',  label: 'En revue',   emoji: '🔍', tone: 'bg-amber-500/10 border-amber-400/30 text-amber-200' },
  { key: 'accepted',   label: 'Accepté',    emoji: '✅', tone: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200' },
  { key: 'rejected',   label: 'Rejeté',     emoji: '❌', tone: 'bg-red-500/10 border-red-400/30 text-red-200' },
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

function formatXaf(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XAF'
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

export default function AdminBcegDashboardPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showBanner = (type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 4000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const [subRes, statRes] = await Promise.all([
        fetch(`${API}/api/bceg/admin/submissions`, { headers }),
        fetch(`${API}/api/bceg/admin/stats`, { headers }),
      ])
      const subJson = await subRes.json()
      const statJson = await statRes.json()
      if (subJson?.success) setSubmissions(subJson.submissions || [])
      if (statJson?.success) setStats(statJson.stats)
    } catch (e: any) {
      showBanner('error', e?.message || 'Erreur chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return submissions
    const q = search.toLowerCase()
    return submissions.filter(s =>
      (s.saved_projects?.proposition_titre || '').toLowerCase().includes(q) ||
      (s.saved_projects?.article_title || '').toLowerCase().includes(q) ||
      (s.bceg_reference || '').toLowerCase().includes(q) ||
      (s.saved_projects?.secteur_selectionne || '').toLowerCase().includes(q)
    )
  }, [submissions, search])

  const grouped = useMemo(() => {
    const map: Record<Status, Submission[]> = { draft: [], submitted: [], in_review: [], accepted: [], rejected: [] }
    filtered.forEach(s => map[s.status].push(s))
    return map
  }, [filtered])

  const handleStatusChange = async (sub: Submission, newStatus: Status, extras: { admin_notes?: string; bceg_reference?: string } = {}) => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/admin/submissions/${sub.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus, ...extras }),
      })
      const json = await res.json()
      if (json?.success) {
        showBanner('success', `Soumission → ${newStatus}`)
        await load()
        if (selected?.id === sub.id) setSelected(json.submission)
      } else {
        showBanner('error', json?.error || 'Erreur')
      }
    } catch (e: any) {
      showBanner('error', e?.message || 'Erreur')
    }
  }

  const handleExport = async () => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/admin/export`, { headers })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bceg-submissions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showBanner('success', 'Export CSV téléchargé')
    } catch (e: any) {
      showBanner('error', e?.message || 'Erreur export')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-[1600px] mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-2xl">🏦</div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">BCEG Project — Dashboard</h1>
              <p className="text-sm text-white/60">Gestion des dossiers de financement transmis à la BCEG</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
            <button onClick={handleExport} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-sm font-medium">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Banner */}
        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
                banner.type === 'success' ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-100' : 'bg-red-500/20 border border-red-400/30 text-red-100'
              }`}
            >
              {banner.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats KPIs */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <KpiCard label="Total dossiers" value={stats.total} />
            <KpiCard label="En revue" value={stats.by_status.in_review} accent="amber" />
            <KpiCard label="Acceptés" value={stats.by_status.accepted} accent="emerald" />
            <KpiCard label="Taux acceptation" value={stats.acceptance_rate !== null ? `${stats.acceptance_rate} %` : '—'} accent="emerald" />
            <KpiCard label="Montants financés" value={formatXaf(stats.total_funded_xaf)} accent="amber" />
          </div>
        )}

        {/* Search */}
        <div className="mb-4 relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher (titre, secteur, référence BCEG…)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/40 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        {/* Kanban */}
        {loading && submissions.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-white/60 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : submissions.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl py-16 text-center">
            <Building2 className="w-12 h-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/70 text-lg font-medium">Aucune soumission BCEG pour le moment</p>
            <p className="text-white/50 text-sm mt-1">Les dossiers soumis par les users apparaîtront ici.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 overflow-x-auto">
            {STATUS_COLUMNS.map(col => (
              <div key={col.key} className={`rounded-xl border p-3 min-h-[300px] ${col.tone}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <span>{col.emoji}</span> {col.label}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 tabular-nums">
                    {grouped[col.key].length}
                  </span>
                </div>
                <div className="space-y-2">
                  {grouped[col.key].length === 0 ? (
                    <p className="text-xs text-white/40 italic text-center py-4">Vide</p>
                  ) : (
                    grouped[col.key].map(sub => (
                      <SubmissionCard key={sub.id} sub={sub} onClick={() => setSelected(sub)} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <SubmissionDetailModal
            submission={selected}
            onClose={() => setSelected(null)}
            onStatusChange={handleStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// =====================================================================
function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: 'amber' | 'emerald' | 'red' }) {
  const color = accent === 'amber' ? 'text-amber-300' : accent === 'emerald' ? 'text-emerald-300' : accent === 'red' ? 'text-red-300' : 'text-white'
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-xs uppercase tracking-wider text-white/50 mb-1">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

// =====================================================================
function SubmissionCard({ sub, onClick }: { sub: Submission; onClick: () => void }) {
  const title = sub.saved_projects?.proposition_titre || sub.saved_projects?.article_title || `Dossier ${sub.id.slice(0, 8)}`
  return (
    <motion.button
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="w-full text-left bg-slate-900/80 hover:bg-slate-900 border border-white/10 hover:border-white/20 rounded-lg p-3 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-white line-clamp-2 flex-1">{title}</h4>
        {sub.bceg_score !== null && sub.bceg_score !== undefined && (
          <BcegScoreBadge score={sub.bceg_score} size="sm" showLabel={false} />
        )}
      </div>
      <div className="text-xs text-white/60 space-y-0.5">
        {sub.montant_demande !== null && sub.montant_demande !== undefined && (
          <div className="flex items-center gap-1"><span className="font-medium text-amber-300">{formatXaf(sub.montant_demande)}</span></div>
        )}
        {sub.saved_projects?.secteur_selectionne && (
          <div className="text-white/50 truncate">{sub.saved_projects.secteur_selectionne}</div>
        )}
        {sub.bceg_reference && (
          <div className="text-emerald-300 font-mono text-[10px]">REF: {sub.bceg_reference}</div>
        )}
        <div className="text-white/40 text-[10px] mt-1">{timeAgo(sub.submitted_at || sub.created_at)}</div>
      </div>
    </motion.button>
  )
}

// =====================================================================
function SubmissionDetailModal({
  submission,
  onClose,
  onStatusChange,
}: {
  submission: Submission
  onClose: () => void
  onStatusChange: (sub: Submission, status: Status, extras?: { admin_notes?: string; bceg_reference?: string }) => void
}) {
  const [notes, setNotes] = useState(submission.admin_notes || '')
  const [ref, setRef] = useState(submission.bceg_reference || '')
  const project = submission.saved_projects || {}
  const sim = submission.bceg_simulations || {}

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="max-w-3xl mx-auto my-8 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="text-xl font-bold text-white">
              {project.proposition_titre || project.article_title || 'Dossier BCEG'}
            </h2>
            <p className="text-sm text-white/60 mt-1">{project.secteur_selectionne}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {submission.bceg_score !== null && submission.bceg_score !== undefined && (
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-4">
              <BcegScoreBadge score={submission.bceg_score} size="lg" />
              <div className="text-xs text-white/60 flex-1">
                Score calculé au moment de la soumission
              </div>
            </div>
          )}

          {project.problematique_centrale && (
            <Section title="Problématique" icon="🎯">
              <p className="text-sm text-white/80">{project.problematique_centrale}</p>
            </Section>
          )}
          {project.proposition_description && (
            <Section title="Description du projet" icon="💡">
              <p className="text-sm text-white/80 whitespace-pre-wrap">{project.proposition_description}</p>
            </Section>
          )}

          <Section title="Simulation crédit BCEG" icon="💰">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV label="Type" value={sim.type === 'entreprise' ? 'Entreprise' : 'Particulier'} />
              <KV label="Montant demandé" value={formatXaf(submission.montant_demande)} />
              <KV label="Apport personnel" value={`${formatXaf(sim.apport_personnel)} (${sim.apport_pct ?? 0} %)`} />
              <KV label="Durée" value={sim.duree_mois ? `${sim.duree_mois} mois (${(sim.duree_mois / 12).toFixed(1)} ans)` : '—'} />
              <KV label="Mensualité" value={formatXaf(sim.mensualite)} accent />
              <KV label="Taux annuel" value={sim.taux_annuel ? `${sim.taux_annuel} %` : '—'} />
            </div>
          </Section>

          <Section title="Dossier PDF" icon="📄">
            {submission.pdf_url ? (
              <a
                href={submission.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-400/30 text-amber-100 rounded-lg text-sm"
              >
                <FileText className="w-4 h-4" /> Ouvrir le PDF
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-sm text-white/50 italic">PDF non disponible (sera généré en Phase 3)</p>
            )}
          </Section>

          <Section title="Suivi BCEG" icon="📋">
            <label className="block text-xs text-white/60 mb-1">Référence BCEG</label>
            <input
              type="text"
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="Ex: BCEG-2026-001234"
              className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 mb-3"
            />
            <label className="block text-xs text-white/60 mb-1">Notes internes (visibles uniquement par l'équipe BCEG)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Demande de compléments, commentaires sur le dossier, etc."
              className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 resize-none"
            />
          </Section>

          <Section title="Décision" icon="⚡">
            <div className="flex flex-wrap gap-2">
              <ActionBtn icon={<FileEdit className="w-3.5 h-3.5" />} label="Brouillon" onClick={() => onStatusChange(submission, 'draft', { admin_notes: notes, bceg_reference: ref })} tone="slate" />
              <ActionBtn icon={<Send className="w-3.5 h-3.5" />} label="Marquer Soumis" onClick={() => onStatusChange(submission, 'submitted', { admin_notes: notes, bceg_reference: ref })} tone="blue" />
              <ActionBtn icon={<Eye className="w-3.5 h-3.5" />} label="En revue" onClick={() => onStatusChange(submission, 'in_review', { admin_notes: notes, bceg_reference: ref })} tone="amber" />
              <ActionBtn icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Accepter" onClick={() => onStatusChange(submission, 'accepted', { admin_notes: notes, bceg_reference: ref })} tone="emerald" />
              <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="Rejeter" onClick={() => onStatusChange(submission, 'rejected', { admin_notes: notes, bceg_reference: ref })} tone="red" />
            </div>
          </Section>

          <div className="text-xs text-white/40 border-t border-white/10 pt-3 space-y-0.5">
            <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Créé {timeAgo(submission.created_at)}</div>
            {submission.submitted_at && <div className="flex items-center gap-1"><Send className="w-3 h-3" /> Soumis {timeAgo(submission.submitted_at)}</div>}
            {submission.decision_at && <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Décision {timeAgo(submission.decision_at)}</div>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/90 mb-2 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  )
}

function KV({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-white/5 rounded-lg px-3 py-2 border ${accent ? 'border-amber-300/30 bg-amber-500/10' : 'border-white/5'}`}>
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
      <div className={`font-semibold tabular-nums ${accent ? 'text-amber-200' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'red' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-500/20 hover:bg-slate-500/30 border-slate-400/30 text-slate-100',
    blue: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/30 text-blue-100',
    amber: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/30 text-amber-100',
    emerald: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-400/30 text-emerald-100',
    red: 'bg-red-500/20 hover:bg-red-500/30 border-red-400/30 text-red-100',
  }
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${tones[tone]}`}>
      {icon} {label}
    </button>
  )
}
