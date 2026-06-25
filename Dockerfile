# Dockerfile RACINE — contexte de build = racine du repo.
# Railway ne lit la config-as-code qu'à la racine et n'honore plus rootDirectory
# pour le contexte Docker (régression observée après mars 2026). On copie donc
# explicitement le sous-dossier backend/. Le frontend est déployé séparément (Netlify).

FROM node:22-slim

# Dépendances système pour Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxss1 \
    libgtk-3-0 \
    libxshmfence1 \
    libglu1-mesa \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installer les dépendances backend (cache Docker tant que package*.json ne change pas)
COPY backend/package*.json ./
RUN npm install --production

# Copier le code backend dans /app (server.js, scripts/, routes/, services/…)
COPY backend/ ./

EXPOSE 3001

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

CMD ["node", "server.js"]
