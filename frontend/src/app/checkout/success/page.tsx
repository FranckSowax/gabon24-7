'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, ArrowRight, Download, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function CheckoutSuccessPage() {
  const router = useRouter()

  useEffect(() => {
    // Simuler l'envoi d'un email de confirmation
    console.log('Email de confirmation envoyé')
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center"
      >
        {/* Icône de succès */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mb-6"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        </motion.div>

        {/* Titre et message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Paiement réussi !
          </h1>
          <p className="text-gray-600 mb-6">
            Votre abonnement a été activé avec succès. Vous pouvez maintenant profiter de toutes les fonctionnalités.
          </p>
        </motion.div>

        {/* Informations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3"
        >
          <div className="flex items-center space-x-3 text-sm">
            <Mail className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700">Email de confirmation envoyé</span>
          </div>
          <div className="flex items-center space-x-3 text-sm">
            <Download className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700">Facture disponible dans votre profil</span>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-6 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-semibold flex items-center justify-center space-x-2"
          >
            <span>Retour à l'accueil</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => router.push('/profil')}
            className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
          >
            Voir mon profil
          </button>
        </motion.div>
      </motion.div>
    </div>
  )
}
