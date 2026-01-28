import { ExternalLink } from 'lucide-react'

export default function MarketsPanel({ markets }) {
  const formatVolume = (vol) => {
    if (!vol) return '$0'
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}k`
    return `$${vol.toFixed(0)}`
  }

  return (
    <div className="hl-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-hl-text-secondary uppercase tracking-wider">
          Marchés Polymarket Live
        </h3>
        <span className="text-xxs text-hl-green font-mono animate-pulse">● LIVE</span>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {markets.length === 0 ? (
          <div className="text-center py-8 text-hl-text-muted text-sm">
            Chargement des marchés...
          </div>
        ) : (
          markets.slice(0, 15).map((market) => (
            <a
              key={market.id}
              href={market.slug ? `https://polymarket.com/event/${market.slug}` : `https://polymarket.com`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded bg-hl-card-light hover:bg-hl-hover transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-hl-text-muted mb-1">
                    {market.category || 'Other'}
                  </div>
                  <div className="text-sm font-medium truncate group-hover:text-hl-blue transition-colors">
                    {market.question?.slice(0, 50)}{market.question?.length > 50 ? '...' : ''}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-hl-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xxs text-hl-text-muted">YES</span>
                    <span className="text-sm font-mono text-hl-green font-medium">
                      {typeof market.yesPrice === 'number' && !isNaN(market.yesPrice) 
                        ? `${(market.yesPrice * 100).toFixed(0)}¢` 
                        : '50¢'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xxs text-hl-text-muted">NO</span>
                    <span className="text-sm font-mono text-hl-red font-medium">
                      {typeof market.noPrice === 'number' && !isNaN(market.noPrice) 
                        ? `${(market.noPrice * 100).toFixed(0)}¢` 
                        : '50¢'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-hl-text-muted">
                  {formatVolume(market.volume24h || market.volume || 0)}
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
