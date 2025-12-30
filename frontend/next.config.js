/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build: 2025-10-13 23:11 - Force rebuild after RSS sync fixes (articles structure migration)
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  // Transpiler les modules Three.js pour compatibilité production
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/rapier', 'meshline'],
  
  experimental: {
    outputFileTracingRoot: process.cwd(), // Specify root directory to silence lockfile warning
  },
  
  images: {
    unoptimized: true,
    domains: [
      'localhost',
      'gabonnews.com',
      'libreville.com',
      'gabonmediatime.com',
      'union.sonapresse.com'
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Rewrites removed - incompatible with output: 'export'
  // Netlify functions will be accessed directly via /.netlify/functions/
  
  // ⚠️ Variables d'environnement injectées au build-time
  // Les valeurs de .env.production ou Netlify Dashboard sont utilisées
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;
