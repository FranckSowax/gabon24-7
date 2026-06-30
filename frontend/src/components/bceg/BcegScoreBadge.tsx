'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Info, Award } from 'lucide-react'

export type BcegScoreColor = 'red' | 'orange' | 'green'

export interface BcegBreakdown {
  viabilite_financiere?: number
  secteur_prioritaire?: number
  capacite_remboursement?: number
  garanties_completude?: number
  // Volet formation (préqualification)
  formation?: {
    formation_modules?: number
    resultats_qcm?: number
    profil_complet?: number
  }
  project_score?: number
  formation_score?: number
}

interface BcegScoreBadgeProps {
  score: number               // 0-100
  color?: BcegScoreColor      // red | orange | green (auto-déduit si absent)
  breakdown?: BcegBreakdown
  advice?: Array<{ axis: string; tip: string }>
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showBreakdown?: boolean
  loading?: boolean
}

const COLOR_TOKENS: Record<BcegScoreColor, { ring: string; bg: string; text: string; pill: string; glow: string }> = {
  red:    { ring: '#ef4444', bg: 'rgba(239,68,68,0.12)',  text: 'text-red-400',    pill: 'bg-red-500/15 border-red-400/30 text-red-200',       glow: 'shadow-red-500/30' },
  orange: { ring: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: 'text-amber-300',  pill: 'bg-amber-500/15 border-amber-400/30 text-amber-200', glow: 'shadow-amber-500/30' },
  green:  { ring: '#10b981', bg: 'rgba(16,185,129,0.12)', text: 'text-emerald-300',pill: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200', glow: 'shadow-emerald-500/30' },
}

function autoColor(score: number): BcegScoreColor {
  if (score >= 70) return 'green'
  if (score >= 45) return 'orange'
  return 'red'
}

function ratingLabel(score: number): string {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Bon dossier'
  if (score >= 55) return 'À renforcer'
  if (score >= 40) return 'À retravailler'
  return 'À compléter'
}

export default function BcegScoreBadge({
  score,
  color,
  breakdown,
  advice,
  size = 'md',
  showLabel = true,
  showBreakdown = false,
  loading = false,
}: BcegScoreBadgeProps) {
  const c = COLOR_TOKENS[color || autoColor(score)]
  const dim = size === 'lg' ? 120 : size === 'sm' ? 56 : 88
  const stroke = size === 'lg' ? 10 : size === 'sm' ? 6 : 8
  const radius = (dim - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.max(0, Math.min(100, score)) / 100
  const dashOffset = circumference * (1 - pct)
  const fontScore = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl'

  return (
    <div className="inline-flex items-center gap-3">
      <div className={`relative shadow-lg ${c.glow}`} style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill={c.bg}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          <motion.circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={c.ring}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: loading ? circumference : dashOffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`${fontScore} font-extrabold ${c.text} tabular-nums leading-none`}>
            {loading ? '—' : Math.round(score)}
          </div>
          {size !== 'sm' && (
            <div className="text-[10px] uppercase tracking-wider text-white/60 mt-0.5">BCEG Score</div>
          )}
        </div>
      </div>

      {showLabel && (
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${c.pill}`}>
            <Award className="w-3 h-3" />
            {ratingLabel(score)}
          </div>
          {showBreakdown && breakdown && (
            <ul className="mt-2 space-y-0.5 text-[11px] text-white/70">
              {typeof breakdown.project_score === 'number' && typeof breakdown.formation_score === 'number' && (
                <li className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-white/10 text-white/80">
                  <span>Projet 60% · Formation 40%</span>
                  <span className="tabular-nums">{breakdown.project_score} · {breakdown.formation_score}</span>
                </li>
              )}
              <li className="text-white/50 uppercase tracking-wide text-[9px] pt-0.5">Projet</li>
              <BreakdownRow label="Viabilité financière" value={breakdown.viabilite_financiere} />
              <BreakdownRow label="Secteur prioritaire" value={breakdown.secteur_prioritaire} />
              <BreakdownRow label="Capacité de remb." value={breakdown.capacite_remboursement} />
              <BreakdownRow label="Complétude dossier" value={breakdown.garanties_completude} />
              {breakdown.formation && (
                <>
                  <li className="text-white/50 uppercase tracking-wide text-[9px] pt-1">Formation</li>
                  <BreakdownRow label="Modules validés" value={breakdown.formation.formation_modules} max={55} />
                  <BreakdownRow label="Résultats QCM" value={breakdown.formation.resultats_qcm} max={35} />
                  <BreakdownRow label="Profil complété" value={breakdown.formation.profil_complet} max={10} />
                </>
              )}
            </ul>
          )}
          {advice && advice.length > 0 && size === 'lg' && (
            <div className="mt-2 max-w-xs">
              {advice.slice(0, 2).map((a, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-white/75 mb-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0 text-white/50" />
                  <span><strong>{a.axis} :</strong> {a.tip}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BreakdownRow({ label, value = 0, max = 25 }: { label: string; value?: number; max?: number }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="truncate">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="w-12 h-1 rounded-full bg-white/10 overflow-hidden">
          <span className="block h-full bg-white/60" style={{ width: `${(value / max) * 100}%` }} />
        </span>
        <span className="tabular-nums text-white/80">{value}/{max}</span>
      </span>
    </li>
  )
}
