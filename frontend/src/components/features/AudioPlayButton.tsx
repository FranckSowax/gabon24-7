'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AudioPlayButtonProps {
  articleId: string
  initialUrl?: string | null
}

/**
 * Bouton ▶️ pour écouter le résumé d'un article (gratuit).
 * Génère l'audio à la demande (1ère écoute) puis le rejoue depuis le cache.
 */
export function AudioPlayButton({ articleId, initialUrl }: AudioPlayButtonProps) {
  const [url, setUrl] = useState<string | null>(initialUrl || null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const getAudio = (src: string) => {
    if (!audioRef.current) {
      const a = new Audio(src)
      a.onplay = () => setPlaying(true)
      a.onpause = () => setPlaying(false)
      a.onended = () => setPlaying(false)
      audioRef.current = a
    } else if (audioRef.current.src !== src) {
      audioRef.current.src = src
    }
    return audioRef.current
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (playing) {
      audioRef.current?.pause()
      return
    }

    let src = url
    if (!src) {
      setLoading(true)
      try {
        const res = await fetch(`${API_URL}/api/audio/article/${articleId}`, { method: 'POST' })
        const data = await res.json()
        if (data?.success && data.audioUrl) {
          src = data.audioUrl
          setUrl(src)
        } else {
          alert(data?.error || 'Audio indisponible pour cet article')
          return
        }
      } catch {
        alert('Erreur lors de la génération de l\'audio')
        return
      } finally {
        setLoading(false)
      }
    }

    try {
      await getAudio(src!).play()
    } catch { /* lecture bloquée */ }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={playing ? 'Pause' : "Écouter le résumé"}
      className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors text-[#697357] disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
      ) : playing ? (
        <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      ) : (
        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      )}
    </button>
  )
}
