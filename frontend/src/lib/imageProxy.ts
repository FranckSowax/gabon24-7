export const extractFromNetlifyProxy = (url?: string): string | undefined => {
  if (!url) return url
  if (url.includes('/.netlify/functions/image-proxy')) {
    const m = url.match(/url=([^&]+)/)
    if (m) {
      try { return decodeURIComponent(m[1]) } catch { return m[1] }
    }
  }
  return url
}

export const shouldProxyImage = (url?: string, apiBase?: string): boolean => {
  if (!url) return false
  const API_BASE = apiBase || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  if (url.startsWith(`${API_BASE}/api/image-proxy`)) return false
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://gabon-insight.netlify.app')
    const host = u.hostname
    const isSameOrigin = typeof window !== 'undefined' && host === window.location.hostname
    return !isSameOrigin
  } catch {
    return false
  }
}

export const getProxiedImage = (url?: string, title?: string, apiBase?: string): string | undefined => {
  if (!url) return undefined
  const API_BASE = apiBase || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const clean = (extractFromNetlifyProxy(url) ?? url) as string
  return shouldProxyImage(clean, API_BASE)
    ? `${API_BASE}/api/image-proxy?url=${encodeURIComponent(clean)}&title=${encodeURIComponent(title ?? '')}`
    : clean
}
