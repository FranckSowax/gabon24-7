const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod === 'GET') {
    try {
      const { poll_id, question_id } = event.queryStringParameters || {}
      
      // Support both poll_id and question_id parameters
      const targetId = question_id || poll_id
      
      if (!targetId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ success: false, error: 'poll_id or question_id is required' })
        }
      }

      // If question_id is provided, get stats for that specific question
      if (question_id) {
        // Get question stats from poll_responses table
        const { data: votes, error: votesError } = await supabase
          .from('poll_responses')
          .select('response_value')
          .eq('question_id', question_id)

        if (votesError) {
          console.error('Error fetching question votes:', votesError)
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: votesError.message })
          }
        }

        // Calculate stats for the question
        const totalVotes = votes?.length || 0
        const voteCounts = {}
        
        votes?.forEach(vote => {
          voteCounts[vote.response_value] = (voteCounts[vote.response_value] || 0) + 1
        })

        const questionStats = Object.entries(voteCounts).map(([response_value, vote_count]) => ({
          question_id,
          response_value,
          vote_count,
          percentage: totalVotes > 0 ? (vote_count / totalVotes) * 100 : 0
        }))

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, stats: questionStats })
        }
      }

      // Get poll stats from the poll_stats view or calculate them
      const { data: stats, error } = await supabase
        .from('poll_stats')
        .select('*')
        .eq('poll_id', targetId)

      if (error) {
        console.error('Error fetching poll stats:', error)
        
        // Fallback: calculate stats manually
        const { data: responses, error: responsesError } = await supabase
          .from('poll_responses')
          .select('response_value')
          .eq('poll_id', targetId)

        if (responsesError) {
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: responsesError.message })
          }
        }

        // Calculate stats manually
        const totalVotes = responses?.length || 0
        const voteCounts = {}
        
        responses?.forEach(response => {
          voteCounts[response.response_value] = (voteCounts[response.response_value] || 0) + 1
        })

        const calculatedStats = Object.entries(voteCounts).map(([response_value, vote_count]) => ({
          poll_id: targetId,
          response_value,
          vote_count,
          percentage: totalVotes > 0 ? (vote_count / totalVotes) * 100 : 0
        }))

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, stats: calculatedStats })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, stats })
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
