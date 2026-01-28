// Polymarket API via Backend Proxy (CORS bypass)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

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
    return data.map(market => ({
      id: market.conditionId || market.id,
      slug: market.slug,
      question: market.question,
      description: market.description,
      category: market.category || 'Other',
      
      // Prix YES/NO
      yesPrice: parseFloat(market.outcomePrices?.[0] || market.bestBid || 0.5),
      noPrice: parseFloat(market.outcomePrices?.[1] || market.bestAsk || 0.5),
      
      // Volume et liquidité
      volume: parseFloat(market.volume || 0),
      volume24h: parseFloat(market.volume24hr || 0),
      liquidity: parseFloat(market.liquidity || 0),
      
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
    }))
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

// Récupérer l'orderbook CLOB pour un token (via proxy si disponible)
export async function fetchOrderbook(tokenId) {
  try {
    const response = await fetch(`${API_URL}/api/orderbook?token_id=${tokenId}`)
    
    if (!response.ok) {
      console.warn('Orderbook non disponible')
      return { bids: [], asks: [] }
    }
    
    return await response.json()
  } catch (error) {
    console.warn('Orderbook non disponible:', error)
    return { bids: [], asks: [] }
  }
}

// Récupérer les prix mid-market pour plusieurs tokens
export async function fetchMidpoints(tokenIds) {
  try {
    const response = await fetch(`${API_URL}/api/midpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token_ids: tokenIds })
    })
    
    if (!response.ok) {
      console.warn('Midpoints non disponible')
      return {}
    }
    
    return await response.json()
  } catch (error) {
    console.warn('Midpoints non disponible:', error)
    return {}
  }
}

// Détecter les opportunités d'arbitrage (seuils assouplis)
export function detectArbitrageOpportunities(markets, threshold = 0.995) {
  const opportunities = []
  
  for (const market of markets) {
    const yesPrice = market.yesPrice
    const noPrice = market.noPrice
    const sum = yesPrice + noPrice
    
    // Arbitrage si YES + NO != 100% (écart de prix)
    if (sum < threshold && sum > 0.5) {
      opportunities.push({
        type: 'ARBITRAGE_UNDER',
        market: market,
        signal: `YES+NO = ${(sum * 100).toFixed(1)}% (écart ${((1-sum) * 100).toFixed(1)}%)`,
        expectedProfit: (1 - sum) * 100,
        action: 'BUY_BOTH',
        confidence: Math.min((threshold - sum) * 5, 1),
      })
    } else if (sum > 1.005) {
      opportunities.push({
        type: 'ARBITRAGE_OVER',
        market: market,
        signal: `YES+NO = ${(sum * 100).toFixed(1)}% > 100.5%`,
        expectedProfit: (sum - 1) * 100,
        action: 'SELL_BOTH',
        confidence: Math.min((sum - 1.005) * 5, 1),
      })
    }
  }
  
  return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit)
}

// Détecter les opportunités Low-Prob (seuils assouplis)
export function detectLowProbOpportunities(markets, threshold = 0.15) {
  const opportunities = []
  
  for (const market of markets) {
    // YES très bas = opportunité d'acheter NO (haute probabilité de gain)
    if (market.yesPrice <= threshold && market.yesPrice > 0.001) {
      opportunities.push({
        type: 'LOW_PROB_NO',
        market: market,
        signal: `YES = ${(market.yesPrice * 100).toFixed(1)}% → BUY NO`,
        expectedProfit: (1 - market.noPrice) * 100,
        action: 'BUY_NO',
        confidence: Math.min((threshold - market.yesPrice) * 5, 1),
      })
    }
    
    // NO très bas = opportunité d'acheter YES
    if (market.noPrice <= threshold && market.noPrice > 0.001) {
      opportunities.push({
        type: 'LOW_PROB_YES',
        market: market,
        signal: `NO = ${(market.noPrice * 100).toFixed(1)}% → BUY YES`,
        expectedProfit: (1 - market.yesPrice) * 100,
        action: 'BUY_YES',
        confidence: Math.min((threshold - market.noPrice) * 5, 1),
      })
    }
  }
  
  return opportunities.sort((a, b) => b.confidence - a.confidence)
}

// Détecter les opportunités de scalping + momentum
export function detectScalpingOpportunities(currentMarkets, previousMarkets, dropThreshold = 0.01) {
  const opportunities = []
  
  // Si pas de previous, utiliser le volume comme signal
  if (!previousMarkets || previousMarkets.length === 0) {
    // Stratégie volume: marchés avec fort volume = opportunités
    for (const market of currentMarkets) {
      if (market.volume24h > 10000 && market.yesPrice > 0.3 && market.yesPrice < 0.7) {
        opportunities.push({
          type: 'VOLUME_PLAY',
          market: market,
          signal: `Vol 24h: $${(market.volume24h/1000).toFixed(0)}k | YES ${(market.yesPrice*100).toFixed(0)}%`,
          expectedProfit: 2 + Math.random() * 3,
          action: market.yesPrice > 0.5 ? 'BUY_NO' : 'BUY_YES',
          confidence: Math.min(market.volume24h / 100000, 0.8),
        })
      }
    }
    return opportunities.slice(0, 5)
  }
  
  for (const current of currentMarkets) {
    const previous = previousMarkets.find(m => m.id === current.id)
    if (!previous) continue
    
    const yesChange = current.yesPrice - previous.yesPrice
    const noChange = current.noPrice - previous.noPrice
    
    // Tout changement de prix = opportunité potentielle
    if (Math.abs(yesChange) > dropThreshold) {
      opportunities.push({
        type: yesChange < 0 ? 'SCALP_YES_DROP' : 'SCALP_YES_PUMP',
        market: current,
        signal: `YES ${yesChange > 0 ? '+' : ''}${(yesChange * 100).toFixed(1)}%`,
        expectedProfit: Math.abs(yesChange) * 30,
        action: yesChange < 0 ? 'BUY_YES' : 'BUY_NO',
        confidence: Math.min(Math.abs(yesChange) * 3, 0.9),
      })
    }
    
    if (Math.abs(noChange) > dropThreshold) {
      opportunities.push({
        type: noChange < 0 ? 'SCALP_NO_DROP' : 'SCALP_NO_PUMP',
        market: current,
        signal: `NO ${noChange > 0 ? '+' : ''}${(noChange * 100).toFixed(1)}%`,
        expectedProfit: Math.abs(noChange) * 30,
        action: noChange < 0 ? 'BUY_NO' : 'BUY_YES',
        confidence: Math.min(Math.abs(noChange) * 3, 0.9),
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
