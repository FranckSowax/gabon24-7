'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  FileText, Briefcase, MessageSquare, Target, Users, ArrowRight,
  Sparkles, Award, CheckCircle2
} from 'lucide-react'

interface Module {
  id: string
  title: string
  icon: any
  description: string
  bullets: string[]
  example: string
  cta: string
  primary?: boolean
}

const MODULES: Module[] = [
  {
    id: 'actions',
    title: 'Outils IA',
    icon: Sparkles,
    description:
      "Toutes les générations propulsées par l'IA pour structurer et muscler votre projet.",
    bullets: [
      'Business Plan en 10 sections (étude de marché, finances, etc.)',
      "Plan d'action 10 étapes avec budget et KPIs",
      'Test de compétences, formation sur mesure, courriers, SWOT',
    ],
    example: "Ex : générez en 2 min le business plan complet de votre élevage avicole.",
    cta: 'Lancer une génération IA',
    primary: true,
  },
  {
    id: 'contexte',
    title: 'Mes Documents',
    icon: FileText,
    description:
      'Centralisez le contexte de votre projet : pièces, notes personnelles, historique des actions.',
    bullets: [
      'Bibliothèque de documents (uploadés et générés)',
      'Notes libres pour capturer vos idées',
      'Timeline complète des événements du projet',
    ],
    example: "Ex : stockez le devis du fournisseur et gardez toutes vos notes au même endroit.",
    cta: 'Ouvrir mes documents',
  },
  {
    id: 'plan-action',
    title: "Plan d'Action",
    icon: Briefcase,
    description:
      'La roadmap concrète de votre projet en 10 étapes — suivez votre avancement étape par étape.',
    bullets: [
      'Liste des actions à réaliser par phase',
      'Échéances, budget et indicateurs de succès',
      "Mise à jour automatique au fil de l'avancement",
    ],
    example: "Ex : à la semaine 4 vous devez réserver le local — tout est planifié.",
    cta: "Voir mon plan d'action",
  },
  {
    id: 'conseiller',
    title: 'Conseiller IA',
    icon: MessageSquare,
    description:
      'Assistant intelligent qui connaît votre projet et répond à toutes vos questions stratégiques.',
    bullets: [
      'Conseils personnalisés selon votre secteur',
      'Conversation contextuelle avec mémoire',
      'Suggestions de prochaines actions',
    ],
    example: "Ex : « Combien facturer ma pizza pour atteindre la rentabilité ? » → réponse en 10 sec.",
    cta: 'Discuter avec le conseiller',
  },
  {
    id: 'overview',
    title: 'Détails du projet',
    icon: Target,
    description:
      'Toutes les informations complètes sur votre projet — proposition, problématique, contexte business.',
    bullets: [
      'Pitch et description complète',
      'Cible, modèle de revenus, taille équipe',
      'Caractéristiques techniques et marché',
    ],
    example: "Ex : relisez à tête reposée la promesse et le pitch que vous avez construits.",
    cta: 'Voir les détails',
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    icon: Users,
    description:
      'Invitez des co-fondateurs, mentors ou consultants à rejoindre votre projet en lecture ou édition.',
    bullets: [
      "Lien d'invitation par e-mail",
      'Niveaux de permission par membre',
      'Partage sécurisé du contexte projet',
    ],
    example: "Ex : invitez votre associé Boris pour qu'il édite la section finance.",
    cta: 'Inviter des collaborateurs',
  },
]

interface BcegToolsMenuProps {
  actions?: any[]
  documents?: any[]
  notes?: any[]
  onNavigateSection?: (section: string) => void
}

export default function BcegToolsMenu({
  actions = [],
  documents = [],
  notes = [],
  onNavigateSection,
}: BcegToolsMenuProps) {

  const hasActionPlan = actions.some(a => a.action_type === 'action-plan')
  const docsCount = documents.length
  const notesCount = notes.length

  const usageHint = (moduleId: string): string | null => {
    if (moduleId === 'actions') {
      const count = actions.length
      return count > 0 ? `${count} génération${count > 1 ? 's' : ''}` : null
    }
    if (moduleId === 'contexte') {
      const total = docsCount + notesCount
      return total > 0 ? `${docsCount} doc${docsCount > 1 ? 's' : ''} · ${notesCount} note${notesCount > 1 ? 's' : ''}` : null
    }
    if (moduleId === 'plan-action') return hasActionPlan ? 'Plan généré ✓' : null
    return null
  }

  return (
    <div className="space-y-6">

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-[#697357]/10 border border-[#697357]/20 text-[#697357] text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Boîte à outils projet</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          Tous les modules pour développer votre projet
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
          Choisissez le module qui correspond à votre besoin du moment.
          Vous pouvez revenir ici à tout moment depuis votre tableau de bord.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map((mod, i) => {
          const Icon = mod.icon
          const hint = usageHint(mod.id)

          return (
            <motion.button
              key={mod.id}
              onClick={() => onNavigateSection?.(mod.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, type: 'spring', stiffness: 100 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.99 }}
              className={`group relative overflow-hidden rounded-2xl text-left p-6 transition-all ${
                mod.primary
                  ? 'bg-gradient-to-br from-[#697357] to-[#4d553e] text-white shadow-xl shadow-[#697357]/30 hover:shadow-2xl'
                  : 'bg-white border border-slate-200 hover:border-[#697357]/40 shadow-md hover:shadow-xl'
              }`}
            >
              {mod.primary && (
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl" />
              )}

              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ring-1 ${
                    mod.primary
                      ? 'bg-white/15 backdrop-blur text-amber-200 ring-white/20'
                      : 'bg-[#697357]/10 text-[#697357] ring-[#697357]/20'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  {hint && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      mod.primary
                        ? 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/30'
                        : 'bg-[#697357]/10 text-[#697357]'
                    }`}>
                      {hint}
                    </span>
                  )}
                </div>

                <h3 className={`text-lg font-bold mb-1.5 ${mod.primary ? 'text-white' : 'text-slate-900'}`}>
                  {mod.title}
                </h3>
                <p className={`text-sm leading-relaxed mb-4 ${mod.primary ? 'opacity-85' : 'text-slate-600'}`}>
                  {mod.description}
                </p>

                <ul className={`space-y-1.5 text-xs mb-4 ${mod.primary ? 'opacity-90' : 'text-slate-700'}`}>
                  {mod.bullets.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        mod.primary ? 'text-amber-200' : 'text-[#697357]'
                      }`} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className={`text-[11px] italic leading-relaxed rounded-lg px-3 py-2 mb-4 ${
                  mod.primary
                    ? 'bg-white/10 text-amber-50 border border-white/15'
                    : 'bg-amber-50/70 text-amber-900 border border-amber-200/70'
                }`}>
                  {mod.example}
                </div>

                <div className={`flex items-center justify-between pt-4 border-t ${
                  mod.primary ? 'border-white/15' : 'border-slate-100'
                }`}>
                  <span className={`text-sm font-bold ${mod.primary ? 'text-white' : 'text-[#697357]'}`}>
                    {mod.cta}
                  </span>
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center transition-all group-hover:translate-x-0.5 ${
                    mod.primary
                      ? 'bg-white/15 backdrop-blur text-white group-hover:bg-amber-300 group-hover:text-[#4d553e]'
                      : 'bg-[#697357] text-white group-hover:bg-[#4d553e]'
                  }`}>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 max-w-3xl mx-auto">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
          <Award className="w-4 h-4" />
        </div>
        <div className="flex-1 text-sm text-amber-900">
          <div className="font-bold mb-0.5">💡 Astuce BCEG</div>
          <div className="opacity-90">
            Plus vous remplissez votre projet via ces outils, plus votre <b>BCEG Score™</b> augmente
            et plus vos chances d'obtenir un financement à 5 % s'améliorent.
          </div>
        </div>
      </div>
    </div>
  )
}
