const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event, context) => {
  try {
    const payload = JSON.parse(event.body || '{}')
    const questionId = payload.questionId || payload.question_id
    const pollId = payload.poll_id

    if (!questionId && !pollId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'questionId ou poll_id requis' })
      }
    }

    let stats, error
    if (questionId) {
      // Récupérer les statistiques de la question
      ;({ data: stats, error } = await supabase
        .from('poll_stats')
        .select('*')
        .eq('question_id', questionId)
        .order('vote_count', { ascending: false }))
    } else {
      // Récupérer les statistiques agrégées du sondage
      ;({ data: stats, error } = await supabase
        .from('poll_stats')
        .select('*')
        .eq('poll_id', pollId)
        .order('vote_count', { ascending: false }))
    }

    if (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la récupération des statistiques',
          details: error.message 
        })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        success: true,
        stats: stats || []
      })
    }

  } catch (error) {
    console.error('❌ Erreur dans get-question-stats:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: 'Erreur serveur',
        details: error.message 
      })
    }
  }
}
