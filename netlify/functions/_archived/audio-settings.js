const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Content-Type': 'application/json'
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Supabase env missing' }) }
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {}
      const userId = params.userId
      if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId requis' }) }
      const { data, error } = await supabase
        .from('users')
        .select('audio_settings, whatsapp_number')
        .eq('id', userId)
        .single()
      if (error) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, settings: data?.audio_settings || {}, whatsapp_number: data?.whatsapp_number || '' }) }
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}')
      const { userId, dailyEnabled, deliveryTime, whatsappNumber, preferredVoice, pace } = body
      if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId requis' }) }

      // Fetch current
      const { data: cur } = await supabase
        .from('users')
        .select('audio_settings')
        .eq('id', userId)
        .single()

      const audio_settings = {
        daily_summary_enabled: !!dailyEnabled,
        delivery_time: deliveryTime || (cur?.audio_settings?.delivery_time || '07:00'),
        whatsapp_number: whatsappNumber || cur?.audio_settings?.whatsapp_number || null,
        preferred_voice: preferredVoice || cur?.audio_settings?.preferred_voice || 'af_nicole',
        pace: pace || cur?.audio_settings?.pace || 'normal',
        max_articles_daily: cur?.audio_settings?.max_articles_daily || 10
      }

      const update = { audio_settings }
      if (typeof whatsappNumber === 'string') update.whatsapp_number = whatsappNumber

      const { error } = await supabase
        .from('users')
        .update(update)
        .eq('id', userId)
      if (error) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, settings: audio_settings }) }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  } catch (e) {
    console.error('audio-settings error', e)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal server error' }) }
  }
}
