import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { ArticlePageClient } from './ArticlePageClient'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gaboninsight.com'

async function getArticle(id: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return null

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data } = await supabase
      .from('articles')
      .select('id, title, summary_ai, summary, source, author, image_urls, published_at, category')
      .eq('id', id)
      .single()

    return data
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const article = await getArticle(params.id)

  if (!article) {
    return {
      title: 'Article non trouvé',
    }
  }

  const title = article.title
  const description = (article.summary_ai || article.summary || '').substring(0, 160)
  const imageUrl = article.image_urls?.[0] || `${BASE_URL}/LOGO GABON INSIGHT ORANGE psd.png`

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
      publishedTime: article.published_at,
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

// Fonction requise pour l'export statique Next.js
export async function generateStaticParams() {
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
