const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message, duration = 86400, userId } = JSON.parse(event.body || '{}'); // 24h par défaut

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    // Créer le message urgent
    const { data, error } = await supabase
      .from('ticker_messages')
      .insert({
        original_title: message,
        reformulated_title: message,
        message_type: 'urgent',
        is_urgent: true,
        priority: 1000,
        source_name: '🚨 URGENT',
        display_end: new Date(Date.now() + duration * 1000).toISOString(),
        edited_by: userId
      })
      .select()
      .single();

    if (error) throw error;

    // Logger l'action
    await supabase
      .from('ticker_logs')
      .insert({
        message_id: data.id,
        event_type: 'created',
        user_id: userId,
        metadata: { type: 'urgent', duration }
      });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: data 
      })
    };

  } catch (error) {
    console.error('Error sending urgent message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send urgent message' })
    };
  }
};
