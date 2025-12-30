# 🤖 Configuration GPT-5 Nano (OpenAI via Replicate) pour Résumés Audio

## ✅ Modèle configuré: OpenAI GPT-5 Nano

Le système utilise **OpenAI GPT-5 Nano** via Replicate:
- 🔗 URL: https://replicate.com/openai/gpt-5-nano
- ⚡ **Lightweight et rapide**, idéal pour génération de résumés
- 🌍 **Support multilingue** (FR, EN, ZH)
- 💰 **Coût optimisé** avec reasoning_effort='minimal'

## 🎯 Avantages de GPT-5 Nano

### vs GPT-5 complet:
- ⚡ **Plus rapide** (minimal reasoning)
- 💰 **Moins cher** (tâches simples)
- 🎯 **Parfait pour résumés** (250-300 mots)

### vs Llama/Mistral:
- 🧠 **Meilleure qualité** OpenAI
- 🌍 **Multilingue natif**
- 📝 **Instructions suivies précisément**

## ⚙️ Paramètres GPT-5 Nano configurés

### Reasoning Effort: `minimal`
- ⚡ Le plus rapide
- ✅ Parfait pour instructions claires (génération de résumés)
- 💰 Coût réduit

### Verbosity: `medium`
- 📝 Sortie équilibrée (ni trop court, ni trop long)
- 🎯 Parfait pour résumés audio (250-300 mots)

### Max Tokens: `600`
- 📏 Suffisant pour un résumé audio complet
- ⏱️ Durée audio: ~2-3 minutes

### Temperature: `0.7`
- 🎨 Équilibre créativité/cohérence
- 📰 Ton journalistique naturel

## 🔧 Configuration complète

### 1. Obtenir l'API Token Replicate

```bash
# Créer compte sur replicate.com
# Dashboard → Account → API Tokens
# Copier le token r8_...
```

### 2. Configurer Railway (Production)

```bash
# Variables d'environnement Railway:
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

### 3. Configuration locale

```bash
# backend/.env
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxx
```

## 🎯 Tester le système

### Test des résumés avec NanoGPT-5

```bash
cd backend
node -e "
const { generateJournalisticSummary } = require('./services/nanogpt5-analyzer');
const articles = [{
  title: 'Test article',
  summary: 'Résumé de test',
  source: 'Test Source',
  category: 'Politique'
}];
generateJournalisticSummary(articles, 'fr').then(result => {
  console.log('Résumé généré:', result);
});
"
```

### Test complet avec audio

```bash
cd backend
node generate-all-daily-audios.js
```

## 📊 Structure des prompts phonétiques

Les prompts dans `nanogpt5-analyzer.js` sont optimisés pour:

### ✅ Prononciation TTS optimale
- Phrases courtes (max 20 mots)
- Chiffres en toutes lettres: "vingt-trois" au lieu de "23"
- Pourcentages: "trente pour cent" au lieu de "30%"
- Acronymes épelés: "Organisation des Nations Unies" au lieu de "ONU"
- Transitions naturelles: "Premièrement", "En second lieu", etc.

### ✅ Style journalistique radio
- **Accroche**: 1 phrase percutante
- **Introduction**: 2-3 phrases contextuelles
- **Développement**: 3-4 points principaux avec transitions
- **Conclusion**: Résumé et note positive

### ✅ Adaptation multilingue
- **Français**: Ton professionnel gabonais, vocabulaire simple
- **English**: Professional broadcast style, clear American pronunciation
- **中文**: 广播风格，简洁清晰，自然过渡

## 🔄 Fallback automatique

Si l'API Replicate est indisponible ou le token manquant, le système utilise automatiquement `generateBasicSummary()` qui crée un résumé simple mais fonctionnel.

## 🎨 Personnalisation des prompts

Pour modifier le style des résumés, éditez les prompts dans `nanogpt5-analyzer.js`:

```javascript
const prompts = {
  fr: `Votre prompt personnalisé en français...`,
  en: `Your custom English prompt...`,
  zh: `您的自定义中文提示...`
}
```

## 🚀 Résultat attendu

Après configuration correcte:

1. ✅ Railway redémarre avec la nouvelle version
2. ✅ Les résumés sont générés avec NanoGPT-5
3. ✅ Le texte est optimisé pour la prononciation
4. ✅ L'audio Kokoro TTS prononce parfaitement
5. ✅ Le dashboard affiche le lecteur audio moderne

## 📱 Vérification frontend

Une fois déployé, visitez:
```
https://gabon24-7.netlify.app/dashboard
```

Vous devriez voir:
- 🎵 Bannière audio gradient en haut
- 🔊 Lecteur avec contrôles Play/Pause
- 🌍 Switch FR/EN/ZH
- 📊 Barre de progression
- ⏱️ Métadonnées (date, nb articles)

## 🐛 Dépannage

### Erreur "model version not found"
→ Vérifiez et corrigez la `version` dans `nanogpt5-analyzer.js`

### Résumés en anglais alors que FR demandé
→ Vérifiez le paramètre `language` dans les prompts

### Audio mal prononcé
→ Améliorez les règles phonétiques dans le prompt
→ Ajoutez plus de mots de liaison
→ Simplifiez les phrases complexes

---

**Dernière mise à jour**: 16 octobre 2025  
**Status**: Migration OpenAI → NanoGPT-5 complète
