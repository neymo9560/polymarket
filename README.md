# 🤖 Polymarket HFT-Lite Bot 2026

Bot de trading haute fréquence pour Polymarket, inspiré des top performers 2026 (gabagool, swisstony, planktonXD, Theo4/SeriouslySirius).

## 🎯 Fonctionnalités

### Stratégies des Top Performers 2026
- **A - Arbitrage Binaire** (style gabagool) : Hedge YES/NO mispricing pour profit garanti
- **B - Low-Prob NO** (style swisstony/cry.eth2) : Mass buy NO sur événements quasi-impossibles  
- **C - Scalping 15-min** (style Theo4/SeriouslySirius) : 10k+ trades/mois sur micro-mouvements crypto
- **D - Market Making** (style LP) : Place mirrored spreads, farm rewards

### Interface Terminal Française
- UI moderne avec ratatui inspirée de Polymarket 2026
- Navigation intuitive : marchés, dashboard bot, ticket de pari
- Recherche temps réel et filtrage par catégories
- Affichage live des profits et trades

### Modes Paper & Live
- **Paper Mode** : Simulation sans risque (300 USDC virtuels)
- **Live Mode** : Trading réel avec frais (clé privée requise)
- Switch instantané entre modes

## 🚀 Installation

### Prérequis
- Rust 1.70+ 
- Git

### Installation rapide
```bash
# Cloner le projet
git clone <repository-url>
cd polymarket-hft-bot

# Installer dépendances
cargo build --release

# Créer fichier .env
cp .env.example .env
# Éditer .env avec votre clé privée

# Démarrer en mode paper (recommandé)
cargo run --bin polymarket-bot

# Ou directement l'exécutable compilé
./target/release/polymarket-bot
```

### Dépendances principales
```bash
cargo add rs-clob-client tokio --features full
cargo add alloy-signer-local alloy-primitives alloy-sol-types
cargo add ratatui crossterm clearscreen
cargo add reqwest hyper tokio-tungstenite
cargo add serde serde_json anyhow tracing dotenv
cargo add chrono uuid rust_decimal statrs
```

## ⚙️ Configuration

### Variables d'environnement (.env)
```bash
# Clé privée Ethereum (obligatoire pour mode live)
POLY_PRIVATE_KEY=0x1234567890abcdef...

# Mode par défaut (paper/live)
BOT_MODE=paper

# Fréquence scan (ms)
SCAN_FREQUENCY=1000

# Taille max position (%)
MAX_POSITION_SIZE=0.03

# Seuil arbitrage
ARB_THRESHOLD=0.985

# Seuil low-prob
LOW_PROB_THRESHOLD=0.025
```

### Configuration des stratégies
- **Arbitrage** : Détecte YES Ask + NO Ask < 0.985 → hedge immédiat
- **Low-Prob** : YES price < 0.025 → buy NO massivement  
- **Scalping** : Flash drop >30% en 30s → buy, exit +15%
- **Market Making** : Place spreads 2% autour mid-price

## 🎮 Utilisation

### Interface Terminal
```
POLYMARKET Le plus grand marché de prédictions du monde
Bot HFT-lite 2026 | Top performers style

🔍 Rechercher: Bitcoin
[Crypto] | Politique | Sports | [15-min]

Bitcoin dépassera $100k dans les 15 prochaines minutes?
OUI 45% | NON 55% | Vol: 2.5M$ | Clôture: 14j 🔥

[ENTRÉE] Sélectionner | [BOT] Dashboard | [/] Rechercher | [TAB] Catégorie | [Q] Quitter
```

### Dashboard Bot
```
🤖 DASHBOARD BOT HFT-LITE

💰 WALLET & PERFORMANCE      📊 STATUT BOT
Wallet: 300.00 USDC           🟢 EN COURS - PAPER  
Profits: +12.50 USDC (4.2%)   ⚡ Scan: 1000ms
Trades: 1247 ce mois          🔥 Stratégies actives: 2/4

Stratégies Top Performers 2026
🟢 A  Arbitrage Binaire    gabagool style  Hedge misprices pour free money
🔴 B  Low-Prob NO         swisstony style  NO sur quasi-impossible
🟢 C  Scalping 15-min     Theo4 style     10k+ trades/mois micro-mouvements  
🔴 D  Market Making        LP style        Place mirrored spreads farm rewards

[1-4] Toggle Strat | [SPACE] Start/Stop | [C] Config | [R] Reset | [ESC] Retour
```

### Commandes clavier
- **Navigation** : ↑↓ sélection, TAB catégories, / recherche
- **Actions** : ENTRÉE valider, BOT dashboard, Q quitter
- **Bot** : 1-4 toggle stratégies, SPACE start/stop, C config, R reset

## 🔧 Performance

### Latence optimisée
- WebSocket orderbook streaming (wss://ws.clob.polymarket.com)
- Zero-allocation parsing avec polyfill-rs (optionnel)
- Async runtime tokio pour concurrence maximale

### Gestion des risques
- Position sizing : 1-3% balance max par trade
- Slippage tolerance configurable
- Cooldown automatique entre trades
- Stop-loss intégré

### Monitoring
- Logs temps réel avec timestamps
- P&L tracking par stratégie
- Performance metrics (trades/mois, win rate, avg profit)
- Alertes seuils de risque

## 📊 Stratégies Détaillées

### A - Arbitrage Binaire (gabagool)
```
Condition: YES Ask + NO Ask < 0.985
Action: Buy YES + Buy NO simultané
Profit: 1.0 - (YES_price + NO_price) = garanti
Risk: 0 (si exécution simultanée)
```

### B - Low-Prob NO (swisstony)  
```
Condition: YES price < 0.025
Action: Buy NO massivement
Profit: High probability win
Risk: Low (événements quasi-impossibles)
```

### C - Scalping 15-min (Theo4)
```
Condition: Flash drop >30% en 30s
Action: Buy low, exit +15% rapide
Profit: Micro-gains accumulés
Risk: Timing sensitive
```

### D - Market Making
```
Condition: High volume markets
Action: Place mirrored spreads ±2%
Profit: Spread capture + rewards
Risk: Inventory management
```

## ⚠️ Avertissements

### Risques
- **Mode Live** : FRAIS RÉELS, argent réel en jeu
- **Volatilité** : Marchés prediction peuvent être très volatils
- **Latence** : La vitesse d'exécution impacte la profitabilité
- **Régulation** : Vérifier légalité prediction markets dans votre pays

### Recommandations
- Commencer **obligatoirement** en mode paper
- Tester chaque stratégie individuellement
- Surveiller P&L attentivement en mode live
- Ne pas investir plus que vous pouvez perdre

## 🐛 Débugage

### Logs détaillés
```bash
# Activer logs debug
RUST_LOG=debug cargo run

# Logs fichier
RUST_LOG=info cargo run > bot.log 2>&1
```

### Problèmes communs
- **Clé privée invalide** : Vérifier format 0x...
- **Connexion CLOB** : Vérifier réseau et endpoints
- **Balance insuffisante** : Recharger wallet USDC
- **Stratégie inactive** : Vérifier configuration et seuils

## 🤝 Contribuer

### Architecture modulaire
- `src/bot.rs` : Logique principale du bot
- `src/strategies/` : Implémentations stratégies
- `src/clob.rs` : Client Polymarket CLOB
- `src/ui.rs` : Interface terminal ratatui
- `src/types.rs` : Structures de données

### Ajouter stratégie
1. Implémenter trait `Strategy` dans `strategies.rs`
2. Ajouter au `StrategyEngine`
3. Update UI dashboard
4. Tester en mode paper

## 📄 Licence

MIT License - Usage à vos propres risques

## 🔗 Liens utiles

- [Polymarket](https://polymarket.com)
- [rs-clob-client](https://github.com/Polymarket/rs-clob-client)
- [Polyfill-rs](https://github.com/polyfill-rs/polyfill-rs) (optionnel)
- [EIP-712 Signing](https://eips.ethereum.org/EIPS/eip-712)

---

**⚡ Bon trading et que les probabilités soient avec vous !** 🚀
