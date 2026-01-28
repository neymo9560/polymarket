import { TrendingUp, TrendingDown, Wallet, Target, Zap } from 'lucide-react'

export default function PnLCard({ botState, trades }) {
  // Calculs P&L
  const closedTrades = trades.filter(t => t.profit !== null)
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.profit || 0), 0)
  const winTrades = closedTrades.filter(t => t.profit > 0).length
  const loseTrades = closedTrades.filter(t => t.profit < 0).length
  const winRate = closedTrades.length > 0 ? (winTrades / closedTrades.length * 100) : 0
  const openTrades = trades.filter(t => t.profit === null).length
  
  // ROI
  const roi = botState.startingBalance > 0 
    ? ((botState.balance - botState.startingBalance) / botState.startingBalance * 100)
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

      {/* Trades ouverts */}
      {openTrades > 0 && (
        <div className="mt-4 p-3 rounded-lg bg-hl-yellow/10 border border-hl-yellow/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-hl-yellow" />
              <span className="text-sm text-hl-yellow">Positions ouvertes</span>
            </div>
            <span className="text-lg font-bold text-hl-yellow">{openTrades}</span>
          </div>
        </div>
      )}
    </div>
  )
}
