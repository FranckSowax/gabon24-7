'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { Send, Bug, Lightbulb, MessageSquare, Star, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function FeedbackPage() {
  const { user } = useAuth()
  const router = useRouter()
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
    { id: 'general', label: 'Avis général', icon: MessageSquare, color: 'bg-blue-100 text-blue-600' },
    { id: 'bug', label: 'Signaler un bug', icon: Bug, color: 'bg-red-100 text-red-600' },
    { id: 'feature', label: 'Suggestion', icon: Lightbulb, color: 'bg-yellow-100 text-yellow-600' }
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
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(true)} />
      
      <Sidebar 
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />

      <main className="lg:pl-64 pt-16 min-h-screen transition-all duration-300">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Votre avis nous intéresse</h1>
              <p className="text-gray-600">
                Aidez-nous à améliorer Gabon Insight en partageant vos retours, suggestions ou en signalant des problèmes.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 sm:p-8">
                {submitStatus === 'success' ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Merci pour votre retour !</h2>
                    <p className="text-gray-600 mb-6">
                      Votre feedback a bien été envoyé à notre équipe. Nous l'analyserons avec attention.
                    </p>
                    <button
                      onClick={() => setSubmitStatus('idle')}
                      className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      Envoyer un autre avis
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Type de feedback */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Type de retour
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {feedbackTypes.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, type: type.id })}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                              formData.type === type.id
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`p-2 rounded-full mb-2 ${type.color}`}>
                              <type.icon className="w-5 h-5" />
                            </div>
                            <span className={`text-sm font-medium ${
                              formData.type === type.id ? 'text-orange-700' : 'text-gray-600'
                            }`}>
                              {type.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Note */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Votre note
                      </label>
                      <div className="flex items-center justify-center space-x-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFormData({ ...formData, rating: star })}
                            className="p-1 transition-transform hover:scale-110 focus:outline-none"
                          >
                            <Star
                              className={`w-8 h-8 ${
                                star <= formData.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                        Votre message
                      </label>
                      <textarea
                        id="message"
                        rows={6}
                        className="w-full rounded-xl border-gray-200 focus:border-orange-500 focus:ring-orange-500 text-gray-900 placeholder-gray-400 resize-none p-3"
                        placeholder="Dites-nous ce que vous pensez..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                      />
                    </div>

                    {/* Error Message */}
                    {submitStatus === 'error' && (
                      <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-4 rounded-lg">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{errorMessage}</span>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/30"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Envoi en cours...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          Envoyer mon avis
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
