// Fonction programmée pour synchronisation RSS Bundle
const bundleFastSyncFunction = require('./rss-bundle-fast');

exports.handler = async (event, context) => {
  console.log('📅 Synchronisation RSS Bundle programmée démarrée');
  
  // Simuler un événement POST
  const simulatedEvent = {
    httpMethod: 'POST'
  };
  
  try {
    const result = await bundleFastSyncFunction.handler(simulatedEvent, context);
    const parsedResult = JSON.parse(result.body);
    
    console.log('✅ Synchronisation RSS Bundle terminée:', parsedResult);
    return result;
  } catch (error) {
    console.error('❌ Erreur synchronisation RSS Bundle:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
