import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toaster'
import { CreditAlertProvider } from '@/contexts/CreditAlertContext'
import { QueryProvider } from '@/providers/QueryProvider'
import { ModalProvider } from '@/contexts/ModalContext'
import Analytics from '@/components/Analytics'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Gabon Insight | Actualités Gabon, Opportunités d\'Investissement & Business',
    template: '%s | Gabon Insight',
  },
  description: 'Toute l\'actualité du Gabon en temps réel : politique, économie, opportunités d\'investissement, business et projets. Analyses IA, tendances et alertes sur l\'actualité gabonaise.',
  keywords: [
    'actualités Gabon',
    'actualité gabonaise',
    'opportunités investissement Gabon',
    'business Gabon',
    'économie Gabon',
    'investir au Gabon',
    'projets Gabon',
    'Gabon Insight',
    'news Gabon',
    'Libreville actualités',
    'Gabon économie',
    'opportunités affaires Gabon',
  ],
  authors: [{ name: 'Gabon Insight' }],
  creator: 'Gabon Insight',
  publisher: 'Gabon Insight',
  icons: {
    icon: '/LOGO GABON INSIGHT ORANGE psd.png',
    shortcut: '/LOGO GABON INSIGHT ORANGE psd.png',
    apple: '/LOGO GABON INSIGHT ORANGE psd.png',
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://gaboninsight.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Gabon Insight | Actualités Gabon & Opportunités d\'Investissement',
    description: 'Toute l\'actualité du Gabon en temps réel : politique, économie, opportunités d\'investissement et business. Analyses IA et alertes.',
    url: '/',
    siteName: 'Gabon Insight',
    locale: 'fr_GA',
    type: 'website',
    images: [
      {
        url: '/LOGO GABON INSIGHT ORANGE psd.png',
        width: 1200,
        height: 630,
        alt: 'Gabon Insight - Actualités et Opportunités d\'Investissement au Gabon',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gabon Insight | Actualités Gabon & Opportunités d\'Investissement',
    description: 'Toute l\'actualité du Gabon en temps réel : politique, économie, opportunités d\'investissement et business.',
    images: ['/LOGO GABON INSIGHT ORANGE psd.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': 'https://gaboninsight.com/#organization',
                  name: 'Gabon Insight',
                  url: 'https://gaboninsight.com',
                  logo: {
                    '@type': 'ImageObject',
                    url: 'https://gaboninsight.com/LOGO GABON INSIGHT ORANGE psd.png',
                  },
                  description: 'Plateforme d\'actualités et d\'opportunités d\'investissement au Gabon.',
                  sameAs: [],
                },
                {
                  '@type': 'WebSite',
                  '@id': 'https://gaboninsight.com/#website',
                  url: 'https://gaboninsight.com',
                  name: 'Gabon Insight',
                  publisher: { '@id': 'https://gaboninsight.com/#organization' },
                  inLanguage: 'fr',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: 'https://gaboninsight.com/?q={search_term_string}',
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Analytics />
        <QueryProvider>
          <ToastProvider>
            <AuthProvider>
              <CreditAlertProvider>
                <ModalProvider>
                  {children}
                </ModalProvider>
              </CreditAlertProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
/* Deploy forcé: Thu Oct 16 13:15:04 WAT 2025 - commit 9cbc2cb */
