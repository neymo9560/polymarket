import { TrendingUp, TrendingDown, Wallet, Target, Zap } from 'lucide-react'

export default function PnLCard({ botState, trades, openPositions = [] }) {
  // Calculs P&L RÉALISÉ (trades fermés)
  const closedTrades = trades.filter(t => t.profit !== null)
  const realizedPnL = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0)
  const winTrades = closedTrades.filter(t => t.profit > 0).length
  const loseTrades = closedTrades.filter(t => t.profit < 0).length
  const winRate = closedTrades.length > 0 ? (winTrades / closedTrades.length * 100) : 0
  
  // Calculs P&L NON RÉALISÉ (positions ouvertes)
  const unrealizedPnL = openPositions.reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0)
  const totalOpenPositions = openPositions.length
  const totalOpenValue = openPositions.reduce((sum, p) => sum + (p.size || 0), 0)
  
  // P&L TOTAL = réalisé + non réalisé
  const totalPnL = realizedPnL + unrealizedPnL
  
  // ROI
  const roi = botState.startingBalance > 0 
    ? ((botState.balance - botState.startingBalance + unrealizedPnL) / botState.startingBalance * 100)
    : 0

  const isProfit = totalPnL >= 0

  return (
    <div className="hl-card p-6">
      {/* P&L Principal */}
      <div className="text-center mb-6">
        <p className="text-xs text-hl-text-muted uppercase tracking-wider mb-1">
          Profit & Loss Total
        </p>
        <div className={`text-4xl font-bold ${isProfit ? 'text-hl-green' : 'text-hl-red'}`}>
          {isProfit ? '+' : ''}{totalPnL.toFixed(2)} $
        </div>
        <div className={`text-sm mt-1 ${roi >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
          {roi >= 0 ? '▲' : '▼'} {Math.abs(roi).toFixed(2)}% ROI
        </div>
      </div>

      {/* Solde actuel */}
      <div className="bg-gradient-to-r from-hl-green/10 to-transparent p-4 rounded-lg mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-hl-green/20 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-hl-green" />
            </div>
            <div>
              <p className="text-xs text-hl-text-muted">Solde actuel</p>
              <p className="text-xl font-bold text-white">${botState.balance.toFixed(2)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-hl-text-muted">Capital initial</p>
            <p className="text-sm text-hl-text-secondary">${botState.startingBalance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-hl-card-secondary p-3 rounded-lg text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Target className="w-3 h-3 text-hl-green" />
            <span className="text-xs text-hl-text-muted">Win Rate</span>
          </div>
          <p className="text-lg font-bold text-white">{winRate.toFixed(0)}%</p>
        </div>
        
        <div className="bg-hl-card-secondary p-3 rounded-lg text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3 text-hl-green" />
            <span className="text-xs text-hl-text-muted">Gagnés</span>
          </div>
          <p className="text-lg font-bold text-hl-green">{winTrades}</p>
        </div>
        
        <div className="bg-hl-card-secondary p-3 rounded-lg text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className="w-3 h-3 text-hl-red" />
            <span className="text-xs text-hl-text-muted">Perdus</span>
          </div>
          <p className="text-lg font-bold text-hl-red">{loseTrades}</p>
        </div>
      </div>

      {/* POSITIONS OUVERTES + P&L NON RÉALISÉ */}
      <div className="mt-4 p-3 rounded-lg bg-hl-card-secondary border border-hl-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-hl-yellow" />
            <span className="text-sm text-hl-text-secondary">Positions ouvertes</span>
          </div>
          <span className="text-lg font-bold text-white">{totalOpenPositions}</span>
        </div>
        
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-hl-text-muted">Valeur totale</span>
          <span className="text-sm font-mono text-white">${totalOpenValue.toFixed(2)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-hl-text-muted">P&L non réalisé</span>
          <span className={`text-sm font-bold font-mono ${unrealizedPnL >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
            {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)} $
          </span>
        </div>
      </div>
      
      {/* P&L Réalisé */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-hl-text-muted">P&L réalisé (fermés)</span>
        <span className={`font-mono ${realizedPnL >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
          {realizedPnL >= 0 ? '+' : ''}{realizedPnL.toFixed(2)} $
        </span>
      </div>
    </div>
  )
}
