import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/article-seo'

// La page est un composant navigateur : elle ne peut pas déclarer ses propres
// métadonnées. Sans ce fichier, elle reprenait le titre de l'accueil.
export const metadata: Metadata = {
  title: { absolute: 'Veille actualité Gabon sur WhatsApp — dès 2 000 FCFA/mois' },
  description:
    'Recevez les alertes de l\'actualité gabonaise qui vous concernent, directement sur WhatsApp. Essai gratuit 24 h, à partir de 2 000 FCFA/mois.',
  alternates: { canonical: '/veille-alertes' },
  openGraph: {
    title: 'Veille actualité Gabon sur WhatsApp — dès 2 000 FCFA/mois',
    description:
      'Recevez les alertes de l\'actualité gabonaise qui vous concernent, directement sur WhatsApp. Essai gratuit 24 h.',
    url: '/veille-alertes',
    type: 'website',
  },
}

// Prix affichés par défaut sur la page (2 000 et 15 000 FCFA/mois). S'ils
// changent en base, mettre ces deux valeurs à jour.
const serviceJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Veille & alertes actualité Gabon sur WhatsApp',
  provider: { '@id': `${SITE_URL}/#organization` },
  areaServed: { '@type': 'Country', name: 'Gabon' },
  offers: [
    { '@type': 'Offer', name: 'Particulier', price: '2000', priceCurrency: 'XAF', url: `${SITE_URL}/veille-alertes` },
    { '@type': 'Offer', name: 'Entreprise', price: '15000', priceCurrency: 'XAF', url: `${SITE_URL}/veille-alertes` },
  ],
}

export default function VeilleAlertesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd).replace(/</g, '\\u003c') }}
      />
      {children}
    </>
  )
}
