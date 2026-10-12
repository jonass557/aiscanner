/**
 * Initial institutional syllabus templates calibrated by student level.
 * Grounded in peer-reviewed and hedge-fund accredited trading methodology.
 */

export const CURRICULUM_TEMPLATES = {
  beginner: [
    {
      id: 'beg_1',
      title: 'Module 1 : Anatomie du Marché et Mécanique des Prix',
      description: 'Comprendre comment le prix bouge, le rôle des teneurs de marché et la structure élémentaire.',
      objectives: [
        'Différencier prix d\'achat (Ask) et prix de vente (Bid)',
        'Identifier les plus hauts plus hauts (HH) et plus bas plus bas (LL)',
        'Comprendre pourquoi le marché recherche constamment des contreparties',
      ],
      chartIllustration: `
        [HH]
        /\\
       /  \\   [HL]
      /    \\  /\\
     /      \\/  \\
    [LL]
Structure Haussière Saine : Chaque creux [HL] protège la liquidité.
      `,
      exercise: {
        question: 'Sur une paire de devises EUR/USD en tendance haussière, un trader débutant voit le prix casser le dernier creux significatif (HL). Quelle est la signification structurelle de cet événement, et que doit faire le trader avant de se précipiter à la vente ?',
        context: 'Le prix évolue sur M15 après une annonce économique américaine.',
        hint: 'Pensez au concept de Change of Character (CHoCH) ou de balayage de liquidité (liquidity sweep / fakeout).',
        passingScore: 70,
      },
      status: 'in_progress',
    },
    {
      id: 'beg_2',
      title: 'Module 2 : Mathématiques du Risque & Gestion du Capital',
      description: 'L\'espérance mathématique positive et la survie à long terme selon Taleb et Mark Douglas.',
      objectives: [
        'Calculer la taille de position exacte en fonction du Stop Loss',
        'Ne jamais risquer plus de 1% du capital par trade',
        'Comprendre pourquoi un taux de réussite de 40% peut être très rentable avec un R:R de 1:3',
      ],
      chartIllustration: `
[Capital: 10,000$]
Risque max (1%) = 100$
Stop Loss = 20 pips -> Taille = 0.50 Lot
Target (R:R 1:3) = 60 pips -> Gain = +300$
      `,
      exercise: {
        question: 'Vous avez un compte de trading de 5 000 $. Vous souhaitez entrer à l\'achat sur GBP/USD avec un Stop Loss placé à 25 pips de votre point d\'entrée. En respectant la règle d\'or de 1% de risque maximum par transaction, quelle perte maximale en dollars pouvez-vous accepter, et quel doit être votre objectif minimum de gain en pips pour un ratio Risk/Reward de 1:2.5 ?',
        context: 'Calcul mathématique pur de dimensionnement et de ratio R:R.',
        hint: '1% de 5 000$ = 50$. Multipliez le risque en pips par le ratio 2.5 pour obtenir la cible.',
        passingScore: 75,
      },
      status: 'locked',
    },
    {
      id: 'beg_3',
      title: 'Module 3 : Les Piliers du Price Action & Zones Majeures',
      description: 'Identifier les zones de support, résistance et rejets institutionnels sans indicateurs superflus.',
      objectives: [
        'Tracer les zones clés de réaction sans surcharger le graphique',
        'Reconnaître les mèches de rejet et l\'absorption des volumes',
        'Distinguer un pullback sain d\'un renversement majeur',
      ],
      chartIllustration: `
================= RÉSISTANCE MAJEURE =================
        | (Mèche de rejet)
      [===] Corps baissier
        |
        V (Déplacement impulsif vers le bas)
      `,
      exercise: {
        question: 'Pourquoi entrer aveuglément dès qu\'un prix touche une ligne horizontale de support est-il considéré comme une erreur par les traders institutionnels ? Quelle confirmation concrète devez-vous attendre ?',
        context: 'Le prix arrive violemment sur un support journalier avec une bougie pleine.',
        hint: 'Pensez à la liquidité sous le support (Sell-Side Liquidity) et au besoin d\'un déplacement baissier/haussier validé (MSS/CHoCH).',
        passingScore: 70,
      },
      status: 'locked',
    },
  ],

  intermediate: [
    {
      id: 'int_1',
      title: 'Module 1 : Smart Money Concepts — Structure, BOS & CHoCH',
      description: 'Maîtriser la cartographie de marché institutionnelle et la transition de tendance.',
      objectives: [
        'Distinguer un Break of Structure (BOS) de continuation d\'un Change of Character (CHoCH)',
        'Différencier une cassure franche en clôture de bougie d\'un simple balayage par mèche (Liquidity Grab)',
        'Cartographier les zones Premium et Discount avec l\'outil Fibonacci institutionnel',
      ],
      chartIllustration: `
      [High 1]           [BOS] ---> Continuation
         /\\               /\\
        /  \\             /  \\
       /    \\   [HL]    /    \\
      /      \\  /\\     /
              \\/  \\---/ [Order Block non-mitigé]
                  
ZONE DISCOUNT : 50% - 79% de retracement pour ACHAT optimal.
      `,
      exercise: {
        question: 'Sur le graphique H1 de l\'or (XAU/USD), le prix crée un nouveau plus haut en dépassant le sommet précédent uniquement avec une mèche de 15 pips, avant de réintégrer immédiatement sous le sommet avec une clôture rouge agressive. S\'agit-il d\'un BOS haussier ou d\'un balayage de liquidité (Buy-Side Liquidity Purge) ? Quelle conclusion en tirez-vous pour votre biais intraday ?',
        context: 'Séance de Londres, 10h00 GMT.',
        hint: 'Rappelez-vous la règle institutionnelle : la liquidité est capturée par les mèches, la structure est confirmée par les clôtures de corps.',
        passingScore: 75,
      },
      status: 'in_progress',
    },
    {
      id: 'int_2',
      title: 'Module 2 : Order Blocks Institutionnels & Fair Value Gaps (FVG)',
      description: 'Repérer les empreintes indélébiles des algorithmes bancaires et des banques centrales.',
      objectives: [
        'Identifier un Order Block valide ayant provoqué un déséquilibre (Imbalance/FVG)',
        'Mesurer la zone de Fair Value Gap (bougie 1, 2 et 3) et le point d\'équilibre (Consequent Encroachment - 50%)',
        'Sélectionner les Order Blocks extrêmes vs de continuation',
      ],
      chartIllustration: `
Bougie 1 : High à 1.0850
Bougie 2 : Grande impulsion verte haussière
Bougie 3 : Low à 1.0870
===> [FAIR VALUE GAP non-mitigé : 1.0850 à 1.0870] <===
Le prix reviendra combler cette inefficacité avant de repartir.
      `,
      exercise: {
        question: 'Quels sont les 3 critères cumulatifs qui rendent un Order Block (OB) haussier hautement probable et valide selon les institutions ? Pourquoi un OB sans FVG associé présente-t-il un risque élevé d\'échec ?',
        context: 'Analyse d\'une configuration H4 sur l\'indice US30 / Dow Jones.',
        hint: 'Critères : balayage de liquidité préalable, déplacement violent créant un FVG, et cassure structurelle (BOS/MSS).',
        passingScore: 75,
      },
      status: 'locked',
    },
    {
      id: 'int_3',
      title: 'Module 3 : Top-Down Multi-Timeframe Confluence',
      description: 'Harmoniser le macro (Daily/H4) et le micro (M15/M5/M1) pour des ratios Risk/Reward asymétriques.',
      objectives: [
        'Définir le biais directionnel majeur sur HTF (Higher Timeframe)',
        'Attendre l\'arrivée dans un POI (Point of Interest) HTF',
        'Exécuter sur LTF uniquement après confirmation de structure alignée',
      ],
      chartIllustration: `
[HTF D1/H4] : Tendance baissière -> POI Bearish Order Block à 1.1000
   |
   V  (Attente de contact)
[LTF M5]    : Le prix touche 1.1000 -> MSS baissier confirmé en M5
   |
   +-----> Entrée Short avec SL serré de 8 pips, TP à 60 pips (R:R 1:7.5)
      `,
      exercise: {
        question: 'Le biais H4 est fortement baissier, mais le prix en M15 est en train de monter vers un Order Block H4 non-mitigé. Un trader débutant veut acheter en M15 pour attraper le mouvement. Quelle est la recommandation d\'un gestionnaire de hedge fund dans cette situation ?',
        context: 'Gestion de flux d\'ordres multi-unités de temps.',
        hint: 'Trader contre le flux HTF (counter-trend) comporte un risque asymétrique négatif. Quelle est la position professionnelle à adopter ?',
        passingScore: 75,
      },
      status: 'locked',
    },
  ],

  advanced: [
    {
      id: 'adv_1',
      title: 'Module 1 : Auction Market Theory, Order Flow & Liquidité Algorithmique',
      description: 'L\'ingénierie de la liquidité institutionnelle, les pools d\'ordres et les divergences SMT.',
      objectives: [
        'Comprendre les Smart Money Tool (SMT) Divergences entre actifs corrélés (EURUSD vs GBPUSD, ES vs NQ)',
        'Analyser les ouvertures de sessions (London Open Killzone, NY AM Killzone, Judas Swing)',
        'Détecter l\'absorption passive par les ordres limites institutionnels',
      ],
      chartIllustration: `
EUR/USD : Fait un nouveau PLUS HAUT (High)
GBP/USD : Échoue et fait un PLUS HAUT INFÉRIEUR (Lower High)
======================================================
DIVERGENCE SMT CRITIQUE : Manque de sponsoring institutionnel !
Signal fort d\'un retournement baissier imminent sur le panier devises.
      `,
      exercise: {
        question: 'Expliquez en détail le mécanisme institutionnel d\'un "Judas Swing" à l\'ouverture de la session de Londres (07h00 - 08h30 GMT) sur EUR/USD. Comment les teneurs de marché créent-ils une fausse impulsion pour accumuler leurs positions réelles ?',
        context: 'Session de Londres, manipulation initiale des cours au-dessus des plus hauts de la session asiatique (Asian Highs).',
        hint: 'Considérez les ordres Stop des vendeurs asiatiques et les Breakout Buyers déclenchés pour absorber la liquidité d\'achat.',
        passingScore: 80,
      },
      status: 'in_progress',
    },
    {
      id: 'adv_2',
      title: 'Module 2 : Modèles Quantitatifs de Gestion du Risque & Espérance Asymétrique',
      description: 'Optimisation de portefeuille, contrôle du Drawdown maximal et modélisation de Monte Carlo.',
      objectives: [
        'Calculer et appliquer le critère de Kelly fractionnaire (Half-Kelly)',
        'Gérer le risque systémique corrélé (Forex Risk Clustering)',
        'Élaborer un plan de dé-risquage progressif (Scale out & trailing stop institutionnel)',
      ],
      chartIllustration: `
Formule d'espérance mathématique :
E = (Probabilité de Gain × R:R) - (Probabilité de Perte × 1)
Si Winrate = 45%, R:R = 1:2.5 :
E = (0.45 × 2.5) - (0.55 × 1) = 1.125 - 0.55 = +0.575R par trade.
      `,
      exercise: {
        question: 'Un trader professionnel exécute 200 trades avec un taux de réussite vérifié de 40% et un ratio moyen Risk/Reward de 1:2.8. Quelle est son espérance mathématique nette par unité de risque ? Pourquoi une série de 7 pertes consécutives est-elle statistiquement inévitable sur cet échantillon, et quelle règle stricte de drawdown doit-il appliquer pour préserver son capital ?',
        context: 'Statistiques de prop firm institutionnelle.',
        hint: 'Appliquez la formule E = (W * R) - (L * 1). Analysez la probabilité d\'une série de pertes avec (0.6)^7.',
        passingScore: 80,
      },
      status: 'locked',
    },
  ],
};

/**
 * Returns a cloned curriculum array for a student level.
 */
export const getInitialCurriculum = (level = 'intermediate') => {
  const template = CURRICULUM_TEMPLATES[level] || CURRICULUM_TEMPLATES.intermediate;
  return JSON.parse(JSON.stringify(template));
};
