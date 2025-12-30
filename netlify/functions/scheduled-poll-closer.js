const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fonction planifiée: clôture les sondages expirés, archive et met à jour total_votes
exports.handler = async (event, context) => {
  console.log('⏰ Exécution planifiée - Clôture des sondages expirés...')
  try {
    const nowIso = new Date().toISOString()

    // 1) Récupérer tous les sondages publiés, actifs, expirés
    const { data: expiredPolls, error: fetchError } = await supabase
      .from('polls')
      .select('id, poll_type')
      .eq('status', 'published')
      .eq('is_active', true)
      .lte('expires_at', nowIso)

    if (fetchError) {
      console.error('❌ Erreur récupération sondages expirés:', fetchError)
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: 'Erreur récupération sondages', details: fetchError.message })
      }
    }

    if (!expiredPolls || expiredPolls.length === 0) {
      console.log('ℹ️ Aucun sondage expiré à clôturer')
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: 'Aucun sondage expiré', updated: 0, timestamp: nowIso })
      }
    }

    console.log(`📋 ${expiredPolls.length} sondage(s) expiré(s) à clôturer`)

    const results = []

    // 2) Pour chacun, calculer total_votes et archiver
    for (const poll of expiredPolls) {
      let totalVotes = 0

      if (poll.poll_type === 'series') {
        // Récupérer toutes les questions de la série
        const { data: questions, error: qErr } = await supabase
          .from('poll_questions')
          .select('id')
          .eq('poll_id', poll.id)
        if (qErr) {
          console.error(`❌ Erreur récupération questions pour poll ${poll.id}:`, qErr)
        } else if (questions && questions.length > 0) {
          const qIds = questions.map(q => q.id)
          // Compter les réponses associées aux questions
          const { count, error: cErr } = await supabase
            .from('poll_responses')
            .select('id', { count: 'exact', head: true })
            .in('question_id', qIds)
          if (cErr) {
            console.error(`❌ Erreur comptage votes (series) pour poll ${poll.id}:`, cErr)
          } else {
            totalVotes = count || 0
          }
        }
      } else {
        // Sondage simple (mcq / yes_no) - compter via poll_id
        const { count, error: cErr } = await supabase
          .from('poll_responses')
          .select('id', { count: 'exact', head: true })
          .eq('poll_id', poll.id)
        if (cErr) {
          console.error(`❌ Erreur comptage votes (simple) pour poll ${poll.id}:`, cErr)
        } else {
          totalVotes = count || 0
        }
      }

      // Archiver et désactiver
      const { data: updated, error: upErr } = await supabase
        .from('polls')
        .update({ status: 'archived', is_active: false, total_votes: totalVotes })
        .eq('id', poll.id)
        .select()
        .single()
      if (upErr) {
        console.error(`❌ Erreur archivage poll ${poll.id}:`, upErr)
      } else {
        console.log(`✅ Poll ${poll.id} archivé avec ${totalVotes} vote(s)`) 
        results.push({ id: poll.id, total_votes: totalVotes })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, closed_count: results.length, results, timestamp: nowIso })
    }
  } catch (error) {
    console.error('❌ Erreur lors de la clôture automatique:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Erreur lors de la clôture automatique', details: error.message })
    }
  }
}
