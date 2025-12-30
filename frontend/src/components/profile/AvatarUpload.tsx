'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

interface AvatarUploadProps {
  userId: string
  currentAvatar?: string
  onUploadSuccess: (url: string) => void
}

export default function AvatarUpload({ userId, currentAvatar, onUploadSuccess }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image')
      return
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('L\'image est trop grande (max 5MB)')
      return
    }

    // Créer une preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
      setSelectedFile(file)
      setShowPreview(true)
    }
    reader.readAsDataURL(file)
  }

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Calculer les nouvelles dimensions
          if (width > height) {
            if (width > maxWidth) {
              height = height * (maxWidth / width)
              width = maxWidth
            }
          } else {
            if (height > maxHeight) {
              width = width * (maxHeight / height)
              height = maxHeight
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Erreur redimensionnement'))
            }
          }, 'image/jpeg', 0.85)
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      // Redimensionner l'image
      const resizedBlob = await resizeImage(selectedFile, 400, 400)
      
      // Créer un nom de fichier unique
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload vers Supabase Storage
      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(filePath, resizedBlob, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        throw error
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath)

      // Mettre à jour le profil utilisateur
      await supabase
        .from('users')
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', userId)

      onUploadSuccess(publicUrl)
      setShowPreview(false)
      setPreview(null)
      setSelectedFile(null)
      
      alert('Photo de profil mise à jour avec succès !')
    } catch (error) {
      console.error('Erreur upload:', error)
      alert('Erreur lors de l\'upload de la photo')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setShowPreview(false)
    setPreview(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Avatar actuel */}
      <div className="flex items-center space-x-4">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
          {currentAvatar ? (
            <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>👤</span>
          )}
        </div>
        
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload"
          />
          <label
            htmlFor="avatar-upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
          >
            📷 Choisir une photo
          </label>
          <p className="text-xs text-gray-500 mt-2">
            JPG, PNG ou GIF. Max 5MB. Recommandé 400x400px
          </p>
        </div>
      </div>

      {/* Modal Preview */}
      {showPreview && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Aperçu de la photo
            </h3>
            
            {/* Preview Image */}
            <div className="mb-6">
              <div className="w-64 h-64 mx-auto rounded-full overflow-hidden bg-gray-100 shadow-lg">
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            </div>

            <p className="text-sm text-gray-600 text-center mb-6">
              L'image sera automatiquement redimensionnée et optimisée
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Upload en cours...
                  </span>
                ) : (
                  '✓ Valider'
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={uploading}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                ✗ Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
