import { TrendingUp, TrendingDown, Activity, DollarSign } from 'lucide-react'

export default function PerformancePanel({ botState, trades }) {
  const winTrades = trades.filter(t => t.profit >= 0).length
  const loseTrades = trades.filter(t => t.profit < 0).length
  const winRate = trades.length > 0 ? ((winTrades / trades.length) * 100).toFixed(1) : 0
  
  const totalProfit = trades.reduce((sum, t) => sum + (t.profit >= 0 ? t.profit : 0), 0)
  const totalLoss = trades.reduce((sum, t) => sum + (t.profit < 0 ? Math.abs(t.profit) : 0), 0)
  const profitFactor = totalLoss > 0 ? (totalProfit / totalLoss).toFixed(2) : '∞'

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(value)
  }

  return (
    <div className="hl-card p-4">
      <h3 className="text-sm font-semibold text-hl-text-secondary mb-4 uppercase tracking-wider">
        Performance
      </h3>

      <div className="space-y-4">
        {/* PnL Total */}
        <div className="p-3 rounded bg-hl-card-light">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-hl-text-muted">PnL Total</span>
            {botState.totalPnl >= 0 ? (
              <TrendingUp className="w-4 h-4 text-hl-green" />
            ) : (
              <TrendingDown className="w-4 h-4 text-hl-red" />
            )}
          </div>
          <div className={`text-2xl font-mono font-bold ${
            botState.totalPnl >= 0 ? 'text-hl-green' : 'text-hl-red'
          }`}>
            {botState.totalPnl >= 0 ? '+' : ''}{formatCurrency(botState.totalPnl)}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded bg-hl-card-light">
            <div className="text-xs text-hl-text-muted mb-1">Win Rate</div>
            <div className="text-lg font-mono font-semibold text-hl-green">
              {winRate}%
            </div>
          </div>
          <div className="p-3 rounded bg-hl-card-light">
            <div className="text-xs text-hl-text-muted mb-1">Profit Factor</div>
            <div className="text-lg font-mono font-semibold">
              {profitFactor}
            </div>
          </div>
          <div className="p-3 rounded bg-hl-card-light">
            <div className="text-xs text-hl-text-muted mb-1">Trades Win</div>
            <div className="text-lg font-mono font-semibold text-hl-green">
              {winTrades}
            </div>
          </div>
          <div className="p-3 rounded bg-hl-card-light">
            <div className="text-xs text-hl-text-muted mb-1">Trades Lose</div>
            <div className="text-lg font-mono font-semibold text-hl-red">
              {loseTrades}
            </div>
          </div>
        </div>

        {/* Balance Evolution */}
        <div className="pt-4 border-t border-hl-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-hl-text-muted">Balance</span>
            <DollarSign className="w-4 h-4 text-hl-blue" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-mono font-bold">
              {formatCurrency(botState.balance)}
            </span>
            <span className={`text-xs ${
              botState.balance >= botState.startingBalance ? 'text-hl-green' : 'text-hl-red'
            }`}>
              {botState.balance >= botState.startingBalance ? '+' : ''}
              {((botState.balance - botState.startingBalance) / botState.startingBalance * 100).toFixed(2)}%
            </span>
          </div>
          <div className="text-xs text-hl-text-muted mt-1">
            Capital initial: {formatCurrency(botState.startingBalance)}
          </div>
        </div>

        {/* Session Info */}
        <div className="pt-4 border-t border-hl-border text-xs text-hl-text-muted">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3 h-3" />
            <span>Session active</span>
          </div>
          <div>Total trades: {botState.totalTrades}</div>
        </div>
      </div>
    </div>
  )
}
