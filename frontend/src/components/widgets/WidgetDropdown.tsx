'use client'

import { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface WidgetDropdownProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}

/**
 * Carte repliable : n'affiche que son titre, se déploie au clic.
 * Utilise <details> natif (pas d'état JS, accessible).
 */
export default function WidgetDropdown({ title, icon, children, defaultOpen = false }: WidgetDropdownProps) {
  return (
    <details open={defaultOpen} className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between font-semibold text-gray-800 list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 transition-colors">
        <span className="flex items-center gap-2">
          {icon && <span className="text-lg leading-none">{icon}</span>}
          {title}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 pt-1 border-t border-gray-100">
        {children}
      </div>
    </details>
  )
}
