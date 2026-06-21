/**
 * fetch avec timeout (AbortController). Drop-in pour `fetch(url, init)`.
 * Évite qu'un backend lent/indisponible fige l'UI (état "loading" bloqué).
 *
 * Usage : const res = await fetchWithTimeout(url, { method: 'POST', ... })
 *         // 3e argument optionnel : timeout en ms (défaut 20000)
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 20000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Délai dépassé (${Math.round(timeoutMs / 1000)} s) — le serveur ne répond pas. Réessayez.`)
    }
    throw err
  } finally {
    clearTimeout(id)
  }
}
