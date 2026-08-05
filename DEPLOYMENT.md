
# Déploiement & variables d'environnement — AI Chart Scanner

Guide complet : quelles variables il faut, où les obtenir, et comment déployer
(frontend Vercel + backend Render).

> **Zéro-config** : sans aucune variable, l'app tourne quand même (IA mock, données marché simulées, paiements démo, emails en console). Chaque variable ajoutée active la vraie fonctionnalité.

---

## 1. Tableau complet des variables

### Backend (`server/.env` en local, → variables Render en prod)

| Variable | Requis | Description | Où l'obtenir |
|---|---|---|---|
| `MONGODB_URI` | ✅ prod | Connexion MongoDB | MongoDB Atlas : crée un cluster gratuit → *Connect* → *Drivers* → copie la `mongodb+srv://...` |
| `JWT_SECRET` | ✅ | Signe les tokens d'accès | `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | ✅ | Signe les refresh tokens | `openssl rand -hex 64` |
| `FRONTEND_URL` | ✅ prod | URL du site (CORS + liens email) | Ton URL Vercel, ex `https://mon-app.vercel.app` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ | Crée le compte admin (`npm run seed:admin`) | Toi |
| `OPENAI_API_KEY` | selon IA | Analyse d'images + assistant | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (option : clé Claude ou Gemini à la place) |
| `AI_PROVIDER` | | `openai` \| `claude` \| `gemini` \| `nvidia` | — |
| `NVIDIA_API_KEY` | optionnel | Modèles open source NVIDIA (NIM) | [build.nvidia.com](https://build.nvidia.com) → *Get API Key* |
| `VISION_PROVIDER` | optionnel | Provider du moteur de Vision (défaut = `AI_PROVIDER`) | — |
| `SETTINGS_ENC_KEY` | ✅ prod | Chiffre les clés API gérées depuis le dashboard admin (32 octets, STABLE) | `openssl rand -hex 16` |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | selon usage | Stocke les images uploadées | [console.cloudinary.com](https://console.cloudinary.com) → dashboard (sinon fallback data-URL) |
| `TWELVEDATA_API_KEY` | optionnel | Données forex/indices/commodities temps réel (assistant) | [twelvedata.com](https://twelvedata.com) → *Sign up* (gratuit) (sinon mock ; **crypto déjà réelle via Binance sans clé**) |
| `SEBPAY_PUBLIC_KEY` / `SEBPAY_SECRET_KEY` | pour paiements | Mobile Money réel | [new.sebpay.bj](https://new.sebpay.bj) → créer un compte marchand → clés `pk_` / `sk_` |
| `SEBPAY_BASE_URL` | pour paiements | URL API SebPay | `https://new.sebpay.bj/api` (confirmer dans ta doc SebPay) |
| `SEBPAY_CALLBACK_URL` | pour paiements | URL publique du webhook | `https://<ton-backend-render>/api/v1/payments/webhook/sebpay` |
| `EMAIL_USER` / `EMAIL_PASSWORD` | ✅ prod | Emails (OTP de vérification, reset) | Gmail → *Mot de passe d'application* (sinon emails affichés en console) |
| `EMAIL_FROM` | optionnel | Expéditeur | — |
| `REQUIRE_EMAIL_VERIFICATION` | ✅ prod | Exige un email vérifié (OTP 6 chiffres) avant de scanner | `true` en production (défaut `false`) |
| `NODE_ENV` / `PORT` | | `production` / `5000` | — |

### Frontend (`client/.env` en local, → variables Vercel)

| Variable | Requis | Description | Où l'obtenir |
|---|---|---|---|
| `VITE_API_URL` | ✅ prod | URL du backend Render | `https://ton-backend.onrender.com` (sans `/api/v1`) |

---

## 2. Où obtenir chaque variable (détail)

### MongoDB Atlas (base de données)
1. [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → créer un compte.
2. *Create a Cluster* (M0 gratuit) → attendre la création (~2 min).
3. *Database Access* → ajouter un user (ex: `admin`) + mot de passe fort.
4. *Network Access* → *Add IP Address* → `0.0.0.0/0` (accès partout ; pour de la prod, restreindre).
5. *Connect* → *Drivers* → copier la chaîne `mongodb+srv://admin:<password>@cluster0.xxxxx.mongodb.net/ai-chart-scanner`.
6. Coller dans `MONGODB_URI` (remplacer `<password>`).

### Clés IA (au moins UNE)
- **OpenAI** : [platform.openai.com](https://platform.openai.com) → *API keys* → *Create new secret key* → coller dans `OPENAI_API_KEY`. (Facturation séparée.)
- **Claude (Anthropic)** : [console.anthropic.com](https://console.anthropic.com) → *API keys*.
- **Gemini (Google)** : [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### Cloudinary (images)
1. [cloudinary.com](https://cloudinary.com) → signup gratuit.
2. Dashboard → les 3 valeurs `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### TwelveData (données marché forex/indices)
1. [twelvedata.com](https://twelvedata.com) → *Sign up* (clé gratuite, 800 requêtes/jour).
2. Tableau de bord → *API Key* → `TWELVEDATA_API_KEY`.
   > Sans elle : l'assistant utilise des données simulées pour forex/indices (clairement signalées). **Crypto = réelle via Binance, sans clé.**

### SebPay (paiements Mobile Money)
1. [new.sebpay.bj](https://new.sebpay.bj) → créer un compte marchand (ou te faire créer par leur support).
2. Dashboard → *API* → clés `SEBPAY_PUBLIC_KEY` (pk_) et `SEBPAY_SECRET_KEY` (sk_).
3. Vérifier dans la doc [new.sebpay.bj/fr/docs](https://new.sebpay.bj/fr/docs) :
   - le **chemin exact** du endpoint de collecte (paramétré dans `server/src/services/payments/SebPayProvider.js`) ;
   - les **codes opérateurs** (MTN/Moov) ;
   - ton **URL de callback** (`SEBPAY_CALLBACK_URL`) — SebPay y POST le webhook signé HMAC-SHA256 (header `X-SebPay-Signature`).
4. Le webhook vérifie la signature avec `sk_`, met à jour la transaction, et active le plan.

### Email (Gmail) — requis en production
1. Gmail → Compte → *Sécurité* → *Vérification en 2 étapes* **ON**.
2. *Mots de passe des applications* → générer → 16 caractères.
3. `EMAIL_USER` = ton adresse Gmail, `EMAIL_PASSWORD` = le mot de passe d'app.
4. Mettre `REQUIRE_EMAIL_VERIFICATION=true` pour activer la vérification.
   > Sans cela : les emails de vérification s'affichent dans la console du serveur (démo).

**Fonctionnement** : après l'inscription, un code OTP à 6 chiffres est envoyé par
email (valable 15 min). L'utilisateur le colle dans l'app (Scanner / page de
vérification / Profil) puis clique sur « Vérifier l'email ». Le Scanner, le
Multi-Timeframe et le Trade Validator sont bloqués tant que l'email n'est pas
vérifié. Le bouton « Renvoyer le code » génère un nouvel OTP.

---

## 3. Lancer en local

```bash
# 1. Variables
cp server/.env.example server/.env      # renseigner selon besoin
cp client/.env.example client/.env      # laisser VITE_API_URL vide

# 2. Dépendances
npm run install:all

# 3. MongoDB local (ou renseigner MONGODB_URI vers Atlas)
#    (ex: installer MongoDB Community, ou utiliser Atlas)

# 4. Lancer
npm run dev:server     # API sur :5000
npm run dev:client     # front sur :3000 (proxy /api → :5000)
```

**Zéro-config** : sans `.env` renseigné, tout tourne (mock IA, données simulées, paiements démo).

### Créer l'admin
```bash
npm run seed:admin     # crée ADMIN_EMAIL / ADMIN_PASSWORD
# puis connecte-toi → le panneau admin apparaît dans la sidebar.
```

### Gérer plans / free trial / utilisateurs (admin)
- **`/admin/plans`** : créer, modifier (prix, scans, features, devise), **activer/désactiver** un plan, configurer le **free trial** (durée en jours). Les plans inactifs disparaissent de la page d'abonnement.
- **`/admin/users`** : changer le plan d'un utilisateur (n'importe lequel, gratuit ou payant — override admin), activer/désactiver son abonnement, ajouter des crédits de scan, vérifier son email.
- Le free trial : quand un plan a `trial.enabled`, l'utilisateur voit "Xj gratuits" sur la page d'abonnement et peut l'activer **une seule fois** (tracké par `user.trial.appliedFor`).

---

## 4. Déployer

### 4.1 Backend → Render
1. Pousser le code sur GitHub (voir §5).
2. [render.com](https://render.com) → *New* → *Web Service* → connecter le repo.
3. Réglages :
   - **Root Directory** : `server`
   - **Build** : `npm install`
   - **Start** : `npm start`
   - **Health Check Path** : `/health`
4. *Advanced* → *Environment* → renseigner TOUTES les variables du tableau (surtout `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `SEBPAY_CALLBACK_URL`, les clés IA).
   > Alternative : importer le fichier `render.yaml` (Blueprint) à la racine du repo — les variables marquées `sync: false` se configurent alors dans le dashboard.
5. *Create Web Service* → URL du type `https://ai-chart-scanner-api.onrender.com`.

### 4.2 Frontend → Vercel
1. [vercel.com](https://vercel.com) → *Add New* → *Project* → importer le repo.
2. **Root Directory** : `client` (le dossier du frontend).
3. Vercel détecte `vercel.json` (framework Vite, SPA rewrite).
4. *Environment Variables* : `VITE_API_URL` = `https://ai-chart-scanner-api.onrender.com`.
5. *Deploy* → URL du type `https://mon-app.vercel.app`.

### 4.3 Finaliser
- Mettre `FRONTEND_URL` (backend) = `https://mon-app.vercel.app`.
- Mettre `SEBPAY_CALLBACK_URL` (backend) = `https://ai-chart-scanner-api.onrender.com/api/v1/payments/webhook/sebpay`.
- Vérifier `/health` sur le backend → `{"success":true,"status":"ok"}`.
- Se connecter sur le frontend → créer l'admin via `seed:admin` (local) ou une requête équivalente → gérer plans & utilisateurs.

---

## 5. Git & GitHub

```bash
cd C:/Users/DELL/Documents/AIscanner

git init                 # dépôt NEUF (indépendant de C:/Users/DELL)
git add -A
git status               # vérifier : SEUL le projet (pas de fichiers personnels)
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<ton-compte>/<ton-repo>.git
git push -u origin main
```

> Le dépôt git global pointait sur tout `C:\Users\DELL` — ceci crée un dépôt propre
> limité au projet. `.gitignore` protège `.env`, `node_modules`, `dist`, `uploads`.

---

## 6. Pièges courants

- **CORS** : si le front ne répond pas en prod, vérifier `FRONTEND_URL` exactement (avec `https://`, sans slash final).
- **Webhook SebPay** : l'URL de callback DOIT être publique (pas `localhost`). Tester avec un tunnel (ngrok) avant la prod.
- **Clé IA inactive** : si les scans échouent, vérifier que la clé a des crédits et que `AI_PROVIDER` pointe vers le bon provider.
- **MongoDB Atlas IP** : si connexion refusée, ouvrir l'accès réseau (`0.0.0.0/0` en dev).
- **VITE_API_URL** : préfixe `VITE_` requis (exposé au navigateur) ; sans lui le build l'ignore.
