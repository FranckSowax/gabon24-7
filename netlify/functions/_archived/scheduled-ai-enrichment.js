// Scheduled runner: enrich recent articles, then process alert matches for those IDs
const enrichFn = require('./ai-enrich-articles')
const matchFn = require('./process-alert-matches')

// Run every 25 minutes
exports.config = { schedule: '*/25 * * * *' }

exports.handler = async (event, context) => {
  try {
    const enrichEvent = {
      httpMethod: 'POST',
      body: JSON.stringify({ process_all: false, since_minutes: 180, limit: 30 })
    }
    const enrichRes = await enrichFn.handler(enrichEvent, context)
    const enrichBody = JSON.parse(enrichRes.body || '{}')

    const okIds = (enrichBody.results || []).filter(r => r.ok).map(r => r.id)

    if (okIds.length > 0) {
      const matchEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({ article_ids: okIds })
      }
      await matchFn.handler(matchEvent, context)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, enriched: enrichBody.processed || 0, matched_from_enriched: okIds.length })
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: e.message }) }
  }
}
