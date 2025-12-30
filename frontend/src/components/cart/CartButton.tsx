'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart } from 'lucide-react'
import { getCartCount } from '@/lib/cart'
import CartDrawer from './CartDrawer'

export default function CartButton() {
  const [cartCount, setCartCount] = useState(0)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    // Charger le count initial
    updateCartCount()

    // Écouter les mises à jour du panier
    const handleCartUpdate = () => {
      updateCartCount()
      // Animation quand item ajouté
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), 300)
    }

    window.addEventListener('cart-updated', handleCartUpdate)
    return () => window.removeEventListener('cart-updated', handleCartUpdate)
  }, [])

  const updateCartCount = () => {
    setCartCount(getCartCount())
  }

  return (
    <>
      {/* Bouton panier flottant */}
      <button
        onClick={() => setIsDrawerOpen(true)}
        className={`fixed bottom-6 right-6 z-30 bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-full shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 ${
          isAnimating ? 'animate-bounce' : ''
        }`}
        aria-label="Panier"
      >
        <ShoppingCart className="w-6 h-6" />
        
        {/* Badge count */}
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white animate-pulse">
            {cartCount > 9 ? '9+' : cartCount}
          </span>
        )}
      </button>

      {/* Drawer */}
      <CartDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
      />
    </>
  )
}
