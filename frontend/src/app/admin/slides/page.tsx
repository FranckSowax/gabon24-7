'use client'

import { useState, useEffect } from 'react'
import axios from '@/lib/axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface Campaign {
  id: string
  company_name: string
  contact_email: string
  payment_status: string
  is_approved: boolean
  is_active: boolean
  ad_packages: {
    name: string
    price_fcfa: number
  }
  promotional_slides: Array<{
    id: string
    title: string
    description: string
    image_url: string
    view_count: number
    click_count: number
    is_active: boolean
  }>
}

export default function AdminSlidesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCampaigns = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/campaigns`)
      if (response.data.success) {
        setCampaigns(response.data.campaigns)
      }
    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (campaignId: string, approved: boolean) => {
    try {
      await axios.put(`${API_URL}/api/admin/campaigns/${campaignId}/approve`, { approved })
      fetchCampaigns()
      alert(`Campagne ${approved ? 'approuvée' : 'rejetée'}`)
    } catch (error) {
      alert('Erreur lors de l\'approbation')
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  if (loading) {
    return <div className="p-8">Chargement...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Administration - Slides Publicitaires</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Entreprise
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Forfait
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{campaign.company_name}</div>
                  <div className="text-sm text-gray-500">{campaign.contact_email}</div>
                </td>
                <td className="px-6 py-4">
                  <div>{campaign.ad_packages.name}</div>
                  <div className="text-sm text-gray-500">
                    {campaign.ad_packages.price_fcfa.toLocaleString()} FCFA
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    campaign.is_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {campaign.is_approved ? 'Approuvée' : 'En attente'}
                  </span>
                </td>
                <td className="px-6 py-4 space-x-2">
                  {!campaign.is_approved && (
                    <>
                      <button
                        onClick={() => handleApproval(campaign.id, true)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Approuver
                      </button>
                      <button
                        onClick={() => handleApproval(campaign.id, false)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Rejeter
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
