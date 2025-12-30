const { createClient } = require('@supabase/supabase-js')
const { callGPT5NanoWithFallback, calculateCost } = require('./utils/replicate-gpt5-helper')

// Helpers
const OPENAI_TTS_MODEL = 'gpt-4o-mini-tts'
const OPENAI_TEXT_MODEL = 'gpt-4o-mini'
const DAILY_SCRIPT_MODEL = 'gpt-4o'

console.log('🔍 Audio Summary - Environment check:')
console.log('REPLICATE_API_TOKEN:', process.env.REPLICATE_API_TOKEN ? 'SET' : 'MISSING')
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET (fallback)' : 'MISSING')

function calcCustomCreditsUnits(articleCount) {
  // Doc: base 2 + 0.5 per extra after 5. Align with existing scheme (x10 units)
  const base = 2
  const extra = Math.max(0, articleCount - 5) * 0.5
  return Math.round((base + extra) * 10)
}

async function translateText(text, targetLang, OPENAI_API_KEY) {
  try {
    console.log(`🚀 Translating to ${targetLang} with GPT-5 Nano...`)
    const langMap = { fr: 'French', en: 'English (US)', zh: 'Chinese (Mandarin, Simplified)' }
    const target = langMap[targetLang] || 'French'
    
    const result = await callGPT5NanoWithFallback(text, {
      systemPrompt: `You are a professional radio news translator. Translate into ${target} with a neutral broadcast tone, preserving concise sentences and the structure. Keep the length roughly similar.`,
      maxTokens: 500,
      temperature: 0.2,
      returnJSON: false,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    })
    
    console.log('✅ Translation completed')
    console.log('📊 Provider:', result.provider)
    const cost = calculateCost(result.usage, result.provider, result.model)
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`)
    
    return cleanScript(result.content || text)
  } catch (e) {
    console.error('❌ Translation error:', e.message)
    return text
  }
}

// === Professional Daily Script Generation (per editorial brief) ===
function organizeArticlesByCategory(articles) {
  const categories = { politique: [], economie: [], societe: [], sport: [], culture: [] }
  articles.forEach(article => {
    const category = (article.category || '').toLowerCase()
    if (category === 'politique' || category === 'political') {
      categories.politique.push(article)
    } else if (category === 'économie' || category === 'economy' || category === 'economie' || category === 'mines' || category === 'pétrole' || category === 'petrole') {
      categories.economie.push(article)
    } else if (category === 'sport' || category === 'sports') {
      categories.sport.push(article)
    } else if (category === 'culture' || category === 'événement' || category === 'evenement') {
      categories.culture.push(article)
    } else {
      categories.societe.push(article)
    }
  })
  Object.keys(categories).forEach(cat => {
    categories[cat].sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
  })
  return categories
}

function generateDailyBulletinPrompt(articles) {
  const categorizedArticles = organizeArticlesByCategory(articles)
  const today = new Date()
  const dateFormatted = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hour = today.getHours()
  let greetingContext = ''
  if (hour < 12) greetingContext = 'matinale'
  else if (hour < 18) greetingContext = 'de la mi-journée'
  else greetingContext = 'du soir'

  let articlesData = ''
  if (categorizedArticles.politique.length > 0) {
    articlesData += '\n\n=== POLITIQUE ===\n'
    categorizedArticles.politique.forEach((a, i) => {
      articlesData += `\nArticle ${i + 1}:\n`
      articlesData += `Titre: ${a.title}\n`
      articlesData += `Résumé: ${a.summary || ''}\n`
      if (Array.isArray(a.entities) && a.entities.length) articlesData += `Entités clés: ${a.entities.join(', ')}\n`
    })
  }
  if (categorizedArticles.economie.length > 0) {
    articlesData += '\n\n=== ÉCONOMIE ===\n'
    categorizedArticles.economie.forEach((a, i) => {
      articlesData += `\nArticle ${i + 1}:\n`
      articlesData += `Titre: ${a.title}\n`
      articlesData += `Résumé: ${a.summary || ''}\n`
    })
  }
  if (categorizedArticles.societe.length > 0) {
    articlesData += "\n\n=== SOCIÉTÉ / FAITS D'ACTUALITÉ ===\n"
    categorizedArticles.societe.forEach((a, i) => {
      articlesData += `\nArticle ${i + 1}:\n`
      articlesData += `Titre: ${a.title}\n`
      articlesData += `Résumé: ${a.summary || ''}\n`
    })
  }
  if (categorizedArticles.sport.length > 0) {
    articlesData += '\n\n=== SPORT ===\n'
    categorizedArticles.sport.forEach((a, i) => {
      articlesData += `\nArticle ${i + 1}:\n`
      articlesData += `Titre: ${a.title}\n`
      articlesData += `Résumé: ${a.summary || ''}\n`
    })
  }
  if (categorizedArticles.culture.length > 0) {
    articlesData += '\n\n=== CULTURE ET ÉVÉNEMENTS ===\n'
    categorizedArticles.culture.forEach((a, i) => {
      articlesData += `\nArticle ${i + 1}:\n`
      articlesData += `Titre: ${a.title}\n`
      articlesData += `Résumé: ${a.summary || ''}\n`
    })
  }

  const fullPrompt = `Tu es un journaliste radio professionnel gabonais de Gabon 24/7, spécialisé dans la présentation de bulletins d'information.\nTu maîtrises parfaitement le ton, le rythme et les codes du journalisme audio gabonais.\n\nMISSION\nCréer un script audio de bulletin d'information pour l'édition ${greetingContext} du ${dateFormatted}, structuré par catégories et présenté avec le professionnalisme d'une station de radio nationale.\n\nSTRUCTURE OBLIGATOIRE DU BULLETIN\n1. Introduction (≈5-8 secondes) avec salutation appropriée pour une édition ${greetingContext}\n2. POLITIQUE (si articles disponibles) — 2 à 3 infos majeures synthétisées, enchaînées très brièvement\n3. ÉCONOMIE (si articles disponibles) — 1 info majeure synthétisée\n4. SOCIÉTÉ/FAITS (si articles disponibles) — 1 info synthétisée\n5. SPORT (si articles disponibles) — 1 info synthétisée\n6. CULTURE/ÉVÉNEMENTS (si articles disponibles) — 1 info synthétisée\n7. Conclusion signature Gabon 24/7 (≈3-5 secondes)\n\nARTICLES À TRAITER\n${articlesData}\n\nCONSIGNES ÉDITORIALES\n- Prioriser l'actualité politique nationale (chefs de l'État, gouvernement, institutions) avec 2–3 points clés\n- Style radiophonique professionnel, phrases courtes (≤ 18 mots)\n- Présent de narration, transitions naturelles et très concises\n- SEULEMENT l'essentiel, pas de détails superflus\n- Durée cible: 75–95 secondes (≈180–230 mots). Ne pas dépasser 230 mots.\n\nRÈGLES STRICTES\n❌ Ne pas répéter les titres mot à mot\n❌ Pas de langage trop écrit ou académiqu\n❌ Pas d'opinions personnelles\n✅ Commencer par l'info principale\n✅ Verbes d'action forts\n✅ Contextualisation gabonaise\n\nFORMAT DE SORTIE\nRetourne UNIQUEMENT le script audio prêt TTS, sans méta-données ni instructions.\nDébute par la salutation et termine par la signature Gabon 24/7.`

  return fullPrompt
}

function cleanScript(script) {
  let s = (script || '').trim()
  s = s.replace(/#{1,6}\s/g, '')
  s = s.replace(/\*\*/g, '').replace(/\*/g, '')
  s = s.replace(/\[.*?\]/g, '')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}

function enforceWordCap(text, maxWords = 170) {
  const words = (text || '').trim().split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '…'
}

async function generateProfessionalDailyScript(articles, OPENAI_API_KEY) {
  const prompt = generateDailyBulletinPrompt(articles)
  
  try {
    console.log('🚀 Generating daily script with GPT-5 Nano...');
    const result = await callGPT5NanoWithFallback(prompt, {
      systemPrompt: "Tu es un journaliste radio professionnel gabonais spécialisé dans les bulletins d'information.",
      maxTokens: 450,
      temperature: 0.6,
      returnJSON: false,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o'
    });
    
    console.log('✅ Daily script generated');
    const cost = calculateCost(result.usage, result.provider, result.model);
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`);
    
    const script = result.content || '';
    return enforceWordCap(cleanScript(script), 230);
  } catch (error) {
    console.error('❌ Error generating script:', error.message);
    throw error;
  }
}

function wordsTargetForPace(pace) {
  // Ajusté pour des durées plus courtes (~45–75s)
  if (pace === 'slow') return { min: 140, max: 180 }
  if (pace === 'fast') return { min: 70, max: 100 }
  return { min: 100, max: 140 }
}

async function optimizeScriptWithOpenAI(rawScript, OPENAI_API_KEY, pace = 'normal') {
  try {
    const { min, max } = wordsTargetForPace(pace)
    
    console.log('🚀 Optimizing script with GPT-5 Nano...');
    const result = await callGPT5NanoWithFallback(rawScript, {
      systemPrompt: `Tu es un rédacteur de bulletins audio pour Gabon 24/7. Conserve un ton professionnel, clair, avec transitions fluides. Contrainte: ${min} à ${max} mots (≈30–60 secondes).`,
      maxTokens: 400,
      temperature: 0.5,
      returnJSON: false,
      fallbackToOpenAI: true,
      openaiModel: 'gpt-4o-mini'
    });
    
    console.log('✅ Script optimized');
    const cost = calculateCost(result.usage, result.provider, result.model);
    console.log('💰 Cost:', `$${cost.total_cost.toFixed(6)}`);
    
    return result.content || rawScript;
  } catch (e) {
    console.error('❌ Error optimizing script:', e.message);
    return rawScript;
  }
}

async function ttsWithOpenAI(text, voice, OPENAI_API_KEY) {
  // Map voices to OpenAI available ones
  const voiceMap = {
    af_nicole: 'alloy',
    af_adam: 'alloy',
    alloy: 'alloy',
    aria: 'aria',
    verse: 'verse',
    cove: 'cove',
    default: 'alloy'
  }
  const targetVoice = voiceMap[voice] || voiceMap.default

  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: targetVoice,
      input: text,
      format: 'mp3'
    })
  })
  const ab = await resp.arrayBuffer()
  if (!resp.ok) {
    let msg = 'OpenAI TTS error'
    try { msg = Buffer.from(ab).toString('utf8') } catch {}
    throw new Error(msg)
  }
  const audioBuffer = Buffer.from(ab)
  // rough estimate: ~16KB/s for mp3 low bitrate (very approximate)
  const duration = Math.max(15, Math.ceil(audioBuffer.length / 16000))
  return { audioBuffer, duration, contentType: 'audio/mpeg', extension: 'mp3' }
}

async function sendAudioViaWhatsApp(phoneNumber, audioUrl, caption, WHAPI_TOKEN) {
  const resp = await fetch('https://gate.whapi.cloud/messages/audio', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHAPI_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: phoneNumber,
      media: { url: audioUrl, mimetype: 'audio/mpeg' },
      caption
    })
  })
  const json = await resp.json()
  if (!resp.ok) throw new Error(json?.message || 'Whapi error')
  return { messageId: json.message_id, status: json.status }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json'
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  const WHAPI_TOKEN = process.env.WHAPI_TOKEN
  if (!supabaseUrl || !supabaseServiceKey) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Supabase env missing' }) }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    if (event.httpMethod === 'GET') {
      // GET history? expects userId, limited to last 24h
      const params = event.queryStringParameters || {}
      const userId = params.userId
      if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId requis' }) }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('audio_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50)
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, summaries: data || [] }) }
    }

    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method not allowed' }) }
    }

    const body = JSON.parse(event.body || '{}')
    const {
      action = 'custom',
      userId,
      articleIds = [],
      optimize = true,
      sendWhatsApp = true,
      voice = 'af_nicole',
      pace = 'normal',
      language = 'fr',
      languages = undefined
    } = body

    // Resolve languages list (backward compat): first is primary
    const validLangs = ['fr', 'en', 'zh']
    const languagesList = Array.isArray(languages) && languages.length
      ? Array.from(new Set(languages.filter(l => validLangs.includes(l))))
      : [language]
    const primaryLang = languagesList[0] || 'fr'

    if (!userId) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'userId requis' }) }

    if (action === 'custom') {
      if (!Array.isArray(articleIds) || articleIds.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Aucun article sélectionné' }) }
      }

      if (!OPENAI_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'OPENAI_API_KEY manquant' }) }

      // Compute required credits (units x10)
      const requiredCredits = calcCustomCreditsUnits(articleIds.length)

      // Check credits via credit-manager
      try {
        const origin = event.headers.host ? `https://${event.headers.host}` : ''
        const chk = await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_balance', userId, requiredCredits })
        }).then(r => r.json())
        if (chk.hasCredits === false) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: false, needsTopUp: true, requiredCredits, balance: chk.balance ?? null }) }
        }
      } catch (e) {
        // permissive
      }

      // Fetch user settings and articles
      const { data: user } = await supabase
        .from('users')
        .select('audio_settings, whatsapp_number')
        .eq('id', userId)
        .single()

      const { data: articles, error: artErr } = await supabase
        .from('articles')
        .select('id, title, summary, ai_summary, published_at')
        .in('id', articleIds)
        .order('published_at', { ascending: false })
      if (artErr) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: artErr.message }) }

      // Build raw script
      let script = 'Voici le résumé audio de vos articles sélectionnés.\n\n'
      articles.forEach((a, i) => {
        const s = a.ai_summary || a.summary || ''
        script += `Article ${i + 1}. ${a.title}.\n${s}\n\n`
      })
      script += "Fin de votre résumé d'actualités. Restez informé avec Gabon 24/7."

      const effectivePace = pace || (user?.audio_settings?.pace || 'normal')
      if (optimize) script = await optimizeScriptWithOpenAI(script, OPENAI_API_KEY, effectivePace)
      // Cap à ~170 mots pour rester < ~75s et respecter les limites TTS
      script = enforceWordCap(script, 170)

      // Create DB record (processing)
      const langVoiceMap = { fr: 'alloy', en: 'aria', zh: 'verse' }
      const effectiveVoice = langVoiceMap[primaryLang] || (voice || user?.audio_settings?.preferred_voice || 'alloy')
      const { data: summary, error: insErr } = await supabase
        .from('audio_summaries')
        .insert({
          user_id: userId,
          summary_type: 'custom',
          article_ids: articleIds,
          articles_count: articleIds.length,
          status: 'processing',
          credits_cost: Math.round(requiredCredits),
          whatsapp_phone: user?.audio_settings?.whatsapp_number || user?.whatsapp_number || null,
          voice_used: effectiveVoice
        })
        .select('*')
        .single()
      if (insErr) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: insErr.message }) }

      // Update status -> synthesizing_audio (TTS starting)
      await supabase.from('audio_summaries').update({ status: 'synthesizing_audio' }).eq('id', summary.id)
      // Build primary language script
      let primaryScript = script
      if (primaryLang !== 'fr') {
        try { primaryScript = await translateText(script, primaryLang, OPENAI_API_KEY) } catch (e) {}
        primaryScript = enforceWordCap(primaryScript, 170)
      }
      // TTS primary
      const { audioBuffer, duration, contentType, extension } = await ttsWithOpenAI(primaryScript, effectiveVoice, OPENAI_API_KEY)

      // Update status -> uploading_audio
      await supabase.from('audio_summaries').update({ status: 'uploading_audio' }).eq('id', summary.id)
      // Upload to Storage
      const filePath = `${userId}/${summary.id}.${extension}`
      const up = await supabase.storage
        .from('audio-summaries')
        .upload(filePath, audioBuffer, { contentType, upsert: true })
      if (up.error) {
        await supabase.from('audio_summaries').update({ status: 'failed', error_message: up.error.message }).eq('id', summary.id)
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: up.error.message }) }
      }
      const pub = await supabase.storage.from('audio-summaries').getPublicUrl(filePath)
      const audioUrl = pub.data?.publicUrl

      // Trigger background generation of extra languages (non bloquant)
      try {
        const origin = event.headers.host ? `https://${event.headers.host}` : ''
        await fetch(`${origin}/.netlify/functions/audio-summary-extras-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summaryId: summary.id, userId, languages: languagesList.slice(1), capWords: 170 })
        })
      } catch (e) { /* ignore */ }

      // Update status -> sending_whatsapp (if applicable)
      await supabase.from('audio_summaries').update({ status: sendWhatsApp ? 'sending_whatsapp' : 'finalizing' }).eq('id', summary.id)
      // WhatsApp send
      let whatsappResult = null
      if (sendWhatsApp && WHAPI_TOKEN && (user?.audio_settings?.whatsapp_number || user?.whatsapp_number)) {
        try {
          const caption = `🎙️ Votre résumé audio Gabon 24/7 (${articleIds.length} articles)`
          whatsappResult = await sendAudioViaWhatsApp(user.audio_settings?.whatsapp_number || user.whatsapp_number, audioUrl, caption, WHAPI_TOKEN)
        } catch (e) {
          // Non blocking
        }
      }

      // Update record
      await supabase
        .from('audio_summaries')
        .update({
          text_summary: script,
          audio_url: audioUrl,
          audio_duration_seconds: duration,
          whatsapp_sent: !!whatsappResult,
          whatsapp_sent_at: whatsappResult ? new Date().toISOString() : null,
          whatsapp_message_id: whatsappResult?.messageId || null,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', summary.id)

      // Consume credits
      try {
        const origin = event.headers.host ? `https://${event.headers.host}` : ''
        await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'consume_credits',
            userId,
            serviceName: 'audio_summary:custom',
            amount: requiredCredits,
            referenceId: summary.id
          })
        })
      } catch (e) {}

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, summaryId: summary.id, audioUrl, duration, whatsappSent: !!whatsappResult, extrasQueued: languagesList.length > 1 }) }
    }

    if (action === 'daily') {
      if (!OPENAI_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'OPENAI_API_KEY manquant' }) }

      // Daily cost: 5 credits -> x10 units
      const requiredCredits = 5 * 10

      // Check credits via credit-manager
      try {
        const origin = event.headers.host ? `https://${event.headers.host}` : ''
        const chk = await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check_balance', userId, requiredCredits })
        }).then(r => r.json())
        if (chk.hasCredits === false) {
          return { statusCode: 200, headers, body: JSON.stringify({ success: false, needsTopUp: true, requiredCredits, balance: chk.balance ?? null }) }
        }
      } catch (e) { /* permissive */ }

      // Fetch user settings
      const { data: user } = await supabase
        .from('users')
        .select('audio_settings, whatsapp_number')
        .eq('id', userId)
        .single()

      // Compute today's articles: most recent first, up to user quota
      const start = new Date(); start.setHours(0,0,0,0)
      const { data: todayArticles, error: artErr } = await supabase
        .from('articles')
        .select('id, title, summary, ai_summary, category, published_at')
        .gte('published_at', start.toISOString())
        .order('published_at', { ascending: false })
        .limit((user?.audio_settings?.max_articles_daily) || 10)
      if (artErr) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: artErr.message }) }
      if (!todayArticles || todayArticles.length === 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: "Aucun article aujourd'hui" }) }
      }

      // Build professional radio-grade script using the editorial prompt
      const articlesForPrompt = (todayArticles || []).map(a => ({ ...a, summary: a.ai_summary || a.summary || '' }))
      let script = await generateProfessionalDailyScript(articlesForPrompt, OPENAI_API_KEY)

      // Create DB record (processing)
      const articleIdsDaily = todayArticles.map(a => a.id)
      const langVoiceMap2 = { fr: 'alloy', en: 'aria', zh: 'verse' }
      const effectiveVoice2 = langVoiceMap2[primaryLang] || (voice || user?.audio_settings?.preferred_voice || 'alloy')
      const { data: summary, error: insErr } = await supabase
        .from('audio_summaries')
        .insert({
          user_id: userId,
          summary_type: 'daily',
          article_ids: articleIdsDaily,
          articles_count: articleIdsDaily.length,
          status: 'processing',
          credits_cost: requiredCredits,
          whatsapp_phone: user?.audio_settings?.whatsapp_number || user?.whatsapp_number || null,
          voice_used: effectiveVoice2
        })
        .select('*')
        .single()
      if (insErr) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: insErr.message }) }

      // Update status -> synthesizing_audio (TTS starting)
      await supabase.from('audio_summaries').update({ status: 'synthesizing_audio' }).eq('id', summary.id)
      // Primary language script
      let primaryScript2 = script
      if (primaryLang !== 'fr') {
        try { primaryScript2 = await translateText(script, primaryLang, OPENAI_API_KEY) } catch (e) {}
        primaryScript2 = enforceWordCap(primaryScript2, 230)
      }
      // TTS primary
      const { audioBuffer, duration, contentType, extension } = await ttsWithOpenAI(primaryScript2, effectiveVoice2, OPENAI_API_KEY)

      // Upload to Storage
      const filePath = `${userId}/${summary.id}.${extension}`
      const up = await supabase.storage
        .from('audio-summaries')
        .upload(filePath, audioBuffer, { contentType, upsert: true })
      if (up.error) {
        await supabase.from('audio_summaries').update({ status: 'failed', error_message: up.error.message }).eq('id', summary.id)
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: up.error.message }) }
      }
      const pub = await supabase.storage.from('audio-summaries').getPublicUrl(filePath)
      const audioUrl = pub.data?.publicUrl

      // Trigger background generation of extra languages for daily (non bloquant)
      try {
        const origin = event.headers.host ? `https://${event.headers.host}` : ''
        await fetch(`${origin}/.netlify/functions/audio-summary-extras-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ summaryId: summary.id, userId, languages: languagesList.slice(1), capWords: 230 })
        })
      } catch (e) { /* ignore */ }

      // WhatsApp send
      let whatsappResult = null
      if (sendWhatsApp && WHAPI_TOKEN && (user?.audio_settings?.whatsapp_number || user?.whatsapp_number)) {
        try {
          const caption = `🎙️ Votre résumé d'actualités Gabon 24/7 du ${new Date().toLocaleDateString('fr-FR')}`
          whatsappResult = await sendAudioViaWhatsApp(user.audio_settings?.whatsapp_number || user.whatsapp_number, audioUrl, caption, WHAPI_TOKEN)
        } catch (e) { /* non bloquant */ }
      }

      // Update record
      await supabase
        .from('audio_summaries')
        .update({
          text_summary: script,
          audio_url: audioUrl,
          audio_duration_seconds: duration,
          whatsapp_sent: !!whatsappResult,
          whatsapp_sent_at: whatsappResult ? new Date().toISOString() : null,
          whatsapp_message_id: whatsappResult?.messageId || null,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', summary.id)

      // Consume credits
      try {
        const origin = event.headers.host ? `https://${event.headers.host}` : ''
        await fetch(`${origin}/.netlify/functions/credit-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'consume_credits',
            userId,
            serviceName: 'audio_summary:daily',
            amount: requiredCredits,
            referenceId: summary.id
          })
        })
      } catch (e) {}

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, summaryId: summary.id, audioUrl, duration, whatsappSent: !!whatsappResult, extraAudio }) }
    }

    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Action non supportée' }) }

  } catch (error) {
    console.error('audio-summary error:', error)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Internal server error' }) }
  }
}
