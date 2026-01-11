"use client"

import React from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'

interface HeaderProps {
  onMobileMenuToggle?: () => void
  onSearch?: (query: string) => void
  onOpenTopUp?: () => void
}

export default function Header({ onMobileMenuToggle }: HeaderProps) {
  return (
    <header className="bg-white/95 backdrop-blur border-b border-gray-200 sticky top-0 z-50 h-16">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between py-1.5 sm:py-2">
          {/* Left: Mobile menu button */}
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Ouvrir le menu"
              onClick={onMobileMenuToggle}
              className="lg:hidden inline-flex items-center justify-center rounded-md p-1.5 text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Center: Brand logo (clickable) */}
          <div className="flex-1 flex items-center justify-center lg:justify-start">
            <a href="/" className="inline-flex items-center gap-2 min-w-0">
              <img
                src="/LOGO GABON INSIGHT DRAPEAU psd-Récupéré.png"
                alt="Gabon Insight"
                className="h-11 sm:h-12 md:h-13 lg:h-14 w-auto object-contain select-none"
                draggable={false}
              />
            </a>
          </div>

          {/* Right: Notifications */}
          <div className="flex items-center justify-end gap-2">
            <NotificationBell />
          </div>
        </div>
      </div>
    </header>
  )
}
