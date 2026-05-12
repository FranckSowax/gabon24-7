FROM node:20-alpine

WORKDIR /app

# Install deps (cache layer)
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy source
COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
