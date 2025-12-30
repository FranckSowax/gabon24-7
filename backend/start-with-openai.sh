#!/bin/bash

# GabonNews Backend avec OpenAI API
# Configurez votre clé API OpenAI dans les variables d'environnement
# export OPENAI_API_KEY="your-openai-api-key-here"

echo "🔑 Vérification de la configuration OpenAI..."
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Variable OPENAI_API_KEY non définie"
    echo "💡 Définissez-la avec: export OPENAI_API_KEY='votre-clé-api'"
else
    echo "✅ Clé API OpenAI configurée"
fi

echo "🚀 Démarrage du serveur GabonNews avec IA..."

node working-server.js
