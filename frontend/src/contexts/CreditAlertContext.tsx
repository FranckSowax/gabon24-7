'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import CreditAlertToast from '@/components/credits/CreditAlertToast'

interface CreditAlertData {
  balance: number
  required: number
}

interface CreditAlertContextType {
  showAlert: (data: CreditAlertData) => void
  hideAlert: () => void
}

const CreditAlertContext = createContext<CreditAlertContextType | undefined>(undefined)

export function CreditAlertProvider({ children }: { children: ReactNode }) {
  const [alertData, setAlertData] = useState<CreditAlertData | null>(null)
  const [show, setShow] = useState(false)

  const showAlert = (data: CreditAlertData) => {
    setAlertData(data)
    setShow(true)
  }

  const hideAlert = () => {
    setShow(false)
    setTimeout(() => setAlertData(null), 300)
  }

  return (
    <CreditAlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alertData && (
        <CreditAlertToast
          show={show}
          balance={alertData.balance}
          required={alertData.required}
          onClose={hideAlert}
        />
      )}
    </CreditAlertContext.Provider>
  )
}

export function useCreditAlert() {
  const context = useContext(CreditAlertContext)
  if (context === undefined) {
    throw new Error('useCreditAlert must be used within a CreditAlertProvider')
  }
  return context
}
