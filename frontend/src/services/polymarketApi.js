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

// Détecter les opportunités d'arbitrage
export function detectArbitrageOpportunities(markets, threshold = 0.985) {
  const opportunities = []
  
  for (const market of markets) {
    const yesPrice = market.yesPrice
    const noPrice = market.noPrice
    const sum = yesPrice + noPrice
    
    // Arbitrage si YES + NO < threshold (sous-évalué) ou > 1.015 (sur-évalué)
    if (sum < threshold) {
      opportunities.push({
        type: 'ARBITRAGE_UNDER',
        market: market,
        signal: `YES+NO = ${(sum * 100).toFixed(1)}% < ${threshold * 100}%`,
        expectedProfit: (1 - sum) * 100,
        action: 'BUY_BOTH',
        confidence: Math.min((threshold - sum) * 10, 1),
      })
    } else if (sum > 1.015) {
      opportunities.push({
        type: 'ARBITRAGE_OVER',
        market: market,
        signal: `YES+NO = ${(sum * 100).toFixed(1)}% > 101.5%`,
        expectedProfit: (sum - 1) * 100,
        action: 'SELL_BOTH',
        confidence: Math.min((sum - 1.015) * 10, 1),
      })
    }
  }
  
  return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit)
}

// Détecter les opportunités Low-Prob NO
export function detectLowProbOpportunities(markets, threshold = 0.03) {
  const opportunities = []
  
  for (const market of markets) {
    // YES très bas = opportunité de vendre NO (acheter YES)
    if (market.yesPrice <= threshold && market.yesPrice > 0.001) {
      opportunities.push({
        type: 'LOW_PROB_NO',
        market: market,
        signal: `YES = ${(market.yesPrice * 100).toFixed(2)}% très bas`,
        expectedProfit: market.noPrice * 100,
        action: 'BUY_NO',
        confidence: Math.min((threshold - market.yesPrice) * 20, 1),
      })
    }
    
    // NO très bas = opportunité
    if (market.noPrice <= threshold && market.noPrice > 0.001) {
      opportunities.push({
        type: 'LOW_PROB_YES',
        market: market,
        signal: `NO = ${(market.noPrice * 100).toFixed(2)}% très bas`,
        expectedProfit: market.yesPrice * 100,
        action: 'BUY_YES',
        confidence: Math.min((threshold - market.noPrice) * 20, 1),
      })
    }
  }
  
  return opportunities.sort((a, b) => b.confidence - a.confidence)
}

// Détecter les opportunités de scalping (changements rapides)
export function detectScalpingOpportunities(currentMarkets, previousMarkets, dropThreshold = 0.05) {
  const opportunities = []
  
  if (!previousMarkets || previousMarkets.length === 0) return opportunities
  
  for (const current of currentMarkets) {
    const previous = previousMarkets.find(m => m.id === current.id)
    if (!previous) continue
    
    const yesChange = current.yesPrice - previous.yesPrice
    const noChange = current.noPrice - previous.noPrice
    
    // Drop significatif sur YES = opportunité d'achat
    if (yesChange < -dropThreshold) {
      opportunities.push({
        type: 'SCALP_YES_DROP',
        market: current,
        signal: `YES dropped ${(yesChange * 100).toFixed(1)}%`,
        expectedProfit: Math.abs(yesChange) * 50,
        action: 'BUY_YES',
        confidence: Math.min(Math.abs(yesChange) * 5, 1),
      })
    }
    
    // Drop significatif sur NO
    if (noChange < -dropThreshold) {
      opportunities.push({
        type: 'SCALP_NO_DROP',
        market: current,
        signal: `NO dropped ${(noChange * 100).toFixed(1)}%`,
        expectedProfit: Math.abs(noChange) * 50,
        action: 'BUY_NO',
        confidence: Math.min(Math.abs(noChange) * 5, 1),
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
