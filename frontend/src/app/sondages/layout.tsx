import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sondages — Votre Avis sur l\'Actualité au Gabon',
  description: 'Participez aux sondages sur l\'actualité gabonaise. Donnez votre avis sur la politique, l\'économie et les enjeux de société au Gabon.',
  alternates: { canonical: '/sondages' },
  openGraph: {
    title: 'Sondages — Votre Avis sur l\'Actualité au Gabon',
    description: 'Participez aux sondages sur l\'actualité gabonaise.',
    url: '/sondages',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
