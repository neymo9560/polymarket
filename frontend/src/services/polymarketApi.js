// Polymarket API via Backend Proxy (CORS bypass)
// Stratégies inspirées des TOP TRADERS Polymarket 2024-2026
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Cache pour historique des prix (pour momentum/mean reversion)
const priceHistory = new Map()
const HISTORY_LENGTH = 20

// Récupérer les marchés actifs depuis Polymarket via proxy
export async function fetchMarkets(limit = 50) {
  try {
    const response = await fetch(
      `${API_URL}/api/markets?closed=false&limit=${limit}`
    )
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // Transformer les données pour notre format
    return data.map(market => {
      const id = market.conditionId || market.id
      
      // Parser les prix - Format Polymarket: "[\"0.45\",\"0.55\"]" (string JSON)
      let yesPrice = 0.5
      let noPrice = 0.5
      
      try {
        if (market.outcomePrices) {
          let prices = market.outcomePrices
          // Si c'est un string, parser le JSON
          if (typeof prices === 'string') {
            prices = JSON.parse(prices)
          }
          // Maintenant c'est un array ["0.45", "0.55"]
          if (Array.isArray(prices) && prices.length >= 2) {
            const p0 = parseFloat(prices[0])
            const p1 = parseFloat(prices[1])
            if (!isNaN(p0) && p0 >= 0 && p0 <= 1) yesPrice = p0
            if (!isNaN(p1) && p1 >= 0 && p1 <= 1) noPrice = p1
          }
        }
        
        // Fallback sur bestBid/bestAsk si disponibles
        if (yesPrice === 0.5 && market.bestBid !== undefined) {
          const bid = parseFloat(market.bestBid)
          if (!isNaN(bid) && bid > 0 && bid < 1) {
            yesPrice = bid
            noPrice = 1 - bid
          }
        }
      } catch (e) {
        console.warn('Error parsing prices for market:', market.id, e)
      }
      
      // Validation finale - éviter 0 ou 1 exact
      if (yesPrice <= 0.001) yesPrice = 0.01
      if (yesPrice >= 0.999) yesPrice = 0.99
      if (noPrice <= 0.001) noPrice = 0.01
      if (noPrice >= 0.999) noPrice = 0.99
      
      // Sauvegarder l'historique des prix
      if (!priceHistory.has(id)) {
        priceHistory.set(id, [])
      }
      const history = priceHistory.get(id)
      history.push({ yesPrice, noPrice, timestamp: Date.now() })
      if (history.length > HISTORY_LENGTH) history.shift()
      
      // Parser le volume de manière robuste
      const parseVolume = (v) => {
        if (!v) return 0
        const parsed = parseFloat(v)
        return isNaN(parsed) ? 0 : parsed
      }
      
      // Récupérer le bon slug pour le lien (events[0].slug si disponible)
      const eventSlug = market.events?.[0]?.slug || market.slug || market.market_slug
      
      return {
        id,
        slug: eventSlug,
        question: market.question || market.title || 'Unknown Market',
        description: market.description || '',
        category: market.events?.[0]?.title || market.category || market.groupItemTitle || 'Other',
        
        // Prix YES/NO (déjà validés)
        yesPrice,
        noPrice,
        spread: Math.abs(1 - yesPrice - noPrice),
        
        // Volume et liquidité
        volume: parseVolume(market.volume),
        volume24h: parseVolume(market.volume24hr) || parseVolume(market.volume),
        liquidity: parseVolume(market.liquidity),
        
        // Tokens CLOB
        clobTokenIds: market.clobTokenIds || [],
        
        // Timestamps
        endDate: market.endDate,
        createdAt: market.createdAt,
        
        // Status
        active: market.active !== false,
        closed: market.closed === true,
        
        // Image
        image: market.image,
        
        // Historique pour analyse
        priceHistory: history,
      }
    })
  } catch (error) {
    console.error('Erreur fetch marchés Polymarket:', error)
    throw error
  }
}

// Récupérer un marché spécifique avec son orderbook
export async function fetchMarketDetails(conditionId) {
  try {
    const response = await fetch(`${API_URL}/api/markets/${conditionId}`)
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Erreur fetch détails marché:', error)
    throw error
  }
}

// Récupérer l'orderbook CLOB pour un token (via proxy)
export async function fetchOrderbook(tokenId) {
  try {
    const response = await fetch(`${API_URL}/api/orderbook?token_id=${tokenId}`)
    
    if (!response.ok) {
      console.warn('Orderbook non disponible')
      return { bids: [], asks: [] }
    }
    
    const data = await response.json()
    return {
      bids: data.bids || [],
      asks: data.asks || [],
      // Calculer le meilleur bid/ask
      bestBid: data.bids?.[0]?.price || null,
      bestAsk: data.asks?.[0]?.price || null,
      spread: data.asks?.[0]?.price && data.bids?.[0]?.price 
        ? parseFloat(data.asks[0].price) - parseFloat(data.bids[0].price)
        : null
    }
  } catch (error) {
    console.warn('Orderbook non disponible:', error)
    return { bids: [], asks: [] }
  }
}

// Récupérer le prix mid-market pour un token
export async function fetchMidpoint(tokenId) {
  try {
    const response = await fetch(`${API_URL}/api/midpoint?token_id=${tokenId}`)
    
    if (!response.ok) {
      console.warn('Midpoint non disponible')
      return null
    }
    
    const data = await response.json()
    return data.mid || data.price || null
  } catch (error) {
    console.warn('Midpoint non disponible:', error)
    return null
  }
}

// Récupérer le prix d'achat pour un token
export async function fetchPrice(tokenId) {
  try {
    const response = await fetch(`${API_URL}/api/price?token_id=${tokenId}`)
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    return data.price || null
  } catch (error) {
    return null
  }
}

// Récupérer tous les spreads des marchés actifs
export async function fetchSpreads() {
  try {
    const response = await fetch(`${API_URL}/api/spreads`)
    
    if (!response.ok) {
      return {}
    }
    
    return await response.json()
  } catch (error) {
    return {}
  }
}

// ============================================================
// STRATÉGIES TOP TRADERS POLYMARKET 2024-2026
// Basées sur l'analyse des portefeuilles des plus gros gagnants
// ============================================================

// Kelly Criterion pour position sizing optimal
function kellyFraction(winProb, winAmount, lossAmount) {
  if (lossAmount === 0) return 0.1
  const q = 1 - winProb
  const b = winAmount / lossAmount
  const kelly = (winProb * b - q) / b
  return Math.max(0, Math.min(kelly * 0.5, 0.25)) // Half-Kelly, max 25%
}

// Calcul du momentum sur l'historique des prix
function calculateMomentum(history) {
  if (!history || history.length < 3) return 0
  const recent = history.slice(-3)
  const older = history.slice(-6, -3)
  if (older.length === 0) return 0
  
  const recentAvg = recent.reduce((a, b) => a + b.yesPrice, 0) / recent.length
  const olderAvg = older.reduce((a, b) => a + b.yesPrice, 0) / older.length
  
  return recentAvg - olderAvg
}

// Calcul de la volatilité
function calculateVolatility(history) {
  if (!history || history.length < 5) return 0
  const prices = history.map(h => h.yesPrice)
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length
  return Math.sqrt(variance)
}

// STRATÉGIE A: ARBITRAGE + FAVORITE COMPOUNDER (comme Theo, Fredi, Gabagool)
// Source: https://www.datawallet.com/crypto/top-polymarket-trading-strategies
export function detectArbitrageOpportunities(markets) {
  const opportunities = []
  
  for (const market of markets) {
    const { yesPrice, noPrice, spread, volume24h, liquidity } = market
    const sum = yesPrice + noPrice
    
    // 1. Binary Complement Arbitrage: YES + NO < 100%
    if (sum < 0.995 && sum > 0.8) {
      const profit = (1 - sum) * 100
      opportunities.push({
        type: 'ARB_BINARY',
        market,
        signal: `🎯 Arb: YES+NO=${(sum*100).toFixed(1)}% | +${profit.toFixed(1)}%`,
        expectedProfit: profit,
        action: 'BUY_BOTH',
        confidence: 0.95, // Arbitrage = quasi certain
        positionSize: 0.05, // Plus gros car sûr
      })
    }
    
    // 2. FAVORITE COMPOUNDER - LA VRAIE STRATÉGIE DES MILLIONNAIRES
    // Acheter NO quand YES < 5% (quasi certain de gagner)
    // Rendement faible mais TRÈS safe = compound over time
    if (yesPrice <= 0.05 && yesPrice > 0.001 && volume24h > 10000) {
      const yield_pct = (1 - noPrice) / noPrice * 100 // Rendement si NO gagne
      opportunities.push({
        type: 'FAVORITE_NO',
        market,
        signal: `� Safe NO: YES=${(yesPrice*100).toFixed(1)}% | Yield +${yield_pct.toFixed(1)}%`,
        expectedProfit: yield_pct,
        action: 'BUY_NO',
        confidence: 0.92, // 92%+ de chance de gagner
        positionSize: 0.08, // Position plus grosse car safe
      })
    }
    
    // Acheter YES quand NO < 5%
    if (noPrice <= 0.05 && noPrice > 0.001 && volume24h > 10000) {
      const yield_pct = (1 - yesPrice) / yesPrice * 100
      opportunities.push({
        type: 'FAVORITE_YES',
        market,
        signal: `💰 Safe YES: NO=${(noPrice*100).toFixed(1)}% | Yield +${yield_pct.toFixed(1)}%`,
        expectedProfit: yield_pct,
        action: 'BUY_YES',
        confidence: 0.92,
        positionSize: 0.08,
      })
    }
    
    // 3. Spread capture sur marchés liquides
    if (spread > 0.005 && volume24h > 50000 && liquidity > 10000) {
      opportunities.push({
        type: 'SPREAD_CAPTURE',
        market,
        signal: `� Spread ${(spread*100).toFixed(2)}% | Liq $${(liquidity/1000).toFixed(0)}k`,
        expectedProfit: spread * 100,
        action: yesPrice < 0.5 ? 'BUY_YES' : 'BUY_NO',
        confidence: 0.75,
        positionSize: 0.03,
      })
    }
  }
  
  return opportunities.sort((a, b) => b.confidence - a.confidence) // Priorité aux trades safe
}

// STRATÉGIE B: CONTRARIAN + VALUE BETTING (comme les whales Polymarket)
export function detectLowProbOpportunities(markets) {
  const opportunities = []
  
  for (const market of markets) {
    const { yesPrice, noPrice, volume24h, priceHistory } = market
    const momentum = calculateMomentum(priceHistory)
    const volatility = calculateVolatility(priceHistory)
    
    // 1. Deep value: Prix très bas avec volume décent
    if (yesPrice <= 0.10 && yesPrice > 0.01 && volume24h > 1000) {
      const expectedValue = (1 - noPrice) / yesPrice
      opportunities.push({
        type: 'DEEP_VALUE_YES',
        market,
        signal: `💎 YES@${(yesPrice*100).toFixed(1)}% | EV ${expectedValue.toFixed(1)}x`,
        expectedProfit: (1 - yesPrice) * 20,
        action: 'BUY_YES',
        confidence: Math.min((0.15 - yesPrice) * 8, 0.9),
        positionSize: kellyFraction(0.12, 9, 1),
      })
    }
    
    if (noPrice <= 0.10 && noPrice > 0.01 && volume24h > 1000) {
      const expectedValue = (1 - yesPrice) / noPrice
      opportunities.push({
        type: 'DEEP_VALUE_NO',
        market,
        signal: `💎 NO@${(noPrice*100).toFixed(1)}% | EV ${expectedValue.toFixed(1)}x`,
        expectedProfit: (1 - noPrice) * 20,
        action: 'BUY_NO',
        confidence: Math.min((0.15 - noPrice) * 8, 0.9),
        positionSize: kellyFraction(0.12, 9, 1),
      })
    }
    
    // 2. Contrarian: Aller contre le momentum quand survente
    if (momentum < -0.05 && yesPrice < 0.4 && volatility > 0.02) {
      opportunities.push({
        type: 'CONTRARIAN_YES',
        market,
        signal: `🔄 Oversold: Mom ${(momentum*100).toFixed(1)}% | Vol ${(volatility*100).toFixed(1)}%`,
        expectedProfit: Math.abs(momentum) * 40,
        action: 'BUY_YES',
        confidence: Math.min(Math.abs(momentum) * 5, 0.75),
        positionSize: 0.02,
      })
    }
    
    if (momentum > 0.05 && noPrice < 0.4 && volatility > 0.02) {
      opportunities.push({
        type: 'CONTRARIAN_NO',
        market,
        signal: `🔄 Overbought: Mom +${(momentum*100).toFixed(1)}% | Vol ${(volatility*100).toFixed(1)}%`,
        expectedProfit: momentum * 40,
        action: 'BUY_NO',
        confidence: Math.min(momentum * 5, 0.75),
        positionSize: 0.02,
      })
    }
    
    // 3. Fade the extreme: Prix extrêmes tendent à revenir
    if (yesPrice > 0.92 && volume24h > 10000) {
      opportunities.push({
        type: 'FADE_HIGH',
        market,
        signal: `⚡ Fade YES@${(yesPrice*100).toFixed(0)}% (trop cher)`,
        expectedProfit: (yesPrice - 0.85) * 50,
        action: 'BUY_NO',
        confidence: 0.6,
        positionSize: 0.015,
      })
    }
    
    if (yesPrice < 0.08 && volume24h > 10000) {
      opportunities.push({
        type: 'FADE_LOW',
        market,
        signal: `⚡ Fade YES@${(yesPrice*100).toFixed(1)}% (trop cheap)`,
        expectedProfit: (0.15 - yesPrice) * 50,
        action: 'BUY_YES',
        confidence: 0.6,
        positionSize: 0.015,
      })
    }
  }
  
  return opportunities.sort((a, b) => b.confidence - a.confidence)
}

// STRATÉGIE C: MOMENTUM + VOLUME SPIKE (comme les HFT traders)
export function detectScalpingOpportunities(currentMarkets, previousMarkets) {
  const opportunities = []
  
  for (const market of currentMarkets) {
    const { yesPrice, noPrice, volume24h, priceHistory, liquidity } = market
    const momentum = calculateMomentum(priceHistory)
    const volatility = calculateVolatility(priceHistory)
    
    // 1. Volume spike: Fort volume = smart money
    if (volume24h > 50000) {
      const previous = previousMarkets?.find(m => m.id === market.id)
      const volChange = previous ? (volume24h - (previous.volume24h || 0)) / (previous.volume24h || 1) : 0
      
      if (volChange > 0.1) {
        opportunities.push({
          type: 'VOLUME_SPIKE',
          market,
          signal: `🚀 Vol +${(volChange*100).toFixed(0)}% | $${(volume24h/1000).toFixed(0)}k`,
          expectedProfit: 3 + volChange * 10,
          action: momentum > 0 ? 'BUY_YES' : 'BUY_NO',
          confidence: Math.min(volChange * 2, 0.85),
          positionSize: 0.025,
        })
      }
    }
    
    // 2. Momentum trading: Suivre la tendance
    if (Math.abs(momentum) > 0.02 && volatility < 0.1) {
      opportunities.push({
        type: momentum > 0 ? 'MOMENTUM_UP' : 'MOMENTUM_DOWN',
        market,
        signal: `📈 Mom ${momentum > 0 ? '+' : ''}${(momentum*100).toFixed(1)}%`,
        expectedProfit: Math.abs(momentum) * 25,
        action: momentum > 0 ? 'BUY_YES' : 'BUY_NO',
        confidence: Math.min(Math.abs(momentum) * 4, 0.8),
        positionSize: 0.02,
      })
    }
    
    // 3. Mean reversion: Haute volatilité = retour à la moyenne
    if (volatility > 0.05 && liquidity > 20000) {
      const meanPrice = 0.5
      const deviation = yesPrice - meanPrice
      
      if (Math.abs(deviation) > 0.15) {
        opportunities.push({
          type: 'MEAN_REVERT',
          market,
          signal: `📉 MeanRev: Dev ${(deviation*100).toFixed(0)}% | σ=${(volatility*100).toFixed(1)}%`,
          expectedProfit: Math.abs(deviation) * 20,
          action: deviation > 0 ? 'BUY_NO' : 'BUY_YES',
          confidence: Math.min(volatility * 5, 0.7),
          positionSize: 0.015,
        })
      }
    }
    
    // 4. Scalp rapide: Petits mouvements fréquents
    const previous = previousMarkets?.find(m => m.id === market.id)
    if (previous) {
      const change = yesPrice - previous.yesPrice
      if (Math.abs(change) > 0.005 && volume24h > 5000) {
        opportunities.push({
          type: change > 0 ? 'SCALP_LONG' : 'SCALP_SHORT',
          market,
          signal: `⚡ Scalp ${change > 0 ? '+' : ''}${(change*100).toFixed(2)}%`,
          expectedProfit: Math.abs(change) * 50,
          action: change > 0 ? 'BUY_YES' : 'BUY_NO',
          confidence: Math.min(Math.abs(change) * 10, 0.6),
          positionSize: 0.01,
        })
      }
    }
    
    // 5. High volume play: Marchés très actifs = opportunités
    if (volume24h > 100000 && yesPrice > 0.25 && yesPrice < 0.75) {
      opportunities.push({
        type: 'HIGH_VOL_PLAY',
        market,
        signal: `🔥 $${(volume24h/1000).toFixed(0)}k vol | YES ${(yesPrice*100).toFixed(0)}%`,
        expectedProfit: 2 + Math.log10(volume24h) * 0.5,
        action: yesPrice > 0.5 ? 'BUY_NO' : 'BUY_YES',
        confidence: Math.min(volume24h / 200000, 0.75),
        positionSize: 0.03,
      })
    }
  }
  
  return opportunities.sort((a, b) => b.confidence - a.confidence)
}

export default {
  fetchMarkets,
  fetchMarketDetails,
  fetchOrderbook,
  fetchMidpoints,
  detectArbitrageOpportunities,
  detectLowProbOpportunities,
  detectScalpingOpportunities,
}
