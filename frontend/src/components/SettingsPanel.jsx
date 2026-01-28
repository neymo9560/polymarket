import { useState } from 'react'
import { Settings, DollarSign, Percent, Clock, RotateCcw, Shield, Zap } from 'lucide-react'

// PARAMÈTRES RECOMMANDÉS BASÉS SUR LES TOP TRADERS POLYMARKET
// (Theo4, Fredi9999, Gabagool, Swisstony)
const RECOMMENDED_SETTINGS = {
  conservative: {
    name: '🛡️ Conservateur',
    desc: 'Faible risque, gains stables',
    maxPositionSize: 2,
    stopLossPercent: 0.5,
    takeProfitPercent: 1,
    tradeInterval: 5,
  },
  balanced: {
    name: '⚖️ Équilibré',
    desc: 'Bon ratio risque/rendement',
    maxPositionSize: 5,
    stopLossPercent: 1,
    takeProfitPercent: 2,
    tradeInterval: 3,
  },
  aggressive: {
    name: '🔥 Agressif (Gabagool)',
    desc: 'Style des top traders',
    maxPositionSize: 8,
    stopLossPercent: 1.5,
    takeProfitPercent: 3,
    tradeInterval: 2,
  },
  whale: {
    name: '🐋 Whale (Theo/Fredi)',
    desc: 'Gros capital, high volume',
    maxPositionSize: 10,
    stopLossPercent: 2,
    takeProfitPercent: 5,
    tradeInterval: 1,
  },
}

export default function SettingsPanel({ botState, setBotState, onReset }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('polybot_settings')
    if (saved) return JSON.parse(saved)
    return {
      startingBalance: botState.startingBalance || 300,
      maxPositionSize: 5,
      stopLossPercent: 1,
      takeProfitPercent: 2,
      maxOpenPositions: 10,
      tradeInterval: 3,
    }
  })

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const applySettings = () => {
    // En mode LIVE: ne PAS modifier le capital (c'est le wallet réel)
    if (botState.mode === 'live') {
      // Sauvegarder seulement les % et paramètres, pas le capital
      localStorage.setItem('polybot_settings', JSON.stringify(settings))
      return
    }
    // En mode PAPER: on peut modifier le capital
    setBotState(prev => ({
      ...prev,
      startingBalance: settings.startingBalance,
      balance: settings.startingBalance,
    }))
    localStorage.setItem('polybot_settings', JSON.stringify(settings))
  }

  const handleReset = () => {
    if (confirm('Voulez-vous vraiment réinitialiser toutes les statistiques ?')) {
      onReset()
    }
  }

  const applyPreset = (presetKey) => {
    const preset = RECOMMENDED_SETTINGS[presetKey]
    setSettings(prev => ({
      ...prev,
      maxPositionSize: preset.maxPositionSize,
      stopLossPercent: preset.stopLossPercent,
      takeProfitPercent: preset.takeProfitPercent,
      tradeInterval: preset.tradeInterval,
    }))
  }

  return (
    <div className="hl-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-hl-text-secondary uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Paramètres
        </h3>
      </div>

      {/* PRÉSETS RECOMMANDÉS */}
      <div className="mb-4">
        <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-2">
          <Zap className="w-3 h-3 text-hl-yellow" />
          Présets recommandés
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(RECOMMENDED_SETTINGS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(key)}
              className="p-2 text-left bg-hl-bg border border-hl-border rounded hover:border-hl-green transition-all"
            >
              <div className="text-xs font-medium text-white">{preset.name}</div>
              <div className="text-xxs text-hl-text-muted">{preset.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Capital de départ - Désactivé en mode LIVE */}
        <div>
          <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-1">
            <DollarSign className="w-3 h-3" />
            {botState.mode === 'live' ? 'Capital LIVE (wallet réel)' : 'Capital de départ (USDC)'}
          </label>
          <input
            type="number"
            value={botState.mode === 'live' ? botState.balance : settings.startingBalance}
            onChange={(e) => handleChange('startingBalance', parseFloat(e.target.value) || 0)}
            disabled={botState.mode === 'live'}
            className={`w-full px-3 py-2 bg-hl-bg border border-hl-border rounded text-white text-sm outline-none ${
              botState.mode === 'live' 
                ? 'opacity-50 cursor-not-allowed' 
                : 'focus:border-hl-green'
            }`}
          />
          {botState.mode === 'live' && (
            <p className="text-xxs text-hl-text-muted mt-1">💰 Solde réel du wallet - non modifiable</p>
          )}
        </div>

        {/* Taille position max */}
        <div>
          <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-1">
            <Percent className="w-3 h-3" />
            Taille position max (% capital)
          </label>
          <input
            type="number"
            value={settings.maxPositionSize}
            onChange={(e) => handleChange('maxPositionSize', parseFloat(e.target.value) || 0)}
            min="1"
            max="25"
            className="w-full px-3 py-2 bg-hl-bg border border-hl-border rounded text-white text-sm focus:border-hl-green outline-none"
          />
        </div>

        {/* Stop Loss */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-1">
              <Shield className="w-3 h-3 text-hl-red" />
              Stop Loss (%)
            </label>
            <input
              type="number"
              value={settings.stopLossPercent}
              onChange={(e) => handleChange('stopLossPercent', parseFloat(e.target.value) || 0)}
              min="0.5"
              max="10"
              step="0.5"
              className="w-full px-3 py-2 bg-hl-bg border border-hl-border rounded text-white text-sm focus:border-hl-green outline-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-1">
              <Shield className="w-3 h-3 text-hl-green" />
              Take Profit (%)
            </label>
            <input
              type="number"
              value={settings.takeProfitPercent}
              onChange={(e) => handleChange('takeProfitPercent', parseFloat(e.target.value) || 0)}
              min="0.5"
              max="20"
              step="0.5"
              className="w-full px-3 py-2 bg-hl-bg border border-hl-border rounded text-white text-sm focus:border-hl-green outline-none"
            />
          </div>
        </div>

        {/* Intervalle */}
        <div>
          <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-1">
            <Clock className="w-3 h-3" />
            Intervalle trades (secondes)
          </label>
          <input
            type="number"
            value={settings.tradeInterval}
            onChange={(e) => handleChange('tradeInterval', parseInt(e.target.value) || 3)}
            min="1"
            max="60"
            className="w-full px-3 py-2 bg-hl-bg border border-hl-border rounded text-white text-sm focus:border-hl-green outline-none"
          />
        </div>

        {/* Boutons */}
        <div className="pt-2 space-y-2">
          <button
            onClick={applySettings}
            className="w-full py-2 bg-hl-green hover:bg-hl-green/90 text-black font-semibold rounded text-sm transition-all"
          >
            Appliquer les paramètres
          </button>
          
          <button
            onClick={handleReset}
            className="w-full py-2 bg-hl-red/20 hover:bg-hl-red/30 text-hl-red font-medium rounded text-sm transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser les stats
          </button>
        </div>
      </div>
    </div>
  )
}
