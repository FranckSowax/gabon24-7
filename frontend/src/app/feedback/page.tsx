'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Send, Bug, Lightbulb, MessageSquare, Star, CheckCircle, AlertCircle, Loader2, Heart, Sparkles } from 'lucide-react'

export default function FeedbackPage() {
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const [formData, setFormData] = useState({
    type: 'general',
    message: '',
    rating: 0
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

  const feedbackTypes = [
    { id: 'general', label: 'Avis général', icon: MessageSquare, color: 'from-blue-500 to-indigo-600', bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { id: 'bug', label: 'Signaler un bug', icon: Bug, color: 'from-red-500 to-pink-600', bgColor: 'bg-red-50', textColor: 'text-red-600' },
    { id: 'feature', label: 'Suggestion', icon: Lightbulb, color: 'from-yellow-500 to-orange-600', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    try {
      if (!formData.message.trim()) {
        throw new Error('Le message ne peut pas être vide')
      }

      if (formData.rating === 0) {
        throw new Error('Veuillez donner une note')
      }

      const response = await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user?.id,
          userEmail: user?.email,
          userName: user?.user_metadata?.full_name,
          type: formData.type,
          message: formData.message,
          rating: formData.rating
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.message || 'Une erreur est survenue')
      }

      setSubmitStatus('success')
      setFormData({ type: 'general', message: '', rating: 0 })

      // Reset success message after 5 seconds
      setTimeout(() => {
        setSubmitStatus('idle')
      }, 5000)

    } catch (error: any) {
      console.error('Erreur envoi feedback:', error)
      setSubmitStatus('error')
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      <div className="flex">
        <Sidebar
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-64 min-w-0">
          <main className="w-full py-6 sm:py-8">
            <div className="w-full px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">

              {/* Hero Banner */}
              <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 text-white rounded-2xl mb-8 shadow-2xl">
                {/* Background decorations */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10 p-8 sm:p-10">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                      <Heart className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-center sm:text-left">
                      <h1 className="text-3xl sm:text-4xl font-bold mb-2">Votre avis compte</h1>
                      <p className="text-white/80 text-lg max-w-xl">
                        Aidez-nous à construire la meilleure plateforme d'actualités gabonaises
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feedback Form Card */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                {submitStatus === 'success' ? (
                  <div className="p-8 sm:p-12 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Merci pour votre retour !</h2>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                      Votre feedback a bien été envoyé. Notre équipe l'analysera avec attention pour améliorer votre expérience.
                    </p>
                    <button
                      onClick={() => setSubmitStatus('idle')}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:from-orange-600 hover:to-red-600 transition-all font-medium shadow-lg shadow-orange-500/30"
                    >
                      <Sparkles className="w-5 h-5" />
                      Envoyer un autre avis
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    {/* Form Header */}
                    <div className="bg-gradient-to-r from-gray-50 to-white p-6 border-b border-gray-100">
                      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-orange-500" />
                        Partagez votre expérience
                      </h2>
                      <p className="text-gray-500 text-sm mt-1">Tous les champs sont importants pour nous aider</p>
                    </div>

                    <div className="p-6 sm:p-8 space-y-8">
                      {/* Type de feedback */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-4">
                          Quel type de retour souhaitez-vous nous faire ?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {feedbackTypes.map((type) => (
                            <button
                              key={type.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, type: type.id })}
                              className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${
                                formData.type === type.id
                                  ? 'border-orange-500 bg-orange-50 shadow-lg shadow-orange-500/20 scale-[1.02]'
                                  : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50 hover:shadow-md'
                              }`}
                            >
                              {formData.type === type.id && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                  <CheckCircle className="w-4 h-4 text-white" />
                                </div>
                              )}
                              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${
                                formData.type === type.id
                                  ? `bg-gradient-to-br ${type.color} text-white shadow-lg`
                                  : `${type.bgColor} ${type.textColor}`
                              }`}>
                                <type.icon className="w-7 h-7" />
                              </div>
                              <span className={`text-sm font-semibold ${
                                formData.type === type.id ? 'text-orange-700' : 'text-gray-700'
                              }`}>
                                {type.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Note avec étoiles */}
                      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-6 border border-yellow-100">
                        <label className="block text-sm font-semibold text-gray-700 mb-4 text-center">
                          Comment évaluez-vous votre expérience ?
                        </label>
                        <div className="flex items-center justify-center gap-3">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setFormData({ ...formData, rating: star })}
                              className="p-2 transition-all duration-200 hover:scale-125 focus:outline-none"
                            >
                              <Star
                                className={`w-10 h-10 transition-all ${
                                  star <= formData.rating
                                    ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg'
                                    : 'text-gray-300 hover:text-yellow-300'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                        {formData.rating > 0 && (
                          <p className="text-center mt-3 text-sm font-medium text-yellow-700">
                            {formData.rating === 1 && 'Peut mieux faire'}
                            {formData.rating === 2 && 'Passable'}
                            {formData.rating === 3 && 'Correct'}
                            {formData.rating === 4 && 'Bien'}
                            {formData.rating === 5 && 'Excellent !'}
                          </p>
                        )}
                      </div>

                      {/* Message */}
                      <div>
                        <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-3">
                          Votre message
                        </label>
                        <textarea
                          id="message"
                          rows={5}
                          className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 text-gray-900 placeholder-gray-400 resize-none p-4 transition-all"
                          placeholder="Décrivez votre expérience, vos suggestions ou le problème rencontré..."
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          required
                        />
                        <p className="text-xs text-gray-400 mt-2">
                          {formData.message.length}/500 caractères
                        </p>
                      </div>

                      {/* Error Message */}
                      {submitStatus === 'error' && (
                        <div className="flex items-center gap-3 text-red-700 bg-red-50 p-4 rounded-xl border border-red-200">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm font-medium">{errorMessage}</span>
                        </div>
                      )}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-3 px-6 py-4 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 focus:outline-none focus:ring-4 focus:ring-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 hover:-translate-y-0.5"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            Envoi en cours...
                          </>
                        ) : (
                          <>
                            <Send className="w-6 h-6" />
                            Envoyer mon feedback
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Info Card */}
              <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/30">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Pourquoi votre avis est important ?</h3>
                    <p className="text-gray-600 text-sm">
                      Chaque retour nous aide à identifier les améliorations prioritaires et à développer les fonctionnalités que vous attendez. Ensemble, construisons la meilleure expérience d'actualités pour le Gabon.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
