import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Créer un Projet Business au Gabon',
  description: 'Lancez votre projet d\'entreprise au Gabon avec l\'aide de l\'IA. Étude de marché, business model, plan financier et ressources pour investir au Gabon.',
  alternates: { canonical: '/business/creer-projet' },
  openGraph: {
    title: 'Créer un Projet Business au Gabon — Gabon Insight',
    description: 'Lancez votre projet d\'entreprise au Gabon avec l\'aide de l\'IA.',
    url: '/business/creer-projet',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
