# ♊ MIGRATION GEMINI 3 - GUIDE DE CONFIGURATION

Nous avons migré l'intelligence artificielle du backend de **Replicate** vers **Google Gemini 3 Pro** pour plus de performance, de rapidité et de fonctionnalités multimodales.

## 🚀 Avantages Gemini 3
- **Raisonnement avancé (Reasoning):** Meilleure compréhension du contexte gabonais
- **Multimodal:** Génération de texte et d'images avec une seule clé API
- **Vitesse:** Plus rapide que les modèles open-source hébergés
- **Coût:** Modèle "Preview" performant

## ✅ Ce qui a été migré
1. **Génération d'articles sponsorisés** (Texte + Images*)
   - *Images : Gemini 3 en priorité, fallback automatique sur Replicate (Nano Banana) en cas d'erreur.*
2. **Analyse d'opportunités business** (SWOT, Idées)
3. **Génération de formations** (Sommaires, Modules, Leçons + Images*)
   - *Images : Gemini 3 en priorité, fallback Replicate.*
4. **Rédaction de courriers professionnels**
5. **Résumés d'actualités**
6. **Génération de Business Plans & Plans d'Action** (Documents de projet)
7. **Tests de compétences entrepreneuriales** (QCM personnalisés)
8. **Cadre de projet** (Project Framework)

## ⚠️ Ce qui reste sur Replicate
- **Synthèse Vocale (TTS):** Toujours sur Replicate (Kokoro).
- **Fallback Images:** Si Gemini Image échoue (ou quota atteint), Nano Banana prend le relais.

## 🛠️ Configuration Requise

### 1. Obtenir une clé Gemini
1. Allez sur [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Créez une clé API
3. Copiez la clé

### 2. Mettre à jour les variables d'environnement

**Sur Railway (et .env local):**
```bash
GEMINI_API_KEY=votre_cle_gemini_ici
REPLICATE_API_TOKEN=votre_token_replicate_ici  # Requis pour TTS et Fallback Images
```

### 3. Redémarrer le serveur
Le nouveau service `gemini-service.js` sera automatiquement pris en compte.

---

## 🔍 Vérification
Les tests ont été validés le 2 Décembre 2025.
- `📝 Génération Texte` : OK (Gemini 3 Reasoning)
- `🏗️ Génération JSON` : OK
- `🎨 Génération Image` : OK (Gemini 3 Image)

Les logs du serveur afficheront désormais :
- `📝 Génération ... avec Gemini 3...`
- `✅ Article généré avec succès (Gemini 3)`
