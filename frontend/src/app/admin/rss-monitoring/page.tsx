'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  RefreshCw, Plus, Edit2, Trash2, Play, Pause, FlaskConical,
  CheckCircle, AlertCircle, Clock, Search, X
} from 'lucide-react'

interface Feed {
  id: string
  name: string
  url: string
  category: string
  status: 'active' | 'inactive' | 'error' | 'testing'
  last_fetch_at: string | null
  last_success_at: string | null
  last_error: string | null
  total_articles_count: number | null
  priority: number | null
  is_premium: boolean | null
  created_at: string
  updated_at: string | null
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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

function relativeTime(iso: string | null): string {
  if (!iso) return 'jamais'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}

export default function RSSMonitoringPage() {
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'error'>('all')
  const [editing, setEditing] = useState<Feed | null>(null)
  const [adding, setAdding] = useState(false)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showBanner = (type: 'success' | 'error', msg: string) => {
    setBanner({ type, msg })
    setTimeout(() => setBanner(null), 4000)
  }

  const fetchFeeds = async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/admin/rss-feeds`, { headers })
      const data = await res.json()
      if (data.success) setFeeds(data.feeds || [])
      else showBanner('error', data.error || 'Erreur de chargement')
    } catch (e: any) {
      showBanner('error', e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFeeds() }, [])

  const filtered = useMemo(() => {
    return feeds.filter(f => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      if (search && !`${f.name} ${f.url} ${f.category}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [feeds, search, statusFilter])

  const stats = useMemo(() => ({
    total: feeds.length,
    active: feeds.filter(f => f.status === 'active').length,
    error: feeds.filter(f => f.status === 'error').length,
    inactive: feeds.filter(f => f.status === 'inactive').length,
  }), [feeds])

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/admin/rss-feeds/sync-all`, { method: 'POST', headers })
      const data = await res.json()
      if (data.success) showBanner('success', 'Synchronisation lancée')
      else showBanner('error', data.error || 'Échec sync')
      setTimeout(fetchFeeds, 2000)
    } catch (e: any) {
      showBanner('error', e.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleSave = async (feed: { name: string; url: string; category: string }) => {
    try {
      const headers = await authHeaders()
      const isEdit = !!editing?.id
      const url = isEdit
        ? `${API}/api/admin/rss-feeds/${editing!.id}`
        : `${API}/api/admin/rss-feeds`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({ name: feed.name, url: feed.url, category: feed.category || 'Actualités' }),
      })
      const data = await res.json()
      if (data.success) {
        showBanner('success', isEdit ? 'Flux modifié' : 'Flux ajouté')
        setEditing(null); setAdding(false)
        fetchFeeds()
      } else {
        showBanner('error', data.error || 'Erreur')
      }
    } catch (e: any) {
      showBanner('error', e.message)
    }
  }

  const handleDelete = async (feed: Feed) => {
    if (!confirm(`Supprimer le flux "${feed.name}" ?`)) return
    const alsoArticles = confirm('Supprimer aussi tous les articles associés à ce flux ?')
    try {
      const headers = await authHeaders()
      const qs = alsoArticles ? '?deleteArticles=true' : ''
      const res = await fetch(`${API}/api/admin/rss-feeds/${feed.id}${qs}`, { method: 'DELETE', headers })
      const data = await res.json()
      if (data.success) { showBanner('success', 'Flux supprimé'); fetchFeeds() }
      else showBanner('error', data.error || 'Erreur')
    } catch (e: any) {
      showBanner('error', e.message)
    }
  }

  const handleToggle = async (feed: Feed) => {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/admin/rss-feeds/${feed.id}/toggle`, { method: 'PATCH', headers })
      const data = await res.json()
      if (data.success) { showBanner('success', data.message); fetchFeeds() }
      else showBanner('error', data.error || 'Erreur')
    } catch (e: any) {
      showBanner('error', e.message)
    }
  }

  const handleTest = async (feed: Feed) => {
    setTestResult(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/admin/rss-feeds/${feed.id}/test`, { method: 'POST', headers })
      const data = await res.json()
      setTestResult({ id: feed.id, ok: !!data.success, msg: data.message || data.error || '' })
      setTimeout(() => setTestResult(null), 5000)
    } catch (e: any) {
      setTestResult({ id: feed.id, ok: false, msg: e.message })
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des flux RSS</h1>
          <p className="text-sm text-gray-500">Ajouter, modifier et superviser les sources RSS du site</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation...' : 'Synchroniser tout'}
          </button>
          <button
            onClick={() => { setAdding(true); setEditing(null) }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" /> Ajouter un flux
          </button>
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`mb-4 px-4 py-3 rounded-lg ${banner.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {banner.msg}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Actifs" value={stats.active} accent="green" />
        <StatCard label="En erreur" value={stats.error} accent="red" />
        <StatCard label="Inactifs" value={stats.inactive} accent="gray" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, URL ou catégorie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
          <option value="error">En erreur</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Nom / URL</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-left">Dernier succès</th>
                <th className="px-4 py-3 text-right">Articles</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-md" title={f.url}>{f.url}</div>
                    {testResult?.id === f.id && (
                      <div className={`mt-1 text-xs ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                        {testResult.ok ? '✅' : '❌'} {testResult.msg}
                      </div>
                    )}
                    {f.last_error && f.status === 'error' && (
                      <div className="mt-1 text-xs text-red-600 truncate max-w-md" title={f.last_error}>
                        ⚠️ {f.last_error}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{f.category}</td>
                  <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    <Clock className="inline w-3 h-3 mr-1" />
                    {relativeTime(f.last_success_at)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{f.total_articles_count ?? 0}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <IconButton title="Tester" onClick={() => handleTest(f)}><FlaskConical className="w-4 h-4" /></IconButton>
                    <IconButton title={f.status === 'active' ? 'Désactiver' : 'Activer'} onClick={() => handleToggle(f)}>
                      {f.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </IconButton>
                    <IconButton title="Modifier" onClick={() => { setEditing(f); setAdding(false) }}><Edit2 className="w-4 h-4" /></IconButton>
                    <IconButton title="Supprimer" onClick={() => handleDelete(f)} danger><Trash2 className="w-4 h-4" /></IconButton>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">Aucun flux trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add/Edit */}
      {(adding || editing) && (
        <FeedFormModal
          initial={editing ?? undefined}
          onCancel={() => { setAdding(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: 'green' | 'red' | 'gray' }) {
  const colors: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  }
  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${accent ? colors[accent] : ''}`}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    error: 'bg-red-100 text-red-700',
    testing: 'bg-yellow-100 text-yellow-700',
  }
  const icons: Record<string, any> = {
    active: <CheckCircle className="inline w-3 h-3 mr-1" />,
    error: <AlertCircle className="inline w-3 h-3 mr-1" />,
  }
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.inactive}`}>
      {icons[status]} {status}
    </span>
  )
}

function IconButton({ children, onClick, title, danger }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100 ml-1 ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-600'}`}
    >
      {children}
    </button>
  )
}

function FeedFormModal({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Feed
  onCancel: () => void
  onSave: (feed: { name: string; url: string; category: string }) => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [category, setCategory] = useState(initial?.category || 'Actualités')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !url.trim()) return
    setSubmitting(true)
    await onSave({ name: name.trim(), url: url.trim(), category })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{initial ? 'Modifier le flux' : 'Ajouter un flux RSS'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom du flux</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Gabon Actu"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">URL du flux RSS</label>
            <input
              type="url"
              required
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/feed/"
              className="w-full px-3 py-2 border rounded-lg font-mono text-xs"
            />
            <p className="mt-1 text-xs text-gray-500">URL native du flux RSS (souvent terminée par <code>/feed/</code> ou <code>/rss/</code>)</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Catégorie</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option>Actualités</option>
              <option>Politique</option>
              <option>Économie</option>
              <option>Sport</option>
              <option>Culture</option>
              <option>Société</option>
              <option>International</option>
              <option>Ministère</option>
              <option>Vidéo / TV</option>
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Annuler</button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : initial ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
