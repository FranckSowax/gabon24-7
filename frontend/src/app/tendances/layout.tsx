import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tendances — Les Actualités Gabon les Plus Lues',
  description: 'Découvrez les articles les plus lus et partagés sur l\'actualité au Gabon. Tendances du jour, de la semaine et du mois sur la politique, l\'économie et la société gabonaise.',
  alternates: { canonical: '/tendances' },
  openGraph: {
    title: 'Tendances — Les Actualités Gabon les Plus Lues',
    description: 'Les articles les plus lus sur l\'actualité au Gabon.',
    url: '/tendances',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
