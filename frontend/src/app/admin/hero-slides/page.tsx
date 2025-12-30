'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, Save } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface HeroSlide {
  id: string
  sort_order: number
  is_active: boolean
  badge_text: string | null
  badge_color: string
  title: string
  subtitle: string | null
  description: string | null
  button_text: string | null
  button_url: string | null
  button_style: 'primary' | 'secondary' | 'outline'
  background_type: 'gradient' | 'image' | 'color'
  background_value: string
  background_image: string | null
  text_color: string
}

interface SlideForm {
  badge_text: string
  badge_color: string
  title: string
  subtitle: string
  description: string
  button_text: string
  button_url: string
  button_style: 'primary' | 'secondary' | 'outline'
  background_type: 'gradient' | 'image' | 'color'
  background_value: string
  background_image: string
  text_color: string
}

const DEFAULT_GRADIENTS = [
  { name: 'Orange-Rouge', value: 'from-orange-500 via-red-500 to-pink-600' },
  { name: 'Vert-Cyan', value: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { name: 'Violet-Indigo', value: 'from-purple-500 via-violet-500 to-indigo-600' },
  { name: 'Bleu-Cyan', value: 'from-blue-500 via-cyan-500 to-teal-600' },
  { name: 'Rose-Orange', value: 'from-pink-500 via-rose-500 to-orange-600' },
]

export default function HeroSlidesAdmin() {
  const router = useRouter()
  const { user } = useAuth()
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingSlide, setEditingSlide] = useState<string | null>(null)
  const [formData, setFormData] = useState<SlideForm>({
    badge_text: '',
    badge_color: '#F59E0B',
    title: '',
    subtitle: '',
    description: '',
    button_text: '',
    button_url: '',
    button_style: 'primary',
    background_type: 'gradient',
    background_value: 'from-orange-500 via-red-500 to-pink-600',
    background_image: '',
    text_color: '#FFFFFF',
  })

  useEffect(() => {
    loadSlides()
  }, [])

  const loadSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setSlides(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Erreur chargement slides:', error)
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const slideData = {
        ...formData,
        sort_order: editingSlide ? undefined : slides.length + 1,
        is_active: true,
      }

      if (editingSlide) {
        // Mise à jour
        const { error } = await supabase
          .from('hero_slides')
          .update(slideData)
          .eq('id', editingSlide)

        if (error) throw error
        alert('Slide mis à jour !')
      } else {
        // Création
        const { error } = await supabase.from('hero_slides').insert(slideData)

        if (error) throw error
        alert('Slide créé !')
      }

      // Reset form
      setFormData({
        badge_text: '',
        badge_color: '#F59E0B',
        title: '',
        subtitle: '',
        description: '',
        button_text: '',
        button_url: '',
        button_style: 'primary',
        background_type: 'gradient',
        background_value: 'from-orange-500 via-red-500 to-pink-600',
        background_image: '',
        text_color: '#FFFFFF',
      })
      setShowForm(false)
      setEditingSlide(null)
      loadSlides()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const handleEdit = (slide: HeroSlide) => {
    setFormData({
      badge_text: slide.badge_text || '',
      badge_color: slide.badge_color,
      title: slide.title,
      subtitle: slide.subtitle || '',
      description: slide.description || '',
      button_text: slide.button_text || '',
      button_url: slide.button_url || '',
      button_style: slide.button_style,
      background_type: slide.background_type,
      background_value: slide.background_value,
      background_image: slide.background_image || '',
      text_color: slide.text_color,
    })
    setEditingSlide(slide.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce slide ?')) return

    try {
      const { error } = await supabase.from('hero_slides').delete().eq('id', id)
      if (error) throw error
      alert('Slide supprimé !')
      loadSlides()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const toggleActive = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('hero_slides')
        .update({ is_active: !currentState })
        .eq('id', id)

      if (error) throw error
      loadSlides()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  const moveSlide = async (id: string, direction: 'up' | 'down') => {
    const index = slides.findIndex((s) => s.id === id)
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === slides.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newSlides = [...slides]
    ;[newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]]

    // Mettre à jour les sort_order
    try {
      for (let i = 0; i < newSlides.length; i++) {
        await supabase
          .from('hero_slides')
          .update({ sort_order: i + 1 })
          .eq('id', newSlides[i].id)
      }
      loadSlides()
    } catch (error: any) {
      alert('Erreur: ' + error.message)
    }
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion Hero Slider</h1>
            <p className="text-gray-600 mt-2">Gérer les slides de la bannière principale</p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm)
              setEditingSlide(null)
            }}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-700"
          >
            <Plus className="w-5 h-5" />
            Nouveau Slide
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border">
            <h2 className="text-xl font-bold mb-4">
              {editingSlide ? 'Modifier le slide' : 'Nouveau slide'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Badge */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texte du badge
                  </label>
                  <input
                    type="text"
                    value={formData.badge_text}
                    onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="NOUVEAU, OFFRE..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Couleur badge
                  </label>
                  <input
                    type="color"
                    value={formData.badge_color}
                    onChange={(e) => setFormData({ ...formData, badge_color: e.target.value })}
                    className="w-full h-10 border rounded-lg"
                  />
                </div>
              </div>

              {/* Titre et Sous-titre */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titre *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sous-titre
                  </label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              {/* Bouton */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texte bouton
                  </label>
                  <input
                    type="text"
                    value={formData.button_text}
                    onChange={(e) => setFormData({ ...formData, button_text: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL bouton
                  </label>
                  <input
                    type="text"
                    value={formData.button_url}
                    onChange={(e) => setFormData({ ...formData, button_url: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="/abonnement"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Style bouton
                  </label>
                  <select
                    value={formData.button_style}
                    onChange={(e) => setFormData({ ...formData, button_style: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                  </select>
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de fond
                </label>
                <select
                  value={formData.background_type}
                  onChange={(e) => setFormData({ ...formData, background_type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg mb-2"
                >
                  <option value="gradient">Dégradé</option>
                  <option value="image">Image</option>
                  <option value="color">Couleur unie</option>
                </select>

                {formData.background_type === 'gradient' && (
                  <select
                    value={formData.background_value}
                    onChange={(e) => setFormData({ ...formData, background_value: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {DEFAULT_GRADIENTS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}

                {formData.background_type === 'image' && (
                  <input
                    type="text"
                    value={formData.background_image}
                    onChange={(e) => setFormData({ ...formData, background_image: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="URL de l'image"
                  />
                )}

                {formData.background_type === 'color' && (
                  <input
                    type="color"
                    value={formData.background_value}
                    onChange={(e) => setFormData({ ...formData, background_value: e.target.value })}
                    className="w-full h-10 border rounded-lg"
                  />
                )}
              </div>

              {/* Couleur texte */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Couleur du texte
                </label>
                <input
                  type="color"
                  value={formData.text_color}
                  onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                  className="w-full h-10 border rounded-lg"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingSlide ? 'Mettre à jour' : 'Créer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingSlide(null)
                  }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Liste des slides */}
        <div className="space-y-4">
          {slides.map((slide, index) => (
            <div key={slide.id} className="bg-white rounded-xl shadow border p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {slide.badge_text && (
                      <span
                        className="px-2 py-1 rounded text-xs font-bold"
                        style={{ backgroundColor: slide.badge_color, color: '#000' }}
                      >
                        {slide.badge_text}
                      </span>
                    )}
                    <h3 className="text-xl font-bold">
                      {slide.title}
                      {slide.subtitle && <span className="text-orange-600"> {slide.subtitle}</span>}
                    </h3>
                    {!slide.is_active && (
                      <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        Inactif
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm">{slide.description}</p>
                  {slide.button_text && (
                    <p className="text-sm text-gray-500 mt-2">
                      Bouton: "{slide.button_text}" → {slide.button_url}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => moveSlide(slide.id, 'up')}
                    disabled={index === 0}
                    className="p-2 hover:bg-gray-100 rounded disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveSlide(slide.id, 'down')}
                    disabled={index === slides.length - 1}
                    className="p-2 hover:bg-gray-100 rounded disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(slide.id, slide.is_active)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    {slide.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(slide)}
                    className="p-2 hover:bg-gray-100 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(slide.id)}
                    className="p-2 hover:bg-red-50 rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {slides.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucun slide. Cliquez sur "Nouveau Slide" pour commencer.
          </div>
        )}
      </div>
    </div>
  )
}
