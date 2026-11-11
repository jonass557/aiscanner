import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Check, Zap, Smartphone, Gift, CreditCard, ShieldCheck,
  History, Receipt, RefreshCw, CheckCircle2, Calendar, Crown, ArrowRight,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { userApi, paymentApi, partnershipApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatDate } from '../../utils/format.js';
import H2HPlanCheckoutModal from '../../components/payments/H2HPlanCheckoutModal.jsx';
import PartnershipModal from '../../components/partnership/PartnershipModal.jsx';

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
 * Subscription Management & iKeePay H2H Direct Checkout + VIP Partnership Access
 */
export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = searchParams.get('tab') === 'history' || searchParams.get('tab') === 'invoices' ? 'history' : 'plans';
  const [activeTab, setActiveTab] = useState(initialTab);

  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [paymentConfig, setPaymentConfig] = useState(null);
  const [partnerConfig, setPartnerConfig] = useState(null);
  const [paymentsList, setPaymentsList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [changing, setChanging] = useState(null);

  // H2H Plan Checkout Modal
  const [h2hCheckoutPlan, setH2hCheckoutPlan] = useState(null);

  // Partnership Modal
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);

  // Legacy Mobile Money (SebPay) modal fallback
  const [payForSebpay, setPayForSebpay] = useState(null);
  const [sebpayOperator, setSebpayOperator] = useState('mtn');
  const [sebpayPhone, setSebpayPhone] = useState('');
  const [payingSebpay, setPayingSebpay] = useState(false);

  const loadData = () => {
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

    partnershipApi.getConfig()
      .then(({ data }) => setPartnerConfig(data?.data || null))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      setLoadingHistory(true);
      paymentApi.list({ limit: 50 })
        .then(({ data }) => setPaymentsList(data?.data?.payments || []))
        .catch(() => {})
        .finally(() => setLoadingHistory(false));
    }
  }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'history' ? { tab: 'history' } : {});
  };

  const currentPlan = user?.subscription?.plan;
  const isLifetimePartner = Boolean(user?.partnership?.isActive && user?.partnership?.status === 'active' && user?.partnership?.lifetimeAccess);

  const choosePlan = async (plan) => {
    const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;

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

    const activeProv = paymentConfig?.activeProvider || 'ikeepay';
    if (activeProv === 'sebpay') {
      setPayForSebpay(plan);
      setSebpayPhone('');
    } else {
      setH2hCheckoutPlan(plan);
    }
  };

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
        toast("Confirmez la demande sur votre téléphone. Votre plan s'activera après validation.", { icon: '📲', duration: 7000 });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPayingSebpay(false);
    }
  };

  const expirationDate = user?.subscription?.endDate || user?.trial?.endsAt;
  const nowMs = Date.now();
  const expMs = expirationDate ? new Date(expirationDate).getTime() : 0;
  const daysRemaining = expMs > nowMs ? Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-cyan-400" /> Abonnements &amp; Partenariat VIP
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gérez votre forfait, souscrivez via iKeePay Mobile Money H2H ou devenez Partenaire VIP à vie.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
          <button
            type="button"
            onClick={() => handleTabChange('plans')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === 'plans' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Forfaits &amp; Partenariat
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition ${
              activeTab === 'history' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="h-3.5 w-3.5" /> Historique &amp; Factures
          </button>
        </div>
      </div>

      {activeTab === 'plans' ? (
        <>
          {/* Current usage & Expiration banner */}
          <div className="rounded-2xl p-6 border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-400">Votre Statut Actuel</p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-2xl font-black capitalize text-white">
                    {isLifetimePartner
                      ? 'Partenaire VIP — Accès à Vie'
                      : plans.find((p) => p.id === currentPlan)?.name || currentPlan || '1 Mois'}
                  </span>
                  <Badge tone={isLifetimePartner || user?.subscription?.status === 'active' ? 'green' : 'yellow'} className="text-xs px-3 py-0.5 font-bold">
                    {isLifetimePartner ? 'Accès à Vie Actif' : user?.subscription?.status === 'active' ? 'Actif' : user?.subscription?.status || 'Inactif'}
                  </Badge>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 flex items-center gap-4 shadow-inner">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {isLifetimePartner ? <Crown className="h-5 w-5 text-amber-400" /> : <Calendar className="h-5 w-5" />}
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Validité de l'accès</span>
                  <div className="text-sm font-extrabold text-slate-100 mt-0.5">
                    {isLifetimePartner ? (
                      <span className="text-amber-400 font-black">Illimité à vie (Partenaire VIP)</span>
                    ) : daysRemaining > 0 ? (
                      <span className="text-emerald-400 font-extrabold">{daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-rose-400 font-bold">Abonnement expiré</span>
                    )}
                  </div>
                  {!isLifetimePartner && expirationDate && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Expire le {new Date(expirationDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Programme de Partenariat CTA Card for existing logged-in users */}
          {partnerConfig?.isEnabled && !partnerConfig?.isDeleted && !isLifetimePartner && (
            <div className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-slate-900 to-orange-950/30 p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 shadow-lg">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-amber-300">{partnerConfig.title || 'Programme de Partenariat VIP'}</h3>
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                      {partnerConfig.spotsRemaining} / {partnerConfig.maxPartners} places restantes
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{partnerConfig.subtitle}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Même si vous avez déjà un abonnement en cours, votre statut bascule immédiatement en Partenaire à Vie + {partnerConfig.commissionRate || 30}% de commission chaque mois.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={Number(partnerConfig.spotsRemaining) <= 0}
                onClick={() => setPartnerModalOpen(true)}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3.5 text-sm font-black text-slate-950 shadow-lg hover:brightness-110 transition disabled:opacity-40"
              >
                <Crown className="h-4 w-4" />
                <span>
                  {Number(partnerConfig.spotsRemaining) <= 0
                    ? 'Programme Complet'
                    : `Devenir Partenaire (${Number(partnerConfig.price || 0).toLocaleString('fr-FR')} ${partnerConfig.currency || 'XOF'})`}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Pricing cards grid */}
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
                          <span className="text-sm font-semibold text-slate-400">{plan.currency || 'XOF'}</span>
                          <span className="text-sm text-slate-500 line-through">
                            {Number(plan.price).toLocaleString()} {plan.currency}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black text-white tracking-tight">
                          {plan.price === 0 ? 'Gratuit' : Number(plan.price).toLocaleString()}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-sm font-semibold text-slate-400">{plan.currency || 'FCFA'}</span>
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
                      <><CreditCard className="h-4 w-4" /> Payer via iKeePay H2H</>
                    ) : (
                      <><Zap className="h-4 w-4" /> Choisir {plan.name}</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Security / Payment Gateway Guarantee */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Paiement Direct Sécurisé via iKeePay H2H</p>
                <p className="text-xs text-slate-400">
                  Mobile Money (Orange, MTN, Wave, Moov, Mobicash, Airtel, Vodacom). Activation instantanée dès validation.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
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
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-800 bg-slate-950/70 text-xs uppercase font-bold text-slate-400">
                  <tr>
                    <th className="px-5 py-3.5">Référence / Date</th>
                    <th className="px-5 py-3.5">Type / Plan</th>
                    <th className="px-5 py-3.5">Opérateur</th>
                    <th className="px-5 py-3.5">Montant</th>
                    <th className="px-5 py-3.5">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-200">
                  {paymentsList.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-mono text-xs font-bold text-white">{p.externalRef || p.providerRef || p._id}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-white">
                        {p.purpose === 'partnership' ? 'Partenariat VIP À Vie' : p.planId}
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-300">
                        {p.operator} ({p.country || 'CI'})
                      </td>
                      <td className="px-5 py-4 font-bold text-white">
                        {Number(p.amount).toLocaleString()} {p.currency}
                      </td>
                      <td className="px-5 py-4">
                        {p.status === 'approved' ? (
                          <Badge tone="green"><CheckCircle2 className="h-3 w-3" /> Approuvé</Badge>
                        ) : p.status === 'pending' ? (
                          <Badge tone="yellow">En attente</Badge>
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

      {/* iKeePay H2H Direct Checkout Modal */}
      <H2HPlanCheckoutModal
        isOpen={Boolean(h2hCheckoutPlan)}
        plan={h2hCheckoutPlan}
        isAuthenticated
        userEmail={user?.email || ''}
        userName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
        userPhone={user?.phone || ''}
        onClose={() => setH2hCheckoutPlan(null)}
        onApproved={async () => {
          await refreshUser();
          setTimeout(() => {
            setH2hCheckoutPlan(null);
            toast.success('Votre abonnement est désormais actif !');
          }, 1000);
        }}
      />

      {/* Partnership Modal for logged-in users */}
      <PartnershipModal
        isOpen={partnerModalOpen}
        config={partnerConfig}
        onClose={() => setPartnerModalOpen(false)}
        onCompleted={async () => {
          await refreshUser();
          loadData();
        }}
      />

      {/* SebPay Legacy Mobile Money Modal */}
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
