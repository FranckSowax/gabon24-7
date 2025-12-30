'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Wallet, Users, Plus, Minus, Search, RefreshCw } from 'lucide-react'

interface ClientRow {
  user_id: string
  email: string | null
  balance: number
  bonus_balance: number
  total_balance: number
  updated_at: string
}

export default function AdminClientsPage() {
  const { user } = useAuth()

  const [adminSecret, setAdminSecret] = useState<string>('')
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    // try reading dev secret from localStorage
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('admin_secret')
      if (s) setAdminSecret(s)
    }
  }, [])

  const authHeaders = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    try {
      const { supabase } = await import('@/lib/auth')
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) headers['Authorization'] = `Bearer ${token}`
    } catch {}
    if (adminSecret) headers['x-admin-secret'] = adminSecret
    return headers
  }

  const fetchClients = async (pg = page) => {
    setLoading(true)
    setError(null)
    try {
      const headers = await authHeaders()
      const url = new URL(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/clients`, window.location.origin)
      url.searchParams.set('action', 'list')
      url.searchParams.set('page', String(pg))
      url.searchParams.set('perPage', String(perPage))
      const resp = await fetch(url.toString(), { headers })
      const json = await resp.json()
      if (!json?.success) throw new Error(json?.error || 'Erreur chargement clients')
      setClients(json.clients || [])
      setTotal(json.total || 0)
      setPage(json.page || 1)
    } catch (e: any) {
      setError(e?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c => (c.email || '').toLowerCase().includes(q) || c.user_id.includes(q))
  }, [clients, search])

  const adjust = async (user_id: string, delta: number, type: 'standard' | 'bonus' = 'standard') => {
    try {
      const headers = await authHeaders()
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'adjust', userId: user_id, delta, type })
      })
      const json = await resp.json()
      if (!json?.success) throw new Error(json?.error || 'Ajustement échoué')
      // refresh list
      await fetchClients(page)
    } catch (e: any) {
      alert(e?.message || 'Erreur ajustement')
    }
  }

  const initUser = async (user_id: string) => {
    try {
      const headers = await authHeaders()
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'init', userId: user_id, initialCredits: 5 })
      })
      const json = await resp.json()
      if (!json?.success) throw new Error(json?.error || 'Initialisation échouée')
      await fetchClients(page)
    } catch (e: any) {
      alert(e?.message || 'Erreur initialisation')
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center"><Users className="w-5 h-5"/></div>
                <h1 className="text-2xl font-extrabold text-gray-900">Clients & Crédits</h1>
              </div>
              <button onClick={() => fetchClients(page)} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50">
                <RefreshCw className="w-4 h-4"/> Rafraîchir
              </button>
            </div>

            {/* Admin Secret helper */}
            <div className="mb-4 p-3 rounded-xl border bg-gray-50">
              <p className="text-sm text-gray-600 mb-2">Option dev: si votre email n'est pas dans ADMIN_EMAILS/ADMIN_DOMAIN, saisissez le <strong>Admin Secret</strong> (Netlify env ADMIN_SECRET). Il sera stocké en localStorage.</p>
              <div className="flex gap-2">
                <input value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} placeholder="Admin secret" className="flex-1 border rounded-lg px-3 py-2" />
                <button onClick={() => { localStorage.setItem('admin_secret', adminSecret); alert('Secret enregistré'); }} className="px-4 py-2 rounded-lg bg-gray-900 text-white">Enregistrer</button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-2 top-2.5"/>
                  <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Rechercher par email ou user_id" className="pl-8 pr-3 py-2 border rounded-lg w-64"/>
                </div>
              </div>
              <div className="text-sm text-gray-600">Total: {total}</div>
            </div>

            <div className="overflow-x-auto border rounded-2xl bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="text-left px-4 py-2">Utilisateur</th>
                    <th className="text-left px-4 py-2">Email</th>
                    <th className="text-right px-4 py-2">Solde</th>
                    <th className="text-right px-4 py-2">Bonus</th>
                    <th className="text-right px-4 py-2">Total</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-6" colSpan={6}>Chargement...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td className="px-4 py-6" colSpan={6}>Aucun client.</td></tr>
                  ) : (
                    filtered.map(c => (
                      <tr key={c.user_id} className="border-t">
                        <td className="px-4 py-2 font-mono text-xs text-gray-700">{c.user_id}</td>
                        <td className="px-4 py-2">{c.email || '—'}</td>
                        <td className="px-4 py-2 text-right">{c.balance}</td>
                        <td className="px-4 py-2 text-right">{c.bonus_balance}</td>
                        <td className="px-4 py-2 text-right font-semibold">{c.total_balance}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-gray-700 hover:bg-gray-50" onClick={() => adjust(c.user_id, +10, 'standard')}><Plus className="w-4 h-4"/> +10</button>
                            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-gray-700 hover:bg-gray-50" onClick={() => adjust(c.user_id, -10, 'standard')}><Minus className="w-4 h-4"/> -10</button>
                            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-orange-700 hover:bg-orange-50" onClick={() => adjust(c.user_id, +10, 'bonus')}><Wallet className="w-4 h-4"/> +10 bonus</button>
                            <button className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-gray-700 hover:bg-gray-50" onClick={() => initUser(c.user_id)}>Init</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
    </div>
  )
}
