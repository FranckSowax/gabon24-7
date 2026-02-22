#!/bin/bash
# 📨 Voir les messages Telegram en attente

MESSAGES_FILE="/tmp/insight_messages.json"

if [ ! -f "$MESSAGES_FILE" ]; then
  echo "📭 Aucun message (fichier non trouvé)"
  exit 0
fi

COUNT=$(cat "$MESSAGES_FILE" | python3 -c "import sys,json; msgs=json.load(sys.stdin); unread=[m for m in msgs if not m.get('read')]; print(len(unread))" 2>/dev/null || echo "0")

echo "📨 Messages en attente: $COUNT"
echo ""

cat "$MESSAGES_FILE" | python3 -c "
import sys, json
msgs = json.load(sys.stdin)
if not msgs:
    print('📭 Aucun message')
else:
    for m in msgs[-10:]:
        status = '🔵' if not m.get('read') else '⚪'
        print(f\"{status} [{m['date'][:16]}] {m['from']}: {m['text']}\")
" 2>/dev/null || cat "$MESSAGES_FILE"
