const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration for get-saved-docs')
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server config error' }) }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const qp = event.queryStringParameters || {}
    const userId = qp.userId
    const limit = Math.max(1, Math.min(parseInt(qp.limit || '50', 10), 200))
    const offset = Math.max(0, parseInt(qp.offset || '0', 10))

    if (!userId) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId requis' }) }
    }

    const { data, error, count } = await supabase
      .from('saved_docs')
      .select('id,title,service,content,reference_id,created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Supabase error (get-saved-docs):', error)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, total: count || 0, docs: data || [] })
    }
  } catch (err) {
    console.error('Unhandled error (get-saved-docs):', err)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server error' }) }
  }
}
