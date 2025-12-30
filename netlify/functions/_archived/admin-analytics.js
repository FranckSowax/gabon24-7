const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod === 'GET') {
    try {
      // Get campaign analytics
      const { data: campaigns, error: campaignsError } = await supabase
        .from('ad_campaigns')
        .select('id, is_active, admin_approved, payment_status')

      if (campaignsError) {
        console.error('Error fetching campaigns:', campaignsError)
        throw campaignsError
      }

      // Get slide analytics
      const { data: slides, error: slidesError } = await supabase
        .from('promotional_slides')
        .select('id, is_active, admin_approved, view_count, click_count')

      if (slidesError) {
        console.error('Error fetching slides:', slidesError)
        throw slidesError
      }

      // Calculate analytics
      const campaignStats = {
        total: campaigns?.length || 0,
        approved: campaigns?.filter(c => c.admin_approved).length || 0,
        active: campaigns?.filter(c => c.is_active).length || 0,
        paid: campaigns?.filter(c => c.payment_status === 'paid').length || 0
      }

      const totalViews = slides?.reduce((sum, slide) => sum + (slide.view_count || 0), 0) || 0
      const totalClicks = slides?.reduce((sum, slide) => sum + (slide.click_count || 0), 0) || 0
      const ctr = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : '0.00'

      const slideStats = {
        total: slides?.length || 0,
        active: slides?.filter(s => s.is_active && s.admin_approved).length || 0,
        totalViews,
        totalClicks,
        ctr
      }

      const analytics = {
        campaigns: campaignStats,
        slides: slideStats
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          analytics
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
