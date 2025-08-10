'use client'

import React, { useState, useEffect } from 'react'
import axios from 'axios'

interface RSSFeed {
  id: string
  name: string
  url: string
  category: string
  status: 'active' | 'inactive' | 'error'
  lastFetch: string
  articlesCount: number
}

export default function RSSFeedsPage() {
  const [feeds, setFeeds] = useState<RSSFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFeed, setNewFeed] = useState({
    name: '',
    url: '',
    category: 'Actualités'
  })

  const gabonMedias = [
    { name: 'L\'Union', url: 'https://www.lunion.ga/rss', category: 'Actualités' },
    { name: 'Gabon Matin', url: 'https://www.gabonmatin.com/rss', category: 'Actualités' },
    { name: 'Gabon Review', url: 'https://www.gabonreview.com/rss', category: 'Actualités' },
    { name: 'Info241', url: 'https://www.info241.com/rss', category: 'Actualités' },
    { name: 'Gabon Eco', url: 'https://www.gaboneco.com/rss', category: 'Économie' }
  ]

  const categories = ['Actualités', 'Économie', 'Politique', 'Sports', 'Culture', 'Société']

  useEffect(() => {
    fetchFeeds()
  }, [])

  const fetchFeeds = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/admin/rss-feeds')
      setFeeds(response.data.feeds || [])
    } catch (error: any) {
      console.error('Erreur lors du chargement des flux RSS:', error)
      setFeeds([])
    } finally {
      setLoading(false)
    }
  }

  const addFeed = async () => {
    try {
      await axios.post('http://localhost:3001/api/admin/rss-feeds', newFeed)
      setNewFeed({ name: '', url: '', category: 'Actualités' })
      setShowAddModal(false)
      fetchFeeds()
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout:', error)
    }
  }

  const testFeed = async (feedId: string) => {
    try {
      await axios.post(`http://localhost:3001/api/admin/rss-feeds/${feedId}/test`)
      fetchFeeds()
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error)
    }
  }

  const deleteFeed = async (feedId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce flux RSS ?')) {
      try {
        console.log(`Tentative de suppression du flux ${feedId}`)
        const response = await axios.delete(`http://localhost:3001/api/admin/rss-feeds/${feedId}`)
        console.log('Réponse suppression:', response.data)
        
        if (response.data.success) {
          console.log('Suppression réussie, actualisation de la liste')
          await fetchFeeds()
          alert('Flux RSS supprimé avec succès !')
        } else {
          console.error('Échec de la suppression:', response.data.message)
          alert('Erreur lors de la suppression: ' + response.data.message)
        }
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error)
        if (error.response) {
          console.error('Détails de l\'erreur:', error.response.data)
          alert('Erreur lors de la suppression: ' + (error.response.data.message || error.response.data.error || 'Erreur inconnue'))
        } else {
          alert('Erreur de connexion lors de la suppression')
        }
      }
    }
  }

  const resetAllFeeds = async () => {
    try {
      const response = await axios.post('http://localhost:3001/api/admin/rss-feeds/reset-all')
      alert(response.data.message)
      fetchFeeds()
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error)
      alert('Erreur lors de la réinitialisation des flux')
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Gestion des Flux RSS</h1>
        <p className="text-gray-600">Gérez les sources d'actualités gabonaises</p>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
          >
            Ajouter un flux
          </button>
          <button
            onClick={fetchFeeds}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
          >
            Actualiser
          </button>
          <button
            onClick={resetAllFeeds}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
          >
            ✅ Réinitialiser tous les flux
          </button>
        </div>
        <div className="text-sm text-gray-500">
          {feeds.length} flux configurés
        </div>
      </div>

      {/* Flux RSS Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Média
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                URL
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Catégorie
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Articles
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                </td>
              </tr>
            ) : feeds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Aucun flux RSS configuré
                </td>
              </tr>
            ) : (
              feeds.map((feed) => (
                <tr key={feed.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{feed.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 truncate max-w-xs">
                      {feed.url}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {feed.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      feed.status === 'active' ? 'bg-green-100 text-green-800' :
                      feed.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {feed.status === 'active' ? 'Actif' : 
                       feed.status === 'error' ? 'Erreur' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {feed.articlesCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => testFeed(feed.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Tester
                      </button>
                      <button
                        onClick={() => deleteFeed(feed.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ajout */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">Ajouter un flux RSS</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom du média
                </label>
                <input
                  type="text"
                  value={newFeed.name}
                  onChange={(e) => setNewFeed({...newFeed, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Ex: L'Union"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL du flux RSS
                </label>
                <input
                  type="url"
                  value={newFeed.url}
                  onChange={(e) => setNewFeed({...newFeed, url: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="https://example.com/rss"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={newFeed.category}
                  onChange={(e) => setNewFeed({...newFeed, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={addFeed}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Médias suggérés */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Médias gabonais suggérés</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gabonMedias.map((media, index) => (
            <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900">{media.name}</h4>
              <p className="text-sm text-gray-500 mb-2">{media.category}</p>
              <p className="text-xs text-gray-400 mb-3 truncate">{media.url}</p>
              <button
                onClick={() => {
                  setNewFeed({
                    name: media.name,
                    url: media.url,
                    category: media.category
                  })
                  setShowAddModal(true)
                }}
                className="text-sm bg-orange-100 text-orange-600 px-3 py-1 rounded hover:bg-orange-200"
              >
                Ajouter ce flux
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
