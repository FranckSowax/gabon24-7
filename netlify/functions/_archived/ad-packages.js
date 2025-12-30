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
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    try {
      const { data: packages, error } = await supabase
        .from('ad_packages')
        .select('*')
        .eq('is_active', true)
        .order('price_fcfa', { ascending: true });

      if (error) {
        console.error('Error fetching ad packages:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, packages })
      };
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Internal server error' })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, error: 'Method not allowed' })
  };
};
