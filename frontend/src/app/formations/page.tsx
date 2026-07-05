'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  GraduationCap, Trophy, Rocket, CheckCircle2, MapPin, Sparkles, Award, BookOpen,
  ListChecks, Users, ArrowRight, Loader2, Medal, Flame, Brain, PlayCircle, Headphones, MessageCircle,
} from 'lucide-react'
import {
  FORMATION_LEVELS, GABON_PROVINCES, FORMATION_SECTORS, PROJECT_STAGES, FORMATION_FORMATS,
} from '@/lib/formations'
import { MODULES_BY_LEVEL } from '@/lib/formations-content'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

/* ---------- « Reprendre » : la page reconnaît l'apprenant et lui dit où il en est ---------- */
type ResumeState = {
  level: number
  done: number
  total: number
  streak: number
  dueReviews: number
}

function useResume(): ResumeState | null {
  const { user } = useAuth()
  const [state, setState] = useState<ResumeState | null>(null)

  useEffect(() => {
    let cancelled = false
    const totalFor = (lvl: number) => (MODULES_BY_LEVEL[lvl] || []).length || 5

    ;(async () => {
      // Connecté : progression + série depuis le serveur
      if (user?.id) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const headers: Record<string, string> = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
          const [pRes, sRes] = await Promise.all([
            fetch(`${API_URL}/api/formations/progress`, { headers }),
            fetch(`${API_URL}/api/formations/streak`, { headers }),
          ])
          const p = await pRes.json()
          const s = await sRes.json().catch(() => ({}))
          if (cancelled || !p?.success) return
          const byLevel: Record<number, number> = p.passedByLevel || {}
          const anyProgress = [1, 2, 3].some((l) => (byLevel[l] || 0) > 0)
          if (!anyProgress) return
          const level = Math.min((p.levelUnlocked || 0) + 1, 3)
          setState({
            level,
            done: byLevel[level] || 0,
            total: totalFor(level),
            streak: s?.current || 0,
            dueReviews: s?.dueReviews || 0,
          })
          return
        } catch { /* repli local */ }
      }
      // Anonyme : progression locale
      try {
        for (const lvl of [3, 2, 1]) {
          const saved: string[] = JSON.parse(localStorage.getItem(`fmt-passed-${lvl}`) || '[]')
          if (saved.length) {
            if (!cancelled) setState({ level: lvl, done: saved.length, total: totalFor(lvl), streak: 0, dueReviews: 0 })
            return
          }
        }
      } catch { /* noop */ }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  return state
}

function ResumeCard({ resume }: { resume: ResumeState }) {
  const pct = Math.min(100, Math.round((resume.done / Math.max(resume.total, 1)) * 100))
  return (
    <div className="relative -mt-8 z-10 max-w-3xl mx-auto px-4 sm:px-6">
      <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-black text-slate-900 text-lg">👋 Content de vous revoir !</p>
            <p className="text-sm text-slate-600 mt-0.5">
              Vous en êtes au <b>Niveau {resume.level}</b> — {resume.done}/{resume.total} leçons terminées.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {resume.streak > 0 && (
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">
                <Flame className="w-3.5 h-3.5" /> {resume.streak} jour{resume.streak > 1 ? 's' : ''}
              </span>
            )}
            {resume.dueReviews > 0 && (
              <Link href="/formations/revisions" className="inline-flex items-center gap-1 bg-[#697357]/10 text-[#4d553e] px-2.5 py-1 rounded-full text-xs font-bold hover:bg-[#697357]/20">
                <Brain className="w-3.5 h-3.5" /> {resume.dueReviews} à réviser
              </Link>
            )}
          </div>
        </div>
        <div className="mt-3 h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-[#697357] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <Link href={`/formations/niveau-${resume.level}/apprendre`}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold text-base">
          <PlayCircle className="w-5 h-5" /> Continuer ma formation
        </Link>
      </div>
    </div>
  )
}

export default function FormationsPage() {
  const { user } = useAuth()
  const resume = useResume()
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', province: '', city: '', sector: '',
    project_title: '', project_stage: '', preferred_format: '', motivation: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name || !form.email) { setError('Nom et e-mail sont requis.'); return }
    setSubmitting(true); setError('')
    try {
      const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      const source = sp?.get('src') || sp?.get('utm_source') || 'direct'
      const res = await fetch(`${API_URL}/api/formations/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, user_id: user?.id || null, source }),
      })
      const data = await res.json()
      if (data.success) setDone(true)
      else setError(data.error || "Erreur lors de l'envoi.")
    } catch {
      setError('Erreur réseau. Réessayez.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HERO — un seul message, une seule action */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#4d553e] via-[#697357] to-[#3a4030] text-white">
        <video
          src="/covers/formations/hero.mp4"
          autoPlay muted loop playsInline preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#4d553e]/85 via-[#697357]/80 to-[#3a4030]/90 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 pb-16 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs sm:text-sm font-semibold mb-5">
            <GraduationCap className="w-4 h-4 text-amber-200" />
            Programme Entrepreneur BCEG × Gabon Insight
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight max-w-3xl mx-auto">
            Apprenez à gérer votre business.<br className="hidden sm:block" />
            <span className="text-amber-300">Débloquez votre financement.</span>
          </h1>
          <p className="mt-4 text-base sm:text-xl text-white/85 max-w-2xl mx-auto">
            Des cours simples et <b>100 % gratuits</b>, sur votre téléphone.
            À la fin de chaque niveau : un certificat, et le droit de demander un financement BCEG.
          </p>
          {!resume && (
            <>
              <div className="mt-8">
                <Link href="/formations/niveau-1"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-300 text-[#3a4030] font-black text-lg hover:bg-amber-200 transition-colors shadow-xl">
                  <PlayCircle className="w-6 h-6" /> Commencer — c'est gratuit
                </Link>
              </div>
              <p className="mt-3 text-sm text-white/70">
                Pas besoin de compte pour essayer. Pas besoin de carte bancaire. Juste vous et votre projet.
              </p>
            </>
          )}
          {/* Réassurance */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
            {[
              { icon: Award, label: '100 % gratuit', sub: 'aucun frais, jamais' },
              { icon: Medal, label: 'Certificat', sub: 'à chaque niveau réussi' },
              { icon: MapPin, label: '9 provinces', sub: 'partout au Gabon' },
              { icon: Trophy, label: 'Financement', sub: 'jusqu\'à 5M FCFA et +' },
            ].map((f, i) => (
              <div key={i} className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/15">
                <f.icon className="w-5 h-5 text-amber-200 mb-1" />
                <div className="font-bold text-sm sm:text-base">{f.label}</div>
                <div className="text-white/70 text-xs">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REPRENDRE — la page vous reconnaît */}
      {resume && <ResumeCard resume={resume} />}

      {/* COMMENT ÇA MARCHE — le modèle mental d'abord, en 3 phrases */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center">Comment ça marche ?</h2>
        <p className="mt-2 text-slate-600 text-center max-w-xl mx-auto">C'est simple : vous apprenez, vous validez, vous demandez votre financement.</p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { n: 1, icon: BookOpen, t: 'Suivez les leçons', d: 'Des cours courts et concrets, à lire ou à écouter, à votre rythme. Même hors connexion.' },
            { n: 2, icon: ListChecks, t: 'Réussissez les petits tests', d: 'Après chaque leçon, quelques questions pour vérifier que c\'est acquis. Vous pouvez recommencer.' },
            { n: 3, icon: Rocket, t: 'Demandez votre financement', d: 'Chaque niveau terminé vous donne un certificat et ouvre un montant de financement BCEG.' },
          ].map((s) => (
            <div key={s.n} className="relative bg-white rounded-2xl border border-slate-200 p-6 text-center">
              <span className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-[#697357] to-[#4d553e] flex items-center justify-center text-white font-black text-lg mb-3">{s.n}</span>
              <h3 className="font-bold text-slate-900 text-lg">{s.t}</h3>
              <p className="text-sm text-slate-600 mt-1.5">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LES 3 NIVEAUX — l'objectif financier bien visible */}
      <section id="programme" className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center">Votre parcours en 3 niveaux</h2>
          <p className="mt-2 text-slate-600 text-center max-w-xl mx-auto">
            Plus vous avancez, plus le montant que vous pouvez demander augmente.
          </p>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            {FORMATION_LEVELS.map((lvl) => (
              <Link key={lvl.level} href={`/formations/niveau-${lvl.level}`}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-lg hover:border-[#697357]/40 transition-all">
                <div className="relative aspect-[16/9] overflow-hidden bg-[#4d553e]">
                  <video
                    src={`/covers/formations/niveau-${lvl.level}.mp4`}
                    autoPlay muted loop playsInline preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  <span className="absolute top-3 left-3 w-9 h-9 rounded-xl bg-white/90 text-[#4d553e] flex items-center justify-center font-black">{lvl.level}</span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <span className="self-start text-[11px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full mb-2">
                    💰 {lvl.financingCeiling}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">{lvl.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 flex-1">{lvl.tagline}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#4d553e] group-hover:gap-2.5 transition-all">
                    Voir le niveau {lvl.level} <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-5">
            🔒 Un montant se débloque quand le niveau correspondant est terminé — c'est ce qui rassure la banque.
          </p>
        </div>
      </section>

      {/* VOUS N'ÊTES PAS SEUL — les 3 aides, en langage simple */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center">Vous n'êtes jamais seul</h2>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Sparkles, t: 'Posez vos questions', d: 'Un assistant répond à toutes vos questions pendant les leçons, avec des exemples du Gabon en FCFA. Sous chaque paragraphe, un bouton « Expliquer simplement ».' },
            { icon: Headphones, t: 'Écoutez les cours', d: 'Chaque leçon peut être écoutée comme la radio — pratique dans le taxi, au marché ou quand la lecture fatigue.' },
            { icon: MessageCircle, t: 'Formez-vous sur WhatsApp', d: 'Toute la formation existe aussi sur WhatsApp : leçons, tests et rappels de révision, même avec une petite connexion.' },
          ].map((c, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="w-11 h-11 rounded-xl bg-[#697357]/10 flex items-center justify-center mb-3">
                <c.icon className="w-5 h-5 text-[#697357]" />
              </div>
              <h3 className="font-bold text-slate-900">{c.t}</h3>
              <p className="text-sm text-slate-600 mt-1">{c.d}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          Et pour se motiver : des points, des badges et un{' '}
          <Link href="/formations/classement" className="text-[#4d553e] font-semibold underline">classement national</Link> des apprenants.
        </p>
      </section>

      {/* SIMULATEUR BANQUIER — présenté comme l'étape d'après */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#697357] to-[#4d553e] text-white p-6 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <span className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center text-4xl shrink-0">🏦</span>
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-black">Avant le vrai rendez-vous : entraînez-vous avec un banquier</h2>
            <p className="mt-1 text-white/85 text-sm sm:text-base max-w-xl">
              M. Ndong vous pose les vraies questions d'un entretien de financement, puis vous donne une note
              et des conseils. Recommencez autant de fois que vous voulez — c'est un entraînement.
            </p>
          </div>
          <Link href="/formations/simulateur"
            className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-300 text-[#3a4030] font-bold hover:bg-amber-200 transition-colors shadow-lg">
            Passer l'entretien <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* COHORTE ACCOMPAGNÉE */}
      <section id="candidater" className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-8">
            <Users className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <h2 className="text-2xl sm:text-4xl font-black">Envie d'être accompagné de plus près ?</h2>
            <p className="mt-2 text-white/80">
              La formation en ligne est <b>ouverte à tous, sans inscription préalable</b>. En plus, nous formons des
              groupes accompagnés pendant 3 mois (en présentiel ou à distance, avec un mentor et un suivi de dossier).
              C'est gratuit — la sélection se fait sur dossier.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
              {['Un projet ou une idée concrète', 'De la motivation', 'Disponibilité sur 3 mois'].map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" /> {c}
                </span>
              ))}
            </div>
          </div>

          {done ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-800">
              <CheckCircle2 className="w-14 h-14 text-[#697357] mx-auto mb-3" />
              <h3 className="text-xl font-bold">Candidature envoyée 🎉</h3>
              <p className="text-slate-600 mt-2">Merci ! Nous étudions les candidatures et revenons vers les profils sélectionnés par e-mail.</p>
              <Link href="/formations/niveau-1" className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#697357] text-white font-bold">
                En attendant, commencez le niveau 1 <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white rounded-2xl p-5 sm:p-7 text-slate-800 space-y-4 shadow-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Nom complet *"><input required value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} placeholder="Votre nom" /></Field>
                <Field label="E-mail *"><input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} placeholder="vous@email.com" /></Field>
                <Field label="Téléphone"><input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+241 ..." /></Field>
                <Field label="Province">
                  <select value={form.province} onChange={e => set('province', e.target.value)} className={inputCls}>
                    <option value="">— Choisir —</option>
                    {GABON_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <Field label="Ville"><input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} placeholder="Libreville, Port-Gentil…" /></Field>
                <Field label="Secteur">
                  <select value={form.sector} onChange={e => set('sector', e.target.value)} className={inputCls}>
                    <option value="">— Choisir —</option>
                    {FORMATION_SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Titre / idée de projet"><input value={form.project_title} onChange={e => set('project_title', e.target.value)} className={inputCls} placeholder="Ex : élevage avicole à Oyem" /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Stade du projet">
                  <select value={form.project_stage} onChange={e => set('project_stage', e.target.value)} className={inputCls}>
                    <option value="">— Choisir —</option>
                    {PROJECT_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Format préféré">
                  <select value={form.preferred_format} onChange={e => set('preferred_format', e.target.value)} className={inputCls}>
                    <option value="">— Choisir —</option>
                    {FORMATION_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Votre motivation"><textarea value={form.motivation} onChange={e => set('motivation', e.target.value)} rows={4} className={inputCls} placeholder="Parlez-nous de votre projet et de pourquoi vous voulez rejoindre le programme." /></Field>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button type="submit" disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold transition-colors disabled:opacity-50">
                {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Envoi…</> : <>Envoyer ma candidature <ArrowRight className="w-5 h-5" /></>}
              </button>
              <p className="text-center text-xs text-slate-400">Vos informations restent confidentielles et servent uniquement à la sélection.</p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}

const inputCls = 'w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-[#697357] focus:ring-1 focus:ring-[#697357] text-sm'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
