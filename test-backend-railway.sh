#!/bin/bash

echo "🔍 Test Backend Railway..."
echo "URL: https://gabon24-7-production.up.railway.app"
echo ""

echo "1️⃣ Test Health Check:"
curl -s https://gabon24-7-production.up.railway.app/health | jq . 2>/dev/null || curl -s https://gabon24-7-production.up.railway.app/health
echo ""
echo ""

echo "2️⃣ Test Articles API:"
curl -s https://gabon24-7-production.up.railway.app/api/articles?limit=2 | jq . 2>/dev/null || curl -s https://gabon24-7-production.up.railway.app/api/articles?limit=2
echo ""
echo ""

echo "3️⃣ Test CORS Headers:"
curl -I -s https://gabon24-7-production.up.railway.app/health | grep -i "access-control"
echo ""

echo "✅ Tests terminés !"
