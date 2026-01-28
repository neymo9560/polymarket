import { useMemo } from 'react'

// Mapping des codes stratégies vers noms lisibles
const STRATEGY_NAMES = {
  'ARB': { name: 'Arbitrage', icon: '⚡', color: 'hl-purple' },
  'SCALP': { name: 'Scalping', icon: '🎯', color: 'hl-blue' },
  'MM': { name: 'Market Making', icon: '📊', color: 'hl-green' },
  'LOWPROB': { name: 'Low Probability', icon: '🎲', color: 'hl-yellow' },
  'TRADE': { name: 'Trading', icon: '💹', color: 'hl-cyan' },
  'MOMENTUM': { name: 'Momentum', icon: '🚀', color: 'hl-orange' },
  'VALUE': { name: 'Value Betting', icon: '💎', color: 'hl-pink' },
}

function StrategyAnalytics({ trades, openPositions }) {
  // Analyser les trades par stratégie
  const strategyStats = useMemo(() => {
    const stats = {}
    
    // Initialiser toutes les stratégies connues
    Object.keys(STRATEGY_NAMES).forEach(code => {
      stats[code] = {
        code,
        ...STRATEGY_NAMES[code],
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        avgPnl: 0,
        winRate: 0,
        openPositions: 0,
        unrealizedPnl: 0,
      }
    })
    
    // Compter les trades fermés
    trades.forEach(trade => {
      const code = trade.strategy?.toUpperCase() || 'TRADE'
      if (!stats[code]) {
        stats[code] = {
          code,
          name: code,
          icon: '📈',
          color: 'hl-text',
          totalTrades: 0,
          wins: 0,
          losses: 0,
          totalPnl: 0,
          avgPnl: 0,
          winRate: 0,
          openPositions: 0,
          unrealizedPnl: 0,
        }
      }
      
      if (trade.status === 'CLOSED' || trade.profit !== null) {
        stats[code].totalTrades++
        const profit = parseFloat(trade.profit) || 0
        stats[code].totalPnl += profit
        
        if (profit > 0) {
          stats[code].wins++
        } else if (profit < 0) {
          stats[code].losses++
        }
      }
    })
    
    // Compter les positions ouvertes
    openPositions.forEach(pos => {
      const code = pos.strategy?.toUpperCase() || 'TRADE'
      if (stats[code]) {
        stats[code].openPositions++
        stats[code].unrealizedPnl += pos.unrealizedPnl || 0
      }
    })
    
    // Calculer les moyennes et winrates
    Object.values(stats).forEach(s => {
      if (s.totalTrades > 0) {
        s.avgPnl = s.totalPnl / s.totalTrades
        s.winRate = (s.wins / s.totalTrades) * 100
      }
    })
    
    // Trier par P&L total décroissant
    return Object.values(stats)
      .filter(s => s.totalTrades > 0 || s.openPositions > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)
  }, [trades, openPositions])

  // Totaux globaux
  const totals = useMemo(() => {
    return strategyStats.reduce((acc, s) => ({
      trades: acc.trades + s.totalTrades,
      wins: acc.wins + s.wins,
      losses: acc.losses + s.losses,
      pnl: acc.pnl + s.totalPnl,
      openPositions: acc.openPositions + s.openPositions,
      unrealizedPnl: acc.unrealizedPnl + s.unrealizedPnl,
    }), { trades: 0, wins: 0, losses: 0, pnl: 0, openPositions: 0, unrealizedPnl: 0 })
  }, [strategyStats])

  const globalWinRate = totals.trades > 0 ? (totals.wins / totals.trades) * 100 : 0

  return (
    <div className="bg-hl-card border border-hl-border rounded-lg p-4">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        📊 Analyse par Stratégie
      </h2>

      {/* Résumé global */}
      <div className="bg-gradient-to-r from-hl-purple/20 to-hl-green/10 p-3 rounded-lg mb-4 border border-hl-purple/30">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <p className="text-hl-text-muted">Total Trades</p>
            <p className="text-white font-bold text-lg">{totals.trades}</p>
          </div>
          <div>
            <p className="text-hl-text-muted">Win Rate</p>
            <p className={`font-bold text-lg ${globalWinRate >= 50 ? 'text-hl-green' : 'text-hl-red'}`}>
              {globalWinRate.toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-hl-text-muted">P&L Réalisé</p>
            <p className={`font-bold text-lg ${totals.pnl >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
              {totals.pnl >= 0 ? '+' : ''}{totals.pnl.toFixed(2)}$
            </p>
          </div>
          <div>
            <p className="text-hl-text-muted">Non Réalisé</p>
            <p className={`font-bold text-lg ${totals.unrealizedPnl >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
              {totals.unrealizedPnl >= 0 ? '+' : ''}{totals.unrealizedPnl.toFixed(2)}$
            </p>
          </div>
        </div>
      </div>

      {/* Tableau des stratégies */}
      <div className="space-y-2">
        {strategyStats.length === 0 ? (
          <p className="text-hl-text-muted text-center py-4">Aucun trade encore</p>
        ) : (
          strategyStats.map(strategy => (
            <div 
              key={strategy.code}
              className="bg-hl-bg/50 border border-hl-border rounded-lg p-3 hover:border-hl-purple/50 transition-colors"
            >
              {/* Header stratégie */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{strategy.icon}</span>
                  <span className="font-semibold text-white">{strategy.name}</span>
                  <span className="text-xs text-hl-text-muted">({strategy.code})</span>
                </div>
                <div className={`text-lg font-bold ${strategy.totalPnl >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
                  {strategy.totalPnl >= 0 ? '+' : ''}{strategy.totalPnl.toFixed(2)}$
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-2 text-xs">
                <div className="text-center">
                  <p className="text-hl-text-muted">Trades</p>
                  <p className="text-white font-mono">{strategy.totalTrades}</p>
                </div>
                <div className="text-center">
                  <p className="text-hl-text-muted">W / L</p>
                  <p className="font-mono">
                    <span className="text-hl-green">{strategy.wins}</span>
                    <span className="text-hl-text-muted"> / </span>
                    <span className="text-hl-red">{strategy.losses}</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-hl-text-muted">Win Rate</p>
                  <p className={`font-mono ${strategy.winRate >= 50 ? 'text-hl-green' : 'text-hl-red'}`}>
                    {strategy.winRate.toFixed(0)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-hl-text-muted">Avg P&L</p>
                  <p className={`font-mono ${strategy.avgPnl >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
                    {strategy.avgPnl >= 0 ? '+' : ''}{strategy.avgPnl.toFixed(2)}$
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-hl-text-muted">Ouvertes</p>
                  <p className="text-hl-yellow font-mono">{strategy.openPositions}</p>
                </div>
              </div>

              {/* Barre de progression Win Rate */}
              <div className="mt-2">
                <div className="h-1.5 bg-hl-bg rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${strategy.winRate >= 50 ? 'bg-hl-green' : 'bg-hl-red'}`}
                    style={{ width: `${Math.min(strategy.winRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recommandation */}
      {strategyStats.length > 0 && (
        <div className="mt-4 p-3 bg-hl-bg/30 rounded-lg border border-hl-border">
          <p className="text-xs text-hl-text-muted mb-1">💡 Recommandation</p>
          {(() => {
            const best = strategyStats[0]
            const worst = strategyStats[strategyStats.length - 1]
            if (best && worst && best.code !== worst.code) {
              return (
                <p className="text-sm text-white">
                  <span className="text-hl-green">✅ Garde {best.name}</span>
                  {worst.totalPnl < 0 && (
                    <span className="text-hl-red ml-2">❌ Considère retirer {worst.name}</span>
                  )}
                </p>
              )
            }
            return <p className="text-sm text-white">Continue à collecter des données...</p>
          })()}
        </div>
      )}
    </div>
  )
}

export default StrategyAnalytics
