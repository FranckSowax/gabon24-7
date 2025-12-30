const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event, context) => {
  try {
    // Récupérer pollId depuis les query parameters pour GET ou body pour POST
    const pollId = event.queryStringParameters?.poll_id || 
                   event.queryStringParameters?.pollId ||
                   JSON.parse(event.body || '{}').pollId

    if (!pollId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Poll ID requis' })
      }
    }

    // Récupérer les questions du sondage
    const { data: questions, error } = await supabase
      .from('poll_questions')
      .select('*')
      .eq('poll_id', pollId)
      .order('question_order')

    if (error) {
      console.error('❌ Erreur lors de la récupération des questions:', error)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la récupération des questions',
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
        questions: questions || []
      })
    }

  } catch (error) {
    console.error('❌ Erreur dans get-poll-questions:', error)
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
