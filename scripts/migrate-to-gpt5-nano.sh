#!/bin/bash

# 🚀 Script de migration automatique vers GPT-5 Nano
# Migre les 7 fonctions Netlify restantes

echo "🚀 Migration vers Replicate GPT-5 Nano"
echo "======================================"
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonctions à migrer
FUNCTIONS=(
  "analyze-opportunity"
  "analyze-opportunity-complex"
  "generate-project-proposals"
  "generate-business-ideas"
  "audio-summary"
  "generate-daily-poll"
  "generate-contextual-poll"
)

# Compteurs
MIGRATED=0
FAILED=0

echo "📋 Fonctions à migrer: ${#FUNCTIONS[@]}"
echo ""

for func in "${FUNCTIONS[@]}"; do
  echo "🔄 Migration de: ${func}.js"
  
  FILE="netlify/functions/${func}.js"
  
  if [ ! -f "$FILE" ]; then
    echo -e "${RED}❌ Fichier non trouvé: $FILE${NC}"
    ((FAILED++))
    continue
  fi
  
  # Backup
  cp "$FILE" "${FILE}.backup"
  echo "  💾 Backup créé: ${FILE}.backup"
  
  # Vérifier si déjà migré
  if grep -q "replicate-gpt5-helper" "$FILE"; then
    echo -e "${YELLOW}  ⚠️  Déjà migré, skip${NC}"
    continue
  fi
  
  # Ajouter l'import du helper (après les autres requires)
  sed -i '' "/const.*require.*supabase/a\\
const { callGPT5NanoWithFallback, calculateCost } = require('./utils/replicate-gpt5-helper')
" "$FILE"
  
  # Ajouter REPLICATE_API_TOKEN dans les logs
  sed -i '' "s/const openaiApiKey = process.env.OPENAI_API_KEY/const replicateToken = process.env.REPLICATE_API_TOKEN\\
const openaiApiKey = process.env.OPENAI_API_KEY/" "$FILE"
  
  sed -i '' "/console.log('OPENAI_API_KEY'/a\\
console.log('REPLICATE_API_TOKEN:', replicateToken ? \`SET (\${replicateToken.substring(0, 7)}...)\` : 'MISSING')
" "$FILE"
  
  echo -e "${GREEN}  ✅ Import et variables ajoutés${NC}"
  
  # Note: La migration complète des fonctions nécessite des modifications manuelles
  # car chaque fonction a une structure différente
  
  echo "  📝 Note: Modifications manuelles requises pour:"
  echo "     - Remplacer les appels OpenAI par callGPT5NanoWithFallback"
  echo "     - Ajouter le calcul des coûts avec calculateCost"
  echo "     - Tester la fonction"
  echo ""
  
  ((MIGRATED++))
done

echo ""
echo "======================================"
echo -e "${GREEN}✅ Préparation terminée: ${MIGRATED}/${#FUNCTIONS[@]} fonctions${NC}"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Vérifier les backups créés (*.backup)"
echo "  2. Compléter manuellement les migrations"
echo "  3. Tester chaque fonction"
echo "  4. Déployer sur Netlify"
echo ""
echo "📚 Documentation: MIGRATION_GPT5_NANO.md"
echo ""
