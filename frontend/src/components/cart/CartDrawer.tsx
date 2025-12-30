'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, ShoppingCart, Trash2, Calendar, Clock, CreditCard } from 'lucide-react'
import { 
  getCart, 
  removeFromCart, 
  clearCart, 
  getCartTotal, 
  getCampaignTypeInfo,
  formatPrice,
  type CartItem 
} from '@/lib/cart'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (isOpen) {
      loadCart()
    }
  }, [isOpen])

  useEffect(() => {
    // Écouter les mises à jour du panier
    const handleCartUpdate = () => loadCart()
    window.addEventListener('cart-updated', handleCartUpdate)
    return () => window.removeEventListener('cart-updated', handleCartUpdate)
  }, [])

  const loadCart = () => {
    const cartItems = getCart()
    setCart(cartItems)
    setTotal(getCartTotal())
  }

  const handleRemove = (itemId: string) => {
    removeFromCart(itemId)
    loadCart()
  }

  const handleClearCart = () => {
    if (confirm('Voulez-vous vraiment vider le panier ?')) {
      clearCart()
      loadCart()
    }
  }

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Votre panier est vide')
      return
    }
    onClose()
    router.push('/checkout')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6" />
              <div>
                <h2 className="text-xl font-bold">Mon Panier</h2>
                <p className="text-sm text-orange-100">
                  {cart.length} campagne{cart.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-600 font-semibold mb-2">Votre panier est vide</p>
              <p className="text-sm text-gray-500">
                Ajoutez des campagnes publicitaires pour commencer
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => {
                const typeInfo = getCampaignTypeInfo(item.campaign_type)
                return (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow"
                  >
                    {/* Type et nom */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{typeInfo.icon}</span>
                          <span className="text-xs font-semibold text-gray-500">
                            {typeInfo.name}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900">{item.name}</h3>
                      </div>
                      <button
                        onClick={() => handleRemove(item.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                        title="Retirer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Détails */}
                    <div className="space-y-2 text-sm mb-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Début: {formatDate(item.start_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>Durée: {item.duration_days} jour{item.duration_days > 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Prix */}
                    <div className="pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Prix:</span>
                        <span className="text-lg font-bold text-orange-600">
                          {formatPrice(item.budget)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Bouton vider panier */}
              {cart.length > 1 && (
                <button
                  onClick={handleClearCart}
                  className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Vider le panier
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer avec total et checkout */}
        {cart.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Sous-total:</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(total)}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Les campagnes seront validées après paiement
              </p>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Procéder au paiement
            </button>
          </div>
        )}
      </div>
    </>
  )
}
