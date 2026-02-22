# Scripts Admin & Monitoring - Gabon 24/7

## Installation

Les dépendances sont déjà dans le projet (`axios`, `@supabase/supabase-js`).

## Scripts

### 1. Créer un admin

```bash
export SUPABASE_SERVICE_KEY="votre_service_key"
node backend/scripts/create-admin.js
```

### 2. Obtenir un token JWT

```bash
export SUPABASE_ANON_KEY="votre_anon_key"
node backend/scripts/get-token.js admin@gabon247.com "password"
```

Le token est sauvegardé dans `.env.admin`.

### 3. Tester les endpoints admin

```bash
export GABON247_ADMIN_TOKEN="votre_token"
node backend/scripts/test-admin.js
```

Ou directement avec le token en argument :

```bash
node backend/scripts/test-admin.js "eyJhbGciOi..."
```

### 4. Monitoring

```bash
export SUPABASE_SERVICE_KEY="..."
export GABON247_ADMIN_TOKEN="..."
node backend/scripts/monitor.js
```

Variables optionnelles pour alertes Telegram :

```bash
export NOTIF_BOT_TOKEN="token_bot_telegram"
export NOTIF_CHAT_ID="chat_id"
```

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `SUPABASE_SERVICE_KEY` | create-admin, monitor | Clé service Supabase (rôle admin) |
| `SUPABASE_ANON_KEY` | get-token | Clé anon Supabase |
| `GABON247_ADMIN_TOKEN` | test-admin, monitor | Token JWT admin |
| `NOTIF_BOT_TOKEN` | monitor (optionnel) | Token bot Telegram |
| `NOTIF_CHAT_ID` | monitor (optionnel) | Chat ID Telegram |
