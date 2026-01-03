'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, X, Zap, Crown, Gift, ArrowRight, Shield, Clock, Star,
  BookOpen, Headphones, Bot, Briefcase, GraduationCap, TrendingUp,
  LayoutDashboard, FileText, Newspaper, Layers, Coins, ShoppingCart
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Configuration des forfaits basée sur les fonctionnalités réelles
const PLANS = [
  {
    id: 'free',
    slug: 'free',
    name: 'Freemium',
    price: 0,
    credits: 0,
    promo: true,
    description: 'L\'essentiel de l\'actualité pour rester informé',
    icon: BookOpen,
    gradient: 'from-slate-400 to-slate-500',
    features: [
      '5 articles par jour',
      'Accès aux Archives générales',
      'Accès section Business',
      'Newsletter hebdomadaire',
      'Lecture confortable (Mode sombre)'
    ],
    limitations: [
      'Articles illimités bloqués',
      'Pas d\'accès aux Outils IA',
      'Pas de chaîne WhatsApp'
    ],
    cta: 'S\'inscrire gratuitement',
    highlight: false
  },
  {
    id: 'discovery',
    slug: 'discovery',
    name: 'Premium',
    price: 3000,
    originalPrice: 5000,
    credits: 300,
    description: 'Accélérez votre développement avec l\'IA',
    icon: Zap,
    gradient: 'from-blue-500 to-indigo-600',
    features: [
      'Tout du plan Freemium',
      '300 crédits / mois',
      'Accès chaîne WhatsApp Gabon Insight',
      'Générateur de Business Plan IA',
      'Formation & Quiz sur mesure'
    ],
    limitations: [
      'Pas d\'accès section Outils (Audio, Veille...)'
    ],
    cta: 'Commencer l\'essai (3000 FCFA)',
    highlight: true,
    popular: true,
    promo: true
  },
  {
    id: 'pro',
    slug: 'pro',
    name: 'Professionnel',
    price: 12000,
    credits: 1000,
    promo: true,
    description: 'La suite complète pour les décideurs',
    icon: Crown,
    gradient: 'from-orange-500 to-red-600',
    features: [
      'Tout du plan Premium',
      '1 000 crédits / mois (Best Value)',
      'Déblocage complet Outils (Audio, Veille, Actu+)',
      'Accès Publicités & Sondages',
      'Réception WhatsApp des veilles et Alerte',
      'Analyse d\'Opportunités de marché',
      'Support prioritaire'
    ],
    limitations: [],
    cta: 'Devenir Pro (12 000 FCFA)',
    highlight: false
  }
];

/**
 * CRÉDITS BASÉS SUR COÛTS IA RÉELS (Déc 2024)
 * Modèles: Gemini 2.0 Flash, GPT-4o-mini, OpenAI TTS-1
 * 1 crédit = 10 FCFA | 1 USD = 600 FCFA | Marge x40-80
 */
const CREDIT_EXAMPLES = [
  { action: 'Résumé Audio', cost: 5, icon: Headphones, desc: '~800 tokens + TTS 30s' },
  { action: 'Fiche Actu+', cost: 6, icon: Newspaper, desc: '~5000 tokens GPT-4o-mini' },
  { action: 'Rapport Veille', cost: 5, icon: TrendingUp, desc: '~3500 tokens analyse' },
  { action: 'Business Plan', cost: 15, icon: Briefcase, desc: '~10500 tokens Gemini' },
  { action: 'Formation IA', cost: 10, icon: GraduationCap, desc: '~6000 tokens' },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const router = useRouter();

  const handleSelectPlan = async (planSlug: string) => {
    setSelectedPlan(planSlug);

    // Trouver le plan sélectionné
    const plan = PLANS.find(p => p.slug === planSlug);
    if (!plan) return;

    // Vérifier si l'utilisateur est connecté
    const { data: { session } } = await supabase.auth.getSession();

    // Plan gratuit - inscription simple
    if (plan.price === 0) {
      if (!session) {
        router.push('/auth/signup');
      } else {
        router.push('/mon-profil');
      }
      return;
    }

    // Plans payants
    if (!session) {
      router.push(`/auth/signup?plan=${planSlug}&billing=${billingPeriod}`);
    } else {
      // Calculer le prix selon la période
      const price = billingPeriod === 'yearly'
        ? Math.round(plan.price * 12 * 0.8) // -20% pour annuel
        : plan.price;
      const duration = billingPeriod === 'yearly' ? 12 : 1;

      // Rediriger vers la page de paiement
      const params = new URLSearchParams({
        type: 'subscription',
        amount: price.toString(),
        planSlug: plan.slug,
        planName: plan.name,
        credits: plan.credits.toString(),
        duration: duration.toString(),
        description: `Abonnement ${plan.name} - ${plan.credits} crédits/mois${billingPeriod === 'yearly' ? ' (annuel)' : ''}`
      });
      router.push(`/paiement?${params.toString()}`);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white pb-16 pt-20 lg:pb-24">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-4xl mx-auto"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 tracking-tight">
              L'info est gratuite.<br/>
              <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
                L'intelligence est un atout.
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Accédez librement à tous nos articles et à la section <b>Business</b>.<br/>
              Passez Pro pour débloquer les <b>Outils IA</b> et recevoir vos alertes sur <b>WhatsApp</b>.
            </p>
            
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-8">
              <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Mensuel
              </span>
              <button
                onClick={() => setBillingPeriod(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                className="relative w-16 h-8 bg-gray-200 rounded-full p-1 transition-colors duration-300 focus:outline-none"
              >
                <motion.div 
                  className="w-6 h-6 bg-white rounded-full shadow-md"
                  animate={{ x: billingPeriod === 'monthly' ? 0 : 32 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
              <span className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-gray-900' : 'text-gray-500'}`}>
                Annuel <span className="text-green-600 font-bold text-xs ml-1">-20%</span>
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Plans Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-20">
        <div className="grid md:grid-cols-3 gap-8">
          {PLANS.map((plan, index) => {
            const Icon = plan.icon;
            const price = billingPeriod === 'monthly' ? plan.price : Math.round(plan.price * 12 * 0.8 / 12); // -20% annuel
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  relative rounded-3xl bg-white flex flex-col
                  ${plan.highlight ? 'ring-4 ring-orange-500/20 shadow-2xl scale-105 z-10' : 'border border-gray-200 shadow-xl'}
                  transition-all duration-300 hover:transform hover:-translate-y-2
                `}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-0 right-0 flex justify-center">
                    <span className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-white" />
                      RECOMMANDÉ
                    </span>
                  </div>
                )}

                <div className="p-8 flex-1">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-500 text-sm mb-6 h-10">{plan.description}</p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      {plan.originalPrice && (
                        <span className="text-xl text-gray-400 line-through mr-2">{formatPrice(plan.originalPrice)}</span>
                      )}
                      <span className="text-4xl font-bold text-gray-900">{formatPrice(price)}</span>
                      <span className="text-gray-500 font-medium text-lg">FCFA</span>
                      <span className="text-gray-400 text-sm">/mois</span>
                    </div>
                    {plan.promo && (
                      <p className="text-xs text-gray-500 mt-1">≈ {Math.round(price / 656)} €/mois</p>
                    )}
                  </div>
                  
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="mt-1 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-gray-700 text-sm font-medium">{feature}</span>
                      </li>
                    ))}
                    {plan.limitations.map((limitation, idx) => (
                      <li key={idx} className="flex items-start gap-3 opacity-60">
                        <div className="mt-1 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <X className="w-3 h-3 text-gray-500" />
                        </div>
                        <span className="text-gray-500 text-sm">{limitation}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-8 pt-0 mt-auto">
                  <button
                    onClick={() => handleSelectPlan(plan.slug)}
                    className={`
                      w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2
                      ${plan.highlight 
                        ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02]' 
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                      }
                    `}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {plan.price > 0 && (
                    <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                      <Shield className="w-3 h-3" />
                      Satisfait ou remboursé (7 jours)
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Section Achat Crédits à la Carte - Pour Freemium */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
              <Coins className="w-4 h-4" />
              Nouveau : Achat à la carte
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Pas prêt pour l'abonnement ?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Restez en <strong>Freemium</strong> et achetez des crédits à l'unité pour tester nos outils IA.
              Idéal pour une première utilisation ou un besoin ponctuel.
            </p>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-orange-100">
                <div className="text-2xl font-bold text-gray-900">50</div>
                <div className="text-sm text-gray-500 mb-2">crédits</div>
                <div className="text-orange-600 font-bold">1 000 FCFA</div>
                <div className="text-xs text-gray-400">≈ 1,5 €</div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border-2 border-orange-400 relative">
                <span className="absolute -top-2 right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">Populaire</span>
                <div className="text-2xl font-bold text-gray-900">150</div>
                <div className="text-sm text-gray-500 mb-2">crédits</div>
                <div className="text-orange-600 font-bold">2 500 FCFA</div>
                <div className="text-xs text-gray-400">≈ 3,8 € <span className="text-green-600">(−17%)</span></div>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-sm border border-orange-100">
                <div className="text-2xl font-bold text-gray-900">400</div>
                <div className="text-sm text-gray-500 mb-2">crédits</div>
                <div className="text-orange-600 font-bold">5 000 FCFA</div>
                <div className="text-xs text-gray-400">≈ 7,6 € <span className="text-green-600">(−38%)</span></div>
              </div>
            </div>

            <Link
              href="/credits"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] transition-all duration-300"
            >
              <ShoppingCart className="w-5 h-5" />
              Acheter des crédits
              <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-sm text-gray-500 mt-4">
              Paiement sécurisé via Mobile Money (Airtel, Moov)
            </p>
          </motion.div>
        </div>
      </div>

      {/* What are credits section */}
      <div className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              La puissance de vos Crédits
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Utilisez vos crédits à la demande pour activer les outils dont vous avez besoin. Vos crédits non utilisés sont reportés au mois suivant.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {CREDIT_EXAMPLES.map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-gray-50 rounded-2xl p-6 text-center hover:bg-white hover:shadow-xl transition-all duration-300 border border-gray-100 group"
              >
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4 text-orange-500 group-hover:scale-110 transition-transform duration-300">
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{item.action}</h3>
                <div className="text-orange-600 font-bold text-sm mb-2">{item.cost} Crédits</div>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Questions fréquentes</h2>
        <div className="grid gap-6">
          {[
            {
              q: "Les articles sont-ils vraiment gratuits ?",
              a: "Oui. Chez Gabon24-7, l'information doit être accessible à tous. La lecture et la recherche sont gratuites, ainsi que l'accès à la section Business pour consulter les opportunités."
            },
            {
              q: "Que se passe-t-il si je n'utilise pas tous mes crédits ?",
              a: "Vos crédits sont reportés au mois suivant tant que votre abonnement est actif. C'est idéal pour économiser en vue d'un gros projet."
            },
            {
              q: "À quoi sert le forfait Premium ?",
              a: "Le forfait Premium vous donne accès à la chaîne WhatsApp exclusive Gabon Insight et vous offre 500 crédits mensuels pour accélérer vos projets dans la section Business (Business Plans, Formations)."
            },
            {
              q: "Quels sont les avantages du forfait Professionnel ?",
              a: "Le forfait Professionnel débloque l'intégralité des outils IA, inclut la réception des veilles et alertes directement sur WhatsApp, et offre le meilleur rapport qualité/prix en crédits."
            },
            {
              q: "Puis-je annuler à tout moment ?",
              a: "Absolument. Il n'y a aucun engagement de durée (sauf si vous choisissez le paiement annuel pour bénéficier de la réduction). Vous pouvez annuler en un clic depuis votre espace."
            },
            {
              q: "Puis-je acheter des crédits sans abonnement ?",
              a: "Oui ! En tant qu'utilisateur Freemium, vous pouvez acheter des packs de crédits à la carte pour utiliser ponctuellement nos outils IA. C'est idéal pour tester avant de s'abonner ou pour un besoin unique."
            }
          ].map((faq, idx) => (
            <div key={idx} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-2 text-gray-900">{faq.q}</h3>
              <p className="text-gray-600">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
