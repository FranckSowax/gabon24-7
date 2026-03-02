'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  SkipBack, 
  SkipForward,
  Headphones,
  Radio,
  Loader2
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AudioSummary {
  id: string
  text_summary?: string
  audio_url?: string
  audio_duration_seconds?: number
  language: string
  time_slot?: string
  created_at: string
  status: string
}

const LANGUAGES = [
  { code: 'fr', flag: '🇫🇷', label: 'FR', fullLabel: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'EN', fullLabel: 'English' },
  { code: 'zh', flag: '🇨🇳', label: '中文', fullLabel: '中文' }
]

// Composant d'ondes sonores animées amélioré
function SoundWaves({ isPlaying, color = "white" }: { isPlaying: boolean; color?: string }) {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {[...Array(7)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-[3px] rounded-full ${color === "white" ? "bg-gradient-to-t from-white/60 to-white" : "bg-gradient-to-t from-orange-400 to-yellow-300"}`}
          animate={isPlaying ? {
            height: [6, 24, 10, 28, 14, 20, 6],
            opacity: [0.6, 1, 0.8, 1, 0.7, 0.9, 0.6]
          } : { height: 6, opacity: 0.5 }}
          transition={{
            duration: 1.2,
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.08,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

// Particules flottantes pour le background
function FloatingParticles({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white/30 rounded-full"
          style={{
            left: `${(i * 5) % 100}%`,
            top: `${(i * 7) % 100}%`,
          }}
          animate={isPlaying ? {
            y: [0, -30, 0],
            x: [0, (i % 2 === 0 ? 10 : -10), 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          } : { opacity: 0.1 }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

// Cercles pulsants autour du bouton play
function PulsingRings({ isPlaying }: { isPlaying: boolean }) {
  if (!isPlaying) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-white/20"
          initial={{ width: 56, height: 56, opacity: 0 }}
          animate={{
            width: [56, 100, 140],
            height: [56, 100, 140],
            opacity: [0.6, 0.3, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.6,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  )
}

// Hauteurs prédéfinies pour éviter les erreurs d'hydratation (pas de Math.random au rendu)
const VISUALIZER_HEIGHTS = [
  [4, 28, 8, 20, 4],
  [4, 24, 8, 32, 4],
  [4, 20, 8, 28, 4],
  [4, 32, 8, 24, 4],
  [4, 26, 8, 30, 4],
  [4, 22, 8, 26, 4],
  [4, 30, 8, 22, 4],
  [4, 18, 8, 28, 4],
  [4, 28, 8, 18, 4],
  [4, 24, 8, 32, 4],
  [4, 32, 8, 20, 4],
  [4, 20, 8, 24, 4],
]
const VISUALIZER_DURATIONS = [0.5, 0.6, 0.55, 0.7, 0.65, 0.5, 0.6, 0.55, 0.7, 0.65, 0.5, 0.6]

// Composant de visualiseur audio
function AudioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end gap-[2px] h-8">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-gradient-to-t from-orange-500 to-yellow-400 rounded-full"
          animate={isPlaying ? {
            height: VISUALIZER_HEIGHTS[i],
          } : { height: 4 }}
          transition={{
            duration: VISUALIZER_DURATIONS[i],
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.05,
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  )
}

export default function AudioPlayerBanner() {
  const [currentLang, setCurrentLang] = useState('fr')
  const [summary, setSummary] = useState<AudioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(1.5)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Charger le dernier résumé pour la langue sélectionnée
  useEffect(() => {
    fetchLatestSummary()
  }, [currentLang])

  // Gérer les événements audio
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const updateTime = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime)
        setProgress((audio.currentTime / audio.duration) * 100 || 0)
      }
    }

    const updateDuration = () => {
      setDuration(audio.duration)
      audio.playbackRate = playbackRate
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [summary, isDragging])

  async function fetchLatestSummary() {
    try {
      setLoading(true)
      const cacheBuster = Date.now()
      const res = await fetch(`${API_URL}/api/audio/latest-public?language=${currentLang}&_t=${cacheBuster}`)
      const data = await res.json()
      
      console.log('📻 Audio résumé chargé:', data)
      
      if (data.success && data.summary) {
        setSummary(data.summary)
      } else {
        setSummary(null)
      }
    } catch (error) {
      console.error('Erreur chargement résumé:', error)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !summary?.audio_url) return

    if (isPlaying) {
      audio.pause()
    } else {
      audio.play().catch(err => {
        console.error('Erreur lecture audio:', err)
      })
    }
  }, [isPlaying, summary])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !audio.muted
    setIsMuted(audio.muted)
  }, [])

  const handleVolumeChange = useCallback((newVolume: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }, [])

  const cyclePlaybackRate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const rates = [0.75, 1, 1.25, 1.5, 2]
    const currentIndex = rates.indexOf(playbackRate)
    const nextRate = rates[(currentIndex + 1) % rates.length]
    
    audio.playbackRate = nextRate
    setPlaybackRate(nextRate)
  }, [playbackRate])

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const progressBar = progressRef.current
    if (!audio || !duration || !progressBar) return

    const rect = progressBar.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const percentage = x / rect.width
    const newTime = percentage * duration

    audio.currentTime = newTime
    setProgress(percentage * 100)
    setCurrentTime(newTime)
  }, [duration])

  const skipTime = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration))
  }, [duration])

  function formatTime(seconds: number) {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    
    if (diffMins < 1) return 'À l\'instant'
    if (diffMins < 60) return `Il y a ${diffMins} min`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `Il y a ${diffHours}h`
    
    const days = Math.floor(diffHours / 24)
    return `Il y a ${days}j`
  }

  const currentLanguage = LANGUAGES.find(l => l.code === currentLang)

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full"
    >
      {/* Container principal avec glassmorphism moderne */}
      <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl border border-white/10">
        
        {/* Mesh gradient animé */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Blob 1 - Haut gauche */}
          <motion.div
            className="absolute -top-1/2 -left-1/4 w-[80%] h-[150%] bg-gradient-to-br from-cyan-400/40 via-blue-500/30 to-transparent rounded-full blur-3xl"
            animate={{
              x: [0, 80, 0],
              y: [0, 40, 0],
              scale: [1, 1.3, 1],
              rotate: [0, 10, 0],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Blob 2 - Centre */}
          <motion.div
            className="absolute top-1/4 left-1/3 w-[60%] h-[100%] bg-gradient-to-tr from-pink-500/30 via-rose-400/20 to-transparent rounded-full blur-3xl"
            animate={{
              x: [0, -60, 0],
              y: [0, 30, 0],
              scale: [1.1, 0.9, 1.1],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          {/* Blob 3 - Bas droite */}
          <motion.div
            className="absolute -bottom-1/2 -right-1/4 w-[70%] h-[120%] bg-gradient-to-tl from-orange-500/30 via-amber-400/20 to-transparent rounded-full blur-3xl"
            animate={{
              x: [0, -50, 0],
              y: [0, -30, 0],
              scale: [1.2, 1, 1.2],
            }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
          {/* Effet de grille subtile */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '40px 40px'
            }}
          />
        </div>
        
        {/* Particules flottantes */}
        <FloatingParticles isPlaying={isPlaying} />

        {/* Contenu */}
        <div className="relative z-10 p-4 md:p-6">
          
          {/* Layout Mobile */}
          <div className="flex flex-col gap-4 md:hidden">
            
            {/* Header mobile */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
                  animate={isPlaying ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {isPlaying ? (
                    <SoundWaves isPlaying={isPlaying} />
                  ) : (
                    <Radio className="w-5 h-5 text-white" />
                  )}
                </motion.div>
                <div>
                  <h3 className="text-white font-bold text-sm">Flash Info</h3>
                  <p className="text-white/70 text-xs">
                    {loading ? 'Chargement...' : summary ? formatDate(summary.created_at) : 'Indisponible'}
                  </p>
                </div>
              </div>
              
              {/* Sélecteur de langue mobile */}
              <div className="flex gap-1">
                {LANGUAGES.map((lang) => (
                  <motion.button
                    key={lang.code}
                    onClick={() => setCurrentLang(lang.code)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      currentLang === lang.code
                        ? 'bg-white text-orange-600 shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {lang.flag}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Contrôles et progression mobile */}
            {summary?.audio_url ? (
              <div className="space-y-3">
                {/* Barre de progression mobile */}
                <div className="space-y-1">
                  <div
                    ref={progressRef}
                    onClick={handleSeek}
                    onTouchMove={handleSeek}
                    className="relative h-2 bg-white/20 rounded-full cursor-pointer overflow-hidden"
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-white rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                    <motion.div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                      style={{ left: `calc(${progress}% - 8px)` }}
                      animate={isPlaying ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-white/60">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Boutons de contrôle mobile */}
                <div className="flex items-center justify-center gap-4">
                  <motion.button
                    onClick={() => skipTime(-10)}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
                    whileTap={{ scale: 0.9 }}
                  >
                    <SkipBack className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    onClick={togglePlay}
                    disabled={loading}
                    className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-orange-600 shadow-xl disabled:opacity-50"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {loading ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-7 h-7" fill="currentColor" />
                    ) : (
                      <Play className="w-7 h-7 ml-1" fill="currentColor" />
                    )}
                  </motion.button>

                  <motion.button
                    onClick={() => skipTime(10)}
                    className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
                    whileTap={{ scale: 0.9 }}
                  >
                    <SkipForward className="w-4 h-4" />
                  </motion.button>
                </div>

                {/* Options secondaires mobile */}
                <div className="flex items-center justify-center gap-3">
                  <motion.button
                    onClick={toggleMute}
                    className="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs flex items-center gap-1.5"
                    whileTap={{ scale: 0.95 }}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </motion.button>
                  <motion.button
                    onClick={cyclePlaybackRate}
                    className="px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-medium"
                    whileTap={{ scale: 0.95 }}
                  >
                    {playbackRate}x
                  </motion.button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-white/70 text-sm">
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Chargement du résumé...</span>
                  </div>
                ) : (
                  'Aucun résumé audio disponible'
                )}
              </div>
            )}
          </div>

          {/* Layout Desktop */}
          <div className="hidden md:flex items-center gap-6">
            
            {/* Section gauche - Icône et infos */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <motion.div 
                className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
                animate={isPlaying ? { 
                  scale: [1, 1.03, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(255,255,255,0.4)',
                    '0 0 0 10px rgba(255,255,255,0)',
                    '0 0 0 0 rgba(255,255,255,0)'
                  ]
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isPlaying ? (
                  <SoundWaves isPlaying={isPlaying} />
                ) : (
                  <Headphones className="w-8 h-8 text-white" />
                )}
              </motion.div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold text-lg">Flash Info Audio</h3>
                  {summary && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full"
                    >
                      {currentLanguage?.flag} {currentLanguage?.fullLabel}
                    </motion.span>
                  )}
                </div>
                <p className="text-white/70 text-sm mt-0.5">
                  {loading ? 'Chargement...' : summary ? (
                    <>Résumé des actualités • {formatDate(summary.created_at)}</>
                  ) : 'Aucun résumé disponible'}
                </p>
              </div>
            </div>

            {/* Section centrale - Contrôles et progression */}
            <div className="flex-1 max-w-2xl">
              {summary?.audio_url ? (
                <div className="space-y-2">
                  {/* Contrôles de lecture */}
                  <div className="flex items-center justify-center gap-4">
                    <motion.button
                      onClick={() => skipTime(-10)}
                      className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                      whileHover={{ scale: 1.1, borderColor: 'rgba(255,255,255,0.4)' }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <SkipBack className="w-4 h-4" />
                    </motion.button>

                    {/* Bouton Play avec cercles pulsants */}
                    <div className="relative">
                      <PulsingRings isPlaying={isPlaying} />
                      <motion.button
                        onClick={togglePlay}
                        disabled={loading}
                        className="relative w-16 h-16 rounded-full bg-gradient-to-br from-white to-gray-100 flex items-center justify-center text-purple-600 shadow-2xl disabled:opacity-50 border-2 border-white/50"
                        whileHover={{ scale: 1.08, boxShadow: '0 0 40px rgba(255,255,255,0.4)' }}
                        whileTap={{ scale: 0.95 }}
                      >
                      <AnimatePresence mode="wait">
                        {loading ? (
                          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <Loader2 className="w-6 h-6 animate-spin" />
                          </motion.div>
                        ) : isPlaying ? (
                          <motion.div key="pause" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Pause className="w-6 h-6" fill="currentColor" />
                          </motion.div>
                        ) : (
                          <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                    </div>

                    <motion.button
                      onClick={() => skipTime(10)}
                      className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                      whileHover={{ scale: 1.1, borderColor: 'rgba(255,255,255,0.4)' }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <SkipForward className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Barre de progression desktop - Design moderne */}
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-white/80 w-12 text-right tabular-nums font-medium">
                      {formatTime(currentTime)}
                    </span>
                    <div
                      ref={progressRef}
                      onClick={handleSeek}
                      onMouseDown={() => setIsDragging(true)}
                      onMouseUp={() => setIsDragging(false)}
                      onMouseLeave={() => setIsDragging(false)}
                      className="flex-1 relative h-2 bg-white/10 backdrop-blur-sm rounded-full cursor-pointer group border border-white/10"
                    >
                      {/* Barre de progression avec gradient */}
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-full"
                        style={{ width: `${progress}%` }}
                        layoutId="progress"
                      />
                      {/* Effet de brillance sur la progression */}
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full"
                        style={{ width: `${progress}%` }}
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      {/* Curseur avec glow */}
                      <motion.div
                        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)] opacity-0 group-hover:opacity-100 transition-all border-2 border-purple-400"
                        style={{ left: `calc(${progress}% - 10px)` }}
                        whileHover={{ scale: 1.2 }}
                      />
                    </div>
                    <span className="text-xs text-white/70 w-10 tabular-nums">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4">
                  {loading ? (
                    <div className="flex items-center gap-2 text-white/70">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Chargement du résumé audio...</span>
                    </div>
                  ) : (
                    <AudioVisualizer isPlaying={false} />
                  )}
                </div>
              )}
            </div>

            {/* Section droite - Options et langues */}
            <div className="flex items-center gap-3 flex-shrink-0">
              
              {/* Volume avec slider - Design glassmorphism */}
              <div 
                className="relative"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <motion.button
                  onClick={toggleMute}
                  className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                  whileHover={{ borderColor: 'rgba(255,255,255,0.4)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </motion.button>
                
                <AnimatePresence>
                  {showVolumeSlider && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-4 bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10"
                    >
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-28 h-2 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-purple-400 [&::-webkit-slider-thumb]:to-pink-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg"
                        style={{
                          writingMode: 'horizontal-tb'
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Vitesse de lecture - Badge moderne */}
              <motion.button
                onClick={cyclePlaybackRate}
                className="h-11 px-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 text-white text-sm font-bold transition-all"
                whileHover={{ borderColor: 'rgba(255,255,255,0.4)' }}
                whileTap={{ scale: 0.95 }}
              >
                {playbackRate}x
              </motion.button>

              {/* Séparateur avec gradient */}
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/30 to-transparent" />

              {/* Sélecteur de langue desktop - Design moderne */}
              <div className="flex gap-2">
                {LANGUAGES.map((lang) => (
                  <motion.button
                    key={lang.code}
                    onClick={() => setCurrentLang(lang.code)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      currentLang === lang.code
                        ? 'bg-gradient-to-br from-white to-gray-100 text-purple-600 shadow-[0_0_20px_rgba(255,255,255,0.3)] border-2 border-white/50'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="flex items-center gap-1.5">
                      {lang.flag}
                      <span className="hidden lg:inline">{lang.label}</span>
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Élément audio caché */}
        {summary?.audio_url && (
          <audio 
            ref={audioRef} 
            src={summary.audio_url} 
            preload="metadata" 
            className="hidden" 
          />
        )}

        {/* Effet de brillance animé */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  )
}
