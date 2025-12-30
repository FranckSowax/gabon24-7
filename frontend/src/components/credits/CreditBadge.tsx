"use client"

import React, { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { fetchCreditBalance } from '@/lib/credits'
import { useAuth } from '@/contexts/AuthContext'

interface Props {
  onOpenTopUp?: () => void
  refreshSignal?: number
}

export default function CreditBadge({ onOpenTopUp, refreshSignal }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!user?.id) return
      setLoading(true)
      try {
        const b = await fetchCreditBalance(user.id)
        if (mounted) setBalance(b.total_balance)
      } catch (_) {}
      finally { if (mounted) setLoading(false) }
    }
    run()
    const id = setInterval(run, 30_000)
    return () => { mounted = false; clearInterval(id) }
  }, [user?.id, refreshSignal])

  if (!user?.id) return null

  return (
    <button
      type="button"
      onClick={onOpenTopUp}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-orange-200 bg-white hover:bg-orange-50 text-sm shadow-sm"
    >
      <Wallet className="w-4 h-4 text-orange-600" />
      <span className="font-semibold text-gray-900">
        {loading ? '—' : (balance ?? 0)} crédits
      </span>
      <span className="text-xs text-orange-700 font-medium">Recharger</span>
    </button>
  )
}
