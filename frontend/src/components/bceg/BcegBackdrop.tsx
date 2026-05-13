'use client'

import React from 'react'

interface BcegBackdropProps {
  opacity?: number
  light?: boolean
}

export default function BcegBackdrop({ opacity: _opacity, light: _light }: BcegBackdropProps = {}) {
  return (
    <div
      className="fixed inset-0 z-0 bg-gradient-to-b from-white via-slate-50 to-white"
      aria-hidden="true"
    />
  )
}
