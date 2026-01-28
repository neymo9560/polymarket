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

// Template court pour les trades gagnants
export function formatWinAlert(trade, mode, balance) {
  const modeEmoji = mode === 'live' ? '🔴 LIVE' : '📄 PAPER'
  const profit = trade.profit >= 0 ? `+$${trade.profit.toFixed(2)}` : `-$${Math.abs(trade.profit).toFixed(2)}`
  const balanceStr = balance ? `\n💼 $${balance.toFixed(2)}` : ''
  
  return `${modeEmoji}
💰 ${profit}${balanceStr}
${trade.market}
${trade.side} @ ${trade.price}`
}

// Template pour les pertes (optionnel)
export function formatLossAlert(trade, mode) {
  const modeEmoji = mode === 'live' ? '🔴 LIVE' : '📄 PAPER'
  const loss = `−$${Math.abs(trade.profit).toFixed(2)}`
  
  return `${modeEmoji}
❌ ${loss}
${trade.market}`
}

// Alerte résumé journalier
export function formatDailySummary(stats, mode) {
  const modeEmoji = mode === 'live' ? '🔴 LIVE' : '📄 PAPER'
  const pnl = stats.totalPnl >= 0 ? `+$${stats.totalPnl.toFixed(2)}` : `-$${Math.abs(stats.totalPnl).toFixed(2)}`
  
  return `${modeEmoji} RÉSUMÉ
${pnl} | ${stats.wins}W/${stats.losses}L
Balance: $${stats.balance.toFixed(2)}`
}

export default {
  sendTelegramAlert,
  formatWinAlert,
  formatLossAlert,
  formatDailySummary,
}
