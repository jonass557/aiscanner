import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Gift,
  Crown,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userApi, partnershipApi } from '../../services/endpoints.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import H2HPlanCheckoutModal from '../payments/H2HPlanCheckoutModal.jsx';
import PartnershipModal from '../partnership/PartnershipModal.jsx';

// Fallback synchronized with admin defaults
const FALLBACK_PLANS = [
  {
    id: '1mois',
    name: 'Plan 1 Mois',
    price: 7000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: true, days: 7 },
    promo: { enabled: false, price: 3000, description: 'Offre après essai' },
    features: [
      'Essai gratuit sans engagement',
      'Scans & analyses illimités (∞)',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision en direct',
      'IA Trading Delegate & Alertes sentinelles',
      'IA Mentor bilingue FR/EN vocal',
      'Support prioritaire WhatsApp',
    ],
  },
  {
    id: '2mois',
    name: 'Plan 2 Mois',
    price: 13000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: false, days: 0 },
    promo: { enabled: false, price: 10000, description: 'Tarif promotionnel' },
    features: [
      'Économisez sur 2 mois d’abonnement',
      'Scans & analyses illimités (∞)',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision en direct',
      'AI Managed Trading & Synchronisation broker',
      'Backtesting Studio Replay illimité',
      'Support prioritaire WhatsApp 24/7',
    ],
  },
  {
    id: '6mois',
    name: 'Plan 6 Mois VIP',
    price: 35000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: false, days: 0 },
    promo: { enabled: false, price: 28000, description: 'Offre Semestrielle VIP' },
    features: [
      'Offre Semestrielle VIP (-30% de remise)',
      'Scans & analyses illimités (∞)',
      'Accès complet à tous les 11 outils IA de pointe',
      'Signaux institutionnels en direct 24/7',
      'Intégration directe de vos stratégies personnalisées',
      'Audit sur mesure de vos configurations de trade',
      'Ligne directe WhatsApp VIP dédiée',
    ],
  },
];

export const formatPrice = (amount, currency = 'XOF') => {
  const num = Number(amount) || 0;
  if (currency === 'XOF' || currency === 'XAF') {
    return `${num.toLocaleString('fr-FR')} FCFA`;
  }
  if (currency === 'USD') {
    return `$${num.toLocaleString('en-US')}`;
  }
  return `${num.toLocaleString()} ${currency}`;
};

export default function Pricing() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [partnerConfig, setPartnerConfig] = useState(null);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);

  const { lang } = useLanguage();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const isEn = lang === 'en';

  const loadPartnerConfig = () => {
    partnershipApi
      .getConfig()
      .then(({ data }) => {
        const cfg = data?.data;
        if (cfg && cfg.isEnabled && !cfg.isDeleted) {
          setPartnerConfig(cfg);
        } else {
          setPartnerConfig(null);
        }
      })
      .catch(() => setPartnerConfig(null));
  };

  useEffect(() => {
    userApi
      .plans()
      .then(({ data }) => {
        const fetched = data?.data?.plans;
        if (Array.isArray(fetched) && fetched.length > 0) {
          const active = fetched
            .filter((p) => p.isActive !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          setPlans(active.length > 0 ? active : FALLBACK_PLANS);
        }
      })
      .catch(() => setPlans(FALLBACK_PLANS));

    loadPartnerConfig();
  }, []);

  const openCheckout = (plan) => {
    if (isAuthenticated) {
      navigate(`/dashboard/subscription?plan=${plan.id}`);
      return;
    }
    setCheckoutPlan(plan);
  };

  const hasPartnerCard = Boolean(partnerConfig && partnerConfig.isEnabled && !partnerConfig.isDeleted);

  return (
    <section id="pricing" className="relative py-24 bg-slate-950 overflow-hidden">
      {/* Background Glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-cyan-500/10 blur-[150px]" />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Title & Tagline */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            {isEn ? 'FLEXIBLE & TRANSPARENT SUBSCRIPTIONS' : 'PLANS & ABONNEMENTS SANS ENGAGEMENT'}
          </span>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-5xl">
            {isEn ? 'Invest in Your Edge, ' : 'Investissez dans Votre Avantage, '}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
              {isEn ? 'Trade Like a Prop Firm' : 'Tradez comme un Pro'}
            </span>
          </h2>

          <p className="mt-4 text-base text-slate-300">
            {isEn
              ? 'Start today with our free trial or join our Lifetime VIP Partnership Program via iKeePay Mobile Money.'
              : 'Commencez dès aujourd’hui avec notre essai gratuit ou rejoignez notre Programme de Partenariat VIP à vie via iKeePay Mobile Money.'}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className={`mt-14 grid gap-8 ${hasPartnerCard ? 'lg:grid-cols-4 md:grid-cols-2' : 'lg:grid-cols-3'}`}>
          {plans.map((plan, i) => {
            const isOneMonth = plan.id === '1mois';
            const isTwoMonths = plan.id === '2mois';
            const isSixMonths = plan.id === '6mois';
            const hasTrial = Boolean(plan.trial?.enabled && isOneMonth);
            const hasPromo = Boolean(plan.promo?.enabled);
            const highlighted = isOneMonth;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col justify-between rounded-2xl border p-7 backdrop-blur-xl transition-all ${
                  highlighted
                    ? 'border-cyan-500/60 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl shadow-cyan-500/20 lg:-translate-y-2'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                {hasTrial && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-lg flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" />
                    {plan.trial?.days && plan.trial.days > 0
                      ? `${plan.trial.days} ${isEn ? 'Days Free Trial' : 'Jours d’Essai Gratuit'}`
                      : 'Essai Gratuit'}
                  </span>
                )}

                {isSixMonths && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-lg">
                    👑 VIP (-30%)
                  </span>
                )}

                {isTwoMonths && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-500/20 border border-indigo-500/40 px-3 py-0.5 text-[11px] font-bold text-indigo-300">
                    Formule 2 Mois
                  </span>
                )}

                <div>
                  <h3 className="text-xl font-black text-white">{plan.name}</h3>

                  <div className="mt-5">
                    {hasPromo ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 line-through">
                            {formatPrice(plan.price, plan.currency)}
                          </span>
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                            PROMO
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-3xl font-black text-cyan-300">
                            {formatPrice(plan.promo.price, plan.currency)}
                          </span>
                          <span className="text-xs text-slate-400">
                            / {plan.promo.durationMonths || 1} mois
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black tracking-tight text-white">
                          {formatPrice(plan.price, plan.currency)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {isOneMonth ? '/ mois' : isTwoMonths ? '/ 2 mois' : '/ 6 mois'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-slate-800">
                    <Zap className="h-3.5 w-3.5" />
                    Scans Illimités (∞)
                  </div>

                  <ul className="mt-6 space-y-2.5 border-t border-slate-800/80 pt-5">
                    {(plan.features || []).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-7 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (hasTrial) {
                        navigate(`/register?plan=${plan.id}&trial=true`);
                      } else {
                        openCheckout(plan);
                      }
                    }}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-black transition-all ${
                      highlighted
                        ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 text-slate-950 shadow-xl shadow-cyan-500/25 hover:brightness-110 active:scale-95'
                        : 'border border-slate-700 bg-slate-800/90 text-white hover:bg-slate-700 hover:border-cyan-500/40'
                    }`}
                  >
                    {hasTrial
                      ? plan.trial?.days && plan.trial.days > 0
                        ? `Démarrer l’Essai (${plan.trial.days}j)`
                        : 'Démarrer l’Essai Gratuit'
                      : `Choisir le ${plan.name}`}
                    <ArrowRight className="h-4 w-4" />
                  </button>

                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    {hasTrial ? '0 FCFA aujourd’hui · Sans engagement' : 'Paiement direct Mobile Money H2H'}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* VIP Partnership Program Card in Plans Section */}
          {hasPartnerCard && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: plans.length * 0.1 }}
              className="relative flex flex-col justify-between rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-amber-950/35 via-slate-900/95 to-slate-950 p-7 backdrop-blur-xl shadow-2xl shadow-amber-500/15"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-slate-950 shadow-lg flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" />
                Partenariat VIP
              </span>

              <div>
                <h3 className="text-xl font-black text-amber-300">{partnerConfig.title || 'Programme Partenaire'}</h3>
                <p className="mt-1 text-xs text-slate-300">{partnerConfig.subtitle}</p>

                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="text-3xl font-black tracking-tight text-white">
                    {formatPrice(partnerConfig.price, partnerConfig.currency)}
                  </span>
                  <span className="text-xs font-mono text-amber-300">/ à vie</span>
                </div>

                <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                  <Users className="h-3.5 w-3.5" />
                  {partnerConfig.spotsRemaining} / {partnerConfig.maxPartners} places restantes
                </div>

                <ul className="mt-6 space-y-2.5 border-t border-amber-500/20 pt-5">
                  {(partnerConfig.benefits || []).map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-7 pt-4">
                <button
                  type="button"
                  onClick={() => setPartnerModalOpen(true)}
                  disabled={Number(partnerConfig.spotsRemaining) <= 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 py-3.5 text-xs font-black text-slate-950 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-95 transition disabled:opacity-40"
                >
                  <Crown className="h-4 w-4" />
                  <span>
                    {Number(partnerConfig.spotsRemaining) <= 0
                      ? 'Places Complètes'
                      : 'Détails, Conditions & Adhérer'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-2 text-center text-[11px] text-amber-300/80">
                  Commission {partnerConfig.commissionRate || 30}% à vie · Accès immédiat
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Security / Payment Icons Under Plans */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 border-t border-slate-800/80 pt-8 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Paiement sécurisé crypté SSL (iKeePay H2H)</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            <span>Mobile Money (Orange, MTN, Wave, Moov, Mobicash, Airtel, Vodacom)</span>
          </div>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-amber-400" />
            <span>Essai gratuit sans carte bancaire</span>
          </div>
        </div>
      </div>

      {/* Shared iKeePay H2H Plan Checkout Modal */}
      <H2HPlanCheckoutModal
        isOpen={Boolean(checkoutPlan)}
        plan={checkoutPlan}
        isAuthenticated={false}
        onClose={() => setCheckoutPlan(null)}
        onApproved={({ orderId, email, fullName, plan }) => {
          setTimeout(() => {
            setCheckoutPlan(null);
            navigate(
              `/register?orderId=${encodeURIComponent(orderId)}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(
                fullName
              )}&plan=${plan.id}`
            );
          }, 1200);
        }}
      />

      {/* Partnership Modal (Details + Terms + H2H Payin + Form sent to Admin) */}
      <PartnershipModal
        isOpen={partnerModalOpen}
        config={partnerConfig}
        onClose={() => setPartnerModalOpen(false)}
        onCompleted={loadPartnerConfig}
      />
    </section>
  );
}
