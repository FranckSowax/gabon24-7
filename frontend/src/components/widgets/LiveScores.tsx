'use client'

/**
 * Scores de football en direct : matchs internationaux et grands championnats
 * (Angleterre, France, Espagne, Italie, États-Unis, Arabie saoudite).
 * Les données viennent de notre serveur (GET /api/live-scores), jamais
 * directement de la source.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, History, Radio, RefreshCw } from 'lucide-react'

type Team = { name: string; code: string; logo: string | null }
type Match = {
  id: string
  competition: { key: string; name: string; international: boolean }
  kickoff: string
  status: 'live' | 'finished' | 'upcoming'
  label: string
  home: Team
  away: Team
  homeScore: number | null
  awayScore: number | null
  homePenalties: number | null
  awayPenalties: number | null
  homeScorers: string[]
  awayScorers: string[]
}
type Tab = 'results' | 'live' | 'upcoming'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const LIVE_REFRESH_MS = 30 * 1000
const IDLE_REFRESH_MS = 3 * 60 * 1000

export default function LiveScores({ className = '' }: { className?: string }) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [stale, setStale] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [tab, setTab] = useState<Tab>('live')

  const load = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/live-scores`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setMatches(Array.isArray(data.matches) ? data.matches : [])
      setStale(Boolean(data.stale))
      setFailed(false)
      setLastUpdate(new Date())
    } catch {
      // Les matchs déjà affichés restent à l'écran ; on signale seulement la panne.
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const live = useMemo(() => matches.filter((match) => match.status === 'live'), [matches])
  const hasLive = live.length > 0

  // Rafraîchissement : rapide pendant un match, lent sinon, à l'arrêt quand
  // l'onglet du navigateur n'est pas visible.
  useEffect(() => {
    load()
    const interval = setInterval(() => {
      if (!document.hidden) load()
    }, hasLive ? LIVE_REFRESH_MS : IDLE_REFRESH_MS)
    const onVisible = () => {
      if (!document.hidden) load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load, hasLive])

  const today = useMemo(() => {
    const key = dayKey(new Date())
    return matches.filter((match) => dayKey(new Date(match.kickoff)) === key)
  }, [matches])
  const upcoming = useMemo(
    () => matches.filter((match) => match.status === 'upcoming').sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    [matches]
  )
  const results = useMemo(
    () => matches.filter((match) => match.status === 'finished').sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
    [matches]
  )

  const visible = tab === 'live' ? (hasLive ? live : today) : tab === 'upcoming' ? upcoming : results
  const groups = useMemo(() => groupByCompetition(visible), [visible])

  const subtitle =
    tab === 'live'
      ? hasLive
        ? `${live.length} match${live.length > 1 ? 's' : ''} en direct`
        : today.length > 0
          ? 'Programme du jour'
          : 'Aucun match en direct'
      : tab === 'upcoming'
        ? 'Prochains matchs'
        : 'Derniers résultats'

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'results', label: 'Résultats', icon: <History size={14} aria-hidden="true" /> },
    { key: 'live', label: 'Direct', icon: <Radio size={14} aria-hidden="true" /> },
    { key: 'upcoming', label: 'À venir', icon: <CalendarClock size={14} aria-hidden="true" /> },
  ]

  return (
    <section
      aria-label="Scores de football en direct"
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      <div className="flex-shrink-0 bg-gray-900 text-white">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-base flex items-center gap-2 min-w-0">
              <span aria-hidden="true">⚽</span>
              <span className="truncate">Scores en direct</span>
            </h3>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              aria-label="Rafraîchir les scores"
              className="p-1.5 rounded-full hover:bg-white/15 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-white/75 mt-0.5" aria-live="polite">
            {subtitle}
            {lastUpdate && (
              <span className="ml-1.5 text-white/55">
                · {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div className="flex px-2 gap-1" role="tablist" aria-label="Période">
          {tabs.map((item) => {
            const selected = tab === item.key
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                  selected ? 'bg-white text-gray-900' : 'text-white/75 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.icon}
                {item.label}
                {item.key === 'live' && hasLive && (
                  <span className="px-1.5 rounded-full bg-red-600 text-white text-[10px] leading-4">{live.length}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[460px] p-3" role="tabpanel">
        {(failed || stale) && matches.length > 0 && (
          <p className="mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
            Mise à jour momentanément indisponible : scores possiblement en retard.
          </p>
        )}

        {loading && matches.length === 0 && (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && failed && matches.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-500">
            <p className="font-medium text-gray-700">Scores indisponibles pour le moment</p>
            <button type="button" onClick={load} className="mt-2 text-xs font-semibold text-emerald-700 hover:underline">
              Réessayer
            </button>
          </div>
        )}

        {!loading && !failed && visible.length === 0 && (
          <div className="text-center py-10 text-sm text-gray-500">
            <p className="font-medium text-gray-700">
              {tab === 'live' ? 'Aucun match en direct' : tab === 'upcoming' ? 'Aucun match à venir' : 'Aucun résultat récent'}
            </p>
            {tab === 'live' && upcoming.length > 0 && (
              <p className="text-xs mt-2">
                Prochain : {upcoming[0].home.name} – {upcoming[0].away.name}
                <br />
                {formatKickoff(upcoming[0].kickoff)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.key}>
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">{group.name}</h4>
              <ul className="space-y-1.5">
                {group.matches.map((match) => (
                  <MatchRow key={match.id} match={match} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function MatchRow({ match }: { match: Match }) {
  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'
  const home = match.homeScore ?? 0
  const away = match.awayScore ?? 0
  const homePens = match.homePenalties ?? 0
  const awayPens = match.awayPenalties ?? 0
  const homeWin = isFinished && (home > away || (home === away && homePens > awayPens))
  const awayWin = isFinished && (away > home || (home === away && awayPens > homePens))
  const scorers = [...match.homeScorers, ...match.awayScorers]

  return (
    <li className={`rounded-xl border px-2.5 py-2 ${isLive ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center justify-end mb-1">
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" aria-hidden="true" />
            {match.label || 'En direct'}
          </span>
        ) : isFinished ? (
          <span className="text-[10px] font-semibold text-gray-500">{match.label || 'Terminé'}</span>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-700">{formatKickoff(match.kickoff)}</span>
        )}
      </div>
      <TeamLine team={match.home} score={match.homeScore} penalties={match.homePenalties} win={homeWin} dim={awayWin} />
      <TeamLine team={match.away} score={match.awayScore} penalties={match.awayPenalties} win={awayWin} dim={homeWin} />
      {scorers.length > 0 && (
        <p className="mt-1 pt-1 border-t border-gray-200/70 text-[10px] text-gray-500 leading-snug">
          {scorers.join(' · ')}
        </p>
      )}
    </li>
  )
}

function TeamLine({ team, score, penalties, win, dim }: {
  team: Team
  score: number | null
  penalties: number | null
  win: boolean
  dim: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo team={team} />
        <span className={`text-sm truncate ${win ? 'font-bold text-gray-900' : dim ? 'text-gray-500' : 'font-medium text-gray-800'}`}>
          {team.name}
        </span>
      </div>
      <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${dim ? 'text-gray-500' : 'text-gray-900'}`}>
        {score !== null ? score : '–'}
        {penalties !== null && <span className="ml-1 text-[10px] font-semibold text-gray-500">({penalties})</span>}
      </span>
    </div>
  )
}

function TeamLogo({ team }: { team: Team }) {
  const [broken, setBroken] = useState(false)
  if (!team.logo || broken) {
    return (
      <span
        aria-hidden="true"
        className="w-5 h-5 rounded-full bg-gray-200 text-[8px] font-bold text-gray-600 flex items-center justify-center flex-shrink-0"
      >
        {(team.code || team.name).slice(0, 3).toUpperCase()}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.logo}
      alt=""
      width={20}
      height={20}
      loading="lazy"
      onError={() => setBroken(true)}
      className="w-5 h-5 object-contain flex-shrink-0"
    />
  )
}

// ---------- utilitaires ----------
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function groupByCompetition(list: Match[]): { key: string; name: string; matches: Match[] }[] {
  const groups = new Map<string, { key: string; name: string; matches: Match[] }>()
  for (const match of list) {
    const existing = groups.get(match.competition.key)
    if (existing) existing.matches.push(match)
    else groups.set(match.competition.key, { key: match.competition.key, name: match.competition.name, matches: [match] })
  }
  return Array.from(groups.values())
}

function formatKickoff(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const now = new Date()
  if (dayKey(date) === dayKey(now)) return time
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  if (dayKey(date) === dayKey(tomorrow)) return `Demain ${time}`
  return `${date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })} ${time}`
}
