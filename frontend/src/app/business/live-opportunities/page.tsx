'use client'

import React, { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { ArrowRight, Building2, Sparkles, TrendingUp, Award } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

type Level = {
  id: number
  emoji: string
  title: string
  pitch: string
  badge: string
  accent: string
}

const levels: Level[] = [
  { id: 1, emoji: '🔍', title: 'Découvrir', pitch: 'Lis un article → l\'IA détecte 3 secteurs porteurs', badge: 'Explorateur', accent: 'from-blue-500 to-cyan-500' },
  { id: 2, emoji: '💡', title: 'Idéer', pitch: 'Choisis 1 idée → pitch + cible + revenus générés', badge: 'Visionnaire', accent: 'from-purple-500 to-fuchsia-500' },
  { id: 3, emoji: '🛠️', title: 'Structurer', pitch: 'Plan d\'action 10 étapes + budget + KPIs', badge: 'Bâtisseur', accent: 'from-amber-500 to-orange-500' },
  { id: 4, emoji: '📊', title: 'Simuler BCEG', pitch: 'Le budget devient un crédit BCEG simulé en temps réel', badge: 'Stratège', accent: 'from-emerald-500 to-teal-500' },
  { id: 5, emoji: '🚀', title: 'Soumettre BCEG', pitch: 'Dossier complet généré → envoyé à BCEG en 1 clic', badge: 'Entrepreneur BCEG', accent: 'from-rose-500 to-red-500' },
]

// Compteur animé (mock data Phase 1 — à brancher sur Supabase en Phase 2)
function StatCounter({ value, decimals = 0, suffix = '', label, icon }: { value: number; decimals?: number; suffix?: string; label: string; icon: React.ReactNode }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString('fr-FR'))
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 2, ease: 'easeOut' })
    return ctrl.stop
  }, [value, mv])
  return (
    <div className="flex flex-col items-center gap-1 px-4">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <motion.span className="text-2xl sm:text-3xl font-bold tabular-nums">{rounded}</motion.span>
        {suffix && <span className="text-xl sm:text-2xl font-bold">{suffix}</span>}
      </div>
      <span className="text-xs sm:text-sm text-white/70 text-center">{label}</span>
    </div>
  )
}

export default function BcegProjectPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen relative">
      {/* Background image */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('/imgi_5_back3.png')` }}
        aria-hidden="true"
      />
      {/* Overlay sombre pour lisibilité */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/90" aria-hidden="true" />

      {/* Contenu */}
      <div className="relative z-10">
        <Header onMobileMenuToggle={() => setIsSidebarOpen(true)} />

        <div className="flex">
          <Sidebar
            isMobileOpen={isSidebarOpen}
            onMobileClose={() => setIsSidebarOpen(false)}
          />

          <div className="flex-1 lg:ml-64 lg:mr-80 min-w-0">
            <main className="w-full px-3 sm:px-4 lg:px-8 py-6 sm:py-10 lg:py-12">

              {/* Hero */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-10 sm:mb-14"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white/90 text-xs sm:text-sm mb-5">
                  <Building2 className="w-4 h-4" />
                  <span>En partenariat avec la BCEG — Banque pour le Commerce et l'Entrepreneuriat du Gabon</span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-tight">
                  BCEG <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-300 bg-clip-text text-transparent">Project</span>
                </h1>

                <p className="text-base sm:text-lg lg:text-2xl text-white/85 max-w-3xl mx-auto px-4 mb-6">
                  Du projet à un <span className="font-semibold text-amber-300">financement BCEG</span> en{' '}
                  <span className="font-semibold text-amber-300">5 étapes</span>.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-4">
                  <button
                    onClick={() => window.location.href = '/business/analyzer'}
                    className="group inline-flex items-center justify-center w-full sm:w-auto px-7 py-3.5 text-base sm:text-lg font-semibold text-slate-950 bg-gradient-to-r from-amber-300 to-orange-400 rounded-xl hover:from-amber-400 hover:to-orange-500 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-amber-500/20"
                  >
                    <Sparkles className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                    Démarrer mon projet
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <a
                    href="/business/mes-projets"
                    className="inline-flex items-center justify-center w-full sm:w-auto px-7 py-3.5 text-base sm:text-lg font-medium text-white bg-white/10 hover:bg-white/15 backdrop-blur border border-white/20 rounded-xl transition-colors"
                  >
                    Mes projets
                  </a>
                </div>
              </motion.section>

              {/* Stats compteurs */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-12 sm:mb-16"
              >
                <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 py-5 sm:py-6 px-4 flex flex-wrap items-center justify-around gap-y-4 divide-x divide-white/10">
                  <StatCounter value={1247} label="projets ficelés" icon={<Sparkles className="w-5 h-5 text-amber-300" />} />
                  <StatCounter value={38} label="dossiers BCEG acceptés" icon={<Award className="w-5 h-5 text-emerald-300" />} />
                  <StatCounter value={12.4} decimals={1} suffix=" Mrd FCFA" label="financés cette année" icon={<TrendingUp className="w-5 h-5 text-orange-300" />} />
                </div>
              </motion.section>

              {/* 5 Levels — parcours gamifié */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-12"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
                    Ton parcours en 5 niveaux
                  </h2>
                  <p className="text-white/70 text-sm sm:text-base">
                    Avance pas à pas, débloque un badge à chaque étape
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 max-w-6xl mx-auto">
                  {levels.map((lvl, i) => (
                    <motion.div
                      key={lvl.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      className="group relative overflow-hidden rounded-2xl p-5 bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all cursor-default"
                    >
                      {/* Accent gradient en background au hover */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-15 bg-gradient-to-br ${lvl.accent} transition-opacity duration-300`} />

                      <div className="relative">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-3xl sm:text-4xl">{lvl.emoji}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15">
                            Niveau {lvl.id}
                          </span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{lvl.title}</h3>
                        <p className="text-xs sm:text-sm text-white/70 mb-4 min-h-[40px]">
                          {lvl.pitch}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Award className="w-3.5 h-3.5 text-amber-300" />
                          <span className="text-amber-200/90">Badge "{lvl.badge}"</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>

              {/* Pourquoi BCEG ? */}
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="max-w-5xl mx-auto mb-10"
              >
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-300/15 rounded-2xl p-6 sm:p-8 backdrop-blur">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-6 h-6 text-amber-300" />
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Pourquoi BCEG ?</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm sm:text-base">
                    <div>
                      <div className="text-2xl mb-1">💰</div>
                      <div className="font-semibold text-white mb-1">Crédits dès 5 %</div>
                      <p className="text-white/70 text-sm">Taux subventionné via les programmes CATR et FAMAD pour entrepreneurs gabonais.</p>
                    </div>
                    <div>
                      <div className="text-2xl mb-1">🇬🇦</div>
                      <div className="font-semibold text-white mb-1">Banque locale</div>
                      <p className="text-white/70 text-sm">Présence dans les 9 provinces du Gabon, accompagnement de proximité.</p>
                    </div>
                    <div>
                      <div className="text-2xl mb-1">🤝</div>
                      <div className="font-semibold text-white mb-1">Dédiée PME</div>
                      <p className="text-white/70 text-sm">Premier acteur bancaire pour PME, PMI, professionnels et particuliers.</p>
                    </div>
                  </div>
                </div>
              </motion.section>

              {/* CTA bas */}
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.85 }}
                className="text-center pb-6"
              >
                <button
                  onClick={() => window.location.href = '/business/analyzer'}
                  className="group inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-white/10 hover:bg-white/15 backdrop-blur border border-white/20 rounded-xl transition-all"
                >
                  Lancer l'analyse IA d'un article
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.section>

            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
