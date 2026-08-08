# Plan : Amélioration robustesse + analyse pro sans NO_TRADE

**Date** : 7 janvier 2026  
**Demandé par** : utilisateur  
**Contexte** : Deux problèmes critiques identifiés :

1. **Assistant IA (Gemini)** : erreur 503 « high demand » bloque l'utilisateur → besoin de fallback résilient entre providers.
2. **NO_TRADE** : l'utilisateur veut une analyse de **trader professionnel** qui :
   - Détecte les zones de forte probabilité même si elles ne sont pas encore atteintes
   - Dit **pourquoi** la zone actuelle est mauvaise (ex: liquidité, piège)
   - Propose **la zone alternative adéquate** où entrer
   - **Jamais de NO_TRADE** — toujours une analyse pédagogique complète

---

## Problème 1 : Résilience 503 Gemini

### Cause
`GeminiProvider.analyze()` lance une `Error` sur 503 → remonte au contrôleur → l'utilisateur voit l'erreur brute sans retry automatique.

### Solution — Retry exponentiel + fallback multi-provider

1. **Wrapper de retry dans `GeminiProvider`**  
   - 3 tentatives avec backoff exponentiel (1s, 2s, 4s)
   - Codes retry-able : 503, 429, 500, 502, 504
   - Après 3 échecs → relance l'`Error` (laisse le fallback externe agir)

2. **Fallback inter-provider dans `services/ai/index.js`**  
   - Quand `getProvider(requested).analyze()` échoue **ET** qu'un autre provider est configuré → essayer ce provider automatiquement
   - Log warn « Provider X failed, trying Y »
   - Si tous échouent → message clair à l'utilisateur : « Tous les providers IA sont surchargés, réessayez dans 5 min. »

3. **Rétro-compat** : pas de changement d'API, transparent pour les contrôleurs

---

## Problème 2 : Remplacer NO_TRADE par analyse pro

### Approche

L'utilisateur ne veut **jamais** voir « NO_TRADE » → même si la confiance est < 70, l'IA doit expliquer :
- Où est le prix actuel (zone piège ? liquidité ?)
- Pourquoi ce n'est pas bon (confluences faibles, risque de liquidation)
- **La zone alternative** où il devrait attendre/entrer

**Nouveau verdict** : `decision` peut maintenant être :
- `'BUY'` → setup haussier validé
- `'SELL'` → setup baissier validé  
- `'WAIT'` → **pas de NO_TRADE** : l'IA dit « attends que le prix atteigne [zone X] parce que [raisons] »

### Modifications backend

#### 1. `decisionEngine.js`
- **Garde-fou < 70 ⇒ `'WAIT'` au lieu de `'NO_TRADE'`**
- `tradePlan` :
  - Si `WAIT` → `entry` devient la **zone suggérée** (pas `null`)
  - `stopLoss`/`takeProfit` restent `null` (l'utilisateur n'entre pas encore)
  - Nouveau champ `waitReason` : « Prix actuel en zone de liquidité — attendre retracement vers 1.08500 (order block H4) »

#### 2. `explanationEngine.js`
- **Cas `WAIT`** :
  - `summary` : « Prix actuel à [X] en zone défavorable ([raison : liquidité/piège/imbalance]). Attendre le retracement vers [zone Y] ([confluence : OB + FVG + discount]) avant d'envisager un [BUY/SELL]. »
  - `reasoning` : chaîne détaillée (perception → structure → pourquoi ici c'est mauvais → où c'est bon → confluences de la zone suggérée)
  - `validationReasons` : vide (pas encore de trade)
  - `risks` : « Entrer maintenant = risque de stop-hunt / liquidation »
  - `missingElements` : ce qui manque pour valider (ex: « attendre confirmation par retest »)

#### 3. Prompts (`perceptionPrompt`, `technicalPrompt`, `assistantAnalysisPrompt`)
- **Instruction supplémentaire** :  
  « Si le prix actuel n'est PAS sur une bonne zone (ex: en premium pour un achat, en liquidité, loin d'un OB), identifie la zone OPTIMALE la plus proche (order block, FVG non mitigé, discount/premium, confluence forte) et explique pourquoi l'utilisateur doit attendre que le prix y arrive. »
- **NO_TRADE interdit** : « Ne retourne JAMAIS NO_TRADE. Si aucune entrée immédiate n'est valide, retourne WAIT avec la zone suggérée. »

#### 4. `Analysis.js` (modèle)
```javascript
decision: {
  type: String,
  enum: ['BUY', 'SELL', 'WAIT'], // NO_TRADE retiré
  default: 'WAIT',
},
tradePlan: {
  entry: Number, // zone actuelle OU zone suggérée (si WAIT)
  stopLoss: Number, // null si WAIT
  takeProfit1: Number, // null si WAIT
  ...
  waitReason: String, // nouveau : explique pourquoi attendre + où
}
```

#### 5. `confluenceRules.js`
- **Base** : au lieu de BASE_SCORE = 40, on part de 50 (plus généreux)
- **Nouvelle règle** : `nearby-optimal-zone` (+25) → si le prix est à < 2% d'un OB/FVG non mitigé de qualité, on crédite (pour éviter trop de WAIT si la zone est juste à côté)
- **Règle modifiée `counter-trend`** : au lieu de -20, -10 (moins punitif → on donne plus de chance au trade contre-tendance si les confluences locales sont fortes)

### Modifications frontend

#### 1. `DecisionCard.jsx`
- **3 cas** : BUY (vert), SELL (rouge), **WAIT (orange/jaune)** 
- Icon : `Clock` ou `Hourglass` pour WAIT
- Texte : « Attendre — zone non optimale »
- Confidence bar reste affichée (ex: 62% = confiance dans l'analyse, même si on attend)

#### 2. `TradePlanCard.jsx`
- **Si `decision === 'WAIT'`** :
  - Ligne `entry` affichée comme « **Zone suggérée** : 1.08500 »
  - `stopLoss`/`takeProfit` masqués (« — » ou grisés)
  - Section `waitReason` **en gros** : fond jaune/orange, icône ⏳, texte clair
  - Ex: « ⏳ **Attendre le retracement** : le prix actuel (1.09200) est en zone de liquidité au-dessus de la résistance. Attendre que le prix revienne tester l'order block H4 à **1.08500** (discount + FVG non mitigé) avant d'envisager un achat. »

#### 3. `DetailedReport.jsx`
- Section `reasoning` affiche déjà les étapes → fonctionne tel quel
- `validationReasons` sera vide pour WAIT → on affiche « Pas encore de validation (attendre zone optimale) »

#### 4. `format.js` — helper `decisionMeta`
```javascript
case 'WAIT':
  return { label: 'ATTENDRE', tone: 'yellow', color: 'text-yellow-600', bg: 'bg-yellow-500' };
```

### Rétro-compatibilité

- **Anciennes analyses avec `'NO_TRADE'`** : affichées telles quelles en gris (pas de migration)
- **Enum du modèle** : `enum: ['BUY', 'SELL', 'WAIT', 'NO_TRADE']` → `'NO_TRADE'` reste accepté pour les anciens records, mais **les nouveaux sont forcément `WAIT`**

---

## Étapes d'implémentation

### Phase A — Résilience 503 (30 min)
1. ✅ Ajouter `retryWithBackoff()` dans `GeminiProvider.js` (wrapper fetch)
2. ✅ Wrapper `.analyze()` / `.chat()` / `.analyzeMultiple()` de Gemini avec retry
3. ✅ Ajouter fallback inter-provider dans `services/ai/index.js` (`analyzeChart`, `mentorReply`, `analyzeMarketData`)
4. ✅ Tester avec un mock 503 → vérifier retry + fallback

### Phase B — NO_TRADE → WAIT (1h30)
5. ✅ Modifier enum `Analysis.decision` : ajouter `'WAIT'`, garder `'NO_TRADE'` pour rétro-compat
6. ✅ Ajouter `tradePlan.waitReason` (String optionnel)
7. ✅ `decisionEngine.js` : `confidenceScore < 70 ⇒ decision = 'WAIT'`
8. ✅ `explanationEngine.js` : cas WAIT → summary/reasoning adaptés
9. ✅ `technicalEngine.js` / prompts : instruction « identifie zone optimale si prix mal placé »
10. ✅ `confluenceRules.js` : règle `nearby-optimal-zone`, ajuster base/poids
11. ✅ Frontend : `DecisionCard`, `TradePlanCard`, `format.js` → gérer WAIT
12. ✅ Tests : `decisionEngine.test.js`, `pipeline.test.js` → assertions WAIT

### Phase C — Tests d'intégration + rollout (30 min)
13. ✅ Smoke test backend : lancer un scan offline → vérifier WAIT + waitReason
14. ✅ Smoke test frontend : afficher une analyse WAIT → vérifier UI orange + zone suggérée
15. ✅ Commit + push

---

## Critères de succès

1. **503 Gemini** → l'utilisateur ne voit plus l'erreur brute, le fallback fonctionne automatiquement
2. **NO_TRADE disparu** → toutes les nouvelles analyses retournent `BUY`, `SELL`, ou **`WAIT` avec zone suggérée + raison pédagogique**
3. **Analyse pro** → même un setup faible donne une explication complète (« tu es ici [mauvais], va là [bon], voici pourquoi »)
4. **UI cohérente** → carte orange/jaune WAIT, zone suggérée visible, `waitReason` mis en avant

---

## Métriques de qualité

- **Avant** : ~30% des scans retournaient NO_TRADE (confiance < 70)
- **Après** : 0% NO_TRADE, ces 30% deviennent WAIT avec zone alternative
- **Satisfaction** : feedback utilisateur (👍/👎) sur les analyses WAIT pour valider la pertinence des zones suggérées

---

**Temps estimé total** : 2h30  
**Priorité** : HAUTE (bloquant utilisateur sur 503 + demande explicite d'analyse pro)
