# 🚀 Démarrage Rapide GPT-5 Nano

## ✅ Configuration en 3 étapes

### 1️⃣ Configurer le token Replicate dans Railway

1. Allez sur https://railway.app/dashboard
2. Sélectionnez votre projet **gabon24-7-production**
3. Cliquez sur le service **backend**
4. Onglet **Variables**
5. Ajoutez:
   ```
   REPLICATE_API_TOKEN = r8_VOTRE_TOKEN_ICI
   ```
   ⚠️ **Utilisez votre propre token Replicate** (commençant par `r8_`)
6. Railway redémarre automatiquement (~2 minutes)

### 2️⃣ Tester la génération

Une fois Railway redémarré:

```bash
# Générer un résumé de test
curl -X POST "https://gabon24-7-production.up.railway.app/api/audio/generate-test-summary" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}'
```

Réponse attendue:
```json
{
  "success": true,
  "message": "Résumé de test en cours de génération (fr)",
  "summaryId": "abc-123-...",
  "articlesCount": 20
}
```

### 3️⃣ Vérifier le résultat

Attendez 30 secondes, puis:

```bash
curl "https://gabon24-7-production.up.railway.app/api/audio/latest-public?language=fr"
```

Vous devriez voir:
```json
{
  "success": true,
  "summary": {
    "id": "...",
    "text_summary": "Bonjour à tous...",  ← Résumé GPT-5 Nano!
    "audio_url": "https://...",
    "status": "completed"
  }
}
```

## 🎵 Frontend - Lecteur Audio

Visitez: **https://gabon24-7.netlify.app/dashboard**

Vous verrez:
- 🎨 Bannière gradient moderne (indigo → purple → pink)
- 🔊 Lecteur audio avec Play/Pause
- 🌍 Switch langues: 🇫🇷 FR / 🇺🇸 EN / 🇨🇳 ZH
- 📊 Barre de progression interactive
- ⏱️ Métadonnées: date, nb articles, créneau

## 🤖 GPT-5 Nano en action

Le système génère maintenant des résumés avec:

### ✅ Qualité OpenAI
```
Bonjour à tous. Voici votre résumé d'actualités du Gabon.

Premièrement, sur le plan politique, le Parti Démocratique 
Gabonais prépare les élections législatives de deux mille 
vingt-cinq...

En second lieu, dans le secteur économique...
```

### ✅ Prononciation phonétique
- Chiffres en lettres: "vingt-trois" au lieu de "23"
- Pourcentages: "trente pour cent" au lieu de "30%"
- Acronymes épelés: "l'Organisation des Nations Unies"
- Transitions naturelles: "Premièrement", "Par ailleurs", "Enfin"

### ✅ Style journalistique
- Structure radio pro (accroche → intro → développement → conclusion)
- Phrases courtes (max 20 mots)
- Vocabulaire oral, pas écrit
- Ton professionnel gabonais

## 📊 Les 9 résumés quotidiens

Le scheduler génère automatiquement:

| Créneau | Heure | Langues |
|---------|-------|---------|
| 🌅 Matin | 7h00 | FR, EN, ZH |
| ☀️ Après-midi | 13h00 | FR, EN, ZH |
| 🌙 Soir | 20h00 | FR, EN, ZH |

**Total**: 9 résumés/jour

## 🧪 Générer manuellement les 9 résumés

```bash
cd backend
node generate-all-daily-audios.js
```

Cela génère:
1. ✅ 3 résumés du matin (FR, EN, ZH)
2. ⏸️ Pause 10 secondes
3. ✅ 3 résumés après-midi (FR, EN, ZH)
4. ⏸️ Pause 10 secondes
5. ✅ 3 résumés du soir (FR, EN, ZH)

Durée: **~5-10 minutes** (génération GPT-5 + audio Kokoro)

## 📈 Monitoring

### Logs Railway

```bash
# Voir les logs en temps réel
railway logs

# Chercher "GPT-5"
railway logs | grep "GPT-5"
```

Vous verrez:
```
🤖 Génération résumé GPT-5 Nano [fr]...
✅ Résumé GPT-5 Nano généré: 287 caractères
🔊 Génération audio Kokoro...
✅ Audio uploadé: https://...
```

### Statut résumés

```bash
# Via Supabase
SELECT id, language, time_slot, status, created_at 
FROM audio_summaries 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## 💡 Paramètres GPT-5 Nano

Configurés dans `services/gpt5-nano-analyzer.js`:

```javascript
{
  reasoning_effort: 'minimal',  // ⚡ Rapide + économique
  verbosity: 'medium',          // 📝 Sortie équilibrée
  max_tokens: 600,              // 📏 Résumés ~250-300 mots
  temperature: 0.7              // 🎨 Ton journalistique naturel
}
```

## 🆘 Dépannage

### Erreur "GPT-5 Nano generation timeout"
→ API Replicate surchargée, le fallback s'active automatiquement

### Résumé vide ou trop court
→ Augmenter `max_tokens` à 800 dans `gpt5-nano-analyzer.js`

### Audio mal prononcé
→ Améliorer les règles phonétiques dans les prompts

### "REPLICATE_API_TOKEN manquant"
→ Vérifier les variables Railway

## 📚 Documentation complète

- **GPT5_NANO_SETUP.md**: Configuration détaillée
- **AUDIO_SUMMARIES_README.md**: Architecture système complet
- **KOKORO_TTS_GUIDE.md**: Configuration TTS

---

**Status**: ✅ GPT-5 Nano configuré et prêt!  
**Déployé**: Railway (backend) + Netlify (frontend)  
**Prochaine génération auto**: Prochain créneau (7h/13h/20h)
