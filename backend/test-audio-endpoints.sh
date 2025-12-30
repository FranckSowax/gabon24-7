#!/bin/bash

API_URL="https://gabon24-7-production.up.railway.app"

echo "🧪 Test des endpoints /api/audio..."
echo ""

# Test 1: GET /api/audio/latest-public
echo "1️⃣  Test GET /api/audio/latest-public?language=fr"
curl -s "$API_URL/api/audio/latest-public?language=fr" | jq '.' || echo "❌ Erreur"
echo ""
echo "---"
echo ""

# Test 2: GET /api/audio/public  
echo "2️⃣  Test GET /api/audio/public?language=fr&limit=3"
curl -s "$API_URL/api/audio/public?language=fr&limit=3" | jq '.' || echo "❌ Erreur"
echo ""
echo "---"
echo ""

# Test 3: POST /api/audio/generate-test-summary
echo "3️⃣  Test POST /api/audio/generate-test-summary"
curl -s -X POST "$API_URL/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}' | jq '.' || echo "❌ Erreur"
echo ""
echo "---"
echo ""

echo "✅ Tests terminés"
