# 🚀 Déploiement PolyBot - Guide Ultra Simple

## Étape 1 : Push ton code sur GitHub

```bash
git init
git add .
git commit -m "PolyBot"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/polybot.git
git push -u origin main
```

---

## Étape 2 : Backend sur Railway

1. **Va sur** → https://railway.app
2. **Clique** → "Start a New Project"  
3. **Clique** → "Deploy from GitHub repo"
4. **Choisis** → ton repo `polybot`
5. **Attend** → Railway build automatiquement (2-3 min)

### Variables d'environnement (Railway)
Dans ton projet → onglet **"Variables"** → ajoute :

```
POLY_PRIVATE_KEY=0xTA_CLE_PRIVEE    (seulement pour mode LIVE)
RUST_LOG=info
PORT=8080
```

### Récupère ton URL Railway
Exemple : `https://polybot-production-abc123.up.railway.app`

---

## Étape 3 : Frontend sur Vercel

1. **Va sur** → https://vercel.com
2. **Clique** → "Add New" → "Project"
3. **Importe** → ton repo GitHub
4. **Configure** :
   - Root Directory : `frontend`
   - Framework : `Vite`
5. **Clique** → "Deploy"

### Variables d'environnement (Vercel)
Settings → Environment Variables → ajoute :

```
VITE_API_URL=https://polybot-production-abc123.up.railway.app
VITE_WS_URL=wss://polybot-production-abc123.up.railway.app
```

(Remplace par ton URL Railway)

---

## ✅ C'est fini !

- **Frontend** : `https://ton-projet.vercel.app`
- **Backend** : `https://polybot-xxx.up.railway.app`

---

## Mode Paper vs Live

| Mode | Description | POLY_PRIVATE_KEY |
|------|-------------|------------------|
| **Paper** | Simulation, pas d'argent réel | Pas besoin |
| **Live** | Argent réel sur Polymarket | Ta clé privée |

Pour passer en LIVE :
1. Railway → Variables → ajoute `POLY_PRIVATE_KEY=0x...`
2. Railway → Redeploy

---

## ⚠️ Important

- **Paper mode** : Les trades sont simulés sur des vrais prix Polymarket
- **Live mode** : Les trades sont exécutés avec ton argent réel
- Commence TOUJOURS en Paper pour tester
- Mets seulement 10-50 USDC au début en Live
