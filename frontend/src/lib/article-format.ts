/**
 * Mise en forme des articles : fonctions pures, sans accès réseau ni
 * dépendance au navigateur ou au serveur. Utilisées des deux côtés pour que
 * le HTML rendu par le serveur et celui du navigateur soient identiques.
 *
 * @example
 *   const article = mapArticleRow(row)
 *   const body = htmlToPlainText(article.content)
 */

/** Article tel qu'affiché par la page article (même forme côté serveur et navigateur). */
export interface PublicArticle {
  id: string
  title: string
  summary: string
  content: string
  source: string
  publishedAt: string
  category: string
  viewCount: string
  view_count: number
  url: string
  imageUrl?: string
  author?: string
  trending?: boolean
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Convertit une ligne de la table `articles` vers la forme affichée. */
export function mapArticleRow(row: Record<string, unknown>): PublicArticle {
  const summary = text(row.summary) || text(row.summary_ai) || text(row.description)
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : []
  const viewCount = typeof row.view_count === 'number' ? row.view_count : 0
  return {
    id: String(row.id),
    title: text(row.title),
    summary,
    content: text(row.content) || summary,
    source: text(row.source),
    publishedAt: text(row.published_at) || text(row.created_at),
    category: text(row.category),
    viewCount: String(viewCount),
    view_count: viewCount,
    url: text(row.url) || text(row.link),
    imageUrl: text(row.image_url) || text(imageUrls[0]) || undefined,
    author: text(row.author) || undefined,
    trending: row.trending === true,
  }
}

/**
 * Transforme un contenu d'article (texte, parfois avec des balises HTML) en
 * texte brut. Le résultat est affiché comme du texte par React, qui l'échappe :
 * aucune balise du contenu d'origine n'est interprétée.
 */
export function htmlToPlainText(content: string): string {
  return content
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/gi, '’')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
