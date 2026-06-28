'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause, Volume2, VolumeX, Headphones, Loader2, Gauge } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AudioSummary {
  id: string
  audio_url?: string
  created_at: string
}

const LANGUAGES = [
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'en', flag: '🇬🇧', label: 'EN' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
]

function formatTime(s: number) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

/** Widget compact et moderne du résumé audio (barre latérale). */
export default function AudioSummaryWidget() {
  const [lang, setLang] = useState('fr')
  const [summary, setSummary] = useState<AudioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1.5)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/audio/latest-public?language=${lang}&_t=${Date.now()}`)
      const data = await res.json()
      setSummary(data?.success && data.summary ? data.summary : null)
    } catch { setSummary(null) } finally { setLoading(false) }
  }, [lang])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => { setCurrentTime(a.currentTime); setProgress((a.currentTime / a.duration) * 100 || 0) }
    const onMeta = () => { setDuration(a.duration); a.playbackRate = rate }
    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnd = () => { setIsPlaying(false); setProgress(0); setCurrentTime(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onMeta)
    a.addEventListener('play', onPlay)
    a.addEventListener('pause', onPause)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onMeta)
      a.removeEventListener('play', onPlay)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('ended', onEnd)
    }
  }, [summary, rate])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a || !summary?.audio_url) return
    if (isPlaying) a.pause(); else a.play().catch(() => {})
  }
  const toggleMute = () => { const a = audioRef.current; if (!a) return; a.muted = !a.muted; setMuted(a.muted) }
  const cycleRate = () => {
    const rates = [1, 1.25, 1.5, 2]
    const next = rates[(rates.indexOf(rate) + 1) % rates.length]
    if (audioRef.current) audioRef.current.playbackRate = next
    setRate(next)
  }
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current, bar = barRef.current
    if (!a || !duration || !bar) return
    const rect = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1))
    a.currentTime = pct * duration
    setProgress(pct * 100)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4d553e] via-[#697357] to-[#3a4030] text-white shadow-lg border border-white/10 p-4">
      {/* halo */}
      <div className="absolute -top-10 -right-8 w-32 h-32 rounded-full bg-amber-300/10 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
          {isPlaying ? (
            <span className="flex items-end gap-[2px] h-4">
              {[0, 1, 2, 3].map(i => (
                <motion.span key={i} className="w-[2px] bg-amber-200 rounded-full"
                  animate={{ height: [4, 14, 6, 12, 4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }} />
              ))}
            </span>
          ) : <Headphones className="w-4.5 h-4.5 text-amber-200" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-sm leading-tight">Résumé audio</h3>
          <p className="text-white/70 text-[11px] truncate">
            {loading ? 'Chargement…' : summary ? 'Actualités du jour' : 'Indisponible'}
          </p>
        </div>
        {/* langues */}
        <div className="flex gap-1">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className={`px-1.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${lang === l.code ? 'bg-white text-[#4d553e]' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}>
              {l.flag}
            </button>
          ))}
        </div>
      </div>

      {summary?.audio_url ? (
        <div className="relative space-y-2.5">
          {/* Contrôles */}
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} disabled={loading}
              className="w-12 h-12 rounded-full bg-white text-[#4d553e] flex items-center justify-center shadow-lg shrink-0 hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
            </button>
            <div className="flex-1 min-w-0">
              {/* barre */}
              <div ref={barRef} onClick={seek} className="relative h-2 bg-white/20 rounded-full cursor-pointer overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-amber-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-white/70 mt-1 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
          {/* options */}
          <div className="flex items-center justify-end gap-2">
            <button onClick={cycleRate} title="Vitesse"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold transition-colors">
              <Gauge className="w-3.5 h-3.5" /> {rate}x
            </button>
            <button onClick={toggleMute} title={muted ? 'Activer le son' : 'Couper le son'}
              className="w-7 h-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative text-center text-white/70 text-xs py-3">
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</span> : 'Aucun résumé audio disponible'}
        </div>
      )}

      {summary?.audio_url && <audio ref={audioRef} src={summary.audio_url} preload="metadata" className="hidden" />}
    </div>
  )
}
