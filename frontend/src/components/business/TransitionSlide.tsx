'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  Lightbulb, Target, DollarSign, Users, TrendingUp,
  CheckCircle2, ArrowRight, Sparkles, Zap, Trophy,
  Rocket, Brain, Heart, Star
} from 'lucide-react'

interface TransitionSlideProps {
  fromStep: number
  toStep: number
  completedData: {
    project_idea?: string
    target_audience?: string
    revenue_model?: string
    team_size?: string
  }
  onContinue: () => void
}

// Configuration des transitions
const TRANSITIONS = {
  '1-2': {
    title: 'Bravo ! Votre vision est claire',
    subtitle: "Passons maintenant à votre marché",
    icon: Target,
    color: 'from-blue-500 to-purple-500',
    bgGradient: 'from-blue-900 via-purple-900 to-indigo-900',
    achievements: [
      { icon: Lightbulb, text: 'Idée définie', color: 'text-yellow-400' },
      { icon: Heart, text: 'Vision claire', color: 'text-pink-400' },
      { icon: Zap, text: 'Problème identifié', color: 'text-orange-400' }
    ],
    nextBenefits: [
      'Identifier précisément vos clients potentiels',
      'Évaluer la taille de votre opportunité',
      'Comprendre votre avantage concurrentiel'
    ],
    motivationalText: 'Une idée sans marché reste un rêve. Trouvons vos premiers clients !',
    animation: 'target'
  },
  '2-3': {
    title: 'Excellent ! Vous connaissez votre cible',
    subtitle: "Construisons votre modèle économique",
    icon: DollarSign,
    color: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-900 via-emerald-900 to-teal-900',
    achievements: [
      { icon: Target, text: 'Audience ciblée', color: 'text-blue-400' },
      { icon: Trophy, text: 'Marché évalué', color: 'text-yellow-400' },
      { icon: Star, text: 'Valeur unique', color: 'text-purple-400' }
    ],
    nextBenefits: [
      'Définir comment vous allez gagner de l\'argent',
      'Structurer votre stratégie de prix',
      'Planifier vos besoins financiers'
    ],
    motivationalText: 'Un business rentable commence par un modèle solide !',
    animation: 'money'
  },
  '3-4': {
    title: 'Parfait ! Votre stratégie prend forme',
    subtitle: "Parlons de votre équipe et ressources",
    icon: Users,
    color: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-900 via-pink-900 to-rose-900',
    achievements: [
      { icon: DollarSign, text: 'Revenus planifiés', color: 'text-green-400' },
      { icon: Zap, text: 'Prix définis', color: 'text-yellow-400' },
      { icon: Brain, text: 'Coûts estimés', color: 'text-blue-400' }
    ],
    nextBenefits: [
      'Identifier les compétences nécessaires',
      'Planifier votre timeline de lancement',
      'Définir votre localisation stratégique'
    ],
    motivationalText: 'Les bonnes personnes au bon moment font toute la différence !',
    animation: 'team'
  },
  '4-5': {
    title: 'Superbe ! Votre équipe est définie',
    subtitle: "Dernière étape : vos objectifs",
    icon: TrendingUp,
    color: 'from-orange-500 to-red-500',
    bgGradient: 'from-orange-900 via-red-900 to-rose-900',
    achievements: [
      { icon: Users, text: 'Équipe planifiée', color: 'text-purple-400' },
      { icon: Zap, text: 'Compétences listées', color: 'text-blue-400' },
      { icon: Rocket, text: 'Timeline définie', color: 'text-green-400' }
    ],
    nextBenefits: [
      'Fixer des objectifs mesurables',
      'Définir vos indicateurs de succès',
      'Anticiper les risques potentiels'
    ],
    motivationalText: 'Des objectifs clairs = un chemin vers le succès !',
    animation: 'rocket'
  }
}

// Animations Lottie-style avec CSS
const AnimatedIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'target':
      return (
        <div className="relative w-32 h-32">
          {/* Cercles concentriques animés */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-blue-400/30"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{
                scale: [0.5 + i * 0.3, 1 + i * 0.3],
                opacity: [0.8, 0]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4,
                ease: 'easeOut'
              }}
            />
          ))}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Target className="w-16 h-16 text-blue-400" />
          </motion.div>
        </div>
      )

    case 'money':
      return (
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Pièces qui tombent */}
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 font-bold text-xs"
              initial={{ y: -50, x: (i - 2.5) * 20, opacity: 0, rotate: 0 }}
              animate={{
                y: [- 50, 30, 20],
                opacity: [0, 1, 0],
                rotate: [0, 180, 360]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeIn'
              }}
            >
              $
            </motion.div>
          ))}
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <DollarSign className="w-16 h-16 text-green-400" />
          </motion.div>
        </div>
      )

    case 'team':
      return (
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Personnages qui apparaissent */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                transform: `rotate(${i * 72}deg) translateY(-35px)`
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: i * 0.15,
                repeat: Infinity,
                repeatDelay: 2
              }}
            >
              <div className="w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-white" />
              </div>
            </motion.div>
          ))}
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Users className="w-12 h-12 text-purple-400" />
          </motion.div>
        </div>
      )

    case 'rocket':
      return (
        <div className="relative w-32 h-32 flex items-center justify-center overflow-hidden">
          {/* Traînée de la fusée */}
          <motion.div
            className="absolute bottom-0 w-4 bg-gradient-to-t from-orange-500 via-yellow-400 to-transparent"
            initial={{ height: 0 }}
            animate={{ height: ['0%', '60%', '0%'] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ bottom: '20%' }}
          />
          {/* Étoiles */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{
                top: `${20 + i * 15}%`,
                left: `${10 + i * 20}%`,
                opacity: 0
              }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.3
              }}
            >
              <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
            </motion.div>
          ))}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Rocket className="w-16 h-16 text-orange-400" />
          </motion.div>
        </div>
      )

    default:
      return <Sparkles className="w-16 h-16 text-white" />
  }
}

export default function TransitionSlide({
  fromStep,
  toStep,
  completedData,
  onContinue
}: TransitionSlideProps) {
  const transitionKey = `${fromStep}-${toStep}` as keyof typeof TRANSITIONS
  const transition = TRANSITIONS[transitionKey]

  if (!transition) return null

  const Icon = transition.icon

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 bg-gradient-to-br ${transition.bgGradient} flex items-center justify-center p-4`}
    >
      <div className="max-w-2xl w-full">
        {/* Animation centrale */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="flex justify-center mb-8"
        >
          <AnimatedIcon type={transition.animation} />
        </motion.div>

        {/* Titre */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            {transition.title}
          </h2>
          <p className={`text-xl bg-gradient-to-r ${transition.color} bg-clip-text text-transparent font-semibold`}>
            {transition.subtitle}
          </p>
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center gap-4 mb-8"
        >
          {transition.achievements.map((achievement, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6 + i * 0.1, type: 'spring' }}
              className="flex flex-col items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3"
            >
              <achievement.icon className={`w-6 h-6 ${achievement.color}`} />
              <span className="text-white/80 text-xs font-medium">{achievement.text}</span>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </motion.div>
          ))}
        </motion.div>

        {/* Prochains avantages */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-8"
        >
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            Prochaine étape : ce que vous allez définir
          </h3>
          <ul className="space-y-3">
            {transition.nextBenefits.map((benefit, i) => (
              <motion.li
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 + i * 0.1 }}
                className="flex items-center gap-3 text-white/80"
              >
                <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${transition.color} flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold">{i + 1}</span>
                </div>
                {benefit}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Citation motivationnelle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-center text-white/60 italic mb-8"
        >
          "{transition.motivationalText}"
        </motion.p>

        {/* Bouton continuer */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="flex justify-center"
        >
          <button
            onClick={onContinue}
            className={`flex items-center gap-3 px-8 py-4 bg-gradient-to-r ${transition.color} text-white font-bold rounded-2xl hover:shadow-2xl hover:scale-105 transition-all`}
          >
            <span>Continuer vers {toStep === 2 ? 'Marché & Cible' : toStep === 3 ? 'Business Model' : toStep === 4 ? 'Ressources' : 'Objectifs'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Indicateur de progression */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex justify-center gap-2 mt-8"
        >
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full transition-all ${
                step < toStep ? 'bg-green-400' : step === toStep ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  )
}
