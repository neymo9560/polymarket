/**
 * POLYMARKET CLOB API - Trading en LIVE
 * Documentation: https://docs.polymarket.com/
 * 
 * Ce service permet de passer de vrais ordres sur Polymarket
 * sans passer par leur interface web (bypass géo-restriction)
 */

import { ethers } from 'ethers'

// Configuration Polygon
const POLYGON_RPC = 'https://polygon-rpc.com'
const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com'
const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com'

// Contrats Polymarket sur Polygon
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' // USDC.e sur Polygon
const POLYMARKET_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8ED6B49'
const CTF_EXCHANGE = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'

// ABI minimal pour USDC
const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
]

// Classe principale pour le trading live
export class PolymarketLive {
  constructor(privateKey) {
    if (!privateKey) {
      throw new Error('Clé privée requise pour le trading live')
    }
    
    this.provider = new ethers.JsonRpcProvider(POLYGON_RPC)
    this.wallet = new ethers.Wallet(privateKey, this.provider)
    this.address = this.wallet.address
    
    // Contrat USDC
    this.usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, this.wallet)
    
    console.log(`🔐 Wallet connecté: ${this.address}`)
  }
  
  // Obtenir l'adresse du wallet
  getAddress() {
    return this.address
  }
  
  // Obtenir le solde USDC
  async getUSDCBalance() {
    try {
      const balance = await this.usdc.balanceOf(this.address)
      return parseFloat(ethers.formatUnits(balance, 6)) // USDC a 6 décimales
    } catch (error) {
      console.error('Erreur balance USDC:', error)
      return 0
    }
  }
  
  // Obtenir le solde MATIC (pour les frais gas)
  async getMaticBalance() {
    try {
      const balance = await this.provider.getBalance(this.address)
      return parseFloat(ethers.formatEther(balance))
    } catch (error) {
      console.error('Erreur balance MATIC:', error)
      return 0
    }
  }
  
  // Générer les headers d'authentification pour l'API CLOB
  async getAuthHeaders() {
    const timestamp = Math.floor(Date.now() / 1000)
    const message = `polymarket:${timestamp}`
    const signature = await this.wallet.signMessage(message)
    
    return {
      'POLY_ADDRESS': this.address,
      'POLY_SIGNATURE': signature,
      'POLY_TIMESTAMP': timestamp.toString(),
      'POLY_NONCE': '0'
    }
  }
  
  // Créer une clé API pour le trading (nécessaire pour les ordres)
  async createApiKey() {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${POLYMARKET_CLOB_URL}/auth/api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      })
      
      if (!response.ok) {
        throw new Error(`Erreur création API key: ${response.status}`)
      }
      
      const data = await response.json()
      this.apiKey = data.apiKey
      this.apiSecret = data.secret
      this.apiPassphrase = data.passphrase
      
      console.log('✅ API Key créée pour le trading')
      return data
    } catch (error) {
      console.error('Erreur création API key:', error)
      throw error
    }
  }
  
  // Obtenir les headers avec API key pour les ordres
  getOrderHeaders() {
    if (!this.apiKey) {
      throw new Error('API Key requise - appeler createApiKey() d\'abord')
    }
    
    const timestamp = Date.now().toString()
    
    return {
      'Content-Type': 'application/json',
      'POLY_ADDRESS': this.address,
      'POLY_API_KEY': this.apiKey,
      'POLY_PASSPHRASE': this.apiPassphrase,
      'POLY_TIMESTAMP': timestamp,
    }
  }
  
  // Approuver USDC pour le trading (nécessaire une seule fois)
  async approveUSDC(amount = ethers.MaxUint256) {
    try {
      console.log('🔄 Approbation USDC pour Polymarket...')
      
      // Vérifier si déjà approuvé
      const currentAllowance = await this.usdc.allowance(this.address, CTF_EXCHANGE)
      if (currentAllowance > 0) {
        console.log('✅ USDC déjà approuvé')
        return true
      }
      
      const tx = await this.usdc.approve(CTF_EXCHANGE, amount)
      await tx.wait()
      
      console.log('✅ USDC approuvé pour le trading')
      return true
    } catch (error) {
      console.error('Erreur approbation USDC:', error)
      throw error
    }
  }
  
  // Obtenir les informations d'un marché
  async getMarketInfo(tokenId) {
    try {
      const response = await fetch(`${POLYMARKET_CLOB_URL}/markets/${tokenId}`)
      if (!response.ok) throw new Error('Marché non trouvé')
      return await response.json()
    } catch (error) {
      console.error('Erreur info marché:', error)
      return null
    }
  }
  
  // Obtenir l'orderbook d'un marché
  async getOrderbook(tokenId) {
    try {
      const response = await fetch(`${POLYMARKET_CLOB_URL}/book?token_id=${tokenId}`)
      if (!response.ok) throw new Error('Orderbook non disponible')
      return await response.json()
    } catch (error) {
      console.error('Erreur orderbook:', error)
      return null
    }
  }
  
  // PASSER UN ORDRE LIMIT (le coeur du trading)
  async placeLimitOrder(tokenId, side, price, size) {
    try {
      if (!this.apiKey) {
        await this.createApiKey()
      }
      
      const headers = this.getOrderHeaders()
      
      // Construire l'ordre
      const order = {
        tokenID: tokenId,
        side: side.toUpperCase(), // 'BUY' ou 'SELL'
        price: price.toString(),
        size: size.toString(),
        type: 'GTC', // Good Till Cancelled
      }
      
      console.log(`📤 Ordre: ${side} ${size} @ ${price}`)
      
      const response = await fetch(`${POLYMARKET_CLOB_URL}/order`, {
        method: 'POST',
        headers,
        body: JSON.stringify(order)
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Erreur ordre: ${error}`)
      }
      
      const result = await response.json()
      console.log(`✅ Ordre placé: ${result.orderID}`)
      return result
    } catch (error) {
      console.error('Erreur placement ordre:', error)
      throw error
    }
  }
  
  // Annuler un ordre
  async cancelOrder(orderId) {
    try {
      const headers = this.getOrderHeaders()
      
      const response = await fetch(`${POLYMARKET_CLOB_URL}/order/${orderId}`, {
        method: 'DELETE',
        headers
      })
      
      if (!response.ok) throw new Error('Erreur annulation')
      
      console.log(`❌ Ordre annulé: ${orderId}`)
      return true
    } catch (error) {
      console.error('Erreur annulation:', error)
      return false
    }
  }
  
  // Obtenir les positions ouvertes
  async getOpenPositions() {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${POLYMARKET_GAMMA_URL}/positions?user=${this.address}`, {
        headers
      })
      
      if (!response.ok) throw new Error('Erreur positions')
      return await response.json()
    } catch (error) {
      console.error('Erreur positions:', error)
      return []
    }
  }
  
  // Obtenir les ordres ouverts
  async getOpenOrders() {
    try {
      if (!this.apiKey) return []
      
      const headers = this.getOrderHeaders()
      
      const response = await fetch(`${POLYMARKET_CLOB_URL}/orders?open=true`, {
        headers
      })
      
      if (!response.ok) throw new Error('Erreur ordres')
      return await response.json()
    } catch (error) {
      console.error('Erreur ordres:', error)
      return []
    }
  }
  
  // Résumé du compte
  async getAccountSummary() {
    const [usdcBalance, maticBalance] = await Promise.all([
      this.getUSDCBalance(),
      this.getMaticBalance()
    ])
    
    return {
      address: this.address,
      usdcBalance,
      maticBalance,
      hasGas: maticBalance > 0.001
    }
  }
}

// Instance singleton
let liveInstance = null

export function initLiveTrading(privateKey) {
  if (!liveInstance) {
    liveInstance = new PolymarketLive(privateKey)
  }
  return liveInstance
}

export function getLiveInstance() {
  return liveInstance
}

export default PolymarketLive
