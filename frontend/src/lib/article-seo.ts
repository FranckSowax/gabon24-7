/**
 * Lecture des articles côté serveur, pour que leur contenu soit présent dans
 * le HTML livré aux moteurs de recherche (pages article et accueil).
 *
 * WHY: tout le contenu était chargé par le navigateur après coup. Le HTML
 * servi ne contenait ni le texte des articles ni de lien vers eux : aucun
 * article n'était indexé par Google (audit SEO du 5 août 2026).
 *
 * Réservé aux composants serveur (utilise le cache de rendu de React). Les
 * fonctions de mise en forme, partagées avec le navigateur, sont dans
 * `article-format.ts`. Lecture seule, avec la clé publique (les règles d'accès de la base
 * s'appliquent comme pour un visiteur).
 *
 * @example
 *   const result = await getArticleForPage(id)
 *   if (result.status === 'not_found') notFound()
 */

import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { mapArticleRow, text, type PublicArticle } from './article-format'

export { mapArticleRow, htmlToPlainText, type PublicArticle } from './article-format'

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gaboninsight.com').replace(/\/$/, '')
export const SITE_LOGO_URL = `${SITE_URL}/logo-gabon-insight.png`

/** Entrée de la liste « Dernières actualités » de l'accueil. */
export interface ArticleLink {
  id: string
  title: string
  source: string
  category: string
  publishedAt: string
}

export type ArticleLookup =
  | { status: 'found'; article: PublicArticle }
  | { status: 'not_found' }
  /** Base injoignable ou non configurée : le navigateur retentera le chargement. */
  | { status: 'unavailable' }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return null
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

/**
 * Lit un article pour sa page. Mis en cache le temps d'un rendu : les
 * métadonnées et la page partagent la même lecture.
 */
export const getArticleForPage = cache(async (id: string): Promise<ArticleLookup> => {
  if (!UUID_PATTERN.test(id)) return { status: 'not_found' }

  const supabase = getClient()
  if (!supabase) return { status: 'unavailable' }

  try {
    const { data, error } = await supabase.from('articles').select('*').eq('id', id).maybeSingle()
    if (error) return { status: 'unavailable' }
    // Un article non publié (article sponsorisé en attente de validation) n'a pas de page.
    if (!data || data.is_published === false) return { status: 'not_found' }
    return { status: 'found', article: mapArticleRow(data) }
  } catch {
    return { status: 'unavailable' }
  }
})

/** Derniers articles publiés, pour la liste de liens de l'accueil. Jamais d'exception. */
export async function getLatestArticleLinks(limit = 40): Promise<ArticleLink[]> {
  const supabase = getClient()
  if (!supabase) return []

  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, source, category, published_at')
      .or('is_published.is.null,is_published.eq.true')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data
      .filter((row) => text(row.title).trim().length > 0)
      .map((row) => ({
        id: String(row.id),
        title: text(row.title).trim(),
        source: text(row.source),
        category: text(row.category),
        publishedAt: text(row.published_at),
      }))
  } catch {
    return []
  }
}
