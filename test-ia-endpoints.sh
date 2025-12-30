#!/bin/bash

# Script de test des endpoints IA
# Usage: chmod +x test-ia-endpoints.sh && ./test-ia-endpoints.sh

API_URL="https://gabon24-7-production.up.railway.app"

echo "🧪 Test des Endpoints IA Gabon24-7"
echo "=================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo "1️⃣  Test Health Check..."
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
HEALTH_STATUS=$(echo $HEALTH_RESPONSE | grep -o '"status":"OK"' | wc -l)
VERSION=$(echo $HEALTH_RESPONSE | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
FEATURES=$(echo $HEALTH_RESPONSE | grep -o '"features":\[[^]]*\]')

if [ $HEALTH_STATUS -eq 1 ]; then
    echo -e "${GREEN}✅ Health OK${NC}"
    echo -e "   Version: ${YELLOW}$VERSION${NC}"
    echo -e "   Features: $FEATURES"
else
    echo -e "${RED}❌ Health FAIL${NC}"
    echo "   Response: $HEALTH_RESPONSE"
fi
echo ""

# Test 2: Endpoint génération article
echo "2️⃣  Test Endpoint Génération Article..."
ARTICLE_RESPONSE=$(curl -s -X POST "$API_URL/api/generate-sponsored-article" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Corp",
    "product_service": "Service Test",
    "key_message": "Message de test",
    "category": "business"
  }')

ARTICLE_STATUS=$(echo $ARTICLE_RESPONSE | grep -o '"success":true' | wc -l)

if [ $ARTICLE_STATUS -eq 1 ]; then
    echo -e "${GREEN}✅ Endpoint Article OK${NC}"
    TITLE=$(echo $ARTICLE_RESPONSE | grep -o '"title":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo -e "   Titre généré: ${YELLOW}${TITLE:0:60}...${NC}"
else
    echo -e "${RED}❌ Endpoint Article FAIL${NC}"
    ERROR=$(echo $ARTICLE_RESPONSE | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$ERROR" ]; then
        echo -e "   Erreur: ${RED}$ERROR${NC}"
    else
        echo "   Response: ${ARTICLE_RESPONSE:0:200}..."
    fi
fi
echo ""

# Test 3: Endpoint génération image
echo "3️⃣  Test Endpoint Génération Image..."
IMAGE_RESPONSE=$(curl -s -X POST "$API_URL/api/generate-article-image" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article Image Gabon",
    "category": "tech",
    "company_name": "Test Corp"
  }')

IMAGE_STATUS=$(echo $IMAGE_RESPONSE | grep -o '"success":true' | wc -l)

if [ $IMAGE_STATUS -eq 1 ]; then
    echo -e "${GREEN}✅ Endpoint Image OK${NC}"
    IMAGE_URL=$(echo $IMAGE_RESPONSE | grep -o '"image_url":"[^"]*"' | cut -d'"' -f4)
    echo -e "   Image URL: ${YELLOW}${IMAGE_URL:0:60}...${NC}"
else
    echo -e "${RED}❌ Endpoint Image FAIL${NC}"
    ERROR=$(echo $IMAGE_RESPONSE | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$ERROR" ]; then
        echo -e "   Erreur: ${RED}$ERROR${NC}"
    else
        echo "   Response: ${IMAGE_RESPONSE:0:200}..."
    fi
fi
echo ""

# Résumé
echo "=================================="
echo "📊 Résumé des Tests"
echo "=================================="

TOTAL_TESTS=3
PASSED_TESTS=$(($HEALTH_STATUS + $ARTICLE_STATUS + $IMAGE_STATUS))

echo ""
echo -e "Tests réussis: ${GREEN}$PASSED_TESTS${NC}/$TOTAL_TESTS"
echo ""

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}🎉 Tous les tests sont passés!${NC}"
    echo ""
    echo "✅ Railway est à jour avec les endpoints IA"
    echo "✅ Version déployée: $VERSION"
    echo "✅ Prêt pour utilisation en production"
    exit 0
else
    echo -e "${YELLOW}⚠️  Certains tests ont échoué${NC}"
    echo ""
    echo "Suggestions:"
    echo "1. Attendre 2-3 minutes (Railway en cours de déploiement)"
    echo "2. Vérifier REPLICATE_API_TOKEN dans Railway"
    echo "3. Consulter logs Railway: railway logs --tail"
    echo "4. Relancer ce script dans quelques minutes"
    exit 1
fi
