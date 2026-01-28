/**
 * BACKEND SÉCURISÉ - Trading Polymarket
 * La clé privée reste ICI (côté serveur), jamais exposée au frontend
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { ethers } = require('ethers')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Configuration Polygon
const POLYGON_RPC = 'https://polygon-rpc.com'
const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com'

// Contrats
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const CTF_EXCHANGE = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
]

// Initialiser le wallet (clé privée depuis variable d'environnement)
let wallet = null
let provider = null
let usdc = null
let apiCredentials = null

function initWallet() {
  const privateKey = process.env.PRIVATE_KEY
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY non définie dans les variables d\'environnement')
    return false
  }
  
  provider = new ethers.JsonRpcProvider(POLYGON_RPC)
  wallet = new ethers.Wallet(privateKey, provider)
  usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet)
  
  console.log(`🔐 Wallet connecté: ${wallet.address}`)
  return true
}

// Générer les headers d'auth pour Polymarket
async function getAuthHeaders() {
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `polymarket:${timestamp}`
  const signature = await wallet.signMessage(message)
  
  return {
    'POLY_ADDRESS': wallet.address,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp.toString(),
    'POLY_NONCE': '0'
  }
}

// Créer une API key pour le trading
async function createApiKey() {
  if (apiCredentials) return apiCredentials
  
  const headers = await getAuthHeaders()
  
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
  
  apiCredentials = await response.json()
  console.log('✅ API Key créée')
  return apiCredentials
}

// Headers pour les ordres
function getOrderHeaders() {
  if (!apiCredentials) throw new Error('API Key requise')
  
  return {
    'Content-Type': 'application/json',
    'POLY_ADDRESS': wallet.address,
    'POLY_API_KEY': apiCredentials.apiKey,
    'POLY_PASSPHRASE': apiCredentials.passphrase,
    'POLY_TIMESTAMP': Date.now().toString(),
  }
}

// ==================== ROUTES API ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    wallet: wallet ? wallet.address : null,
    hasApiKey: !!apiCredentials
  })
})

// Obtenir les infos du wallet (sans exposer la clé!)
app.get('/api/wallet', async (req, res) => {
  try {
    if (!wallet) {
      return res.status(500).json({ error: 'Wallet non initialisé' })
    }
    
    const [usdcBalance, maticBalance] = await Promise.all([
      usdc.balanceOf(wallet.address),
      provider.getBalance(wallet.address)
    ])
    
    res.json({
      address: wallet.address,
      usdcBalance: parseFloat(ethers.formatUnits(usdcBalance, 6)),
      maticBalance: parseFloat(ethers.formatEther(maticBalance)),
      hasGas: parseFloat(ethers.formatEther(maticBalance)) > 0.001
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Passer un ordre LIMIT
app.post('/api/order', async (req, res) => {
  try {
    if (!wallet) {
      return res.status(500).json({ error: 'Wallet non initialisé' })
    }
    
    const { tokenId, side, price, size } = req.body
    
    if (!tokenId || !side || !price || !size) {
      return res.status(400).json({ error: 'Paramètres manquants: tokenId, side, price, size' })
    }
    
    // S'assurer qu'on a une API key
    await createApiKey()
    
    const headers = getOrderHeaders()
    
    const order = {
      tokenID: tokenId,
      side: side.toUpperCase(),
      price: price.toString(),
      size: size.toString(),
      type: 'GTC',
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
    
    res.json(result)
  } catch (error) {
    console.error('❌ Erreur ordre:', error)
    res.status(500).json({ error: error.message })
  }
})

// Annuler un ordre
app.delete('/api/order/:orderId', async (req, res) => {
  try {
    if (!apiCredentials) {
      return res.status(500).json({ error: 'API Key non initialisée' })
    }
    
    const headers = getOrderHeaders()
    
    const response = await fetch(`${POLYMARKET_CLOB_URL}/order/${req.params.orderId}`, {
      method: 'DELETE',
      headers
    })
    
    if (!response.ok) throw new Error('Erreur annulation')
    
    res.json({ success: true, orderId: req.params.orderId })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Obtenir les ordres ouverts
app.get('/api/orders', async (req, res) => {
  try {
    if (!apiCredentials) {
      await createApiKey()
    }
    
    const headers = getOrderHeaders()
    
    const response = await fetch(`${POLYMARKET_CLOB_URL}/orders?open=true`, {
      headers
    })
    
    if (!response.ok) throw new Error('Erreur récupération ordres')
    
    const orders = await response.json()
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Approuver USDC pour le trading
app.post('/api/approve-usdc', async (req, res) => {
  try {
    if (!wallet) {
      return res.status(500).json({ error: 'Wallet non initialisé' })
    }
    
    const currentAllowance = await usdc.allowance(wallet.address, CTF_EXCHANGE)
    if (currentAllowance > 0) {
      return res.json({ success: true, message: 'USDC déjà approuvé' })
    }
    
    const tx = await usdc.approve(CTF_EXCHANGE, ethers.MaxUint256)
    await tx.wait()
    
    res.json({ success: true, txHash: tx.hash })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Démarrer le serveur
initWallet()

app.listen(PORT, () => {
  console.log(`🚀 Backend sécurisé démarré sur le port ${PORT}`)
  console.log(`📍 Wallet: ${wallet ? wallet.address : 'NON CONFIGURÉ'}`)
})
