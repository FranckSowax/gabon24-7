/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Réactivé pour déploiement Netlify
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  outputFileTracingRoot: process.cwd(), // Specify root directory to silence lockfile warning
  
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
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://gabon24-7.netlify.app/.netlify/functions',
    NEXT_PUBLIC_WHATSAPP_CHANNEL: process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL || 'https://wa.me/24177123456',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ykytsadwfqoyusleoflf.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlreXRzYWR3ZnFveXVzbGVvZmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3ODg5MjYsImV4cCI6MjA3MDM2NDkyNn0.MLTnZFSSosMt3Lu7BeFR8LFW4ihaUo5Dx2g9sUJeHLA',
  },
};

module.exports = nextConfig;
