// ============================================================
// API TRADING POLYMARKET - MODE LIVE
// Passe de vrais ordres sur l'orderbook CLOB
// ============================================================

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

// Créer un ordre LIMIT sur Polymarket
export async function createOrder({
  tokenId,
  side, // 'BUY' ou 'SELL'
  price,
  size,
  orderType = 'GTC' // Good Till Cancelled
}) {
  try {
    const response = await fetch(`${API_URL}/api/order/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_id: tokenId,
        side,
        price: price.toString(),
        size: size.toString(),
        order_type: orderType,
      })
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erreur création ordre: ${error}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur création ordre:', error)
    throw error
  }
}

// Annuler un ordre
export async function cancelOrder(orderId) {
  try {
    const response = await fetch(`${API_URL}/api/order/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId })
    })
    
    if (!response.ok) {
      throw new Error('Erreur annulation ordre')
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur annulation ordre:', error)
    throw error
  }
}

// Récupérer les ordres ouverts
export async function getOpenOrders() {
  try {
    const response = await fetch(`${API_URL}/api/orders/open`)
    
    if (!response.ok) {
      return []
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur récupération ordres:', error)
    return []
  }
}

// Récupérer les trades exécutés
export async function getTrades() {
  try {
    const response = await fetch(`${API_URL}/api/trades`)
    
    if (!response.ok) {
      return []
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur récupération trades:', error)
    return []
  }
}

// Récupérer le solde du wallet
export async function getBalance() {
  try {
    const response = await fetch(`${API_URL}/api/balance`)
    
    if (!response.ok) {
      return { usdc: 0, positions: [] }
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur récupération balance:', error)
    return { usdc: 0, positions: [] }
  }
}

// ============================================================
// FONCTION PRINCIPALE: Exécuter un trade en mode LIVE
// ============================================================
export async function executeLiveTrade({
  market,
  side, // 'YES' ou 'NO'
  action, // 'BUY' ou 'SELL'
  price,
  size,
  isLive = false
}) {
  // En mode paper, on ne fait rien (le trade est simulé côté frontend)
  if (!isLive) {
    console.log('📄 Mode PAPER - Trade simulé')
    return { success: true, mode: 'paper' }
  }
  
  // En mode LIVE, on passe un vrai ordre
  console.log('💰 Mode LIVE - Passage ordre réel')
  
  // Récupérer le token ID correspondant au side
  const tokenId = side === 'YES' 
    ? market.clobTokenIds?.[0] 
    : market.clobTokenIds?.[1]
  
  if (!tokenId) {
    throw new Error('Token ID non trouvé pour ce marché')
  }
  
  // Créer l'ordre
  const order = await createOrder({
    tokenId,
    side: action,
    price,
    size,
  })
  
  console.log('✅ Ordre créé:', order)
  return { success: true, mode: 'live', order }
}

export default {
  createOrder,
  cancelOrder,
  getOpenOrders,
  getTrades,
  getBalance,
  executeLiveTrade,
}
