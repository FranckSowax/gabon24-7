const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod === 'GET') {
    try {
      const { data: campaigns, error } = await supabase
        .from('ad_campaigns')
        .select(`
          *,
          ad_packages (
            name,
            price_fcfa,
            duration_days
          ),
          promotional_slides (
            id,
            title,
            description,
            image_url,
            view_count,
            click_count,
            is_active,
            cta_text,
            display_order
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching campaigns:', error)
        throw error
      }

      // Transform data for frontend compatibility
      const transformedCampaigns = campaigns?.map(campaign => ({
        ...campaign,
        ad_packages: {
          name: campaign.ad_packages?.name || 'Unknown',
          price: campaign.ad_packages?.price_fcfa || 0,
          duration_days: campaign.ad_packages?.duration_days || 0
        }
      })) || []

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          campaigns: transformedCampaigns
        })
      }
    } catch (error) {
      console.error('Error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  }

  if (event.httpMethod === 'PUT') {
    try {
      const pathParts = event.path.split('/')
      const campaignId = pathParts[pathParts.length - 2] // Get campaign ID from path
      const action = pathParts[pathParts.length - 1] // Get action (approve/status)
      
      const body = JSON.parse(event.body || '{}')

      if (action === 'approve') {
        const { approved } = body
        
        const { error } = await supabase
          .from('ad_campaigns')
          .update({ admin_approved: approved })
          .eq('id', campaignId)

        if (error) {
          throw error
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Campaign ${approved ? 'approved' : 'rejected'}`
          })
        }
      }

      if (action === 'status') {
        const { is_active } = body
        
        const { error } = await supabase
          .from('ad_campaigns')
          .update({ is_active })
          .eq('id', campaignId)

        if (error) {
          throw error
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            message: `Campaign ${is_active ? 'activated' : 'deactivated'}`
          })
        }
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Invalid action'
        })
      }
    } catch (error) {
      console.error('Error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Internal server error'
        })
      }
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, error: 'Method not allowed' })
  }
}
