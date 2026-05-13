'use client'

import React from 'react'
import { BCEG_BACKDROP_IMAGE } from './BcegTheme'

interface BcegBackdropProps {
  opacity?: number
  light?: boolean
}

export default function BcegBackdrop({ opacity = 0.55, light = false }: BcegBackdropProps) {
  const o = light ? 0.4 : opacity
  const top = Math.min(1, o + 0.1).toFixed(2)
  const mid = o.toFixed(2)
  const bot = Math.min(1, o + 0.15).toFixed(2)

  return (
    <>
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url('${BCEG_BACKDROP_IMAGE}')` }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-0"
        style={{
          background: `linear-gradient(to bottom, rgba(255,255,255,${top}), rgba(255,255,255,${mid}) 50%, rgba(255,255,255,${bot}))`,
          backdropFilter: 'blur(2px)',
        }}
        aria-hidden="true"
      />
    </>
  )
}
