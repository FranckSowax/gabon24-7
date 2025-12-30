#!/bin/bash

echo "🧪 TEST API PROJECT NOTES"
echo "=========================="
echo ""

API_URL="http://localhost:3001"
TEST_PROJECT_ID="test-project-123"
TEST_USER_ID="test-user-456"

echo "1️⃣ Test GET /api/project-notes/:projectId"
echo "-------------------------------------------"
curl -s "${API_URL}/api/project-notes/${TEST_PROJECT_ID}" | jq '.'
echo ""
echo ""

echo "2️⃣ Test POST /api/project-notes (Ajouter une note)"
echo "---------------------------------------------------"
curl -s -X POST "${API_URL}/api/project-notes" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"${TEST_PROJECT_ID}\",
    \"userId\": \"${TEST_USER_ID}\",
    \"noteContent\": \"Ceci est une note de test créée le $(date)\"
  }" | jq '.'
echo ""
echo ""

echo "3️⃣ Test GET après ajout"
echo "------------------------"
NOTES=$(curl -s "${API_URL}/api/project-notes/${TEST_PROJECT_ID}")
echo "$NOTES" | jq '.'
NOTE_ID=$(echo "$NOTES" | jq -r '.notes[0].id // empty')
echo ""
echo "Note ID récupérée: $NOTE_ID"
echo ""

if [ -n "$NOTE_ID" ]; then
  echo "4️⃣ Test PUT /api/project-notes/:noteId (Modifier)"
  echo "--------------------------------------------------"
  curl -s -X PUT "${API_URL}/api/project-notes/${NOTE_ID}" \
    -H "Content-Type: application/json" \
    -d "{
      \"userId\": \"${TEST_USER_ID}\",
      \"noteContent\": \"Note modifiée à $(date)\"
    }" | jq '.'
  echo ""
  echo ""

  echo "5️⃣ Test DELETE /api/project-notes/:noteId (Supprimer)"
  echo "------------------------------------------------------"
  curl -s -X DELETE "${API_URL}/api/project-notes/${NOTE_ID}?userId=${TEST_USER_ID}" | jq '.'
  echo ""
  echo ""
  
  echo "6️⃣ Vérification finale (devrait être vide)"
  echo "-------------------------------------------"
  curl -s "${API_URL}/api/project-notes/${TEST_PROJECT_ID}" | jq '.'
else
  echo "❌ Impossible de récupérer l'ID de la note (table probablement inexistante)"
fi

echo ""
echo "✅ Tests terminés!"
