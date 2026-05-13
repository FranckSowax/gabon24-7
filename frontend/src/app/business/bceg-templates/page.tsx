'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, X, ArrowRight, Loader2, Sparkles, AlertCircle, Building2, ArrowLeft
} from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Template {
  id: string
  slug: string
  title: string
  emoji: string
  sector: string
  short_pitch: string
  estimated_budget_min: number | null
  estimated_budget_max: number | null
  estimated_monthly_revenue_min: number | null
  estimated_monthly_revenue_max: number | null
  rentability_pct: number | null
  difficulty_level: number | null
  duration_months: number | null
  required_skills: string[] | null
  immediate_actions: any[] | null
  competitive_advantages: any[] | null
  risks: any[] | null
  recommended_apport_pct: number | null
  usage_count: number
}

function formatXafShort(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} M XAF`
  return new Intl.NumberFormat('fr-FR').format(n) + ' XAF'
}

function Difficulty({ level }: { level: number | null }) {
  if (!level) return null
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={`w-1.5 h-3 rounded-sm ${i <= level ? 'bg-amber-400' : 'bg-white/15'}`} />
      ))}
    </div>
  )
}

export default function BcegTemplatesPage() {
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sectorFilter, setSectorFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Template | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`${API}/api/bceg/templates`)
      .then(r => r.json())
      .then(json => {
        if (alive && json?.success) setTemplates(json.templates || [])
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const sectors = useMemo(() => {
    const set = new Set<string>()
    templates.forEach(t => t.sector && set.add(t.sector))
    return Array.from(set).sort()
  }, [templates])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(t => {
      if (sectorFilter !== 'all' && t.sector !== sectorFilter) return false
      if (q && !`${t.title} ${t.sector} ${t.short_pitch}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [templates, search, sectorFilter])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />

      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full px-3 sm:px-4 lg:px-8 py-5 sm:py-7">

            <button
              onClick={() => router.push('/business/live-opportunities')}
              className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>

            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs mb-2">
                <Building2 className="w-3 h-3" /> Bibliothèque BCEG
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1">Templates business <span className="text-amber-300">prêts à financer</span></h1>
              <p className="text-sm text-white/60">8 projets pré-validés par la BCEG, avec budget, rentabilité, plan d'action et risques. Choisis-en un pour démarrer le tien.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-5">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-white/40" />
                <input
                  type="text"
                  placeholder="Rechercher (boulangerie, taxi, e-commerce…)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/15 rounded-lg text-sm placeholder-white/40 focus:outline-none focus:border-amber-400/50"
                />
              </div>
              <select
                value={sectorFilter}
                onChange={e => setSectorFilter(e.target.value)}
                className="px-3 py-2.5 bg-white/5 border border-white/15 rounded-lg text-sm focus:outline-none focus:border-amber-400/50"
              >
                <option value="all">Tous secteurs ({templates.length})</option>
                {sectors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-white/60 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl py-12 text-center text-white/60">
                Aucun template ne correspond à ta recherche
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(t => (
                  <motion.button
                    key={t.id}
                    whileHover={{ y: -3 }}
                    onClick={() => setSelected(t)}
                    className="text-left bg-white/5 hover:bg-white/8 border border-white/10 hover:border-amber-400/30 rounded-2xl p-5 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-4xl">{t.emoji}</div>
                      <Difficulty level={t.difficulty_level} />
                    </div>
                    <h3 className="text-lg font-bold mb-1">{t.title}</h3>
                    <div className="inline-block text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 mb-3">{t.sector}</div>
                    <p className="text-sm text-white/70 line-clamp-3 mb-4">{t.short_pitch}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-white/50">Budget</div>
                        <div className="text-amber-300 font-semibold">{formatXafShort(t.estimated_budget_min)} – {formatXafShort(t.estimated_budget_max)}</div>
                      </div>
                      <div>
                        <div className="text-white/50">Rentabilité</div>
                        <div className="text-emerald-300 font-semibold">{t.rentability_pct ? `${t.rentability_pct} %` : '—'}</div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <TemplateDetailModal template={selected} onClose={() => setSelected(null)} onUse={() => router.push(`/business/creer-projet?template=${selected.slug}`)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function TemplateDetailModal({ template, onClose, onUse }: { template: Template; onClose: () => void; onUse: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="max-w-3xl mx-auto my-8 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl text-white"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5">
          <div>
            <div className="text-5xl mb-2">{template.emoji}</div>
            <h2 className="text-2xl font-bold">{template.title}</h2>
            <div className="text-sm text-white/60 mt-1">{template.sector}</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-white/85 leading-relaxed">{template.short_pitch}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KV icon="💰" label="Budget" value={`${formatXafShort(template.estimated_budget_min)} – ${formatXafShort(template.estimated_budget_max)}`} />
            <KV icon="📈" label="Revenus/mois" value={`${formatXafShort(template.estimated_monthly_revenue_min)} – ${formatXafShort(template.estimated_monthly_revenue_max)}`} />
            <KV icon="🎯" label="Rentabilité" value={template.rentability_pct ? `${template.rentability_pct} %` : '—'} accent="emerald" />
            <KV icon="⏱️" label="Durée" value={template.duration_months ? `${template.duration_months} mois` : '—'} />
          </div>

          {template.immediate_actions && template.immediate_actions.length > 0 && (
            <Section title="Actions immédiates" icon="🚀">
              <ol className="space-y-1.5">
                {template.immediate_actions.map((a, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-amber-300 font-bold flex-shrink-0">{i + 1}.</span>
                    <span className="text-white/85">{typeof a === 'string' ? a : (a.titre || a.action || JSON.stringify(a))}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {template.competitive_advantages && template.competitive_advantages.length > 0 && (
            <Section title="Avantages concurrentiels" icon="⭐">
              <ul className="space-y-1">
                {template.competitive_advantages.map((a, i) => (
                  <li key={i} className="text-sm flex gap-2"><span className="text-emerald-300">✓</span><span className="text-white/85">{typeof a === 'string' ? a : (a.titre || JSON.stringify(a))}</span></li>
                ))}
              </ul>
            </Section>
          )}

          {template.risks && template.risks.length > 0 && (
            <Section title="Risques à anticiper" icon="⚠️">
              <ul className="space-y-1">
                {template.risks.map((r, i) => (
                  <li key={i} className="text-sm flex gap-2"><AlertCircle className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" /><span className="text-white/85">{typeof r === 'string' ? r : (r.titre || JSON.stringify(r))}</span></li>
                ))}
              </ul>
            </Section>
          )}

          {template.required_skills && template.required_skills.length > 0 && (
            <Section title="Compétences requises" icon="🛠️">
              <div className="flex flex-wrap gap-1.5">
                {template.required_skills.map((s, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-white/10 border border-white/15 rounded-full text-white/80">{s}</span>
                ))}
              </div>
            </Section>
          )}

          <div className="bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-300/30 rounded-xl p-4 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium">Apport personnel BCEG recommandé : <span className="text-amber-200 font-bold">{template.recommended_apport_pct}%</span></div>
              <div className="text-xs text-white/60 mt-0.5">Ce template est éligible au taux subventionné BCEG (5 %).</div>
            </div>
          </div>

          <button
            onClick={onUse}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-amber-300 to-orange-400 hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-amber-500/20"
          >
            <Sparkles className="w-4 h-4" /> Utiliser ce template <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function KV({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: 'emerald' }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-white/50 flex items-center gap-1">{icon} {label}</div>
      <div className={`text-xs font-bold mt-1 tabular-nums ${accent === 'emerald' ? 'text-emerald-300' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  )
}
