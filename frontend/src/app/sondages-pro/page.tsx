'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'

interface Poll {
  id: string
  title: string
  question: string
  options: string[]
  votes: { [key: string]: number }
  total_votes: number
  status: 'active' | 'closed'
  created_at: string
  closes_at: string
  created_by: string
  is_auto_generated: boolean
}

interface PollFormData {
  organization: string
  contact: string
  email: string
  phone: string
  questions: string[]
  targetAudience: string
  budget: number
  deadline: string
  additionalInfo: string
}

export default function SondagesProPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activePolls, setActivePolls] = useState<Poll[]>([])
  const [pastPolls, setPastPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingAI, setGeneratingAI] = useState(false)
  const [createMode, setCreateMode] = useState<'manual' | 'ai'>('manual')
  
  const [formData, setFormData] = useState<PollFormData>({
    organization: '',
    contact: '',
    email: '',
    phone: '',
    questions: [''],
    targetAudience: '',
    budget: 150000,
    deadline: '',
    additionalInfo: ''
  })

  // Chargement des sondages
  useEffect(() => {
    fetchPolls()
  }, [])

  const fetchPolls = async () => {
    try {
      setLoading(true)
      
      // Récupérer tous les sondages
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error

      const now = new Date()
      
      // Séparer actifs et passés
      const active = data?.filter((poll: Poll) => 
        poll.status === 'active' && new Date(poll.closes_at) > now
      ) || []
      
      const past = data?.filter((poll: Poll) => 
        poll.status === 'closed' || new Date(poll.closes_at) <= now
      ) || []

      setActivePolls(active.slice(0, 3)) // 3 plus récents
      setPastPolls(past)
      
    } catch (error) {
      console.error('Erreur chargement sondages:', error)
    } finally {
      setLoading(false)
    }
  }

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, '']
    }))
  }

  const updateQuestion = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === index ? value : q)
    }))
  }

  const removeQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }))
  }

  const handleGenerateAI = async () => {
    if (!formData.organization || !formData.targetAudience) {
      alert('Veuillez renseigner au minimum l\'organisation et le public cible')
      return
    }

    setGeneratingAI(true)
    
    try {
      // Appel API pour génération IA
      const response = await fetch('https://gabon-insight-production.up.railway.app/api/polls/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: formData.organization,
          target_audience: formData.targetAudience,
          context: formData.additionalInfo
        })
      })

      const data = await response.json()

      if (data.success) {
        setFormData(prev => ({
          ...prev,
          questions: data.questions || []
        }))
        alert('✅ Questions générées par IA avec succès!')
      } else {
        throw new Error(data.error || 'Erreur génération IA')
      }
      
    } catch (error: any) {
      console.error('Erreur génération IA:', error)
      alert('❌ Erreur: ' + error.message + '\n\nVous pouvez saisir vos questions manuellement.')
    } finally {
      setGeneratingAI(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Créer la commande de sondage
      const { data, error } = await supabase
        .from('poll_orders')
        .insert([{
          organization: formData.organization,
          contact: formData.contact,
          email: formData.email,
          phone: formData.phone,
          questions: formData.questions.filter(q => q.trim()),
          target_audience: formData.targetAudience,
          budget: formData.budget,
          deadline: formData.deadline,
          additional_info: formData.additionalInfo,
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select()

      if (error) throw error

      alert('✅ Demande de sondage soumise avec succès!\n\nNotre équipe vous contactera sous 24h.')
      
      // Reset form
      setFormData({
        organization: '',
        contact: '',
        email: '',
        phone: '',
        questions: [''],
        targetAudience: '',
        budget: 150000,
        deadline: '',
        additionalInfo: ''
      })
      
    } catch (error: any) {
      console.error('Erreur soumission:', error)
      alert('❌ Erreur lors de la soumission: ' + error.message)
    }
  }

  const formatVotePercentage = (votes: number, total: number) => {
    if (total === 0) return '0%'
    return ((votes / total) * 100).toFixed(1) + '%'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />
        
        <div className="flex-1 lg:ml-0 min-w-0">
          <main className="w-full py-4 sm:py-8">
            <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
              
              {/* Header */}
              <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 text-white rounded-2xl mb-8 p-8 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-4xl font-bold mb-2">📊 Sondages Professionnels</h1>
                    <p className="text-orange-100 text-lg">Créez et gérez vos sondages en quelques clics</p>
                  </div>
                </div>
              </div>

              {/* Layout 2 Colonnes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                
                {/* COLONNE GAUCHE: Création de Sondage */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      🎯 Créer un Sondage
                    </h2>
                    
                    {/* Toggle Manuel/IA */}
                    <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setCreateMode('manual')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          createMode === 'manual'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        ✍️ Manuel
                      </button>
                      <button
                        onClick={() => setCreateMode('ai')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                          createMode === 'ai'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        🤖 IA
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Organisation */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Organisation / Entreprise *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.organization}
                        onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder="Nom de votre organisation"
                      />
                    </div>

                    {/* Contact & Email */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.contact}
                          onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="Nom complet"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          placeholder="email@example.com"
                        />
                      </div>
                    </div>

                    {/* Téléphone */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Téléphone *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="+241 XX XX XX XX"
                      />
                    </div>

                    {/* Public Cible */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Public Cible *
                      </label>
                      <textarea
                        required
                        value={formData.targetAudience}
                        onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                        rows={2}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Ex: Jeunes 18-35 ans à Libreville, professionnels du secteur tech..."
                      />
                    </div>

                    {/* Questions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Questions du Sondage *
                        </label>
                        
                        {createMode === 'ai' && (
                          <button
                            type="button"
                            onClick={handleGenerateAI}
                            disabled={generatingAI || !formData.organization || !formData.targetAudience}
                            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                          >
                            {generatingAI ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                <span>Génération...</span>
                              </>
                            ) : (
                              <>
                                <span>🤖</span>
                                <span>Générer avec IA</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      
                      {formData.questions.map((question, index) => (
                        <div key={index} className="flex items-center space-x-2 mb-2">
                          <input
                            type="text"
                            required
                            value={question}
                            onChange={(e) => updateQuestion(index, e.target.value)}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                            placeholder={`Question ${index + 1}`}
                          />
                          {formData.questions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeQuestion(index)}
                              className="text-red-500 hover:text-red-700 p-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="text-orange-600 hover:text-orange-800 text-sm font-medium mt-2"
                      >
                        + Ajouter une question
                      </button>
                    </div>

                    {/* Budget & Deadline */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Budget (FCFA) *
                        </label>
                        <select
                          required
                          value={formData.budget}
                          onChange={(e) => setFormData(prev => ({ ...prev, budget: parseInt(e.target.value) }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="150000">150,000 FCFA - Express</option>
                          <option value="300000">300,000 FCFA - Standard</option>
                          <option value="500000">500,000 FCFA - Premium</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Deadline *
                        </label>
                        <input
                          type="date"
                          required
                          value={formData.deadline}
                          onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>

                    {/* Infos Complémentaires */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Informations Complémentaires
                      </label>
                      <textarea
                        value={formData.additionalInfo}
                        onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        placeholder="Objectifs, contraintes, préférences..."
                      />
                    </div>

                    {/* Submit */}
                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg hover:shadow-xl"
                      >
                        🚀 Soumettre la Demande
                      </button>
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Notre équipe vous contactera sous 24h pour validation et paiement
                      </p>
                    </div>
                  </form>
                </motion.div>

                {/* COLONNE DROITE: Résultats Récents */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
                >
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    📈 Sondages Actifs
                  </h2>

                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin text-4xl">⏳</div>
                    </div>
                  ) : activePolls.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-6xl mb-4">📊</div>
                      <p className="text-gray-500">Aucun sondage actif pour le moment</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {activePolls.map((poll) => (
                        <div key={poll.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-3">
                            <h3 className="font-bold text-gray-900 text-lg">{poll.title}</h3>
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              Actif
                            </span>
                          </div>
                          
                          <p className="text-gray-700 mb-4">{poll.question}</p>
                          
                          <div className="space-y-2">
                            {poll.options.map((option, idx) => {
                              const votes = poll.votes[option] || 0
                              const percentage = formatVotePercentage(votes, poll.total_votes)
                              
                              return (
                                <div key={idx} className="relative">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm text-gray-700">{option}</span>
                                    <span className="text-sm font-medium text-gray-900">{percentage}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
                                      style={{ width: percentage }}
                                    />
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                            <span>👥 {poll.total_votes} votes</span>
                            <span>📅 Ferme le {new Date(poll.closes_at).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </div>

              {/* SECTION PLEINE LARGEUR: Tous les Résultats Passés */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    📚 Historique des Sondages
                  </h2>
                  <span className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">
                    {pastPolls.length} sondage(s) terminé(s)
                  </span>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin text-4xl">⏳</div>
                  </div>
                ) : pastPolls.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <p className="text-gray-500">Aucun sondage terminé</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastPolls.map((poll) => (
                      <div key={poll.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-gray-900">{poll.title}</h3>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            Terminé
                          </span>
                        </div>
                        
                        <p className="text-gray-700 text-sm mb-4">{poll.question}</p>
                        
                        <div className="space-y-2">
                          {poll.options.map((option, idx) => {
                            const votes = poll.votes[option] || 0
                            const percentage = formatVotePercentage(votes, poll.total_votes)
                            
                            return (
                              <div key={idx} className="relative">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-gray-700">{option}</span>
                                  <span className="text-xs font-medium text-gray-900">{percentage}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className="bg-gray-400 h-1.5 rounded-full"
                                    style={{ width: percentage }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                          <span>👥 {poll.total_votes} votes</span>
                          <span>📅 {new Date(poll.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
