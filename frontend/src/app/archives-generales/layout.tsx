import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Archives — Toutes les Actualités du Gabon',
  description: 'Retrouvez l\'intégralité des actualités du Gabon : archives complètes par date, source et catégorie. Politique, économie, société, sport et culture gabonaise.',
  alternates: { canonical: '/archives-generales' },
  openGraph: {
    title: 'Archives — Toutes les Actualités du Gabon',
    description: 'Archives complètes des actualités gabonaises par date, source et catégorie.',
    url: '/archives-generales',
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
