import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import ControlPanel from './components/ControlPanel'
import MarketsPanel from './components/MarketsPanel'
import StrategiesPanel from './components/StrategiesPanel'
import TradesHistory from './components/TradesHistory'
import OpportunitiesPanel from './components/OpportunitiesPanel'
import LoginScreen from './components/LoginScreen'
import SettingsPanel from './components/SettingsPanel'
import PnLCard from './components/PnLCard'
import { 
  fetchMarkets, 
  fetchRealPrices,
  detectArbitrageOpportunities, 
  detectLowProbOpportunities,
  detectScalpingOpportunities 
} from './services/polymarketApi'

function App() {
  // Authentification
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('polybot_auth') === 'true'
  })

  const [botState, setBotState] = useState(() => {
    const saved = localStorage.getItem('polybot_state')
    if (saved) {
      const parsed = JSON.parse(saved)
      return { ...parsed, status: parsed.status || 'stopped' }
    }
    return {
      mode: 'paper',
      status: 'stopped',
      balance: 300.00,
      startingBalance: 300.00,
      totalPnl: 0,
      todayPnl: 0,
      totalTrades: 0,
      todayTrades: 0,
      openPositions: 0,
      activeStrategies: [],
    }
  })

  const [markets, setMarkets] = useState([])
  const [previousMarkets, setPreviousMarkets] = useState([])
  const [opportunities, setOpportunities] = useState([])
  const [trades, setTrades] = useState(() => {
    const saved = localStorage.getItem('polybot_trades')
    return saved ? JSON.parse(saved) : []
  })
  
  // Positions ouvertes pour simulation réaliste
  const [openPositions, setOpenPositions] = useState(() => {
    const saved = localStorage.getItem('polybot_positions')
    return saved ? JSON.parse(saved) : []
  })
  
  const [wsConnected, setWsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  
  const intervalRef = useRef(null)

  // Sauvegarder l'état du bot dans localStorage
  useEffect(() => {
    localStorage.setItem('polybot_state', JSON.stringify(botState))
  }, [botState])

  // Sauvegarder les trades dans localStorage
  useEffect(() => {
    localStorage.setItem('polybot_trades', JSON.stringify(trades))
  }, [trades])
  
  // Sauvegarder les positions ouvertes
  useEffect(() => {
    localStorage.setItem('polybot_positions', JSON.stringify(openPositions))
  }, [openPositions])
  
  // Mettre à jour le P&L des positions ouvertes et fermer si SL/TP atteint
  useEffect(() => {
    if (openPositions.length === 0 || markets.length === 0) return
    
    const positionsToClose = []
    const updatedPositions = []
    
    openPositions.forEach(pos => {
      const currentMarket = markets.find(m => m.id === pos.marketId)
      if (!currentMarket) {
        updatedPositions.push(pos)
        return
      }
      
      // MARKET MAKING: On a acheté au BID, on vend au ASK
      // Notre ordre de vente est placé au ASK et attend d'être rempli
      const currentAskPrice = pos.side === 'YES' 
        ? (currentMarket.yesAsk || currentMarket.yesPrice * 1.01)
        : (currentMarket.noAsk || currentMarket.noPrice * 1.01)
      
      const currentBidPrice = pos.side === 'YES'
        ? (currentMarket.yesBid || currentMarket.yesPrice * 0.99)
        : (currentMarket.noBid || currentMarket.noPrice * 0.99)
      
      // Pour le market making: on vend au ASK (pas au BID!)
      const currentPrice = pos.isMarketMaking ? currentAskPrice : currentBidPrice
      
      // P&L MARKET MAKING = (ASK sortie - BID entrée) × quantité
      // = On CAPTE le spread au lieu de le payer!
      const pnl = (currentPrice - pos.entryPrice) * pos.size
      
      // Vérifier Stop Loss, Take Profit, ou Timeout
      const hitStopLoss = pos.side === 'YES' 
        ? currentPrice <= pos.stopLoss 
        : currentPrice >= pos.stopLoss
      const hitTakeProfit = pos.side === 'YES'
        ? currentPrice >= pos.takeProfit
        : currentPrice <= pos.takeProfit
      
      // Timeout: fermer après maxHoldTime (10 sec pour scalping rapide)
      const holdTime = Date.now() - new Date(pos.openedAt).getTime()
      const hitTimeout = holdTime > (pos.maxHoldTime || 10000)
      
      // P&L RÉEL basé sur les vrais prix du marché
      // Pas de simulation - juste la différence entre prix d'entrée et prix actuel
      // En vrai trading: on achète au ASK et on vend au BID
      // Le spread réel Polymarket est inclus dans les prix qu'on récupère
      const realPnl = pnl // Différence réelle entre entry et current price
      
      // Fermer si SL/TP atteint ou timeout
      const shouldClose = hitStopLoss || hitTakeProfit || hitTimeout
      
      if (shouldClose) {
        let closeReason = 'TIMEOUT'
        if (hitTakeProfit) closeReason = 'TAKE_PROFIT ✅'
        else if (hitStopLoss) closeReason = 'STOP_LOSS ❌'
        else if (realPnl > 0) closeReason = 'WIN 💰'
        else closeReason = 'LOSS 📊'
        
        positionsToClose.push({
          ...pos,
          currentPrice,
          realizedPnl: realPnl,
          closedAt: new Date(),
          closeReason
        })
      } else {
        updatedPositions.push({ ...pos, currentPrice, unrealizedPnl: pnl })
      }
    })
    
    // Mettre à jour les positions
    if (positionsToClose.length > 0) {
      setOpenPositions(updatedPositions)
      
      // Ajouter les trades fermés et mettre à jour la balance
      positionsToClose.forEach(closedPos => {
        const profit = closedPos.realizedPnl
        const returnedValue = closedPos.size * closedPos.currentPrice
        
        // Ajouter le trade fermé
        setTrades(prev => [{
          id: Date.now() + Math.random(),
          timestamp: new Date(),
          strategy: closedPos.strategy?.split('_')[0] || 'TRADE',
          market: closedPos.marketSlug?.slice(0, 15) || 'Unknown',
          question: closedPos.question || '',
          side: closedPos.side,
          price: closedPos.currentPrice.toFixed(3),
          entryPrice: closedPos.entryPrice.toFixed(3),
          size: closedPos.size.toFixed(2),
          profit: profit,
          signal: closedPos.closeReason,
          status: 'CLOSED',
          isReal: false,
        }, ...prev].slice(0, 100))
        
        // Mettre à jour la balance et les stats
        setBotState(prev => ({
          ...prev,
          balance: prev.balance + returnedValue,
          totalPnl: prev.totalPnl + profit,
          todayPnl: prev.todayPnl + profit,
          totalTrades: prev.totalTrades + 1,
          todayTrades: prev.todayTrades + 1,
          openPositions: updatedPositions.length,
        }))
        
        console.log(`📊 Position fermée: ${closedPos.closeReason} | P&L: $${profit.toFixed(2)}`)
      })
    } else {
      setOpenPositions(updatedPositions)
    }
  }, [markets])

  // Charger les vrais marchés Polymarket
  const loadMarkets = useCallback(async () => {
    try {
      const realMarkets = await fetchMarkets(30)
      
      // Sauvegarder les anciens prix pour détecter les changements
      setPreviousMarkets(markets)
      
      // Mettre à jour avec les vrais marchés
      setMarkets(realMarkets.map(m => ({
        ...m,
        symbol: m.slug?.split('-').slice(0, 2).join('-').toUpperCase() || m.id.slice(0, 8),
        change: 0, // Sera calculé avec previousMarkets
      })))
      
      setWsConnected(true)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Erreur chargement marchés:', err)
      setError('Erreur connexion Polymarket API')
      setWsConnected(false)
    }
  }, [markets])

  // Charger les marchés au démarrage
  useEffect(() => {
    loadMarkets()
  }, [])

  // Rafraîchir les marchés toutes les 5 secondes quand le bot tourne
  useEffect(() => {
    if (botState.status === 'running') {
      intervalRef.current = setInterval(loadMarkets, 5000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [botState.status, loadMarkets])

  // Détecter les vraies opportunités quand les marchés changent
  useEffect(() => {
    if (markets.length === 0) return
    
    const allOpportunities = []
    
    // Stratégie A: Arbitrage (écart YES+NO < 99.5%)
    if (botState.activeStrategies.includes('A')) {
      const arbOpps = detectArbitrageOpportunities(markets)
      allOpportunities.push(...arbOpps)
    }
    
    // Stratégie B: Low-Prob (prix < 15%)
    if (botState.activeStrategies.includes('B')) {
      const lowProbOpps = detectLowProbOpportunities(markets)
      allOpportunities.push(...lowProbOpps)
    }
    
    // Stratégie C: Scalping + Volume
    if (botState.activeStrategies.includes('C')) {
      const scalpOpps = detectScalpingOpportunities(markets, previousMarkets)
      allOpportunities.push(...scalpOpps)
    }
    
    setOpportunities(allOpportunities.slice(0, 10))
  }, [markets, previousMarkets, botState.activeStrategies])

  // Ref pour éviter les re-renders qui reset l'interval
  const opportunitiesRef = useRef(opportunities)
  const balanceRef = useRef(botState.balance)
  
  useEffect(() => {
    opportunitiesRef.current = opportunities
  }, [opportunities])
  
  useEffect(() => {
    balanceRef.current = botState.balance
  }, [botState.balance])

  // Exécuter les trades PAPER sur les opportunités détectées
  useEffect(() => {
    if (botState.status !== 'running') return
    if (botState.activeStrategies.length === 0) return
    
    console.log('🚀 Bot démarré - Trading actif')
    
    const tradeInterval = setInterval(async () => {
      const currentOpps = opportunitiesRef.current
      const currentBalance = balanceRef.current
      
      if (!currentOpps || currentOpps.length === 0) {
        console.log('⏳ En attente d\'opportunités...')
        return
      }
      
      // Prendre la meilleure opportunité disponible
      const opp = currentOpps[0]
      if (!opp) return
      
      console.log('💰 Trade exécuté:', opp.type, opp.signal)
      
      // RÉCUPÉRER LES VRAIS PRIX BID/ASK DE L'ORDERBOOK
      const realPrices = await fetchRealPrices(opp.market)
      
      // Position sizing dynamique
      const positionPct = opp.positionSize || 0.02
      const tradeSize = Math.min(currentBalance * positionPct, currentBalance * 0.05)
      const side = opp.action?.includes('YES') ? 'YES' : 'NO'
      
      // ========================================
      // MARKET MAKING RÉALISTE
      // On place un ordre LIMIT au prix BID (pas ASK)
      // = On achète MOINS CHER que le marché
      // Comme les vrais market makers
      // ========================================
      
      const bestBid = side === 'YES' 
        ? (realPrices.yesBid || opp.market.yesPrice * 0.99)
        : (realPrices.noBid || opp.market.noPrice * 0.99)
      
      const bestAsk = side === 'YES'
        ? (realPrices.yesAsk || opp.market.yesPrice * 1.01)
        : (realPrices.noAsk || opp.market.noPrice * 1.01)
      
      // ORDRE LIMIT: on place notre ordre au BID (on achète au prix des acheteurs)
      // En réel, cet ordre serait dans l'orderbook et attendrait d'être rempli
      const entryPrice = bestBid // On achète au BID, pas au ASK!
      
      // Notre ordre de sortie sera au ASK (on vend au prix des vendeurs)
      const exitAskPrice = bestAsk
      
      // Le spread qu'on va capter = ASK - BID
      const spreadToCapture = bestAsk - bestBid
      
      // STRATÉGIE SCALPING DES BOTS 6 CHIFFRES:
      // - Petits gains fréquents (1-3%)
      // - Stop loss serré (-1%)
      // - Volume élevé de trades
      const newPosition = {
        id: Date.now(),
        marketId: opp.market.id,
        marketSlug: opp.market.slug,
        clobTokenIds: opp.market.clobTokenIds,
        question: opp.market.question?.slice(0, 50),
        side,
        // MARKET MAKING: on achète au BID, on vend au ASK
        entryPrice,           // Prix BID auquel on a placé notre ordre d'achat
        exitAskPrice,         // Prix ASK auquel on placera notre ordre de vente
        spreadToCapture,      // Le spread qu'on va capter
        currentPrice: entryPrice,
        size: tradeSize,
        unrealizedPnl: 0,
        openedAt: new Date(),
        strategy: opp.type,
        signal: opp.signal,
        isMarketMaking: true, // Flag pour indiquer qu'on fait du market making
        // MARKET MAKING: pas de SL/TP classique, on attend juste que l'ordre soit rempli
        stopLoss: entryPrice * (side === 'YES' ? 0.95 : 1.05), // -5% protection
        takeProfit: exitAskPrice, // Notre TP = le ASK où on a placé l'ordre de vente
        // Timeout: 3 minutes pour laisser le temps aux ordres d'être remplis
        maxHoldTime: 180000,
      }
      
      // Ajouter aux positions ouvertes
      setOpenPositions(prev => [...prev, newPosition])
      
      // Déduire le coût de la balance
      const cost = tradeSize * entryPrice
      setBotState(prev => ({
        ...prev,
        balance: prev.balance - cost,
        openPositions: prev.openPositions + 1,
      }))
      
      // Logger le trade ouvert
      const newTrade = {
        id: Date.now(),
        timestamp: new Date(),
        strategy: opp.type?.split('_')[0] || 'TRADE',
        market: opp.market?.slug?.slice(0, 15) || 'Unknown',
        question: opp.market?.question?.slice(0, 50) || '',
        side,
        price: entryPrice.toFixed(3),
        size: tradeSize.toFixed(2),
        profit: null, // Pas encore réalisé
        signal: opp.signal || '',
        confidence: opp.confidence || 0.5,
        status: 'OPEN',
        isReal: false,
      }
      
      setTrades(prev => [newTrade, ...prev].slice(0, 100))
    }, 3000) // Trade toutes les 3 secondes
    
    return () => {
      console.log('⏹️ Bot arrêté')
      clearInterval(tradeInterval)
    }
  }, [botState.status, botState.activeStrategies])

  const toggleBot = () => {
    setBotState(prev => ({
      ...prev,
      status: prev.status === 'running' ? 'stopped' : 'running'
    }))
  }

  const toggleStrategy = (strategyCode) => {
    setBotState(prev => ({
      ...prev,
      activeStrategies: prev.activeStrategies.includes(strategyCode)
        ? prev.activeStrategies.filter(s => s !== strategyCode)
        : [...prev.activeStrategies, strategyCode]
    }))
  }

  const toggleMode = () => {
    setBotState(prev => ({
      ...prev,
      mode: prev.mode === 'paper' ? 'live' : 'paper',
      balance: prev.mode === 'paper' ? prev.balance : 300.00
    }))
  }

  // Reset toutes les stats
  const resetStats = () => {
    const startingBalance = botState.startingBalance || 300
    setBotState({
      mode: 'paper',
      status: 'stopped',
      balance: startingBalance,
      startingBalance: startingBalance,
      totalPnl: 0,
      todayPnl: 0,
      totalTrades: 0,
      todayTrades: 0,
      openPositions: 0,
      activeStrategies: [],
    })
    setTrades([])
    setOpenPositions([])
    localStorage.removeItem('polybot_trades')
    localStorage.removeItem('polybot_positions')
  }

  // Déconnexion
  const handleLogout = () => {
    localStorage.removeItem('polybot_auth')
    setIsAuthenticated(false)
  }

  // Écran de login si non authentifié
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />
  }

  return (
    <div className="min-h-screen bg-hl-bg">
      <Header botState={botState} wsConnected={wsConnected} />

      <main className="p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Colonne gauche - Contrôles et Marchés */}
          <div className="lg:col-span-3 space-y-4">
            <ControlPanel 
              botState={botState} 
              toggleBot={toggleBot} 
              toggleMode={toggleMode}
            />
            <MarketsPanel markets={markets} />
          </div>

          {/* Colonne centrale - Stratégies, Opportunités et Trades */}
          <div className="lg:col-span-6 space-y-4">
            <StrategiesPanel 
              botState={botState} 
              toggleStrategy={toggleStrategy}
            />
            <OpportunitiesPanel opportunities={opportunities} />
            <TradesHistory trades={trades} />
          </div>

          {/* Colonne droite - P&L et Paramètres */}
          <div className="lg:col-span-3 space-y-4">
            {/* P&L Card - Le plus important */}
            <PnLCard botState={botState} trades={trades} openPositions={openPositions} />
            
            {/* Paramètres */}
            <SettingsPanel 
              botState={botState} 
              setBotState={setBotState}
              onReset={resetStats}
            />
            
            {/* Status connexion */}
            <div className="hl-card p-4">
              <h3 className="text-sm font-semibold text-hl-text-secondary mb-3 uppercase tracking-wider">
                Connexion
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-hl-text-muted">API</span>
                  <span className={wsConnected ? 'text-hl-green' : 'text-hl-red'}>
                    {wsConnected ? '● Live' : '○ Offline'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-hl-text-muted">Marchés</span>
                  <span className="text-white font-mono">{markets.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-hl-text-muted">Mode</span>
                  <span className={botState.mode === 'paper' ? 'text-hl-yellow' : 'text-hl-green'}>
                    {botState.mode === 'paper' ? '📄 PAPER' : '💰 LIVE'}
                  </span>
                </div>
                {error && (
                  <div className="mt-2 p-2 rounded bg-hl-red bg-opacity-20 text-hl-red text-xs">
                    {error}
                  </div>
                )}
              </div>
              
              {/* Bouton déconnexion */}
              <button
                onClick={handleLogout}
                className="w-full mt-4 py-2 text-xs text-hl-text-muted hover:text-hl-red border border-hl-border hover:border-hl-red rounded transition-all"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-hl-border py-4 px-6 text-center text-hl-text-muted text-xs">
        <p>PolyBot v1.0.0 | Bot HFT pour Polymarket</p>
        <p className="mt-1">⚠️ Le trading comporte des risques. Ne tradez qu'avec des fonds que vous pouvez vous permettre de perdre.</p>
      </footer>
    </div>
  )
}

export default App
