const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod === 'GET') {
    try {
      const { poll_id, user_fingerprint } = event.queryStringParameters || {}
      
      if (!poll_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'poll_id is required' })
        }
      }

      let query = supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', poll_id)

      if (user_fingerprint) {
        query = query.eq('user_fingerprint', user_fingerprint)
      }

      const { data: responses, error } = await query

      if (error) {
        console.error('Error fetching poll responses:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, responses })
      }
    } catch (error) {
      console.error('Error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Internal server error' })
      }
    }
  }

  if (event.httpMethod === 'POST') {
    try {
      const { poll_id, response_value, user_fingerprint } = JSON.parse(event.body || '{}')
      
      if (!poll_id || !response_value || !user_fingerprint) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            success: false, 
            error: 'poll_id, response_value, and user_fingerprint are required' 
          })
        }
      }

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', poll_id)
        .eq('user_fingerprint', user_fingerprint)
        .single()

      if (existingVote) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({ success: false, error: 'User has already voted for this poll' })
        }
      }

      // Insert new vote
      const { data: newResponse, error } = await supabase
        .from('poll_responses')
        .insert({
          poll_id,
          response_value,
          user_fingerprint
        })
        .select()
        .single()

      if (error) {
        console.error('Error inserting poll response:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        }
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, response: newResponse })
      }
    } catch (error) {
      console.error('Error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Internal server error' })
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, error: 'Method not allowed' })
  }
}
