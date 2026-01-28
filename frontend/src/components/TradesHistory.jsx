export default function TradesHistory({ trades }) {
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="hl-card p-4">
      <h3 className="text-sm font-semibold text-hl-text-secondary mb-4 uppercase tracking-wider">
        Historique des Trades
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-hl-text-muted text-xs uppercase">
              <th className="pb-3 pr-4">Heure</th>
              <th className="pb-3 pr-4">Marché</th>
              <th className="pb-3 pr-4">Stratégie</th>
              <th className="pb-3 pr-4">Side</th>
              <th className="pb-3 pr-4 text-right">Prix</th>
              <th className="pb-3 pr-4 text-right">Taille</th>
              <th className="pb-3 text-right">P&L</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-hl-text-muted">
                  Aucun trade. Démarrez le bot pour commencer.
                </td>
              </tr>
            ) : (
              trades.slice(0, 15).map((trade) => (
                <tr 
                  key={trade.id} 
                  className="border-t border-hl-border hover:bg-hl-hover"
                >
                  <td className="py-2 pr-4 font-mono text-xs text-hl-text-muted">
                    {formatTime(trade.timestamp)}
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    {trade.market}
                  </td>
                  <td className="py-2 pr-4">
                    <span className="hl-badge-blue">
                      {trade.strategy}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={trade.side === 'YES' ? 'text-hl-green' : 'text-hl-red'}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    ${trade.price}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    ${trade.size}
                  </td>
                  <td className={`py-2 text-right font-mono font-medium ${
                    trade.profit >= 0 ? 'text-hl-green' : 'text-hl-red'
                  }`}>
                    {trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(3)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
