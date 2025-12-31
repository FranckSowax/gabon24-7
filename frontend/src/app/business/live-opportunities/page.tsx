'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, ArrowRight, Menu, ChevronLeft, ChevronRight } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

const howItWorksSteps = [
  {
    icon: "📰",
    title: "Sélectionnez un article",
    description: "Choisissez parmi les dernières actualités gabonaises"
  },
  {
    icon: "🧠",
    title: "IA analyse l'opportunité",
    description: "Notre intelligence artificielle identifie les secteurs porteurs"
  },
  {
    icon: "💰",
    title: "Définissez votre budget",
    description: "Indiquez votre capacité d'investissement"
  },
  {
    icon: "🚀",
    title: "Recevez vos propositions",
    description: "3 projets personnalisés vous attendent"
  }
]

export default function LiveOpportunitiesPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % howItWorksSteps.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % howItWorksSteps.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + howItWorksSteps.length) % howItWorksSteps.length)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Header onMobileMenuToggle={() => setIsSidebarOpen(true)} />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          isMobileOpen={isSidebarOpen}
          onMobileClose={() => setIsSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 lg:ml-64 lg:mr-80 min-w-0">
          <main className="w-full px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8 sm:mb-12"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4">
                <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                  Opportunités Live
                </span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto px-4">
                Transformez l'actualité gabonaise en opportunités business concrètes grâce à l'intelligence artificielle
              </p>
            </motion.div>

            {/* Comment ça marche - Slide */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 sm:mb-12"
            >
              <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 border border-white/20 max-w-4xl mx-auto">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white text-center mb-4 sm:mb-6">
                  Comment ça marche ? 🤔
                </h2>
                
                <div className="w-full px-2 sm:px-4 lg:px-2 relative">
                  {/* Slide Content */}
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="text-center py-6 sm:py-8"
                  >
                    <div className="text-5xl sm:text-6xl lg:text-7xl mb-3 sm:mb-4">
                      {howItWorksSteps[currentSlide].icon}
                    </div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-semibold text-white mb-2">
                      Étape {currentSlide + 1}: {howItWorksSteps[currentSlide].title}
                    </h3>
                    <p className="text-gray-300 text-sm sm:text-base lg:text-lg px-2">
                      {howItWorksSteps[currentSlide].description}
                    </p>
                  </motion.div>

                  {/* Navigation Arrows */}
                  <button
                    onClick={prevSlide}
                    className="absolute left-0 sm:left-2 top-1/2 transform -translate-y-1/2 p-1.5 sm:p-2 text-white/60 hover:text-white transition-colors bg-black/20 rounded-full hover:bg-black/40"
                  >
                    <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-0 sm:right-2 top-1/2 transform -translate-y-1/2 p-1.5 sm:p-2 text-white/60 hover:text-white transition-colors bg-black/20 rounded-full hover:bg-black/40"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </div>

                {/* Slide Indicators */}
                <div className="flex justify-center space-x-2 mt-4 sm:mt-6">
                  {howItWorksSteps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentSlide
                          ? 'bg-yellow-400 scale-110'
                          : 'bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>

                {/* Progress Bar */}
                <div className="mt-3 sm:mt-4 bg-white/20 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-orange-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${((currentSlide + 1) / howItWorksSteps.length) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Bouton Démarrer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center mb-8 sm:mb-12"
            >
              <button
                onClick={() => window.location.href = '/business/analyzer'}
                className="group relative inline-flex items-center justify-center px-6 py-3 sm:px-8 sm:py-4 text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg sm:rounded-xl hover:from-orange-600 hover:to-yellow-600 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 group-hover:animate-pulse" />
                <span className="hidden sm:inline">Démarrer l'Analyse</span>
                <span className="sm:hidden">Analyser</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 sm:ml-3 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-gray-300 text-xs sm:text-sm mt-2 sm:mt-3 px-4">
                Analysez les articles gabonais et découvrez vos opportunités business
              </p>
            </motion.div>

          </main>
        </div>
      </div>
    </div>
  )
}
