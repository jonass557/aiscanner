import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Zap, Smartphone, Gift } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { userApi, paymentApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const OPERATORS = [
  { value: 'mtn', label: 'MTN Mobile Money' },
  { value: 'moov', label: 'Moov Money' },
];

/** Subscription management: current plan, usage, plan switching + Mobile Money payment. */
export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState([]);
  const [changing, setChanging] = useState(null);
  const [payFor, setPayFor] = useState(null); // plan being paid for
  const [operator, setOperator] = useState('mtn');
  const [phone, setPhone] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    userApi.plans().then(({ data }) => setPlans(data.data.plans)).catch(() => {});
  }, []);

  const currentPlan = user?.subscription?.plan;

  // Free plans (and offered trials) switch directly; paid plans open payment.
  const choosePlan = async (plan) => {
    if (plan.id === currentPlan) return;
    const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;
    if (plan.price > 0 && !trialAvailable) {
      setPayFor(plan);
      setPhone('');
      return;
    }
    setChanging(plan.id);
    try {
      const { data } = await userApi.changeSubscription(plan.id);
      await refreshUser();
      toast.success(data.message || `Plan ${plan.name} activé.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChanging(null);
    }
  };

  const pay = async () => {
    if (!phone.trim()) return toast.error('Entrez votre numéro Mobile Money.');
    setPaying(true);
    try {
      const { data } = await paymentApi.checkout({ planId: payFor.id, phone: phone.trim(), operator });
      await refreshUser();
      toast.success(data.message || 'Paiement initié.');
      // Demo provider approves instantly; SebPay resolves via webhook.
      if (data.data?.status === 'approved') {
        setPayFor(null);
      } else {
        toast('Confirmez la demande sur votre téléphone. Votre plan s\'activera après validation.', { icon: '📲', duration: 6000 });
        setPayFor(null);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPaying(false);
    }
  };

  const used = user?.subscription?.scansUsed || 0;
  const limit = user?.subscription?.scansPerMonth || 0;
  const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your plan and monitor your usage.</p>
      </div>

      {/* Current usage */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current plan</p>
            <p className="mt-1 text-xl font-bold capitalize">{currentPlan}</p>
          </div>
          <Badge tone="purple">{user?.subscription?.status}</Badge>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Scans used this month</span>
            <span className="font-medium">{used} / {limit === -1 ? '∞' : limit}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Plan options */}
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const highlighted = plan.id === 'pro';
          const trialAvailable = plan.trial?.enabled && user?.trial?.appliedFor !== plan.id;
          return (
            <div key={plan.id} className={`card relative flex flex-col p-6 ${highlighted ? 'ring-2 ring-brand-500' : ''}`}>
              {highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-accent-600 px-3 py-1 text-xs font-bold text-white">
                  POPULAR
                </span>
              )}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {trialAvailable && (
                  <Badge tone="green"><Gift className="h-3 w-3" /> {plan.trial.days}j gratuits</Badge>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">
                  {plan.price === 0 ? 'Gratuit' : `${plan.price}`}
                </span>
                {plan.price > 0 && <span className="text-sm text-gray-500">{plan.currency}/mo</span>}
              </div>
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    <span className="text-gray-600 dark:text-gray-300">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? 'secondary' : highlighted ? 'primary' : 'secondary'}
                disabled={isCurrent}
                loading={changing === plan.id}
                onClick={() => choosePlan(plan)}
                className="mt-6 w-full"
              >
                {isCurrent ? (
                  'Current plan'
                ) : trialAvailable ? (
                  <><Gift className="h-4 w-4" /> Démarrer l'essai gratuit</>
                ) : plan.price > 0 ? (
                  <><Smartphone className="h-4 w-4" /> Payer avec Mobile Money</>
                ) : (
                  <><Zap className="h-4 w-4" /> Choisir {plan.name}</>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Mobile Money payment modal */}
      <Modal open={!!payFor} onClose={() => !paying && setPayFor(null)} title={`Payer ${payFor?.name || ''}`}>
        {payFor && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 p-4 text-sm dark:bg-gray-800/50">
              <div className="flex justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold">{payFor.name}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-gray-500">Montant</span>
                <span className="font-semibold">{payFor.price} {payFor.currency}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Opérateur</label>
              <div className="grid grid-cols-2 gap-2">
                {OPERATORS.map((op) => (
                  <button
                    key={op.value}
                    onClick={() => setOperator(op.value)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      operator === op.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Numéro Mobile Money</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex : 22997000000"
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
              />
            </div>

            <p className="text-xs text-gray-400">
              Vous recevrez une demande de validation sur votre téléphone. Votre plan s'activera dès la confirmation du paiement.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPayFor(null)} disabled={paying}>Annuler</Button>
              <Button onClick={pay} loading={paying}>
                <Smartphone className="h-4 w-4" /> Payer {payFor.price} {payFor.currency}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
