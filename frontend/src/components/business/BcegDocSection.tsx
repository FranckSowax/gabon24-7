'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, CheckCircle2, AlertCircle, Trash2, Loader2,
  ShieldCheck, Eye, Clock, Building2, Sparkles, Zap, ArrowRight,
  FolderOpen, X, BookOpen
} from 'lucide-react'
import { buildDocumentHtml } from '@/utils/documentExport'

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

export interface DocTypeDef {
  key: string
  label: string
  bcegPurpose: string
  rules: string[]
  acceptedFormats: string[]
  maxSizeMb: number
  required: boolean
}

interface UploadedDoc {
  id: string
  doc_type: string
  file_url: string
  file_name: string
  file_size?: number
  mime_type?: string
  verification_status?: string
  created_at: string
}

interface ProjectDoc {
  id: string
  document_type?: string
  title?: string
  content?: string
  created_at?: string
  metadata?: { section_number?: number; phase_number?: number; section_title?: string; [k: string]: any }
}

interface AiGenerateOption {
  /** Libellé du CTA (ex: "Démarrer le Business Plan") */
  label: string
  /** Coût en crédits (token) */
  credits: number
  /** Description courte du workflow */
  description: string
  /** Si le document est en cours de génération (progression % 0-100) */
  progressPct?: number
  /** Si le doc IA est finalisé/validé */
  completed?: boolean
  /** Callback : démarrer ou reprendre la génération */
  onStart: () => void
  /** Callback : si en cours, ouvrir pour modifier/continuer */
  onResume?: () => void
}

interface BcegDocSectionProps {
  projectId: string
  docType: DocTypeDef
  documents?: UploadedDoc[]
  /** Si fourni : affiche aussi l'option "Créer avec l'IA" (pour business_plan et plan_action) */
  aiOption?: AiGenerateOption
  onChange?: () => void
}

const MAX_BYTES = (mb: number) => mb * 1024 * 1024

export default function BcegDocSection({
  projectId,
  docType,
  documents = [],
  aiOption,
  onChange,
}: BcegDocSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [localDocs, setLocalDocs] = useState<UploadedDoc[]>(documents)

  // Import depuis "Mes documents" (business plan / plan d'action générés par l'IA).
  // L'option n'est affichée que lorsque aiOption est fourni (business_plan / plan_action).
  const [importOpen, setImportOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importDocs, setImportDocs] = useState<ProjectDoc[]>([])

  useEffect(() => {
    setLocalDocs(documents)
  }, [documents])

  const docsForType = localDocs.filter(d => d.doc_type === docType.key)
  const hasUploaded = docsForType.length > 0

  // Récupère les documents du projet correspondant à ce type BCEG (business plan / plan d'action)
  const matchesDocType = (t: string): boolean => {
    const n = (t || '').toLowerCase()
    if (docType.key === 'business_plan') return /business[-_]plan/.test(n)
    if (docType.key === 'plan_action') return /action[-_]plan/.test(n)
    return false
  }

  const openImport = async () => {
    setError(null)
    setImportOpen(true)
    setImportLoading(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/project-documents/project/${projectId}`, { headers })
      const json = await res.json()
      const all: ProjectDoc[] = (json?.documents || json?.data || (Array.isArray(json) ? json : []))
      setImportDocs(all.filter(d => matchesDocType(d.document_type || (d as any).type || '')))
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger vos documents')
      setImportDocs([])
    } finally {
      setImportLoading(false)
    }
  }

  // Construit le contenu Markdown combiné des sections (triées) ou d'un seul document
  const buildContent = (docs: ProjectDoc[]): string => {
    const ordered = [...docs].sort((a, b) => {
      const na = a.metadata?.section_number ?? a.metadata?.phase_number ?? 9999
      const nb = b.metadata?.section_number ?? b.metadata?.phase_number ?? 9999
      return na - nb
    })
    return ordered
      .map(d => `## ${d.title || d.metadata?.section_title || 'Section'}\n\n${d.content || ''}`)
      .join('\n\n---\n\n')
  }

  // Téléverse un contenu (Markdown) comme fichier .doc via le pipeline due-diligence existant
  const uploadAsDoc = async (fileBase: string, title: string, content: string) => {
    const headers = await authHeaders()
    const html = buildDocumentHtml(title, content)
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const fileName = `${(fileBase || 'document').replace(/[^a-z0-9]/gi, '_')}.doc`

    const signRes = await fetch(`${API}/api/bceg/due-diligence/sign-upload`, {
      method: 'POST', headers,
      body: JSON.stringify({ doc_type: docType.key, file_name: fileName }),
    })
    const signJson = await signRes.json()
    if (!signJson?.success || !signJson.signedUrl) throw new Error(signJson?.error || 'Signature URL impossible')

    const putRes = await fetch(signJson.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/msword' },
      body: blob,
    })
    if (!putRes.ok) throw new Error(`Upload échoué (${putRes.status})`)

    const metaRes = await fetch(`${API}/api/bceg/due-diligence`, {
      method: 'POST', headers,
      body: JSON.stringify({
        project_id: projectId,
        doc_type: docType.key,
        file_url: signJson.path,
        file_name: fileName,
        file_size: blob.size,
        mime_type: 'application/msword',
      }),
    })
    const metaJson = await metaRes.json()
    if (!metaJson?.success) throw new Error(metaJson?.error || 'Erreur enregistrement métadonnées')
    return metaJson.document as UploadedDoc
  }

  // Importe l'ensemble (business plan complet = toutes les sections) ou un document précis
  const handleImport = async (selection: { id: string; title: string; docs: ProjectDoc[] }) => {
    setImportingId(selection.id)
    setError(null)
    try {
      const content = buildContent(selection.docs)
      if (!content.trim()) throw new Error('Document vide')
      const created = await uploadAsDoc(selection.title, selection.title, content)
      setLocalDocs(prev => [created, ...prev])
      setImportOpen(false)
      onChange?.()
    } catch (e: any) {
      setError(e?.message || "Erreur lors de l'import")
    } finally {
      setImportingId(null)
    }
  }

  const acceptString = docType.acceptedFormats
    .map(f => '.' + f.toLowerCase())
    .join(',')

  const handleSelectFile = () => fileRef.current?.click()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)

    if (file.size > MAX_BYTES(docType.maxSizeMb)) {
      setError(`Le fichier dépasse ${docType.maxSizeMb} Mo`)
      return
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!docType.acceptedFormats.map(f => f.toLowerCase()).includes(ext)) {
      setError(`Format non supporté. Acceptés : ${docType.acceptedFormats.join(', ')}`)
      return
    }

    setUploading(true)
    setProgress(10)
    try {
      const headers = await authHeaders()

      const signRes = await fetch(`${API}/api/bceg/due-diligence/sign-upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ doc_type: docType.key, file_name: file.name }),
      })
      const signJson = await signRes.json()
      if (!signJson?.success || !signJson.signedUrl) {
        throw new Error(signJson?.error || 'Signature URL impossible')
      }
      setProgress(35)

      const putRes = await fetch(signJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload échoué (${putRes.status})`)
      setProgress(75)

      const publicUrl = signJson.path
      const metaRes = await fetch(`${API}/api/bceg/due-diligence`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project_id: projectId,
          doc_type: docType.key,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        }),
      })
      const metaJson = await metaRes.json()
      if (!metaJson?.success) throw new Error(metaJson?.error || 'Erreur enregistrement métadonnées')

      setLocalDocs(prev => [metaJson.document, ...prev])
      setProgress(100)
      onChange?.()
      setTimeout(() => setProgress(0), 700)
    } catch (e: any) {
      setError(e?.message || 'Erreur upload')
      setProgress(0)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Supprimer ce document ?')) return
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/due-diligence/${docId}`, {
        method: 'DELETE',
        headers,
      })
      const json = await res.json()
      if (json?.success) {
        setLocalDocs(prev => prev.filter(d => d.id !== docId))
        onChange?.()
      }
    } catch {}
  }

  return (
    <div className="space-y-5">

      <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-6 ${
        hasUploaded
          ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200'
          : 'bg-gradient-to-br from-[#697357] to-[#4d553e] text-white shadow-lg shadow-[#697357]/20'
      }`}>
        {!hasUploaded && (
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl" />
        )}
        <div className="relative flex items-start gap-4">
          <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${
            hasUploaded ? 'bg-emerald-500/20 text-emerald-700' : 'bg-white/15 backdrop-blur text-amber-200 ring-1 ring-white/20'
          }`}>
            {hasUploaded ? <CheckCircle2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`text-[10px] uppercase tracking-wider font-bold mb-1 ${hasUploaded ? 'text-emerald-700' : 'opacity-80'}`}>
              {docType.required ? 'Pièce obligatoire' : 'Pièce complémentaire'}
            </div>
            <h2 className={`text-xl sm:text-2xl font-bold leading-tight ${hasUploaded ? 'text-emerald-900' : ''}`}>
              {docType.label}
            </h2>
            <p className={`text-sm mt-2 leading-relaxed ${hasUploaded ? 'text-emerald-800' : 'opacity-90'}`}>
              <Building2 className="inline w-3.5 h-3.5 mr-1.5 align-text-bottom" />
              {docType.bcegPurpose}
            </p>
          </div>
        </div>
      </div>

      {/* Si IA-générable : 2 options (Télécharger / Créer avec IA) */}
      {aiOption && !hasUploaded && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3 px-1">
            Comment souhaitez-vous fournir ce document ?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Option A — Créer avec IA */}
            <button
              onClick={aiOption.completed ? aiOption.onResume || aiOption.onStart : aiOption.onStart}
              className="group relative overflow-hidden text-left rounded-2xl p-5 bg-gradient-to-br from-[#697357] to-[#4d553e] text-white shadow-lg shadow-[#697357]/30 hover:shadow-xl transition-all"
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-200" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30">
                    ★ Recommandé
                  </span>
                </div>
                <h4 className="text-base font-bold mb-1">Créer avec l'IA</h4>
                <p className="text-xs opacity-90 mb-3 leading-relaxed">
                  {aiOption.description}
                </p>

                {typeof aiOption.progressPct === 'number' && aiOption.progressPct > 0 && !aiOption.completed && (
                  <div className="mb-3 pb-3 border-b border-white/15">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="opacity-80">Avancement du document</span>
                      <span className="font-bold">{Math.round(aiOption.progressPct)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/15 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-300 to-amber-200"
                        style={{ width: `${Math.min(100, aiOption.progressPct)}%` }}
                      />
                    </div>
                    <div className="text-[10px] opacity-75 mt-1">
                      Vous pouvez arrêter et reprendre à tout moment.
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-white/15">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Zap className="w-3.5 h-3.5 text-amber-200" />
                    <span className="font-bold">{aiOption.credits} crédits</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold">
                    {aiOption.completed
                      ? 'Modifier le document'
                      : aiOption.progressPct
                        ? 'Reprendre'
                        : aiOption.label}
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </button>

            {/* Option B — Importer depuis Mes documents */}
            <button
              onClick={openImport}
              className="group relative overflow-hidden text-left rounded-2xl p-5 bg-white border border-amber-300/60 hover:border-amber-400 shadow-md hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  Déjà généré
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">Importer depuis Mes documents</h4>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Récupérez le {docType.key === 'business_plan' ? 'business plan' : "plan d'action"} déjà créé dans votre projet et joignez-le au dossier en un clic.
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-500">Gratuit — 0 crédit</div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                  Choisir un document
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>

            {/* Option C — Télécharger */}
            <button
              onClick={handleSelectFile}
              className="group relative overflow-hidden text-left rounded-2xl p-5 bg-white border border-slate-200 hover:border-[#697357]/40 shadow-md hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#697357]/10 text-[#697357] ring-1 ring-[#697357]/20 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Si déjà rédigé
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1">Téléverser un fichier existant</h4>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Vous avez déjà rédigé ce document ? Téléversez-le directement ({docType.acceptedFormats.join(', ')}).
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="text-[11px] text-slate-500">
                  Gratuit — 0 crédit
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#697357]">
                  Choisir un fichier
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <h3 className="font-bold text-[#697357] text-sm flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4" />
          Règles à respecter
        </h3>
        <ul className="space-y-1.5 text-sm text-slate-700">
          {docType.rules.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#697357]" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span><strong className="text-slate-700">Formats :</strong> {docType.acceptedFormats.join(', ')}</span>
          <span><strong className="text-slate-700">Taille max :</strong> {docType.maxSizeMb} Mo</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white border-2 border-dashed border-slate-300 hover:border-[#697357]/60 transition-colors p-6 text-center">
        <input
          ref={fileRef}
          type="file"
          accept={acceptString}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#697357]/10 text-[#697357] flex items-center justify-center">
          <Upload className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-900 mb-1">Téléverser un fichier</p>
        <p className="text-xs text-slate-500 mb-4">Glissez-déposez ou cliquez pour choisir un fichier</p>
        <button
          onClick={handleSelectFile}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-bold text-sm shadow-md shadow-[#697357]/30 transition-all disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Téléversement…' : 'Choisir un fichier'}
        </button>

        {progress > 0 && (
          <div className="mt-4 max-w-sm mx-auto">
            <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-[#8a9576] to-[#697357]"
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1">{progress}%</div>
          </div>
        )}

        {error && (
          <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 inline-flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </div>
        )}
      </div>

      <AnimatePresence>
        {docsForType.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white border border-slate-200"
          >
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-[#697357] text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Fichiers téléversés ({docsForType.length})
              </h3>
            </div>
            <ul className="divide-y divide-slate-100">
              {docsForType.map(doc => (
                <li key={doc.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-[#697357]/10 text-[#697357] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{doc.file_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                        {doc.file_size && <span>{(doc.file_size / 1024).toFixed(0)} Ko</span>}
                        {doc.verification_status === 'pending' && (
                          <span className="flex items-center gap-1 text-amber-700">
                            <Clock className="w-3 h-3" /> En attente de vérification
                          </span>
                        )}
                        {doc.verification_status === 'approved' && (
                          <span className="flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" /> Validé par BCEG
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#697357]"
                        title="Voir"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 rounded-lg hover:bg-rose-50 text-rose-500 hover:text-rose-700"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 leading-relaxed">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#697357]" />
          <div>
            <p className="font-bold text-slate-800 mb-1">
              Protection des données personnelles — Conformité ADPVPD Gabon
            </p>
            <p>
              Vos documents sont stockés de manière sécurisée et chiffrée chez notre prestataire
              Supabase, conformément à la <strong>Loi n°001/2011</strong> du 25 septembre 2011 relative
              à la protection des données à caractère personnel en République Gabonaise, sous la
              supervision de l'<strong>ADPVPD</strong> (Autorité de Protection des Données à caractère
              Personnel). Vos pièces ne sont partagées avec la BCEG qu'après votre <strong>validation
              explicite</strong> via le bouton « Soumettre à la BCEG ». Vous pouvez les supprimer à
              tout moment.
            </p>
          </div>
        </div>
      </div>

      {/* Modale : importer un document généré (regroupe les sections numérotées) */}
      <AnimatePresence>
        {importOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => !importingId && setImportOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900">
                    Importer {docType.key === 'business_plan' ? 'le business plan' : "le plan d'action"}
                  </h3>
                </div>
                <button
                  onClick={() => !importingId && setImportOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-3">
                {importLoading ? (
                  <div className="py-10 flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Chargement de vos documents…</span>
                  </div>
                ) : importDocs.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      Aucun {docType.key === 'business_plan' ? 'business plan' : "plan d'action"} trouvé
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Créez-le d'abord avec l'IA, puis revenez l'importer ici.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Option principale : document complet (toutes les sections regroupées) */}
                    <button
                      disabled={!!importingId}
                      onClick={() => handleImport({
                        id: '__all__',
                        title: docType.key === 'business_plan' ? 'Business Plan' : "Plan d'action",
                        docs: importDocs,
                      })}
                      className="w-full text-left rounded-xl p-4 bg-gradient-to-br from-[#697357] to-[#4d553e] text-white shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/15 ring-1 ring-white/20 flex items-center justify-center shrink-0">
                          {importingId === '__all__' ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5 text-amber-200" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm">
                            {docType.key === 'business_plan' ? 'Business Plan complet' : "Plan d'action complet"}
                          </div>
                          <div className="text-xs opacity-90">
                            Regroupe les {importDocs.length} partie(s) en un seul document imprimable (.doc)
                          </div>
                        </div>
                      </div>
                    </button>

                    {importDocs.length > 1 && (
                      <div className="text-[11px] uppercase tracking-wide font-bold text-slate-400 pt-1 px-1">
                        Ou importer une partie précise
                      </div>
                    )}

                    {importDocs.length > 1 && [...importDocs]
                      .sort((a, b) => {
                        const na = a.metadata?.section_number ?? a.metadata?.phase_number ?? 9999
                        const nb = b.metadata?.section_number ?? b.metadata?.phase_number ?? 9999
                        return na - nb
                      })
                      .map((d) => (
                        <button
                          key={d.id}
                          disabled={!!importingId}
                          onClick={() => handleImport({ id: d.id, title: d.title || 'Document', docs: [d] })}
                          className="w-full text-left rounded-xl p-3 bg-white border border-slate-200 hover:border-[#697357]/40 transition-all disabled:opacity-60 flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#697357]/10 text-[#697357] flex items-center justify-center shrink-0">
                            {importingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 truncate">
                              {d.metadata?.section_number ? `${d.metadata.section_number}. ` : ''}{d.title || d.metadata?.section_title || 'Document'}
                            </div>
                          </div>
                        </button>
                      ))}
                  </>
                )}

                {error && (
                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {error}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
