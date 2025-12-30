import { API_URL } from '@/lib/api-config';

export interface CreditBalance {
  balance: number
  bonus_balance: number
  total_balance: number
  is_low_balance: boolean
  xaf_value: number
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  bonus_credits: number
  price_xaf: number
  is_active: boolean
  max_purchases_per_user?: number | null
}

// Fetch current balance (balance + bonus)
export async function fetchCreditBalance(userId: string) {
  const res = await fetch(`${API_URL}/api/credits/stats?type=balance&userId=${encodeURIComponent(userId)}`)
  const json = await res.json()
  if (!json?.success) throw new Error('Unable to fetch credit balance')
  return json.balance as CreditBalance
}

// Fetch available packages
export async function fetchCreditPackages(): Promise<CreditPackage[]> {
  const res = await fetch(`${API_URL}/api/credits/packages`)
  const json = await res.json()
  if (!json?.success) throw new Error('Unable to fetch packages')
  return (json.packages || []) as CreditPackage[]
}

// Purchase a package (requires server-side validation)
export async function purchaseCreditPackage(params: {
  userId: string
  packageId: string
  paymentMethod?: string
  paymentReference?: string
}) {
  const body = {
    action: 'purchase',
    userId: params.userId,
    packageId: params.packageId,
    paymentMethod: params.paymentMethod || 'demo',
    paymentReference: params.paymentReference || `MANUAL-${Date.now()}`,
  }
  const res = await fetch(`${API_URL}/api/credits/packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json?.success) throw new Error(json?.error || 'Purchase failed')
  return json as {
    success: true
    transaction_id: string
    credits_added: number
    new_balance: number
  }
}

// Check balance for a required amount
export async function checkCreditBalance(userId: string, requiredCredits: number) {
  const res = await fetch(`${API_URL}/api/credits/manage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'check_balance', userId, requiredCredits }),
  })
  const json = await res.json()
  if (json?.success === false && json?.hasCredits === false) {
    return { hasCredits: false, balance: json.balance || 0, required: json.required }
  }
  return { hasCredits: true, balance: json.balance ?? null }
}
