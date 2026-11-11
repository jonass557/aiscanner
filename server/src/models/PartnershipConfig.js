import mongoose from 'mongoose';

export const DEFAULT_PARTNERSHIP_TERMS = `CONDITIONS GÉNÉRALES DU PROGRAMME DE PARTENARIAT VIP — AI CHART SCANNER

1. ACCÈS À VIE À LA PLATEFORME
En rejoignant le Programme de Partenariat VIP, votre compte bénéficie immédiatement d'un accès illimité et à vie à l'ensemble des outils IA d'AI Chart Scanner (Scanner IA, Chart Vision, Robot Trading, Multi-Timeframe, Mentor IA, Assistant Vocal, etc.) sans frais d'abonnement mensuel récurrents.

2. RÉMUNÉRATION & PARTAGE DES REVENUS (30% PARTENAIRE / 70% ADMIN)
- Chaque utilisateur s'inscrivant et souscrivant à un abonnement (mensuel, bimestriel, trimestriel, semestriel ou annuel) via votre lien d'affiliation unique génère une commission de 30% (taux configurable par l'administration) sur le montant de sa souscription, créditée sur votre espace Partenaire à chaque période de souscription.
- Les 70% restants reviennent à l'administration pour la maintenance de l'infrastructure et des serveurs IA.
- Vous pouvez consulter vos statistiques en temps réel et retirer vos gains à tout moment via Mobile Money (iKeePay H2H).

3. OBLIGATION D'ACTIVITÉ MENSUELLE (RÈGLE DES AFFILIÉS)
Pour conserver vos avantages de Partenaire VIP et votre accès à vie gratuit, vous devez parrainer au moins un (1) nouvel utilisateur affilié au cours de chaque période d'un mois (30 jours).
Si durant un mois entier vous n'enregistrez aucun nouvel affilié via votre lien, l'administrateur se réserve le droit de suspendre ou d'exclure votre statut de partenaire et vos privilèges associés.

4. FORMULAIRE D'IDENTIFICATION & ACTIVATION
Immédiatement après validation du paiement, le partenaire doit compléter le formulaire d'identification (Nom complet, Email, Numéro de téléphone) transmis à l'administrateur pour activer définitivement son espace Partenaire.`;

const partnershipConfigSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'default' },
    isEnabled: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    title: { type: String, default: 'Programme de Partenariat VIP' },
    subtitle: {
      type: String,
      default: 'Accès à vie illimité + 30% de commission récurrente chaque mois sur tous vos affiliés',
    },
    badgeText: { type: String, default: 'Places Limitées · VIP Partenaire' },
    price: { type: Number, default: 50000, min: 0 },
    currency: { type: String, default: 'XOF' },
    maxPartners: { type: Number, default: 50, min: 1 },
    commissionRate: { type: Number, default: 30, min: 1, max: 95 },
    creditTiming: {
      type: String,
      enum: ['instant', 'period_end'],
      default: 'instant',
    },
    benefits: {
      type: [String],
      default: [
        'Accès 100% illimité et à vie à tous les outils IA',
        '30% de commission récurrente chaque mois sur vos filleuls abonnés',
        'Lien de parrainage exclusif & Dashboard Partenaire temps réel',
        'Retrait instantané de vos gains via Mobile Money (iKeePay H2H)',
      ],
    },
    termsAndConditions: {
      type: String,
      default: DEFAULT_PARTNERSHIP_TERMS,
    },
    adminPoolBalance: { type: Number, default: 0 },
    adminPoolTotalEarned: { type: Number, default: 0 },
    adminPoolTotalWithdrawn: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const PartnershipConfig = mongoose.model('PartnershipConfig', partnershipConfigSchema);
export default PartnershipConfig;
