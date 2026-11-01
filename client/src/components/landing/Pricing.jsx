import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Gift,
  X,
  CreditCard,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userApi, paymentApi } from '../../services/endpoints.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getErrorMessage } from '../../services/api.js';

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
  const navigate = useNavigate();
  const isEn = lang === 'en';

  // Checkout Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    plan: null,
    step: 'info', // 'info' | 'paying' | 'success'
    fullName: '',
    email: '',
    phone: '',
    orderId: '',
    checkoutUrl: '',
    loading: false,
    verifying: false,
  });

  const iframeRef = useRef(null);

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

  // Listen to iKeePay message events for automated instant checkout approval
  useEffect(() => {
    const handleIkeepayMessage = (event) => {
      const data = event.data;
      if (
        data === 'ikeepay-success' ||
        data?.event === 'ikeepay-success' ||
        data?.status === 'approved' ||
        data?.status === 'success'
      ) {
        if (modalState.orderId) {
          verifyPayment(modalState.orderId);
        }
      }
    };

    window.addEventListener('message', handleIkeepayMessage);
    return () => window.removeEventListener('message', handleIkeepayMessage);
  }, [modalState.orderId]);

  const openCheckout = (plan) => {
    if (isAuthenticated) {
      navigate(`/dashboard/subscription?plan=${plan.id}`);
      return;
    }

    setModalState({
      isOpen: true,
      plan,
      step: 'info',
      fullName: '',
      email: '',
      phone: '',
      orderId: '',
      checkoutUrl: '',
      loading: false,
      verifying: false,
    });
  };

  const closeCheckout = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleStartPayment = async (e) => {
    e.preventDefault();
    if (!modalState.email || !modalState.fullName) {
      toast.error(isEn ? 'Please fill in your name and email.' : 'Veuillez saisir votre nom et votre adresse email.');
      return;
    }

    setModalState((prev) => ({ ...prev, loading: true }));
    try {
      const plan = modalState.plan;
      const effectivePrice = plan.promo?.enabled && Number(plan.promo?.price) > 0 ? plan.promo.price : plan.price;

      const { data } = await paymentApi.initiatePublicIkeepay({
        planId: plan.id,
        email: modalState.email,
        fullName: modalState.fullName,
        phone: modalState.phone,
      });

      const resData = data.data;
      const orderId = resData.orderId;
      const checkoutUrl = resData.checkoutUrl;

      if (resData.isFree || effectivePrice <= 0) {
        // Free plan / instant approval
        toast.success(isEn ? 'Trial reserved! Create your account.' : 'Essai validé ! Créez votre compte.');
        navigate(
          `/register?orderId=${orderId}&email=${encodeURIComponent(modalState.email)}&name=${encodeURIComponent(
            modalState.fullName
          )}&plan=${plan.id}`
        );
        return;
      }

      setModalState((prev) => ({
        ...prev,
        step: 'paying',
        orderId,
        checkoutUrl,
        loading: false,
      }));
    } catch (err) {
      toast.error(getErrorMessage(err));
      setModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  const verifyPayment = async (orderIdToCheck) => {
    const oid = orderIdToCheck || modalState.orderId;
    if (!oid) return;

    setModalState((prev) => ({ ...prev, verifying: true }));
    try {
      const { data } = await paymentApi.verifyPublicIkeepay({ orderId: oid });
      if (data?.data?.status === 'approved') {
        toast.success(isEn ? 'Payment confirmed with success!' : 'Paiement iKeePay confirmé avec succès !');
        setModalState((prev) => ({ ...prev, step: 'success', verifying: false }));

        setTimeout(() => {
          navigate(
            `/register?orderId=${oid}&email=${encodeURIComponent(modalState.email)}&name=${encodeURIComponent(
              modalState.fullName
            )}&plan=${modalState.plan?.id}`
          );
        }, 1500);
      } else {
        toast(
          isEn
            ? 'Payment is still being processed. Please finalize it in the checkout window.'
            : 'Paiement en cours de traitement. Veuillez le finaliser dans la fenêtre de paiement.',
          { icon: '⏳' }
        );
        setModalState((prev) => ({ ...prev, verifying: false }));
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
      setModalState((prev) => ({ ...prev, verifying: false }));
    }
  };

  const handleFreeTrialDirect = () => {
    if (!modalState.email || !modalState.fullName) {
      toast.error(isEn ? 'Please fill in your name and email.' : 'Veuillez saisir votre nom et votre adresse email.');
      return;
    }
    navigate(
      `/register?plan=${modalState.plan?.id}&email=${encodeURIComponent(modalState.email)}&name=${encodeURIComponent(
        modalState.fullName
      )}`
    );
  };

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
              ? 'Start today with our free trial on the 1-Month Plan. All plans include 100% unlimited scans and full algorithmic power.'
              : 'Commencez dès aujourd’hui avec notre essai gratuit sans engagement. Tous les plans incluent des scans 100% illimités.'}
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
                    {plan.trial?.days && plan.trial.days > 0
                      ? `${plan.trial.days} ${isEn ? 'Days Free Trial' : 'Jours d’Essai Gratuit'}`
                      : isEn
                      ? 'Free Trial'
                      : 'Essai Gratuit'}
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
                  <button
                    type="button"
                    onClick={() => openCheckout(plan)}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition-all ${
                      highlighted
                        ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-600 text-slate-950 shadow-xl shadow-cyan-500/25 hover:brightness-110 active:scale-95'
                        : 'border border-slate-700 bg-slate-800/90 text-white hover:bg-slate-700 hover:border-cyan-500/40'
                    }`}
                  >
                    {hasTrial
                      ? plan.trial?.days && plan.trial.days > 0
                        ? `${isEn ? 'Start' : 'Démarrer l’Essai'} (${plan.trial.days}j)`
                        : isEn
                        ? 'Start Free Trial'
                        : 'Démarrer l’Essai Gratuit'
                      : isEn
                      ? `Subscribe to ${plan.name}`
                      : `Choisir le ${plan.name}`}
                    <ArrowRight className="h-4 w-4" />
                  </button>

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
            <span>Essai gratuit sans carte bancaire</span>
          </div>
        </div>
      </div>

      {/* Public iKeePay Checkout Modal */}
      <AnimatePresence>
        {modalState.isOpen && modalState.plan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 p-6 sm:p-8 shadow-2xl shadow-cyan-500/10 text-white my-8 max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={closeCheckout}
                className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Step 1: Customer Details Form */}
              {modalState.step === 'info' && (
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                      <CreditCard className="h-6 w-6" />
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-white">
                        {isEn ? 'Subscription Checkout' : 'Validation de votre Forfait'}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isEn ? 'Active plan:' : 'Forfait choisi :'} <span className="font-bold text-cyan-300">{modalState.plan.name}</span> ·{' '}
                        <span className="font-bold text-emerald-400">
                          {formatPrice(
                            modalState.plan.promo?.enabled ? modalState.plan.promo.price : modalState.plan.price,
                            modalState.plan.currency
                          )}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{isEn ? 'Access type' : 'Accès'} :</span>
                      <span className="font-bold text-white">Scans & Outils IA Illimités (∞)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{isEn ? 'Payment gateway' : 'Passerelle'} :</span>
                      <span className="font-bold text-cyan-400">iKeePay (Wave, Orange, MTN, Moov, CB)</span>
                    </div>
                  </div>

                  <form onSubmit={handleStartPayment} className="mt-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        {isEn ? 'Full Name' : 'Nom complet'} *
                      </label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={modalState.fullName}
                          onChange={(e) => setModalState((prev) => ({ ...prev, fullName: e.target.value }))}
                          placeholder="Ex: Valdes Kouame"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        {isEn ? 'Email Address' : 'Adresse Email'} *
                      </label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={modalState.email}
                          onChange={(e) => setModalState((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="votre-email@exemple.com"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {isEn
                          ? 'Your subscription & OTP confirmation code will be sent to this email.'
                          : 'Votre confirmation et code OTP d’activation seront envoyés à cet email.'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        {isEn ? 'WhatsApp / Phone (for Mobile Money)' : 'Numéro WhatsApp / Téléphone (pour Mobile Money)'}
                      </label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="tel"
                          value={modalState.phone}
                          onChange={(e) => setModalState((prev) => ({ ...prev, phone: e.target.value }))}
                          placeholder="+225 07 00 00 00 00"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    {/* Pay Button */}
                    <button
                      type="submit"
                      disabled={modalState.loading}
                      className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                    >
                      {modalState.loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{isEn ? 'Initiating...' : 'Initialisation iKeePay...'}</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          <span>
                            {isEn
                              ? `Pay ${formatPrice(
                                  modalState.plan.promo?.enabled ? modalState.plan.promo.price : modalState.plan.price,
                                  modalState.plan.currency
                                )} with iKeePay`
                              : `Payer ${formatPrice(
                                  modalState.plan.promo?.enabled ? modalState.plan.promo.price : modalState.plan.price,
                                  modalState.plan.currency
                                )} via iKeePay`}
                          </span>
                        </>
                      )}
                    </button>

                    {/* Free Trial Direct Option if Enabled */}
                    {modalState.plan.trial?.enabled && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={handleFreeTrialDirect}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-4"
                        >
                          {isEn ? 'Or register with free trial without payment' : 'Ou activer l’essai gratuit sans carte'}
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}

              {/* Step 2: iKeePay Iframe / Direct Checkout */}
              {modalState.step === 'paying' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Lock className="h-4 w-4 text-emerald-400" />
                        {isEn ? 'Secure iKeePay Payment' : 'Paiement Sécurisé iKeePay'}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">Réf: {modalState.orderId}</p>
                    </div>
                    {modalState.checkoutUrl && (
                      <a
                        href={modalState.checkoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline"
                      >
                        <span>{isEn ? 'Open full window' : 'Plein écran'}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {/* Embedded Iframe */}
                  {modalState.checkoutUrl ? (
                    <div className="rounded-2xl overflow-hidden border border-slate-800 bg-white shadow-inner h-[480px]">
                      <iframe
                        ref={iframeRef}
                        src={modalState.checkoutUrl}
                        title="iKeePay Checkout"
                        className="w-full h-full border-0"
                        allow="payment"
                      />
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-950 rounded-2xl border border-slate-800">
                      <p className="text-sm text-slate-300">
                        {isEn
                          ? 'Please finalize your payment on the iKeePay portal.'
                          : 'Veuillez finaliser votre paiement sur la passerelle sécurisée.'}
                      </p>
                    </div>
                  )}

                  {/* Verification CTA */}
                  <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      disabled={modalState.verifying}
                      onClick={() => verifyPayment(modalState.orderId)}
                      className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                    >
                      {modalState.verifying ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{isEn ? 'Verifying payment...' : 'Vérification iKeePay en cours...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{isEn ? 'I have validated my payment' : 'J’ai validé mon paiement'}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalState((prev) => ({ ...prev, step: 'info' }))}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl border border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                    >
                      {isEn ? 'Back' : 'Retour'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Success Confirmation */}
              {modalState.step === 'success' && (
                <div className="py-8 text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-black text-white">
                    {isEn ? 'Payment Approved!' : 'Paiement Validé avec Succès !'}
                  </h3>
                  <p className="text-sm text-slate-300 max-w-sm mx-auto">
                    {isEn
                      ? 'Your subscription is registered. Redirecting you to finish creating your account...'
                      : 'Votre abonnement a été activé. Redirection vers la finalisation de votre compte...'}
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs font-mono text-cyan-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Redirection automatique...</span>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}