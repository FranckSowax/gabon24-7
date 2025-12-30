'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Sparkles, FileText, Image as ImageIcon, X, Upload } from 'lucide-react'
import Header from '@/components/layout/Header'
import Sidebar from '@/components/layout/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { addToCart } from '@/lib/cart'
import AvailabilityChecker from '@/components/campaigns/AvailabilityChecker'

export default function ArticleTrendingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // État du formulaire
  const [formData, setFormData] = useState({
    name: '',
    articleTitle: '',
    articleSubtitle: '',
    articleCategory: 'tech',
    articleAuthor: '',
    articleContent: '',
    articleSummary: '',
    articleImageUrl: '', // URL image générée par IA
    companyName: '',
    productService: '',
    targetAudience: '',
    keyMessage: '',
    callToAction: '',
    redirectUrl: '',
    durationDays: 7,
    startDate: new Date().toISOString().split('T')[0],
    generateWithAI: true,
    requestCreation: false
  })

  // Image de l'article
  const [articleImage, setArticleImage] = useState<{
    file: File | null
    preview: string | null
  }>({
    file: null,
    preview: null
  })

  // Contenu généré
  const [generatedContent, setGeneratedContent] = useState('')
  const [generatingImage, setGeneratingImage] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setArticleImage({
          file: file,
          preview: reader.result as string
        })
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setArticleImage({ file: null, preview: null })
  }

  const handleGenerateContent = async () => {
    if (!formData.companyName || !formData.productService || !formData.keyMessage) {
      alert('⚠️ Champs obligatoires pour génération IA :\n- Entreprise\n- Produit/Service\n- Message clé')
      return
    }

    setLoading(true)

    try {
      console.log('🤖 Génération article avec IA...')
      
      // Appel API backend
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_URL}/api/generate-sponsored-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_name: formData.companyName,
          product_service: formData.productService,
          key_message: formData.keyMessage,
          target_audience: formData.targetAudience || 'Grand public gabonais',
          call_to_action: formData.callToAction || 'Contactez-nous',
          tone: 'professionnel',
          category: formData.articleCategory
        })
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Fallback: API IA pas disponible, utiliser mode simulation
          console.warn('⚠️ API IA indisponible, utilisation mode simulation...')
          simulateGeneration()
          return
        }
        const error = await response.json()
        throw new Error(error.error || 'Erreur génération IA')
      }

      const result = await response.json()
      
      if (!result.success || !result.article) {
        throw new Error('Réponse IA invalide')
      }

      console.log('✅ Article généré:', result.article)

      // Remplir automatiquement les champs
      setFormData(prev => ({
        ...prev,
        articleTitle: result.article.title,
        articleSubtitle: result.article.subtitle || '',
        articleSummary: result.article.summary,
        articleContent: result.article.content,
        articleAuthor: result.article.author || 'Équipe Rédaction Gabon Insight'
      }))

      setGeneratedContent(result.article.content)
      
      alert('✅ Article généré avec succès ! Vous pouvez modifier le contenu avant de soumettre.')

    } catch (error: any) {
      console.error('❌ Erreur génération:', error)
      alert(`❌ Erreur génération IA: ${error.message}\n\nVous pouvez remplir manuellement le formulaire.`)
    } finally {
      setLoading(false)
    }
  }

  // Générer image de couverture avec Nano Banana
  const handleGenerateImage = async () => {
    if (!formData.articleTitle) {
      alert('⚠️ Veuillez d\'abord générer ou saisir le titre de l\'article')
      return
    }

    setGeneratingImage(true)

    try {
      console.log('🎨 Génération image avec Nano Banana...')
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${API_URL}/api/generate-article-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.articleTitle,
          category: formData.articleCategory,
          company_name: formData.companyName,
          product_service: formData.productService,
          key_message: formData.keyMessage
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur génération image IA')
      }

      const result = await response.json()
      
      if (!result.success || !result.image_url) {
        throw new Error('Réponse image IA invalide')
      }

      console.log('✅ Image générée:', result.image_url)

      // Définir l'image générée comme preview
      setArticleImage({
        file: null, // Pas de fichier local, c'est une URL
        preview: result.image_url
      })

      // Stocker l'URL dans les détails du formulaire
      setFormData(prev => ({
        ...prev,
        articleImageUrl: result.image_url
      }))
      
      alert('✅ Image générée avec succès ! Format 16:9, contexte gabonais.')

    } catch (error: any) {
      console.error('❌ Erreur génération image:', error)
      alert(`❌ Erreur génération image IA: ${error.message}\n\nVous pouvez uploader une image manuellement.`)
    } finally {
      setGeneratingImage(false)
    }
  }

  // Fonction temporaire pour fallback manuel (si IA échoue)
  const simulateGeneration = () => {
    const mockContent = `# ${formData.articleTitle || formData.companyName + ' révolutionne le marché gabonais'}

## ${formData.articleSubtitle || 'Une innovation majeure pour ' + formData.targetAudience}

Le marché gabonais connaît une transformation remarquable avec l'arrivée de ${formData.productService}, une innovation qui répond aux besoins croissants de ${formData.targetAudience}.

### Une Solution Adaptée au Contexte Local

${formData.companyName} s'est imposé comme un acteur majeur dans le secteur, en proposant des solutions qui prennent en compte les spécificités du marché gabonais. Cette approche localisée fait toute la différence.

### Des Résultats Concrets

Les premiers utilisateurs rapportent des résultats impressionnants. ${formData.keyMessage}. Ces témoignages confirment la pertinence de cette offre pour le public gabonais.

### Une Opportunité à Saisir

Pour ${formData.targetAudience}, c'est une occasion unique de bénéficier d'une solution de qualité adaptée à leurs besoins. ${formData.callToAction}.

*Article Sponsorisé*`
        
    setGeneratedContent(mockContent)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name) {
      alert('Veuillez entrer un nom de campagne')
      return
    }
    
    if (!formData.articleTitle) {
      alert('Veuillez entrer un titre d\'article')
      return
    }
    
    // Si création manuelle, vérifier les champs obligatoires
    if (!formData.requestCreation && !formData.generateWithAI) {
      if (!formData.articleContent || !formData.articleSummary || !formData.articleAuthor) {
        alert('Veuillez remplir le contenu, le résumé et l\'auteur de l\'article')
        return
      }
      if (!articleImage.preview) {
        alert('Veuillez uploader une image de couverture')
        return
      }
    }
    
    // Si génération IA, vérifier que c'est généré
    if (formData.generateWithAI && !formData.requestCreation) {
      if (!generatedContent) {
        alert('Veuillez générer le contenu avec l\'IA avant de soumettre')
        return
      }
      if (!articleImage.preview) {
        alert('Veuillez uploader une image de couverture')
        return
      }
    }
    
    if (!formData.redirectUrl) {
      alert('Veuillez entrer l\'URL de redirection')
      return
    }

    setLoading(true)

    try {
      // Calculer le budget
      const baseBudget = 250000 // 250,000 FCFA/semaine
      const creationCost = formData.requestCreation ? 150000 : 0 // +150,000 FCFA si demande création
      const totalBudget = baseBudget * (formData.durationDays / 7) + creationCost

      // Préparer les détails pour le panier
      const cartItem = {
        campaign_type: 'article-trending' as const,
        name: formData.name,
        budget: totalBudget,
        duration_days: formData.durationDays,
        start_date: formData.startDate,
        details: {
          article_title: formData.articleTitle,
          article_subtitle: formData.articleSubtitle,
          article_category: formData.articleCategory,
          article_author: formData.articleAuthor || 'Équipe Gabon Insight',
          article_content: formData.requestCreation ? 'Brief fourni - Contenu à rédiger par l\'équipe' : (generatedContent || formData.articleContent),
          article_summary: formData.articleSummary || formData.articleSubtitle,
          article_image_preview: articleImage.preview,
          article_image_file: articleImage.file,
          company_name: formData.companyName,
          product_service: formData.productService,
          target_audience: formData.targetAudience,
          key_message: formData.keyMessage,
          call_to_action: formData.callToAction,
          redirect_url: formData.redirectUrl,
          request_creation: formData.requestCreation,
          generate_with_ai: formData.generateWithAI
        }
      }

      // Ajouter au panier
      addToCart(cartItem)
      
      console.log('✅ Article sponsorisé ajouté au panier:', cartItem)
      
      // Afficher confirmation
      const goToCheckout = confirm(
        `✅ Article sponsorisé ajouté au panier!\n\nMontant: ${totalBudget.toLocaleString()} FCFA${creationCost > 0 ? ' (incluant création par l\'équipe)' : ''}\n\nVoulez-vous procéder au paiement maintenant?`
      )

      if (goToCheckout) {
        router.push('/checkout-campaigns')
      } else {
        router.push('/marketing/publicite')
      }

    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur lors de l\'ajout au panier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      
      <div className="flex min-h-screen w-full">
        <Sidebar 
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 lg:ml-64 p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-5 h-5" />
              Retour
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🔥</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Article Sponsorisé Tendances</h1>
                <p className="text-gray-600">Article natif source "Gabon Insight" - 250,000 FCFA/semaine</p>
              </div>
            </div>

            {/* Offre commerciale */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-6 mt-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">🎯 Offre Commerciale</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-orange-600 mb-2">Prix de base:</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• <strong>1 semaine:</strong> 250,000 FCFA</li>
                    <li>• <strong>2 semaines:</strong> 475,000 FCFA (5% réduction)</li>
                    <li>• <strong>3 semaines:</strong> 675,000 FCFA (10% réduction)</li>
                    <li>• <strong>1 mois:</strong> 900,000 FCFA (10% réduction)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-orange-600 mb-2">Inclus:</h3>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>✅ Source média: <strong>Gabon Insight</strong></li>
                    <li>✅ Position <strong>TOP Tendances</strong></li>
                    <li>✅ Affichage dans le <strong>feed home</strong></li>
                    <li>✅ Vues boostées (5000+ vues garanties)</li>
                    <li>✅ Page article dédiée</li>
                    <li>✅ Badge "Article Sponsorisé"</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>+150,000 FCFA:</strong> Option création complète par notre équipe éditoriale (rédaction professionnelle + image + optimisation SEO)
                </p>
              </div>
            </div>
          </div>

          {/* Mode de création */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Mode de création</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, requestCreation: false, generateWithAI: true })}
                className={`p-6 border-2 rounded-xl transition-all ${
                  !formData.requestCreation
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                  <h3 className="font-bold text-gray-900">Je crée mon article</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Utilisez notre générateur IA ou écrivez vous-même. Vous uploadez l'image de couverture.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, requestCreation: true, generateWithAI: false })}
                className={`p-6 border-2 rounded-xl transition-all ${
                  formData.requestCreation
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Équipe crée pour moi</h3>
                </div>
                <p className="text-sm text-gray-600">
                  Donnez-nous un brief, nous créons un article professionnel complet. <strong>+150,000 FCFA</strong>
                </p>
              </button>
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Informations de base */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Informations de base</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom de la campagne *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Article Promo Printemps"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Titre de l'article *
                    </label>
                    <input
                      type="text"
                      value={formData.articleTitle}
                      onChange={(e) => setFormData({ ...formData, articleTitle: e.target.value })}
                      placeholder="Titre accrocheur et informatif"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Sous-titre
                    </label>
                    <input
                      type="text"
                      value={formData.articleSubtitle}
                      onChange={(e) => setFormData({ ...formData, articleSubtitle: e.target.value })}
                      placeholder="Sous-titre descriptif"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Catégorie *
                  </label>
                  <select
                    value={formData.articleCategory}
                    onChange={(e) => setFormData({ ...formData, articleCategory: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="tech">Technologie</option>
                    <option value="business">Business</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="education">Éducation</option>
                    <option value="health">Santé</option>
                    <option value="finance">Finance</option>
                    <option value="immobilier">Immobilier</option>
                    <option value="automobile">Automobile</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Durée de la campagne
                    </label>
                    <select
                      value={formData.durationDays}
                      onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="7">1 semaine (250,000 FCFA)</option>
                      <option value="14">2 semaines (475,000 FCFA)</option>
                      <option value="21">3 semaines (675,000 FCFA)</option>
                      <option value="30">1 mois (900,000 FCFA)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contenu de l'article (si création manuelle) */}
            {!formData.requestCreation && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">📝 Contenu de l'article</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Auteur de l'article *
                    </label>
                    <input
                      type="text"
                      value={formData.articleAuthor}
                      onChange={(e) => setFormData({ ...formData, articleAuthor: e.target.value })}
                      placeholder="Ex: Jean Dupont ou Équipe Gabon Insight"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required={!formData.requestCreation}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Résumé de l'article * (150-250 caractères)
                    </label>
                    <textarea
                      value={formData.articleSummary}
                      onChange={(e) => setFormData({ ...formData, articleSummary: e.target.value })}
                      placeholder="Un court résumé accrocheur qui donnera envie de lire l'article..."
                      rows={3}
                      maxLength={250}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      required={!formData.requestCreation}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.articleSummary.length}/250 caractères
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contenu complet de l'article * (format Markdown supporté)
                    </label>
                    <textarea
                      value={formData.articleContent}
                      onChange={(e) => setFormData({ ...formData, articleContent: e.target.value })}
                      placeholder="Rédigez ici le contenu complet de votre article...\n\nVous pouvez utiliser Markdown pour le formatage:\n# Titre\n## Sous-titre\n**Gras** *Italique*\n- Liste à puces"
                      rows={15}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent font-mono text-sm"
                      required={!formData.requestCreation && !formData.generateWithAI}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Conseil: Un bon article fait entre 500 et 1000 mots
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Informations entreprise/produit */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{formData.requestCreation ? '📋 Brief pour notre équipe' : 'ℹ️ Informations complémentaires'}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nom de l'entreprise/marque *
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Ex: TechGabon Solutions"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Produit/Service *
                  </label>
                  <input
                    type="text"
                    value={formData.productService}
                    onChange={(e) => setFormData({ ...formData, productService: e.target.value })}
                    placeholder="Ex: Plateforme de gestion digitale"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Audience cible *
                  </label>
                  <input
                    type="text"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    placeholder="Ex: Entrepreneurs et PME gabonaises"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Message clé
                  </label>
                  <textarea
                    value={formData.keyMessage}
                    onChange={(e) => setFormData({ ...formData, keyMessage: e.target.value })}
                    placeholder="Le message principal que vous voulez transmettre"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Appel à l'action
                  </label>
                  <input
                    type="text"
                    value={formData.callToAction}
                    onChange={(e) => setFormData({ ...formData, callToAction: e.target.value })}
                    placeholder="Ex: Découvrez notre offre d'essai gratuit"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    URL de redirection *
                  </label>
                  <input
                    type="url"
                    value={formData.redirectUrl}
                    onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })}
                    placeholder="https://votresite.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Génération de contenu IA (uniquement si pas de demande création) */}
            {!formData.requestCreation && formData.generateWithAI && (
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="w-6 h-6 text-purple-600 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Génération automatique avec IA
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Notre IA va créer un article journalistique professionnel basé sur vos informations
                  </p>
                  
                  <button
                    type="button"
                    onClick={handleGenerateContent}
                    disabled={loading}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <FileText className="w-5 h-5" />
                        Générer l'article
                      </>
                    )}
                  </button>
                </div>
              </div>

              {generatedContent && (
                <div className="mt-4 bg-white rounded-lg p-4 border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Aperçu du contenu généré:</h4>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {generatedContent}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, articleContent: generatedContent })
                        alert('✅ Contenu copié! Vous pouvez maintenant le modifier si nécessaire.')
                      }}
                      className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                      Copier vers le champ Contenu
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateContent}
                      className="text-sm bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg"
                    >
                      Regénérer
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Image de l'article */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Image de couverture</h2>
                <button
                  type="button"
                  onClick={handleGenerateImage}
                  disabled={generatingImage || !formData.articleTitle}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  {generatingImage ? '⏳ Génération...' : '🎨 Générer avec IA'}
                </button>
              </div>

              {generatingImage && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                  <p className="text-purple-800 font-medium">Nano Banana génère votre image...</p>
                  <p className="text-sm text-purple-600">Format 16:9, contexte gabonais (20-30s)</p>
                </div>
              )}
              
              {articleImage.preview ? (
                <div className="relative max-w-2xl">
                  <img src={articleImage.preview} alt="Article" className="w-full rounded-lg border border-gray-300" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="block border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer max-w-2xl">
                  <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 mb-1">Cliquez ou glissez votre image ici</p>
                  <p className="text-sm text-gray-400">Format: 1200x600px recommandé (JPG, PNG)</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Boutons d'action */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Soumettre pour validation
                  </>
                )}
              </button>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                ℹ️ Votre article sera examiné par notre équipe éditoriale sous 24h pour s'assurer de sa qualité et de sa conformité.
              </p>
            </div>
          </form>
        </main>
      </div>
    </div>
  )
}
