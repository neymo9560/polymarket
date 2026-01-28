import { Activity, Wifi, WifiOff, Zap } from 'lucide-react'

export default function Header({ botState, wsConnected }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD' }).format(value)
  }

  return (
    <header className="bg-hl-card border-b border-hl-border px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Logo et titre */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-hl-blue" />
            <span className="text-xl font-bold">PolyBot</span>
          </div>
          <span className="text-hl-text-muted text-sm">|</span>
          <span className="text-sm text-hl-text-secondary">
            Bot HFT Polymarket
          </span>
        </div>

        {/* Informations centrales */}
        <div className="flex items-center gap-8">
          {/* Solde */}
          <div className="text-center">
            <div className="text-xxs text-hl-text-muted uppercase tracking-wider">
              Solde Total
            </div>
            <div className="text-lg font-mono font-semibold">
              {formatCurrency(botState.balance)}
            </div>
          </div>

          {/* PnL Aujourd'hui */}
          <div className="text-center">
            <div className="text-xxs text-hl-text-muted uppercase tracking-wider">
              PnL Aujourd'hui
            </div>
            <div className={`text-lg font-mono font-semibold ${botState.todayPnl >= 0 ? 'text-hl-green' : 'text-hl-red'}`}>
              {botState.todayPnl >= 0 ? '+' : ''}{formatCurrency(botState.todayPnl)}
            </div>
          </div>

          {/* Positions ouvertes */}
          <div className="text-center">
            <div className="text-xxs text-hl-text-muted uppercase tracking-wider">
              Positions
            </div>
            <div className="text-lg font-mono font-semibold">
              {botState.openPositions}
            </div>
          </div>

          {/* Trades aujourd'hui */}
          <div className="text-center">
            <div className="text-xxs text-hl-text-muted uppercase tracking-wider">
              Trades
            </div>
            <div className="text-lg font-mono font-semibold">
              {botState.todayTrades}
            </div>
          </div>
        </div>

        {/* Statuts à droite */}
        <div className="flex items-center gap-4">
          {/* Mode */}
          <div className={`px-3 py-1 rounded text-xs font-medium ${
            botState.mode === 'paper'
              ? 'bg-hl-yellow bg-opacity-20 text-hl-yellow'
              : 'bg-hl-green bg-opacity-20 text-hl-green'
          }`}>
            {botState.mode === 'paper' ? 'PAPER' : 'LIVE'}
          </div>

          {/* Statut du bot */}
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${
              botState.status === 'running' ? 'text-hl-green' : 'text-hl-text-muted'
            }`} />
            <span className={`text-sm ${
              botState.status === 'running' ? 'text-hl-green' : 'text-hl-text-muted'
            }`}>
              {botState.status === 'running' ? 'Actif' : 'Arrêté'}
            </span>
          </div>

          {/* Connexion WebSocket */}
          <div className="flex items-center gap-1">
            {wsConnected ? (
              <Wifi className="w-4 h-4 text-hl-green" />
            ) : (
              <WifiOff className="w-4 h-4 text-hl-red" />
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
