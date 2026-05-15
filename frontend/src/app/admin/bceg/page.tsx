'use client'

import React, { DragEvent, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, RefreshCw, Search, Download, X, Loader2,
  CheckCircle2, XCircle, Clock, Send, FileEdit, ExternalLink, FileText, Eye,
  LayoutGrid, List, ArrowUpDown
} from 'lucide-react'
import BcegScoreBadge from '@/components/bceg/BcegScoreBadge'
import { BCEG_LOGO } from '@/components/bceg/BcegTheme'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Status = 'draft' | 'submitted' | 'in_review' | 'accepted' | 'rejected'
type ViewMode = 'kanban' | 'list'
type SortKey = 'date' | 'montant' | 'score'

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

const STATUS_META: Record<Status, { label: string; emoji: string; chip: string; dot: string; ring: string }> = {
  draft:     { label: 'Brouillon',  emoji: '📝', chip: 'bg-slate-100 text-slate-700 border-slate-200',     dot: 'bg-slate-400',  ring: 'ring-slate-200' },
  submitted: { label: 'Soumis',     emoji: '📤', chip: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-500',   ring: 'ring-blue-200' },
  in_review: { label: 'En revue',   emoji: '🔍', chip: 'bg-amber-50 text-amber-800 border-amber-200',      dot: 'bg-amber-500',  ring: 'ring-amber-200' },
  accepted:  { label: 'Accepté',    emoji: '✅', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', ring: 'ring-emerald-200' },
  rejected:  { label: 'Rejeté',     emoji: '❌', chip: 'bg-rose-50 text-rose-800 border-rose-200',         dot: 'bg-rose-500',   ring: 'ring-rose-200' },
}
const STATUS_ORDER: Status[] = ['draft', 'submitted', 'in_review', 'accepted', 'rejected']

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
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [selected, setSelected] = useState<Submission | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [dragCardId, setDragCardId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)

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
    let r = submissions
    if (statusFilter !== 'all') r = r.filter(s => s.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(s =>
        (s.saved_projects?.proposition_titre || '').toLowerCase().includes(q) ||
        (s.saved_projects?.article_title || '').toLowerCase().includes(q) ||
        (s.bceg_reference || '').toLowerCase().includes(q) ||
        (s.saved_projects?.secteur_selectionne || '').toLowerCase().includes(q)
      )
    }
    const dir = -1
    const copy = [...r]
    copy.sort((a, b) => {
      if (sortKey === 'montant') return ((a.montant_demande || 0) - (b.montant_demande || 0)) * dir
      if (sortKey === 'score') return ((a.bceg_score || 0) - (b.bceg_score || 0)) * dir
      const da = new Date(a.submitted_at || a.created_at).getTime()
      const db = new Date(b.submitted_at || b.created_at).getTime()
      return (da - db) * dir
    })
    return copy
  }, [submissions, search, statusFilter, sortKey])

  const grouped = useMemo(() => {
    const map: Record<Status, Submission[]> = { draft: [], submitted: [], in_review: [], accepted: [], rejected: [] }
    filtered.forEach(s => map[s.status].push(s))
    return map
  }, [filtered])

  const handleStatusChange = async (sub: Submission, newStatus: Status, extras: { admin_notes?: string; bceg_reference?: string } = {}) => {
    if (sub.status === newStatus) return
    // optimiste : update local d'abord
    setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: newStatus } : s))
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/admin/submissions/${sub.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus, ...extras }),
      })
      const json = await res.json()
      if (json?.success) {
        showBanner('success', `→ ${STATUS_META[newStatus].label}`)
        if (selected?.id === sub.id) setSelected(json.submission)
        // refresh stats
        const statRes = await fetch(`${API}/api/bceg/admin/stats`, { headers })
        const statJson = await statRes.json()
        if (statJson?.success) setStats(statJson.stats)
      } else {
        // rollback
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: sub.status } : s))
        showBanner('error', json?.error || 'Erreur')
      }
    } catch (e: any) {
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: sub.status } : s))
      showBanner('error', e?.message || 'Erreur réseau')
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

  // ===== Drag and drop =====
  const onCardDragStart = (e: DragEvent, sub: Submission) => {
    e.dataTransfer.setData('subId', sub.id)
    setDragCardId(sub.id)
  }
  const onCardDragEnd = () => {
    setDragCardId(null)
    setDragOverColumn(null)
  }
  const onColumnDragOver = (e: DragEvent, status: Status) => {
    e.preventDefault()
    setDragOverColumn(status)
  }
  const onColumnDrop = (e: DragEvent, status: Status) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('subId')
    const sub = submissions.find(s => s.id === id)
    if (sub && sub.status !== status) handleStatusChange(sub, status)
    setDragCardId(null)
    setDragOverColumn(null)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">

        {/* HEADER vert BCEG */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#697357] to-[#4d553e] rounded-2xl p-5 sm:p-6 mb-5 text-white shadow-lg shadow-[#697357]/20">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={BCEG_LOGO}
                alt="Logo BCEG"
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/40 shadow-md shrink-0"
              />
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold opacity-80">
                  Admin · BCEG
                </div>
                <h1 className="text-xl sm:text-2xl font-bold">Dossiers de financement</h1>
                <p className="text-xs sm:text-sm opacity-85">Gestion des soumissions transmises à la BCEG</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 backdrop-blur hover:bg-white/25 border border-white/20 text-sm font-medium"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Rafraîchir
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-300 hover:bg-amber-400 text-[#3a4030] text-sm font-bold"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* BANNER */}
        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-4 px-4 py-2.5 rounded-lg text-sm border ${
                banner.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {banner.msg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <KpiCard label="Total dossiers" value={stats.total} />
            <KpiCard label="En revue" value={stats.by_status.in_review} accent="amber" />
            <KpiCard label="Acceptés" value={stats.by_status.accepted} accent="emerald" />
            <KpiCard label="Taux acceptation" value={stats.acceptance_rate !== null ? `${stats.acceptance_rate} %` : '—'} accent="emerald" />
            <KpiCard label="Montants financés" value={formatXaf(stats.total_funded_xaf)} accent="green-bceg" />
          </div>
        )}

        {/* TOOLBAR */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 flex flex-wrap items-center gap-2 shadow-sm">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher titre, secteur, réf BCEG…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#697357] focus:bg-white"
            />
          </div>

          {/* Filter status */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
          >
            <option value="all">Tous statuts</option>
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
          >
            <option value="date">📅 Plus récent</option>
            <option value="montant">💰 Montant</option>
            <option value="score">🎯 Score</option>
          </select>

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
            <button
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#697357] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-[#697357] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Liste
            </button>
          </div>
        </div>

        {/* CONTENU */}
        {loading && submissions.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 text-lg font-medium">
              {submissions.length === 0 ? 'Aucune soumission BCEG pour le moment' : 'Aucun résultat'}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {submissions.length === 0
                ? 'Les dossiers soumis par les users apparaîtront ici.'
                : 'Ajustez vos filtres pour voir plus de résultats.'}
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          <KanbanView
            grouped={grouped}
            dragCardId={dragCardId}
            dragOverColumn={dragOverColumn}
            onCardClick={setSelected}
            onCardDragStart={onCardDragStart}
            onCardDragEnd={onCardDragEnd}
            onColumnDragOver={onColumnDragOver}
            onColumnDrop={onColumnDrop}
          />
        ) : (
          <ListView submissions={filtered} onRowClick={setSelected} onStatusChange={handleStatusChange} />
        )}
      </div>

      {/* Modal détail */}
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
function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: 'amber' | 'emerald' | 'rose' | 'green-bceg' }) {
  const color = accent === 'amber' ? 'text-amber-600'
    : accent === 'emerald' ? 'text-emerald-600'
    : accent === 'rose' ? 'text-rose-600'
    : accent === 'green-bceg' ? 'text-[#697357]'
    : 'text-slate-900'
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 font-bold">{label}</div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  )
}

// =====================================================================
function KanbanView({
  grouped,
  dragCardId,
  dragOverColumn,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
  onColumnDragOver,
  onColumnDrop,
}: {
  grouped: Record<Status, Submission[]>
  dragCardId: string | null
  dragOverColumn: Status | null
  onCardClick: (s: Submission) => void
  onCardDragStart: (e: DragEvent, s: Submission) => void
  onCardDragEnd: () => void
  onColumnDragOver: (e: DragEvent, st: Status) => void
  onColumnDrop: (e: DragEvent, st: Status) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {STATUS_ORDER.map(status => {
        const meta = STATUS_META[status]
        const cards = grouped[status]
        const isOver = dragOverColumn === status
        return (
          <div
            key={status}
            onDragOver={e => onColumnDragOver(e, status)}
            onDrop={e => onColumnDrop(e, status)}
            onDragLeave={() => {}}
            className={`rounded-xl border bg-white p-3 min-h-[300px] transition-all ${
              isOver ? 'border-[#697357] ring-2 ring-[#697357]/30 bg-[#697357]/5' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm flex items-center gap-1.5 text-slate-800">
                <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold tabular-nums">
                {cards.length}
              </span>
            </div>
            <div className="space-y-2">
              {cards.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Glissez une carte ici</p>
              ) : (
                cards.map(sub => (
                  <KanbanCard
                    key={sub.id}
                    sub={sub}
                    isDragging={dragCardId === sub.id}
                    onClick={() => onCardClick(sub)}
                    onDragStart={e => onCardDragStart(e, sub)}
                    onDragEnd={onCardDragEnd}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// =====================================================================
function KanbanCard({
  sub,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  sub: Submission
  isDragging: boolean
  onClick: () => void
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
}) {
  const title = sub.saved_projects?.proposition_titre || sub.saved_projects?.article_title || `Dossier ${sub.id.slice(0, 8)}`
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group cursor-grab active:cursor-grabbing bg-white border border-slate-200 hover:border-[#697357]/40 hover:-translate-y-0.5 rounded-lg p-3 shadow-sm hover:shadow-md transition-all ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 flex-1">{title}</h4>
        {sub.bceg_score !== null && sub.bceg_score !== undefined && (
          <BcegScoreBadge score={sub.bceg_score} size="sm" showLabel={false} />
        )}
      </div>
      <div className="text-xs text-slate-500 space-y-1">
        {sub.montant_demande !== null && sub.montant_demande !== undefined && (
          <div className="font-bold text-[#697357]">{formatXaf(sub.montant_demande)}</div>
        )}
        {sub.saved_projects?.secteur_selectionne && (
          <div className="text-slate-600 truncate">{sub.saved_projects.secteur_selectionne}</div>
        )}
        {sub.bceg_reference && (
          <div className="text-[10px] font-mono text-emerald-600">REF: {sub.bceg_reference}</div>
        )}
        <div className="text-[10px] text-slate-400 mt-1">{timeAgo(sub.submitted_at || sub.created_at)}</div>
      </div>
    </div>
  )
}

// =====================================================================
function ListView({
  submissions,
  onRowClick,
  onStatusChange,
}: {
  submissions: Submission[]
  onRowClick: (s: Submission) => void
  onStatusChange: (sub: Submission, st: Status) => void
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-[11px] uppercase tracking-wider font-bold text-slate-600">
              <th className="px-4 py-3">Projet</th>
              <th className="px-4 py-3 hidden md:table-cell">Secteur</th>
              <th className="px-4 py-3">Montant</th>
              <th className="px-4 py-3 hidden sm:table-cell">Score</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 hidden lg:table-cell">Soumis</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {submissions.map(sub => {
              const title = sub.saved_projects?.proposition_titre || sub.saved_projects?.article_title || `Dossier ${sub.id.slice(0, 8)}`
              const meta = STATUS_META[sub.status]
              return (
                <tr
                  key={sub.id}
                  onClick={() => onRowClick(sub)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 line-clamp-1">{title}</div>
                    {sub.bceg_reference && (
                      <div className="text-[10px] font-mono text-emerald-600 mt-0.5">REF: {sub.bceg_reference}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {sub.saved_projects?.secteur_selectionne || '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-[#697357] tabular-nums">
                    {formatXaf(sub.montant_demande)}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {sub.bceg_score !== null && sub.bceg_score !== undefined ? (
                      <BcegScoreBadge score={sub.bceg_score} size="sm" showLabel={false} />
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select
                      value={sub.status}
                      onChange={e => onStatusChange(sub, e.target.value as Status)}
                      className={`text-xs font-bold border rounded-md px-2 py-1 cursor-pointer ${meta.chip}`}
                    >
                      {STATUS_ORDER.map(s => (
                        <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                    {timeAgo(sub.submitted_at || sub.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); onRowClick(sub) }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#697357]/10 hover:bg-[#697357]/20 text-[#697357] text-xs font-semibold"
                    >
                      <Eye className="w-3 h-3" /> Voir
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
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
  const meta = STATUS_META[submission.status]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="max-w-3xl mx-auto my-8 bg-white border border-slate-200 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#697357] to-[#4d553e] rounded-t-2xl px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${meta.chip}`}>
                  {meta.emoji} {meta.label}
                </span>
              </div>
              <h2 className="text-xl font-bold leading-tight">
                {project.proposition_titre || project.article_title || 'Dossier BCEG'}
              </h2>
              <p className="text-sm opacity-85 mt-0.5">{project.secteur_selectionne || 'Secteur non précisé'}</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Score + montant */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {submission.bceg_score !== null && submission.bceg_score !== undefined && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                <BcegScoreBadge score={submission.bceg_score} size="md" />
                <div className="text-xs text-slate-600">Score à la soumission</div>
              </div>
            )}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Montant demandé</div>
              <div className="text-xl font-bold text-[#697357] tabular-nums">{formatXaf(submission.montant_demande)}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Mensualité</div>
              <div className="text-xl font-bold text-amber-700 tabular-nums">{formatXaf(sim.mensualite)}</div>
            </div>
          </div>

          {project.problematique_centrale && (
            <Section title="Problématique" icon="🎯">
              <p className="text-sm text-slate-700">{project.problematique_centrale}</p>
            </Section>
          )}
          {project.proposition_description && (
            <Section title="Description du projet" icon="💡">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{project.proposition_description}</p>
            </Section>
          )}

          <Section title="Simulation crédit BCEG" icon="💰">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV label="Type" value={sim.type === 'entreprise' ? 'Entreprise' : 'Particulier'} />
              <KV label="Apport personnel" value={`${formatXaf(sim.apport_personnel)} (${sim.apport_pct ?? 0} %)`} />
              <KV label="Durée" value={sim.duree_mois ? `${sim.duree_mois} mois (${(sim.duree_mois / 12).toFixed(1)} ans)` : '—'} />
              <KV label="Taux annuel" value={sim.taux_annuel ? `${sim.taux_annuel} %` : '—'} />
              <KV label="Total à rembourser" value={formatXaf(sim.total_a_rembourser)} />
              <KV label="Mensualité" value={formatXaf(sim.mensualite)} accent />
            </div>
          </Section>

          <Section title="Dossier PDF" icon="📄">
            {submission.pdf_url ? (
              <a
                href={submission.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#697357]/10 hover:bg-[#697357]/20 border border-[#697357]/30 text-[#697357] rounded-lg text-sm font-semibold"
              >
                <FileText className="w-4 h-4" /> Ouvrir le PDF
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <p className="text-sm text-slate-500 italic">PDF non disponible</p>
            )}
          </Section>

          <Section title="Suivi BCEG" icon="📋">
            <label className="block text-xs text-slate-600 mb-1 font-medium">Référence BCEG</label>
            <input
              type="text"
              value={ref}
              onChange={e => setRef(e.target.value)}
              placeholder="Ex: BCEG-2026-001234"
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#697357] mb-3"
            />
            <label className="block text-xs text-slate-600 mb-1 font-medium">Notes internes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Demande de compléments, commentaires sur le dossier, etc."
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#697357] resize-none"
            />
          </Section>

          <Section title="Décision" icon="⚡">
            <div className="flex flex-wrap gap-2">
              <ActionBtn icon={<FileEdit className="w-3.5 h-3.5" />} label="Brouillon" onClick={() => onStatusChange(submission, 'draft', { admin_notes: notes, bceg_reference: ref })} tone="slate" />
              <ActionBtn icon={<Send className="w-3.5 h-3.5" />} label="Marquer Soumis" onClick={() => onStatusChange(submission, 'submitted', { admin_notes: notes, bceg_reference: ref })} tone="blue" />
              <ActionBtn icon={<Eye className="w-3.5 h-3.5" />} label="En revue" onClick={() => onStatusChange(submission, 'in_review', { admin_notes: notes, bceg_reference: ref })} tone="amber" />
              <ActionBtn icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Accepter" onClick={() => onStatusChange(submission, 'accepted', { admin_notes: notes, bceg_reference: ref })} tone="emerald" />
              <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} label="Rejeter" onClick={() => onStatusChange(submission, 'rejected', { admin_notes: notes, bceg_reference: ref })} tone="rose" />
            </div>
          </Section>

          <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 space-y-0.5">
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
      <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  )
}

function KV({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 border ${accent ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{label}</div>
      <div className={`font-semibold tabular-nums ${accent ? 'text-amber-800' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function ActionBtn({ icon, label, onClick, tone }: { icon: React.ReactNode; label: string; onClick: () => void; tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'rose' }) {
  const tones: Record<string, string> = {
    slate:   'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700',
    blue:    'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
    amber:   'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700',
    rose:    'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700',
  }
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border ${tones[tone]}`}>
      {icon} {label}
    </button>
  )
}
