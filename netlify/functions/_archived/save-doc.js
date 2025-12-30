const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration for save-doc')
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server config error' }) }
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const {
      userId,
      title,
      content, // markdown string
      referenceId = null,
      service = 'actu_plus'
    } = JSON.parse(event.body || '{}')

    if (!userId || !title || !content) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId, title et content requis' }) }
    }

    const { data, error } = await supabase
      .from('saved_docs')
      .insert({
        user_id: userId,
        title,
        content,
        reference_id: referenceId,
        service
      })
      .select('id')
      .single()

    if (error) {
      console.error('Supabase error (save-doc):', error)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: data.id })
    }
  } catch (err) {
    console.error('Unhandled error (save-doc):', err)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Server error' }) }
  }
}
