"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { X, Wallet, Loader2, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

interface CreditPackage {
  id: string
  name: string
  slug: string
  credits: number
  bonus_credits: number
  price_xaf: number
  price_usd: number
  discount_percentage: number
  is_popular: boolean
  description: string
  features: string[]
}

interface TopUpModalProps {
  open: boolean
  onClose: () => void
  onPurchased?: (newBalance: number) => void
}

export default function TopUpModal({ open, onClose, onPurchased }: TopUpModalProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/credits-premium/packages`)
        const data = await res.json()
        if (active && data.success) {
          setPackages(data.packages)
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Erreur chargement des forfaits')
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [open])

  const selectedPkg = useMemo(() => packages.find(p => p.id === selected) || null, [packages, selected])

  const handlePurchase = () => {
    if (!user?.id || !selectedPkg) return

    // Fermer le modal et rediriger vers la page de paiement E-Billing
    onClose()

    const params = new URLSearchParams({
      type: 'credits',
      packageId: selectedPkg.id,
      amount: selectedPkg.price_xaf.toString(),
      credits: selectedPkg.credits.toString(),
      bonus: (selectedPkg.bonus_credits || 0).toString(),
      description: `${selectedPkg.name} - ${selectedPkg.credits + (selectedPkg.bonus_credits || 0)} crédits`,
    })

    router.push(`/paiement?${params.toString()}`)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl border border-gray-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center"><Wallet className="w-5 h-5"/></div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900">Recharger mes crédits</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {loading ? (
            <div className="col-span-2 flex items-center justify-center py-10 text-gray-500">
              <Loader2 className="w-5 h-5 mr-2 animate-spin"/> Chargement des forfaits...
            </div>
          ) : (
            packages.map((p) => (
              <label key={p.id} className={`border rounded-xl p-4 cursor-pointer hover:shadow transition-all ${selected === p.id ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200'}`}>
                <input type="radio" name="credit_pkg" className="hidden" checked={selected === p.id} onChange={() => setSelected(p.id)} />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-base sm:text-lg font-bold text-gray-900">{p.name}</div>
                    <div className="text-gray-600 text-sm mt-1">{p.credits} crédits {p.bonus_credits ? `+ ${p.bonus_credits} bonus` : ''}</div>
                  </div>
                  <div className="text-orange-700 font-semibold">{p.price_xaf.toLocaleString()} XAF</div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Annuler</button>
          <button
            disabled={!selected}
            onClick={handlePurchase}
            className={`px-5 py-2 rounded-lg text-white font-semibold flex items-center gap-2 ${!selected ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800'}`}
          >
            Payer
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
