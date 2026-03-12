import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Opportunités d\'Investissement au Gabon — Business & Projets',
  description: 'Découvrez les meilleures opportunités d\'investissement et de business au Gabon. Projets, idées d\'entreprise et analyses de marché générés par IA à partir de l\'actualité gabonaise.',
  alternates: { canonical: '/business/live-opportunities' },
  openGraph: {
    title: 'Opportunités d\'Investissement au Gabon — Business & Projets',
    description: 'Les meilleures opportunités d\'investissement et de business au Gabon.',
    url: '/business/live-opportunities',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
