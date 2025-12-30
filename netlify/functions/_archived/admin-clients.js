const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function json(headers, statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers }

  try {
    // Admin auth: Accept either X-Admin-Secret header or Supabase user JWT in Authorization header
    let isAdmin = false
    const adminSecret = event.headers['x-admin-secret'] || event.headers['X-Admin-Secret']
    if (adminSecret && process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
      isAdmin = true
    }

    if (!isAdmin) {
      const auth = event.headers.authorization || event.headers.Authorization
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.slice('Bearer '.length)
        try {
          const { data, error } = await supabase.auth.getUser(token)
          if (!error && data?.user?.email) {
            const email = data.user.email.toLowerCase()
            const allowList = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
            const allowedDomain = (process.env.ADMIN_DOMAIN || '').toLowerCase().trim()
            if ((allowList.length && allowList.includes(email)) || (allowedDomain && email.endsWith(`@${allowedDomain}`))) {
              isAdmin = true
            }
          }
        } catch (_) {}
      }
    }

    if (!isAdmin) {
      return json(headers, 401, { success: false, error: 'Unauthorized' })
    }

    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {}
      const action = qs.action || 'list'
      if (action === 'list') {
        const page = parseInt(qs.page || '1', 10)
        const perPage = Math.min(100, parseInt(qs.perPage || '20', 10))
        const from = (page - 1) * perPage
        const to = from + perPage - 1

        const { data: credits, error: creditsErr, count } = await supabase
          .from('user_credits')
          .select('*', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .range(from, to)

        if (creditsErr) throw creditsErr

        // Map user info (email) via auth admin
        const users = []
        for (const c of credits || []) {
          try {
            const { data: u } = await supabase.auth.admin.getUserById(c.user_id)
            users.push({ id: c.user_id, email: u?.user?.email || null })
          } catch (_) {
            users.push({ id: c.user_id, email: null })
          }
        }
        const emailById = users.reduce((acc, u) => { acc[u.id] = u.email; return acc }, {})

        const clients = (credits || []).map(c => ({
          user_id: c.user_id,
          email: emailById[c.user_id] || null,
          balance: c.balance || 0,
          bonus_balance: c.bonus_balance || 0,
          total_balance: (c.balance || 0) + (c.bonus_balance || 0),
          updated_at: c.updated_at || c.created_at,
        }))

        return json(headers, 200, { success: true, page, perPage, total: count || clients.length, clients })
      }

      if (action === 'get_user') {
        const userId = qs.userId
        if (!userId) return json(headers, 400, { success: false, error: 'userId required' })
        const { data: credit } = await supabase
          .from('user_credits')
          .select('*')
          .eq('user_id', userId)
          .single()
        let email = null
        try { const { data: u } = await supabase.auth.admin.getUserById(userId); email = u?.user?.email || null } catch {}
        return json(headers, 200, { success: true, user: { user_id: userId, email }, credit })
      }

      return json(headers, 400, { success: false, error: 'Invalid action' })
    }

    if (event.httpMethod === 'POST') {
      const { action, userId, delta, type, description, initialCredits = 5 } = JSON.parse(event.body || '{}')

      if (action === 'init') {
        if (!userId) return json(headers, 400, { success: false, error: 'userId required' })
        // Initialize credit account
        const { error } = await supabase
          .from('user_credits')
          .upsert({
            user_id: userId,
            balance: initialCredits,
            bonus_balance: 0,
            lifetime_earned: initialCredits,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })
        if (error) throw error
        await supabase.from('credit_transactions').insert({
          user_id: userId,
          type: 'bonus',
          amount: initialCredits,
          description: 'Initialisation (admin)'
        })
        return json(headers, 200, { success: true })
      }

      if (action === 'adjust') {
        if (!userId || typeof delta !== 'number') return json(headers, 400, { success: false, error: 'userId and delta required' })
        // Fetch current
        const { data: current } = await supabase
          .from('user_credits')
          .select('balance, bonus_balance')
          .eq('user_id', userId)
          .single()

        const curBalance = current?.balance || 0
        const curBonus = current?.bonus_balance || 0

        let newBalance = curBalance
        let newBonus = curBonus

        if (type === 'bonus') {
          newBonus = Math.max(0, curBonus + delta)
        } else {
          newBalance = Math.max(0, curBalance + delta)
        }

        await supabase
          .from('user_credits')
          .upsert({
            user_id: userId,
            balance: newBalance,
            bonus_balance: newBonus,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })

        await supabase
          .from('credit_transactions')
          .insert({
            user_id: userId,
            type: 'admin_adjust',
            amount: delta,
            description: description || `Ajustement admin (${type || 'standard'})`
          })

        return json(headers, 200, { success: true, balance: { balance: newBalance, bonus_balance: newBonus, total_balance: newBalance + newBonus } })
      }

      return json(headers, 400, { success: false, error: 'Invalid action' })
    }

    return json(headers, 405, { success: false, error: 'Method not allowed' })
  } catch (e) {
    console.error('admin-clients error:', e)
    return json(headers, 500, { success: false, error: 'Internal server error' })
  }
}
