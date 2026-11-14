import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePageClient } from './ArticlePageClient'
import { getArticleForPage, SITE_LOGO_URL, SITE_URL } from '@/lib/article-seo'

// L'article est rendu par le serveur puis gardé 5 minutes : son texte est dans
// le HTML livré (lecteurs et moteurs de recherche), sans interroger la base à
// chaque visite. Les pages sont générées à la première demande.
export const revalidate = 300

export async function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ id: string }> }

// Next 16 : `params` est une promesse (l'accès synchrone a été retiré).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await getArticleForPage(id)

  if (result.status !== 'found') {
    return {
      title: 'Article non trouvé',
      robots: { index: false, follow: true },
    }
  }

  const { article } = result
  const title = article.title
  const description = article.summary.substring(0, 160)
  const imageUrl = article.imageUrl || SITE_LOGO_URL

  return {
    title,
    description,
    alternates: {
      canonical: `/article/${article.id}`,
    },
    openGraph: {
      title,
      description,
      url: `/article/${article.id}`,
      type: 'article',
      publishedTime: article.publishedAt || undefined,
      authors: article.author ? [article.author] : undefined,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { id } = await params
  const result = await getArticleForPage(id)

  // Article inexistant ou non publié : vraie réponse 404, et non plus une page
  // « Article non trouvé » servie avec un code 200.
  if (result.status === 'not_found') notFound()

  // Base injoignable : la page s'affiche quand même et le navigateur retente.
  const article = result.status === 'found' ? result.article : null

  const jsonLd = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: article.title.substring(0, 110),
        description: article.summary || undefined,
        datePublished: article.publishedAt || undefined,
        dateModified: article.publishedAt || undefined,
        inLanguage: 'fr',
        // Le média d'origine est crédité comme auteur ; Gabon Insight est l'éditeur de la page.
        author: { '@type': 'Organization', name: article.source || 'Gabon Insight' },
        publisher: { '@id': `${SITE_URL}/#organization` },
        ...(article.imageUrl ? { image: [article.imageUrl] } : {}),
        ...(article.url ? { isBasedOn: article.url } : {}),
        mainEntityOfPage: `${SITE_URL}/article/${article.id}`,
      }
    : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <ArticlePageClient initialArticle={article} />
    </>
  )
}
