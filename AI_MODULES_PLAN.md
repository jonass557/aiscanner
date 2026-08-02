# Plan d'implémentation : 3 Nouveaux Modules IA

**Date de création** : 2 août 2026  
**Projet** : AI Chart Scanner  
**Objectif** : Ajouter 3 modules d'analyse IA avancés

---

## Vue d'ensemble

Ajout de 3 fonctionnalités majeures qui complètent le scanner de graphiques existant :

1. **AI Multi-Timeframe Analyzer** — Analyse simultanée de plusieurs unités de temps
2. **AI Opportunity Scanner** — Surveillance automatique de centaines de marchés
3. **AI Mentor** — Assistant virtuel pour formation et accompagnement

---

## Module 1 : AI Multi-Timeframe Analyzer

### Fonctionnalités
- L'utilisateur sélectionne plusieurs timeframes (M1, M5, M15, M30, H1, H4, D1, W1, Monthly)
- Upload d'une capture pour chaque timeframe OU un seul graphique avec contexte multi-TF
- L'IA analyse l'alignement des tendances entre timeframes
- Détecte les conflits (ex: H1 bullish mais D1 bearish)
- Explique si le signal est confirmé sur tous les TF
- Score de confluence multi-timeframe
- Affichage professionnel avec vue par timeframe

### Architecture backend
**Nouveau modèle** : `MultiTimeframeAnalysis`
```javascript
{
  userId, symbol, market, broker,
  timeframes: [{
    timeframe: String,
    imageUrl: String,
    analysis: { /* structure SMC complète */ },
    trend: 'bullish' | 'bearish' | 'ranging'
  }],
  confluenceScore: Number,
  alignmentStatus: 'aligned' | 'partial' | 'conflicted',
  recommendation: { decision, entry, stop, targets, reasoning },
  conflicts: [{ tf1, tf2, description }],
  status, createdAt
}
```

**Nouveau contrôleur** : `multiTimeframeController.js`
- `POST /multi-timeframe-scan` — Upload multiple images + timeframes
- `GET /multi-timeframe-analyses` — History
- `GET /multi-timeframe-analyses/:id` — Detail

**Nouveau prompt IA** : `multiTimeframePrompt.js`
- Analyse chaque TF individuellement
- Compare les structures de marché
- Identifie les confluences et conflits
- Donne une recommandation globale

### Architecture frontend
**Nouvelle page** : `client/src/pages/dashboard/MultiTimeframe.jsx`
- Sélecteur de timeframes (checkboxes)
- Upload zone pour chaque TF sélectionné
- Preview grid des images
- Bouton "Analyze All Timeframes"
- Résultat : tableau de bord avec alignement visuel

**Nouveau composant** : `MultiTimeframeResult.jsx`
- Grid montrant chaque TF avec sa tendance
- Indicateurs visuels d'alignement
- Section conflits détectés
- Recommandation finale

---

## Module 2 : AI Opportunity Scanner

### Fonctionnalités
- Surveillance automatique de marchés (Forex, Crypto, Indices, Deriv Synthetics)
- Détection des meilleures configurations (SMC setups)
- Ranking par score de confiance
- Filtres : marché, stratégie, timeframe, niveau de risque
- Notifications des nouvelles opportunités
- Rafraîchissement automatique (toutes les 5-15 min)

### Architecture backend
**Nouveau modèle** : `Opportunity`
```javascript
{
  symbol, market, timeframe, currentPrice,
  setupType: 'order-block' | 'fvg' | 'breaker' | 'liquidity-sweep',
  direction: 'BUY' | 'SELL',
  confidenceScore: Number,
  entry, stopLoss, takeProfit,
  riskRewardRatio,
  detectedAt, expiresAt,
  status: 'active' | 'expired' | 'triggered',
  chartSnapshot: String,  // Optionnel
  technicalContext: { /* key SMC elements */ }
}
```

**Nouveau contrôleur** : `opportunityController.js`
- `POST /opportunities/scan` — Lance un scan manuel (admin/user avec quota)
- `GET /opportunities` — Liste paginée + filtres
- `GET /opportunities/:id` — Détail
- `DELETE /opportunities/:id` — Marquer comme vue/ignorée

**Background job** : `scanOpportunitiesJob.js`
- Fonction qui itère sur une liste de symboles
- Pour chaque symbole : récupère les données de marché (via API externe ou mock)
- Analyse via IA ou règles SMC programmatiques
- Sauvegarde les opportunités détectées
- Nettoie les opportunités expirées

**Intégration données marché** :
- Phase 1 (MVP) : Liste statique de symboles, analyse périodique via IA mock
- Phase 2 : Intégration API (TwelveData, Alpha Vantage, ou Binance pour crypto)
- Phase 3 : WebSocket real-time pour Deriv Synthetics

### Architecture frontend
**Nouvelle page** : `client/src/pages/dashboard/Opportunities.jsx`
- Filtres en haut (market, timeframe, minConfidence, setupType)
- Tableau/grille d'opportunités triées par score
- Badges visuels (NEW, HIGH CONFIDENCE, EXPIRING SOON)
- Clic sur une opportunité → modal avec détails complets
- Bouton "Scan Now" (lance un scan manuel si quota disponible)

**Nouveau composant** : `OpportunityCard.jsx`
- Symbol + market badge
- Direction (BUY/SELL) avec flèche
- Setup type + confidence score
- Entry / SL / TP
- Time remaining
- Action : "View Details" / "Ignore"

---

## Module 3 : AI Mentor

### Fonctionnalités
- Chat conversationnel avec un mentor IA expert
- Répond aux questions de trading
- Explique les analyses (peut référencer des analyses passées de l'user)
- Enseigne SMC, ICT, Price Action, gestion du risque
- Mode débutant vs. avancé
- Historique des conversations
- Peut générer des exemples visuels ou des plans de trade

### Architecture backend
**Nouveau modèle** : `MentorConversation`
```javascript
{
  userId,
  title: String,  // Auto-généré ou user-defined
  messages: [{
    role: 'user' | 'assistant',
    content: String,
    timestamp: Date,
    attachments: [{ type, url }]  // Optionnel : graphiques, analyses
  }],
  topic: String,  // 'smc' | 'risk-management' | 'psychology' | 'general'
  createdAt, updatedAt
}
```

**Nouveau contrôleur** : `mentorController.js`
- `POST /mentor/conversations` — Créer nouvelle conversation
- `GET /mentor/conversations` — Liste des conversations de l'user
- `GET /mentor/conversations/:id` — Récupérer une conversation
- `POST /mentor/conversations/:id/message` — Envoyer un message
- `DELETE /mentor/conversations/:id` — Supprimer conversation

**Nouveau service IA** : `mentorService.js`
- Utilise le même provider système (OpenAI/Claude/Gemini)
- Prompt système spécialisé : expert SMC/ICT mentor
- Maintient le contexte de la conversation
- Peut accéder aux analyses passées de l'user (option)

**System prompt mentor** :
```
You are an elite trading mentor specializing in Smart Money Concepts (SMC),
Inner Circle Trader (ICT) methodology, Price Action, and professional risk management.
Your role is to teach, guide, and answer questions with clarity and patience.
Adapt your explanations to the user's level (beginner/intermediate/advanced).
Use analogies, examples, and step-by-step breakdowns.
Never give financial advice; focus on education and methodology.
```

### Architecture frontend
**Nouvelle page** : `client/src/pages/dashboard/Mentor.jsx`
- Layout : sidebar (liste conversations) + zone de chat principale
- Bouton "New Conversation"
- Input message en bas avec bouton Send
- Messages affichés en style chat moderne
- Typing indicator pendant la génération
- Option d'attacher une analyse pour demander explication

**Nouveau composant** : `MentorChat.jsx`
- Message bubbles (user à droite, assistant à gauche)
- Markdown support pour les réponses formattées
- Code blocks pour exemples
- Timestamps

**Nouveau composant** : `ConversationList.jsx`
- Liste des conversations avec preview dernier message
- Badge "unread" si nouveau message
- Search/filter par topic

---

## Phases d'implémentation

### Phase 1 : Multi-Timeframe Analyzer (Priorité haute)
**Backend** :
1. Créer modèle `MultiTimeframeAnalysis`
2. Créer contrôleur + routes
3. Créer nouveau prompt multi-TF
4. Adapter `analyzeChart` pour accepter multiple images
5. Tests

**Frontend** :
1. Créer page `MultiTimeframe.jsx`
2. Créer composant `MultiTimeframeResult.jsx`
3. Ajouter route dans `App.jsx`
4. Ajouter item dans nav du dashboard
5. Tests UI

**Durée estimée** : 4-6 heures

### Phase 2 : Opportunity Scanner (Priorité moyenne)
**Backend** :
1. Créer modèle `Opportunity`
2. Créer contrôleur + routes
3. Créer job de scan (version simple/mock d'abord)
4. Intégrer scheduler (node-cron)
5. Tests

**Frontend** :
1. Créer page `Opportunities.jsx`
2. Créer composant `OpportunityCard.jsx`
3. Système de filtres
4. Auto-refresh (polling ou WebSocket)
5. Tests UI

**Durée estimée** : 6-8 heures

### Phase 3 : AI Mentor (Priorité moyenne)
**Backend** :
1. Créer modèle `MentorConversation`
2. Créer contrôleur + routes
3. Créer service `mentorService.js` avec prompt système
4. Tests

**Frontend** :
1. Créer page `Mentor.jsx`
2. Créer composants `MentorChat.jsx` + `ConversationList.jsx`
3. Gestion état conversation (context ou state)
4. Tests UI

**Durée estimée** : 5-7 heures

---

## Ordre d'exécution recommandé

1. **Multi-Timeframe Analyzer** (plus demandé, extension naturelle du scanner actuel)
2. **AI Mentor** (plus simple, high value pour users)
3. **Opportunity Scanner** (plus complexe, nécessite intégration données)

---

## Considérations techniques

### Quotas & limites
- Multi-TF : consomme 1 scan par analyse (même si plusieurs images)
- Opportunity Scanner : admin-only au début, ou nouveau quota "scans opportunités"
- AI Mentor : nouveau quota "messages mentor" ou illimité pour Premium

### Performance
- Multi-TF : analyse séquentielle des TF (peut être long si 5+ timeframes)
- Opportunity Scanner : background job doit être optimisé (cache, rate limiting API)
- AI Mentor : streaming de réponse pour UX fluide (Server-Sent Events)

### Évolutivité future
- Multi-TF : intégration directe TradingView/MT5 pour fetch automatique
- Opportunity Scanner : WebSocket pour push notifications real-time
- AI Mentor : RAG (Retrieval-Augmented Generation) avec base de connaissance

---

## État actuel : MODULES 1-3 COMPLETS (02/08/2026), MODULES 4-6 EN IMPLÉMENTATION

## Module 4 : AI Trade Validator

### Fonctionnalités
- L'utilisateur soumet un plan de trade : capture d'écran avec SL/TP marqués OU paramètres saisis manuellement (entry, SL, TP, timeframe, strategy)
- L'IA vérifie le respect des règles de gestion du risque (R:R, % capital risqué, placement SL logique)
- Analyse l'emplacement du Stop Loss (liquidity sweep, structure, ordre technique)
- Analyse les Take Profits (cibles réalistes, zones de liquidité)
- Calcule le ratio risque/rendement
- Identifie les faiblesses du setup
- Recommande : VALIDATE (feu vert), WAIT (attendre meilleure confirmation), REJECT (trade invalide)
- Justification détaillée en français

### Architecture backend

**Nouveau modèle** : `TradeValidation`
```javascript
{
  userId, symbol, market, timeframe,
  // Input mode: "screenshot" or "parameters"
  inputMode: 'screenshot' | 'parameters',
  imageUrl: String,              // if screenshot mode
  tradeParams: {                 // if parameters mode
    entry, stopLoss, takeProfit1, takeProfit2,
    strategy, riskPercent, accountBalance
  },
  decision: 'VALIDATE' | 'WAIT' | 'REJECT',
  confidenceScore: Number,
  riskScore: Number,             // 0..100 risk rating
  riskRewardRatio: String,
  stopLossAnalysis: { isValid, reasoning, suggestions[] },
  takeProfitAnalysis: { isValid, reasoning, suggestions[] },
  weaknesses: [{ type, severity, description }],
  recommendations: [{ action, priority }],
  summary: String,
  status, createdAt
}
```

**Nouveau prompt** : `tradeValidatorPrompt.js`
- Règles strictes de validation (R:R minimum 1:2, SL technique, TP réaliste)
- Output JSON structuré avec VALIDATE/WAIT/REJECT

**Nouveau contrôleur** : `tradeValidatorController.js`
- `POST /trade-validator` — Valide un plan (screenshot ou params)
- `GET /trade-validations` — Historique
- `GET /trade-validations/:id` — Détail

### Architecture frontend
**Nouvelle page** : `TradeValidator.jsx`
- Switch mode screenshot vs. paramètres manuels
- Mode screenshot : upload + preview
- Mode paramètres : formulaire (entry, SL, TP1, TP2, stratégie, %risque, balance)
- Résultat coloré : vert/jaune/rouge selon la décision
- Rapport détaillé : analyse SL, TP, faiblesses, recommandations

---

## Module 5 : AI Economic News Analyzer

### Fonctionnalités
- Calendrier économique connecté (ForexFactory data source, mock au début)
- Annonces importantes filtrées par impact (high/medium/low)
- Analyse IA de l'impact potentiel sur les marchés (forex, crypto, indices)
- Alertes avant événements à fort impact (notification dans l'app)
- Injection du contexte macro dans les décisions du scanner (bannière "High impact news coming")
- Filtre par marché/date/impact

### Architecture backend

**Nouveau modèle** : `EconomicEvent`
```javascript
{
  title, dateTime, currency, impact: 'high'|'medium'|'low'|'holiday',
  forecast, previous, actual,
  affectedMarkets: ['EURUSD', ...],
  aiAnalysis: { summary, expectedImpact, tradingAdvice },
  notified: Boolean
}
```

**Service calendrier** : `economicCalendarService.js`
- `fetchCalendar()` — Récupère/mock les événements du jour/semaine
- `getUpcomingHighImpact(withinHours)` — Alertes imminentes
- `enrichWithAIAnalysis(event)` — Demande à l'IA d'analyser l'impact
- Job de fond : refresh toutes les heures

**Nouveau contrôleur** : `economicNewsController.js`
- `GET /economic-news` — Calendrier filtré
- `GET /economic-news/upcoming` — Événements à venir (pour bannière)
- `GET /economic-news/:id` — Détail + analyse IA

### Architecture frontend
**Nouvelle page** : `EconomicNews.jsx`
- Calendrier en grille/tableau
- Badges d'impact colorés
- Filtres par date, marché, impact
- Modal détail avec analyse IA
- Bannière "High impact news" en haut du dashboard (composant réutilisé sur Scanner, Multi-TF, etc.)

---

## Module 6 : AI Voice Assistant

### Fonctionnalités
- Reconnaissance vocale (Speech-to-Text) + synthèse vocale (Text-to-Speech)
- Commandes vocales : "Analyse ce graphique", "Pourquoi proposes-tu un achat ?", "Quel est le Stop Loss ?", etc.
- Réponses vocales naturelles
- Capacité d'expliquer les analyses (référence les résultats du scanner actuel)
- Explications pédagogiques (SMC, ICT, Price Action, gestion du risque)
- Personnalisable par utilisateur (niveau, préférences stratégiques)
- Interface : bouton micro flottant, animations écoute/réponse, transcription visible
- Historique des conversations avec recherche
- Architecture modulaire STT/TTS (plug and play)

### Architecture backend

**Nouveau modèle** : `VoiceConversation` (ou réutilisation de MentorConversation)
```javascript
{
  userId,
  messages: [{ role, content, audioUrl?, timestamp }],
  metadata: { contextType, contextId }  // Référence à une analyse, scan, etc.
}
```

**Couche voix modulaire** : `services/voice/`
- `BaseSTTProvider.js` — Interface abstraite Speech-to-Text
- `BaseTTSProvider.js` — Interface abstraite Text-to-Speech
- `WebSpeechMockProvider.js` — Simule STT/TTS (dev)
- `OpenAISTTProvider.js` — Whisper API
- `OpenAITTSProvider.js` — TTS API
- `index.js` — Factory + orchestrateur

**Moteur d'intentions** : `services/voice/intentEngine.js`
- Parse les commandes FR/EN en actions
- Mapping : "analyse ce graphique" → triggerScan, "pourquoi ce trade" → explainAnalysis, etc.
- Extrait les paramètres (marché, timeframe, ID)

**Nouveau contrôleur** : `voiceController.js`
- `POST /voice/command` — Reçoit la transcription, exécute l'action, renvoie réponse + audio
- `GET /voice/conversations` — Historique
- `POST /voice/synthesize` — TTS seul (pour replay)
- `POST /voice/transcribe` — STT seul (pour debug)

### Architecture frontend

**Hook** : `useSpeech.js`
- Gère les APIs Web Speech (SpeechRecognition + SpeechSynthesis)
- État : idle, listening, processing, speaking
- Transitions : bouton → écoute → transcription → envoi API → réponse → synthèse

**Nouveau composant** : `VoiceAssistantButton.jsx`
- Bouton micro flottant (fixed bottom-right)
- Animation onde pendant l'écoute
- Animation pulsation pendant la réponse
- Badge "en écoute" / "l'assistant parle"

**Nouvelle page** : `VoiceAssistant.jsx`
- Interface complète : micro, transcription live, historique des échanges
- Mode "mains libres" pour traders actifs
- Replay des réponses vocales

**Composant** : `VoiceAnimation.jsx`
- Animation canvas/SVG pendant l'écoute (spectre audio)
- Animation pendant la réponse (forme d'onde)

### Notes d'architecture

**Sécurité** : Les conversations vocales sont chiffrées en transit (HTTPS + token). Les données audio ne sont pas stockées en clair sur le disque serveur. Les utilisateurs peuvent supprimer leur historique.

**Performance** : STT/TTS se fait côté client quand possible (Web Speech API — gratuit, zéro latence). L'API Whisper/TTS OpenAI est utilisée en fallback pour les navigateurs sans Web Speech ou pour une qualité supérieure.

**Modularité** : La couche `services/voice/` suit le même pattern que `services/ai/` — interface abstraite, providers interchangeables, factory. Remplacer OpenAI par ElevenLabs ou Deepgram ne touche que le fichier provider.

**Langues** : Support FR et EN. Le moteur d'intentions parse les deux langues. L'utilisateur choisit la langue dans ses paramètres (défaut : navigateur).

---

## Ordre d'exécution

1. **Module 4 : Trade Validator** (simple, extension du scanner)
2. **Module 5 : Economic News Analyzer** (nouveau domaine, intéressant)
3. **Module 6 : Voice Assistant** (plus complexe, STT/TTS, animation)
