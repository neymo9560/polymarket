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
import StrategyAnalytics from './components/StrategyAnalytics'
import { 
  fetchMarkets, 
  fetchRealPrices,
  detectArbitrageOpportunities, 
  detectLowProbOpportunities,
  detectScalpingOpportunities 
} from './services/polymarketApi'
import { executeLiveTrade } from './services/tradingApi'
import { sendTelegramAlert, formatWinAlert, formatStatusAlert } from './services/telegramApi'
import { saveBotState, loadBotState } from './services/supabaseClient'

function App() {
  // Authentification
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('polybot_auth') === 'true'
  })
  
  // Rôle: 'admin' = contrôle total, 'viewer' = lecture seule
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('polybot_role') || 'viewer'
  })
  const isAdmin = userRole === 'admin'

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
      
      // RÉCUPÉRER LES VRAIS PRIX DU MARCHÉ
      const currentAskPrice = pos.side === 'YES' 
        ? (currentMarket.yesAsk || currentMarket.yesPrice * 1.01)
        : (currentMarket.noAsk || currentMarket.noPrice * 1.01)
      
      const currentBidPrice = pos.side === 'YES'
        ? (currentMarket.yesBid || currentMarket.yesPrice * 0.99)
        : (currentMarket.noBid || currentMarket.noPrice * 0.99)
      
      // MARKET MAKING RÉALISTE - EXACTEMENT COMME EN LIVE
      // L'ordre est rempli quand le prix du marché BOUGE et traverse notre niveau
      // Ou quand il y a du volume qui passe à notre prix
      let orderFilled = pos.orderStatus === 'FILLED'
      
      if (pos.orderStatus === 'PENDING') {
        const holdTime = Date.now() - new Date(pos.openedAt).getTime()
        
        // Vérifier si le prix a bougé vers notre ordre
        // Si le ASK descend jusqu'à notre BID, notre ordre d'achat est rempli
        const priceReachedOurLevel = currentAskPrice <= pos.limitPrice * 1.005 // 0.5% de marge
        
        // OU si le marché a du mouvement (volatilité = opportunité de remplissage)
        const priceChanged = Math.abs(currentAskPrice - pos.entryPrice) > 0.001
        
        if (priceReachedOurLevel || priceChanged) {
          orderFilled = true
          pos.orderStatus = 'FILLED'
          pos.filledAt = new Date()
          console.log(`✅ Ordre REMPLI: ${pos.marketSlug} @ ${pos.limitPrice}`)
        }
        
        // TIMEOUT: Annuler l'ordre après 2 minutes si pas rempli (comme en live)
        if (holdTime > 120000 && !orderFilled) {
          console.log(`❌ Ordre ANNULÉ (timeout): ${pos.marketSlug}`)
          // Ne pas ajouter à updatedPositions = position supprimée
          return
        }
        
        if (!orderFilled) {
          // Ordre toujours en attente
          updatedPositions.push({ ...pos, currentPrice: currentAskPrice, unrealizedPnl: 0 })
          return
        }
      }
      
      // ORDRE REMPLI: calculer le P&L basé sur le prix de sortie ASK
      const currentPrice = currentAskPrice
      // CALCUL CORRECT: size est en $, on doit convertir en tokens
      const tokens = pos.size / pos.entryPrice
      const pnl = (currentPrice - pos.entryPrice) * tokens
      
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
      // FRAIS POLYMARKET SIMULÉS (comme en live):
      // - 2% sur les gains uniquement (pas sur les pertes)
      // - Frais de trading ~0.5% par transaction
      const POLYMARKET_FEE = 0.02 // 2% sur les gains
      const TRADING_FEE = 0.005 // 0.5% par trade (entrée + sortie = 1%)
      
      const grossPnl = pnl
      const tradingFees = pos.size * TRADING_FEE * 2 // Entrée + sortie
      const profitFee = grossPnl > 0 ? grossPnl * POLYMARKET_FEE : 0
      const realPnl = grossPnl - tradingFees - profitFee
      
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
        // CALCUL CORRECT: tokens = size$ / entryPrice
        const tokens = closedPos.size / closedPos.entryPrice
        const profit = (closedPos.currentPrice - closedPos.entryPrice) * tokens
        const returnedValue = closedPos.size + profit // Capital initial + profit
        
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
          wins: profit > 0 ? (prev.wins || 0) + 1 : (prev.wins || 0),
          losses: profit < 0 ? (prev.losses || 0) + 1 : (prev.losses || 0),
        }))
        
        console.log(`📊 Position fermée: ${closedPos.closeReason} | P&L: $${profit.toFixed(2)}`)
        
        // ENVOYER ALERTE TELEGRAM pour les gains
        if (profit > 0) {
          const newBalance = botState.balance + returnedValue
          const openValue = updatedPositions.reduce((sum, p) => sum + (p.size || 0), 0)
          const unrealizedPnl = updatedPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0)
          
          const alertMessage = formatWinAlert({
            profit,
            market: closedPos.marketSlug || closedPos.question || 'Trade',
          }, botState.mode, {
            balance: newBalance,
            openValue,
            unrealizedPnl,
            todayPnl: botState.todayPnl + profit,
            openPositions: updatedPositions.length,
            totalTrades: botState.totalTrades + 1,
            wins: (botState.wins || 0) + 1,
            startingBalance: botState.startingBalance,
          })
          sendTelegramAlert(alertMessage)
        }
      })
    } else {
      setOpenPositions(updatedPositions)
    }
  }, [markets])

  // Charger les vrais marchés Polymarket
  const loadMarkets = useCallback(async () => {
    try {
      const realMarkets = await fetchMarkets(100) // 100 marchés comme les pros
      
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
      // Filtrer pour ne garder que le scalping (pas MM)
      allOpportunities.push(...scalpOpps.filter(o => o.type !== 'MARKET_MAKING'))
    }
    
    // Stratégie D: Market Making
    if (botState.activeStrategies.includes('D')) {
      const mmOpps = detectScalpingOpportunities(markets, previousMarkets)
      // Filtrer pour ne garder que le Market Making
      allOpportunities.push(...mmOpps.filter(o => o.type === 'MARKET_MAKING'))
    }
    
    setOpportunities(allOpportunities.slice(0, 50)) // 50 opportunités pour trader sur plus de marchés
  }, [markets, previousMarkets, botState.activeStrategies])

  // Ref pour éviter les re-renders qui reset l'interval
  const opportunitiesRef = useRef(opportunities)
  const balanceRef = useRef(botState.balance)
  const openPositionsRef = useRef(openPositions)
  
  useEffect(() => {
    opportunitiesRef.current = opportunities
  }, [opportunities])
  
  useEffect(() => {
    balanceRef.current = botState.balance
  }, [botState.balance])
  
  useEffect(() => {
    openPositionsRef.current = openPositions
  }, [openPositions])

  // Exécuter les trades PAPER sur les opportunités détectées
  useEffect(() => {
    if (botState.status !== 'running') return
    if (botState.activeStrategies.length === 0) return
    
    console.log('🚀 Bot démarré - Trading actif')
    
    const tradeInterval = setInterval(async () => {
      const currentOpps = opportunitiesRef.current
      const currentBalance = balanceRef.current
      const currentPositions = openPositionsRef.current
      
      if (!currentOpps || currentOpps.length === 0) {
        console.log('⏳ En attente d\'opportunités...')
        return
      }
      
      // PLUS DE POSITIONS SIMULTANÉES (comme les vrais pros)
      const MAX_OPEN_POSITIONS = 25
      if (currentPositions.length >= MAX_OPEN_POSITIONS) {
        console.log(`⏸️ Max positions atteint (${MAX_OPEN_POSITIONS}), on attend`)
        return
      }
      
      // TROUVER LA PREMIÈRE OPPORTUNITÉ SUR UN MARCHÉ NON OUVERT
      const opp = currentOpps.find(o => 
        !currentPositions.some(p => p.marketId === o.market.id)
      )
      
      if (!opp) {
        console.log('⏭️ Toutes les opportunités ont déjà des positions ouvertes')
        return
      }
      
      console.log('💰 Trade exécuté:', opp.type, opp.signal)
      
      // RÉCUPÉRER LES VRAIS PRIX BID/ASK DE L'ORDERBOOK
      const realPrices = await fetchRealPrices(opp.market)
      
      // MODE LIVE: Passer un vrai ordre sur Polymarket
      const isLive = botState.mode === 'live'
      
      // Position sizing AGRESSIF comme les pros (5-10% par trade)
      const positionPct = opp.positionSize || 0.05 // 5% par défaut
      const tradeSize = Math.min(currentBalance * positionPct, currentBalance * 0.10) // max 10%
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
        isMarketMaking: true,
        // ORDRE LIMIT EN ATTENTE - pas encore rempli
        // Sera rempli quand le vrai prix du marché atteint notre prix
        orderStatus: 'PENDING', // PENDING → FILLED quand le marché atteint notre prix
        limitPrice: entryPrice, // Prix auquel on a placé notre ordre
        // Stop loss et take profit basés sur les vrais prix
        stopLoss: entryPrice * (side === 'YES' ? 0.97 : 1.03), // SL plus serré -3%
        takeProfit: exitAskPrice,
        maxHoldTime: 60000, // 60 secondes max (comme les pros, pas 3 min)
      }
      
      // EN MODE LIVE: Passer le vrai ordre sur Polymarket
      if (isLive) {
        try {
          await executeLiveTrade({
            market: opp.market,
            side,
            action: 'BUY',
            price: entryPrice,
            size: tradeSize,
            isLive: true
          })
          console.log('🔴 LIVE: Ordre réel envoyé à Polymarket')
        } catch (error) {
          console.error('❌ Erreur ordre LIVE:', error)
          return // Ne pas continuer si l'ordre échoue
        }
      }
      
      // Ajouter aux positions ouvertes
      setOpenPositions(prev => [...prev, newPosition])
      
      // Déduire le coût de la balance
      // tradeSize est DÉJÀ en $ (ex: $15 = 5% de $300)
      // Pas besoin de multiplier par le prix!
      setBotState(prev => ({
        ...prev,
        balance: prev.balance - tradeSize,
        openPositions: prev.openPositions + 1,
      }))
      
      // NOTE: On n'ajoute PAS de trade ici - seulement à la fermeture
      // pour éviter les doublons dans la liste des trades
      console.log(`📈 Position ouverte: ${opp.market?.slug?.slice(0, 20)} | ${side} @ ${entryPrice.toFixed(3)}`)
    }, 1000) // Trade chaque seconde (comme les pros - high frequency)
    
    return () => {
      console.log('⏹️ Bot arrêté')
      clearInterval(tradeInterval)
    }
  }, [botState.status, botState.activeStrategies])

  // RÉSUMÉ TELEGRAM PÉRIODIQUE (toutes les 5 minutes)
  useEffect(() => {
    if (botState.status !== 'running') return
    
    // Envoyer un résumé toutes les 5 minutes
    const statusInterval = setInterval(() => {
      // Calculer les stats complètes
      const openValue = openPositions.reduce((sum, p) => sum + (p.size || 0), 0)
      const unrealizedPnl = openPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0)
      
      const statusMessage = formatStatusAlert({
        balance: botState.balance,
        openValue,
        unrealizedPnl,
        todayPnl: botState.todayPnl,
        openPositions: openPositions.length,
        todayTrades: botState.todayTrades,
        totalTrades: botState.totalTrades,
        wins: botState.wins || 0,
        losses: botState.losses || 0,
        startingBalance: botState.startingBalance,
      }, botState.mode)
      
      sendTelegramAlert(statusMessage)
      console.log('📱 Résumé Telegram envoyé')
    }, 5 * 60 * 1000) // 5 minutes
    
    return () => clearInterval(statusInterval)
  }, [botState.status, botState.todayPnl, botState.balance, openPositions])

  // ID PARTAGÉ - Tout le monde voit le même état
  const SHARED_USER_ID = 'polybot_shared'
  
  // PERSISTANCE SUPABASE - Charger UNE SEULE FOIS au démarrage
  const supabaseLoadedRef = useRef(false)
  useEffect(() => {
    if (supabaseLoadedRef.current) return
    supabaseLoadedRef.current = true
    
    loadBotState(SHARED_USER_ID).then(data => {
      if (data) {
        console.log('📥 État chargé depuis Supabase')
        if (data.bot_state) setBotState(prev => ({ ...prev, ...data.bot_state }))
        if (data.open_positions) setOpenPositions(data.open_positions)
        if (data.trades) setTrades(data.trades)
      }
    })
  }, [])
  
  // Sauvegarder périodiquement (séparé du chargement) - ADMIN SEULEMENT
  const botStateRef = useRef(botState)
  const openPositionsRef2 = useRef(openPositions)
  const tradesRef = useRef(trades)
  
  useEffect(() => { botStateRef.current = botState }, [botState])
  useEffect(() => { openPositionsRef2.current = openPositions }, [openPositions])
  useEffect(() => { tradesRef.current = trades }, [trades])
  
  useEffect(() => {
    if (isAdmin) {
      // Admin sauvegarde toutes les 30s
      const saveInterval = setInterval(() => {
        saveBotState(SHARED_USER_ID, botStateRef.current, openPositionsRef2.current, tradesRef.current)
        console.log('💾 État sauvegardé dans Supabase')
      }, 30000)
      
      const handleBeforeUnload = () => {
        saveBotState(SHARED_USER_ID, botStateRef.current, openPositionsRef2.current, tradesRef.current)
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      
      return () => {
        clearInterval(saveInterval)
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    } else {
      // Viewer recharge toutes les 10s pour voir les updates
      const refreshInterval = setInterval(() => {
        loadBotState(SHARED_USER_ID).then(data => {
          if (data) {
            if (data.bot_state) setBotState(prev => ({ ...prev, ...data.bot_state }))
            if (data.open_positions) setOpenPositions(data.open_positions)
            if (data.trades) setTrades(data.trades)
            console.log('🔄 État rafraîchi depuis Supabase')
          }
        })
      }, 10000) // 10 secondes
      
      return () => clearInterval(refreshInterval)
    }
  }, [isAdmin])

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
    localStorage.removeItem('polybot_role')
    setIsAuthenticated(false)
    setUserRole('viewer')
  }

  // Écran de login si non authentifié
  if (!isAuthenticated) {
    return <LoginScreen onLogin={(role) => {
      setIsAuthenticated(true)
      setUserRole(role || 'viewer')
    }} />
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
              isAdmin={isAdmin}
            />
            <MarketsPanel markets={markets} />
          </div>

          {/* Colonne centrale - Stratégies, Opportunités et Trades */}
          <div className="lg:col-span-6 space-y-4">
            <StrategiesPanel 
              botState={botState} 
              toggleStrategy={toggleStrategy}
              isAdmin={isAdmin}
            />
            <OpportunitiesPanel opportunities={opportunities} />
            <StrategyAnalytics trades={trades} openPositions={openPositions} />
            <TradesHistory trades={trades} />
          </div>

          {/* Colonne droite - P&L et Paramètres */}
          <div className="lg:col-span-3 space-y-4">
            {/* P&L Card - Le plus important */}
            <PnLCard botState={botState} trades={trades} openPositions={openPositions} />
            
            {/* Paramètres - Admin seulement */}
            {isAdmin && (
              <SettingsPanel 
                botState={botState} 
                setBotState={setBotState}
                onReset={resetStats}
              />
            )}
            
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
