const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event, context) => {
  try {
    const { questionId, answer, userFingerprint } = JSON.parse(event.body || '{}')

    if (!questionId || !answer || !userFingerprint) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Question ID, réponse et empreinte utilisateur requis' 
        })
      }
    }

    // Vérifier si l'utilisateur a déjà voté pour cette question
    const { data: existingVote } = await supabase
      .from('poll_responses')
      .select('id')
      .eq('question_id', questionId)
      .eq('user_fingerprint', userFingerprint)
      .single()

    if (existingVote) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          success: false, 
          error: 'Vous avez déjà voté pour cette question' 
        })
      }
    }

    // Enregistrer le vote
    const { data: voteData, error: voteError } = await supabase
      .from('poll_responses')
      .insert({
        question_id: questionId,
        response_value: answer,
        user_fingerprint: userFingerprint
      })
      .select()

    if (voteError) {
      console.error('❌ Erreur lors de l\'enregistrement du vote:', voteError)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de l\'enregistrement du vote',
          details: voteError.message 
        })
      }
    }

    // Récupérer les statistiques mises à jour
    const { data: stats, error: statsError } = await supabase
      .from('poll_stats')
      .select('*')
      .eq('question_id', questionId)
      .order('vote_count', { ascending: false })

    if (statsError) {
      console.error('❌ Erreur lors de la récupération des statistiques:', statsError)
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
        message: 'Vote enregistré avec succès',
        vote: voteData?.[0],
        stats: stats || []
      })
    }

  } catch (error) {
    console.error('❌ Erreur dans vote-question:', error)
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
