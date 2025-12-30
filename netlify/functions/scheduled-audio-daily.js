const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts'

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

// Générer un résumé audio PUBLIC (sans userId)
async function generatePublicDailySummary() {
  console.log('🎙️ Génération du résumé audio PUBLIC quotidien...')

  try {
    // Récupérer les articles des dernières 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: articles, error: artErr } = await supabase
      .from('articles')
      .select('id, title, summary, category, published_at')
      .eq('is_published', true)
      .gte('published_at', since)
      .order('published_at', { ascending: false })
      .limit(50)

    if (artErr) throw artErr
    if (!articles || articles.length === 0) {
      console.log('📭 Aucun article récent pour le résumé public')
      return { success: true, message: 'Aucun article récent' }
    }

    console.log(`📰 ${articles.length} articles trouvés pour le résumé public`)

    // Déterminer le créneau horaire
    const hour = new Date().getHours()
    let timeSlot = 'morning'
    let greetingContext = 'matinale'
    if (hour >= 12 && hour < 18) {
      timeSlot = 'afternoon'
      greetingContext = 'de la mi-journée'
    } else if (hour >= 18) {
      timeSlot = 'evening'
      greetingContext = 'du soir'
    }

    // Créer le script du résumé
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    let script = `Bonjour et bienvenue dans votre édition ${greetingContext} de Gabon 24/7, nous sommes le ${today}.\n\n`
    script += `Voici les principales informations du jour:\n\n`

    articles.forEach((article, i) => {
      script += `${i + 1}. ${article.title}\n`
      if (article.summary) {
        script += `${article.summary.substring(0, 200)}...\n\n`
      }
    })

    script += `\nC'était votre résumé ${greetingContext} sur Gabon 24/7. Restez informés, restez connectés.`

    console.log('📝 Script généré:', script.substring(0, 200) + '...')

    // Générer l'audio avec OpenAI TTS
    if (!OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY manquant')
      return { success: false, error: 'OPENAI_API_KEY manquant' }
    }

    const ttsResp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: 'alloy',
        input: script,
        response_format: 'mp3'
      })
    })

    if (!ttsResp.ok) {
      const errText = await ttsResp.text()
      throw new Error(`OpenAI TTS error: ${errText}`)
    }

    const audioBuffer = Buffer.from(await ttsResp.arrayBuffer())
    const duration = Math.max(15, Math.ceil(audioBuffer.length / 16000))

    console.log(`🔊 Audio généré: ${audioBuffer.length} bytes, ~${duration}s`)

    // Upload vers Supabase Storage
    const fileName = `public/daily_${timeSlot}_${Date.now()}.mp3`
    const { error: uploadErr } = await supabase.storage
      .from('audio-summaries')
      .upload(fileName, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      })

    if (uploadErr) {
      console.error('❌ Upload error:', uploadErr)
      throw uploadErr
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabase.storage
      .from('audio-summaries')
      .getPublicUrl(fileName)

    const audioUrl = urlData?.publicUrl
    console.log('🔗 Audio URL:', audioUrl)

    // Insérer dans audio_summaries avec user_id = NULL (public)
    const { data: summary, error: insertErr } = await supabase
      .from('audio_summaries')
      .insert({
        user_id: null,  // PUBLIC
        summary_type: 'daily',
        article_ids: articles.map(a => a.id),
        articles_count: articles.length,
        text_summary: script,
        audio_url: audioUrl,
        audio_duration_seconds: duration,
        status: 'completed',
        language: 'fr',
        time_slot: timeSlot,
        voice_used: 'alloy'
      })
      .select()
      .single()

    if (insertErr) {
      console.error('❌ Insert error:', insertErr)
      throw insertErr
    }

    console.log('✅ Résumé audio PUBLIC créé:', summary.id)
    return { success: true, summaryId: summary.id, audioUrl }

  } catch (error) {
    console.error('❌ Erreur génération résumé public:', error)
    return { success: false, error: error.message }
  }
}

exports.handler = async () => {
  const headers = {
    'Content-Type': 'application/json'
  }

  try {
    // 1. GÉNÉRER LE RÉSUMÉ PUBLIC (pour tous les visiteurs)
    console.log('🌐 Étape 1: Génération du résumé public...')
    const publicResult = await generatePublicDailySummary()
    console.log('📊 Résultat public:', publicResult)

    // 2. Récupérer utilisateurs ayant activé le résumé quotidien
    console.log('👥 Étape 2: Génération des résumés personnalisés...')
    const { data: users, error } = await supabase
      .from('users')
      .select('id, audio_settings')
      .not('audio_settings', 'is', null)
    if (error) throw error

    const enabled = (users || []).filter(u => u.audio_settings?.daily_summary_enabled === true)

    if (!enabled.length) {
      console.log('📭 Aucun utilisateur avec résumé quotidien activé')
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          publicSummary: publicResult,
          processedUsers: 0
        })
      }
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        publicSummary: publicResult,
        processedUsers: enabled.length
      })
    }
  } catch (e) {
    console.error('scheduled-audio-daily error', e)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) }
  }
}
