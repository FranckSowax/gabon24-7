import type { Metadata } from 'next'
import HomePageClient from './HomePageClient'
import LatestArticles from '@/components/seo/LatestArticles'
import { getLatestArticleLinks } from '@/lib/article-seo'

// L'adresse canonique « / » ne vaut que pour l'accueil : déclarée ici, et non
// plus dans le gabarit racine où toutes les pages en héritaient.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

// Page régénérée au plus toutes les 5 minutes : la liste des dernières
// actualités reste fraîche sans interroger la base à chaque visite.
export const revalidate = 300

/**
 * Accueil. L'application interactive (HomePageClient) est inchangée ; le
 * serveur ajoute sous elle la liste des dernières actualités avec de vrais
 * liens, pour que les articles soient découvrables par les moteurs de recherche.
 */
export default async function HomePage() {
  const latestArticles = await getLatestArticleLinks(40)

  return (
    <>
      <HomePageClient />
      <LatestArticles articles={latestArticles} />
    </>
  )
}
