import { useState } from 'react'
import { Settings, DollarSign, Percent, Clock, RotateCcw, Shield } from 'lucide-react'

export default function SettingsPanel({ botState, setBotState, onReset }) {
  const [settings, setSettings] = useState({
    startingBalance: botState.startingBalance || 300,
    maxPositionSize: 5, // % du capital par trade
    stopLossPercent: 1, // % de perte max
    takeProfitPercent: 2, // % de gain pour fermer
    maxOpenPositions: 10,
    tradeInterval: 3, // secondes entre trades
  })

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const applySettings = () => {
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

  return (
    <div className="hl-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-hl-text-secondary uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Paramètres
        </h3>
      </div>

      <div className="space-y-4">
        {/* Capital de départ */}
        <div>
          <label className="flex items-center gap-2 text-xs text-hl-text-muted mb-1">
            <DollarSign className="w-3 h-3" />
            Capital de départ (USDC)
          </label>
          <input
            type="number"
            value={settings.startingBalance}
            onChange={(e) => handleChange('startingBalance', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-hl-bg border border-hl-border rounded text-white text-sm focus:border-hl-green outline-none"
          />
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
