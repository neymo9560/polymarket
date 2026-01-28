import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

const CORRECT_PASSWORD = 'Binabine25!'

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        localStorage.setItem('polybot_auth', 'true')
        onLogin()
      } else {
        setError('Mot de passe incorrect')
        setIsLoading(false)
      }
    }, 500)
  }

  return (
    <div className="min-h-screen bg-hl-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-hl-green to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-hl-green/20">
            <span className="text-4xl">🤖</span>
          </div>
          <h1 className="text-3xl font-bold text-white">PolyBot Pro</h1>
          <p className="text-hl-text-muted mt-2">Bot de trading automatique Polymarket</p>
        </div>

        {/* Login Card */}
        <div className="hl-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-hl-green/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-hl-green" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Connexion sécurisée</h2>
              <p className="text-xs text-hl-text-muted">Accès protégé par mot de passe</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-hl-text-secondary mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-hl-bg border border-hl-border rounded-lg text-white focus:border-hl-green focus:ring-1 focus:ring-hl-green outline-none transition-all"
                  placeholder="Entrez votre mot de passe"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-hl-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-hl-red/20 border border-hl-red/50 text-hl-red text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 bg-hl-green hover:bg-hl-green/90 disabled:bg-hl-border disabled:cursor-not-allowed text-black font-semibold rounded-lg transition-all"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-hl-text-muted text-xs mt-6">
          🔒 Connexion sécurisée • Aucune donnée stockée
        </p>
      </div>
    </div>
  )
}
