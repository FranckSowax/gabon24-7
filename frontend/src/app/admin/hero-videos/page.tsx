'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, Trash2, Loader2, Film, Save, Eye, EyeOff } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface HeroVideo {
  id: string
  title: string | null
  description: string | null
  cta_label: string | null
  cta_url: string | null
  video_url: string
  order_index: number
  is_active: boolean
}

export default function HeroVideosAdminPage() {
  const [videos, setVideos] = useState<HeroVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', cta_label: '', cta_url: '', order_index: '0' })
  const [file, setFile] = useState<File | null>(null)

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API_URL}/api/hero-videos`, { headers })
      const data = await res.json()
      if (data.success) setVideos(data.videos)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [authHeaders])

  useEffect(() => { load() }, [load])

  const handleUpload = async () => {
    if (!file) { alert('Choisissez un fichier vidéo (mp4)'); return }
    setUploading(true)
    try {
      const headers = await authHeaders()
      const fd = new FormData()
      fd.append('video', file)
      fd.append('title', form.title)
      fd.append('description', form.description)
      fd.append('cta_label', form.cta_label)
      fd.append('cta_url', form.cta_url)
      fd.append('order_index', form.order_index)
      const res = await fetch(`${API_URL}/api/hero-videos`, { method: 'POST', headers, body: fd })
      const data = await res.json()
      if (data.success) {
        setForm({ title: '', description: '', cta_label: '', cta_url: '', order_index: '0' })
        setFile(null)
        await load()
      } else {
        alert(data.error || 'Échec de l\'upload')
      }
    } catch {
      alert('Erreur réseau lors de l\'upload')
    } finally { setUploading(false) }
  }

  const updateVideo = async (id: string, patch: Partial<HeroVideo>) => {
    const headers = { ...(await authHeaders()), 'Content-Type': 'application/json' }
    const res = await fetch(`${API_URL}/api/hero-videos/${id}`, { method: 'PUT', headers, body: JSON.stringify(patch) })
    const data = await res.json()
    if (data.success) setVideos(prev => prev.map(v => v.id === id ? data.video : v))
    else alert(data.error || 'Échec de la mise à jour')
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('Supprimer cette vidéo ?')) return
    const headers = await authHeaders()
    const res = await fetch(`${API_URL}/api/hero-videos/${id}`, { method: 'DELETE', headers })
    const data = await res.json()
    if (data.success) setVideos(prev => prev.filter(v => v.id !== id))
    else alert(data.error || 'Échec de la suppression')
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Film className="w-6 h-6 text-[#697357]" /> Vidéos d'accueil (21:9)
        </h1>
        <p className="text-slate-500 text-sm mt-1">Section autoplay en boucle, en haut de la page d'accueil. Les vidéos sont compressées automatiquement à l'upload.</p>
      </header>

      {/* Formulaire d'ajout */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
        <h2 className="font-bold text-slate-900">Ajouter une vidéo</h2>
        <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={e => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#697357] file:text-white file:font-semibold" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Titre (colonne droite)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input value={form.cta_label} onChange={e => setForm({ ...form, cta_label: e.target.value })} placeholder="Libellé du bouton (CTA)" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input value={form.cta_url} onChange={e => setForm({ ...form, cta_url: e.target.value })} placeholder="URL de redirection" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input value={form.order_index} onChange={e => setForm({ ...form, order_index: e.target.value })} placeholder="Ordre (0,1,2…)" type="number" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        </div>
        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Texte (colonne droite)" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
        <button onClick={handleUpload} disabled={uploading || !file}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#697357] hover:bg-[#4d553e] text-white font-semibold rounded-lg disabled:opacity-50">
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Upload + compression…</> : <><Upload className="w-4 h-4" /> Ajouter</>}
        </button>
      </div>

      {/* Liste */}
      <div className="space-y-4">
        <h2 className="font-bold text-slate-900">Vidéos ({videos.length})</h2>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
        ) : videos.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucune vidéo. Ajoutez-en une ci-dessus.</p>
        ) : (
          videos.map(v => (
            <div key={v.id} className="bg-white rounded-2xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 shadow-sm">
              <video src={v.video_url} muted loop playsInline controls className="w-full aspect-[21/9] object-cover rounded-lg bg-black" />
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input defaultValue={v.title || ''} onBlur={e => updateVideo(v.id, { title: e.target.value })} placeholder="Titre" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <input defaultValue={v.cta_label || ''} onBlur={e => updateVideo(v.id, { cta_label: e.target.value })} placeholder="Libellé bouton" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <input defaultValue={v.cta_url || ''} onBlur={e => updateVideo(v.id, { cta_url: e.target.value })} placeholder="URL redirection" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <input defaultValue={v.order_index} type="number" onBlur={e => updateVideo(v.id, { order_index: parseInt(e.target.value, 10) || 0 } as any)} placeholder="Ordre" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <textarea defaultValue={v.description || ''} onBlur={e => updateVideo(v.id, { description: e.target.value })} placeholder="Texte" rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <div className="flex items-center gap-2">
                  <button onClick={() => updateVideo(v.id, { is_active: !v.is_active })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {v.is_active ? <><Eye className="w-4 h-4" /> Active</> : <><EyeOff className="w-4 h-4" /> Masquée</>}
                  </button>
                  <span className="text-xs text-slate-400">Les champs se sauvegardent à la sortie du champ.</span>
                  <button onClick={() => deleteVideo(v.id)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100">
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
