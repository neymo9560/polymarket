// ============================================================
// ALERTES TELEGRAM
// Envoie des notifications pour les trades gagnants
// ============================================================

const API_URL = import.meta.env.VITE_API_URL || 'https://neymopoly.up.railway.app'

// Envoyer une alerte Telegram via le backend
export async function sendTelegramAlert(message) {
  try {
    const response = await fetch(`${API_URL}/api/telegram/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    })
    
    if (!response.ok) {
      console.warn('Telegram alert non envoyée')
      return false
    }
    
    return true
  } catch (error) {
    console.warn('Erreur envoi Telegram:', error)
    return false
  }
}

// ============================================================
// TEMPLATES TELEGRAM - JOLIS ET EN FRANÇAIS
// ============================================================

// Template pour un trade gagnant
export function formatWinAlert(trade, mode, balance, stats = {}) {
  const header = mode === 'live' ? '🔴 RÉEL' : '� PAPER'
  const profit = `+${trade.profit.toFixed(2)}$`
  
  return `━━━━━━━━━━━━━━━
${header} │ GAIN 💰
━━━━━━━━━━━━━━━
✅ ${profit}
📊 ${trade.market?.slice(0, 25)}
💼 Solde: ${balance?.toFixed(2) || '---'}$
━━━━━━━━━━━━━━━`
}

// Template résumé avec P&L réalisé ET non réalisé
export function formatStatusAlert(stats, mode) {
  const header = mode === 'live' ? '🔴 RÉEL' : '🟢 PAPER'
  const realizedPnl = stats.todayPnl >= 0 ? `+${stats.todayPnl.toFixed(2)}` : `${stats.todayPnl.toFixed(2)}`
  const unrealizedPnl = stats.unrealizedPnl >= 0 ? `+${stats.unrealizedPnl.toFixed(2)}` : `${stats.unrealizedPnl.toFixed(2)}`
  const totalPnl = stats.todayPnl + stats.unrealizedPnl
  const totalStr = totalPnl >= 0 ? `+${totalPnl.toFixed(2)}` : `${totalPnl.toFixed(2)}`
  
  return `━━━━━━━━━━━━━━━
${header} │ RÉSUMÉ 📈
━━━━━━━━━━━━━━━
💰 Réalisé: ${realizedPnl}$
📊 En cours: ${unrealizedPnl}$
📈 Total: ${totalStr}$
━━━━━━━━━━━━━━━
💼 Solde: ${stats.balance?.toFixed(2) || '---'}$
🎯 Positions: ${stats.openPositions || 0}
📊 Trades: ${stats.todayTrades || 0}
━━━━━━━━━━━━━━━`
}

// Template pour perte (optionnel)
export function formatLossAlert(trade, mode, balance) {
  const header = mode === 'live' ? '🔴 RÉEL' : '� PAPER'
  const loss = `-${Math.abs(trade.profit).toFixed(2)}$`
  
  return `━━━━━━━━━━━━━━━
${header} │ PERTE 📉
━━━━━━━━━━━━━━━
❌ ${loss}
📊 ${trade.market?.slice(0, 25)}
💼 Solde: ${balance?.toFixed(2) || '---'}$
━━━━━━━━━━━━━━━`
}

// Résumé journalier
export function formatDailySummary(stats, mode) {
  const header = mode === 'live' ? '🔴 RÉEL' : '� PAPER'
  const pnl = stats.totalPnl >= 0 ? `+${stats.totalPnl.toFixed(2)}` : `${stats.totalPnl.toFixed(2)}`
  const winRate = stats.totalTrades > 0 ? ((stats.wins / stats.totalTrades) * 100).toFixed(0) : 0
  
  return `━━━━━━━━━━━━━━━
${header} │ FIN DE JOURNÉE 🌙
━━━━━━━━━━━━━━━
💰 P&L: ${pnl}$
📊 ${stats.wins}W / ${stats.losses}L (${winRate}%)
💼 Solde: ${stats.balance.toFixed(2)}$
━━━━━━━━━━━━━━━`
}

export default {
  sendTelegramAlert,
  formatWinAlert,
  formatLossAlert,
  formatDailySummary,
  formatStatusAlert,
}
