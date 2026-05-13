'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, PlusCircle, FolderOpen } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import BcegBackdrop from '@/components/bceg/BcegBackdrop'
import { BCEG_LOGO, bcegClasses } from '@/components/bceg/BcegTheme'

type StartOption = {
  id: number
  href: string
  label: string
  title: string
  description: string
  highlight: string
  icon: React.ReactNode
  badge: string
}

const options: StartOption[] = [
  {
    id: 1,
    href: '/business/analyzer',
    label: 'Option 1',
    title: 'Analyser un article',
    description: "Notre IA détecte des opportunités de business local dans l'actualité gabonaise.",
    highlight: "Idéal si tu cherches l'inspiration",
    icon: <Sparkles className="w-6 h-6" />,
    badge: 'IA',
  },
  {
    id: 2,
    href: '/business/creer-projet',
    label: 'Option 2',
    title: 'Démarrer à zéro',
    description: 'Tu as déjà une idée ? Construis ton projet étape par étape avec le wizard guidé.',
    highlight: 'Si tu sais déjà quoi entreprendre',
    icon: <PlusCircle className="w-6 h-6" />,
    badge: 'Nouveau',
  },
  {
    id: 3,
    href: '/business/mes-projets',
    label: 'Option 3',
    title: 'Mes projets',
    description: 'Reprends un projet existant, consulte son BCEG Score™ et finalise son dossier.',
    highlight: "Continuer où tu t'es arrêté",
    icon: <FolderOpen className="w-6 h-6" />,
    badge: 'En cours',
  },
]

export default function BcegProjectPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen relative">
      <BcegBackdrop opacity={0.5} />

      <div className="relative z-10">
        <Header onMobileMenuToggle={() => setIsSidebarOpen(true)} />

        <div className="flex">
          <Sidebar
            isMobileOpen={isSidebarOpen}
            onMobileClose={() => setIsSidebarOpen(false)}
          />

          <div className="flex-1 lg:ml-64 lg:mr-80 min-w-0">
            <main className="w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14 max-w-5xl mx-auto">

              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-10 sm:mb-14"
              >
                <div className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/85 backdrop-blur border border-[#697357]/20 shadow-sm text-slate-700 text-xs sm:text-sm mb-5">
                  <img
                    src={BCEG_LOGO}
                    alt="Logo BCEG"
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-[#697357]/40"
                  />
                  <span>
                    En partenariat avec la <span className="font-semibold text-[#697357]">BCEG</span>
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 leading-tight">
                  <span className="text-slate-900">BCEG </span>
                  <span className={bcegClasses.titleGradient}>Project</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-700 max-w-2xl mx-auto">
                  Comment veux-tu démarrer ton projet ?
                </p>
              </motion.section>

              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-5"
              >
                {options.map((opt, i) => (
                  <motion.a
                    key={opt.id}
                    href={opt.href}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.1, type: 'spring', stiffness: 100 }}
                    whileHover={{ y: -4 }}
                    className="group relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 hover:border-[#697357]/40 shadow-sm hover:shadow-2xl transition-all duration-300"
                  >
                    <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[#697357] opacity-0 group-hover:opacity-15 blur-3xl transition-opacity duration-500" />

                    <div className="h-1 w-full bg-gradient-to-r from-[#697357] via-[#8a9576] to-[#697357]" />

                    <div className="p-6 relative">
                      <div className="flex items-start justify-between mb-5">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#697357] to-[#4d553e] ring-4 ring-[#697357]/20 flex items-center justify-center text-white shadow-lg shadow-[#697357]/20">
                          {opt.icon}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            {opt.label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white bg-[#697357]">
                            {opt.badge}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-[#697357] mb-2">{opt.title}</h3>

                      <p className="text-sm text-slate-700 leading-relaxed mb-4 min-h-[60px]">
                        {opt.description}
                      </p>

                      <div className="text-xs text-slate-500 italic mb-5">
                        💡 {opt.highlight}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <span className="text-sm font-semibold text-[#697357]">
                          C'est parti
                        </span>
                        <span className="w-9 h-9 rounded-full bg-[#697357] group-hover:bg-[#4d553e] flex items-center justify-center text-white transition-all duration-300 group-hover:translate-x-1">
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </motion.a>
                ))}
              </motion.section>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-center mt-10 text-xs sm:text-sm text-slate-600"
              >
                Crédits BCEG dès <span className="font-semibold text-[#697357]">5 %</span> ·
                Programmes CATR &amp; FAMAD · Présent dans les 9 provinces du Gabon
              </motion.div>

            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
