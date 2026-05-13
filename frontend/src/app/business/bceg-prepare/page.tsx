'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, Upload, FileText, CheckCircle2, Clock, AlertCircle, X,
  Calendar, Phone, Send, Trash2, Loader2, Bell
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

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

const DOC_TYPES = [
  { value: 'cni', label: 'Carte Nationale d\'Identité', emoji: '🪪', required: true },
  { value: 'passeport', label: 'Passeport', emoji: '📘', required: false },
  { value: 'rccm', label: 'RCCM (Registre Commerce)', emoji: '📋', required: true },
  { value: 'statuts', label: "Statuts de l'entreprise", emoji: '📄', required: false },
  { value: 'rib', label: 'RIB (Relevé Identité Bancaire)', emoji: '🏦', required: true },
  { value: 'kbis', label: 'Kbis / Attestation', emoji: '📑', required: false },
  { value: 'justificatif_domicile', label: 'Justificatif de domicile', emoji: '🏠', required: false },
  { value: 'releve_bancaire', label: 'Relevé bancaire (3 derniers mois)', emoji: '💳', required: false },
  { value: 'attestation_revenus', label: 'Attestation de revenus', emoji: '💰', required: false },
  { value: 'plan_business', label: 'Business plan détaillé', emoji: '📊', required: false },
]

const SECTOR_OPTIONS = [
  'Agriculture', 'Commerce', 'PME / PMI', 'Industrie', 'Tourisme', 'Artisanat',
  'Transport', 'Énergie', 'Numérique / Tech', 'Santé', 'Éducation', 'BTP', 'Immobilier', 'Restauration', 'Élevage',
]

export default function BcegPreparePage() {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [tab, setTab] = useState<'docs' | 'rdv' | 'alerts'>('docs')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-5 sm:py-7">

            <button
              onClick={() => router.push('/business/live-opportunities')}
              className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs mb-2">
                <Building2 className="w-3 h-3" /> Préparation BCEG
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Renforce ton dossier <span className="text-amber-300">BCEG</span></h1>
              <p className="text-sm text-white/60">Charge les documents requis, prends RDV avec un conseiller, et active les notifs sectorielles.</p>
            </div>

            <div className="flex gap-2 mb-5 p-1 bg-white/5 rounded-xl">
              <TabBtn active={tab === 'docs'} onClick={() => setTab('docs')} icon={<FileText className="w-4 h-4" />} label="Documents" />
              <TabBtn active={tab === 'rdv'} onClick={() => setTab('rdv')} icon={<Calendar className="w-4 h-4" />} label="RDV BCEG" />
              <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')} icon={<Bell className="w-4 h-4" />} label="Alertes secteurs" />
            </div>

            {tab === 'docs' && <DocsTab />}
            {tab === 'rdv' && <RdvTab />}
            {tab === 'alerts' && <AlertsTab />}
          </main>
        </div>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950' : 'text-white/70 hover:text-white hover:bg-white/5'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// =====================================================================
function DocsTab() {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/due-diligence/mine`, { headers })
      const json = await res.json()
      if (json?.success) setDocs(json.documents || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const handleUpload = async (docType: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setBanner({ type: 'error', msg: 'Fichier trop volumineux (max 10 MB)' })
      return
    }
    setUploading(docType)
    try {
      const headers = await authHeaders()

      const signRes = await fetch(`${API}/api/bceg/due-diligence/sign-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ doc_type: docType, file_name: file.name }),
      })
      const signJson = await signRes.json()
      if (!signJson?.success) throw new Error(signJson?.error || 'Erreur signature')

      const upRes = await fetch(signJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!upRes.ok) throw new Error('Upload échoué')

      const fileUrl = `due-diligence/${signJson.path}`

      const saveRes = await fetch(`${API}/api/bceg/due-diligence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          doc_type: docType,
          file_url: fileUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveJson?.success) throw new Error(saveJson?.error || 'Erreur enregistrement')

      setBanner({ type: 'success', msg: `✅ ${file.name} uploadé` })
      await load()
    } catch (e: any) {
      setBanner({ type: 'error', msg: e?.message || 'Erreur upload' })
    } finally {
      setUploading(null)
      setTimeout(() => setBanner(null), 4000)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce document ?')) return
    const headers = await authHeaders()
    await fetch(`${API}/api/bceg/due-diligence/${id}`, { method: 'DELETE', headers })
    load()
  }

  if (loading) return <div className="text-center py-12 text-white/60"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>

  return (
    <div>
      {banner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-3 px-3 py-2 rounded-lg text-sm ${banner.type === 'success' ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-100' : 'bg-red-500/15 border border-red-400/30 text-red-100'}`}>
          {banner.msg}
        </motion.div>
      )}

      <p className="text-xs text-white/60 mb-4">JPG, PNG, WebP ou PDF, max 10 MB par fichier. Vos documents sont chiffrés et accessibles uniquement par vous et l'équipe BCEG.</p>

      <div className="space-y-2">
        {DOC_TYPES.map(dt => {
          const userDoc = docs.find(d => d.doc_type === dt.value)
          return (
            <div key={dt.value} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="text-2xl">{dt.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{dt.label}</span>
                  {dt.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-200 border border-red-400/30">Requis</span>}
                </div>
                {userDoc && (
                  <div className="text-xs text-white/60 mt-1 truncate">
                    📎 {userDoc.file_name} • <StatusBadge status={userDoc.verification_status} />
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                {!userDoc ? (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-200 text-xs font-medium">
                    {uploading === dt.value ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    Choisir
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="hidden"
                      disabled={!!uploading}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleUpload(dt.value, f)
                      }}
                    />
                  </label>
                ) : (
                  <button onClick={() => handleDelete(userDoc.id)} className="p-2 rounded-lg text-red-300 hover:bg-red-500/15">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'En attente', cls: 'text-amber-300' },
    verified: { label: '✓ Vérifié', cls: 'text-emerald-300' },
    rejected: { label: '✗ Rejeté', cls: 'text-red-300' },
    needs_resubmit: { label: 'À renvoyer', cls: 'text-orange-300' },
  }
  const s = map[status] || map.pending
  return <span className={`text-[10px] font-medium ${s.cls}`}>{s.label}</span>
}

// =====================================================================
function RdvTab() {
  const [appts, setAppts] = useState<any[]>([])
  const [form, setForm] = useState({ user_name: '', user_phone: '', appointment_date: '', appointment_time: '', topic: '' })
  const [loading, setLoading] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = async () => {
    const headers = await authHeaders()
    const res = await fetch(`${API}/api/bceg/appointments/mine`, { headers })
    const json = await res.json()
    if (json?.success) setAppts(json.appointments || [])
  }
  useEffect(() => { load() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/appointments`, { method: 'POST', headers, body: JSON.stringify(form) })
      const json = await res.json()
      if (json?.success) {
        setBanner({ type: 'success', msg: 'RDV demandé ! La BCEG vous contactera pour confirmer.' })
        setForm({ user_name: '', user_phone: '', appointment_date: '', appointment_time: '', topic: '' })
        load()
      } else {
        setBanner({ type: 'error', msg: json?.error || 'Erreur' })
      }
    } finally {
      setLoading(false)
      setTimeout(() => setBanner(null), 5000)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      {banner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-3 px-3 py-2 rounded-lg text-sm ${banner.type === 'success' ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-100' : 'bg-red-500/15 border border-red-400/30 text-red-100'}`}>
          {banner.msg}
        </motion.div>
      )}

      <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-amber-300" /> Demander un RDV BCEG</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Votre nom" value={form.user_name} onChange={v => setForm({ ...form, user_name: v })} required />
          <Input label="Téléphone" icon={<Phone className="w-3 h-3" />} value={form.user_phone} onChange={v => setForm({ ...form, user_phone: v })} placeholder="+241..." required />
          <Input label="Date souhaitée" type="date" min={today} value={form.appointment_date} onChange={v => setForm({ ...form, appointment_date: v })} required />
          <Input label="Heure" type="time" value={form.appointment_time} onChange={v => setForm({ ...form, appointment_time: v })} required />
        </div>
        <div>
          <label className="block text-xs text-white/70 mb-1">Sujet du RDV</label>
          <textarea
            value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })}
            rows={3}
            placeholder="Présentez brièvement votre projet et vos besoins de financement…"
            className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 resize-none"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 transition-all">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Demander le RDV
        </button>
      </form>

      {appts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-white/80 text-sm mb-2">Mes RDV</h3>
          {appts.map(a => (
            <div key={a.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-amber-300" />
              <div className="flex-1">
                <div className="font-medium text-sm">{new Date(a.appointment_date).toLocaleDateString('fr-FR')} à {String(a.appointment_time).slice(0,5)}</div>
                {a.topic && <div className="text-xs text-white/60 line-clamp-2 mt-0.5">{a.topic}</div>}
              </div>
              <AppointmentStatus status={a.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AppointmentStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    requested: { label: 'En attente', cls: 'bg-amber-500/20 border-amber-400/30 text-amber-200', icon: <Clock className="w-3 h-3" /> },
    confirmed: { label: 'Confirmé', cls: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
    completed: { label: 'Terminé', cls: 'bg-slate-500/20 border-slate-400/30 text-slate-300', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { label: 'Annulé', cls: 'bg-red-500/20 border-red-400/30 text-red-200', icon: <X className="w-3 h-3" /> },
    no_show: { label: 'Absent', cls: 'bg-red-500/20 border-red-400/30 text-red-200', icon: <AlertCircle className="w-3 h-3" /> },
  }
  const s = map[status] || map.requested
  return <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${s.cls}`}>{s.icon} {s.label}</span>
}

function Input({ label, value, onChange, type = 'text', placeholder, required, min, icon }: {
  label: string; value: string; onChange: (s: string) => void; type?: string; placeholder?: string; required?: boolean; min?: string; icon?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs text-white/70 mb-1 flex items-center gap-1">{icon} {label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
      />
    </div>
  )
}

// =====================================================================
function AlertsTab() {
  const [sectors, setSectors] = useState<string[]>([])
  const [phone, setPhone] = useState('')
  const [notifyWa, setNotifyWa] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeaders()
        const res = await fetch(`${API}/api/bceg/sector-preferences`, { headers })
        const json = await res.json()
        if (json?.success && json.preferences) {
          setSectors(json.preferences.sectors || [])
          setPhone(json.preferences.whatsapp_phone || '')
          setNotifyWa(json.preferences.notify_via_whatsapp ?? true)
        }
      } finally { setLoaded(true) }
    })()
  }, [])

  const toggle = (s: string) => setSectors(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])

  const save = async () => {
    setSaving(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/sector-preferences`, {
        method: 'PUT', headers,
        body: JSON.stringify({ sectors, whatsapp_phone: phone, notify_via_whatsapp: notifyWa }),
      })
      const json = await res.json()
      if (json?.success) setBanner({ type: 'success', msg: 'Préférences sauvegardées' })
      else setBanner({ type: 'error', msg: json?.error || 'Erreur' })
    } finally {
      setSaving(false)
      setTimeout(() => setBanner(null), 4000)
    }
  }

  if (!loaded) return <div className="text-center py-12 text-white/60"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>

  return (
    <div>
      {banner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-3 px-3 py-2 rounded-lg text-sm ${banner.type === 'success' ? 'bg-emerald-500/15 border border-emerald-400/30 text-emerald-100' : 'bg-red-500/15 border border-red-400/30 text-red-100'}`}>
          {banner.msg}
        </motion.div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
        <div>
          <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-1"><Bell className="w-4 h-4 text-amber-300" /> Alertes opportunités</h3>
          <p className="text-xs text-white/60">Reçois un message WhatsApp dès qu'un article dans tes secteurs préférés apparaît sur Gabon Insight.</p>
        </div>

        <div>
          <label className="block text-xs text-white/70 mb-2">Numéro WhatsApp (format international)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+241 77 12 34 56"
            className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyWa} onChange={e => setNotifyWa(e.target.checked)} className="accent-amber-400" />
            <span className="text-sm">Activer les notifications WhatsApp</span>
          </label>
        </div>

        <div>
          <label className="block text-xs text-white/70 mb-2">Mes secteurs d'intérêt</label>
          <div className="flex flex-wrap gap-1.5">
            {SECTOR_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  sectors.includes(s) ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-white/5 text-white/70 border-white/15 hover:border-white/30'
                }`}
              >
                {sectors.includes(s) ? '✓ ' : ''}{s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Sauvegarder mes préférences
        </button>
      </div>
    </div>
  )
}
