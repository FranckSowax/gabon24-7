import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Simplifier le middleware pour éviter les problèmes Edge Runtime
  // La vérification d'authentification sera gérée côté client
  
  const res = NextResponse.next();
  
  // Ajouter des headers de sécurité
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
  runtime: 'nodejs',
};
