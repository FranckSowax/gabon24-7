'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, Send, Loader2, FileText, CheckCircle2, AlertCircle,
  Building2, Sparkles, RefreshCw
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import BcegScoreBadge from '@/components/bceg/BcegScoreBadge'
import BcegMentorChat from '@/components/bceg/BcegMentorChat'

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

interface ScoreInfo {
  score: number
  color: 'red' | 'orange' | 'green'
  breakdown?: any
}

export default function DossierBcegPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = String(params?.id || '')

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [score, setScore] = useState<ScoreInfo | null>(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(true)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [submission, setSubmission] = useState<any>(null)
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; msg: string } | null>(null)

  const showBanner = (type: 'success' | 'error' | 'info', msg: string) => {
    setBanner({ type, msg })
    if (type !== 'error') setTimeout(() => setBanner(null), 6000)
  }

  useEffect(() => {
    if (!projectId) return
    let alive = true
    let blobUrlToClean: string | null = null

    const load = async () => {
      try {
        setLoadingPdf(true)
        setPdfError(null)
        const headers = await authHeaders()

        const pdfRes = await fetch(`${API}/api/bceg/generate-dossier`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ project_id: projectId }),
        })

        if (!alive) return

        if (!pdfRes.ok) {
          const err = await pdfRes.json().catch(() => ({}))
          setPdfError(err?.error || `Erreur ${pdfRes.status}`)
          setLoadingPdf(false)
          return
        }

        const blob = await pdfRes.blob()
        const url = URL.createObjectURL(blob)
        blobUrlToClean = url
        if (alive) setPdfBlobUrl(url)

        const scoreRes = await fetch(`${API}/api/bceg/my-score?project_id=${projectId}`, { headers })
        const scoreJson = await scoreRes.json()
        if (alive && scoreJson?.success && scoreJson.score) {
          setScore({ score: scoreJson.score.score, color: scoreJson.score.color, breakdown: scoreJson.score.breakdown })
        }
      } catch (e: any) {
        if (alive) setPdfError(e?.message || 'Erreur de chargement')
      } finally {
        if (alive) setLoadingPdf(false)
      }
    }
    load()

    return () => {
      alive = false
      if (blobUrlToClean) URL.revokeObjectURL(blobUrlToClean)
    }
  }, [projectId])

  const handleDownload = () => {
    if (!pdfBlobUrl) return
    const a = document.createElement('a')
    a.href = pdfBlobUrl
    a.download = `dossier-bceg-${projectId.slice(0, 8)}.pdf`
    a.click()
  }

  const handleSubmit = async () => {
    if (!confirm('Confirmer l\'envoi du dossier à la BCEG ?\n\nLa BCEG recevra immédiatement votre dossier par email avec le PDF en pièce jointe.')) return
    setSubmitting(true)
    setBanner(null)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${API}/api/bceg/submit-full`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ project_id: projectId }),
      })
      const json = await res.json()
      if (json?.success) {
        setSubmission(json.submission)
        if (json.email_status === 'sent') {
          showBanner('success', `✅ Dossier soumis à la BCEG ! Référence Gabon Insight : ${json.submission.id.slice(0, 8)}`)
        } else if (json.email_status === 'failed') {
          showBanner('info', `Dossier enregistré mais l'email à la BCEG a échoué — l'admin va relancer manuellement.`)
        } else {
          showBanner('success', `Dossier enregistré. (Email BCEG non configuré côté serveur)`)
        }
      } else {
        showBanner('error', json?.error || 'Erreur lors de la soumission')
      }
    } catch (e: any) {
      showBanner('error', e?.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full px-3 sm:px-4 lg:px-8 py-5 sm:py-7">

            <button
              onClick={() => router.push('/business/mes-projets')}
              className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Retour à mes projets
            </button>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs mb-2">
                  <Building2 className="w-3 h-3" /> Dossier BCEG
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">Soumets ton dossier à la <span className="text-amber-300">BCEG</span></h1>
                <p className="text-sm text-white/60 mt-1">Preview ton dossier généré automatiquement, puis envoie-le à la banque en un clic.</p>
              </div>
              {score && <BcegScoreBadge score={score.score} color={score.color} size="lg" breakdown={score.breakdown} showBreakdown />}
            </div>

            {banner && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-5 px-4 py-3 rounded-xl border text-sm ${
                  banner.type === 'success'
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
                    : banner.type === 'error'
                    ? 'bg-red-500/15 border-red-400/30 text-red-100'
                    : 'bg-blue-500/15 border-blue-400/30 text-blue-100'
                }`}
              >
                {banner.msg}
              </motion.div>
            )}

            {submission && (
              <div className="mb-5 bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-5 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-300 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-bold text-emerald-100 mb-1">Dossier soumis avec succès</div>
                  <div className="text-sm text-emerald-200/80">
                    Réf. : <span className="font-mono">{submission.id}</span>
                    <br />Soumis le {new Date(submission.submitted_at).toLocaleString('fr-FR')}
                    <br />La BCEG t'enverra une réponse par email d'ici quelques jours ouvrés.
                  </div>
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-300" />
                      <span className="font-medium text-sm">Aperçu du dossier PDF</span>
                    </div>
                    <button
                      onClick={handleDownload}
                      disabled={!pdfBlobUrl || loadingPdf}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/10 hover:bg-white/15 disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </button>
                  </div>

                  {loadingPdf ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/60 text-sm">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Génération du PDF en cours…
                    </div>
                  ) : pdfError ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-red-200 text-sm">
                      <AlertCircle className="w-6 h-6" />
                      <span>{pdfError}</span>
                      <button onClick={() => location.reload()} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs">
                        <RefreshCw className="w-3 h-3" /> Réessayer
                      </button>
                    </div>
                  ) : pdfBlobUrl ? (
                    <iframe
                      src={pdfBlobUrl}
                      title="Dossier BCEG"
                      className="w-full h-[70vh] bg-white"
                      style={{ border: 0 }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-300/30 rounded-2xl p-5">
                  <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Send className="w-4 h-4 text-amber-300" /> Soumettre à la BCEG
                  </h3>
                  <p className="text-xs text-white/70 mb-4 leading-relaxed">
                    En cliquant ci-dessous, ton dossier PDF sera envoyé directement à l'équipe BCEG par email avec ton adresse en réponse.
                  </p>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !pdfBlobUrl || !!submission}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Envoi à la BCEG…
                      </>
                    ) : submission ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Déjà soumis
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Envoyer à la BCEG
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="font-bold text-white mb-3 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" /> Avant de soumettre
                  </h3>
                  <ul className="space-y-2 text-xs">
                    <ChecklistItem ok={!!score && score.score >= 70} label="BCEG Score ≥ 70" />
                    <ChecklistItem ok={!!pdfBlobUrl} label="PDF du dossier généré" />
                    <ChecklistItem ok={!!score} label="Simulation BCEG complétée" />
                    <ChecklistItem ok={true} label="Tu peux discuter avec le Conseiller BCEG →" />
                  </ul>
                  <p className="mt-3 text-[11px] text-white/50">
                    Astuce : clique sur le bouton 💬 en bas à droite pour discuter avec le mentor BCEG (IA).
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <BcegMentorChat projectContext={{ project_id: projectId, score: score?.score }} />
    </div>
  )
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
      ) : (
        <span className="w-4 h-4 rounded-full border border-white/30 shrink-0" />
      )}
      <span className={ok ? 'text-white/90' : 'text-white/50'}>{label}</span>
    </li>
  )
}
