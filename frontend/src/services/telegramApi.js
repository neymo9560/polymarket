// ============================================================
// ALERTES TELEGRAM
// Envoie des notifications pour les trades gagnants
// ============================================================

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

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
// 🚀 TEMPLATES TELEGRAM ULTRA PREMIUM
// Design clair, complet, même une normie comprend
// ============================================================

// Helper: formatage des nombres
const fmt = (n, decimals = 2) => {
  if (n === null || n === undefined || isNaN(n)) return '---'
  return n.toFixed(decimals)
}

const fmtPnl = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '---'
  return n >= 0 ? `+${fmt(n)}` : fmt(n)
}

const progressBar = (percent, length = 10) => {
  const filled = Math.round((percent / 100) * length)
  const empty = length - filled
  return '▓'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty))
}

// 🎉 TRADE GAGNANT - Alerte instantanée
export function formatWinAlert(trade, mode, stats = {}) {
  const modeIcon = mode === 'live' ? '🔴' : '🟢'
  const modeName = mode === 'live' ? 'RÉEL' : 'PAPER'
  
  // Calculs
  const profit = trade.profit || 0
  const availableBalance = stats.balance || 0
  const openValue = stats.openValue || 0
  const unrealizedPnl = stats.unrealizedPnl || 0
  const totalPortfolio = availableBalance + openValue + unrealizedPnl
  const todayPnl = stats.todayPnl || 0
  const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100) : 0
  
  return `
${modeIcon} ${modeName} ━━━━━━━━━━━━━━━

💰 𝗚𝗔𝗜𝗡: ${fmtPnl(profit)}$
📊 ${trade.market?.slice(0, 30) || 'Trade'}

━━━━━ 𝗣𝗢𝗥𝗧𝗘𝗙𝗘𝗨𝗜𝗟𝗟𝗘 ━━━━━

� 𝗧𝗼𝘁𝗮𝗹: ${fmt(totalPortfolio)}$
   ├ 💵 Dispo: ${fmt(availableBalance)}$
   ├ 📈 Investi: ${fmt(openValue)}$
   └ ${unrealizedPnl >= 0 ? '🟢' : '🔴'} +/-: ${fmtPnl(unrealizedPnl)}$

━━━━━ 𝗔𝗨𝗝𝗢𝗨𝗥𝗗'𝗛𝗨𝗜 ━━━━━

${todayPnl >= 0 ? '📈' : '📉'} P&L Jour: ${fmtPnl(todayPnl)}$
🎯 Positions: ${stats.openPositions || 0} ouvertes
✅ Win Rate: ${fmt(winRate, 0)}% ${progressBar(winRate)}

━━━━━━━━━━━━━━━━━━━━━
`
}

// 📊 RÉSUMÉ COMPLET - Toutes les 5 min
export function formatStatusAlert(stats, mode) {
  const modeIcon = mode === 'live' ? '🔴' : '🟢'
  const modeName = mode === 'live' ? 'RÉEL' : 'PAPER'
  
  // Calculs
  const availableBalance = stats.balance || 0
  const openValue = stats.openValue || 0
  const unrealizedPnl = stats.unrealizedPnl || 0
  const totalPortfolio = availableBalance + openValue + unrealizedPnl
  const todayPnl = stats.todayPnl || 0
  const totalPnl = todayPnl + unrealizedPnl
  const startingBalance = stats.startingBalance || 300
  const roi = ((totalPortfolio - startingBalance) / startingBalance) * 100
  const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100) : 0
  
  // Heure
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  
  return `
${modeIcon} ${modeName} ━━━ 📊 𝗥𝗘́𝗦𝗨𝗠𝗘́ ━━━

🕐 ${time}

━━━━━ 💎 𝗣𝗢𝗥𝗧𝗘𝗙𝗘𝗨𝗜𝗟𝗟𝗘 ━━━━━

� 𝗩𝗮𝗹𝗲𝘂𝗿 𝗧𝗼𝘁𝗮𝗹𝗲: ${fmt(totalPortfolio)}$
   ├ 💵 Disponible: ${fmt(availableBalance)}$
   ├ � En position: ${fmt(openValue)}$
   └ ${unrealizedPnl >= 0 ? '�' : '🔴'} +/- value: ${fmtPnl(unrealizedPnl)}$

━━━━━ 📈 𝗣𝗘𝗥𝗙𝗢𝗥𝗠𝗔𝗡𝗖𝗘 ━━━━━

� P&L Réalisé: ${fmtPnl(todayPnl)}$
   (trades fermés)

📊 P&L Non Réalisé: ${fmtPnl(unrealizedPnl)}$
   (positions ouvertes)

${totalPnl >= 0 ? '🚀' : '📉'} 𝗣&𝗟 𝗧𝗢𝗧𝗔𝗟: ${fmtPnl(totalPnl)}$

━━━━━ 📉 𝗦𝗧𝗔𝗧𝗦 ━━━━━

🎯 Positions: ${stats.openPositions || 0} ouvertes
📊 Trades: ${stats.todayTrades || 0} aujourd'hui
✅ Win Rate: ${fmt(winRate, 0)}%
${progressBar(winRate, 15)}

💼 Capital initial: ${fmt(startingBalance)}$
📈 ROI: ${fmtPnl(roi)}%

━━━━━━━━━━━━━━━━━━━━━
`
}

// ❌ PERTE - Alerte (optionnel)
export function formatLossAlert(trade, mode, stats = {}) {
  const modeIcon = mode === 'live' ? '🔴' : '🟢'
  const modeName = mode === 'live' ? 'RÉEL' : 'PAPER'
  
  const loss = Math.abs(trade.profit || 0)
  const totalPortfolio = (stats.balance || 0) + (stats.openValue || 0) + (stats.unrealizedPnl || 0)
  
  return `
${modeIcon} ${modeName} ━━━━━━━━━━━━━━━

❌ 𝗣𝗘𝗥𝗧𝗘: -${fmt(loss)}$
📊 ${trade.market?.slice(0, 30) || 'Trade'}

� Portefeuille: ${fmt(totalPortfolio)}$

━━━━━━━━━━━━━━━━━━━━━
`
}

// 🌙 FIN DE JOURNÉE
export function formatDailySummary(stats, mode) {
  const modeIcon = mode === 'live' ? '🔴' : '🟢'
  const modeName = mode === 'live' ? 'RÉEL' : 'PAPER'
  
  const totalPnl = (stats.totalPnl || 0) + (stats.unrealizedPnl || 0)
  const totalPortfolio = (stats.balance || 0) + (stats.openValue || 0) + (stats.unrealizedPnl || 0)
  const startingBalance = stats.startingBalance || 300
  const roi = ((totalPortfolio - startingBalance) / startingBalance) * 100
  const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100) : 0
  
  const emoji = totalPnl >= 0 ? '🎉' : '😔'
  const status = totalPnl >= 0 ? 'JOURNÉE GAGNANTE' : 'JOURNÉE PERDANTE'
  
  return `
${modeIcon} ${modeName} ━━━━━━━━━━━━━━━

${emoji} ${status} ${emoji}

━━━━━ 📊 𝗕𝗜𝗟𝗔𝗡 ━━━━━

💰 P&L Total: ${fmtPnl(totalPnl)}$
💎 Portefeuille: ${fmt(totalPortfolio)}$
📈 ROI: ${fmtPnl(roi)}%

━━━━━ � 𝗦𝗧𝗔𝗧𝗦 ━━━━━

✅ Gagnés: ${stats.wins || 0}
❌ Perdus: ${stats.losses || 0}
🎯 Win Rate: ${fmt(winRate, 0)}%
${progressBar(winRate, 15)}

� Total trades: ${stats.totalTrades || 0}

━━━━━━━━━━━━━━━━━━━━━

À demain ! 🌙
`
}

export default {
  sendTelegramAlert,
  formatWinAlert,
  formatLossAlert,
  formatDailySummary,
  formatStatusAlert,
}
