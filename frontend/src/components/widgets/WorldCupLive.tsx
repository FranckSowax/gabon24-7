'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Trophy, CalendarClock, History, Radio } from 'lucide-react'

type Team = { id: string; name: string; flag: string }
type Match = {
  id: string
  group: string | null
  type: string
  matchday: string | null
  kickoff: string | null
  dayKey: string | null
  status: 'live' | 'finished' | 'upcoming'
  minute: string | null
  home: Team
  away: Team
  homeScore: number | null
  awayScore: number | null
  homeScorers: string[]
  awayScorers: string[]
}

type Slide = 'veille' | 'live' | 'avenir'

const TYPE_LABEL: Record<string, string> = {
  group: 'Phase de groupes',
  r32: '16es de finale',
  r16: '8es de finale',
  qf: 'Quarts de finale',
  sf: 'Demi-finales',
  third: 'Petite finale',
  final: 'Finale',
}

export default function WorldCupLive({ className = '' }: { className?: string }) {
  const [games, setGames] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [slide, setSlide] = useState<Slide>('live')

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/worldcup/games`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setGames(Array.isArray(data.games) ? data.games : [])
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Erreur Coupe du Monde:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGames()
    // Rafraîchissement auto plus rapide quand on regarde le live
    const ms = slide === 'live' ? 45 * 1000 : 3 * 60 * 1000
    const interval = setInterval(fetchGames, ms)
    return () => clearInterval(interval)
  }, [fetchGames, slide])

  const live = useMemo(
    () => games.filter((g) => g.status === 'live').sort(byKickoffAsc),
    [games]
  )
  const upcoming = useMemo(
    () => games.filter((g) => g.status === 'upcoming').sort(byKickoffAsc),
    [games]
  )
  // "Veille / résultats" = matchs terminés du jour de jeu le plus récent
  const results = useMemo(() => {
    const finished = games.filter((g) => g.status === 'finished').sort(byKickoffDesc)
    if (finished.length === 0) return []
    const latestDay = finished[0].dayKey
    return finished.filter((g) => g.dayKey === latestDay)
  }, [games])

  // Matchs du jour (pour fallback du slide live)
  const todayKey = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])
  const today = useMemo(() => games.filter((g) => g.dayKey === todayKey).sort(byKickoffAsc), [games, todayKey])

  const tabs: { key: Slide; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'veille', label: 'Résultats', icon: <History size={14} /> },
    { key: 'live', label: 'Live', icon: <Radio size={14} />, badge: live.length || undefined },
    { key: 'avenir', label: 'À venir', icon: <CalendarClock size={14} /> },
  ]

  const visible =
    slide === 'live' ? (live.length > 0 ? live : today) : slide === 'avenir' ? upcoming.slice(0, 12) : results

  const headerSub =
    slide === 'live'
      ? live.length > 0
        ? `${live.length} match${live.length > 1 ? 's' : ''} en direct`
        : today.length > 0
          ? 'Programme du jour'
          : 'Aucun match en direct'
      : slide === 'avenir'
        ? 'Prochains matchs'
        : results.length > 0
          ? `Résultats du ${formatDay(results[0].dayKey)}`
          : 'Derniers résultats'

  return (
    <div className={`bg-gradient-to-br from-emerald-50 to-sky-50 rounded-3xl shadow-2xl overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-700">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Trophy size={18} className="text-amber-300 flex-shrink-0" />
              <h3 className="text-white font-bold text-base sm:text-lg truncate">Coupe du Monde 2026</h3>
            </div>
            <button
              onClick={fetchGames}
              disabled={loading}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50 flex-shrink-0"
              title="Rafraîchir"
            >
              <RefreshCw size={16} className={`text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-white/90 text-xs mt-1">
            {headerSub}
            {lastUpdate && (
              <span className="ml-2 opacity-75">
                • MàJ {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        {/* Onglets / slides */}
        <div className="flex px-2 gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setSlide(t.key)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                slide === t.key ? 'bg-emerald-50 text-emerald-700' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {t.key === 'live' && live.length > 0 && (
                <span className="absolute left-2 top-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
              {t.icon}
              {t.label}
              {t.badge ? (
                <span className="ml-0.5 px-1.5 rounded-full bg-red-500 text-white text-[10px] leading-4">{t.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div className="p-3 flex-1 overflow-y-auto wc-scroll">
        {loading && games.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Trophy size={44} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">
              {slide === 'live' ? 'Aucun match en direct' : slide === 'avenir' ? 'Aucun match à venir' : 'Aucun résultat'}
            </p>
            {slide === 'live' && upcoming.length > 0 && (
              <p className="text-xs mt-2">
                Prochain : {upcoming[0].home.flag} {upcoming[0].home.name} – {upcoming[0].away.name} {upcoming[0].away.flag}
                <br />
                {formatDateTime(upcoming[0].kickoff)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {visible.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </div>
      </div>

      <style jsx>{`
        .wc-scroll::-webkit-scrollbar { width: 4px; }
        .wc-scroll::-webkit-scrollbar-track { background: transparent; }
        .wc-scroll::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
        .wc-scroll::-webkit-scrollbar-thumb:hover { background: #059669; }
      `}</style>
    </div>
  )
}

function MatchCard({ m }: { m: Match }) {
  const isLive = m.status === 'live'
  const isFinished = m.status === 'finished'
  const homeWin = isFinished && (m.homeScore ?? 0) > (m.awayScore ?? 0)
  const awayWin = isFinished && (m.awayScore ?? 0) > (m.homeScore ?? 0)

  return (
    <div
      className={`bg-white rounded-xl p-2.5 border transition-all ${
        isLive ? 'border-red-200 shadow-sm ring-1 ring-red-100' : 'border-transparent hover:border-emerald-200'
      }`}
    >
      {/* Bandeau compétition / groupe */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
          {TYPE_LABEL[m.type] || 'Match'}
          {m.group ? ` · Groupe ${m.group}` : ''}
        </span>
        <StatusPill m={m} />
      </div>

      {/* Domicile */}
      <Row flag={m.home.flag} name={m.home.name} score={m.homeScore} win={homeWin} dim={awayWin} />
      {/* Extérieur */}
      <Row flag={m.away.flag} name={m.away.name} score={m.awayScore} win={awayWin} dim={homeWin} />

      {/* Buteurs (live / terminé) */}
      {(isLive || isFinished) && (m.homeScorers.length > 0 || m.awayScorers.length > 0) && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-100 grid grid-cols-2 gap-2 text-[10px] text-gray-500">
          <div className="space-y-0.5">
            {m.homeScorers.map((s, i) => (
              <div key={i} className="truncate">⚽ {s}</div>
            ))}
          </div>
          <div className="space-y-0.5 text-right">
            {m.awayScorers.map((s, i) => (
              <div key={i} className="truncate">{s} ⚽</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ flag, name, score, win, dim }: { flag: string; name: string; score: number | null; win: boolean; dim: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-lg leading-none flex-shrink-0">{flag}</span>
        <span className={`text-sm truncate ${win ? 'font-bold text-gray-900' : dim ? 'text-gray-400' : 'font-medium text-gray-800'}`}>
          {name}
        </span>
      </div>
      <div className={`text-lg font-bold min-w-[24px] text-right ${win ? 'text-emerald-600' : dim ? 'text-gray-400' : 'text-gray-900'}`}>
        {score !== null ? score : '–'}
      </div>
    </div>
  )
}

function StatusPill({ m }: { m: Match }) {
  if (m.status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        {m.minute && /^\d+$/.test(m.minute) ? `${m.minute}'` : m.minute === 'HT' ? 'Mi-temps' : 'LIVE'}
      </span>
    )
  }
  if (m.status === 'finished') {
    return <span className="text-[10px] font-semibold text-gray-400">Terminé</span>
  }
  return <span className="text-[10px] font-semibold text-emerald-600">{formatDateTime(m.kickoff)}</span>
}

// ---------- helpers ----------
function byKickoffAsc(a: Match, b: Match) {
  return (a.kickoff || '').localeCompare(b.kickoff || '')
}
function byKickoffDesc(a: Match, b: Match) {
  return (b.kickoff || '').localeCompare(a.kickoff || '')
}
function formatDateTime(iso: string | null) {
  if (!iso) return '--'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '--'
  }
}
function formatDay(dayKey: string | null) {
  if (!dayKey) return ''
  try {
    return new Date(dayKey + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })
  } catch {
    return dayKey
  }
}
