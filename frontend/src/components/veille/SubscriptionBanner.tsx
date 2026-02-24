'use client'

import Link from 'next/link'
import { Crown, Clock, ArrowRight } from 'lucide-react'

interface SubscriptionBannerProps {
  planName: string
  planSlug: string
  status: string
  expiresAt: string
  currentAlertCount?: number
  maxAlerts?: number
}

export default function SubscriptionBanner({
  planName,
  planSlug,
  status,
  expiresAt,
  currentAlertCount = 0,
  maxAlerts = 5
}: SubscriptionBannerProps) {
  const expiryDate = new Date(expiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const isTrial = status === 'trial'
  const isParticulier = planSlug === 'particulier'
  const alertsUsed = maxAlerts === -1 ? null : `${currentAlertCount}/${maxAlerts}`

  return (
    <div className={`rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
      isTrial
        ? 'bg-amber-50 border border-amber-200'
        : 'bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
          isTrial ? 'bg-amber-100' : 'bg-orange-100'
        }`}>
          {isTrial ? (
            <Clock className="w-4 h-4 text-amber-600" />
          ) : (
            <Crown className="w-4 h-4 text-orange-600" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {isTrial ? 'Demo' : `Plan ${planName}`}
            </span>
            {alertsUsed && (
              <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-500 border border-gray-200">
                {alertsUsed} alertes
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {isTrial ? 'Expire' : 'Valable jusqu\'au'} {expiryDate}
          </p>
        </div>
      </div>

      {(isTrial || isParticulier) && (
        <Link
          href={isTrial ? '/veille-alertes#tarifs' : '/veille-alertes/subscribe?plan=entreprise'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
        >
          {isTrial ? 'S\'abonner' : 'Passer a Entreprise'}
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}
