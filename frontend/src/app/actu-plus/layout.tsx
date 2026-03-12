import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Actu Plus — Résumés IA des Actualités du Gabon',
  description: 'Résumés intelligents et analyses IA de l\'actualité gabonaise. Politique, économie, société : l\'essentiel de l\'info au Gabon en un coup d\'œil.',
  alternates: { canonical: '/actu-plus' },
  openGraph: {
    title: 'Actu Plus — Résumés IA des Actualités du Gabon',
    description: 'Résumés intelligents et analyses IA de l\'actualité gabonaise.',
    url: '/actu-plus',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
