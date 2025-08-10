import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GabonNews - Actualités Gabonaises via WhatsApp',
  description: 'Plateforme SaaS d\'agrégation et de distribution d\'actualités gabonaises via WhatsApp avec IA',
  keywords: ['Gabon', 'actualités', 'WhatsApp', 'SaaS', 'IA', 'RSS'],
  authors: [{ name: 'GabonNews Team' }],
  creator: 'GabonNews',
  publisher: 'GabonNews',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'GabonNews - Actualités Gabonaises',
    description: 'Recevez les actualités gabonaises directement sur WhatsApp',
    url: '/',
    siteName: 'GabonNews',
    locale: 'fr_GA',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GabonNews - Actualités Gabonaises',
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
        {children}
      </body>
    </html>
  )
}
