import Link from 'next/link'
import type { ArticleLink } from '@/lib/article-seo'

/**
 * Liste des dernières actualités, rendue par le serveur : de vrais liens
 * `<a href>` vers chaque article, présents dans le HTML livré.
 *
 * WHY: les cartes d'articles de l'accueil s'ouvrent par un clic géré en
 * JavaScript, sans lien. Un moteur de recherche ne trouvait donc aucun chemin
 * vers les articles depuis l'accueil.
 *
 * @example
 *   <LatestArticles articles={await getLatestArticleLinks(40)} />
 */

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  // Fuseau fixé : le serveur et le navigateur affichent la même date.
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Libreville' })
}

export default function LatestArticles({ articles }: { articles: ArticleLink[] }) {
  if (articles.length === 0) return null

  return (
    <section aria-labelledby="dernieres-actualites" className="bg-white border-t border-gray-200 lg:ml-64 lg:mr-80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h2 id="dernieres-actualites" className="text-xl font-bold text-gray-900 mb-6">
          Dernières actualités du Gabon
        </h2>
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {articles.map((article) => (
            <li key={article.id} className="border-b border-gray-100 pb-3">
              <Link href={`/article/${article.id}`} className="font-medium text-gray-900 hover:text-orange-600">
                {article.title}
              </Link>
              <p className="mt-1 text-xs text-gray-500">
                {[article.source, article.category, formatDate(article.publishedAt)].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
