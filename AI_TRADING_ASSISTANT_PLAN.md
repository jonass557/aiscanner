# Plan de travail : Module "AI Trading Assistant"

**Date de création** : 2 août 2026
**Projet** : AI Chart Scanner
**Objectif** : Transformer AI Scanner en copilote de trading conversationnel (type ChatGPT spécialisé trading), capable d'analyser les marchés **en temps réel**, d'expliquer son raisonnement, de garder le contexte, et d'accompagner le trader (mode coach).

---

## Décisions validées (avec l'utilisateur)

1. **Données marché** : couche modulaire multi-source (Binance crypto public, TwelveData/AlphaVantage forex/indices) + **fallback mock déterministe** si pas de clé. Zéro-config en dev, réel en prod en ajoutant une clé.
2. **Stratégie personnelle** : champ **texte libre** dans les préférences utilisateur, injecté dans le prompt IA.
3. **Quotas** : une **analyse de marché complète = 1 crédit** de scan ; les messages de chat/coach/questions sont **gratuits**.

**Règle métier absolue** : l'assistant **ne fabrique jamais** de prix/données. Il récupère les données réelles avant toute analyse ; si indisponibles, il le dit clairement. Confiance < 70 ⇒ AUCUN TRADE (cohérent avec le scanner existant).

---

## Principe directeur : réutiliser, ne pas réécrire

L'existant couvre déjà ~60% du besoin. On s'appuie dessus :

| Besoin du prompt | Existant réutilisé |
|---|---|
| Compréhension d'intentions NL | `services/voice/intentEngine.js` (à étendre : symbole, TF, stratégie, ratio, confiance min) |
| Analyse SMC/ICT complète | `services/ai/prompt.js` + `responseParser.js` + modèle `Analysis` (schéma technique déjà exhaustif) |
| Couche IA multi-provider | `services/ai/` (`BaseProvider.chat()`/`analyze()`, OpenAI/Claude/Gemini/Mock) |
| Mémoire conversation | pattern `MentorConversation` / `VoiceConversation` (turns) |
| Univers de symboles + seam données | `services/opportunityScanner.js` (`SYMBOL_UNIVERSE`, `generateForSymbol`) |
| Enregistrement historique | modèle `Analysis` (réutilisé tel quel pour les analyses générées) |
| Décision + plan de trade | schéma `Analysis.tradePlan` + `decision` + `report` |
| Coach / éducatif | `services/ai/mentorPrompt.js` + `mentorReply()` |
| Rendu markdown chat | `utils/markdown.jsx` |
| Bannière news macro | `components/news/NewsBanner.jsx` (contexte macro dans les réponses) |

**Nouveau à construire** : connecteur données marché, orchestrateur d'assistant (routeur intention→action), extension intent engine, préférences utilisateur, modèle de conversation assistant, prompts dédiés, UI chat avancée.

---

## Architecture modulaire (9 modules indépendants)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend : AssistantChat.jsx (chat type ChatGPT)            │
│  - saisie texte + vocal (réutilise useSpeech)                │
│  - rendu riche : décision, plan de trade, cartes analyse     │
│  - sidebar conversations, suggestions, streaming visuel      │
└───────────────┬─────────────────────────────────────────────┘
                │ POST /assistant/message
┌───────────────▼─────────────────────────────────────────────┐
│  assistantController (orchestrateur)                          │
│    1. Charge conversation + contexte + préférences user       │
│    2. Intent engine → { action, params }                      │
│    3. Résolution contextuelle (héritage symbole/TF)           │
│    4. Dispatch vers le bon moteur :                           │
└──┬────────┬────────┬────────┬────────┬────────┬───────────────┘
   │        │        │        │        │        │
   ▼        ▼        ▼        ▼        ▼        ▼
 Market   Analyse  Décision Compare  Oppor-   Coach/
 Data     Engine   Engine   Engine   tunités  QA (mentor)
 Connector                                     
   │        │        │
   ▼        ▼        ▼
 marketData  ai/     Analysis (historique, 1 crédit)
 providers   provider
```

### Modules

1. **Interface de chat** (front) — `pages/dashboard/AssistantChat.jsx` + composants
2. **Gestionnaire de contexte** — `services/assistant/contextManager.js` (héritage symbole/TF/stratégie entre tours)
3. **Moteur de compréhension d'intentions** — `services/assistant/assistantIntent.js` (extension de l'intent engine vocal)
4. **Connecteur données marché** — `services/marketData/` (couche providers + mock)
5. **Moteur d'analyse technique** — réutilise `services/ai/` (nouveau prompt "data-driven" sans image)
6. **Moteur de décision** — logique BUY/SELL/NO_TRADE + plan de trade (réutilise parser existant, étendu)
7. **Générateur de rapports** — enregistre dans `Analysis`, formatte la réponse chat
8. **Mémoire utilisateur** — `User.preferences` + `AssistantConversation`
9. **Assistant vocal** (optionnel) — réutilise `useSpeech` + `services/voice`
10. **Système de notifications** — réutilise `NewsBanner` + toasts (alertes setups/news)

---

## PHASE 0 — Préférences utilisateur & fondations

**Backend**
- Étendre `models/User.js` avec un sous-document `preferences` :
  ```js
  preferences: {
    level: { type: String, enum: ['beginner','intermediate','expert'], default: 'intermediate' },
    favoriteStrategy: { type: String, default: 'smc' }, // smc|ict|price-action|custom
    customStrategy: String,        // texte libre injecté au prompt si favoriteStrategy==='custom'
    riskPercent: { type: Number, default: 1 },
    minRiskReward: { type: Number, default: 2 },   // ratio minimum (ex: 3 → 1:3)
    favoriteMarkets: [String],     // ['forex','crypto',...] ou symboles
    favoriteTimeframes: [String],  // ['H1','H4']
    language: { type: String, default: 'fr' },
  }
  ```
- `userController` : `GET /users/preferences`, `PATCH /users/preferences`.
- `endpoints.js` : `userApi.getPreferences()`, `userApi.updatePreferences()`.

**Frontend**
- Onglet "Préférences trading" dans `pages/dashboard/Settings.jsx` (formulaire : niveau, stratégie + textarea perso, %risque, ratio min, marchés/TF favoris).

**Durée** : 2-3 h

---

## PHASE 1 — Connecteur de données marché (le cœur "données réelles")

**Backend** — nouveau dossier `services/marketData/` (même pattern que `services/ai/` et `services/voice/`) :
- `BaseMarketProvider.js` — interface abstraite :
  - `getQuote(symbol)` → `{ symbol, price, timestamp, source }`
  - `getCandles(symbol, timeframe, limit)` → `[{ time, open, high, low, close, volume }]`
  - `isConfigured()`
- `BinanceProvider.js` — crypto via API publique REST (gratuite, sans clé). Mapping BTCUSD→BTCUSDT.
- `TwelveDataProvider.js` — forex/indices/commodities (clé `TWELVEDATA_API_KEY`).
- `MockMarketProvider.js` — génère OHLC déterministe et cohérent (base prices de `SYMBOL_UNIVERSE`, marche aléatoire seedée). **Fallback par défaut.**
- `index.js` — factory : route par marché vers le bon provider ; fallback mock si non configuré. Expose :
  - `getMarketSnapshot(symbol, timeframe)` → `{ quote, candles, source, isRealData }`
  - `resolveSymbol(userText)` → symbole canonique (EURUSD, XAUUSD, BTCUSD, "Boom 1000 Index"...)
- Config : ajouter `marketData` dans `config/index.js` (`provider`, clés TwelveData/AlphaVantage).

**Règle "données réelles"** : chaque snapshot porte `isRealData` + `source`. Si mock, la réponse de l'assistant le signale honnêtement ("données simulées — branchez une clé pour le temps réel"). Si une vraie source échoue, message clair, pas d'invention.

**Durée** : 4-6 h

---

## PHASE 2 — Moteur d'intentions & gestionnaire de contexte

**Backend** — `services/assistant/` :
- `assistantIntent.js` — parseur NL FR/EN, étend l'intent engine vocal. Extrait :
  - `action` : `analyze` | `compare` | `best_markets` | `trending` | `should_i_trade` | `explain` | `show_risks` | `find_setups` | `coach` | `teach` | `chitchat`
  - `params` : `symbol(s)`, `timeframe`, `strategy` (smc/ict/pa/custom), `minRR`, `minConfidence`, `market` (ex: synthetic/Deriv, Boom&Crash)
  - Exemples couverts : tous ceux du prompt (analyse EURUSD, XAUUSD H4, "ratio min 1:3", ">90% confiance", "meilleurs marchés", "compare EURUSD et GBPUSD", "indices synthétiques Deriv", "Boom & Crash", "selon ICT / Price Action / ma stratégie").
- `contextManager.js` — résolution contextuelle :
  - Hérite `symbol`/`timeframe`/`strategy` du dernier tour si absent ("Et si je passe en H4 ?" garde EURUSD ; "Compare les deux" reprend les 2 dernières analyses).
  - Stocke les dernières analyses de la conversation pour comparaison/explication.

**Durée** : 4-5 h

---

## PHASE 3 — Moteur d'analyse & de décision (data-driven, sans image)

**Backend** :
- `services/ai/assistantAnalysisPrompt.js` — nouveau prompt système : reçoit **les données OHLC + quote réelles** (pas d'image) et la stratégie/préférences user, produit le même JSON structuré que le scanner (market structure, BOS/CHoCH/MSS, OB/FVG/breaker/mitigation, liquidité, EQH/EQL, premium/discount, momentum, volatilité, S/R, patterns, zones institutionnelles), + décision + plan de trade complet (entry, SL, TP1/TP2/TP3, R:R, probabilité, confiance, durée estimée, type scalp/intraday/swing) + explication étape par étape.
- Réutilise `responseParser.js` (étendre le schéma de plan : TP3, probabilité, tradeType, estimatedDuration — déjà partiellement présents dans `Analysis`).
- Orchestrateur `services/ai/index.js` : nouvelle fonction `analyzeMarketData({ snapshot, preferences, strategy })` → `{ analysis, meta }`.
- Filtres post-analyse : si `minRR`/`minConfidence` demandés, l'assistant respecte (sinon AUCUN TRADE motivé).

**Durée** : 5-6 h

---

## PHASE 4 — Orchestrateur, conversation & historique

**Backend** :
- `models/AssistantConversation.js` — `{ user, title, messages:[{ role, content, action, analysisId?, attachments?, createdAt }], lastMessageAt }`.
- `controllers/assistantController.js` :
  - `POST /assistant/conversations` — créer
  - `GET /assistant/conversations` — liste
  - `GET /assistant/conversations/:id` — détail
  - `POST /assistant/conversations/:id/message` — **cœur** : intent → contexte → (marketData → analyse+décision, 1 crédit, sauvegarde `Analysis`) OU (compare/best/coach/teach/explain) → réponse formatée
  - `DELETE /assistant/conversations/:id`
- `routes/assistantRoutes.js` + montage dans `routes/index.js`.
- Décompte crédit **uniquement** pour les actions `analyze`/`find_setups`/`should_i_trade` (via le middleware/quota existant du scanner). Chat/coach/explain = gratuit.
- Chaque analyse générée est enregistrée dans `Analysis` (historique unifié avec le scanner).

**Frontend** :
- `services/endpoints.js` : `assistantApi` (conversations, message, ...).

**Durée** : 5-7 h

---

## PHASE 5 — Interface de chat (front)

**Frontend** :
- `pages/dashboard/AssistantChat.jsx` — expérience type ChatGPT :
  - Sidebar conversations (réutilise le pattern Mentor/Voice) + "Nouvelle conversation".
  - Zone chat : bulles user/assistant, rendu markdown (`utils/markdown.jsx`), auto-scroll, typing indicator.
  - **Rendu riche des analyses** : quand un message porte une analyse, afficher un composant carte (décision colorée BUY/SELL/NO_TRADE + plan de trade + confluences + risques + explication étape par étape) — réutiliser/adapter `DecisionCard`, `TradePlanCard`, `TechnicalAnalysis`, `DetailedReport`.
  - Badge source de données ("temps réel · Binance" ou "simulé").
  - Saisie vocale (bouton micro via `useSpeech`) + lecture TTS optionnelle des réponses.
  - Suggestions de démarrage (les exemples du prompt).
- `components/assistant/AssistantMessage.jsx` — routeur de rendu (texte vs carte analyse).
- Route `App.jsx` : `/dashboard/assistant` + item nav (`DashboardLayout`, icône `Bot`/`Sparkles`).
- Positionner comme entrée principale du dashboard (mode phare).

**Durée** : 6-8 h

---

## PHASE 6 — Coach, notifications & polish

- **Mode coach** : intents `coach`/`teach`/`explain` → `mentorReply()` avec préférences (niveau) + garde-fous FOMO/revenge/overtrading (ajout au prompt mentor).
- **Notifications** : réutiliser `NewsBanner` (contexte macro) ; toast quand un setup ≥ seuil de confiance de l'user est détecté ; injection "high impact news coming" dans les analyses (via `getUpcomingHighImpact`).
- **Comparaison** : action `compare` → 2 analyses côte à côte + verdict "laquelle est la plus fiable".
- **Gestion de l'incertitude** : formulation prudente, disclaimer éducatif systématique, jamais de conseil financier.

**Durée** : 3-4 h

---

## Vérifications (à chaque phase)

- `node --check` sur chaque fichier backend créé.
- `npm run build` côté client (le build tourne ~9 min sur cette machine, c'est normal).
- Zéro-config : sans clé marché/IA, tout tourne (mock marché + mock IA), l'assistant signale honnêtement les données simulées.
- Tests ciblés : parsing intentions (unit), résolution contextuelle (héritage symbole/TF), respect règle confiance<70 ⇒ NO_TRADE.

---

## Ordre d'exécution recommandé

0. Préférences utilisateur (fondation, débloque personnalisation)
1. Connecteur données marché (débloque "données réelles")
2. Intent engine + context manager (débloque NL + mémoire)
3. Analyse + décision data-driven
4. Orchestrateur + conversation + historique + crédits
5. Interface chat (rendu riche)
6. Coach + notifications + comparaison + polish

**Estimation totale** : ~30-40 h de dev.

---

## Fichiers créés / modifiés (récapitulatif)

**Créés**
- `server/src/services/marketData/{BaseMarketProvider,BinanceProvider,TwelveDataProvider,MockMarketProvider,index}.js`
- `server/src/services/assistant/{assistantIntent,contextManager}.js`
- `server/src/services/ai/assistantAnalysisPrompt.js`
- `server/src/models/AssistantConversation.js`
- `server/src/controllers/assistantController.js`
- `server/src/routes/assistantRoutes.js`
- `client/src/pages/dashboard/AssistantChat.jsx`
- `client/src/components/assistant/AssistantMessage.jsx`

**Modifiés**
- `server/src/models/User.js` (preferences)
- `server/src/controllers/userController.js` (+preferences endpoints)
- `server/src/services/ai/index.js` (+analyzeMarketData), `responseParser.js` (schéma plan étendu)
- `server/src/config/index.js` (marketData config)
- `server/src/routes/index.js` (montage assistant)
- `server/src/services/ai/mentorPrompt.js` (garde-fous coach)
- `client/src/services/endpoints.js` (assistantApi, userApi.preferences)
- `client/src/App.jsx` (route), `client/src/layouts/DashboardLayout.jsx` (nav)
- `client/src/pages/dashboard/Settings.jsx` (onglet préférences trading)
```
