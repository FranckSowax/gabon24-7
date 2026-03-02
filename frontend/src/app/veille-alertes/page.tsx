'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bell,
  Search,
  MessageSquare,
  Zap,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  Clock,
  BarChart3,
  Building2,
  User
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7-production.up.railway.app'

interface VeillePlan {
  id: string
  slug: string
  name: string
  description: string
  price_monthly: number
  max_alerts: number
  max_keywords_per_alert: number
  max_whatsapp_numbers: number
  features: string[]
}

const FEATURES = [
  {
    icon: Search,
    title: 'Mots-cles intelligents',
    description: 'Definissez vos mots-cles et notre IA detecte automatiquement les articles pertinents grace au matching semantique avance.'
  },
  {
    icon: MessageSquare,
    title: 'Carrousel WhatsApp',
    description: 'Recevez vos alertes directement sur WhatsApp sous forme de carrousel interactif avec images et liens.'
  },
  {
    icon: Zap,
    title: 'IA de matching avancee',
    description: 'Algorithme de stemming, synonymes gabonais et filtrage par categorie, sentiment et importance.'
  }
]

const STEPS = [
  { step: '1', title: 'Configurez', description: 'Choisissez vos mots-cles et categories d\'interet' },
  { step: '2', title: 'Surveillez', description: 'Notre IA scanne les actualites chaque heure de 7h a 22h' },
  { step: '3', title: 'Recevez', description: 'Alertes WhatsApp en carrousel avec les articles detectes' },
  { step: '4', title: 'Agissez', description: 'Consultez, analysez et partagez les informations cles' }
]

const FAQ_ITEMS = [
  {
    q: 'Comment fonctionne la demo gratuite de 24h ?',
    a: 'Entrez votre numero WhatsApp et votre email. Une alerte demo est creee automatiquement et vous recevrez des notifications carrousel pendant 24 heures. Aucun paiement requis.'
  },
  {
    q: 'Quelles sources sont surveillees ?',
    a: 'Nous agrégeons plus de 29 sources RSS gabonaises : AGP, Gabon Actu, Gabon Review, Info241, et bien d\'autres. Les articles sont enrichis par notre IA.'
  },
  {
    q: 'A quelle frequence sont envoyees les alertes ?',
    a: 'Les alertes sont traitees toutes les heures de 7h a 22h (heure de Libreville). Chaque batch regroupe jusqu\'a 5 articles par carrousel.'
  },
  {
    q: 'Puis-je modifier mes mots-cles apres inscription ?',
    a: 'Oui, vous pouvez modifier, ajouter ou supprimer vos alertes et mots-cles a tout moment depuis votre tableau de bord.'
  },
  {
    q: 'Quelle est la difference entre Particulier et Entreprise ?',
    a: 'Le plan Particulier offre jusqu\'a 5 alertes avec 3 mots-cles chacune. Le plan Entreprise offre des alertes et mots-cles illimites, jusqu\'a 10 numeros WhatsApp, un rapport hebdomadaire PDF et un support prioritaire.'
  }
]

export default function VeilleAlertesLanding() {
  const router = useRouter()
  const [plans, setPlans] = useState<VeillePlan[]>([])
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [demoForm, setDemoForm] = useState({ whatsappNumber: '', email: '', name: '', keywords: '' })
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState('')
  const [demoSuccess, setDemoSuccess] = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/api/veille/plans`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.plans) setPlans(data.plans)
      })
      .catch(() => {})
  }, [])

  const handleDemo = async (e: React.FormEvent) => {
    e.preventDefault()
    setDemoError('')

    // Valider keywords (2-3 requis)
    const keywordsList = demoForm.keywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length >= 2)
    if (keywordsList.length < 2 || keywordsList.length > 3) {
      setDemoError('Entrez 2 ou 3 mots-cles separes par des virgules.')
      return
    }

    setDemoLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/veille/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...demoForm, keywords: keywordsList })
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setDemoError(data.error || 'Erreur lors de l\'activation de la demo')
        return
      }

      setDemoSuccess(true)
      setTimeout(() => {
        router.push(`/veille-alertes/demo?whatsapp=${encodeURIComponent(demoForm.whatsappNumber)}`)
      }, 1500)
    } catch {
      setDemoError('Erreur de connexion. Veuillez reessayer.')
    } finally {
      setDemoLoading(false)
    }
  }

  const particulierPlan = plans.find(p => p.slug === 'particulier')
  const entreprisePlan = plans.find(p => p.slug === 'entreprise')

  return (
    <div className="min-h-screen bg-white">
      {/* Header simple */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/LOGO GABON INSIGHT DRAPEAU psd-Recupere.png" alt="Gabon Insight" className="h-10 w-auto" />
          </Link>
          <Link
            href="/auth/signin"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-amber-50 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
                <Bell className="w-4 h-4" />
                Veille & Alertes Intelligentes
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Surveillez l&apos;actualite gabonaise{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                  en temps reel
                </span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Recevez des alertes personnalisees par WhatsApp des que l&apos;actualite correspond
                a vos mots-cles. IA avancee, carrousel interactif, surveillance horaire.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  Essai Gratuit 24h
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#tarifs"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
                >
                  Voir les tarifs
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            Comment ca fonctionne
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6 rounded-2xl bg-gray-50 hover:bg-orange-50 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white mb-4">
                  <feature.icon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            En 4 etapes simples
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-center text-xl font-bold">
                  {step.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-3">
            Tarifs simples et transparents
          </h2>
          <p className="text-center text-gray-500 mb-12">Choisissez le plan adapte a vos besoins</p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Particulier */}
            <div className="rounded-2xl border border-gray-200 p-8 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Particulier</h3>
                  <p className="text-sm text-gray-500">Pour les individus</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  {particulierPlan?.price_monthly?.toLocaleString('fr-FR') || '2 000'}
                </span>
                <span className="text-gray-500 ml-1">FCFA/mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(particulierPlan?.features || [
                  '5 alertes actives',
                  '3 mots-cles par alerte',
                  '1 numero WhatsApp',
                  'Notifications carrousel WhatsApp',
                  'Surveillance horaire 7h-22h'
                ]).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/veille-alertes/subscribe?plan=particulier"
                className="block text-center py-3 px-6 rounded-xl font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                Choisir Particulier
              </Link>
            </div>

            {/* Entreprise */}
            <div className="rounded-2xl border-2 border-orange-400 p-8 relative hover:shadow-lg transition-shadow">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                RECOMMANDE
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Entreprise</h3>
                  <p className="text-sm text-gray-500">Pour les organisations</p>
                </div>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  {entreprisePlan?.price_monthly?.toLocaleString('fr-FR') || '15 000'}
                </span>
                <span className="text-gray-500 ml-1">FCFA/mois</span>
              </div>
              <ul className="space-y-3 mb-8">
                {(entreprisePlan?.features || [
                  'Alertes illimitees',
                  'Mots-cles illimites',
                  'Jusqu\'a 10 numeros WhatsApp',
                  'Notifications carrousel WhatsApp',
                  'Surveillance horaire 7h-22h',
                  'Rapport hebdomadaire PDF',
                  'Support prioritaire'
                ]).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                href="/veille-alertes/subscribe?plan=entreprise"
                className="block text-center py-3 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-red-500 hover:shadow-md transition-all"
              >
                Choisir Entreprise
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Form */}
      <section id="demo" className="py-16 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Essayez gratuitement pendant 24h
            </h2>
            <p className="text-gray-400">
              Aucun paiement requis. Entrez votre numero WhatsApp et recevez vos premieres alertes.
            </p>
          </div>

          {demoSuccess ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Demo activee !</h3>
              <p className="text-gray-400">Verifiez votre WhatsApp, vous allez recevoir un message de bienvenue.</p>
            </div>
          ) : (
            <form onSubmit={handleDemo} className="bg-white/5 backdrop-blur rounded-2xl p-6 sm:p-8 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Numero WhatsApp *
                </label>
                <input
                  type="tel"
                  value={demoForm.whatsappNumber}
                  onChange={e => setDemoForm(f => ({ ...f, whatsappNumber: e.target.value }))}
                  placeholder="+241 XX XX XX XX"
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={demoForm.email}
                  onChange={e => setDemoForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="votre@email.com"
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nom (optionnel)
                </label>
                <input
                  type="text"
                  value={demoForm.name}
                  onChange={e => setDemoForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Votre nom"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mots-cles de veille (2 a 3) *
                </label>
                <input
                  type="text"
                  value={demoForm.keywords}
                  onChange={e => setDemoForm(f => ({ ...f, keywords: e.target.value }))}
                  placeholder="ex: petrole, economie, Libreville"
                  required
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Separez par des virgules. Vous recevrez les articles contenant ces mots.</p>
              </div>

              {demoError && (
                <p className="text-sm text-red-400">{demoError}</p>
              )}

              <button
                type="submit"
                disabled={demoLoading}
                className="w-full py-3 px-6 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {demoLoading ? 'Activation...' : 'Demarrer la demo gratuite'}
              </button>

              <div className="flex items-center gap-2 justify-center text-xs text-gray-500">
                <Shield className="w-3 h-3" />
                Aucun paiement requis. Demo valable 24h.
              </div>
            </form>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            Questions frequentes
          </h2>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900 text-sm">{item.q}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-4" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-600 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-12 bg-gray-50 border-t border-gray-200">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm mb-4">
            Des questions ? Contactez-nous a{' '}
            <a href="mailto:contact@gaboninsight.com" className="text-orange-600 hover:underline">
              contact@gaboninsight.com
            </a>
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <Link href="/politique-de-confidentialite" className="hover:text-gray-600">Confidentialite</Link>
            <span>|</span>
            <Link href="/suppression-des-donnees" className="hover:text-gray-600">Suppression des donnees</Link>
            <span>|</span>
            <Link href="/" className="hover:text-gray-600">Gabon Insight</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
