/**
 * Singleton Prisma Client avec PostgreSQL Driver Adapter
 * Évite les multiples instances en développement (hot-reload)
 *
 * Prisma 7.x utilise le "client" engine par défaut,
 * qui nécessite un driver adapter (ici @prisma/adapter-pg).
 */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function createPrismaClient(logLevels) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: logLevels });
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient(['error', 'warn']);
} else {
  // En développement, réutiliser l'instance pour éviter les connexions multiples
  if (!global.__prisma) {
    global.__prisma = createPrismaClient(['query', 'error', 'warn']);
  }
  prisma = global.__prisma;
}

module.exports = { prisma };
