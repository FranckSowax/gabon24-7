'use client';

import React, { useState, useEffect } from 'react';
import { Music, Heart, MessageCircle, Eye, Share2, Play, RefreshCw, TrendingUp, CheckCircle } from 'lucide-react';

interface TikTokVideo {
  id: string;
  title: string;
  author: {
    username: string;
    nickname: string;
    avatar: string;
    verified: boolean;
  };
  cover: string;
  duration: number;
  stats: {
    likes: number;
    comments: number;
    views: number;
    shares: number;
  };
  url: string;
}

export default function TikTokTrendingWidget() {
  const [videos, setVideos] = useState<TikTokVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchTrendingVideos = async () => {
    try {
      setError(null);
      
      // Appel via le backend pour éviter les problèmes CORS
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tiktok/trending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch trending videos');
      }

      const data = await response.json();
      
      if (data.success && data.videos) {
        setVideos(data.videos);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching TikTok videos:', err);
      setError((err as Error).message);
      
      // Set mock data for demo purposes
      setVideos([
        {
          id: '1',
          title: 'Danse traditionnelle gabonaise modernisée 🔥🇬🇦 #Gabon #Culture',
          author: { username: 'gabon_vibes', nickname: 'Gabon Vibes', avatar: '👤', verified: true },
          cover: '🎭',
          duration: 45,
          stats: { likes: 125000, comments: 3200, views: 890000, shares: 12000 },
          url: 'https://www.tiktok.com'
        },
        {
          id: '2',
          title: 'Recette du poulet DG revisité par Chef Libreville 🍗',
          author: { username: 'chef_lbv', nickname: 'Chef Libreville', avatar: '👨‍🍳', verified: false },
          cover: '🍽️',
          duration: 60,
          stats: { likes: 98000, comments: 2100, views: 650000, shares: 8900 },
          url: 'https://www.tiktok.com'
        },
        {
          id: '3',
          title: 'Les plus beaux paysages du Gabon 🌴🏝️ #Nature #Travel',
          author: { username: 'gabon_nature', nickname: 'Gabon Nature', avatar: '🌿', verified: true },
          cover: '🏞️',
          duration: 30,
          stats: { likes: 87000, comments: 1800, views: 520000, shares: 7200 },
          url: 'https://www.tiktok.com'
        },
        {
          id: '4',
          title: 'Street fashion à Libreville 👗✨ #Mode #Fashion',
          author: { username: 'fashion_241', nickname: 'Fashion 241', avatar: '👗', verified: false },
          cover: '👔',
          duration: 38,
          stats: { likes: 76000, comments: 1500, views: 480000, shares: 6500 },
          url: 'https://www.tiktok.com'
        },
        {
          id: '5',
          title: 'Musique traditionnelle Fang x Afrobeat 🎵🥁',
          author: { username: 'musik_gabon', nickname: 'Musik Gabon', avatar: '🎤', verified: true },
          cover: '🎸',
          duration: 55,
          stats: { likes: 68000, comments: 1200, views: 420000, shares: 5800 },
          url: 'https://www.tiktok.com'
        }
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrendingVideos();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTrendingVideos();
  };

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600 to-amber-700 text-amber-100';
    return 'bg-gray-100 text-gray-600';
  };

  const SkeletonCard = () => (
    <div className="bg-white rounded-xl p-3 shadow-md animate-pulse">
      <div className="flex gap-3">
        <div className="w-24 h-32 bg-gray-200 rounded-lg flex-shrink-0"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          <div className="flex gap-2 mt-3">
            <div className="h-6 bg-gray-200 rounded-full w-12"></div>
            <div className="h-6 bg-gray-200 rounded-full w-12"></div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-md bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Music className="w-6 h-6 text-white" />
            <h2 className="text-white font-bold text-lg">TikTok Trending</h2>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white/90 text-sm">🇬🇦 Gabon</span>
            <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              LIVE
            </span>
          </div>
          <span className="text-white/80 text-xs">Mis à jour aujourd'hui</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
        {loading ? (
          // Loading State
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error && videos.length === 0 ? (
          // Error State (but we still show mock data)
          <div className="bg-white rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-gray-600 mb-4">Impossible de charger les données en direct</p>
            <p className="text-sm text-gray-500 mb-4">Affichage du contenu demo</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-all"
            >
              Réessayer
            </button>
          </div>
        ) : (
          // Videos List
          videos.map((video, index) => (
            <a
              key={video.id}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white rounded-xl p-3 shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-2 border-transparent hover:border-orange-400 group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex gap-3">
                {/* Thumbnail */}
                <div className="relative w-24 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex-shrink-0 overflow-hidden">
                  {/* Cover image */}
                  {typeof video.cover === 'string' && video.cover.startsWith('http') ? (
                    <img 
                      src={video.cover} 
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl">
                      {video.cover}
                    </div>
                  )}
                  
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-orange-500 rounded-full p-2">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                  
                  {/* Duration */}
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {formatDuration(video.duration)}
                  </span>
                  
                  {/* Rank badge */}
                  <span className={`absolute top-2 left-2 ${getRankBadgeColor(index + 1)} text-xs font-bold px-2 py-1 rounded-full shadow-lg`}>
                    #{index + 1}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h3 className="font-semibold text-sm text-gray-800 line-clamp-2 mb-2 group-hover:text-orange-600 transition-colors">
                    {video.title}
                  </h3>
                  
                  {/* Author */}
                  <div className="flex items-center gap-1.5 mb-3">
                    {typeof video.author.avatar === 'string' && video.author.avatar.startsWith('http') ? (
                      <img 
                        src={video.author.avatar} 
                        alt={video.author.username}
                        className="w-5 h-5 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xl">{video.author.avatar}</span>
                    )}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs text-gray-600 truncate">@{video.author.username}</span>
                      {video.author.verified && (
                        <CheckCircle className="w-3 h-3 text-blue-500 fill-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Heart className="w-3 h-3 text-red-500" />
                      <span className="font-medium">{formatNumber(video.stats.likes)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <MessageCircle className="w-3 h-3 text-blue-500" />
                      <span className="font-medium">{formatNumber(video.stats.comments)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Eye className="w-3 h-3 text-purple-500" />
                      <span className="font-medium">{formatNumber(video.stats.views)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Share2 className="w-3 h-3 text-orange-500" />
                      <span className="font-medium">{formatNumber(video.stats.shares)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <TrendingUp className="w-4 h-4 text-orange-500" />
          <span>Top {videos.length} vidéos</span>
        </div>
        <a
          href="https://www.tiktok.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline"
        >
          Voir plus →
        </a>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fb923c;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `}</style>
    </div>
  );
}
