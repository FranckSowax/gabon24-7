import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BCEG Project — Du projet à un financement BCEG en 5 étapes',
  description: 'Transforme une actualité gabonaise en projet ficelé prêt à être financé par la BCEG. IA d\'analyse, simulation de crédit BCEG, dossier de financement généré automatiquement.',
  alternates: { canonical: '/business/live-opportunities' },
  openGraph: {
    title: 'BCEG Project — Financement entrepreneurial au Gabon',
    description: 'De l\'idée au financement BCEG en 5 étapes : analyse IA, plan d\'action, simulation crédit, dossier soumission. En partenariat avec la BCEG.',
    url: '/business/live-opportunities',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
