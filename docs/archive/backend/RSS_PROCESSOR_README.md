# 📡 Processeur RSS - Gabon24/7

## 🎯 Problème résolu

Les articles ne s'enregistraient plus en base de données car **le processeur RSS ne s'exécutait pas automatiquement**.

## ✅ Solution implémentée

Création de 3 scripts pour gérer le processeur RSS :

### 1. **Exécution unique** (`rss:once`)
Traite tous les flux RSS une seule fois puis s'arrête.

```bash
cd backend
npm run rss:once
```

**Utilisation** :
- ✅ Test manuel du processeur
- ✅ Récupération ponctuelle d'articles
- ✅ Debugging

---

### 2. **Mode daemon** (`rss:daemon`)
Lance le processeur en continu avec refresh toutes les 60 minutes.

```bash
cd backend
npm run rss:daemon
```

**Utilisation** :
- ✅ Mode production (serveur dédié)
- ✅ Récupération automatique continue
- ✅ Appuyez sur `Ctrl+C` pour arrêter

---

### 3. **Vérification status** (`rss:status`)
Diagnostic complet de l'état du système RSS.

```bash
cd backend
npm run rss:status
```

**Affiche** :
- ✅ Derniers articles créés
- ✅ État des flux RSS (actif/erreur)
- ✅ Nombre d'articles des dernières 24h
- ✅ Flux avec erreurs
- ✅ Recommandations

---

## 📊 État actuel

### Flux RSS configurés
```
✅ 48 flux ACTIFS
❌ 2 flux en ERREUR
📊 Total: 50 flux
```

### Dernière synchronisation
```
⏰ Dernier article: il y a 22h (12 Oct 2025 23:00)
📰 Articles créés (24h): 14
```

---

## 🚀 Configuration production

### Option 1: PM2 (Recommandé)

```bash
# Installer PM2
npm install -g pm2

# Démarrer le daemon RSS
pm2 start start-rss-daemon.js --name "rss-processor"

# Voir les logs
pm2 logs rss-processor

# Redémarrer
pm2 restart rss-processor

# Arrêter
pm2 stop rss-processor

# Auto-start au démarrage serveur
pm2 startup
pm2 save
```

### Option 2: Cron Job

Ajouter dans crontab pour exécuter toutes les heures :

```bash
# Éditer crontab
crontab -e

# Ajouter cette ligne (modifier les chemins)
0 * * * * cd /path/to/gabon24-7/backend && node run-rss-once.js >> /var/log/rss-processor.log 2>&1
```

### Option 3: Systemd (Linux)

Créer `/etc/systemd/system/rss-processor.service` :

```ini
[Unit]
Description=Gabon24/7 RSS Processor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/gabon24-7/backend
ExecStart=/usr/bin/node start-rss-daemon.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Puis :
```bash
sudo systemctl enable rss-processor
sudo systemctl start rss-processor
sudo systemctl status rss-processor
```

---

## 🔧 Scripts de diagnostic

### `check-rss-status.js`
Diagnostic complet du système RSS

### `check-feeds.js`
Liste tous les flux RSS configurés

### `check-inactive-feeds.js`
Vérifie les flux inactifs

### `check-table-structure.js`
Affiche la structure de la table `rss_feeds`

### `test-articles-sync.js`
Test de synchronisation articles

---

## 📈 Monitoring

### Vérifier si le processeur tourne

```bash
# Avec PM2
pm2 status

# Manuellement
ps aux | grep "rss"
```

### Logs en temps réel

```bash
# Avec PM2
pm2 logs rss-processor --lines 100

# Manuellement
tail -f /var/log/rss-processor.log
```

---

## 🛠️ Dépannage

### Problème: Aucun article créé

1. Vérifier les flux actifs :
```bash
npm run rss:status
```

2. Lancer manuellement :
```bash
npm run rss:once
```

3. Vérifier les erreurs dans les logs

### Problème: Flux en erreur

1. Identifier les flux :
```bash
node check-inactive-feeds.js
```

2. Tester manuellement l'URL du flux

3. Réactiver si nécessaire dans Supabase

---

## 📝 Notes importantes

- ⏰ **Fréquence**: 60 minutes (optimisé pour économie OpenAI)
- 📦 **Batch**: TOUS les articles du jour (pas de limite)
- 🔄 **Auto-retry**: En cas d'erreur, réessaye au prochain cycle
- 💾 **Dédoublonnage**: Par URL normalisée
- 🖼️ **Images**: Web scraping si absentes du flux RSS
- 🤖 **IA**: Enrichissement avec OpenAI (résumé, catégorie, sentiment)

---

## 🎯 Commit

```
d4f4b9b - Fix: Health check articles
[PROCHAIN] - Feature: Scripts RSS daemon + diagnostic
```
