import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ToastProvider } from '@/components/ui/Toaster'
import { CreditAlertProvider } from '@/contexts/CreditAlertContext'
import { QueryProvider } from '@/providers/QueryProvider'
import { ModalProvider } from '@/contexts/ModalContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gabon Insight - Actualités Gabonaises via WhatsApp',
  description: 'Plateforme SaaS d\'agrégation et de distribution d\'actualités gabonaises via WhatsApp avec IA - MCP Enhanced',
  keywords: ['Gabon', 'actualités', 'WhatsApp', 'SaaS', 'IA', 'RSS'],
  authors: [{ name: 'Gabon Insight Team' }],
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Gabon Insight - Actualités Gabonaises',
    description: 'Recevez les actualités gabonaises directement sur WhatsApp',
    url: '/',
    siteName: 'Gabon Insight',
    locale: 'fr_GA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gabon Insight - Actualités Gabonaises',
    description: 'Recevez les actualités gabonaises directement sur WhatsApp',
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
      <body className={inter.className}>
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
