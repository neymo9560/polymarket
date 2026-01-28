import { Zap, Target, TrendingDown, BarChart } from 'lucide-react'

const typeIcons = {
  'ARBITRAGE': Target,
  'LOW': TrendingDown,
  'SCALP': Zap,
  'MM': BarChart,
}

const typeColors = {
  'ARBITRAGE': 'hl-cyan',
  'LOW': 'hl-purple',
  'SCALP': 'hl-yellow',
  'MM': 'hl-blue',
}

export default function OpportunitiesPanel({ opportunities, onExecute }) {
  if (opportunities.length === 0) {
    return (
      <div className="hl-card p-4">
        <h3 className="text-sm font-semibold text-hl-text-secondary mb-4 uppercase tracking-wider">
          Opportunités Détectées
        </h3>
        <div className="text-center py-8 text-hl-text-muted">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Aucune opportunité détectée</p>
          <p className="text-xs mt-1">Activez des stratégies et démarrez le bot</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hl-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-hl-text-secondary uppercase tracking-wider">
          Opportunités Détectées
        </h3>
        <span className="text-xs text-hl-green font-mono">
          {opportunities.length} actives
        </span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {opportunities.map((opp, idx) => {
          const stratType = opp.type.split('_')[0]
          const Icon = typeIcons[stratType] || Zap
          const color = typeColors[stratType] || 'hl-blue'

          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border border-hl-border bg-hl-card-light hover:bg-hl-hover transition-colors`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 text-${color}`} />
                  <span className={`text-xs font-medium text-${color}`}>
                    {opp.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div 
                    className="h-1.5 rounded-full bg-hl-border"
                    style={{ width: '40px' }}
                  >
                    <div 
                      className="h-full rounded-full bg-hl-green"
                      style={{ width: `${opp.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xxs text-hl-text-muted">
                    {(opp.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="text-sm font-medium mb-1 truncate">
                {opp.market.question?.slice(0, 60)}...
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-hl-text-muted">{opp.signal}</span>
                <div className="flex items-center gap-2">
                  <span className="text-hl-green font-mono">
                    +{opp.expectedProfit.toFixed(2)}%
                  </span>
                  <span className={`font-medium ${
                    opp.action.includes('YES') ? 'text-hl-green' : 'text-hl-red'
                  }`}>
                    {opp.action.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex gap-2 text-xxs">
                <span className="px-1.5 py-0.5 rounded bg-hl-border text-hl-text-secondary">
                  YES: {(opp.market.yesPrice * 100).toFixed(1)}%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-hl-border text-hl-text-secondary">
                  NO: {(opp.market.noPrice * 100).toFixed(1)}%
                </span>
                <span className="px-1.5 py-0.5 rounded bg-hl-border text-hl-text-secondary">
                  Vol: ${(opp.market.volume24h / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
