const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function computeNextClosureTime1855UTC(now = new Date()) {
  // Target time today at 18:55 UTC
  const todayTarget = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    18, 55, 0, 0
  ))
  if (now.getTime() < todayTarget.getTime()) {
    return todayTarget
  }
  // Else tomorrow at 18:55 UTC
  const tomorrowTarget = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    18, 55, 0, 0
  ))
  return tomorrowTarget
}

// Fallback neutral questions if none provided
function defaultSeriesPayload() {
  return {
    title: 'Sondage du Jour',
    questions: [
      {
        question: "Quelle priorité quotidienne est la plus importante pour améliorer la vie des citoyens ?",
        type: 'mcq',
        options: ['Accès aux soins', "Qualité de l'éducation", 'Emploi/entrepreneuriat', 'Transports et routes']
      },
      {
        question: "Êtes-vous satisfait de l'état général de la propreté dans votre quartier ?",
        type: 'yes_no'
      },
      {
        question: 'Quel service public devrait être renforcé en premier ?',
        type: 'mcq',
        options: ['Eau potable', 'Électricité', 'Gestion des déchets']
      },
      {
        question: "Pensez-vous que la sécurité routière s'est améliorée ces dernières semaines ?",
        type: 'yes_no'
      }
    ]
  }
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
  }

  try {
    const now = new Date()
    const expiresAt = computeNextClosureTime1855UTC(now)

    const payload = JSON.parse(event.body || '{}')
    const series = payload && Array.isArray(payload.questions) && payload.questions.length > 0
      ? payload
      : defaultSeriesPayload()

    const title = (series.title || 'Sondage du Jour').toString().slice(0, 200)

    // Optionnel: désactiver/archiver les sondages actuellement actifs avant d'en créer un nouveau
    if (payload.deactivate_others === true) {
      const { error: deactErr } = await supabase
        .from('polls')
        .update({ status: 'archived', is_active: false })
        .eq('status', 'published')
        .eq('is_active', true)
      if (deactErr) {
        console.error('⚠️ Échec de la désactivation des sondages actifs existants:', deactErr)
      }
    }

    // Create parent series poll, published immediately, manual
    const { data: poll, error: pollErr } = await supabase
      .from('polls')
      .insert({
        question: title,
        poll_type: 'series',
        options: [],
        expires_at: expiresAt.toISOString(),
        status: 'published',
        published_at: now.toISOString(),
        scheduled_publish_at: null,
        is_active: true,
        is_manual: true,
        total_votes: 0
      })
      .select()
      .single()

    if (pollErr) {
      console.error('❌ Erreur création poll série (manuel):', pollErr)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: pollErr.message }) }
    }

    const questions = series.questions.slice(0, 5)
    const rows = questions.map((q, idx) => ({
      poll_id: poll.id,
      question_text: String(q.question || '').trim().slice(0, 240),
      question_type: q.type === 'yes_no' ? 'yes_no' : 'mcq',
      options: q.type === 'mcq' && Array.isArray(q.options) ? q.options.slice(0, 4) : [],
      question_order: idx + 1
    })).filter(r => r.question_text)

    if (rows.length === 0) {
      await supabase.from('polls').delete().eq('id', poll.id)
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Aucune question valide fournie' }) }
    }

    const { error: qErr } = await supabase.from('poll_questions').insert(rows)
    if (qErr) {
      console.error('❌ Erreur insertion questions (manuel):', qErr)
      // rollback poll to avoid inconsistent data
      await supabase.from('polls').delete().eq('id', poll.id)
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: qErr.message }) }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Sondage de série créé et publié',
        poll: { id: poll.id, expires_at: poll.expires_at, total_votes: poll.total_votes },
        questions: rows
      })
    }
  } catch (error) {
    console.error('❌ Erreur create-manual-series-poll:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) }
  }
}
