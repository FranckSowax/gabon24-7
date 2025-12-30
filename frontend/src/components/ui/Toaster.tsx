"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  addToast: (t: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const toast: Toast = { id, duration: 4000, ...t }
    setToasts((prev) => [...prev, toast])
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => removeToast(id), toast.duration)
    }
  }, [removeToast])

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Viewport */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border shadow-lg p-3 sm:p-4 bg-white flex items-start gap-3 ${
              t.kind === 'success' ? 'border-green-200' : t.kind === 'error' ? 'border-red-200' : 'border-blue-200'
            }`}
          >
            <div className={`mt-0.5 h-2 w-2 rounded-full ${t.kind === 'success' ? 'bg-green-600' : t.kind === 'error' ? 'bg-red-600' : 'bg-blue-600'}`} />
            <div className="flex-1">
              {t.title && <div className="font-semibold text-gray-900">{t.title}</div>}
              <div className="text-sm text-gray-700">{t.message}</div>
            </div>
            <button
              className="text-gray-400 hover:text-gray-600"
              onClick={() => removeToast(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
