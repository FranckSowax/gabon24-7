'use client'

import Link from 'next/link'
import {
  ArrowRight, GraduationCap, Sparkles, Building2, TrendingUp, FileCheck,
  HandCoins, CheckCircle2, Megaphone,
} from 'lucide-react'

const CYCLE = [
  { n: 1, icon: HandCoins, title: 'La BCEG finance les formations', desc: "La banque finance l'accès aux formations pour ses clients, prospects et publics prioritaires." },
  { n: 2, icon: GraduationCap, title: 'Les entrepreneurs se forment', desc: 'Formations à distance ou en présentiel : gestion, finance, business plan, IA, secteur d\'activité.' },
  { n: 3, icon: Sparkles, title: 'Gabon Insight structure le projet', desc: 'Business plan, plan d\'action, documents et analyse générés avec l\'IA.' },
  { n: 4, icon: FileCheck, title: 'Un dossier mûr est soumis', desc: 'Dossier complet, scoré et préqualifié transmis à la BCEG.' },
  { n: 5, icon: Building2, title: 'La BCEG instruit et finance', desc: 'Le gestionnaire reçoit une fiche consolidée : score, risque, formation, documents.' },
  { n: 6, icon: TrendingUp, title: 'Financement + croissance', desc: 'Le projet est financé ; l\'entrepreneur se développe et rembourse.' },
]

const PACKS = [
  { name: 'Pilote BCEG', goal: 'Démontrer la valeur sur un groupe limité.', items: ['100 à 300 bénéficiaires', '3 parcours de formation', 'Outils IA activés', 'Business plan & plan d\'action', 'Rapport de fin de pilote'] },
  { name: 'Déploiement institutionnel', goal: 'Faire du programme un outil officiel BCEG.', featured: true, items: ['Plateforme en marque BCEG', 'Back-office gestionnaires', 'BCEG Score™ intégrant la formation', 'Intégration app BCEG', 'Modules sectoriels', 'Campagne de communication'] },
  { name: 'Programme national', goal: 'Toucher plusieurs provinces et secteurs.', items: ['Déploiement multi-agences', 'Suivi par province', 'Rapports d\'impact', 'Modules agriculture, commerce, services', 'Partenaires & mentors', 'Support continu'] },
]

export default function ProgrammeBcegPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* HERO */}
      <section className="relative overflow-hidden text-white">
        <video src="/covers/formations/hero.mp4" autoPlay muted loop playsInline preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#4d553e]/90 via-[#697357]/85 to-[#3a4030]/95 pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <span className="inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-xs font-bold mb-4">
            <Megaphone className="w-4 h-4 text-amber-200" /> Programme Entrepreneur BCEG × Gabon Insight
          </span>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight max-w-3xl mx-auto">
            La BCEG ne finance plus seulement des projets : elle les <span className="text-amber-300">prépare, forme et score</span>.
          </h1>
          <p className="mt-4 text-white/85 text-lg max-w-2xl mx-auto">
            Formez-vous, structurez votre projet avec l'IA, obtenez votre BCEG Score™ et soumettez un dossier prêt à être financé.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/formations?src=programme-bceg"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-300 text-[#3a4030] font-bold hover:bg-amber-200 transition-colors shadow-lg">
              <GraduationCap className="w-5 h-5" /> Candidater au programme
            </Link>
            <Link href="/business/mes-projets"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/15 backdrop-blur font-semibold hover:bg-white/25 transition-colors">
              Découvrir les outils IA <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CERCLE VERTUEUX */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center">Un cercle vertueux</h2>
        <p className="text-slate-500 text-center mt-2 max-w-2xl mx-auto">La banque investit dans la montée en compétence des porteurs de projet pour recevoir de meilleurs dossiers.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {CYCLE.map(({ n, icon: Icon, title, desc }) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-9 h-9 rounded-xl bg-[#697357] text-white font-bold flex items-center justify-center">{n}</span>
                <Icon className="w-5 h-5 text-[#697357]" />
              </div>
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-600 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PACKS */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 text-center">Packs de déploiement</h2>
          <p className="text-slate-500 text-center mt-2">Du pilote au programme national.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
            {PACKS.map(p => (
              <div key={p.name} className={`rounded-2xl border p-6 flex flex-col ${p.featured ? 'border-[#697357] ring-2 ring-[#697357]/20 shadow-lg' : 'border-slate-200 shadow-sm'}`}>
                {p.featured && <span className="self-start mb-2 text-[10px] font-bold uppercase tracking-wide bg-[#697357] text-white px-2 py-0.5 rounded-full">Recommandé</span>}
                <h3 className="text-lg font-black text-slate-900">{p.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{p.goal}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-[#697357] shrink-0 mt-0.5" /><span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">Tarification et périmètre adaptés après cadrage avec la BCEG.</p>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Prêt à préparer votre financement ?</h2>
        <p className="text-slate-600 mt-2">Rejoignez le programme : formez-vous, structurez votre projet et faites monter votre BCEG Score™.</p>
        <Link href="/formations?src=programme-bceg"
          className="mt-6 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#697357] hover:bg-[#4d553e] text-white font-bold transition-colors">
          Candidater maintenant <ArrowRight className="w-5 h-5" />
        </Link>
      </section>
    </div>
  )
}
