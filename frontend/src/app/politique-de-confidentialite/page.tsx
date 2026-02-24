'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PolitiqueDeConfidentialite() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Politique de Confidentialit&eacute;
        </h1>
        <p className="text-sm text-gray-500 mb-10">
          Derni&egrave;re mise &agrave; jour : 24 f&eacute;vrier 2026
        </p>

        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Gabon Insight (&laquo; nous &raquo;, &laquo; notre &raquo;) exploite la plateforme accessible &agrave; l&apos;adresse
              gaboninsight.com. La pr&eacute;sente politique de confidentialit&eacute; d&eacute;crit comment nous
              collectons, utilisons et prot&eacute;geons vos donn&eacute;es personnelles conform&eacute;ment &agrave; la
              r&eacute;glementation en vigueur en R&eacute;publique Gabonaise et au R&egrave;glement G&eacute;n&eacute;ral sur la
              Protection des Donn&eacute;es (RGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. Donn&eacute;es collect&eacute;es</h2>
            <p className="text-gray-700 leading-relaxed">Nous collectons les donn&eacute;es suivantes :</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Donn&eacute;es d&apos;identification</strong> : nom, pr&eacute;nom, adresse e-mail</li>
              <li><strong>Num&eacute;ro WhatsApp</strong> : utilis&eacute; pour l&apos;envoi de notifications et r&eacute;sum&eacute;s d&apos;actualit&eacute;s</li>
              <li><strong>Donn&eacute;es de connexion</strong> : adresse IP, navigateur, appareil, pages visit&eacute;es</li>
              <li><strong>Donn&eacute;es de compte</strong> : pr&eacute;f&eacute;rences, favoris, historique de consultation</li>
              <li><strong>Donn&eacute;es de paiement</strong> : trait&eacute;es par nos prestataires de paiement s&eacute;curis&eacute;s (nous ne stockons pas vos informations bancaires)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Finalit&eacute;s du traitement</h2>
            <p className="text-gray-700 leading-relaxed">Vos donn&eacute;es sont utilis&eacute;es pour :</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Cr&eacute;er et g&eacute;rer votre compte utilisateur</li>
              <li>Personnaliser votre exp&eacute;rience (recommandations, r&eacute;sum&eacute;s audio IA)</li>
              <li>Envoyer des notifications WhatsApp sur les actualit&eacute;s gabonaises</li>
              <li>G&eacute;rer les abonnements et paiements</li>
              <li>Am&eacute;liorer nos services gr&acirc;ce &agrave; l&apos;analyse d&apos;usage</li>
              <li>Assurer la s&eacute;curit&eacute; de la plateforme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. Base l&eacute;gale</h2>
            <p className="text-gray-700 leading-relaxed">
              Le traitement de vos donn&eacute;es repose sur :
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Votre consentement</strong> : lors de l&apos;inscription et de l&apos;activation des notifications</li>
              <li><strong>L&apos;ex&eacute;cution du contrat</strong> : fourniture du service d&apos;agr&eacute;gation d&apos;actualit&eacute;s</li>
              <li><strong>L&apos;int&eacute;r&ecirc;t l&eacute;gitime</strong> : am&eacute;lioration de nos services et s&eacute;curit&eacute;</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Partage des donn&eacute;es</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous ne vendons jamais vos donn&eacute;es personnelles. Elles peuvent &ecirc;tre partag&eacute;es avec :
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Supabase</strong> : h&eacute;bergement de la base de donn&eacute;es et authentification</li>
              <li><strong>Cloudflare</strong> : s&eacute;curit&eacute; et protection anti-bot (Turnstile)</li>
              <li><strong>Prestataires de paiement</strong> : traitement s&eacute;curis&eacute; des transactions</li>
              <li><strong>Services d&apos;IA</strong> : g&eacute;n&eacute;ration de r&eacute;sum&eacute;s et analyses (donn&eacute;es anonymis&eacute;es)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Dur&eacute;e de conservation</h2>
            <p className="text-gray-700 leading-relaxed">
              Vos donn&eacute;es sont conserv&eacute;es pendant toute la dur&eacute;e de votre compte actif,
              puis supprim&eacute;es dans un d&eacute;lai de 30 jours apr&egrave;s la cl&ocirc;ture de votre compte.
              Les donn&eacute;es de facturation sont conserv&eacute;es pendant la dur&eacute;e l&eacute;gale applicable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Vos droits</h2>
            <p className="text-gray-700 leading-relaxed">
              Vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li><strong>Acc&egrave;s</strong> : obtenir une copie de vos donn&eacute;es personnelles</li>
              <li><strong>Rectification</strong> : corriger des donn&eacute;es inexactes</li>
              <li><strong>Suppression</strong> : demander l&apos;effacement de vos donn&eacute;es</li>
              <li><strong>Portabilit&eacute;</strong> : recevoir vos donn&eacute;es dans un format structur&eacute;</li>
              <li><strong>Opposition</strong> : vous opposer au traitement de vos donn&eacute;es</li>
              <li><strong>Limitation</strong> : restreindre le traitement de vos donn&eacute;es</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Pour exercer ces droits, contactez-nous &agrave; : <a href="mailto:contact@gaboninsight.com" className="text-orange-600 hover:underline">contact@gaboninsight.com</a>
            </p>
            <p className="text-gray-700 leading-relaxed mt-2">
              Pour demander la suppression de vos donn&eacute;es : <a href="/suppression-des-donnees" className="text-orange-600 hover:underline">Formulaire de suppression</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Cookies</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous utilisons des cookies essentiels au fonctionnement du site (session, authentification).
              Aucun cookie publicitaire ou de tra&ccedil;age tiers n&apos;est utilis&eacute; sans votre consentement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">9. S&eacute;curit&eacute;</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous mettons en &oelig;uvre des mesures techniques et organisationnelles pour
              prot&eacute;ger vos donn&eacute;es : chiffrement SSL/TLS, authentification s&eacute;curis&eacute;e,
              contr&ocirc;le d&apos;acc&egrave;s, et surveillance continue de la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">10. Connexion via r&eacute;seaux sociaux</h2>
            <p className="text-gray-700 leading-relaxed">
              Si vous vous connectez via Google ou Facebook, nous recevons uniquement votre
              nom et adresse e-mail associ&eacute;s &agrave; votre compte. Nous n&apos;acc&eacute;dons pas &agrave; vos
              contacts, publications ou autres donn&eacute;es de ces plateformes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">11. Modifications</h2>
            <p className="text-gray-700 leading-relaxed">
              Nous nous r&eacute;servons le droit de modifier cette politique. Toute modification
              sera publi&eacute;e sur cette page avec la date de mise &agrave; jour.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">12. Contact</h2>
            <p className="text-gray-700 leading-relaxed">
              Pour toute question relative &agrave; cette politique, contactez-nous :
            </p>
            <ul className="list-none pl-0 text-gray-700 space-y-1 mt-2">
              <li>E-mail : <a href="mailto:contact@gaboninsight.com" className="text-orange-600 hover:underline">contact@gaboninsight.com</a></li>
              <li>Site : <a href="https://gaboninsight.com" className="text-orange-600 hover:underline">gaboninsight.com</a></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
