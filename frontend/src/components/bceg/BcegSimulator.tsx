'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, User, Wallet, Calendar, Percent, TrendingDown, TrendingUp, Loader2 } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface BcegSimulationResult {
  principal: number
  mensualite: number
  total_a_rembourser: number
  cout_credit: number
  apport_pct: number
  capacite_remboursement_ok: boolean | null
  taux_effectif_global_estime: number
  simulation_id?: string
}

interface BcegSimulatorProps {
  initialMontant?: number
  initialApportPct?: number
  initialDureeMois?: number
  initialType?: 'particulier' | 'entreprise'
  initialRevenuMensuel?: number
  projectId?: string | null
  persist?: boolean
  onResult?: (r: BcegSimulationResult, params: SimParams) => void
  compact?: boolean
}

interface SimParams {
  type: 'particulier' | 'entreprise'
  revenu_mensuel?: number
  montant_demande: number
  apport_personnel: number
  duree_mois: number
  taux_annuel: number
}

function formatXaf(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' XAF'
}

export default function BcegSimulator({
  initialMontant = 5_000_000,
  initialApportPct = 20,
  initialDureeMois = 24,
  initialType = 'particulier',
  initialRevenuMensuel,
  projectId = null,
  persist = false,
  onResult,
  compact = false,
}: BcegSimulatorProps) {
  const [type, setType] = useState<'particulier' | 'entreprise'>(initialType)
  const [revenuMensuel, setRevenuMensuel] = useState<number | undefined>(initialRevenuMensuel)
  const [montant, setMontant] = useState(initialMontant)
  const [apportPct, setApportPct] = useState(initialApportPct)
  const [dureeMois, setDureeMois] = useState(initialDureeMois)
  const [tauxAnnuel] = useState(5.0) // taux subventionné BCEG figé Phase 2

  const [result, setResult] = useState<BcegSimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const apport = useMemo(() => Math.round((montant * apportPct) / 100), [montant, apportPct])

  // Debounce + fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true)
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        try {
          const { supabase } = await import('@/lib/auth')
          const { data } = await supabase.auth.getSession()
          const token = data.session?.access_token
          if (token) headers['Authorization'] = `Bearer ${token}`
        } catch {}

        const params: SimParams = {
          type,
          revenu_mensuel: revenuMensuel,
          montant_demande: montant,
          apport_personnel: apport,
          duree_mois: dureeMois,
          taux_annuel: tauxAnnuel,
        }

        const res = await fetch(`${API}/api/bceg/simulate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...params, project_id: projectId, persist }),
        })
        const json = await res.json()
        if (json.success && json.simulation) {
          setResult(json.simulation)
          onResult?.(json.simulation, params)
        }
      } catch {
        // silencieux : on garde le précédent résultat
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, revenuMensuel, montant, apportPct, dureeMois, tauxAnnuel])

  const capaciteOk = result?.capacite_remboursement_ok
  const showCapacite = revenuMensuel !== undefined && revenuMensuel > 0

  return (
    <div className={`bg-white border border-slate-200 rounded-2xl ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-amber-300" />
          <h3 className="font-bold text-slate-900 text-base sm:text-lg">Simulateur crédit BCEG</h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <Percent className="w-3 h-3" />
          Taux subventionné {tauxAnnuel} %
        </div>
      </div>

      {/* Toggle type */}
      <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setType('particulier')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            type === 'particulier' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <User className="w-4 h-4" />
          Particulier
        </button>
        <button
          type="button"
          onClick={() => setType('entreprise')}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
            type === 'entreprise' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Entreprise
        </button>
      </div>

      {/* Sliders */}
      <div className="space-y-4 mb-4">
        <SliderRow
          label="Montant à emprunter"
          value={montant}
          min={500_000}
          max={100_000_000}
          step={500_000}
          onChange={setMontant}
          format={formatXaf}
        />
        <SliderRow
          label="Apport personnel"
          value={apportPct}
          min={0}
          max={70}
          step={5}
          onChange={setApportPct}
          format={(v) => `${v} % (${formatXaf((montant * v) / 100)})`}
          hint={apportPct < 20 ? '⚠️ BCEG recommande au moins 20 %' : apportPct >= 40 ? '✨ Excellent !' : ''}
        />
        <SliderRow
          label="Durée"
          value={dureeMois}
          min={6}
          max={84}
          step={6}
          onChange={setDureeMois}
          format={(v) => `${v} mois (${(v / 12).toFixed(1)} ans)`}
        />
        {type === 'particulier' && (
          <div>
            <label className="flex items-center gap-2 text-xs text-slate-600 mb-1">
              <TrendingUp className="w-3.5 h-3.5" /> Revenu mensuel net (optionnel)
            </label>
            <input
              type="number"
              placeholder="Ex: 800000"
              value={revenuMensuel ?? ''}
              onChange={(e) => setRevenuMensuel(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-amber-400/50"
            />
          </div>
        )}
      </div>

      {/* Résultat live */}
      <div className="border-t border-slate-200 pt-4">
        {loading && !result ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Calcul…
          </div>
        ) : result ? (
          <div className="grid grid-cols-2 gap-3">
            <ResultCard
              label="Mensualité"
              value={formatXaf(result.mensualite)}
              accent
            />
            <ResultCard
              label="Coût total du crédit"
              value={formatXaf(result.cout_credit)}
              icon={<TrendingDown className="w-3.5 h-3.5" />}
            />
            <ResultCard
              label="Total à rembourser"
              value={formatXaf(result.total_a_rembourser)}
            />
            <ResultCard
              label="Capital emprunté"
              value={formatXaf(result.principal)}
              icon={<Calendar className="w-3.5 h-3.5" />}
            />
            {showCapacite && (
              <div className={`col-span-2 rounded-lg px-3 py-2 text-xs font-medium ${
                capaciteOk ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}>
                {capaciteOk
                  ? '✅ Mensualité < 33 % du revenu — capacité de remboursement OK'
                  : '⚠️ Mensualité > 33 % du revenu — risque d\'endettement excessif'}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[10px] text-slate-400 text-center">
        Simulation indicative — le taux définitif est validé par la BCEG.
      </p>
    </div>
  )
}

// ---------- subcomponents ----------

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
  hint?: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-600">{label}</label>
        <span className="text-xs font-semibold text-amber-700 tabular-nums">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-400 cursor-pointer"
      />
      {hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}
    </div>
  )
}

function ResultCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  accent?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0.6, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-lg px-3 py-2.5 ${
        accent
          ? 'bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300'
          : 'bg-slate-50 border border-slate-200'
      }`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
        {icon}
        {label}
      </div>
      <div className={`font-bold tabular-nums ${accent ? 'text-amber-700 text-base sm:text-lg' : 'text-slate-900 text-sm'}`}>
        {value}
      </div>
    </motion.div>
  )
}
