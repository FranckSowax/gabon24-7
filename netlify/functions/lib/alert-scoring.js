function normalizeText(s) {
  // Lowercase + remove diacritics to make matching accent-insensitive
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function countOccurrences(haystack, needle) {
  if (!haystack || !needle) return 0
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
  const m = haystack.match(re)
  return m ? m.length : 0
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

function hoursSince(iso) {
  if (!iso) return 999
  const d = new Date(iso).getTime()
  return (Date.now() - d) / 36e5
}

function intersect(a=[], b=[]) {
  const sb = new Set((b||[]).map(x => (x||'').toLowerCase()))
  return (a||[]).filter(x => sb.has((x||'').toLowerCase()))
}

function toNumber(value, def = 0) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = parseFloat(value)
    return Number.isFinite(n) ? n : def
  }
  return def
}

function getRoot(s) {
  const n = normalizeText(s || '')
  return n.length >= 6 ? n.slice(0, 6) : ''
}

function scoreArticleAgainstAlert(article, alert) {
  const title = normalizeText(article.title)
  const summary = normalizeText(article.summary)
  const content = normalizeText(article.content)

  const alertKeywords = (alert.keywords || []).map(k => normalizeText(k))
  const aiKeywords = (article.ai_keywords || []).map(k => normalizeText(k))
  const aiCategory = normalizeText(article.ai_category || '')
  const alertCategories = (alert.categories || []).map(c => normalizeText(c))

  let score = 0
  const matchedKeywords = new Set()

  for (const kw of alertKeywords) {
    let kwScore = 0
    const t = countOccurrences(title, kw)
    if (t > 0) kwScore += t * 0.3

    const s = countOccurrences(summary, kw)
    if (s > 0) kwScore += s * 0.2

    const inContent = countOccurrences(content, kw)
    if (inContent > 0) kwScore += Math.min(inContent * 0.1, 0.2)

    // Boost when AI extracted keyword overlaps
    if (aiKeywords.some(ak => ak.includes(kw))) kwScore += 0.35

    // Fallback: try a short root match if no exact hits (handles plurals like "petroliers" vs "petrole")
    if (kwScore === 0) {
      const root = getRoot(kw)
      if (root) {
        const tr = countOccurrences(title, root)
        if (tr > 0) kwScore += tr * 0.2

        const sr = countOccurrences(summary, root)
        if (sr > 0) kwScore += sr * 0.12

        const cr = countOccurrences(content, root)
        if (cr > 0) kwScore += Math.min(cr * 0.08, 0.16)

        if (aiKeywords.some(ak => ak.includes(root))) kwScore += 0.25
      }
    }

    if (kwScore > 0) {
      matchedKeywords.add(kw)
      score += kwScore
    }
  }

  // Category alignment
  if (aiCategory && alertCategories.length > 0) {
    if (alertCategories.includes(aiCategory)) score += 0.2
  }

  // Fact-check & importance & breaking boosts
  const importance = clamp(toNumber(article.ai_importance, 0), 0, 1)
  const factScore = clamp(toNumber(article.ai_fact_score, 0), 0, 1)
  const isBreaking = !!article.ai_is_breaking

  // Recency factor: small decay after 12h
  const h = Math.min(hoursSince(article.published_at || article.enriched_at), 72)
  const recencyFactor = h <= 12 ? 1 : clamp(1 - (h - 12) * 0.01, 0.7, 1)

  // Combine
  let combined = score
  combined *= (0.6 + 0.4 * importance)
  combined += isBreaking ? 0.05 : 0
  combined += 0.05 * factScore
  combined *= recencyFactor

  // Normalize
  combined = clamp(combined, 0, 0.99)

  const matched = matchedKeywords.size > 0 && combined >= 0.3

  return {
    matched,
    matchedKeywords: Array.from(matchedKeywords),
    confidenceScore: combined
  }
}

module.exports = { scoreArticleAgainstAlert }
