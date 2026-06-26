'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Building2, Upload, FileText, CheckCircle2, Clock, AlertCircle, X,
  Calendar, Phone, Send, Trash2, Loader2, Bell, MessageCircle, Sparkles
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Thème BCEG
const BCEG_GREEN = '#697357'
const BCEG_DARK = '#4d553e'

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
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f1f4ee]" />}>
      <BcegPrepareContent />
    </Suspense>
  )
}

function BcegPrepareContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const initialTab = (searchParams?.get('tab') as 'docs' | 'rdv' | 'alerts') || 'docs'
  const [tab, setTab] = useState<'docs' | 'rdv' | 'alerts'>(['docs', 'rdv', 'alerts'].includes(initialTab) ? initialTab : 'docs')
  const projectId = searchParams?.get('projectId') || ''

  // Retour vers la page d'où l'on vient (financement du projet), sans sortir du projet.
  const handleBack = () => {
    const from = searchParams?.get('from')
    if (from) { router.push(decodeURIComponent(from)); return }
    if (typeof window !== 'undefined' && window.history.length > 1) { router.back(); return }
    router.push('/business/mes-projets')
  }

  return (
    <div className="min-h-screen bg-[#f1f4ee] text-slate-900">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-5 sm:py-7">

            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm text-[#697357] hover:text-[#4d553e] font-medium mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Retour au dossier
            </button>

            {/* Header BCEG */}
            <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 mb-6 text-white" style={{ background: `linear-gradient(135deg, ${BCEG_GREEN} 0%, ${BCEG_DARK} 100%)` }}>
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 ring-1 ring-white/20 text-amber-100 text-xs mb-2">
                  <Building2 className="w-3 h-3" /> Préparation du dossier BCEG
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-1">Renforcez votre dossier de financement</h1>
                <p className="text-sm text-white/85">Chargez les pièces requises, prenez RDV avec un conseiller Gabon Insight, et activez les alertes sectorielles.</p>
              </div>
            </div>

            <div className="flex gap-2 mb-5 p-1 bg-white rounded-xl border border-slate-200">
              <TabBtn active={tab === 'docs'} onClick={() => setTab('docs')} icon={<FileText className="w-4 h-4" />} label="Documents" />
              <TabBtn active={tab === 'rdv'} onClick={() => setTab('rdv')} icon={<Calendar className="w-4 h-4" />} label="RDV conseiller" />
              <TabBtn active={tab === 'alerts'} onClick={() => setTab('alerts')} icon={<Bell className="w-4 h-4" />} label="Alertes secteurs" />
            </div>

            {tab === 'docs' && <DocsTab projectId={projectId} />}
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
        active ? 'bg-gradient-to-br from-[#697357] to-[#4d553e] text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// =====================================================================
function DocsTab({ projectId }: { projectId?: string }) {
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/due-diligence/mine${projectId ? `?project_id=${projectId}` : ''}`, { headers })
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
      if (!signJson?.success || !signJson.path || !signJson.token) throw new Error(signJson?.error || 'Erreur signature')

      // Upload via le client Supabase (méthode supportée pour les URLs signées)
      const { supabase } = await import('@/lib/auth')
      const up = await supabase.storage
        .from('due-diligence')
        .uploadToSignedUrl(signJson.path, signJson.token, file, { contentType: file.type || 'application/octet-stream' })
      if (up.error) throw new Error(up.error.message || 'Upload échoué')

      const saveRes = await fetch(`${API}/api/bceg/due-diligence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          doc_type: docType,
          file_url: signJson.path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          project_id: projectId || undefined,
        }),
      })
      const saveJson = await saveRes.json()
      if (!saveJson?.success) throw new Error(saveJson?.error || 'Erreur enregistrement')

      setBanner({ type: 'success', msg: `✅ ${file.name} ajouté au dossier` })
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

  if (loading) return <div className="text-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>

  return (
    <div>
      {banner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-3 px-3 py-2 rounded-lg text-sm border ${banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {banner.msg}
        </motion.div>
      )}

      <p className="text-xs text-slate-500 mb-4">JPG, PNG, WebP ou PDF, max 10 MB par fichier. Vos documents sont chiffrés et accessibles uniquement par vous et l'équipe BCEG (après validation).</p>

      <div className="space-y-2">
        {DOC_TYPES.map(dt => {
          const userDoc = docs.find(d => d.doc_type === dt.value)
          return (
            <div key={dt.value} className={`bg-white rounded-xl p-3 flex items-center gap-3 border ${userDoc ? 'border-emerald-200' : 'border-slate-200'}`}>
              <div className="text-2xl">{dt.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-800">{dt.label}</span>
                  {dt.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Requis</span>}
                </div>
                {userDoc && (
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    📎 {userDoc.file_name} • <StatusBadge status={userDoc.verification_status} />
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                {!userDoc ? (
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#697357]/10 hover:bg-[#697357]/20 border border-[#697357]/30 text-[#4d553e] text-xs font-medium">
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
                  <button onClick={() => handleDelete(userDoc.id)} className="p-2 rounded-lg text-rose-500 hover:bg-rose-50">
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
    pending: { label: 'Joint au dossier', cls: 'text-emerald-700' },
    approved: { label: '✓ Validé BCEG', cls: 'text-emerald-700' },
    verified: { label: '✓ Vérifié', cls: 'text-emerald-700' },
    rejected: { label: '✗ À corriger', cls: 'text-rose-600' },
    needs_resubmit: { label: 'À renvoyer', cls: 'text-orange-600' },
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
        setBanner({ type: 'success', msg: 'Demande envoyée ! Un conseiller Gabon Insight vous contactera pour confirmer.' })
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-3 px-3 py-2 rounded-lg text-sm border ${banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {banner.msg}
        </motion.div>
      )}

      {/* Conseiller IA */}
      <div className="mb-5 rounded-2xl p-4 bg-white border border-[#697357]/20 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#697357]/10 text-[#697357] flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5" />
        </div>
        <div className="flex-1 text-sm">
          <div className="font-bold text-slate-900 flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" /> Besoin d'aide pour votre demande ?</div>
          <p className="text-slate-600 mt-0.5">
            Le <strong>Conseiller IA Gabon Insight</strong> répond à vos questions sur le financement et vous aide à préparer votre RDV.
            Ouvrez l'assistant depuis votre projet (Outils IA → Conseiller IA), puis remplissez le formulaire ci-dessous pour réserver.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 space-y-3">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-[#697357]" /> Prendre RDV avec un conseiller Gabon Insight</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Votre nom" value={form.user_name} onChange={v => setForm({ ...form, user_name: v })} required />
          <Input label="Téléphone" icon={<Phone className="w-3 h-3" />} value={form.user_phone} onChange={v => setForm({ ...form, user_phone: v })} placeholder="+241..." required />
          <Input label="Date souhaitée" type="date" min={today} value={form.appointment_date} onChange={v => setForm({ ...form, appointment_date: v })} required />
          <Input label="Heure" type="time" value={form.appointment_time} onChange={v => setForm({ ...form, appointment_time: v })} required />
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">Sujet du RDV</label>
          <textarea
            value={form.topic}
            onChange={e => setForm({ ...form, topic: e.target.value })}
            rows={3}
            placeholder="Présentez brièvement votre projet et vos besoins de financement…"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#697357] resize-none"
          />
        </div>
        <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] disabled:opacity-50 transition-all">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Demander le RDV
        </button>
      </form>

      {appts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-slate-700 text-sm mb-2">Mes RDV</h3>
          {appts.map(a => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <Calendar className="w-5 h-5 text-[#697357]" />
              <div className="flex-1">
                <div className="font-medium text-sm text-slate-800">{new Date(a.appointment_date).toLocaleDateString('fr-FR')} à {String(a.appointment_time).slice(0, 5)}</div>
                {a.topic && <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{a.topic}</div>}
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
    requested: { label: 'En attente', cls: 'bg-amber-50 border-amber-200 text-amber-700', icon: <Clock className="w-3 h-3" /> },
    confirmed: { label: 'Confirmé', cls: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    completed: { label: 'Terminé', cls: 'bg-slate-100 border-slate-200 text-slate-600', icon: <CheckCircle2 className="w-3 h-3" /> },
    cancelled: { label: 'Annulé', cls: 'bg-rose-50 border-rose-200 text-rose-700', icon: <X className="w-3 h-3" /> },
    no_show: { label: 'Absent', cls: 'bg-rose-50 border-rose-200 text-rose-700', icon: <AlertCircle className="w-3 h-3" /> },
  }
  const s = map[status] || map.requested
  return <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${s.cls}`}>{s.icon} {s.label}</span>
}

function Input({ label, value, onChange, type = 'text', placeholder, required, min, icon }: {
  label: string; value: string; onChange: (s: string) => void; type?: string; placeholder?: string; required?: boolean; min?: string; icon?: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1 flex items-center gap-1">{icon} {label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        min={min}
        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#697357]"
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

  if (!loaded) return <div className="text-center py-12 text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Chargement…</div>

  return (
    <div>
      {banner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`mb-3 px-3 py-2 rounded-lg text-sm border ${banner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {banner.msg}
        </motion.div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5">
        <div>
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1"><Bell className="w-4 h-4 text-[#697357]" /> Alertes opportunités</h3>
          <p className="text-xs text-slate-500">Recevez un message WhatsApp dès qu'un article dans vos secteurs préférés apparaît sur Gabon Insight.</p>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-2">Numéro WhatsApp (format international)</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+241 77 12 34 56"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#697357]"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={notifyWa} onChange={e => setNotifyWa(e.target.checked)} className="accent-[#697357]" />
            <span className="text-sm text-slate-700">Activer les notifications WhatsApp</span>
          </label>
        </div>

        <div>
          <label className="block text-xs text-slate-600 mb-2">Mes secteurs d'intérêt</label>
          <div className="flex flex-wrap gap-1.5">
            {SECTOR_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  sectors.includes(s) ? 'bg-[#697357] text-white border-[#697357]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#697357]/40'
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
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Sauvegarder mes préférences
        </button>
      </div>
    </div>
  )
}
