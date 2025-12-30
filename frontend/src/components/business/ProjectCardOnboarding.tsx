'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Lightbulb, MessageSquare, FileText, GraduationCap, Target, ArrowRight, Sparkles, Menu } from 'lucide-react'

interface ProjectCardOnboardingProps {
  isOpen: boolean
  onClose: () => void
  onDontShowAgain?: () => void
}

const features = [
  {
    icon: Target,
    title: 'Suivi de progression',
    description: 'Suivez l\'avancement de votre projet étape par étape avec des phases claires',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: MessageSquare,
    title: 'Conseiller IA',
    description: 'Posez vos questions à notre IA experte du contexte gabonais',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: FileText,
    title: 'Documents IA',
    description: 'Générez business plans, études de marché et autres documents professionnels',
    color: 'from-green-500 to-emerald-500'
  },
  {
    icon: GraduationCap,
    title: 'Formation personnalisée',
    description: 'Accédez à des modules de formation adaptés à votre projet',
    color: 'from-orange-500 to-red-500'
  }
]

export default function ProjectCardOnboarding({ isOpen, onClose, onDontShowAgain }: ProjectCardOnboardingProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleClose = () => {
    if (dontShowAgain && onDontShowAgain) {
      onDontShowAgain()
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header avec gradient */}
          <div className="relative bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 p-6 pb-8">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-white/20 rounded-xl">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Bienvenue dans votre Dashboard Projet !</h2>
                <p className="text-white/80 text-sm">Découvrez les outils à votre disposition</p>
              </div>
            </div>
          </div>

          {/* Contenu */}
          <div className="p-6 -mt-4">
            <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-white/5">
              <p className="text-gray-300 text-sm leading-relaxed">
                Votre carte projet est votre <strong className="text-yellow-400">centre de commande</strong> pour transformer votre idée en réalité. 
                Explorez les différents onglets pour accéder à tous les outils IA.
              </p>
            </div>

            {/* Instruction icône menu */}
            <div className="bg-purple-500/20 rounded-xl p-4 mb-4 border border-purple-500/30 flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg shrink-0">
                <Menu className="w-5 h-5 text-white" />
              </div>
              <p className="text-purple-200 text-sm">
                <strong className="text-white">Astuce :</strong> Cliquez sur l'icône <strong className="text-purple-300">menu ☰</strong> en haut à gauche de votre carte pour afficher toutes les fonctionnalités disponibles.
              </p>
            </div>

            {/* Liste des fonctionnalités */}
            <div className="space-y-3 mb-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-r ${feature.color}`}>
                    <feature.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white text-sm">{feature.title}</h4>
                    <p className="text-gray-400 text-xs">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Checkbox ne plus afficher */}
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
              />
              <span className="text-gray-400 text-sm">Ne plus afficher ce message</span>
            </label>

            {/* Bouton CTA */}
            <button
              onClick={handleClose}
              className="w-full py-3 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              C'est parti !
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
