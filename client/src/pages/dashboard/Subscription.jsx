import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Check, Zap, Smartphone, Gift, CreditCard, X, ShieldCheck,
  History, Receipt, ExternalLink, RefreshCw, AlertCircle, CheckCircle2,
  Calendar, ArrowUpRight,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { userApi, paymentApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate } from '../../utils/format.js';

const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'moov', label: 'Moov Money' },
];

const FALLBACK_PLANS = [
  {
    id: '1mois',
    name: 'Plan 1 Mois',
    price: 7000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: true, days: 7 },
    promo: { enabled: false, price: 3000, durationMonths: 1, description: 'Offre après essai' },
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
    promo: { enabled: false, price: 10000, durationMonths: 2, description: 'Tarif promotionnel' },
    features: [
      'Économisez sur 2 mois d’abonnement',
      'Scans & analyses illimités (∞)',
      'Robot de Trading Haute Probabilité',
      'AI Scanner & Chart Vision en direct',
      'IA Managed Trading & Signaux live',
      'Backtesting Studio & Replay illimité',
      'Support prioritaire WhatsApp 24/7',
    ],
  },
  {
    id: '1an',
    name: 'Plan 1 An VIP (Annuel)',
    price: 65000,
    currency: 'XOF',
    scansPerMonth: -1,
    trial: { enabled: false, days: 0 },
    promo: { enabled: false, price: 55000, durationMonths: 12, description: 'Promotion Annuelle VIP' },
    features: [
      'Abonnement Annuel VIP (-45% d’économie)',
      'Scans de graphiques 100% illimités (∞)',
      'Accès complet aux 11 outils IA de pointe',
      'Signaux institutionnels en direct 24/7',
      'Exécution automatique sur Deriv & Binance',
      'Audit sur mesure de vos configurations de trade',
      'Ligne directe WhatsApp VIP dédiée',
    ],
  },
];

/**
 * Subscription Management & iKeePay Inline Checkout:
 * - Plans catalog (free, pro, premium) & live monthly usage
 * - iKeePay Inline Checkout modal with zero flash, mobile money & cards
 * - Real-time iframe window message listener (ikeepay-ready, ikeepay-success, ikeepay-close)
 * - Invoices & payment history tab
 */
export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tabs: 'plans' | 'history'
  const initialTab = searchParams.get('tab') === 'history' || searchParams.get('tab') === 'invoices' ? 'history' : 'plans';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentsList, setPaymentsList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [changing, setChanging] = useState(null);

  // iKeePay Inline Checkout state
  const [ikeepayOverlayVisible, setIkeepayOverlayVisible] = useState(false);
  const [methodModalPlan, setMethodModalPlan] = useState(null);
  const [ikeepayIframeSrc, setIkeepayIframeSrc] = useState('');
  const [ikeepayLoading, setIkeepayLoading] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [selectedPlanForIkeepay, setSelectedPlanForIkeepay] = useState(null);

  // Legacy Mobile Money (SebPay) modal fallback
  const [payForSebpay, setPayForSebpay] = useState(null);
  const [sebpayOperator, setSebpayOperator] = useState('mtn');
  const [sebpayPhone, setSebpayPhone] = useState('');
  const [payingSebpay, setPayingSebpay] = useState(false);

  // Initial data loading: fetch dynamic database-backed plans from admin
  useEffect(() => {
    userApi.plans()
      .then(({ data }) => {
        if (Array.isArray(data?.data?.plans) && data.data.plans.length > 0) {
          setPlans(data.data.plans);
        }
      })
      .catch(() => {});

    paymentApi.getConfig()
      .then(({ data }) => setPaymentConfig(data?.data || null))
      .catch(() => {});
  }, []);

  // Load history if activeTab is 'history'
  useEffect(() => {
    if (activeTab === 'history') {
      setLoadingHistory(true);
      paymentApi.list({ limit: 50 })
        .then(({ data }) => setPaymentsList(data?.data?.payments || []))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [activeTab]);

  // Sync tab with URL search parameter
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'history' ? { tab: 'history' } : {});
  };

  /**
   * Listen for iKeePay events emitted by the inline checkout iframe
   * Structure spec:
   * 1. 'ikeepay-ready': reveal the overlay modal
   * 2. 'ikeepay-success': payment completed
   * 3. 'ikeepay-close': close overlay modal
   */
  useEffect(() => {
    const handleIkeepayMessage = async (event) => {
      const data = event.data;

      // 1. Ready event
      if (data === 'ikeepay-ready') {
        setIkeepayOverlayVisible(true);
        setIkeepayLoading(false);
      }

      // 2. Success event
      if (data === 'ikeepay-success' || (typeof data === 'object' && data?.event === 'payment.success')) {
        toast.success('Paiement approuvé par iKeePay ! Activation du plan en cours…');
        const ikeepayRef = typeof data === 'object' ? data?.ikeepay_ref : null;

        if (currentOrderId) {
          try {
            await paymentApi.verifyIkeepay({ orderId: currentOrderId, ikeepayRef });
          } catch (e) {
            console.warn('Verification call:', e);
          }
        }

        await refreshUser();
        closeIkeepay();
        toast.success('Votre abonnement est maintenant actif avec succès ! 🎉', { duration: 6000 });
      }

      // 3. Close event
      if (data === 'ikeepay-close') {
        closeIkeepay();
      }
    };

    window.addEventListener('message', handleIkeepayMessage);
    return () => window.removeEventListener('message', handleIkeepayMessage);
  }, [currentOrderId, refreshUser]);

  const closeIkeepay = () => {
    setIkeepayOverlayVisible(false);
    setIkeepayIframeSrc('');
    setIkeepayLoading(false);
    setCurrentOrderId(null);
    setSelectedPlanForIkeepay(null);
  };

  const currentPlan = user?.subscription?.plan;

  /**
   * User clicks to select, upgrade, or renew a plan
   */
  const choosePlan = async (plan) => {
    // Check if free trial is available for this user
    const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;

    // Free plan or Free trial
    if (plan.price === 0 || trialAvailable) {
      if (plan.id === currentPlan && !trialAvailable) return;
      setChanging(plan.id);
      try {
        const { data } = await userApi.changeSubscription(plan.id);
        await refreshUser();
        toast.success(data.message || `Plan ${plan.name} activé avec succès.`);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setChanging(null);
      }
      return;
    }

    // Paid Plan: check active payment provider (allows upgrade or renewal)
    const isIkeepay = paymentConfig?.activeProvider === 'ikeepay' || paymentConfig?.ikeepay?.configured;

    if (isIkeepay) {
      // Prompt user to pick Mobile Money (XAF) or Crypto (USDT)
      const isXaf = ['XAF', 'XOF', 'FCFA'].includes((plan.currency || '').toUpperCase());
      if (isXaf) {
        setMethodModalPlan(plan);
      } else {
        await startIkeepayCheckout(plan, 'USD');
      }
    } else {
      // Fallback to Mobile Money (SebPay/Demo)
      setPayForSebpay(plan);
      setSebpayPhone('');
    }
  };

  /**
   * Initiate iKeePay checkout session and load inline iframe
   */
  const startIkeepayCheckout = async (plan, paymentCurrency = 'XAF') => {
    setChanging(plan.id);
    setSelectedPlanForIkeepay(plan);
    setMethodModalPlan(null);
    try {
      const { data } = await paymentApi.initiateIkeepay({
        planId: plan.id,
        paymentCurrency,
        paymentMethod: paymentCurrency === 'USDT' ? 'crypto' : 'mobile_money',
        redirectUrl: `${window.location.origin}/dashboard/subscription?status=success`,
      });

      const session = data?.data;
      if (!session?.checkoutUrl) {
        throw new Error("L'URL du tunnel de paiement iKeePay n'a pas pu être générée.");
      }

      setCurrentOrderId(session.orderId);
      setIkeepayIframeSrc(session.checkoutUrl);
      setIkeepayLoading(true);
      // Make overlay visible immediately with loader until 'ikeepay-ready' fires
      setIkeepayOverlayVisible(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
      closeIkeepay();
    } finally {
      setChanging(null);
    }
  };

  /**
   * SebPay legacy collection
   */
  const paySebpay = async () => {
    if (!sebpayPhone.trim()) return toast.error('Entrez votre numéro Mobile Money.');
    setPayingSebpay(true);
    try {
      const { data } = await paymentApi.checkout({
        planId: payForSebpay.id,
        phone: sebpayPhone.trim(),
        operator: sebpayOperator,
      });
      await refreshUser();
      toast.success(data.message || 'Paiement initié.');
      setPayForSebpay(null);
      if (data.data?.status !== 'approved') {
        toast('Confirmez la demande sur votre téléphone. Votre plan s\'activera après validation.', { icon: '📲', duration: 7000 });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPayingSebpay(false);
    }
  };

  const used = user?.subscription?.scansUsed || 0;
  const limit = user?.subscription?.scansPerMonth || 0;
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);

  const expirationDate = user?.subscription?.endDate || user?.trial?.endsAt;
  const nowMs = Date.now();
  const expMs = expirationDate ? new Date(expirationDate).getTime() : 0;
  const daysRemaining = expMs > nowMs ? Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-cyan-400" /> Abonnements &amp; Facturation
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gérez votre forfait, activez l'essai gratuit ou souscrivez instantanément en toute sécurité.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
          <button
            type="button"
            onClick={() => handleTabChange('plans')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === 'plans'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Forfaits &amp; Souscription
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === 'history'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" /> Historique &amp; Factures
          </button>
        </div>
      </div>

      {activeTab === 'plans' ? (
        <>
          {/* Current usage & Expiration countdown banner */}
          <div className="rounded-2xl p-6 border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Votre Forfait Actuel</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-2xl font-black capitalize text-white">
                    {plans.find((p) => p.id === currentPlan)?.name || currentPlan || '1 Mois'}
                  </span>
                  <Badge tone={user?.subscription?.status === 'active' ? 'green' : 'yellow'} className="text-xs px-3 py-0.5 font-bold">
                    {user?.subscription?.status === 'active' ? 'Actif' : user?.subscription?.status || 'Inactif'}
                  </Badge>
                </div>
              </div>

              {/* Expiration countdown box */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex items-center gap-4 shadow-inner">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Temps restant avant expiration</span>
                  <div className="text-sm font-extrabold text-slate-100 flex items-center gap-1.5 mt-0.5">
                    {daysRemaining > 0 ? (
                      <span className="text-emerald-400 font-extrabold">{daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-rose-400 font-bold">Abonnement expiré</span>
                    )}
                  </div>
                  {expirationDate && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Expire le {new Date(expirationDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800/80 pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Scans et détections IA : <strong className="text-emerald-400">Illimités (∞)</strong>
              </span>
              <span className="text-slate-400">
                Besoin de changer de formule ? Sélectionnez un forfait ci-dessous pour upgrader instantanément.
              </span>
            </div>
          </div>

          {/* Pricing cards grid - High contrast dark styling */}
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const highlighted = plan.id === '2mois' || plan.id === 'pro';
              const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col p-6 rounded-2xl transition-all duration-300 ${
                    highlighted
                      ? 'border-2 border-cyan-500 bg-slate-900/95 shadow-2xl shadow-cyan-500/10 ring-1 ring-cyan-500/40'
                      : 'border border-slate-800 bg-slate-900/90 shadow-xl hover:border-slate-700'
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 px-3.5 py-1 text-xs font-bold text-white shadow-md">
                      POPULAIRE &amp; ÉCONOMIQUE
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {plan.promo?.enabled ? (
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                        PROMO POST-ESSAI
                      </span>
                    ) : trialAvailable ? (
                      <Badge tone="green" className="font-bold">
                        <Gift className="h-3 w-3" /> {plan.trial.days}j offerts
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    {plan.promo?.enabled && Number(plan.promo.price) > 0 ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black text-amber-400">
                            {Number(plan.promo.price).toLocaleString()}
                          </span>
                          <span className="text-sm font-semibold text-slate-400">
                            {plan.currency || 'XOF'}
                          </span>
                          <span className="text-sm text-slate-500 line-through">
                            {Number(plan.price).toLocaleString()} {plan.currency}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-amber-300 mt-1">
                          Tarif promo : {plan.promo.durationMonths} {plan.promo.durationMonths === 1 ? 'mois' : 'mois'}, puis {Number(plan.price).toLocaleString()} {plan.currency}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-white tracking-tight">
                          {plan.price === 0 ? 'Gratuit' : Number(plan.price).toLocaleString()}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-sm font-semibold text-slate-400">
                            {plan.currency || 'FCFA'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                    Scans et signaux IA 100% illimités (∞)
                  </p>

                  <ul className="mt-6 flex-1 space-y-3">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400 font-bold" />
                        <span className="text-slate-200 text-xs sm:text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent ? 'secondary' : highlighted ? 'primary' : 'secondary'}
                    disabled={changing === plan.id}
                    loading={changing === plan.id}
                    onClick={() => choosePlan(plan)}
                    className="mt-6 w-full justify-center font-bold"
                  >
                    {isCurrent ? (
                      <><RefreshCw className="h-4 w-4" /> Prolonger / Renouveler</>
                    ) : trialAvailable ? (
                      <><Gift className="h-4 w-4" /> Démarrer l'essai gratuit</>
                    ) : plan.price > 0 ? (
                      <><CreditCard className="h-4 w-4" /> Passer à ce forfait (Upgrade)</>
                    ) : (
                      <><Zap className="h-4 w-4" /> Choisir {plan.name}</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Secure Payment Gateway Guarantee */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Paiement 100% Sécurisé via iKeePay</p>
                <p className="text-xs text-slate-400">
                  Cartes Visa, Mastercard et Mobile Money (Orange Money, MTN, Moov, Wave). Chiffrement bancaire SSL 256-bit.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-slate-700/60">
                Mobile Money
              </span>
              <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-slate-700/60">
                Cartes Bancaires
              </span>
              <span className="rounded-lg bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-800/60">
                Activation Immédiate
              </span>
            </div>
          </div>
        </>
      ) : (
        /* Invoices & Payment History Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="h-5 w-5 text-cyan-400" /> Historique des Paiements &amp; Factures
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoadingHistory(true);
                paymentApi.list({ limit: 50 })
                  .then(({ data }) => setPaymentsList(data?.data?.payments || []))
                  .finally(() => setLoadingHistory(false));
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualiser
            </Button>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : paymentsList.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 text-center py-12 p-6 shadow-xl">
              <Receipt className="h-10 w-10 text-slate-500 mx-auto mb-2 opacity-60" />
              <p className="font-semibold text-slate-200">Aucun paiement enregistré pour l'instant</p>
              <p className="text-xs text-slate-400 mt-1">Vos factures et reçus apparaîtront ici dès votre premier règlement.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase font-bold text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Référence / Date</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Montant</th>
                    <th className="px-5 py-3.5">Passerelle</th>
                    <th className="px-5 py-3.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {paymentsList.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs font-bold text-white">
                          {p.externalRef || p.providerRef || p._id}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold capitalize text-white">
                        {p.planId}
                      </td>
                      <td className="px-5 py-4 font-bold text-white">
                        {Number(p.amount).toLocaleString()} {p.currency}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium capitalize text-slate-300">
                        {p.provider === 'ikeepay' ? 'iKeePay (Inline)' : p.provider}
                      </td>
                      <td className="px-5 py-4">
                        {p.status === 'approved' ? (
                          <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Approuvé</Badge>
                        ) : p.status === 'pending' ? (
                          <Badge tone="yellow">En cours</Badge>
                        ) : (
                          <Badge tone="red">Échoué</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. iKeePay Inline Checkout Iframe Modal (Matching exact iKeePay spec)    */}
      {/* ========================================================================= */}
      <div
        id="ikeepay-overlay"
        style={{ display: ikeepayOverlayVisible ? 'flex' : 'none' }}
        className="fixed inset-0 z-50 items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all"
      >
        <div className="relative w-full max-w-[460px] h-[90vh] max-h-[820px] rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700 select-none">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
              <CreditCard className="w-4 h-4" />
              <span>Tunnel de Paiement iKeePay {selectedPlanForIkeepay?.name ? `· ${selectedPlanForIkeepay.name}` : ''}</span>
            </div>
            <button
              type="button"
              onClick={closeIkeepay}
              className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Iframe Body */}
          <div className="relative flex-1 w-full bg-slate-950">
            {ikeepayLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
                <Spinner />
                <p className="text-xs font-medium">Initialisation du paiement sécurisé iKeePay…</p>
              </div>
            )}
            <iframe
              id="ikeepay-iframe"
              src={ikeepayIframeSrc}
              allowTransparency="true"
              className="w-full h-full border-none bg-transparent"
              title="Paiement iKeePay"
              onLoad={() => setIkeepayLoading(false)}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SebPay Legacy Mobile Money Modal                                       */}
      {/* ========================================================================= */}
      <Modal open={!!payForSebpay} onClose={() => !payingSebpay && setPayForSebpay(null)} title={`Souscrire à ${payForSebpay?.name || ''}`}>
        {payForSebpay && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
              <div className="flex justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold text-gray-900 dark:text-white">{payForSebpay.name}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-gray-500">Montant</span>
                <span className="font-bold text-gray-900 dark:text-white">{payForSebpay.price} {payForSebpay.currency}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Opérateur Mobile Money</label>
              <div className="grid grid-cols-2 gap-2">
                {OPERATORS.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => setSebpayOperator(op.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      sebpayOperator === op.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Numéro de téléphone</label>
              <input
                value={sebpayPhone}
                onChange={(e) => setSebpayPhone(e.target.value)}
                placeholder="Ex : 22997000000"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <p className="text-xs text-gray-400">
              Vous recevrez une demande de validation sur votre téléphone. Votre plan s'activera dès la confirmation du paiement.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setPayForSebpay(null)} disabled={payingSebpay}>
                Annuler
              </Button>
              <Button onClick={paySebpay} loading={payingSebpay}>
                <Smartphone className="h-4 w-4" /> Payer {payForSebpay.price} {payForSebpay.currency}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {/* PAYMENT METHOD SELECTION MODAL (Mobile Money vs Crypto USDT) */}
      {methodModalPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-cyan-400">Paiement Sécurisé iKeePay</span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Choisir le Mode de Paiement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMethodModalPlan(null)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Sélectionnez votre moyen de paiement pour souscrire au <strong>{methodModalPlan.name}</strong> :
            </p>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => startIkeepayCheckout(methodModalPlan, 'XAF')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-cyan-500/50 bg-cyan-500/10 hover:bg-cyan-500/20 text-white transition group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 font-black">
                    <i className="fa-solid fa-mobile-screen text-base"></i>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block text-white group-hover:text-cyan-300">
                      Mobile Money / Carte Bancaire
                    </span>
                    <span className="text-xs text-slate-400">Orange Money, MTN, Moov, Wave, Visa</span>
                  </div>
                </div>
                <span className="font-mono font-extrabold text-sm text-cyan-400">
                  {Number(methodModalPlan.promo?.enabled ? methodModalPlan.promo.price : methodModalPlan.price).toLocaleString()} XAF
                </span>
              </button>

              <button
                type="button"
                onClick={() => startIkeepayCheckout(methodModalPlan, 'USDT')}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-white transition group shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black">
                    <i className="fa-brands fa-bitcoin text-base"></i>
                  </div>
                  <div className="text-left">
                    <span className="font-bold text-sm block text-white group-hover:text-emerald-300">
                      Cryptomonnaie USDT
                    </span>
                    <span className="text-xs text-slate-400">TRC20 / BEP20 (Taux : 1$ = 655 XAF)</span>
                  </div>
                </div>
                <span className="font-mono font-extrabold text-sm text-emerald-400">
                  ≈ {Math.max(1, Number(((methodModalPlan.promo?.enabled ? methodModalPlan.promo.price : methodModalPlan.price) / 655).toFixed(2)))} USDT
                </span>
              </button>
            </div>

            <div className="pt-2 text-center border-t border-slate-800">
              <button
                type="button"
                onClick={() => setMethodModalPlan(null)}
                className="text-xs text-slate-400 hover:text-slate-300 font-semibold"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
