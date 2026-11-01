import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Sparkles, ShieldCheck, Zap, ArrowRight, Gift } from 'lucide-react';
import { userApi } from '../../services/endpoints.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

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
      'Essai gratuit 7 jours sans engagement',
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
      'Accès complet aux 11 outils IA de pointe',
      'Signaux institutionnels en direct 24/7',
      'Intégration directe de vos stratégies personnalisées',
      'Audit sur mesure de vos configurations de trade',
      'Ligne directe WhatsApp VIP dédiée',
    ],
  },
];

export const formatPrice = (amount, currency = 'XOF') => {
  const num = Number(amount) || 0;
  if (currency === 'XOF') {
    return `${num.toLocaleString('fr-FR')} FCFA`;
  }
  if (currency === 'USD') {
    return `$${num.toLocaleString('en-US')}`;
  }
  return `${num.toLocaleString()} ${currency}`;
};

export default function Pricing() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const { lang } = useLanguage();
  const { isAuthenticated } = useAuth();
  const isEn = lang === 'en';

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
  }, []);

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
              ? 'Start today with a 7-day free trial on the 1-Month Plan. All plans include 100% unlimited scans and full algorithmic power.'
              : 'Commencez dès aujourd’hui avec l’essai gratuit de 7 jours sur le Plan 1 Mois. Tous les plans incluent des scans 100% illimités.'}
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid gap-8 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const isOneMonth = plan.id === '1mois';
            const isTwoMonths = plan.id === '2mois';
            const isSixMonths = plan.id === '6mois';
            const hasTrial = Boolean(plan.trial?.enabled && isOneMonth);
            const hasPromo = Boolean(plan.promo?.enabled);

            // Highlighted plan
            const highlighted = isOneMonth;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative flex flex-col justify-between rounded-2xl border p-8 backdrop-blur-xl transition-all ${
                  highlighted
                    ? 'border-cyan-500/60 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl shadow-cyan-500/20 lg:-translate-y-3'
                    : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                }`}
              >
                {/* Floating Top Badges */}
                {hasTrial && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-4 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/30 flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" />
                    {isEn ? '7-Day Free Trial' : '7 Jours d’Essai Gratuit'}
                  </span>
                )}

                {isSixMonths && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-1 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-amber-500/30">
                    👑 {isEn ? 'VIP Best Value (-30%)' : 'VIP Meilleure Offre (-30%)'}
                  </span>
                )}

                {isTwoMonths && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500/20 border border-indigo-500/40 px-3.5 py-0.5 text-[11px] font-bold text-indigo-300">
                    {isEn ? '2-Month Pack' : 'Formule 2 Mois'}
                  </span>
                )}

                <div>
                  {/* Plan Name */}
                  <h3 className="text-xl font-black text-white">{plan.name}</h3>

                  {/* Price Section */}
                  <div className="mt-5">
                    {hasPromo ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 line-through">
                            {formatPrice(plan.price, plan.currency)}
                          </span>
                          <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                            PROMO ACTIVE
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline gap-1">
                          <span className="text-3xl font-black text-cyan-300">
                            {formatPrice(plan.promo.price, plan.currency)}
                          </span>
                          <span className="text-xs text-slate-400">
                            / {plan.promo.durationMonths || 1} {isEn ? 'month' : 'mois'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-cyan-400 font-medium">{plan.promo.description}</p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black tracking-tight text-white">
                          {formatPrice(plan.price, plan.currency)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {isOneMonth ? '/ mois' : isTwoMonths ? '/ 2 mois' : '/ 6 mois'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Unlimited scans guarantee pill */}
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs font-bold text-emerald-400 border border-slate-800">
                    <Zap className="h-3.5 w-3.5" />
                    {isEn ? '100% Unlimited Scans' : 'Scans & Analyses Illimités (∞)'}
                  </div>

                  {/* Features List */}
                  <ul className="mt-6 space-y-3 border-t border-slate-800/80 pt-6">
                    {(plan.features || []).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action CTA Button */}
                <div className="mt-8 pt-4">
                  <Link
                    to={
                      isAuthenticated
                        ? `/dashboard/subscription?plan=${plan.id}`
                        : `/register?plan=${plan.id}&join=true`
                    }
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-all ${
                      highlighted
                        ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 text-slate-950 shadow-xl shadow-cyan-500/25 hover:brightness-110 active:scale-95'
                        : 'border border-slate-700 bg-slate-800/90 text-white hover:bg-slate-700 hover:border-cyan-500/40'
                    }`}
                  >
                    {hasTrial
                      ? isEn
                        ? 'Start 7-Day Free Trial'
                        : 'Démarrer l’Essai Gratuit 7 Jours'
                      : isEn
                      ? `Subscribe to ${plan.name}`
                      : `Choisir le ${plan.name}`}
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <p className="mt-2 text-center text-[11px] text-slate-400">
                    {hasTrial
                      ? isEn
                        ? '0$ today · Cancel anytime'
                        : '0 FCFA aujourd’hui · Sans engagement'
                      : isEn
                      ? 'Instant activation via iKeePay'
                      : 'Activation instantanée via iKeePay'}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Security / Payment Icons Under Plans */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 border-t border-slate-800/80 pt-8 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Paiement sécurisé crypté SSL</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-cyan-400" />
            <span>Mobile Money (Wave, Orange, MTN, Moov) & Carte</span>
          </div>
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-amber-400" />
            <span>Essai gratuit 7 jours sans carte bancaire</span>
          </div>
        </div>
      </div>
    </section>
  );
}
