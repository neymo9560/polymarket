import { Target, Dice1, Zap, BarChart3 } from 'lucide-react'

const strategies = [
  {
    code: 'A',
    name: 'Arbitrage Binaire',
    description: 'Hedge YES/NO misprices',
    style: 'gabagool',
    icon: Target,
    color: 'hl-cyan',
  },
  {
    code: 'B',
    name: 'Low-Prob NO',
    description: 'Buy NO sur quasi-impossible',
    style: 'swisstony',
    icon: Dice1,
    color: 'hl-purple',
  },
  {
    code: 'C',
    name: 'Scalping 15-min',
    description: '10k+ trades/mois',
    style: 'Theo4',
    icon: Zap,
    color: 'hl-yellow',
  },
  {
    code: 'D',
    name: 'Market Making',
    description: 'Place mirrored spreads',
    style: 'LP',
    icon: BarChart3,
    color: 'hl-blue',
  },
]

export default function StrategiesPanel({ botState, toggleStrategy }) {
  return (
    <div className="hl-card p-4">
      <h3 className="text-sm font-semibold text-hl-text-secondary mb-4 uppercase tracking-wider">
        Stratégies Top Performers 2026
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {strategies.map((strategy) => {
          const isActive = botState.activeStrategies.includes(strategy.code)
          const Icon = strategy.icon

          return (
            <button
              key={strategy.code}
              onClick={() => toggleStrategy(strategy.code)}
              className={`p-4 rounded-lg border transition-all text-left ${
                isActive
                  ? `border-${strategy.color} bg-${strategy.color} bg-opacity-10`
                  : 'border-hl-border hover:bg-hl-hover'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <Icon className={`w-5 h-5 ${isActive ? `text-${strategy.color}` : 'text-hl-text-muted'}`} />
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-hl-green' : 'bg-hl-text-muted'}`} />
              </div>
              
              <div className="font-medium text-sm mb-0.5">{strategy.name}</div>
              <div className="text-xs text-hl-text-muted mb-1">{strategy.description}</div>
              <div className="text-xxs text-hl-text-muted">style {strategy.style}</div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-hl-border">
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div>
            <div className="text-hl-text-muted">Arb</div>
            <div className="font-mono text-hl-green">+2.3%</div>
          </div>
          <div>
            <div className="text-hl-text-muted">Low-P</div>
            <div className="font-mono text-hl-green">+1.8%</div>
          </div>
          <div>
            <div className="text-hl-text-muted">Scalp</div>
            <div className="font-mono text-hl-red">-0.5%</div>
          </div>
          <div>
            <div className="text-hl-text-muted">MM</div>
            <div className="font-mono text-hl-green">+0.9%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
