'use client'

import ReadingHistory from '@/components/pages/ReadingHistory'

// Force dynamic rendering to avoid prerendering issues
export const dynamic = 'force-dynamic'

export default function HistoriquePage() {
  // Force rebuild - v2.1 - API Backend Integration Complete
  return (
    <ReadingHistory />
  )
}
