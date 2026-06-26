'use client'

import React, { useEffect, useState } from 'react'
import { fetchWithTimeout } from '@/utils/fetchWithTimeout'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Building2, Sparkles, CheckCircle2, FileText, ArrowRight,
  Loader2, Award, TrendingUp, Send, Upload, Calendar, BookOpen, Target
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const BCEG_LOGO = '/646710125_122187790628463229_813105913342150168_n.jpg'

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

interface BcegFinanceSectionProps {
  project: any
  actions?: any[]
  documents?: any[]
  /** Pièces réellement téléversées/importées dans le dossier (due_diligence_documents, avec doc_type) */
  uploadedDocs?: any[]
  onNavigateSection?: (section: string) => void
}

const REQUIRED_DOCS = [
  { key: 'business_plan', label: 'Business Plan', desc: '10 sections complètes', icon: BookOpen },
  { key: 'illustration', label: 'Infographie du projet', desc: 'Business en 1 image', icon: Target },
  { key: 'cni', label: "Pièce d'identité (CNI)", desc: 'Recto-verso lisible', icon: FileText },
  { key: 'rccm', label: 'RCCM ou attestation', desc: 'Registre du Commerce', icon: FileText },
  { key: 'rib', label: 'RIB / Coordonnées bancaires', desc: 'Compte personnel ou pro', icon: FileText },
  { key: 'plan_action', label: "Plan d'action détaillé", desc: '10 étapes + budget', icon: Target },
  { key: 'devis', label: 'Devis ou justificatifs', desc: 'Estimation des besoins', icon: FileText },
]

export default function BcegFinanceSection({
  project,
  actions = [],
  uploadedDocs = [],
  onNavigateSection,
}: BcegFinanceSectionProps) {
  const router = useRouter()
  const [score, setScore] = useState<ScoreInfo | null>(null)
  const [loadingScore, setLoadingScore] = useState(true)

  useEffect(() => {
    if (!project?.id) return
    let alive = true
    setLoadingScore(true)
    ;(async () => {
      try {
        const headers = await authHeaders()
        const res = await fetchWithTimeout(`${API}/api/bceg/score`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ project_id: project.id, project }),
        })
        const json = await res.json()
        if (alive && json?.success) {
          setScore({ score: json.score, color: json.color, breakdown: json.breakdown })
        }
      } catch {} finally {
        if (alive) setLoadingScore(false)
      }
    })()
    return () => { alive = false }
  }, [project?.id])

  const hasBusinessPlan = (actions || []).some(a =>
    a.action_type === 'business-plan' || a.action_type === 'business-plan-section'
  )
  const hasActionPlan = (actions || []).some(a => a.action_type === 'action-plan')

  // Pièces réellement téléversées/importées dans le dossier (par doc_type)
  const uploadedTypes = new Set((uploadedDocs || []).map((d: any) => d.doc_type))
  const hasPersonalDocs = ['cni', 'rccm', 'rib'].every(k => uploadedTypes.has(k))

  const checklist = REQUIRED_DOCS.map(d => {
    // Une pièce est validée si son fichier est joint au dossier…
    let ok = uploadedTypes.has(d.key)
    // …ou, pour le BP / plan d'action, si elle a été générée via l'IA.
    if (d.key === 'business_plan') ok = ok || hasBusinessPlan
    if (d.key === 'plan_action') ok = ok || hasActionPlan
    return { ...d, ok }
  })

  const doneCount = checklist.filter(c => c.ok).length
  const completionPct = Math.round((doneCount / checklist.length) * 100)

  const scoreColor = score?.color === 'green' ? 'text-emerald-600'
    : score?.color === 'orange' ? 'text-amber-600'
    : score?.color === 'red' ? 'text-rose-600'
    : 'text-slate-400'

  const handleSubmitDossier = () => {
    router.push(`/business/mes-projets/${project.id}/dossier-bceg`)
  }

  return (
    <div className="space-y-6">

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#697357] via-[#4d553e] to-[#3a4030] p-6 sm:p-8 text-white shadow-xl shadow-[#697357]/30"
      >
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5 blur-3xl" />

        <div className="relative">
          <div className="flex items-start gap-4 mb-4">
            <img src={BCEG_LOGO} alt="BCEG" className="w-14 h-14 rounded-xl ring-2 ring-white/30 shrink-0" />
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-wider font-bold opacity-80 mb-1">
                BCEG · Banque pour le Commerce et l'Entrepreneuriat du Gabon
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                Votre parcours vers le financement
              </h1>
              <p className="text-sm sm:text-base opacity-85 mt-1">
                Nous avons préparé tout ce qu'il vous faut. Suivez les étapes pour soumettre votre dossier.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <KpiTile label="Complétion" value={`${completionPct}%`} />
            <KpiTile label="BCEG Score" value={loadingScore ? '…' : (score ? `${score.score}/100` : '—')} />
            <KpiTile label="Documents prêts" value={`${doneCount}/${checklist.length}`} />
            <KpiTile label="Taux estimé" value="5 %" hint="CATR / FAMAD" />
          </div>
        </div>
      </motion.div>

      <EncouragementBanner completionPct={completionPct} score={score?.score} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div className="lg:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#697357] text-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Pièces requises pour le dossier
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cochez chaque étape — la BCEG attend ces éléments pour étudier votre demande.
              </p>
            </div>
            <span className="text-sm font-bold text-[#697357] px-3 py-1 rounded-full bg-[#697357]/10">
              {doneCount}/{checklist.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-100">
            {checklist.map((item) => {
              const Icon = item.icon
              const onClick = () => onNavigateSection?.(`fin-${item.key}`)
              return (
                <li
                  key={item.key}
                  onClick={onClick}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                      item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-semibold truncate ${item.ok ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  {/* Check si présent, cercle vide sinon */}
                  {item.ok ? (
                    <CheckCircle2 className="shrink-0 w-6 h-6 text-emerald-600" />
                  ) : (
                    <div className="shrink-0 w-6 h-6 rounded-full border-2 border-slate-300" />
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-[#697357] flex items-center gap-2 mb-3">
              <Award className="w-4 h-4" />
              Votre BCEG Score™
            </h3>
            {loadingScore ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-[#697357]" />
              </div>
            ) : score ? (
              <>
                <div className="text-center py-2">
                  <div className={`text-5xl font-black ${scoreColor}`}>{score.score}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider">sur 100</div>
                </div>
                <p className="text-xs text-slate-600 text-center mt-2">
                  {score.score >= 75 ? '🎉 Bancabilité excellente' :
                   score.score >= 50 ? '👍 Bancabilité prometteuse' :
                   '⚡ Le potentiel est là — quelques ajustements à faire'}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">
                Score indisponible
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmitDossier}
            className="w-full flex flex-col items-center gap-1 p-5 rounded-2xl bg-gradient-to-br from-[#697357] to-[#4d553e] hover:from-[#4d553e] hover:to-[#3a4030] text-white font-bold shadow-lg shadow-[#697357]/30 transition-all"
          >
            <Send className="w-5 h-5" />
            <span className="text-base">Soumettre à la BCEG</span>
            <span className="text-[10px] font-normal opacity-80">Génère le PDF + envoie le dossier</span>
          </motion.button>

          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <h3 className="font-bold text-amber-900 text-sm flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" />
              Programmes BCEG
            </h3>
            <ul className="text-[11px] text-amber-900 space-y-1.5">
              <li className="flex items-start gap-1.5">
                <span className="font-bold">CATR :</span>
                <span>Crédit d'Appui à la TPE Rurale — 5 % subventionné</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold">FAMAD :</span>
                <span>Femmes & jeunes — apport personnel allégé</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold">CMS :</span>
                <span>Crédit Moyen Standard PME — 6-8 %</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-200">
          <h2 className="font-bold text-[#697357] text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Prochaines étapes recommandées
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <NextStep
            n={1}
            icon={BookOpen}
            title="Ébauche Business Plan"
            desc="Générez les 10 sections via l'IA"
            cta="Lancer"
            done={hasBusinessPlan}
            onClick={() => onNavigateSection?.('actions')}
          />
          <NextStep
            n={2}
            icon={Upload}
            title="Documents personnels"
            desc="CNI, RCCM, RIB"
            cta="Préparer"
            done={hasPersonalDocs}
            onClick={() => { window.location.href = `/business/bceg-prepare?tab=docs&projectId=${project.id}&from=${encodeURIComponent(`/business/mes-projets?projectId=${project.id}&openCard=true&tab=financement`)}` }}
          />
          <NextStep
            n={3}
            icon={Calendar}
            title="Prendre RDV avec un conseiller"
            desc="Échangez avec un conseiller Gabon Insight"
            cta="Réserver"
            done={false}
            onClick={() => { window.location.href = `/business/bceg-prepare?tab=rdv&projectId=${project.id}&from=${encodeURIComponent(`/business/mes-projets?projectId=${project.id}&openCard=true&tab=financement`)}` }}
          />
        </div>
      </div>

      <div className="text-center text-xs text-slate-500 px-4 max-w-2xl mx-auto leading-relaxed">
        <Building2 className="inline w-3.5 h-3.5 mr-1 text-[#697357]" />
        Vos informations sont partagées de manière sécurisée avec la BCEG uniquement après votre validation explicite via le bouton « Soumettre à la BCEG ».
      </div>
    </div>
  )
}

function KpiTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl px-3 py-3 border border-white/15">
      <div className="text-[10px] uppercase tracking-wider opacity-75 font-bold mb-0.5">{label}</div>
      <div className="text-lg font-bold leading-none">{value}</div>
      {hint && <div className="text-[10px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  )
}

function NextStep({
  n, icon: Icon, title, desc, cta, done, onClick,
}: {
  n: number; icon: any; title: string; desc: string; cta: string; done: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-5 hover:bg-slate-50 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-[#697357]/10 text-[#697357]'
        }`}>
          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
        </span>
        <Icon className={`w-4 h-4 ${done ? 'text-emerald-600' : 'text-[#697357]'}`} />
      </div>
      <div className="font-bold text-slate-900 text-sm mb-0.5">{title}</div>
      <div className="text-xs text-slate-500 mb-3 line-clamp-1">{desc}</div>
      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
        done ? 'text-emerald-600' : 'text-[#697357] group-hover:gap-2 transition-all'
      }`}>
        {done ? 'Validé' : cta} <ArrowRight className="w-3 h-3" />
      </span>
    </button>
  )
}

function EncouragementBanner({ completionPct, score }: { completionPct: number; score?: number }) {
  let title = ''
  let body = ''
  let icon = <Sparkles className="w-5 h-5" />

  if (completionPct === 100 && (score ?? 0) >= 75) {
    title = '🎉 Votre dossier est prêt à être soumis !'
    body = 'Tous les éléments sont là, et votre BCEG Score est excellent. Cliquez sur « Soumettre à la BCEG ».'
    icon = <Award className="w-5 h-5" />
  } else if (completionPct >= 50) {
    title = 'Vous êtes sur la bonne voie 👏'
    body = `Encore quelques étapes et votre dossier sera prêt à passer en revue à la BCEG.`
  } else {
    title = 'Construisons ensemble votre dossier'
    body = `Commençons par le business plan : c'est le document central que la BCEG étudiera en priorité.`
    icon = <BookOpen className="w-5 h-5" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 rounded-2xl bg-[#697357]/5 border border-[#697357]/20"
    >
      <div className="shrink-0 w-10 h-10 rounded-xl bg-[#697357]/10 text-[#697357] flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-bold text-[#697357]">{title}</div>
        <div className="text-sm text-slate-700 mt-0.5">{body}</div>
      </div>
    </motion.div>
  )
}
