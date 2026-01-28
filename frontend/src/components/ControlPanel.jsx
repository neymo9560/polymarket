import { Play, Square, ToggleLeft, ToggleRight, AlertTriangle, Eye } from 'lucide-react'

export default function ControlPanel({ botState, toggleBot, toggleMode, isAdmin = true }) {
  const isRunning = botState.status === 'running'

  return (
    <div className="hl-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-hl-text-secondary uppercase tracking-wider">
          Contrôles
        </h3>
        {!isAdmin && (
          <span className="flex items-center gap-1 text-xs text-hl-yellow">
            <Eye className="w-3 h-3" /> Mode Viewer
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Bouton principal Start/Stop */}
        <button
          onClick={isAdmin ? toggleBot : undefined}
          disabled={!isAdmin}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded font-semibold text-sm transition-all ${
            !isAdmin ? 'opacity-50 cursor-not-allowed bg-hl-border text-hl-text-muted' :
            isRunning
              ? 'bg-hl-red text-white hover:bg-opacity-80'
              : 'bg-hl-green text-black hover:bg-opacity-80'
          }`}
        >
          {isRunning ? (
            <>
              <Square className="w-5 h-5" />
              <span>Arrêter le Bot</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              <span>Démarrer le Bot</span>
            </>
          )}
        </button>

        {/* Mode Toggle Paper/Live */}
        <button
          onClick={isAdmin ? toggleMode : undefined}
          disabled={isRunning || !isAdmin}
          className={`w-full flex items-center justify-between px-4 py-2.5 rounded border border-hl-border hover:bg-hl-hover transition-all ${
            (isRunning || !isAdmin) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span className="text-sm">Mode Trading</span>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${
              botState.mode === 'paper' ? 'text-hl-yellow' : 'text-hl-green'
            }`}>
              {botState.mode === 'paper' ? 'Paper' : 'Live'}
            </span>
            {botState.mode === 'paper' ? (
              <ToggleLeft className="w-5 h-5 text-hl-yellow" />
            ) : (
              <ToggleRight className="w-5 h-5 text-hl-green" />
            )}
          </div>
        </button>

        {/* Arrêt d'urgence - Admin seulement */}
        {isAdmin && (
          <button
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded bg-hl-red bg-opacity-20 border border-hl-red text-hl-red hover:bg-opacity-30 transition-all font-medium"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>ARRÊT D'URGENCE</span>
          </button>
        )}

        {/* Infos stratégies actives */}
        <div className="pt-3 border-t border-hl-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-hl-text-muted">Stratégies actives</span>
            <span className="text-hl-blue font-medium">
              {botState.activeStrategies.length}/4
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
