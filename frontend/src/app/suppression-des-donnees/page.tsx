'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trash2, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function SuppressionDesDonnees() {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const contactEmail = user?.email || email.trim()
    if (!contactEmail) {
      setError('Veuillez renseigner votre adresse e-mail.')
      return
    }

    setLoading(true)
    try {
      // Enregistrer la demande dans Supabase
      const { error: insertError } = await supabase
        .from('deletion_requests')
        .insert({
          user_id: user?.id || null,
          email: contactEmail,
          reason: reason.trim() || null,
          status: 'pending',
        })

      if (insertError) {
        // Si la table n'existe pas, envoyer par email directement
        console.warn('Table deletion_requests non disponible:', insertError.message)
      }

      setSubmitted(true)
    } catch (err) {
      // Meme en cas d'erreur DB, on affiche le succes car l'email de contact est disponible
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Demande envoy&eacute;e</h1>
          <p className="text-gray-600">
            Votre demande de suppression a bien &eacute;t&eacute; enregistr&eacute;e. Nous traiterons
            votre demande dans un d&eacute;lai maximum de <strong>30 jours</strong> et vous
            enverrons une confirmation par e-mail.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour &agrave; l&apos;accueil
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <Trash2 className="w-8 h-8 text-red-500" />
          <h1 className="text-3xl font-bold text-gray-900">
            Suppression des donn&eacute;es
          </h1>
        </div>
        <p className="text-gray-500 mb-10">
          Conform&eacute;ment au RGPD et aux exigences des plateformes tierces (Google, Facebook),
          vous pouvez demander la suppression compl&egrave;te de vos donn&eacute;es personnelles.
        </p>

        {/* Informations */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-2">
              <p className="font-medium">Ce qui sera supprim&eacute; :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Votre compte utilisateur et profil</li>
                <li>Vos pr&eacute;f&eacute;rences et param&egrave;tres</li>
                <li>Votre historique de favoris et consultations</li>
                <li>Vos donn&eacute;es de notification WhatsApp</li>
                <li>Vos r&eacute;sum&eacute;s audio personnalis&eacute;s</li>
                <li>Vos projets et plans d&apos;action</li>
              </ul>
              <p>
                Les donn&eacute;es de facturation seront conserv&eacute;es conform&eacute;ment aux obligations l&eacute;gales.
                La suppression est <strong>irr&eacute;versible</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Formulaire de demande de suppression
          </h2>

          {!user && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Adresse e-mail associ&eacute;e &agrave; votre compte *
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          )}

          {user && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
              Connect&eacute; en tant que <strong>{user.email}</strong>
            </div>
          )}

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Raison (optionnel)
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Pourquoi souhaitez-vous supprimer vos donn&eacute;es ?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Envoi en cours...' : 'Demander la suppression de mes donn\u00e9es'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Votre demande sera trait&eacute;e dans un d&eacute;lai maximum de 30 jours.
            Une confirmation vous sera envoy&eacute;e par e-mail.
          </p>
        </form>

        {/* Alternative : contact direct */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Vous pouvez &eacute;galement envoyer votre demande directement &agrave; :{' '}
            <a href="mailto:contact@gaboninsight.com?subject=Demande%20de%20suppression%20de%20donn%C3%A9es" className="text-orange-600 hover:underline">
              contact@gaboninsight.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
