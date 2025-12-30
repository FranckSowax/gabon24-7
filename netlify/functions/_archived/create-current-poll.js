const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event, context) => {
  try {
    console.log('🚀 Création du sondage du jour basé sur l\'actualité...')

    // 1. Archiver les anciens sondages
    const { error: archiveError } = await supabase
      .from('polls')
      .update({ status: 'archived' })
      .eq('status', 'published')

    if (archiveError) {
      console.error('❌ Erreur lors de l\'archivage:', archiveError)
    } else {
      console.log('✅ Anciens sondages archivés')
    }

    // 2. Supprimer les anciennes réponses et statistiques
    await supabase.from('poll_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('poll_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // 3. Calculer l'expiration (demain 19h UTC)
    const expiresAt = new Date()
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 1)
    expiresAt.setUTCHours(19, 0, 0, 0)

    // 4. Créer le nouveau sondage principal
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .insert({
        question: 'Sondage du jour - Actualité gabonaise du 12 septembre 2025',
        poll_type: 'series',
        options: [],
        expires_at: expiresAt.toISOString(),
        status: 'published'
      })
      .select()
      .single()

    if (pollError) {
      console.error('❌ Erreur lors de la création du sondage:', pollError)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la création du sondage',
          details: pollError.message 
        })
      }
    }

    console.log('✅ Sondage principal créé:', pollData)

    // 5. Questions basées sur l'actualité du jour
    const currentQuestions = [
      {
        question: "Le président Oligui Nguema veut arrêter les exportations de matières premières brutes. Pensez-vous que cette stratégie va réussir ?",
        type: "yes_no",
        options: []
      },
      {
        question: "Quelle priorité devrait avoir le Gabon pour développer la transformation locale ?",
        type: "mcq",
        options: ["Industries agroalimentaires", "Transformation du bois", "Raffinage pétrolier", "Mines et métallurgie"]
      },
      {
        question: "La reprise des classes 2025-2026 se fait sous tension. Quel est le principal défi du système éducatif gabonais ?",
        type: "mcq",
        options: ["Infrastructures scolaires", "Formation des enseignants", "Calendrier scolaire", "Financement de l'éducation"]
      },
      {
        question: "Les élections locales approchent (27 septembre). Êtes-vous optimiste sur la transparence du processus électoral ?",
        type: "yes_no",
        options: []
      }
    ]

    // 6. Insérer les questions
    const questionsToInsert = currentQuestions.map((q, index) => ({
      poll_id: pollData.id,
      question_text: q.question,
      question_type: q.type,
      options: q.options,
      question_order: index + 1
    }))

    const { data: questionsData, error: questionsError } = await supabase
      .from('poll_questions')
      .insert(questionsToInsert)
      .select()

    if (questionsError) {
      console.error('❌ Erreur lors de la création des questions:', questionsError)
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          success: false, 
          error: 'Erreur lors de la création des questions',
          details: questionsError.message 
        })
      }
    }

    console.log('✅ Questions créées:', questionsData)

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
        message: 'Sondage du jour créé avec succès',
        poll: {
          id: pollData.id,
          title: pollData.question,
          expires_at: pollData.expires_at,
          questions_count: questionsData.length
        },
        questions: questionsData
      })
    }

  } catch (error) {
    console.error('❌ Erreur dans create-current-poll:', error)
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
