'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Trophy, ArrowLeft, Loader2, Medal } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Row { rank: number; user_id: string; name: string; xp: number; modules: number; level_unlocked: number }

export default function ClassementPage() {
  const { user } = useAuth()
  const [board, setBoard] = useState<Row[]>([])
  const [me, setMe] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${API_URL}/api/formations/leaderboard`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json()
      if (data?.success) { setBoard(data.leaderboard || []); setMe(data.me || null) }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (user) load() }, [user, load])

  const medal = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-br from-[#4d553e] to-[#3a4030] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <Link href="/formations" className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-3">
            <ArrowLeft className="w-4 h-4" /> Programme
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2"><Trophy className="w-7 h-7 text-amber-300" /> Classement national</h1>
          <p className="text-white/80 mt-1 text-sm">Les entrepreneurs les plus assidus de la formation BCEG, partout au Gabon.</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {!user ? (
          <p className="text-slate-500 text-sm">Connectez-vous pour voir le classement et votre position.</p>
        ) : loading ? (
          <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
        ) : board.length === 0 ? (
          <p className="text-slate-500 text-sm">Aucun participant pour le moment. Soyez le premier à valider un module !</p>
        ) : (
          <>
            {me && me.rank > 10 && (
              <div className="mb-4 rounded-2xl bg-[#697357] text-white p-4 flex items-center justify-between">
                <span className="font-semibold">Votre position : #{me.rank}</span>
                <span className="inline-flex items-center gap-1.5 font-bold"><Medal className="w-4 h-4 text-amber-300" />{me.xp} XP</span>
              </div>
            )}
            <div className="space-y-2">
              {board.map(r => (
                <div key={r.user_id}
                  className={`flex items-center gap-3 rounded-xl border p-3 ${me && r.user_id === me.user_id ? 'border-[#697357] bg-[#697357]/5' : 'border-slate-200 bg-white'}`}>
                  <div className="w-9 text-center font-black text-lg text-slate-700">{medal(r.rank)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{r.name}{me && r.user_id === me.user_id ? ' (vous)' : ''}</div>
                    <div className="text-xs text-slate-500">{r.modules} module{r.modules > 1 ? 's' : ''} · Niveau {r.level_unlocked}</div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 font-bold text-[#697357]"><Trophy className="w-4 h-4" />{r.xp} XP</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
