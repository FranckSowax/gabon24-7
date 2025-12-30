#!/bin/bash
# Script pour corriger automatiquement tous les scripts d'enrichissement

echo "🔧 Correction des scripts d'enrichissement..."

# Liste des fichiers à corriger
files=(
  "enrich-latest-unenriched.js"
  "enrich-latest.js"
  "enrich-existing-articles.js"
  "enrich-recent-articles.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Correction de $file..."
    
    # Remplacer ai_summary par summary_ai dans les SELECT
    sed -i '' "s/summary, ai_summary/summary, summary_ai/g" "$file"
    
    # Remplacer article.ai_summary par article.summary_ai
    sed -i '' "s/article\.ai_summary/article.summary_ai/g" "$file"
    
    echo "✅ $file corrigé"
  fi
done

echo "✅ Tous les scripts d'enrichissement ont été corrigés!"
