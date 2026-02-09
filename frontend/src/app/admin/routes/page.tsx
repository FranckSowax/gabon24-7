'use client'

import { useState, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { Plus, Edit, Trash2, Eye, MapPin, Save, X, GripVertical } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Route {
  id: string
  title: string
  subtitle?: string
  google_maps_url?: string
  embed_url?: string
  html_content?: string
  display_order: number
  is_active: boolean
  created_at: string
  category?: 'morning' | 'evening'
}

export default function RoutesAdminPage() {
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [previewRoute, setPreviewRoute] = useState<Route | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    google_maps_url: '',
    html_content: '',
    content_type: 'url' as 'url' | 'html',
    display_order: 0,
    is_active: true,
    category: undefined as 'morning' | 'evening' | undefined
  })

  useEffect(() => {
  }, [])

  const loadRoutes = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/routes`)
      const data = await res.json()
      
      if (data.success && data.routes) {
        setRoutes(data.routes.sort((a: Route, b: Route) => a.display_order - b.display_order))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des trajets:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingRoute 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/routes/${editingRoute.id}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/routes`
      
      const method = editingRoute ? 'PUT' : 'POST'
      const body = {
        title: formData.title,
        subtitle: formData.subtitle,
        google_maps_url: formData.content_type === 'url' ? formData.google_maps_url : null,
        html_content: formData.content_type === 'html' ? formData.html_content : null,
        display_order: formData.display_order,
        is_active: formData.is_active,
        category: formData.category
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()
      
      if (data.success) {
        await loadRoutes()
        setShowModal(false)
        resetForm()
        alert(editingRoute ? 'Trajet modifié avec succès' : 'Trajet créé avec succès')
      } else {
        alert('Erreur: ' + data.error)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la sauvegarde')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce trajet ?')) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/routes/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const data = await response.json()
      
      if (data.success) {
        await loadRoutes()
        alert('Trajet supprimé avec succès')
      } else {
        alert('Erreur: ' + data.error)
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const openModal = (route?: Route) => {
    if (route) {
      setEditingRoute(route)
      setFormData({
        title: route.title,
        subtitle: route.subtitle || '',
        google_maps_url: route.google_maps_url || '',
        html_content: route.html_content || '',
        content_type: route.html_content ? 'html' : 'url',
        display_order: route.display_order,
        is_active: route.is_active,
        category: route.category
      })
    } else {
      setEditingRoute(null)
      resetForm()
    }
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      subtitle: '',
      google_maps_url: '',
      html_content: '',
      content_type: 'url',
      display_order: routes.length,
      is_active: true,
      category: undefined
    })
    setEditingRoute(null)
  }

  const toggleActive = async (route: Route) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/routes/${route.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: route.title,
          subtitle: route.subtitle,
          google_maps_url: route.google_maps_url,
          html_content: route.html_content,
          display_order: route.display_order,
          is_active: !route.is_active,
          category: route.category
        })
      })

      const data = await response.json()
      
      if (data.success) {
        await loadRoutes()
      }
    } catch (error) {
      console.error('Erreur:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div>
              <h1 className="text-4xl font-bold mb-2">Gestion des Trajets</h1>
              <p className="text-orange-100 text-lg">Gérez les itinéraires Google Maps affichés sur le site</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => openModal()}
              className="bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-orange-50 transition-colors shadow-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>Nouveau Trajet</span>
            </motion.button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-orange-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-orange-100 rounded-xl">
                <MapPin className="w-6 h-6 text-orange-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{routes.length}</p>
                <p className="text-sm text-gray-500">Total Trajets</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-green-100 rounded-xl">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{routes.filter(r => r.is_active).length}</p>
                <p className="text-sm text-gray-500">Actifs</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-blue-100 rounded-xl">
                <GripVertical className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{routes.filter(r => r.category === 'morning').length}</p>
                <p className="text-sm text-gray-500">Matinée</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-purple-500"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-purple-100 rounded-xl">
                <GripVertical className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-800">{routes.filter(r => r.category === 'evening').length}</p>
                <p className="text-sm text-gray-500">Soir</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Routes List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
        >
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des trajets...</p>
            </div>
          ) : routes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-10 h-10 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucun trajet configuré</h3>
              <p className="text-gray-600 mb-6">Commencez par ajouter votre premier itinéraire</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => openModal()}
                className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-orange-600 transition-all duration-200 shadow-lg"
              >
                Ajouter un trajet
              </motion.button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Ordre</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Titre</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Sous-titre</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Catégorie</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Statut</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Date création</th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {routes.map((route) => (
                    <tr key={route.id} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{route.display_order}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{route.title}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {route.html_content ? '🔧 HTML/iframe' : '🌐 URL Google Maps'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">{route.subtitle || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        {route.category ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            route.category === 'morning' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {route.category === 'morning' ? '🌅 Matinée' : '🌆 Soir'}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Non catégorisé</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleActive(route)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${
                            route.is_active
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {route.is_active ? 'Actif' : 'Inactif'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(route.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => setPreviewRoute(route)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                            title="Prévisualiser"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openModal(route)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors duration-200"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(route.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal Formulaire */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingRoute ? 'Modifier le trajet' : 'Nouveau trajet'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titre du trajet *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    placeholder="Ex: Centre-ville - Aéroport"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sous-titre / Description
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    placeholder="Ex: Distance: 15km | Durée: 25 min"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de contenu *
                  </label>
                  <div className="flex space-x-4 mb-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="content_type"
                        value="url"
                        checked={formData.content_type === 'url'}
                        onChange={(e) => setFormData({ ...formData, content_type: e.target.value as 'url' | 'html' })}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">URL Google Maps</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="content_type"
                        value="html"
                        checked={formData.content_type === 'html'}
                        onChange={(e) => setFormData({ ...formData, content_type: e.target.value as 'url' | 'html' })}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">Code HTML/iframe</span>
                    </label>
                  </div>
                </div>

                {formData.content_type === 'url' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL Google Maps *
                    </label>
                    <textarea
                      required={formData.content_type === 'url'}
                      value={formData.google_maps_url}
                      onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 h-24 resize-none"
                      placeholder="Collez l'URL complète de Google Maps ici..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Copiez l'URL depuis Google Maps (avec ou sans paramètres d'itinéraire)
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Code HTML/iframe *
                    </label>
                    <textarea
                      required={formData.content_type === 'html'}
                      value={formData.html_content}
                      onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 h-32 resize-none font-mono text-sm"
                      placeholder='<iframe src="https://www.google.com/maps/embed?pb=..." width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>'
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Collez le code HTML complet de l'iframe Google Maps ou tout autre contenu HTML
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Catégorisation temporelle
                  </label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value ? e.target.value as 'morning' | 'evening' : undefined })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Non catégorisé</option>
                    <option value="morning">🌅 Matinée (vers Libreville)</option>
                    <option value="evening">🌆 Soir (depuis Libreville)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    La catégorisation détermine le regroupement dans la liste déroulante du widget trafic
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ordre d'affichage
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      value={formData.is_active ? 'true' : 'false'}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="true">Actif</option>
                      <option value="false">Inactif</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors duration-200 font-medium"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-orange-600 transition-all duration-200 flex items-center space-x-2 font-medium shadow-lg hover:shadow-xl"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingRoute ? 'Mettre à jour' : 'Créer'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Prévisualisation */}
      <AnimatePresence>
        {previewRoute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setPreviewRoute(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{previewRoute?.title}</h2>
                    {previewRoute?.subtitle && (
                      <p className="text-gray-600 mt-1">{previewRoute.subtitle}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewRoute(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="h-96">
                {previewRoute?.html_content ? (
                  <div 
                    className="w-full h-full"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewRoute.html_content, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allowfullscreen', 'frameborder', 'src'] }) }}
                  />
                ) : (
                  <iframe
                    src={previewRoute?.embed_url}
                    className="w-full h-full border-none"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={previewRoute?.title}
                  />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
