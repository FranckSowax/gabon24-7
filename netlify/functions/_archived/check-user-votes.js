const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Méthode non autorisée' })
    }
  }

  try {
    const { poll_id, user_fingerprint } = JSON.parse(event.body || '{}')

    if (!poll_id || !user_fingerprint) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'poll_id et user_fingerprint requis' 
        })
      }
    }

    // Récupérer toutes les questions du sondage
    const { data: questions, error: questionsError } = await supabase
      .from('poll_questions')
      .select('id')
      .eq('poll_id', poll_id)

    if (questionsError) {
      console.error('Erreur lors de la récupération des questions:', questionsError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la récupération des questions' 
        })
      }
    }

    if (!questions || questions.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          votedQuestions: [] 
        })
      }
    }

    const questionIds = questions.map(q => q.id)

    // Vérifier quelles questions ont déjà été votées par cet utilisateur
    const { data: votes, error: votesError } = await supabase
      .from('poll_responses')
      .select('question_id')
      .eq('user_fingerprint', user_fingerprint)
      .in('question_id', questionIds)

    if (votesError) {
      console.error('Erreur lors de la vérification des votes:', votesError)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la vérification des votes' 
        })
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        votedQuestions: votes || [] 
      })
    }

  } catch (error) {
    console.error('Erreur dans check-user-votes:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Erreur interne du serveur' 
      })
    }
  }
}
