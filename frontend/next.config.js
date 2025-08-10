/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration pour export statique (Netlify)
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  
  images: {
    unoptimized: true, // Requis pour export statique
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
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WHATSAPP_CHANNEL: process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL || 'https://wa.me/24177123456',
  },
  // Note: headers() n'est pas compatible avec output: 'export'
  // Les headers de sécurité sont gérés via netlify.toml
};

module.exports = nextConfig;
