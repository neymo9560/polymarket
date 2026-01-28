# 🚀 Guide de Déploiement Complet - Polymarket Bot HFT 2026

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                               │
│              Frontend React (polymarket-bot.vercel.app)      │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      RAILWAY / RENDER                        │
│                   Backend Rust (Bot HFT)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ CLOB API + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       POLYMARKET                             │
│    clob.polymarket.com / ws.clob.polymarket.com              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Prérequis

### Comptes nécessaires
- [ ] **Vercel** (gratuit) - https://vercel.com
- [ ] **Railway** ou **Render** (gratuit tier) - https://railway.app ou https://render.com
- [ ] **Wallet Ethereum** avec USDC sur Polygon
- [ ] **Polymarket Account** - https://polymarket.com

### Outils locaux
- [ ] Node.js 18+
- [ ] Rust 1.70+ (pour développement backend)
- [ ] Git

---

## 🔧 ÉTAPE 1 : Configuration du Wallet

### 1.1 Créer un wallet dédié au bot
```bash
# Utiliser un wallet SÉPARÉ de votre wallet principal
# Recommandé: créer un nouveau wallet sur Metamask/Rabby

# JAMAIS utiliser votre wallet principal avec des fonds importants
```

### 1.2 Récupérer la clé privée
1. Ouvrir Metamask → Compte → Exporter clé privée
2. Copier la clé (format: `0x1234...abcd`)
3. **NE JAMAIS partager cette clé**

### 1.3 Approvisionner le wallet
1. Envoyer USDC (Polygon) sur le wallet
2. Montant recommandé pour tests: **10-50 USDC**
3. Garder un peu de MATIC pour les gas fees (~1 MATIC)

### 1.4 Activer le wallet sur Polymarket
1. Aller sur https://polymarket.com
2. Connecter le wallet dédié au bot
3. Accepter les conditions d'utilisation
4. Le wallet est maintenant autorisé pour le CLOB

---

## 🌐 ÉTAPE 2 : Déployer le Frontend sur Vercel

git init
git add .
git commit -m "PolyBot"
git remote add origin https://github.com/TON_USERNAME/polybot.git
git push -u origin main
```


---

## 🦀 ÉTAPE 3 : Déployer le Backend sur Railway

### 3.1 Créer le Dockerfile
Créer `Dockerfile` à la racine :
```dockerfile
FROM rust:1.75-slim as builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/polymarket-bot /usr/local/bin/
EXPOSE 8080
CMD ["polymarket-bot", "--mode", "paper"]
```

### 3.2 Créer railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 3.3 Déployer sur Railway
1. Aller sur https://railway.app/new
2. "Deploy from GitHub repo"
3. Sélectionner le repository
4. Railway détecte automatiquement le Dockerfile

### 3.4 Variables d'environnement Railway
Dans le dashboard Railway → Variables :
```
POLY_PRIVATE_KEY=0xVOTRE_CLE_PRIVEE
BOT_MODE=paper
RUST_LOG=info
PORT=8080
```

### 3.5 Obtenir l'URL du backend
Railway génère une URL publique :
`https://polymarket-bot-production.up.railway.app`

---

## 🔗 ÉTAPE 4 : Connecter Frontend et Backend

### 4.1 Mettre à jour les variables Vercel
Dans Vercel → Settings → Environment Variables :
```
VITE_API_URL=https://polymarket-bot-production.up.railway.app
VITE_WS_URL=wss://polymarket-bot-production.up.railway.app
```

### 4.2 Redéployer le frontend
Dans Vercel → Deployments → Redeploy

---

## ✅ ÉTAPE 5 : Tester en Mode Paper

### 5.1 Vérifier le frontend
1. Ouvrir `https://votre-projet.vercel.app`
2. Vérifier que l'interface charge correctement
3. Naviguer dans les marchés

### 5.2 Vérifier le bot
1. Aller sur la page `/bot`
2. Activer une stratégie (ex: Arbitrage)
3. Cliquer "Démarrer"
4. Vérifier les logs de trades simulés

### 5.3 Vérifier la connexion Polymarket
Le bot doit afficher :
- ✅ Marchés chargés depuis Gamma API
- ✅ WebSocket connecté
- ✅ Balance simulée : 300 USDC

---

## 🔴 ÉTAPE 6 : Passer en Mode LIVE (Argent Réel)

### ⚠️ AVERTISSEMENTS CRITIQUES

```
╔══════════════════════════════════════════════════════════════╗
║  ⚠️  MODE LIVE = ARGENT RÉEL = RISQUE DE PERTE              ║
╠══════════════════════════════════════════════════════════════╣
║  1. Commencer avec un PETIT montant (10-50 USDC)             ║
║  2. Surveiller le bot pendant les premières heures           ║
║  3. Vérifier les logs régulièrement                          ║
║  4. Avoir un plan de sortie (stop loss)                      ║
║  5. NE JAMAIS mettre plus que vous pouvez perdre             ║
╚══════════════════════════════════════════════════════════════╝
```

### 6.1 Préparer le wallet
1. S'assurer que le wallet a suffisamment de USDC
2. S'assurer que le wallet est approuvé sur Polymarket
3. Vérifier les allowances USDC pour le CLOB

### 6.2 Modifier les variables Railway
```bash
# Dans Railway → Variables
POLY_PRIVATE_KEY=0xVOTRE_VRAIE_CLE_PRIVEE
BOT_MODE=live
```

### 6.3 Redémarrer le backend
Railway → Deployments → Redeploy

### 6.4 Vérifier le mode live
Dans le frontend :
- Le badge doit afficher "🔴 LIVE" 
- La balance doit montrer votre vraie balance USDC
- Les trades sont maintenant réels

### 6.5 Activer les stratégies progressivement
1. **Jour 1** : Activer seulement Arbitrage (risque faible)
2. **Jour 2-3** : Ajouter Low-Prob NO
3. **Semaine 2** : Ajouter Scalping si performances OK
4. **Après 1 mois** : Évaluer Market Making

---

## 📊 ÉTAPE 7 : Monitoring & Maintenance

### 7.1 Logs Railway
```bash
# Via CLI Railway
railway logs -f
```

### 7.2 Alertes
Configurer des alertes dans Railway pour :
- Erreurs de déploiement
- Restart du service
- Utilisation mémoire > 80%

### 7.3 Backup des configurations
Sauvegarder régulièrement :
- Configuration des stratégies
- Historique des trades
- Logs de performance

---

## 🔄 Switch Paper ↔ Live

### Passer en Paper (simulation)
```bash
# Railway Variables
BOT_MODE=paper
# Redeploy
```

### Passer en Live (réel)
```bash
# Railway Variables  
BOT_MODE=live
POLY_PRIVATE_KEY=0xVOTRE_CLE
# Redeploy
```

### Via le Frontend (si implémenté)
1. Dashboard Bot → Toggle "Paper/Live"
2. Si passage en Live → Confirmation + saisie clé privée
3. Redémarrage automatique du bot

---

## 🛠 Dépannage

### Le bot ne démarre pas
```bash
# Vérifier les logs Railway
railway logs --tail 100

# Vérifier que POLY_PRIVATE_KEY est correcte
# Vérifier que le wallet est approuvé sur Polymarket
```

### Pas de trades en mode Live
1. Vérifier que le wallet a des fonds
2. Vérifier les allowances USDC
3. Vérifier que les seuils de stratégies correspondent au marché

### Erreurs WebSocket
```bash
# Vérifier la connexion au WS Polymarket
# wss://ws.clob.polymarket.com doit être accessible
```

### Erreurs de signing
```bash
# Vérifier le format de la clé privée (0x...)
# Vérifier que la clé correspond au bon wallet
```

---

## 💰 Coûts Estimés

| Service | Gratuit | Payant |
|---------|---------|--------|
| Vercel | ✅ Hobby tier | $20/mois Pro |
| Railway | ✅ $5 crédit/mois | $20/mois |
| Polymarket | Frais de trading 0.5% | - |
| Gas Polygon | ~$0.01-0.05/tx | - |

**Total estimé** : 
- Gratuit pour tests
- ~$20-40/mois pour production sérieuse

---

## 📞 Support

### Ressources
- Polymarket Discord: https://discord.gg/polymarket
- rs-clob-client: https://github.com/Polymarket/rs-clob-client
- API Docs: https://docs.polymarket.com

### Contact équipe
- Issues GitHub du projet
- Documentation Polymarket API

---

## ✅ Checklist Finale

### Avant de passer en Live
- [ ] Testé en mode Paper pendant au moins 24h
- [ ] Vérifié que les stratégies fonctionnent correctement
- [ ] Wallet dédié créé et approvisionné
- [ ] Montant initial petit (10-50 USDC max)
- [ ] Plan de surveillance établi
- [ ] Stop loss configuré
- [ ] Compréhension des risques

### Après activation Live
- [ ] Vérifier les premiers trades
- [ ] Monitorer pendant 1h minimum
- [ ] Vérifier P&L après 24h
- [ ] Ajuster les paramètres si nécessaire

---

**Bonne chance avec votre bot ! 🚀**

*Rappel : Le trading comporte des risques. N'investissez que ce que vous pouvez vous permettre de perdre.*
