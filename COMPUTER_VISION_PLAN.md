# Plan de travail : Moteur de Vision par Ordinateur (Computer Vision) avancé

**Date de création** : 3 août 2026
**Projet** : AI Chart Scanner
**Objectif** : Faire reposer le cœur de l'application sur une véritable **architecture de Vision par Ordinateur** — l'IA comprend un graphique comme un trader professionnel : elle **détecte d'abord** tous les éléments visibles (extraction structurée), **puis** raisonne dessus (analyse technique), **décide**, et **explique**. Chaque élément détecté porte un **score de confiance**. Le système n'invente **jamais** une information absente du graphique.

En complément : rendre **administrable depuis le dashboard** l'ajout/modification des clés API (SebPay, Anthropic, Gemini, OpenAI) **et** l'intégration des modèles open source **NVIDIA AI**, sans redéploiement.

---

## Décisions structurantes

1. **Pipeline en deux passes, pas une.** L'existant (`services/ai/prompt.js`) fait tout en un seul appel « analyse le graphe ». On sépare désormais **Perception** (Vision → JSON structuré d'éléments visibles bruts) et **Cognition** (Analyse technique SMC/ICT + Décision + Explication). Cette séparation est ce qui rend l'architecture « Computer Vision » réelle et non « un LLM qui regarde une image ».
2. **Réutiliser le seam d'abstraction existant.** Le codebase possède déjà un pattern factory + `BaseProvider` propre (`services/ai/index.js`, `PROVIDER_REGISTRY`). On **étend** ce pattern (nouveau `VisionProvider`, nouveau `NvidiaProvider`) sans réécrire.
3. **Configuration des clés API en base, pas seulement en `.env`.** Aujourd'hui `getAIConfig` est **lecture seule** et lit `config` (env). On introduit un modèle `Setting` (clé/valeur chiffrée) qui **surcharge** l'env à chaud, éditable depuis l'admin. L'env reste le fallback/bootstrap.
4. **Règle métier absolue conservée** : jamais d'invention de données ; confiance globale < 70 ⇒ `NO_TRADE` (cohérent avec le scanner et l'assistant existants).
5. **Zéro-config en dev.** Sans clé, `MockVisionProvider` renvoie une perception déterministe → toute la chaîne (annotations comprises) fonctionne hors ligne.

---

## Principe directeur : réutiliser, ne pas réécrire

L'existant couvre déjà une grande partie du socle. On s'appuie dessus :

| Besoin du plan | Existant réutilisé |
|---|---|
| Couche IA multi-provider (analyse image) | `services/ai/` (`BaseProvider.analyze()`, OpenAI/Claude/Gemini/Mock) |
| Factory + fallback mock | `services/ai/index.js` (`PROVIDER_REGISTRY`, `getProvider`) |
| Schéma technique SMC/ICT exhaustif | modèle `Analysis.technicalAnalysis` + `responseParser.js` |
| Parsing JSON défensif (fences, coercition) | `services/ai/responseParser.js` (`extractJson`, `normalizeElements`) |
| Décision + plan de trade + rapport | `Analysis.decision`, `.tradePlan`, `.report` |
| Upload image | `services/uploadService.js`, `middleware/upload.js` |
| Endpoint scan + gestion crédits/échecs | `controllers/scanController.js` |
| Admin (auth, logs, stats) | `controllers/adminController.js`, `middleware/auth.js`, `logService` |
| Pattern registry multi-provider (autre domaine) | `services/payments/index.js`, `services/marketData/index.js` |
| Surface admin AI (lecture seule) | `controllers/adminController.getAIConfig` + `pages/admin/AdminAIConfig.jsx` |

**Nouveau à construire** : `VisionProvider` + passe perception, moteurs Cognition/Décision/Explication séparés, générateur d'overlay annoté à couches, extension du schéma `Analysis` (perception + scores + annotations), modèle `Setting` chiffré + CRUD admin, `NvidiaProvider`, registre de providers dynamique piloté par la base, UI admin éditable + UI annotations à couches.

---

## Architecture des 5 moteurs

Chaque moteur est un module indépendant, testable seul, communiquant par des **contrats de données** stables (JSON validé). On peut remplacer l'implémentation d'un moteur sans toucher aux autres.

```
                    ┌─────────────────────────────────────────────┐
   image  ─────────▶│  1. MOTEUR DE VISION (Computer Vision)       │
                    │     VisionProvider.perceive(image)           │
                    │     → PerceptionResult (éléments + confiance)│
                    └───────────────────┬─────────────────────────┘
                                        │ PerceptionResult (JSON)
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │  2. MOTEUR D'ANALYSE TECHNIQUE               │
                    │     SMC / ICT / Price Action                 │
                    │     → TechnicalReading (détections avancées) │
                    └───────────────────┬─────────────────────────┘
                                        │ TechnicalReading
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │  3. MOTEUR DE DÉCISION                       │
                    │     Confluences → BUY / SELL / NO_TRADE      │
                    │     + score global + trade plan              │
                    └───────────────────┬─────────────────────────┘
                                        │ Decision
                                        ▼
                    ┌─────────────────────────────────────────────┐
                    │  4. MOTEUR D'EXPLICATION                     │
                    │     Rapport pédagogique + justification      │
                    │     + coordonnées d'annotation (overlay)     │
                    └───────────────────┬─────────────────────────┘
                                        ▼
                              Analysis persistée + overlay annoté

   ┌───────────────────────────────────────────────────────────────┐
   │  5. MOTEUR D'AMÉLIORATION CONTINUE (transversal)               │
   │     Registre de providers dynamique + config admin (Setting)  │
   │     + feedback/qualité → ajout/remplacement de modèles à chaud │
   └───────────────────────────────────────────────────────────────┘
```

### Arborescence cible (backend)

```
server/src/services/vision/
  BaseVisionProvider.js       # contrat perceive() / perceiveMultiple()
  OpenAIVisionProvider.js     # GPT-4o vision → perception structurée
  ClaudeVisionProvider.js     # Claude vision → perception structurée
  GeminiVisionProvider.js     # Gemini vision → perception structurée
  NvidiaVisionProvider.js     # NVIDIA NIM (VILA / Neva / modèles OSS) → perception
  MockVisionProvider.js       # perception déterministe (dev / fallback)
  perceptionPrompt.js         # prompt "extraction pure" (STEP 1 uniquement)
  perceptionParser.js         # parse + normalise + clamp des scores de confiance
  registry.js                 # registre dynamique (piloté par Setting)
  index.js                    # orchestrateur : perceive()

server/src/services/analysis-engine/
  technicalEngine.js          # 2. Analyse technique (SMC/ICT) à partir de la perception
  decisionEngine.js           # 3. Confluences → décision + plan + score global
  explanationEngine.js        # 4. Rapport pédagogique + mapping annotations
  confluenceRules.js          # table de pondération des confluences (déterministe)
  pipeline.js                 # orchestre 1→2→3→4 et assemble le document Analysis

server/src/services/annotation/
  overlayBuilder.js           # construit les couches d'annotation (coords normalisées)
  layers.js                   # définition des couches + couleurs par défaut

server/src/services/settings/
  settingsService.js          # get/set chiffré, cache, surcharge de config à chaud
  crypto.js                   # chiffrement AES-256-GCM des secrets

server/src/models/
  Setting.js                  # { key, valueEnc, category, updatedBy, updatedAt }
  Analysis.js                 # (étendu : perception, annotations, confiances)
```

---

## Moteur 1 — Vision par Ordinateur

### Rôle
Transformer une image en **description structurée de tout ce qui est visible**, sans interprétation de trading. C'est de la **perception**, pas de la stratégie.

### Contrat : `BaseVisionProvider`
Miroir de `BaseProvider` existant.

```js
class BaseVisionProvider {
  isConfigured()                         // bool
  async perceive({ imageUrl, prompt })   // → string JSON brut (PerceptionResult)
  async perceiveMultiple({ images, prompt })
}
```

### Éléments perçus (chaque item : `{ label, value|level, bbox, color, confidence, note }`)
`bbox` = boîte englobante en **coordonnées normalisées 0–1** `{x, y, w, h}` (indépendant de la résolution → rejouable sur n'importe quel rendu).

- **Contexte** : symbole, marché (forex / crypto / indices / commodities / stocks / **synthetic Deriv**), timeframe, plateforme/broker (si logo visible), prix actuel.
- **Bougies** : liste des bougies (ou zones), couleur (haussière/baissière), corps, **mèches** haute/basse, volumes (si visibles).
- **Indicateurs affichés** : MA/EMA, RSI, MACD, Bandes de Bollinger, etc. (nom + zone).
- **Objets dessinés par l'utilisateur** : trendlines, supports, résistances, canaux, rectangles, **Fibonacci** (niveaux), annotations, **textes** présents sur le graphe (OCR).
- **Structures visuelles** : zones de consolidation, **gaps**, **niveaux psychologiques** (chiffres ronds).

> **Règle anti-hallucination (rappelée dans le prompt)** : si un élément n'est pas clairement visible → **ne pas l'émettre** (pas d'entrée) plutôt que de deviner. La confiance reflète la lisibilité visuelle, pas la conviction de trading.

### Prompt de perception (`perceptionPrompt.js`)
Reprend le **STEP 1** de `prompt.js` existant et l'étend, en **retirant** décision/plan (ceux-ci passent aux moteurs 3–4). Sortie = JSON strict `PerceptionResult` documenté ci-dessous.

### Parsing (`perceptionParser.js`)
Réutilise `extractJson()` et le style `normalizeElements()` de `responseParser.js` ; ajoute :
- `confidence` coercé et **clampé 0–100** (défaut 50 si absent) ;
- `bbox` validé (4 nombres dans 0–1, sinon `null`) ;
- `color` normalisée (hex ou nom → hex).

### Providers vision
- **OpenAI / Claude / Gemini** : on adapte les providers existants (le code d'appel image de `analyze()` est déjà écrit — cf. `ClaudeProvider.analyze`, `GeminiProvider.analyze`). On les fait pointer sur le `perceptionPrompt`.
- **NVIDIA** (nouveau) : voir Moteur 5.
- **Mock** : perception déterministe dérivée d'un hash de l'URL (dev/tests, comme `MockProvider` actuel).

---

## Moteur 2 — Analyse technique (SMC / ICT / Price Action)

### Rôle
À partir du **PerceptionResult** (données visibles + coordonnées), produire les **détections avancées**, chacune avec **score de confiance** et référence aux éléments perçus qui la justifient.

### Détections produites (`TechnicalReading`)
Regroupées par famille — chaque détection : `{ type, label, level, bbox?, confidence, evidence: [perceptionRefs], note }`.

- **Structure de marché** : Market Structure globale, BOS, CHoCH, MSS, HH, HL, LH, LL.
- **Zones institutionnelles** : Order Blocks, Breaker Blocks, Mitigation Blocks, FVG, Inverse FVG, Imbalances, Displacement.
- **Premium/Discount** : Premium Zone, Discount Zone, OTE (0.62–0.79).
- **Liquidité** : Liquidity Pools, BSL, SSL, Equal Highs, Equal Lows, Liquidity Sweeps, Stop Hunts, Inducement.
- **Dynamique** : Compression, Expansion, momentum, volatilité.
- **Classique** : Supports, Résistances, Breakouts, Fake Breakouts, Retests, canaux, trendlines.
- **Patterns** : patterns graphiques (têtes-épaules, triangles, drapeaux…) et patterns de chandeliers (engulfing, pin bar, doji…).

### Implémentation
`technicalEngine.js` utilise le provider **texte** (`chat()` déjà présent sur chaque provider) avec un prompt qui reçoit le **PerceptionResult en JSON** (et non l'image) : le raisonnement SMC/ICT est appliqué sur des données déjà extraites → plus déterministe, moins d'hallucination, réutilisable même hors image (compatible avec l'`analyzeMarketData` existant).

> Le schéma `Analysis.technicalAnalysis` actuel couvre déjà la majorité de ces familles ; on l'**étend** (breaker/mitigation/inverse-FVG/OTE/inducement/sweeps/displacement/patterns) — voir section Données.

---

## Moteur 3 — Décision

### Rôle
Croiser les confluences et trancher : **BUY / SELL / NO_TRADE**, avec **score global** et **plan de trade**.

### Implémentation (`decisionEngine.js` + `confluenceRules.js`)
Approche **hybride déterministe + IA**, pour la transparence :
1. `confluenceRules.js` = table pondérée (ex. BOS aligné +15, FVG en discount +10, sweep de liquidité +10, conflit multi-signaux −20…). On calcule un **score de confluence** reproductible à partir du `TechnicalReading`.
2. L'IA propose les niveaux (entry/SL/TP1-3, RR) cohérents avec le prix visible.
3. **Garde-fous** (repris de `services/ai/index.js`) : RR mini, confiance mini, et **`confidence < 70 ⇒ NO_TRADE`** avec `tradePlan` remis à `null`.

Sortie : `Decision { decision, confidenceScore, tradePlan, riskZones }`.

---

## Moteur 4 — Explication

### Rôle
Générer un **rapport clair, justifié, pédagogique** ET les **coordonnées d'annotation** pour l'overlay.

### Implémentation (`explanationEngine.js`)
- Réutilise la structure `Analysis.report` (summary, validationReasons, confluences, risks, weaknesses, missingElements, **reasoning** étape par étape).
- Explique **pourquoi** un signal est proposé **ou pourquoi aucun trade** (chaîne de confluences, ou absence/contradiction).
- Émet `annotations` = liste de couches prêtes à dessiner (voir Rapport visuel), chacune reliée à une détection et à sa `bbox`/`level`.

---

## Moteur 5 — Amélioration continue (évolutivité)

### Rôle
Ajouter/remplacer des modèles IA **sans modifier le reste de l'app**, et administrer les clés API depuis le dashboard.

### 5.1 Registre de providers dynamique (`vision/registry.js`)
Étend le `PROVIDER_REGISTRY` statique actuel en registre **piloté par la base** :

```js
registerVisionProvider('nvidia', (cfg) => new NvidiaVisionProvider(cfg));
// resolve() lit Setting (activeVisionProvider) → fallback env → fallback mock
```

Ajouter un modèle OSS = déposer un fichier `XxxVisionProvider.js` + un `register…()`. Zéro changement ailleurs.

### 5.2 Modèle `Setting` + service chiffré
```js
// models/Setting.js
{ key: String (unique),        // ex. 'ai.claude.apiKey', 'vision.provider', 'ai.nvidia.model'
  valueEnc: String,            // secret chiffré AES-256-GCM (jamais en clair)
  category: 'ai'|'vision'|'payments'|'general',
  isSecret: Boolean,
  updatedBy: ObjectId(User), updatedAt }
```
- `settingsService.js` : `get(key)`, `set(key,val,{admin})`, cache mémoire + invalidation, et **surcharge de `config`** au runtime (l'env sert de valeur d'amorçage/fallback).
- `crypto.js` : chiffrement avec `SETTINGS_ENC_KEY` (env, 32 octets). Les secrets ne transitent **jamais en clair** vers le client ; l'API renvoie un aperçu masqué (comme le `mask()` déjà présent dans `getAIConfig`).

### 5.3 Provider NVIDIA (`NvidiaVisionProvider.js`)
- Cible : **NVIDIA NIM / build.nvidia.com** (API compatible, modèles vision OSS : famille VILA / Neva / Llama-vision hébergés NVIDIA).
- Auth : `Authorization: Bearer <NVIDIA_API_KEY>`, endpoint et modèle **configurables via Setting** (`vision.nvidia.baseUrl`, `vision.nvidia.model`, `vision.nvidia.apiKey`).
- Implémente `perceive()` (image base64 comme les autres providers) + `chat()` pour le moteur technique.

### 5.4 Administration depuis le dashboard
On rend `AdminAIConfig` **éditable** (aujourd'hui lecture seule) et on ajoute une section **Vision & NVIDIA** + une section **Paiements (SebPay)**.

Nouvelles routes (dans `adminRoutes.js`, déjà protégées `protect, authorize('admin')`) :
```
GET   /admin/settings                 # groupé par catégorie, secrets masqués
PUT   /admin/settings                 # upsert { key, value } (chiffré côté serveur)
POST  /admin/settings/test-provider   # ping une clé (validation avant save)
GET   /admin/ai-config                # (existant, enrichi : vision + nvidia + sebpay)
```

Clés administrables : `ai.openai.*`, `ai.claude.*`, `ai.gemini.*`, `vision.nvidia.*`, `vision.provider`, `ai.provider`, `payments.sebpay.*`. Chaque modification est journalisée via `logAdmin` (déjà utilisé partout).

---

## Rapport visuel (overlay annoté à couches)

### Backend (`annotation/overlayBuilder.js` + `layers.js`)
Produit un tableau `annotations` (persisté dans `Analysis.annotations`), **une entrée par élément** :
```js
{ layer: 'orderBlocks'|'fvg'|'liquidity'|'premiumDiscount'|'supportResistance'
        |'bos'|'choch'|'entry'|'stopLoss'|'takeProfit'|'riskZone',
  shape: 'rect'|'line'|'zone'|'label',
  coords: { /* bbox 0–1 ou points normalisés */ },
  color: '#hex', label: String, confidence: Number }
```
Couleurs par défaut définies dans `layers.js` (surchargées par l'utilisateur côté client).

### Frontend
- Nouveau composant `client/src/components/analysis/AnnotatedChart.jsx` : `<canvas>`/SVG en surimpression de l'image, dessine les couches à partir de `annotations` (coords normalisées × dimensions rendues).
- **Panneau de couches** : cases à cocher par `layer` pour **activer/désactiver** chaque type d'annotation (liquidité, OB, FVG, premium/discount, S/R, BOS, CHoCH, entrée, SL, TP, zones de risque).
- Intégré dans `AnalysisDetail.jsx` et `AnalysisResult.jsx` existants.

---

## Données : extension du modèle `Analysis`

On **ajoute** (sans casser l'existant) :

```js
// Perception brute (Moteur 1)
perception: {
  candles: [ { bbox, color, bodyHigh, bodyLow, wickHigh, wickLow, confidence } ],
  indicators: [detectedElementSchema + { confidence, bbox }],
  drawnObjects: [ ... ],   // trendlines, rectangles, fib, channels
  texts:       [ { text, bbox, confidence } ],   // OCR
  gaps: [...], psychLevels: [...], consolidations: [...],
  platform: String, volumeVisible: Boolean,
  meta: { imageWidth, imageHeight }              // pour l'overlay
}

// Détections avancées additionnelles (Moteur 2) — ajoutées à technicalAnalysis
technicalAnalysis: {
  ...existant,
  higherHighs: [], higherLows: [], lowerHighs: [], lowerLows: [],
  inverseFvg: [], oteZones: [], inducement: [], liquiditySweeps: [],
  stopHunts: [], displacement: [], imbalances: [], retests: [],
  chartPatterns: [], candlePatterns: [], channels: [], fibonacci: []
}

// Annotations pour l'overlay (Moteur 4)
annotations: [annotationSchema]

// Chaque detectedElement porte désormais un score
detectedElementSchema += { confidence: Number, bbox: Mixed }

// Provenance
engineVersion: String,          // versionnage du pipeline
visionProvider: String, visionModel: String
source: enum += 'vision'        // ajout à l'enum existant
```

`responseParser.js` / `perceptionParser.js` clampent tous les `confidence` (0–100) et valident les `bbox`.

---

## Flux d'exécution (endpoint `/scan` réécrit en pipeline)

`scanController.js` garde sa logique crédits/upload/échec ; l'appel `analyzeChart` est remplacé par `pipeline.run()` :

```
1. upload image (existant)
2. Analysis pending (existant)
3. pipeline.run(imageUrl):
     a. perception   = visionRegistry.resolve().perceive(image)     [Moteur 1]
     b. technical    = technicalEngine.read(perception)             [Moteur 2]
     c. decision     = decisionEngine.decide(technical, perception) [Moteur 3]
     d. explanation  = explanationEngine.explain(decision, technical, perception) [Moteur 4]
     e. annotations  = overlayBuilder.build(technical, decision, perception)
4. Object.assign(analysis, {perception, technicalAnalysis, decision..., report, annotations, meta})
5. useScan() seulement si succès (existant)
```

Chaque étape est try/catch-ée : si le Moteur 1 échoue, on n'entame pas les suivants et on ne débite pas de crédit (comportement actuel conservé).

---

## Phases d'implémentation

### Phase 0 — Socle de configuration admin (prérequis)
- `models/Setting.js`, `settings/crypto.js`, `settings/settingsService.js` (+ surcharge `config`).
- Routes `/admin/settings` (GET/PUT/test-provider) + journalisation.
- `AdminAIConfig.jsx` passe en **éditable** ; ajout sections Vision, NVIDIA, SebPay.
- **Livrable** : l'admin peut saisir/masquer/tester les clés OpenAI, Claude, Gemini, NVIDIA, SebPay.

### Phase 1 — Moteur de Vision (perception)
- `BaseVisionProvider`, `perceptionPrompt`, `perceptionParser`, `MockVisionProvider`.
- Adaptation OpenAI/Claude/Gemini en providers vision ; `registry.js` dynamique.
- **Livrable** : `perceive(image)` renvoie un PerceptionResult validé (avec mock hors ligne).

### Phase 2 — Moteurs Cognition
- `technicalEngine`, `decisionEngine` + `confluenceRules`, `explanationEngine`.
- Extension du modèle `Analysis` + parsers.
- **Livrable** : `pipeline.run()` bout en bout, `/scan` branché dessus.

### Phase 3 — Rapport visuel à couches
- `overlayBuilder`, `layers`, `AnnotatedChart.jsx`, panneau de couches.
- **Livrable** : graphique annoté interactif dans `AnalysisDetail`.

### Phase 4 — NVIDIA + évolutivité
- `NvidiaVisionProvider` (perceive + chat) piloté par Setting.
- Sélecteur de provider vision dans l'admin ; test de connexion.
- **Livrable** : basculer OpenAI ↔ NVIDIA depuis le dashboard, sans redéploiement.

### Phase 5 — Qualité & amélioration continue
- Boucle de feedback (👍/👎 sur analyses) → `engineVersion` + métriques par provider dans les stats admin.
- **Livrable** : comparaison de qualité entre modèles, base pour A/B.

---

## Sécurité, performance, tests

- **Sécurité** : secrets chiffrés AES-256-GCM (`SETTINGS_ENC_KEY`), jamais renvoyés en clair (masque déjà en place) ; routes admin protégées (`authorize('admin')`) ; validation/masquage des entrées ; OCR/texte traité comme donnée, jamais comme instruction.
- **Performance** : perception mise en cache par hash d'image (évite re-facturation) ; Moteurs 2–4 sur données JSON (pas l'image) → plus rapides et moins coûteux ; `bbox` normalisées → aucun retraitement d'image côté serveur pour l'overlay (rendu client).
- **Tests** (Jest, dossier `server/tests/` existant) : `perceptionParser` (clamp confiance, bbox invalides), `confluenceRules` (déterminisme des scores), `decisionEngine` (garde-fou < 70 ⇒ NO_TRADE), `settingsService` (chiffrement round-trip, surcharge config), pipeline avec `MockVisionProvider`.
- **Rétro-compatibilité** : tous les champs ajoutés sont optionnels ; l'ancien chemin `analyzeChart` reste fonctionnel pendant la migration ; l'enum `source` est étendu, pas modifié.

---

## Récapitulatif des livrables

**Backend** — `services/vision/*`, `services/analysis-engine/*`, `services/annotation/*`, `services/settings/*`, `models/Setting.js`, `models/Analysis.js` (étendu), `NvidiaVisionProvider`, routes `/admin/settings`, `scanController` en pipeline.
**Frontend** — `AdminAIConfig` éditable + sections Vision/NVIDIA/SebPay, `AnnotatedChart.jsx` + panneau de couches, intégration dans `AnalysisDetail`/`AnalysisResult`.
**Config** — `SETTINGS_ENC_KEY`, `NVIDIA_API_KEY`/`NVIDIA_BASE_URL`/`NVIDIA_MODEL` dans `config/index.js` + `.env.example`.

**Objectif atteint** : une plateforme d'analyse graphique modulaire, évolutive et administrable, où la Vision pa
r Ordinateur perçoit d'abord, raisonne ensuite, décide avec transparence, explique pédagogiquement — et où l'admin ajoute/remplace modèles et clés API (SebPay, Anthropic, Gemini, OpenAI, NVIDIA) depuis son dashboard, sans redéploiement.
