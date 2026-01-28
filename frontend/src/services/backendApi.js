/**
 * API pour communiquer avec le backend sécurisé
 * La clé privée est sur le serveur, pas ici!
 */

// Backend Fly.io (Frankfurt, Allemagne)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://polybot-backend-live-red-fog-601.fly.dev'

// Health check
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`)
    if (!response.ok) throw new Error('Backend non disponible')
    return await response.json()
  } catch (error) {
    console.error('Backend non disponible:', error)
    return null
  }
}

// Obtenir les infos du wallet (avec timeout)
export async function getWalletInfo() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
    
    const response = await fetch(`${BACKEND_URL}/api/wallet`, {
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    if (!response.ok) throw new Error('Erreur wallet')
    return await response.json()
  } catch (error) {
    console.error('Erreur récupération wallet:', error)
    return null
  }
}

// Passer un ordre LIMIT
export async function placeLimitOrder(tokenId, side, price, size) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenId, side, price, size })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erreur ordre')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur placement ordre:', error)
    throw error
  }
}

// Annuler un ordre
export async function cancelOrder(orderId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/order/${orderId}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) throw new Error('Erreur annulation')
    return await response.json()
  } catch (error) {
    console.error('Erreur annulation:', error)
    return false
  }
}

// Obtenir les ordres ouverts
export async function getOpenOrders() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/orders`)
    if (!response.ok) throw new Error('Erreur ordres')
    return await response.json()
  } catch (error) {
    console.error('Erreur récupération ordres:', error)
    return []
  }
}

// Approuver USDC pour le trading
export async function approveUSDC() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/approve-usdc`, {
      method: 'POST'
    })
    
    if (!response.ok) throw new Error('Erreur approbation')
    return await response.json()
  } catch (error) {
    console.error('Erreur approbation USDC:', error)
    throw error
  }
}
