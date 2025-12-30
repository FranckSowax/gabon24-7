#!/bin/bash

# 🧪 Script de test du backend Railway
# Usage: ./test-railway-backend.sh

echo "🔍 Test du backend Railway Gabon24-7"
echo "======================================"
echo ""

BACKEND_URL="https://gabon24-7-production.up.railway.app"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Santé du serveur
echo "📡 Test 1: Santé du serveur (GET /)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Serveur accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Serveur inaccessible (HTTP $HTTP_CODE)${NC}"
    echo -e "${YELLOW}⚠️  Le serveur Railway n'est pas démarré ou a crashé${NC}"
fi
echo ""

# Test 2: Articles trending
echo "📰 Test 2: Articles trending (GET /api/articles/trending)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/articles/trending")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Endpoint accessible (HTTP $HTTP_CODE)${NC}"
    curl -s "$BACKEND_URL/api/articles/trending" | jq -r '.articles[0].title // "Aucun article"' 2>/dev/null || echo "Articles trouvés"
else
    echo -e "${RED}❌ Endpoint inaccessible (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 3: Articles de la semaine
echo "📅 Test 3: Articles de la semaine (GET /api/articles/week)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/articles/week")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Endpoint accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Endpoint inaccessible (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 4: Audio summaries
echo "🎧 Test 4: Audio summaries (GET /api/audio/latest-public)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/audio/latest-public?language=fr")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Endpoint accessible (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ Endpoint inaccessible (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 5: CORS headers
echo "🌐 Test 5: CORS headers (OPTIONS /api/articles/trending)"
CORS_HEADER=$(curl -s -H "Origin: https://gabon24-7.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -X OPTIONS \
     -I "$BACKEND_URL/api/articles/trending" | grep -i "access-control-allow-origin")

if [ -n "$CORS_HEADER" ]; then
    echo -e "${GREEN}✅ CORS configuré correctement${NC}"
    echo "   $CORS_HEADER"
else
    echo -e "${RED}❌ CORS non configuré ou serveur inaccessible${NC}"
fi
echo ""

# Test 6: Vérifier Railway fallback
echo "🔍 Test 6: Vérifier Railway fallback"
FALLBACK=$(curl -s -I "$BACKEND_URL/" | grep -i "x-railway-fallback")
if [ -n "$FALLBACK" ]; then
    echo -e "${RED}❌ Railway fallback actif - Le serveur backend n'est pas démarré${NC}"
    echo "   $FALLBACK"
else
    echo -e "${GREEN}✅ Pas de fallback - Le serveur répond normalement${NC}"
fi
echo ""

# Résumé
echo "======================================"
echo "📊 Résumé"
echo "======================================"
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Backend opérationnel${NC}"
    echo ""
    echo "Prochaines étapes:"
    echo "  1. Vérifier que le frontend Netlify charge les articles"
    echo "  2. Tester les fonctionnalités audio"
else
    echo -e "${RED}❌ Backend non opérationnel${NC}"
    echo ""
    echo "Actions requises:"
    echo "  1. Consulter les logs Railway: https://railway.app/dashboard"
    echo "  2. Vérifier les variables d'environnement (voir DIAGNOSTIC_RAILWAY_CORS.md)"
    echo "  3. Configurer SUPABASE_SERVICE_ROLE_KEY"
    echo "  4. Redémarrer le déploiement"
fi
echo ""
