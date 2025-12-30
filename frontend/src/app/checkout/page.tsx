'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Page de redirection vers le checkout des campagnes
 * Cette page redirige automatiquement vers /checkout-campaigns
 */
export default function CheckoutPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirection automatique vers le bon checkout
    router.push('/checkout-campaigns')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirection en cours...</p>
      </div>
    </div>
  )
}
