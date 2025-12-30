// Fonction programmée pour traitement des résumés IA
const aiProcessorFunction = require('./ai-summary-processor');

exports.handler = async (event, context) => {
  console.log('🤖 Traitement programmé résumés IA démarré');
  
  // Simuler un événement POST
  const simulatedEvent = {
    httpMethod: 'POST'
  };
  
  try {
    const result = await aiProcessorFunction.handler(simulatedEvent, context);
    const parsedResult = JSON.parse(result.body);
    
    // Log seulement si des articles ont été traités
    if (parsedResult.processed > 0) {
      console.log('✅ Traitement IA terminé:', parsedResult);
    } else {
      console.log('📭 Aucun résumé IA en attente');
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erreur traitement IA:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
