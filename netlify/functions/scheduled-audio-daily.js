const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// Utilitaire simple pour limiter la concurrence
async function mapLimit(arr, limit, iter) {
  const ret = []
  const executing = []
  for (const item of arr) {
    const p = Promise.resolve().then(() => iter(item))
    ret.push(p)
    if (limit <= arr.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) await Promise.race(executing)
    }
  }
  return Promise.allSettled(ret)
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json'
  }

  try {
    // Récupérer utilisateurs ayant activé le résumé quotidien
    const { data: users, error } = await supabase
      .from('users')
      .select('id, audio_settings')
      .not('audio_settings', 'is', null)
    if (error) throw error

    const enabled = (users || []).filter(u => u.audio_settings?.daily_summary_enabled === true)
    if (!enabled.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, processed: 0 }) }
    }

    const origin = process.env.URL || process.env.DEPLOY_PRIME_URL || ''
    const endpoint = origin ? `${origin}/.netlify/functions/audio-summary` : `/.netlify/functions/audio-summary`

    // Traiter par lots (5 en parallèle)
    await mapLimit(enabled, 5, async (u) => {
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'daily', userId: u.id, optimize: true, sendWhatsApp: true })
        })
        const json = await resp.json().catch(() => ({}))
        if (!resp.ok || json.success === false) {
          console.error('Daily generation failed for user', u.id, json)
        }
      } catch (e) {
        console.error('Request error for user', u.id, e)
      }
    })

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, processed: enabled.length }) }
  } catch (e) {
    console.error('scheduled-audio-daily error', e)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) }
  }
}
