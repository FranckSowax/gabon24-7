import { ArticlePageClient } from './ArticlePageClient'

// Fonction requise pour l'export statique Next.js
export async function generateStaticParams() {
  // Pour l'export statique, nous devons générer quelques IDs d'exemple
  // En production, cela devrait récupérer les vrais IDs depuis l'API
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
    { id: '5' }
  ]
}

export default function ArticlePage() {
  return <ArticlePageClient />
}
