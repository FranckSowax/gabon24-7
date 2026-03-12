import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analyse IA des Opportunités Business au Gabon',
  description: 'Analysez les opportunités d\'investissement au Gabon grâce à l\'intelligence artificielle. Identifiez les projets rentables à partir de l\'actualité économique gabonaise.',
  alternates: { canonical: '/business/analyzer' },
  openGraph: {
    title: 'Analyse IA des Opportunités Business au Gabon',
    description: 'Analysez les opportunités d\'investissement au Gabon grâce à l\'IA.',
    url: '/business/analyzer',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
