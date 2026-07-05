'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import {
  GraduationCap, Trophy, Rocket, CheckCircle2, MapPin,
  Sparkles, Award, BookOpen, ListChecks, Users, ArrowRight, Loader2, Medal,
} from 'lucide-react'
import {
  FORMATION_LEVELS, GABON_PROVINCES, FORMATION_SECTORS, PROJECT_STAGES, FORMATION_FORMATS,
} from '@/lib/formations'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function FormationsPage() {
  const { user } = useAuth()
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

  const scrollToForm = () => document.getElementById('candidater')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#4d553e] via-[#697357] to-[#3a4030] text-white">
        {/* Fond vidéo animé (boucle, thème BCEG) */}
        <video
          src="/covers/formations/hero.mp4"
          autoPlay muted loop playsInline preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#4d553e]/85 via-[#697357]/80 to-[#3a4030]/90 pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs sm:text-sm font-semibold mb-5">
            <GraduationCap className="w-4 h-4 text-amber-200" />
            Programme Entrepreneur BCEG × Gabon Insight
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight max-w-3xl">
            Devenez un entrepreneur finançable en <span className="text-amber-300">3 mois</span>
          </h1>
          <p className="mt-4 text-base sm:text-xl text-white/85 max-w-2xl">
            Une formation <b>100 % gratuite, ouverte à tous</b>, partout au Gabon : apprenez à lancer et gérer
            votre business, validez vos niveaux, et débloquez l'accès au financement BCEG.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/formations/niveau-1"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-300 text-[#3a4030] font-bold hover:bg-amber-200 transition-colors shadow-lg">
              Commencer gratuitement <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={scrollToForm}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/15 backdrop-blur text-white font-semibold hover:bg-white/25 transition-colors">
              <Users className="w-5 h-5 text-amber-200" /> Cohorte accompagnée
            </button>
            <Link href="/formations/classement"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/15 backdrop-blur text-white font-semibold hover:bg-white/25 transition-colors">
              <Trophy className="w-5 h-5 text-amber-200" /> Classement
            </Link>
          </div>
          <p className="mt-3 text-sm text-white/70">
            Sans inscription préalable — commencez le niveau 1 maintenant, créez votre compte quand vous validez votre premier module.
          </p>
          {/* Key facts */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
            {[
              { icon: Award, label: '100 % gratuit', sub: 'aucun frais' },
              { icon: Medal, label: 'Certificats', sub: 'à chaque niveau' },
              { icon: MapPin, label: '9 provinces', sub: 'tout le Gabon' },
              { icon: Trophy, label: 'Financement', sub: 'paliers BCEG' },
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

      {/* PALIERS / NIVEAUX */}
      <section id="programme" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900">3 niveaux, 3 paliers de financement</h2>
          <p className="mt-3 text-slate-600">
            Chaque niveau se valide par des cours et des QCM. Une fois validé, il débloque un palier
            de demande de financement auprès de la BCEG.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FORMATION_LEVELS.map((lvl) => (
            <div key={lvl.level} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Cover animée (boucle, thème BCEG) */}
              <div className="relative aspect-[16/9] overflow-hidden bg-[#4d553e]">
                <video
                  src={`/covers/formations/niveau-${lvl.level}.mp4`}
                  autoPlay muted loop playsInline preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
              </div>
              <div className={`bg-gradient-to-br ${lvl.color} text-white p-5`}>
                <div className="flex items-center justify-between">
                  <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">{lvl.level}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide bg-amber-300/90 text-[#3a4030] px-2.5 py-1 rounded-full">
                    {lvl.financingCeiling}
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-bold leading-tight">{lvl.title}</h3>
                <p className="text-white/80 text-sm mt-1">{lvl.tagline}</p>
              </div>
              <ul className="p-5 space-y-2 flex-1">
                {lvl.topics.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-[#697357] shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="px-5 pb-5">
                <Link href={`/formations/niveau-${lvl.level}`}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white text-sm font-semibold transition-colors">
                  Aperçu du Niveau {lvl.level} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-5">
          🔒 La demande de financement d'un palier n'est débloquée qu'après validation du niveau correspondant.
        </p>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900">Une plateforme sérieuse et motivante</h2>
            <p className="mt-3 text-slate-600">Des cours structurés, des évaluations, et de la gamification pour aller au bout.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: BookOpen, title: 'Cours adaptés', desc: 'Modules clairs, exemples concrets du contexte gabonais (FCFA, OHADA, marché local).' },
              { icon: ListChecks, title: 'Tests & QCM', desc: 'Validez chaque module par des quiz. Pas de QCM réussi, pas de niveau validé.' },
              { icon: Sparkles, title: 'Assistant IA', desc: 'Une IA vous accompagne, répond à vos questions et adapte les exemples à votre projet.' },
              { icon: Trophy, title: 'Défis & points', desc: 'Gagnez des points (XP), relevez des défis hebdomadaires et progressez en vous challengeant.' },
              { icon: Medal, title: 'Badges & certificats', desc: 'Débloquez des badges et obtenez un certificat à chaque niveau validé.' },
              { icon: Users, title: 'Classement national', desc: 'Comparez-vous aux entrepreneurs de tout le pays et grimpez dans le classement.' },
            ].map((c, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-[#697357]/10 flex items-center justify-center mb-3">
                  <c.icon className="w-5 h-5 text-[#697357]" />
                </div>
                <h3 className="font-bold text-slate-900">{c.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DÉROULÉ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[
            { n: '01', icon: BookOpen, t: 'Formez-vous gratuitement', d: 'Commencez le niveau 1 immédiatement, à votre rythme, avec l\'assistant IA. Aucune sélection pour apprendre.' },
            { n: '02', icon: ListChecks, t: 'Validez vos niveaux', d: 'Réussissez les QCM de chaque module, gagnez des XP et obtenez un certificat à chaque niveau.' },
            { n: '03', icon: Rocket, t: 'Financez votre projet', d: 'Chaque niveau validé débloque un palier de demande de financement BCEG, jusqu\'à 5M FCFA et plus.' },
          ].map((s, i) => (
            <div key={i} className="relative bg-white rounded-2xl border border-slate-200 p-6">
              <span className="absolute top-4 right-5 text-4xl font-black text-[#697357]/10">{s.n}</span>
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#697357] to-[#4d553e] flex items-center justify-center mb-3">
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">{s.t}</h3>
              <p className="text-sm text-slate-600 mt-1">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CANDIDATURE */}
      <section id="candidater" className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-8">
            <Users className="w-10 h-10 text-amber-300 mx-auto mb-3" />
            <h2 className="text-2xl sm:text-4xl font-black">Rejoindre la prochaine cohorte accompagnée</h2>
            <p className="mt-2 text-white/80">
              La formation en ligne est <b>ouverte à tous, sans candidature</b>. La cohorte, elle, offre en plus un
              accompagnement renforcé sur 3 mois (présentiel ou distanciel, mentorat, suivi de dossier) — sélection sur dossier, gratuite.
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
