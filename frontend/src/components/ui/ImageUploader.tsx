'use client'

import { useState, useRef } from 'react'
import { Upload, X, Eye, Monitor, Smartphone, Loader2 } from 'lucide-react'
import axios from 'axios'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ImageUploaderProps {
  onImagesChange: (images: { banner: string | null, mobile: string | null }) => void
  initialImages?: { banner?: string, mobile?: string }
  className?: string
}

interface ImagePreview {
  url: string
  file: File
  type: 'banner' | 'mobile'
}

export default function ImageUploader({ onImagesChange, initialImages, className = '' }: ImageUploaderProps) {
  const [previews, setPreviews] = useState<{
    banner: ImagePreview | null
    mobile: ImagePreview | null
  }>({
    banner: initialImages?.banner ? { url: initialImages.banner, file: null as any, type: 'banner' } : null,
    mobile: initialImages?.mobile ? { url: initialImages.mobile, file: null as any, type: 'mobile' } : null
  })
  
  const [dragOver, setDragOver] = useState<'banner' | 'mobile' | null>(null)
  const [uploading, setUploading] = useState<{ banner?: boolean, mobile?: boolean }>({})
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (files: FileList | null, type: 'banner' | 'mobile') => {
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image')
      return
    }

    // Validation des dimensions recommandées
    const img = new Image()
    img.onload = async () => {
      let isValidSize = true
      let message = ''

      if (type === 'banner') {
        const aspectRatio = img.width / img.height
        if (aspectRatio < 2.5 || aspectRatio > 3.5) {
          message = `Image banner: ratio recommandé 3:1 (1200x400px). Actuelle: ${img.width}x${img.height}`
          isValidSize = false
        }
      } else {
        const aspectRatio = img.width / img.height
        if (aspectRatio < 0.8 || aspectRatio > 1.2) {
          message = `Image mobile: ratio recommandé 1:1 (400x400px). Actuelle: ${img.width}x${img.height}`
          isValidSize = false
        }
      }

      if (!isValidSize) {
        const proceed = confirm(`${message}\n\nContinuer quand même ?`)
        if (!proceed) return
      }

      // Upload vers le serveur
      await uploadToServer(file, type)
    }

    img.src = URL.createObjectURL(file)
  }

  const uploadToServer = async (file: File, type: 'banner' | 'mobile') => {
    setUploading(prev => ({ ...prev, [type]: true }))
    
    try {
      // Multipart upload via backend Express
      const form = new FormData()
      form.append('image', file, file.name)
      form.append('imageType', type)
      const { data: { session } } = await supabase.auth.getSession()
      const response = await axios.post(`${API_URL}/api/admin/upload-image`, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        }
      })
      
      if (response.data.success) {
        const serverUrl = response.data.image_url || response.data.imageUrl
        const newPreview = { url: serverUrl, file, type }
        
        setPreviews(prev => ({
          ...prev,
          [type]: newPreview
        }))

        // Notifier le parent avec l'URL du serveur
        const updatedImages = {
          banner: type === 'banner' ? serverUrl : (previews.banner?.url || null),
          mobile: type === 'mobile' ? serverUrl : (previews.mobile?.url || null)
        }
        onImagesChange(updatedImages)
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error(`Erreur upload ${type}:`, error)
      alert(`Erreur lors de l'upload de l'image ${type}`)
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }))
    }
  }

  const handleDrop = async (e: React.DragEvent, type: 'banner' | 'mobile') => {
    e.preventDefault()
    setDragOver(null)
    await handleFileSelect(e.dataTransfer.files, type)
  }

  const handleRemove = (type: 'banner' | 'mobile') => {
    if (previews[type]?.url.startsWith('blob:')) {
      URL.revokeObjectURL(previews[type]!.url)
    }
    
    setPreviews(prev => ({
      ...prev,
      [type]: null
    }))

    const updatedImages = {
      banner: type === 'banner' ? null : (previews.banner?.url || null),
      mobile: type === 'mobile' ? null : (previews.mobile?.url || null)
    }
    onImagesChange(updatedImages)
  }

  const handleClick = (type: 'banner' | 'mobile') => {
    if (type === 'banner') {
      bannerInputRef.current?.click()
    } else {
      mobileInputRef.current?.click()
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Images de la campagne</h3>
        <p className="text-sm text-gray-600">
          Uploadez une image banner pour desktop et une image carrée pour mobile
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Banner Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-700">Image Banner (Desktop)</span>
            <span className="text-xs text-gray-500">Recommandé: 1200x400px</span>
          </div>
          
          <div
            className={`relative border-2 border-dashed rounded-lg transition-colors ${
              dragOver === 'banner' 
                ? 'border-orange-500 bg-orange-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver('banner')
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, 'banner')}
          >
            {previews.banner ? (
              <div className="relative group">
                <img
                  src={previews.banner.url}
                  alt="Banner preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                    <button
                      onClick={() => handleClick('banner')}
                      className="p-2 bg-white rounded-lg text-gray-700 hover:text-orange-600"
                      title="Changer l'image"
                      disabled={uploading.banner}
                    >
                      {uploading.banner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleRemove('banner')}
                      className="p-2 bg-white rounded-lg text-red-600 hover:text-red-700"
                      title="Supprimer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors ${uploading.banner ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => !uploading.banner && handleClick('banner')}
              >
                {uploading.banner ? (
                  <Loader2 className="mx-auto h-8 w-8 text-orange-500 mb-2 animate-spin" />
                ) : (
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                )}
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-orange-600 hover:text-orange-500">
                    Cliquez pour uploader
                  </span> ou glissez l'image ici
                </div>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG jusqu'à 5MB</p>
              </div>
            )}
          </div>
          
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files, 'banner').catch(console.error)}
            className="hidden"
          />
        </div>

        {/* Mobile Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-gray-600" />
            <span className="font-medium text-gray-700">Image Mobile (Carrée)</span>
            <span className="text-xs text-gray-500">Recommandé: 400x400px</span>
          </div>
          
          <div
            className={`relative border-2 border-dashed rounded-lg transition-colors ${
              dragOver === 'mobile' 
                ? 'border-orange-500 bg-orange-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver('mobile')
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => handleDrop(e, 'mobile')}
          >
            {previews.mobile ? (
              <div className="relative group">
                <img
                  src={previews.mobile.url}
                  alt="Mobile preview"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded-lg flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                    <button
                      onClick={() => handleClick('mobile')}
                      className="p-2 bg-white rounded-lg text-gray-700 hover:text-orange-600"
                      title="Changer l'image"
                      disabled={uploading.mobile}
                    >
                      {uploading.mobile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleRemove('mobile')}
                      className="p-2 bg-white rounded-lg text-red-600 hover:text-red-700"
                      title="Supprimer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors ${uploading.mobile ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={() => !uploading.mobile && handleClick('mobile')}
              >
                {uploading.mobile ? (
                  <Loader2 className="mx-auto h-8 w-8 text-orange-500 mb-2 animate-spin" />
                ) : (
                  <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                )}
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-orange-600 hover:text-orange-500">
                    Cliquez pour uploader
                  </span> ou glissez l'image ici
                </div>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG jusqu'à 5MB</p>
              </div>
            )}
          </div>
          
          <input
            ref={mobileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files, 'mobile').catch(console.error)}
            className="hidden"
          />
        </div>
      </div>

      {/* Preview Section */}
      {(previews.banner || previews.mobile) && (
        <div className="border-t pt-6">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Aperçu des images
          </h4>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {previews.banner && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Banner Desktop</p>
                <img
                  src={previews.banner.url}
                  alt="Banner preview"
                  className="w-full h-24 object-cover rounded border"
                />
              </div>
            )}
            {previews.mobile && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Mobile</p>
                <img
                  src={previews.mobile.url}
                  alt="Mobile preview"
                  className="w-24 h-24 object-cover rounded border mx-auto lg:mx-0"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
