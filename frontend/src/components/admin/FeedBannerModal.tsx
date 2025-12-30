'use client'

import { useState, useRef } from 'react'
import { X, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface FeedBanner {
  id?: string
  title: string
  image_url: string
  mobile_image_url?: string
  redirect_url: string
  position: number
  is_active: boolean
  priority: number
  start_date: string
  end_date: string | null
}

interface FeedBannerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingBanner?: FeedBanner | null
}

export default function FeedBannerModal({ isOpen, onClose, onSuccess, editingBanner }: FeedBannerModalProps) {
  const [formData, setFormData] = useState({
    title: editingBanner?.title || '',
    redirect_url: editingBanner?.redirect_url || '',
    position: editingBanner?.position || 7,
    priority: editingBanner?.priority || 0,
    is_active: editingBanner?.is_active ?? true,
    start_date: editingBanner?.start_date ? new Date(editingBanner.start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    end_date: editingBanner?.end_date ? new Date(editingBanner.end_date).toISOString().split('T')[0] : ''
  })

  // Images Desktop et Mobile
  const [desktopImageFile, setDesktopImageFile] = useState<File | null>(null)
  const [desktopImagePreview, setDesktopImagePreview] = useState<string>(editingBanner?.image_url || '')
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null)
  const [mobileImagePreview, setMobileImagePreview] = useState<string>(editingBanner?.mobile_image_url || '')
  const [uploading, setUploading] = useState(false)
  const desktopFileInputRef = useRef<HTMLInputElement>(null)
  const mobileFileInputRef = useRef<HTMLInputElement>(null)

  const handleDesktopImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setDesktopImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setDesktopImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMobileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setMobileImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setMobileImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title || !formData.redirect_url) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    if (!editingBanner && (!desktopImageFile || !mobileImageFile)) {
      alert('Veuillez sélectionner les 2 images (desktop et mobile)')
      return
    }

    setUploading(true)

    try {
      let desktopImageUrl = editingBanner?.image_url || ''
      let mobileImageUrl = editingBanner?.mobile_image_url || ''

      // Upload de l'image desktop si nouvelle image
      if (desktopImageFile) {
        const formDataUpload = new FormData()
        formDataUpload.append('image', desktopImageFile)
        formDataUpload.append('imageType', 'feed-banner-desktop')

        const uploadResponse = await axios.post(`${API_URL}/api/admin/upload-image`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (uploadResponse.data.success) {
          desktopImageUrl = uploadResponse.data.image_url
        } else {
          throw new Error('Erreur upload image desktop')
        }
      }

      // Upload de l'image mobile si nouvelle image
      if (mobileImageFile) {
        const formDataUpload = new FormData()
        formDataUpload.append('image', mobileImageFile)
        formDataUpload.append('imageType', 'feed-banner-mobile')

        const uploadResponse = await axios.post(`${API_URL}/api/admin/upload-image`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        if (uploadResponse.data.success) {
          mobileImageUrl = uploadResponse.data.image_url
        } else {
          throw new Error('Erreur upload image mobile')
        }
      }

      // Préparer les données
      const bannerData = {
        title: formData.title,
        image_url: desktopImageUrl,
        mobile_image_url: mobileImageUrl,
        redirect_url: formData.redirect_url,
        position: formData.position,
        priority: formData.priority,
        is_active: formData.is_active,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      }

      let result
      if (editingBanner?.id) {
        // Mise à jour
        result = await supabase
          .from('feed_banners')
          .update(bannerData)
          .eq('id', editingBanner.id)
      } else {
        // Création
        result = await supabase
          .from('feed_banners')
          .insert([bannerData])
      }

      if (result.error) {
        throw result.error
      }

      alert(editingBanner ? '✅ Bannière mise à jour avec succès' : '✅ Bannière créée avec succès')
      onSuccess()
      onClose()

    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur lors de l\'enregistrement')
    } finally {
      setUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingBanner ? 'Modifier la bannière' : 'Ajouter une bannière feed'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Titre */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Titre de la bannière *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Promotion Spéciale"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          {/* URL de redirection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              URL de redirection *
            </label>
            <input
              type="url"
              value={formData.redirect_url}
              onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Position dans le feed *
            </label>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value={7}>Position 7 (après 6 articles)</option>
              <option value={14}>Position 14 (après 13 articles)</option>
              <option value={21}>Position 21 (après 20 articles)</option>
            </select>
          </div>

          {/* Priorité */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Priorité (plus élevé = affiché en premier)
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date de début *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date de fin (optionnel)
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Images upload - Desktop et Mobile */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-gray-900">Images de la bannière *</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Desktop */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🖥️</span>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">Desktop</label>
                    <p className="text-xs text-gray-500">1200 x 400 px (ratio 3:1)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {desktopImagePreview && (
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <img src={desktopImagePreview} alt="Preview Desktop" className="w-full h-auto" style={{ maxHeight: '200px', objectFit: 'cover' }} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => desktopFileInputRef.current?.click()}
                    className="w-full px-4 py-2 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors flex items-center justify-center gap-2 text-orange-600"
                  >
                    <Upload className="w-4 h-4" />
                    {desktopImagePreview ? 'Changer' : 'Sélectionner'}
                  </button>
                  <input ref={desktopFileInputRef} type="file" accept="image/*" onChange={handleDesktopImageSelect} className="hidden" />
                </div>
              </div>

              {/* Image Mobile */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📱</span>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700">Mobile</label>
                    <p className="text-xs text-gray-500">800 x 500 px (ratio 16:10)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {mobileImagePreview && (
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <img src={mobileImagePreview} alt="Preview Mobile" className="w-full h-auto" style={{ maxHeight: '200px', objectFit: 'cover' }} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => mobileFileInputRef.current?.click()}
                    className="w-full px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-blue-600"
                  >
                    <Upload className="w-4 h-4" />
                    {mobileImagePreview ? 'Changer' : 'Sélectionner'}
                  </button>
                  <input ref={mobileFileInputRef} type="file" accept="image/*" onChange={handleMobileImageSelect} className="hidden" />
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Formats acceptés: JPG, PNG, GIF (animé), WebP - Max 10MB
            </p>
          </div>

          {/* Active */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">
              Activer immédiatement
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                editingBanner ? 'Mettre à jour' : 'Créer la bannière'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
