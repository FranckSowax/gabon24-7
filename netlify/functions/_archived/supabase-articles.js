const { createClient } = require('@supabase/supabase-js')

// Serverless function: returns Supabase articles with server-side filtering/pagination
// Supports archives mode (> N days) and general filters
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for supabase-articles')
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server config error' }) }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const qp = event.queryStringParameters || {}
    const tab = qp.tab || 'archives'

    const page = Math.max(1, parseInt(qp.page || '1', 10))
    const pageSize = Math.max(1, Math.min(parseInt(qp.page_size || '200', 10) || 200, 200))

    const q = (qp.q || '').trim()
    const source = (qp.source || '').trim()
    const category = (qp.category || '').trim()
    const dateFrom = (qp.date_from || '').trim()
    const dateTo = (qp.date_to || '').trim()
    // Apply cutoff by default only for archives; for tab=all, default to 0 unless explicitly provided
    const olderThanDays = qp.older_than_days !== undefined
      ? Math.max(0, parseInt(qp.older_than_days, 10))
      : (tab === 'archives' ? 7 : 0)

    // Base query
    let query = supabase
      .from('articles')
      .select('id,title,summary,content,url,image_url,author,source,category,published_at,created_at,view_count', { count: 'exact' })

    // Archives mode: only articles older than N days (default 7)
    if (tab === 'archives' || olderThanDays > 0) {
      const now = new Date()
      const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000)
      const cutoffISO = cutoff.toISOString()
      // Archives: uniquement les articles dont created_at <= cutoff (J-olderThanDays)
      query = query.lte('created_at', cutoffISO)
    }

    // Search filter
    if (q) {
      const encoded = q.replace(/\s+/g, ' ').trim()
      query = query.or(`title.ilike.%${encoded}%,summary.ilike.%${encoded}%,source.ilike.%${encoded}%`)
    }

    // Source filter
    if (source) {
      query = query.eq('source', source)
    }

    // Category filter
    if (category) {
      query = query.eq('category', category)
    }

    // Date range filter (optional)
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo)
    }

    // Order by created_at desc as default
    query = query.order('created_at', { ascending: false })

    // Pagination
    const start = (page - 1) * pageSize
    const end = start + pageSize - 1
    query = query.range(start, end)

    const { data, error, count } = await query

    if (error) {
      console.error('Supabase query error (supabase-articles):', error)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }
    }

    const articles = (data || []).map((a) => ({
      id: a.id,
      title: a.title,
      summary: a.summary || a.content || '',
      url: a.url,
      imageUrl: a.image_url || null,
      author: a.author || null,
      source: a.source || '',
      category: a.category || 'actualités',
      published_at: a.published_at || null,
      created_at: a.created_at || null,
      view_count: a.view_count || 0,
      viewCount: `${a.view_count || 0} vue${(a.view_count || 0) > 1 ? 's' : ''}`
    }))

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        tab,
        total: count || 0,
        page,
        page_size: pageSize,
        articles
      })
    }
  } catch (err) {
    console.error('Unhandled error (supabase-articles):', err)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server error' }) }
  }
}
