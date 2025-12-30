const { createClient } = require('@supabase/supabase-js')

// ENV REQUIRED (Netlify Dashboard -> Site settings -> Environment variables)
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - PPLX_API_KEY (Perplexity) [preferred]
// - BRAVE_API_KEY (Brave Search) [optional but recommended]
// - OPENAI_API_KEY (fallback)
// - DEEPSEEK_API_KEY (fallback)

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PPLX_API_KEY = process.env.PPLX_API_KEY
const BRAVE_API_KEY = process.env.BRAVE_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function withTimeout(promise, ms, label='Opération') {
  let to
  const timer = new Promise((_, rej) => { to = setTimeout(() => rej(new Error(`${label} trop longue (${ms}ms)`)), ms) })
  try { return await Promise.race([promise, timer]) } finally { clearTimeout(to) }
}

async function callPerplexity(prompt) {
  if (!PPLX_API_KEY) throw new Error('Missing PPLX_API_KEY')
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PPLX_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar-small-online',
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: 'system', content: 'Tu es un analyste média gabonais. Réponds UNIQUEMENT en JSON valide.' },
        { role: 'user', content: prompt }
      ]
    })
  })
  if (!res.ok) throw new Error(`Perplexity ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Perplexity: JSON introuvable')
  return JSON.parse(match[0])
}

async function callOpenAI(prompt) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-3.5-turbo-0125', temperature: 0.2, max_tokens: 900, messages: [
      { role: 'system', content: 'Tu es un analyste média gabonais. Réponds UNIQUEMENT en JSON valide.' },
      { role: 'user', content: prompt }
    ] })
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('OpenAI: JSON introuvable')
  return JSON.parse(match[0])
}

async function callDeepSeek(prompt) {
  if (!DEEPSEEK_API_KEY) throw new Error('Missing DEEPSEEK_API_KEY')
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.2, max_tokens: 900, messages: [
      { role: 'system', content: 'Tu es un analyste média gabonais. Réponds UNIQUEMENT en JSON valide.' },
      { role: 'user', content: prompt }
    ] })
  })
  if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('DeepSeek: JSON introuvable')
  return JSON.parse(match[0])
}

async function braveSearch(q) {
  if (!BRAVE_API_KEY) return { sources: [], score: 0 }
  const res = await withTimeout(fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5&freshness=y`, {
    headers: { 'X-Subscription-Token': BRAVE_API_KEY, 'Accept': 'application/json' }
  }), 8000, 'Brave Search')
  if (!res.ok) return { sources: [], score: 0 }
  const json = await res.json().catch(() => ({}))
  const web = json?.web?.results || []
  const sources = web.slice(0,5).map(r => ({ title: r?.title, url: r?.url, description: r?.description }))
  // Heuristic verification score: 0..1 based on number of reputable domains present
  const reputable = ['rfi.fr','bbc.com','reuters.com','france24.com','jeuneafrique.com','jeuneafrique','afp','lemonde.fr','apnews.com']
  const score = Math.min(1, sources.filter(s => reputable.some(d => (s.url||'').includes(d))).length / 3)
  return { sources, score }
}

function buildPrompt(article) {
  const text = `
Analyse l'article suivant et retourne STRICTEMENT un JSON compact sans texte additionnel.
Champs attendus:
{
  "category": "Politique|Économie|Société|Culture|Sport|Santé|Éducation|Énergie|Technologie|International|Sécurité|Environnement",
  "keywords": ["mots-clés pertinents"],
  "sentiment": 0.0,           // -1 à 1
  "importance": 0.0,          // 0 à 1 (urgence / impact public)
  "is_breaking": false,
  "entities": [{"name":"...","type":"PERSON|ORG|LOC|OTHER"}],
  "summary": "Résumé FR concis (120-160 mots)",
  "claims": ["faits/affirmations vérifiables (3-6)"],
  "topic": "thème principal court"
}

TITRE: ${article.title || ''}
SOURCE: ${article.source || ''}
RÉSUMÉ: ${article.summary || ''}
CONTENU: ${(article.content || '').slice(0, 3000)}
  `.trim()
  return text
}

async function enrichOne(article) {
  const prompt = buildPrompt(article)
  let parsed
  try {
    if (PPLX_API_KEY) parsed = await callPerplexity(prompt)
    else if (OPENAI_API_KEY) parsed = await callOpenAI(prompt)
    else if (DEEPSEEK_API_KEY) parsed = await callDeepSeek(prompt)
    else throw new Error('Aucune clé IA configurée (PPLX/OPENAI/DEEPSEEK)')
  } catch (e) {
    // retry once with OpenAI / DeepSeek fallback
    try {
      if (!parsed && OPENAI_API_KEY) parsed = await callOpenAI(prompt)
      else if (!parsed && DEEPSEEK_API_KEY) parsed = await callDeepSeek(prompt)
    } catch (e2) {
      throw e2
    }
  }

  // Fact-check / Verification via Brave Search (optional)
  let verification = { sources: [], score: 0 }
  try {
    verification = await braveSearch(article.title || (parsed?.topic || ''))
  } catch (_) {}

  const payload = {
    ai_category: parsed?.category || null,
    ai_keywords: Array.isArray(parsed?.keywords) ? parsed.keywords.slice(0, 15) : [],
    ai_sentiment: typeof parsed?.sentiment === 'number' ? parsed.sentiment : null,
    ai_importance: typeof parsed?.importance === 'number' ? parsed.importance : null,
    ai_is_breaking: !!parsed?.is_breaking,
    ai_entities: Array.isArray(parsed?.entities) ? parsed.entities : [],
    ai_summary: parsed?.summary || null,
    ai_topic: parsed?.topic || null,
    ai_fact_sources: verification.sources,
    ai_fact_score: verification.score,
    enriched_at: new Date().toISOString(),
  }

  return payload
}

async function processBatch(articles) {
  const results = []
  for (const a of articles) {
    try {
      const enriched = await withTimeout(enrichOne(a), 20000, 'Enrichissement article')
      // Update DB
      await supabase.from('articles').update(enriched).eq('id', a.id)
      results.push({ id: a.id, ok: true })
      await sleep(200) // politeness
    } catch (e) {
      console.error('Enrich error for', a.id, e.message)
      results.push({ id: a.id, ok: false, error: e.message })
    }
  }
  return results
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  try {
    const { article_ids, process_all = false, since_minutes = 180, limit = 30 } = JSON.parse(event.body || '{}')

    // Fetch target articles
    let articles = []
    if (Array.isArray(article_ids) && article_ids.length > 0) {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, summary, content, source, url, published_at')
        .in('id', article_ids)
      if (error) throw error
      articles = data || []
    } else {
      const sinceIso = new Date(Date.now() - since_minutes * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, summary, content, source, url, published_at, enriched_at')
        .gte('published_at', sinceIso)
        .is('enriched_at', null)
        .order('published_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      articles = data || []
    }

    if (articles.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, processed: 0, results: [] }) }
    }

    const results = await processBatch(articles)

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, processed: articles.length, results }) }
  } catch (e) {
    console.error('ai-enrich-articles error', e)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error', message: e.message }) }
  }
}
