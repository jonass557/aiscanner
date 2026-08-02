# Plan de travail : Admin plans + Paiement SebPay + Déploiement + Documentation

**Date** : 2 août 2026
**Projet** : AI Chart Scanner

---

## Contexte / problèmes identifiés

1. **Plans figés dans un fichier** (`server/src/config/plans.js`) — l'admin ne peut ni modifier/supprimer/désactiver les plans, ni gérer le free trial. → **Migrer les plans en MongoDB** avec CRUD admin complet (décision validée).
2. **Aucun paiement réel** — le changement de plan est instantané (démo). → **Intégrer SebPay** (Mobile Money : MTN/Moov au Bénin) pour les paiements réels.
3. **Dépôt git corrompu/global** — `git rev-parse --show-toplevel` = `C:/Users/DELL` (tout le dossier utilisateur !), zéro remote. Pousser tel quel exposerait des fichiers personnels. → **Nouveau dépôt git propre dans AIscanner** + push GitHub (décision validée).
4. **Pas de config déployable** — env vars éparpillées, pas de config Vercel/Render, pas de doc.

---

## PHASE A — Plans en base (CRUD admin complet)

### Backend
- **Nouveau modèle** `server/src/models/Plan.js` :
  ```js
  {
    id: String,          // slug unique: 'free'|'pro'|'premium' (ou custom)
    name: String, price: Number, currency: String, // 'XOF' pour paiement SebPay
    scansPerMonth: Number, features: [String],
    isActive: Boolean,      // activé/désactivé (les plans inactifs ne sont plus proposés)
    trial: { enabled: Boolean, days: Number },  // free trial par plan
    order: Number,          // tri dans la page pricing
    meta: { ... }           // flexible
  }
  ```
- **Seed** `server/src/config/seedPlans.js` : insère les 3 plans actuels (free/pro/premium) au démarrage si la collection est vide. `plans.js` reste comme seed source.
- **Service** `server/src/services/planService.js` :
  - `getPlans({ includeInactive })` — liste triée (public : actifs seulement)
  - `getPlan(id)` — plan actif ou null (fallback seed si la base est vide)
  - `getTrialPlan(id)` — renvoie le plan + durée de trial si le trial est activé
  - `listAll()` — pour l'admin (avec inactifs)
- **Controller admin** (étend `adminController.js` ou nouveau `adminPlanController.js`) :
  - `GET /admin/plans` — tout (incl. inactifs)
  - `POST /admin/plans` — créer un plan
  - `PATCH /admin/plans/:id` — modifier (prix, scans, features, isActive, trial…)
  - `DELETE /admin/plans/:id` — supprimer
  - `POST /admin/plans/:id/toggle` — activer/désactiver
- **Impact utilisateur** :
  - `userController.getPlans` (public) → lit depuis la base (actifs seulement) avec le free trial injecté
  - `userController.changeSubscription` → valide contre la base, applique trial si `trial.enabled`
  - `User` model : ajouter `trialStartedAt`, `trialAppliedFor` (pour free trial)
  - `userApi.plans()` frontend inchangé (même shape)

### Frontend (admin)
- Nouvelle page `client/src/pages/admin/AdminPlans.jsx` :
  - Tableau des plans (nom, prix, scans, features, statut actif/inactif, trial)
  - Modal de création/édition (tous les champs, toggle trial + jours)
  - Boutons activer/désactiver/supprimer avec confirmation
- Route `/admin/plans` dans `AdminLayout.jsx` + nav
- Page Subscription (front user) : affiche badge "Essai gratuit X jours" si trial actif ; masque les plans inactifs

**Durée** : 5-7 h

---

## PHASE B — Paiement SebPay (Mobile Money)

### Doc SebPay (récupérée)
- **Auth** : clés API `pk_...` (publique) / `sk_...` (secrète) — endpoints exacts à confirmer depuis le dashboard (les pages auth/collections bloquent le fetch, 405). URL de base : `https://new.sebpay.bj` (confirmer le sous-chemin API).
- **Webhooks** : SebPay POST sur `callback_url` avec header **`X-SebPay-Signature`** = HMAC-SHA256 du corps JSON brut, calculé avec `sk_...`. Statuts finaux : **SUCCESS/FAILED** (et PENDING en attente). L'endpoint doit répondre **HTTP 200 < 5s**, idempotence par `transaction_id`, `external_reference` = notre référence.
- **Statuts** : SUCCESS / FAILED / PENDING.
- **Champs webhook** : `transaction_id`, `external_reference`, `status`, `amount`, `currency`, `customer_phone`, `created_at`, `updated_at`.
- **Opérateurs** : MTN Mobile Money, Moov Money (Bénin) — codes à confirmer dans la doc.

### Architecture (réutilise le pattern provider existant)
- `server/src/services/payments/` :
  - `BasePaymentProvider.js` — interface : `createCheckout(...)`, `verifyWebhook(body, signature)`
  - `SebPayProvider.js` — implémente l'API SebPay :
    - `createCollection({ amount, currency, phone, operator, externalRef, callbackUrl })` → `transaction_id`
    - `verifyWebhook(body, signature)` → HMAC-SHA256 avec `sk_`
    - `getTransaction(transactionId)` (polling, optionnel)
  - `index.js` — factory (sebpay, ou demo provider en dev)
- **Config** : `config.payments.sebpay = { apiKey, secretKey, baseUrl, callbackUrl, currency }`
- **Modèle** `server/src/models/Payment.js` :
  ```js
  { userId, planId, amount, currency, phone, operator,
    provider, providerRef, externalRef, status: 'pending'|'approved'|'rejected'|'failed',
    metadata, webhookReceivedAt, createdAt }
  ```
- **Routes** :
  - `POST /payments/checkout` (auth) — initie une collecte SebPay
  - `POST /payments/webhook/sebpay` (**public**, sans auth) — reçoit le webhook, vérifie la signature HMAC, met à jour la transaction, et active le plan si SUCCESS
  - `GET /payments` (auth) — historique de mes paiements
  - `GET /payments/:id` (auth)
- **Controller** `paymentController.js` :
  - checkout : crée un Payment (pending), appelle SebPay, renvoie transaction_id + statut à confirmer côté client
  - webhook : vérifie HMAC, idempotence (external_reference/transaction_id), si SUCCESS → active le plan (changeSubscription réel) + logs + email
- **Frontend** :
  - Modal paiement dans `Subscription.jsx` : choix opérateur (MTN/Moov) + numéro + bouton "Payer" → appelle checkout → affiche "Confirmez sur votre téléphone"
  - Polling ou attente webhook → refresh plan
  - Page admin : vue des transactions (`GET /admin/payments`)

**Règle** : jamais de webhook non vérifié. HMAC obligatoire. Idempotence stricte.

**Durée** : 8-10 h

---

## PHASE C — Déploiement Vercel + Render + env vars

### Backend → Render
- `server/package.json` : scripts `start`, `build` (si besoin), engines node
- `render.yaml` (optionnel, infra-as-code) ou config manuelle
- Variables (documentées dans PHASE D)

### Frontend → Vercel
- `vercel.json` : framework Vite, SPA rewrite `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`, build `npm run build`, output `dist`
- Env : `VITE_API_URL` (URL du backend Render)
- `client/.env.production` + proxy dev

### Racine
- `.env.example` complet (toutes les variables, commentées)
- `README` section déploiement
- Garder le `.gitignore` (surtout `.env`, `node_modules`, `dist`)

**Durée** : 2-3 h

---

## PHASE D — Documentation des variables nécessaires

Fichier `DEPLOYMENT.md` à la racine, couvrant :
1. **Toutes les variables** (tableau : nom, requis/optionnel, description, où l'obtenir) :
   - `MONGODB_URI` → MongoDB Atlas (créer cluster gratuit, connection string)
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` → générer (`openssl rand -hex 64`)
   - `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` → tableaux de bord OpenAI/Anthropic/Google
   - `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` → dashboard Cloudinary
   - `TWELVEDATA_API_KEY` → twelvedata.com (données forex/indices)
   - `SEBPAY_PUBLIC_KEY` / `SEBPAY_SECRET_KEY` / `SEBPAY_BASE_URL` / `SEBPAY_CALLBACK_URL` → dashboard SebPay
   - `EMAIL_*` (service, user, password, from) → Gmail app password ou SMTP provider
   - `FRONTEND_URL`, `PORT`, `NODE_ENV`, `VITE_API_URL`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` → seed admin
2. **Où les obtenir** : liens exacts, étapes, pièges (ex: app password Gmail, clé Cloudinary)
3. **Lancer en local** (zéro-config + avec clés)
4. **Déployer** : Render (backend) pas-à-pas, Vercel (frontend) pas-à-pas, config des env dans chaque
5. **Admin** : comment seeder l'admin, comment gérer plans/trial/utilisateurs depuis le panneau

**Durée** : 2-3 h

---

## PHASE E — Git propre + push GitHub

1. **Initialiser un dépôt NEUF** dans `Documents/AIscanner` :
   - `git init` (nouveau, indépendant du dépôt global `C:/Users/DELL`)
   - Le `.gitignore` existant protège `.env`, `node_modules`, `dist`, `uploads`
   - `git add -A` (ne prend QUE le projet)
   - Vérifier `git status` pour s'assurer qu'aucun fichier hors-projet n'est inclus
2. **Commits** : découper proprement (chore/feat/docs)
3. **Push** : `git remote add origin <URL>` + `git push -u origin main`
   - L'utilisateur fournit l'URL du repo GitHub vide (ou je guide la création via `gh`)
4. Brancher sur `main` (pas `master`)

**Durée** : 1 h (hors attente utilisateur pour l'URL)

---

## Ordre d'exécution

A. Plans en base (CRUD admin) → B. SebPay → C. Déploiement config → D. Doc variables → E. Git/push

## Vérifications (par phase)
- `node --check` sur chaque fichier backend
- `npm run build` frontend (≈7 min sur cette machine)
- Admin : CRUD plans, toggle, trial ; user voit les plans actifs
- SebPay : webhook HMAC vérifié, idempotence, activation plan sur SUCCESS
- Git : `git status` ne contient QUE AIscanner
