'use client'

import React, { useEffect, useState } from 'react'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, Send, Loader2, FileText, CheckCircle2, AlertCircle,
  Building2, Sparkles, RefreshCw
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import BcegBackdrop from '@/components/bceg/BcegBackdrop'
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

        const pdfRes = await fetchWithTimeout(`${API}/api/bceg/generate-dossier`, {
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

        const scoreRes = await fetchWithTimeout(`${API}/api/bceg/my-score?project_id=${projectId}`, { headers })
        const scoreJson = await scoreRes.json()
        if (alive && scoreJson?.success && scoreJson.score) {
          setScore({ score: scoreJson.score.score, color: scoreJson.score.color, breakdown: scoreJson.score.breakdown })
        }

        // Statut/décision de la dernière soumission pour ce projet
        const subRes = await fetchWithTimeout(`${API}/api/bceg/my-submissions`, { headers })
        const subJson = await subRes.json()
        if (alive && subJson?.success) {
          const mine = (subJson.submissions || []).find((s: any) => s.project_id === projectId)
          if (mine) setSubmission(mine)
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
      const res = await fetchWithTimeout(`${API}/api/bceg/submit-full`, {
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
    <div className="min-h-screen relative">
      <BcegBackdrop opacity={0.5} />
      <div className="relative z-10 text-slate-900">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full px-3 sm:px-4 lg:px-8 py-5 sm:py-7">

            <button
              onClick={() => router.push('/business/mes-projets')}
              className="inline-flex items-center gap-1.5 text-sm text-slate-900/60 hover:text-slate-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Retour à mes projets
            </button>

            <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#697357]/20 border border-[#8a9576]/40 text-[#a8b794] text-xs mb-2">
                  <Building2 className="w-3 h-3" /> Dossier BCEG
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">Soumets ton dossier à la <span className="text-[#a8b794]">BCEG</span></h1>
                <p className="text-sm text-slate-900/60 mt-1">Preview ton dossier généré automatiquement, puis envoie-le à la banque en un clic.</p>
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

            {submission && (() => {
              const st = submission.status || 'submitted'
              const META: Record<string, { tone: string; title: string; sub: string }> = {
                submitted: { tone: 'bg-blue-500/10 border-blue-400/30 text-blue-100', title: 'Dossier soumis à la BCEG', sub: 'Votre dossier a bien été reçu. Il sera bientôt pris en charge.' },
                in_review: { tone: 'bg-amber-500/10 border-amber-400/30 text-amber-100', title: '⏳ Dossier en cours d\'examen', sub: 'La BCEG examine actuellement votre dossier. Vous serez notifié de la décision.' },
                accepted: { tone: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-100', title: '🎉 Dossier accepté par la BCEG', sub: 'Félicitations ! La BCEG va vous recontacter pour la suite.' },
                rejected: { tone: 'bg-rose-500/10 border-rose-400/30 text-rose-100', title: 'Dossier à réviser', sub: 'La BCEG demande des compléments ou corrections avant de poursuivre.' },
                draft: { tone: 'bg-slate-500/10 border-slate-400/30 text-slate-100', title: 'Brouillon', sub: 'Dossier non encore soumis.' },
              }
              const m = META[st] || META.submitted
              return (
                <div className={`mb-5 border rounded-2xl p-5 flex items-start gap-3 ${m.tone}`}>
                  <CheckCircle2 className="w-6 h-6 mt-0.5 shrink-0 opacity-90" />
                  <div className="flex-1 text-sm">
                    <div className="font-bold mb-1">{m.title}</div>
                    <div className="opacity-80">
                      {m.sub}
                      {submission.bceg_reference && <><br />Référence BCEG : <span className="font-mono">{submission.bceg_reference}</span></>}
                      {submission.admin_notes && (st === 'rejected' || st === 'accepted') && <><br />Message BCEG : {submission.admin_notes}</>}
                      {submission.submitted_at && <><br />Soumis le {new Date(submission.submitted_at).toLocaleString('fr-FR')}</>}
                      {submission.decision_at && <><br />Décision le {new Date(submission.decision_at).toLocaleString('fr-FR')}</>}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="grid lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                <div className="bg-white/85 border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-white/85 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#a8b794]" />
                      <span className="font-medium text-sm">Aperçu du dossier PDF</span>
                    </div>
                    <button
                      onClick={handleDownload}
                      disabled={!pdfBlobUrl || loadingPdf}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/90 hover:bg-white/15 disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5" /> Télécharger
                    </button>
                  </div>

                  {loadingPdf ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-900/60 text-sm">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Génération du PDF en cours…
                    </div>
                  ) : pdfError ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-red-200 text-sm">
                      <AlertCircle className="w-6 h-6" />
                      <span>{pdfError}</span>
                      <button onClick={() => location.reload()} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-slate-900 text-xs">
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
                <div className="bg-gradient-to-br from-[#697357]/15 to-[#8a9576]/10 border border-[#8a9576]/30 rounded-2xl p-5">
                  <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#a8b794]" /> Soumettre à la BCEG
                  </h3>
                  <p className="text-xs text-slate-900/70 mb-4 leading-relaxed">
                    En cliquant ci-dessous, ton dossier PDF sera envoyé directement à l'équipe BCEG par email avec ton adresse en réponse.
                  </p>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !pdfBlobUrl || !!submission}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-slate-900 bg-gradient-to-r from-[#8a9576] to-[#697357] hover:from-[#697357] hover:to-[#4d553e] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#697357]/30"
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

                <div className="bg-white/85 border border-slate-200 rounded-2xl p-5">
                  <h3 className="font-bold text-slate-900 mb-3 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#a8b794]" /> Avant de soumettre
                  </h3>
                  <ul className="space-y-2 text-xs">
                    <ChecklistItem ok={!!score && score.score >= 70} label="BCEG Score ≥ 70" />
                    <ChecklistItem ok={!!pdfBlobUrl} label="PDF du dossier généré" />
                    <ChecklistItem ok={!!score} label="Simulation BCEG complétée" />
                    <ChecklistItem ok={true} label="Tu peux discuter avec le Conseiller BCEG →" />
                  </ul>
                  <p className="mt-3 text-[11px] text-slate-900/50">
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
    </div>
  )
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
      ) : (
        <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
      )}
      <span className={ok ? 'text-slate-900/90' : 'text-slate-900/50'}>{label}</span>
    </li>
  )
}
