'use client'

import React, { useEffect, useRef, useState } from 'react'

interface LazyMountProps {
  children: React.ReactNode
  rootMargin?: string
  className?: string
  once?: boolean
}

export default function LazyMount({ children, rootMargin = '200px', className = '', once = true }: LazyMountProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    // If IntersectionObserver not supported, render immediately
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once && ref.current) observer.unobserve(ref.current)
          } else if (!once) {
            setVisible(false)
          }
        })
      },
      { root: null, rootMargin, threshold: 0.01 }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [rootMargin, once])

  return (
    <div ref={ref} className={className}>
      {visible ? children : (
        <div aria-hidden="true" className="animate-pulse">
          <div className="h-24 bg-gray-100 rounded-lg" />
        </div>
      )}
    </div>
  )
}
