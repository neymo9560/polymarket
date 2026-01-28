/**
 * BACKEND SÉCURISÉ - Trading Polymarket
 */
const express = require('express')
const cors = require('cors')
const { ethers } = require('ethers')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Config Polygon - utiliser Alchemy ou autre RPC fiable
const POLYGON_RPC = 'https://polygon-mainnet.g.alchemy.com/v2/demo'
const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com'
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
let apiCredentials = null

function initWallet() {
  try {
    const privateKey = process.env.PRIVATE_KEY
    console.log('PRIVATE_KEY presente:', !!privateKey)
    
    if (!privateKey) {
      console.log('PRIVATE_KEY non definie')
      return false
    }
    
    provider = new ethers.JsonRpcProvider(POLYGON_RPC)
    wallet = new ethers.Wallet(privateKey, provider)
    usdc = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet)
    
    console.log('Wallet:', wallet.address)
    return true
  } catch (error) {
    console.log('Erreur wallet:', error.message)
    return false
  }
}

// Auth headers pour Polymarket
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

// Creer API key
async function createApiKey() {
  if (apiCredentials) return apiCredentials
  const headers = await getAuthHeaders()
  const response = await fetch(`${POLYMARKET_CLOB_URL}/auth/api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers }
  })
  if (!response.ok) throw new Error(`Erreur API key: ${response.status}`)
  apiCredentials = await response.json()
  console.log('API Key creee')
  return apiCredentials
}

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

// === ROUTES ===

app.get('/health', (req, res) => {
  res.json({ status: 'ok', wallet: wallet ? wallet.address : null, hasApiKey: !!apiCredentials })
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
      usdcBalance: parseFloat(ethers.formatUnits(usdcBalance, 6)),
      maticBalance: parseFloat(ethers.formatEther(maticBalance)),
      hasGas: parseFloat(ethers.formatEther(maticBalance)) > 0.001
    })
  } catch (error) {
    console.log('Erreur wallet:', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/order', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: 'Wallet non initialise' })
    const { tokenId, side, price, size } = req.body
    if (!tokenId || !side || !price || !size) {
      return res.status(400).json({ error: 'Parametres manquants' })
    }
    await createApiKey()
    const headers = getOrderHeaders()
    const order = { tokenID: tokenId, side: side.toUpperCase(), price: price.toString(), size: size.toString(), type: 'GTC' }
    console.log('Ordre:', side, size, '@', price)
    const response = await fetch(`${POLYMARKET_CLOB_URL}/order`, {
      method: 'POST', headers, body: JSON.stringify(order)
    })
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erreur ordre: ${error}`)
    }
    const result = await response.json()
    console.log('Ordre place:', result.orderID)
    res.json(result)
  } catch (error) {
    console.error('Erreur ordre:', error)
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/order/:orderId', async (req, res) => {
  try {
    if (!apiCredentials) return res.status(500).json({ error: 'API Key non initialisee' })
    const headers = getOrderHeaders()
    const response = await fetch(`${POLYMARKET_CLOB_URL}/order/${req.params.orderId}`, { method: 'DELETE', headers })
    if (!response.ok) throw new Error('Erreur annulation')
    res.json({ success: true, orderId: req.params.orderId })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/orders', async (req, res) => {
  try {
    if (!apiCredentials) await createApiKey()
    const headers = getOrderHeaders()
    const response = await fetch(`${POLYMARKET_CLOB_URL}/orders?open=true`, { headers })
    if (!response.ok) throw new Error('Erreur ordres')
    res.json(await response.json())
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/approve-usdc', async (req, res) => {
  try {
    if (!wallet) return res.status(500).json({ error: 'Wallet non initialise' })
    const currentAllowance = await usdc.allowance(wallet.address, CTF_EXCHANGE)
    if (currentAllowance > 0) return res.json({ success: true, message: 'USDC deja approuve' })
    const tx = await usdc.approve(CTF_EXCHANGE, ethers.MaxUint256)
    await tx.wait()
    res.json({ success: true, txHash: tx.hash })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Demarrer
initWallet()
app.listen(PORT, () => {
  console.log(`Backend demarre sur port ${PORT}`)
  console.log('Wallet:', wallet ? wallet.address : 'NON CONFIGURE')
})
