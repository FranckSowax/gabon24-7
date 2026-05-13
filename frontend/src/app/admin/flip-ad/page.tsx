'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Save, Upload, Eye, Loader2, AlertCircle, CheckCircle2, X, RotateCcw,
  Image as ImageIcon, Sparkles
} from 'lucide-react'

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

interface FlipAdConfigDB {
  id?: string
  enabled: boolean
  duration_ms: number
  redirect_url?: string | null
  redirect_mode: 'none' | 'after_flip' | 'on_back_click'
  image_url?: string | null
  title?: string | null
  subtitle?: string | null
  cta_label?: string | null
  background_css?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

const PRESETS = [
  { label: 'Vert BCEG', css: 'linear-gradient(135deg, #697357 0%, #4d553e 50%, #3a4030 100%)' },
  { label: 'Orange', css: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)' },
  { label: 'Bleu nuit', css: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { label: 'Or beige', css: 'linear-gradient(135deg, #d6c9a9 0%, #8a9576 100%)' },
]

export default function AdminFlipAdPage() {
  const [config, setConfig] = useState<FlipAdConfigDB>({
    enabled: true,
    duration_ms: 4000,
    redirect_mode: 'after_flip',
    title: '',
    subtitle: '',
    cta_label: 'Découvrir →',
    background_css: PRESETS[0].css,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewFlipped, setPreviewFlipped] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${API}/api/flip-ad`)
        const json = await res.json()
        if (json?.success && json.config) {
          setConfig(json.config)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/flip-ad`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Erreur enregistrement')
      setConfig(json.config)
      setSuccess('Configuration enregistrée avec succès.')
      setTimeout(() => setSuccess(null), 4000)
    } catch (e: any) {
      setError(e?.message || 'Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectFile = () => fileRef.current?.click()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Fichier > 2 Mo')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const signRes = await fetch(`${API}/api/flip-ad/sign-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ file_name: file.name }),
      })
      const signJson = await signRes.json()
      if (!signJson?.success) throw new Error(signJson?.error || 'Sign URL impossible')

      const putRes = await fetch(signJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload échoué (${putRes.status})`)

      setConfig(prev => ({ ...prev, image_url: signJson.publicUrl }))
      setSuccess("Image téléversée. N'oubliez pas d'enregistrer.")
      setTimeout(() => setSuccess(null), 4000)
    } catch (e: any) {
      setError(e?.message || 'Erreur upload')
    } finally {
      setUploading(false)
    }
  }

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-semibold text-slate-800 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-2">{hint}</p>}
      {children}
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#697357]" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Flip Ad — Configuration</h1>
          <p className="text-sm text-slate-600 mt-1">
            Animation 3D au clic sur les boutons Business de la sidebar. La face arrière publicitaire est affichée pendant la durée configurée.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPreviewFlipped(true); setPreviewOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm"
          >
            <Eye className="w-4 h-4" /> Aperçu live
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-bold text-sm shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-5">

          <Field label="Activer l'animation">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-5 h-5 accent-[#697357]"
              />
              <span className="text-sm text-slate-700">
                {config.enabled ? '✅ Animation active' : '❌ Désactivée — les boutons Business naviguent directement'}
              </span>
            </label>
          </Field>

          <Field label="Image (max 2 Mo, PNG/JPG/WebP/SVG)" hint="Affichée en haut de la face arrière">
            <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={handleUpload} className="hidden" />
            <div className="flex items-center gap-3">
              {config.image_url ? (
                <img src={config.image_url} alt="" className="w-16 h-16 rounded-xl object-cover ring-2 ring-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleSelectFile}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-xs font-bold disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {config.image_url ? 'Remplacer' : 'Téléverser'}
                </button>
                {config.image_url && (
                  <button
                    onClick={() => setConfig({ ...config, image_url: null })}
                    className="text-xs text-rose-600 hover:text-rose-800"
                  >
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Titre" hint="60 caractères max">
              <input
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value.slice(0, 60) })}
                placeholder="BCEG · Crédits dès 5 %"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
              />
              <div className="text-[10px] text-slate-400 mt-1 text-right">{(config.title || '').length}/60</div>
            </Field>
            <Field label="Label du CTA" hint="40 caractères max">
              <input
                value={config.cta_label || ''}
                onChange={(e) => setConfig({ ...config, cta_label: e.target.value.slice(0, 40) })}
                placeholder="Découvrir →"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
              />
            </Field>
          </div>

          <Field label="Sous-titre" hint="160 caractères max">
            <textarea
              value={config.subtitle || ''}
              onChange={(e) => setConfig({ ...config, subtitle: e.target.value.slice(0, 160) })}
              rows={2}
              placeholder="Programme CATR / FAMAD — Préparez votre dossier en quelques clics…"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
            />
            <div className="text-[10px] text-slate-400 mt-1 text-right">{(config.subtitle || '').length}/160</div>
          </Field>

          <Field label="URL de redirection" hint="HTTPS uniquement ou chemin interne commençant par /">
            <input
              value={config.redirect_url || ''}
              onChange={(e) => setConfig({ ...config, redirect_url: e.target.value })}
              placeholder="/business/live-opportunities ou https://…"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
            />
          </Field>

          <Field label="Mode de redirection">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { value: 'none', label: 'Aucune', desc: "Juste l'animation" },
                { value: 'after_flip', label: 'Après le flip', desc: 'Auto à la fin' },
                { value: 'on_back_click', label: 'Au clic face arrière', desc: "Si l'user clique" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig({ ...config, redirect_mode: opt.value as any })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    config.redirect_mode === opt.value
                      ? 'bg-[#697357]/10 border-[#697357] ring-1 ring-[#697357]/30'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className={`text-sm font-bold ${config.redirect_mode === opt.value ? 'text-[#697357]' : 'text-slate-800'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          <Field label={`Durée d'affichage : ${(config.duration_ms / 1000).toFixed(1)} s`}>
            <input
              type="range"
              min={1000}
              max={10000}
              step={500}
              value={config.duration_ms}
              onChange={(e) => setConfig({ ...config, duration_ms: parseInt(e.target.value) })}
              className="w-full accent-[#697357]"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>1 s</span><span>5 s</span><span>10 s</span>
            </div>
          </Field>

          <Field label="Gradient de fond" hint="Choisissez un preset ou collez votre CSS">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setConfig({ ...config, background_css: p.css })}
                  className="h-12 rounded-lg ring-2 ring-white border border-slate-200 hover:scale-105 transition-transform text-[10px] font-bold text-white shadow-sm"
                  style={{ background: p.css }}
                  title={p.label}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              value={config.background_css || ''}
              onChange={(e) => setConfig({ ...config, background_css: e.target.value })}
              placeholder="linear-gradient(135deg, …)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:border-[#697357]"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Début diffusion (optionnel)">
              <input
                type="datetime-local"
                value={config.starts_at ? config.starts_at.slice(0, 16) : ''}
                onChange={(e) => setConfig({ ...config, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
              />
            </Field>
            <Field label="Fin diffusion (optionnel)">
              <input
                type="datetime-local"
                value={config.ends_at ? config.ends_at.slice(0, 16) : ''}
                onChange={(e) => setConfig({ ...config, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#697357]"
              />
            </Field>
          </div>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 lg:sticky lg:top-4 h-fit">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#697357]" />
            Aperçu de la pub
          </h3>
          <PreviewCard config={config} />
          <button
            onClick={() => { setPreviewFlipped(true); setPreviewOpen(true); }}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Tester l'animation
          </button>
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreviewOpen(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full"
              style={{ perspective: '1200px' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white">Aperçu animation</h3>
                <button onClick={() => setPreviewOpen(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div
                className="relative w-full"
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: previewFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  minHeight: '220px',
                }}
              >
                <div
                  className="w-full rounded-2xl p-4"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    background: 'linear-gradient(135deg, #f97316, #c2410c)',
                  }}
                >
                  <div className="text-white text-sm font-bold mb-2">Carte profil (fictive)</div>
                  <div className="text-white/80 text-xs">Franck Sowax · Professionnel</div>
                </div>
                <div
                  className="w-full absolute inset-0"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <PreviewCard config={config} />
                </div>
              </div>
              <button
                onClick={() => setPreviewFlipped(f => !f)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-bold"
              >
                <RotateCcw className="w-4 h-4" /> Re-jouer le flip
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PreviewCard({ config }: { config: FlipAdConfigDB }) {
  const bg = config.background_css || 'linear-gradient(135deg, #697357 0%, #4d553e 100%)'
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl p-4 shadow-lg text-white min-h-[200px]"
      style={{ background: bg }}
    >
      <div className="flex items-start gap-3 mb-3">
        {config.image_url ? (
          <img src={config.image_url} alt="" className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/40 shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur ring-2 ring-white/30 flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-white/70" />
          </div>
        )}
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30 self-center">
          Sponsorisé
        </span>
      </div>
      <h3 className="text-white font-bold text-base leading-tight mb-1">{config.title || '(Titre)'}</h3>
      <p className="text-white/85 text-xs leading-relaxed mb-3 line-clamp-3">{config.subtitle || '(Sous-titre)'}</p>
      <div className="flex items-center justify-between pt-2 border-t border-white/15">
        <span className="text-[10px] uppercase tracking-wider opacity-75">BCEG × Gabon Insight</span>
        <span className="text-xs font-bold">{config.cta_label || 'Découvrir →'}</span>
      </div>
    </div>
  )
}
