const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  const pathParts = event.path.split('/')
  const slideId = pathParts[pathParts.length - 1]

  if (event.httpMethod === 'PUT') {
    try {
      const slideData = JSON.parse(event.body || '{}')
      
      const { error } = await supabase
        .from('promotional_slides')
        .update({
          title: slideData.title,
          description: slideData.description,
          image_url: slideData.image_url,
          is_active: slideData.is_active,
          cta_text: slideData.cta_text,
          display_order: slideData.display_order
        })
        .eq('id', slideId)

      if (error) {
        throw error
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Slide updated successfully'
        })
      }
    } catch (error) {
      console.error('Error updating slide:', error)
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

  if (event.httpMethod === 'DELETE') {
    try {
      const { error } = await supabase
        .from('promotional_slides')
        .delete()
        .eq('id', slideId)

      if (error) {
        throw error
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Slide deleted successfully'
        })
      }
    } catch (error) {
      console.error('Error deleting slide:', error)
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
