const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function getPathFromPublicUrl(url) {
  if (!url) return null
  try {
    const idx = url.indexOf('/audio-summaries/')
    if (idx === -1) return null
    const tail = url.substring(idx + '/audio-summaries/'.length)
    const noQuery = tail.split('?')[0]
    return decodeURIComponent(noQuery)
  } catch {
    return null
  }
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' }
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const batchSize = 200
    let totalDeletedRows = 0
    let totalDeletedFiles = 0

    while (true) {
      const { data: rows, error } = await supabase
        .from('audio_summaries')
        .select('id, audio_url, created_at')
        .lt('created_at', cutoff)
        .order('created_at', { ascending: true })
        .range(0, batchSize - 1)

      if (error) throw error
      if (!rows || rows.length === 0) break

      const filePaths = []
      for (const r of rows) {
        const base = getPathFromPublicUrl(r.audio_url)
        if (!base) continue
        filePaths.push(base)
        // Derive extra language variants (userId/summaryId[-lang].ext)
        const slash = base.indexOf('/')
        if (slash > 0) {
          const userId = base.substring(0, slash)
          const fname = base.substring(slash + 1) // e.g. summaryId.mp3
          const dot = fname.lastIndexOf('.')
          if (dot > 0) {
            const idOnly = fname.substring(0, dot) // summaryId
            const ext = fname.substring(dot + 1)
            filePaths.push(`${userId}/${idOnly}-en.${ext}`)
            filePaths.push(`${userId}/${idOnly}-zh.${ext}`)
          }
        }
      }

      // Delete files first (best-effort)
      if (filePaths.length > 0) {
        const { error: rmErr } = await supabase.storage
          .from('audio-summaries')
          .remove(filePaths)
        if (!rmErr) totalDeletedFiles += filePaths.length
      }

      // Delete DB rows
      const ids = rows.map(r => r.id)
      const { error: delErr } = await supabase
        .from('audio_summaries')
        .delete()
        .in('id', ids)
      if (delErr) throw delErr

      totalDeletedRows += ids.length
      if (rows.length < batchSize) break
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, totalDeletedRows, totalDeletedFiles }) }
  } catch (e) {
    console.error('scheduled-audio-cleanup error', e)
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) }
  }
}
