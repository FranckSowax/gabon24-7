const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod === 'GET') {
    try {
      // Get active campaigns with their slides
      const { data: campaigns, error } = await supabase
        .from('ad_campaigns')
        .select(`
          *,
          ad_packages (name, description, duration_days, max_slides, price_fcfa),
          promotional_slides (*)
        `)
        .eq('is_active', true)
        .eq('admin_approved', true)
        .eq('payment_status', 'paid')
        .gte('end_date', new Date().toISOString())

      if (error) {
        console.error('Error fetching campaigns:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, campaigns })
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
      const body = JSON.parse(event.body || '{}')
      const {
        company_name,
        contact_email,
        contact_phone,
        start_date,
        end_date,
        package_id,
        visual_creation_service,
        visual_service_price,
        total_price,
        message
      } = body

      if (!company_name || !contact_email || !start_date || !end_date || !package_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields'
          })
        }
      }

      // Insert new campaign request
      const { data: campaign, error } = await supabase
        .from('ad_campaigns')
        .insert({
          company_name,
          contact_email,
          contact_phone,
          start_date,
          end_date,
          package_id,
          total_amount: total_price,
          payment_status: 'pending',
          is_active: false,
          admin_approved: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating campaign:', error)
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        }
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, campaign })
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
