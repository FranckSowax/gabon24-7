const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { messageId, updates, userId } = JSON.parse(event.body || '{}');

    if (!messageId || !updates) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Mettre à jour le message
    const { data, error } = await supabase
      .from('ticker_messages')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        edited_by: userId
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;

    // Logger l'action
    await supabase
      .from('ticker_logs')
      .insert({
        message_id: messageId,
        event_type: 'edited',
        user_id: userId,
        metadata: { updates }
      });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: data 
      })
    };

  } catch (error) {
    console.error('Error updating ticker message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Update failed' })
    };
  }
};
