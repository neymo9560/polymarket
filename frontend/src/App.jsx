import { useState, useEffect, useRef, useCallback } from 'react'
import Header from './components/Header'
import ControlPanel from './components/ControlPanel'
import MarketsPanel from './components/MarketsPanel'
import StrategiesPanel from './components/StrategiesPanel'
import TradesHistory from './components/TradesHistory'
import PerformancePanel from './components/PerformancePanel'
import OpportunitiesPanel from './components/OpportunitiesPanel'
import { 
  fetchMarkets, 
  detectArbitrageOpportunities, 
  detectLowProbOpportunities,
  detectScalpingOpportunities 
} from './services/polymarketApi'

function App() {
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

  // Exécuter les trades PAPER sur les opportunités détectées
  useEffect(() => {
    if (botState.status !== 'running' || opportunities.length === 0) return
    if (botState.activeStrategies.length === 0) return
    
    const tradeInterval = setInterval(() => {
      // Prendre la meilleure opportunité disponible
      const opp = opportunities[0]
      if (!opp) return
      
      // Position sizing dynamique (Kelly Criterion style)
      const positionPct = opp.positionSize || 0.02
      const tradeSize = Math.min(botState.balance * positionPct, botState.balance * 0.05) // Max 5% par trade
      const entryPrice = opp.action.includes('YES') ? opp.market.yesPrice : opp.market.noPrice
      
      // Simuler le résultat du trade (basé sur la confiance + edge réel)
      const baseWinRate = 0.45 + (opp.confidence * 0.35) // 45-80% selon confiance
      const edgeBonus = opp.expectedProfit > 5 ? 0.05 : 0 // Bonus si edge > 5%
      const winProbability = Math.min(baseWinRate + edgeBonus, 0.85)
      const isWin = Math.random() < winProbability
      const profit = isWin 
        ? tradeSize * (opp.expectedProfit / 100) * (0.7 + Math.random() * 0.6) // 70-130% du profit attendu
        : -tradeSize * (0.05 + Math.random() * 0.1) // Perte 5-15%
      
      const newTrade = {
        id: Date.now(),
        timestamp: new Date(),
        strategy: opp.type.split('_')[0],
        market: opp.market.symbol || opp.market.slug?.slice(0, 15),
        question: opp.market.question?.slice(0, 50),
        side: opp.action.includes('YES') ? 'YES' : 'NO',
        price: entryPrice.toFixed(3),
        size: tradeSize.toFixed(2),
        profit: profit,
        signal: opp.signal,
        confidence: opp.confidence,
        isReal: false, // Paper trade
      }
      
      setTrades(prev => [newTrade, ...prev].slice(0, 100))
      setBotState(prev => ({
        ...prev,
        totalPnl: prev.totalPnl + profit,
        todayPnl: prev.todayPnl + profit,
        totalTrades: prev.totalTrades + 1,
        todayTrades: prev.todayTrades + 1,
        balance: prev.balance + profit
      }))
    }, 8000) // Trade toutes les 8 secondes sur les vraies opportunités
    
    return () => clearInterval(tradeInterval)
  }, [botState.status, opportunities, botState.activeStrategies, botState.balance])

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

          {/* Colonne droite - Performance */}
          <div className="lg:col-span-3 space-y-4">
            <PerformancePanel botState={botState} trades={trades} />
            {/* Status connexion */}
            <div className="hl-card p-4">
              <h3 className="text-sm font-semibold text-hl-text-secondary mb-3 uppercase tracking-wider">
                Connexion Polymarket
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-hl-text-muted">API Status</span>
                  <span className={wsConnected ? 'text-hl-green' : 'text-hl-red'}>
                    {wsConnected ? '● Connecté' : '○ Déconnecté'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-hl-text-muted">Marchés chargés</span>
                  <span className="text-white font-mono">{markets.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-hl-text-muted">Dernière MAJ</span>
                  <span className="text-hl-text-secondary text-xs font-mono">
                    {lastUpdate ? lastUpdate.toLocaleTimeString() : '-'}
                  </span>
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
