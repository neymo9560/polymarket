/**
 * BACKEND SÉCURISÉ - Trading Polymarket avec SDK officiel
 */
const express = require('express')
const cors = require('cors')
const ethers = require('ethers')
const { ClobClient } = require('@polymarket/clob-client')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Config
const POLYGON_RPC = 'https://polygon-bor-rpc.publicnode.com'
const CLOB_HOST = 'https://clob.polymarket.com'
const CHAIN_ID = 137
const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
const CTF_EXCHANGE = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045'

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
]

let wallet = null
let provider = null
let usdc = null
let clobClient = null

async function initWallet() {
  try {
    const privateKey = process.env.PRIVATE_KEY
    console.log('PRIVATE_KEY presente:', !!privateKey)
    
    if (!privateKey) {
      console.log('PRIVATE_KEY non definie')
      return false
    }
    
    provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC)
    wallet = new ethers.Wallet(privateKey, provider)
    usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet)
    
    console.log('Wallet:', wallet.address)
    
    // Initialiser le client CLOB temporaire pour obtenir les credentials
    let tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, wallet)
    
    // Créer/dériver les credentials API - OBLIGATOIRE pour les ordres
    try {
      console.log('Creation des API credentials...')
      const creds = await tempClient.createOrDeriveApiKey()
      console.log('Credentials recues:', JSON.stringify(creds).substring(0, 100))
      
      if (creds && creds.key) {
        // Réinitialiser le client avec les credentials
        clobClient = new ClobClient(CLOB_HOST, CHAIN_ID, wallet, creds)
        console.log('API credentials configurees avec succes:', creds.key)
      } else {
        console.error('Credentials invalides')
        clobClient = null
      }
    } catch (err) {
      console.error('Erreur credentials:', err.message)
      clobClient = null
    }
    
    return clobClient !== null
  } catch (error) {
    console.log('Erreur wallet:', error.message)
    return false
  }
}

// === ROUTES ===

// Proxy pour les marchés Polymarket (évite CORS)
app.get('/api/markets', async (req, res) => {
  try {
    const { closed, limit } = req.query
    const url = `https://gamma-api.polymarket.com/markets?closed=${closed || 'false'}&limit=${limit || 100}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Gamma API error: ${response.status}`)
    const data = await response.json()
    res.json(data)
  } catch (error) {
    console.log('Erreur proxy markets:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', wallet: wallet ? wallet.address : null, hasClobClient: !!clobClient })
})

app.get('/', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/wallet', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: 'Wallet non initialise' })
    
    // Appels séparés pour éviter erreur batch
    const usdcBalance = await usdc.balanceOf(wallet.address)
    const maticBalance = await provider.getBalance(wallet.address)
    
    res.json({
      address: wallet.address,
      usdcBalance: parseFloat(ethers.utils.formatUnits(usdcBalance, 6)),
      maticBalance: parseFloat(ethers.utils.formatEther(maticBalance)),
      hasGas: parseFloat(ethers.utils.formatEther(maticBalance)) > 0.001
    })
  } catch (error) {
    console.log('Erreur wallet:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Proxy orderbook
app.get('/api/orderbook', async (req, res) => {
  try {
    const { token_id } = req.query
    if (!token_id || token_id === '[') {
      return res.status(400).json({ error: 'token_id invalide' })
    }
    const url = `https://clob.polymarket.com/book?token_id=${token_id}`
    const response = await fetch(url)
    if (!response.ok) return res.status(404).json({ error: 'Orderbook non disponible' })
    res.json(await response.json())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/order', async (req, res) => {
  try {
    if (!clobClient) {
      console.log('CLOB client non initialise')
      return res.status(500).json({ error: 'CLOB client non initialise - verifier PRIVATE_KEY' })
    }
    
    const { tokenId, side, price, size } = req.body
    console.log('Ordre recu:', { tokenId, side, price, size })
    
    if (!tokenId || !side || !price || !size) {
      return res.status(400).json({ error: 'Parametres manquants: tokenId, side, price, size' })
    }
    
    // Validation tokenId
    if (typeof tokenId !== 'string' || tokenId.length < 10) {
      return res.status(400).json({ error: 'tokenId invalide' })
    }
    
    console.log('Ordre LIMIT via SDK:', side, size, 'tokens @', price, 'token:', tokenId.substring(0, 20))
    
    // Utiliser le SDK officiel pour créer un ordre LIMIT
    const order = await clobClient.createOrder({
      tokenID: tokenId,
      side: side.toUpperCase(),
      price: parseFloat(price),
      size: parseFloat(size)
    })
    
    console.log('Ordre LIMIT cree:', order)
    
    // Poster l'ordre
    const result = await clobClient.postOrder(order)
    console.log('Ordre LIMIT poste:', result)
    
    // Retourner l'ID pour suivi
    res.json({ 
      ...result, 
      orderId: result.orderID || result.id,
      status: 'PENDING'
    })
  } catch (error) {
    console.error('Erreur ordre complete:', error)
    res.status(500).json({ error: error.message || 'Erreur inconnue' })
  }
})

app.delete('/api/order/:orderId', async (req, res) => {
  try {
    if (!clobClient) return res.status(500).json({ error: 'CLOB client non initialise' })
    const result = await clobClient.cancelOrder(req.params.orderId)
    res.json({ success: true, orderId: req.params.orderId, result })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/orders', async (req, res) => {
  try {
    if (!clobClient) return res.status(500).json({ error: 'CLOB client non initialise' })
    const orders = await clobClient.getOpenOrders()
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/approve-usdc', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: 'Wallet non initialise' })
    const currentAllowance = await usdc.allowance(wallet.address, CTF_EXCHANGE)
    if (currentAllowance > 0) return res.json({ success: true, message: 'USDC deja approuve' })
    const tx = await usdc.approve(CTF_EXCHANGE, ethers.constants.MaxUint256)
    await tx.wait()
    res.json({ success: true, txHash: tx.hash })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Demarrer
app.listen(PORT, async () => {
  console.log(`Backend demarre sur port ${PORT}`)
  await initWallet()
  console.log('Wallet:', wallet ? wallet.address : 'NON CONFIGURE')
  console.log('CLOB Client:', clobClient ? 'OK' : 'NON CONFIGURE')
})
