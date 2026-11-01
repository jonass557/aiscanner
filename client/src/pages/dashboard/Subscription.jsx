import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Check, Zap, Smartphone, Gift, CreditCard, X, ShieldCheck,
  History, Receipt, ExternalLink, RefreshCw, AlertCircle, CheckCircle2,
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

  const [plans, setPlans] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [paymentsList, setPaymentsList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [changing, setChanging] = useState(null);

  // iKeePay Inline Checkout state
  const [ikeepayOverlayVisible, setIkeepayOverlayVisible] = useState(false);
  const [ikeepayIframeSrc, setIkeepayIframeSrc] = useState('');
  const [ikeepayLoading, setIkeepayLoading] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [selectedPlanForIkeepay, setSelectedPlanForIkeepay] = useState(null);

  // Legacy Mobile Money (SebPay) modal fallback
  const [payForSebpay, setPayForSebpay] = useState(null);
  const [sebpayOperator, setSebpayOperator] = useState('mtn');
  const [sebpayPhone, setSebpayPhone] = useState('');
  const [payingSebpay, setPayingSebpay] = useState(false);

  // Initial data loading
  useEffect(() => {
    userApi.plans()
      .then(({ data }) => setPlans(data?.data?.plans || []))
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
   * User clicks to select or upgrade a plan
   */
  const choosePlan = async (plan) => {
    if (plan.id === currentPlan) return;

    // Check if free trial is available for this user
    const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;

    // Free plan or Free trial
    if (plan.price === 0 || trialAvailable) {
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

    // Paid Plan: check active payment provider
    const isIkeepay = paymentConfig?.activeProvider === 'ikeepay' || paymentConfig?.ikeepay?.configured;

    if (isIkeepay) {
      // Launch iKeePay Inline Checkout
      await startIkeepayCheckout(plan);
    } else {
      // Fallback to Mobile Money (SebPay/Demo)
      setPayForSebpay(plan);
      setSebpayPhone('');
    }
  };

  /**
   * Initiate iKeePay checkout session and load inline iframe
   */
  const startIkeepayCheckout = async (plan) => {
    setChanging(plan.id);
    setSelectedPlanForIkeepay(plan);
    try {
      const { data } = await paymentApi.initiateIkeepay({
        planId: plan.id,
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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-brand-500" /> Abonnements &amp; Facturation
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gérez votre forfait, souscrivez en toute sécurité par iKeePay / Mobile Money et consultez vos factures.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => handleTabChange('plans')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'plans'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Forfaits &amp; Souscription
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              activeTab === 'history'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" /> Historique &amp; Factures
          </button>
        </div>
      </div>

      {activeTab === 'plans' ? (
        <>
          {/* Current usage banner */}
          <div className="card p-6 border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-medium tracking-wider text-gray-500">Plan Actif</p>
                <p className="mt-1 text-2xl font-extrabold capitalize text-gray-900 dark:text-white">
                  {currentPlan || 'Free'}
                </p>
              </div>
              <Badge tone="purple" className="text-xs px-3 py-1 font-semibold">
                {user?.subscription?.status === 'active' ? 'Actif' : user?.subscription?.status || 'Inactif'}
              </Badge>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Scans consommés ce mois-ci</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {used} / {limit === -1 ? 'Illimités (∞)' : limit}
                </span>
              </div>
              <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-accent-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pricing cards grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              const highlighted = plan.id === 'pro';
              const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;

              return (
                <div
                  key={plan.id}
                  className={`card relative flex flex-col p-6 transition-all duration-300 ${
                    highlighted
                      ? 'ring-2 ring-brand-500 shadow-xl shadow-brand-500/10 dark:bg-slate-900/90'
                      : 'border border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-accent-600 px-3.5 py-1 text-xs font-bold text-white shadow-md">
                      RECOMMANDÉ
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                    {plan.promo?.enabled ? (
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        PROMO POST-ESSAI
                      </span>
                    ) : trialAvailable ? (
                      <Badge tone="green">
                        <Gift className="h-3 w-3" /> {plan.trial.days}j offerts
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    {plan.promo?.enabled && Number(plan.promo.price) > 0 ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black text-amber-600 dark:text-amber-400">
                            {plan.promo.price}
                          </span>
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            {plan.currency || 'USD'}
                          </span>
                          <span className="text-sm text-gray-400 line-through">
                            {plan.price} {plan.currency}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                          Offre spéciale : tarif pour les {plan.promo.durationMonths} {plan.promo.durationMonths === 1 ? 'premier mois' : 'premiers mois'}, puis {plan.price} {plan.currency}/mois
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                          {plan.price === 0 ? 'Gratuit' : `${plan.price}`}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                            {plan.currency || 'USD'} / mois
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Scans et analyses illimités (∞)
                  </p>

                  <ul className="mt-6 flex-1 space-y-3">
                    {(plan.features || []).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500 font-bold" />
                        <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent ? 'secondary' : highlighted ? 'primary' : 'secondary'}
                    disabled={isCurrent}
                    loading={changing === plan.id}
                    onClick={() => choosePlan(plan)}
                    className="mt-6 w-full justify-center font-semibold"
                  >
                    {isCurrent ? (
                      'Forfait Actuel'
                    ) : trialAvailable ? (
                      <><Gift className="h-4 w-4" /> Démarrer l'essai gratuit</>
                    ) : plan.price > 0 ? (
                      <><CreditCard className="h-4 w-4" /> Souscrire avec iKeePay</>
                    ) : (
                      <><Zap className="h-4 w-4" /> Choisir {plan.name}</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Secure Payment Gateway Guarantee */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 dark:border-gray-800 dark:bg-gray-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Paiement 100% Sécurisé via iKeePay</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cartes Visa, Mastercard et Mobile Money (Orange Money, MTN, Moov, Wave). Chiffrement bancaire SSL 256-bit.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                Mobile Money
              </span>
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                Cartes Bancaires
              </span>
              <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300">
                Activation Immédiate
              </span>
            </div>
          </div>
        </>
      ) : (
        /* Invoices & Payment History Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <History className="h-5 w-5 text-brand-500" /> Historique des Paiements &amp; Factures
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
            <div className="card text-center py-12 border border-gray-200 dark:border-gray-800">
              <Receipt className="h-10 w-10 text-gray-400 mx-auto mb-2 opacity-60" />
              <p className="font-semibold text-gray-700 dark:text-gray-300">Aucun paiement enregistré pour l'instant</p>
              <p className="text-xs text-gray-500 mt-1">Vos factures et reçus apparaîtront ici dès votre premier règlement.</p>
            </div>
          ) : (
            <div className="card overflow-x-auto p-0 border border-gray-200 dark:border-gray-800">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800/50">
                  <tr>
                    <th className="px-5 py-3.5">Référence / Date</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Montant</th>
                    <th className="px-5 py-3.5">Passerelle</th>
                    <th className="px-5 py-3.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paymentsList.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                          {p.externalRef || p.providerRef || p._id}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{formatDate(p.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold capitalize text-gray-900 dark:text-white">
                        {p.planId}
                      </td>
                      <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                        {p.amount} {p.currency}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium capitalize text-gray-600 dark:text-gray-300">
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
    </div>
  );
}
