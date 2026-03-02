'use client'

import React, { useState, useEffect, useRef } from 'react'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
import axios from '@/lib/axios'
import { supabase } from '@/lib/supabase'

interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  url: string
  publishedAt: string
  duration?: string
}

interface YouTubeWidgetProps {
  className?: string
}

export default function YouTubeWidget({ className = '' }: YouTubeWidgetProps) {
  const [latestVideo, setLatestVideo] = useState<YouTubeVideo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const intervalRef = useRef<number | null>(null)
  const debug = true // Activé temporairement pour debug

  const RSS_URL = 'https://rss.app/feeds/8Zm0ezBRaaD2NiOF.xml'

  const parseRSSFeed = async () => {
    try {
      setLoading(true)
      setError(null)

      if (debug) console.log('📺 Récupération du dernier journal TV...')
      
      // Pré-vérification rapide pour éviter d'attendre une fonction froide
      try {
        await axios.get(`${API_URL}/api/youtube?health=1&_t=${Date.now()}`, { timeout: 4000 })
      } catch {
        // Fallback rapide: tenter le cache Supabase directement
        try {
          if (debug) console.log('🔄 Health NOK, récupération directe depuis le cache Supabase...')
          const { data: cachedVideo, error: cacheError } = await supabase
            .from('youtube_cache')
            .select('*')
            .eq('is_active', true)
            .order('published_at', { ascending: false })
            .limit(1)
            .single()
          if (!cacheError && cachedVideo) {
            setLatestVideo({
              id: cachedVideo.video_id,
              title: cachedVideo.title,
              thumbnail: cachedVideo.thumbnail,
              url: cachedVideo.url,
              publishedAt: cachedVideo.published_at,
              duration: cachedVideo.duration
            })
            setError('Dernière vidéo mise en cache')
            return
          }
        } catch {}
        // si pas de cache, continuer (le fallback final s'appliquera)
      }

      // Utiliser l'endpoint backend pour éviter les problèmes CORS
      const response = await axios.get(`${API_URL}/api/youtube`)
      
      if (response.data && response.data.length > 0) {
        const latestVideoData = response.data[0]
        if (debug) console.log('📺 Dernier journal trouvé:', latestVideoData.title)
        
        setLatestVideo({
          id: latestVideoData.id,
          title: latestVideoData.title,
          thumbnail: latestVideoData.thumbnail,
          url: latestVideoData.url,
          publishedAt: latestVideoData.publishedAt,
          duration: latestVideoData.duration
        })
        setError(null)
      } else {
        if (debug) console.log('📺 Aucun journal trouvé dans le flux')
        throw new Error('Aucun journal TV trouvé')
      }
    } catch (err) {
      if (debug) console.error('❌ Erreur lors du chargement du flux YouTube:', err)
      
      // Essayer de récupérer depuis le cache Supabase
      try {
        if (debug) console.log('🔄 Tentative de récupération depuis le cache Supabase...')
        
        const { data: cachedVideo, error: cacheError } = await supabase
          .from('youtube_cache')
          .select('*')
          .eq('is_active', true)
          .order('published_at', { ascending: false }) // Corrigé: tri par date publication
          .limit(1)
          .single()
          
        if (!cacheError && cachedVideo) {
          if (debug) console.log('✅ Vidéo récupérée depuis le cache:', cachedVideo.title)
          
          setLatestVideo({
            id: cachedVideo.video_id,
            title: cachedVideo.title,
            thumbnail: cachedVideo.thumbnail,
            url: cachedVideo.url,
            publishedAt: cachedVideo.published_at,
            duration: cachedVideo.duration
          })
          setError('Dernière vidéo mise en cache')
          return
        }
      } catch (cacheError) {
        if (debug) console.error('❌ Impossible de récupérer le cache:', cacheError)
      }
      
      // Fallback final avec une vraie image gabonaise
      if (debug) console.log('⚠️ Utilisation du fallback final')
      setLatestVideo({
        id: 'fallback-journal',
        title: 'Journal Télévisé - Gabon Insight',
        thumbnail: '/369309819_1696052364152294_5673051963922538250_n.jpg',
        url: 'https://youtube.com/channel/UCYourChannelID',
        publishedAt: new Date().toISOString(),
        duration: 'N/A'
      })
      setError('Connexion au flux en cours...')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // Lancer une première récupération
    parseRSSFeed()

    // Actualiser toutes les 5 minutes pour avoir le dernier journal (éviter doublons)
    intervalRef.current = window.setInterval(parseRSSFeed, 5 * 60 * 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Date inconnue'
    }
  }

  const handleVideoClick = () => {
    if (latestVideo?.url) {
      window.open(latestVideo.url, '_blank', 'noopener,noreferrer')
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">▶</span>
          </div>
          <h3 className="font-semibold text-gray-900">Journal TV</h3>
        </div>
        <div className="animate-pulse">
          <div className="bg-gray-300 rounded-lg aspect-video mb-3"></div>
          <div className="h-4 bg-gray-300 rounded mb-2"></div>
          <div className="h-3 bg-gray-300 rounded w-2/3"></div>
        </div>
      </div>
    )
  }

  if (error || !latestVideo) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">▶</span>
          </div>
          <h3 className="font-semibold text-gray-900">Journal TV</h3>
        </div>
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">{error || 'Aucune vidéo disponible'}</p>
          <button 
            onClick={parseRSSFeed}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">▶</span>
          </div>
          <h3 className="font-semibold text-gray-900">Journal TV</h3>
          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium">
            DERNIER
          </span>
        </div>
      </div>

      {/* Video Thumbnail */}
      <div
        className="relative cursor-pointer group flex-1 min-h-0"
        onClick={handleVideoClick}
      >
        <div className="bg-gray-900 relative overflow-hidden w-full h-full min-h-[160px]">
          {latestVideo.thumbnail ? (
            <img 
              src={latestVideo.thumbnail}
              alt={latestVideo.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <span className="text-white text-4xl">▶</span>
            </div>
          )}
          
          {/* Play Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
            <div className="w-16 h-16 bg-red-500 bg-opacity-90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-110">
              <span className="text-white text-xl ml-1">▶</span>
            </div>
          </div>

          {/* Duration Badge (if available) */}
          {latestVideo.duration && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
              {latestVideo.duration}
            </div>
          )}
        </div>
      </div>

      {/* Video Info */}
      <div className="p-4 pt-3">
        <h4 
          className="font-medium text-sm text-gray-900 line-clamp-2 cursor-pointer hover:text-red-600 transition-colors"
          onClick={handleVideoClick}
        >
          {latestVideo.title}
        </h4>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            Gabon Télévision
          </span>
          <span className="text-xs text-gray-500">
            {formatDate(latestVideo.publishedAt)}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleVideoClick}
          className="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
        >
          <span>▶</span>
          <span>Regarder sur YouTube</span>
        </button>
      </div>
    </div>
  )
}
