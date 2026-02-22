'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import ScrollToTop from '@/components/ui/ScrollToTop'
import { useAuth } from '@/contexts/AuthContext'
import { Loading } from '@/components/ui/Loading'
import { Check, Settings, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`
  return headers
}

interface AudioSettings {
  daily_summary_enabled?: boolean
  delivery_time?: string
  whatsapp_number?: string | null
  preferred_voice?: string
  pace?: 'slow' | 'normal' | 'fast'
}

const VOICES = [
  { value: 'af_nicole', label: 'Nicole (FR)' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'aria', label: 'Aria' },
  { value: 'verse', label: 'Verse' },
  { value: 'cove', label: 'Cove' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dailyEnabled, setDailyEnabled] = useState(false)
  const [deliveryTime, setDeliveryTime] = useState('07:00')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [preferredVoice, setPreferredVoice] = useState('af_nicole')
  const [pace, setPace] = useState<'slow'|'normal'|'fast'>('normal')

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return
      try {
        setLoading(true)
        const headers = await getAuthHeaders()
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audio/settings/${user.id}`, { headers })
        const json = await res.json()
        if (json?.success) {
          const s: AudioSettings = json.settings || {}
          setDailyEnabled(!!s.daily_summary_enabled)
          if (s.delivery_time) setDeliveryTime(s.delivery_time)
          const wa = (json.whatsapp_number || s.whatsapp_number || '') as string
          setWhatsappNumber(wa || '')
          if (s.preferred_voice) setPreferredVoice(s.preferred_voice)
          if (s.pace) setPace(s.pace as any)
        }
      } catch (e) {
        setError('Erreur chargement paramètres')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id])

  const save = async () => {
    if (!user?.id) return
    try {
      setSaving(true)
      setError(null)
      const headers = await getAuthHeaders()
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/audio/settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ userId: user.id, dailyEnabled, deliveryTime, whatsappNumber, preferredVoice, pace })
      })
      const json = await res.json()
      if (!json?.success) {
        setError(json.error || 'Échec de la sauvegarde')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      <div className="flex">
        <Sidebar isMobileOpen={isMobileMenuOpen} onMobileClose={() => setIsMobileMenuOpen(false)} />

        <main className="flex-1 lg:ml-64">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-orange-200 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                  <Settings className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 font-medium">Paramètres</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-800 bg-clip-text text-transparent">Résumés Audio</h1>
            </div>

            <div className="bg-white/90 border border-orange-200 rounded-3xl p-5 shadow-lg">
              {loading ? (
                <Loading />
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-gray-900">Activer le résumé quotidien</label>
                    <input type="checkbox" checked={dailyEnabled} onChange={(e) => setDailyEnabled(e.target.checked)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Heure d'envoi</label>
                      <input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} className="w-full border border-orange-200 rounded-xl p-3" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Numéro WhatsApp</label>
                      <input type="tel" placeholder="+241 XX XX XX XX" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className="w-full border border-orange-200 rounded-xl p-3" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Voix</label>
                      <select value={preferredVoice} onChange={(e) => setPreferredVoice(e.target.value)} className="w-full border border-orange-200 rounded-xl p-3">
                        {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Vitesse</label>
                      <select value={pace} onChange={(e) => setPace(e.target.value as any)} className="w-full border border-orange-200 rounded-xl p-3">
                        <option value="slow">Lent</option>
                        <option value="normal">Normal</option>
                        <option value="fast">Rapide</option>
                      </select>
                    </div>
                  </div>

                  {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

                  <div className="flex items-center justify-end gap-3">
                    {saved && (
                      <span className="inline-flex items-center gap-2 text-green-700 text-sm"><Check className="w-4 h-4" /> Sauvegardé</span>
                    )}
                    <button onClick={save} disabled={saving} className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold ${saving ? 'bg-gray-300 text-gray-600' : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white shadow'}`}>
                      <Save className="w-5 h-5" />
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      <ScrollToTop />
    </div>
  )
}
