'use client'

import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-8 mt-auto">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/LOGO GABON INSIGHT ORANGE psd.png"
              alt="Gabon Insight"
              className="h-8 w-auto opacity-80"
            />
            <span className="text-sm">
              &copy; {new Date().getFullYear()} Gabon Insight. Tous droits r&eacute;serv&eacute;s.
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/politique-de-confidentialite"
              className="hover:text-white transition-colors"
            >
              Politique de confidentialit&eacute;
            </Link>
            <a
              href="mailto:contact@gaboninsight.com"
              className="hover:text-white transition-colors"
            >
              Contact
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}
