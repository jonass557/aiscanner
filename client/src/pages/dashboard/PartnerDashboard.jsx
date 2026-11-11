import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Crown,
  Users,
  CheckCircle2,
  Copy,
  Wallet,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  Globe,
  Phone,
  Loader2,
  TrendingUp,
  Clock,
  ShieldAlert,
  Ban,
} from 'lucide-react';
import { partnershipApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { H2H_COUNTRIES, OPERATOR_LABELS } from '../../constants/h2hCountries.js';
import PartnershipModal from '../../components/partnership/PartnershipModal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

export default function PartnerDashboard() {
  const { refreshUser } = useAuth();
  const [data, setData] = useState(null);
  const [publicConfig, setPublicConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);

  // H2H Withdrawal modal state
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wCountry, setWCountry] = useState('CI');
  const [wOperator, setWOperator] = useState('ORANGE');
  const [wPhone, setWPhone] = useState('');
  const [wAmount, setWAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dashRes, cfgRes] = await Promise.all([
        partnershipApi.myDashboard(),
        partnershipApi.getConfig(),
      ]);
      setData(dashRes.data?.data || null);
      setPublicConfig(cfgRes.data?.data || null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const selectedCountry = H2H_COUNTRIES.find((c) => c.code === wCountry) || H2H_COUNTRIES[0];
  useEffect(() => {
    if (!selectedCountry.operators.includes(wOperator)) {
      setWOperator(selectedCountry.operators[0]);
    }
  }, [wCountry, selectedCountry, wOperator]);

  const copyLink = () => {
    if (!data?.affiliateLink) return;
    navigator.clipboard.writeText(data.affiliateLink);
    toast.success('Lien d’affiliation Partenaire copié !');
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amt = Math.round(Number(wAmount));
    if (!amt || amt < 200) {
      toast.error('Le montant minimum de retrait est de 200 FCFA.');
      return;
    }
    if (!wPhone.trim() || wPhone.replace(/[^\d]/g, '').length < 8) {
      toast.error('Veuillez saisir un numéro Mobile Money valide.');
      return;
    }

    setWithdrawing(true);
    try {
      const res = await partnershipApi.withdraw({
        amount: amt,
        country: wCountry,
        operator: wOperator,
        phoneNumber: wPhone.trim(),
      });
      toast.success(res.data?.message || 'Retrait iKeePay H2H initié !');
      setWithdrawOpen(false);
      setWAmount('');
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWithdrawing(false);
    }
  };

  const verifyPayout = async (externalRef) => {
    try {
      await partnershipApi.verifyPayout({ externalRef });
      toast.success('Statut du retrait actualisé.');
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  const p = data?.partnership || {};
  const stats = data?.stats || {};
  const currency = data?.programConfig?.currency || 'XOF';
  const commissionRate = data?.programConfig?.commissionRate || 30;
  const isActivePartner = Boolean(p.isActive && p.status === 'active');

  // If user is excluded / disabled by admin
  if (!isActivePartner && (p.status === 'excluded' || p.status === 'disabled')) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <div className="rounded-3xl border border-rose-500/40 bg-rose-950/30 p-8 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
            <Ban className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white">Statut Partenaire Suspendu / Exclu</h1>
          <p className="text-sm text-rose-200 max-w-lg mx-auto">
            {p.excludedReason || "Votre accès au Programme de Partenariat a été suspendu ou exclu par l'administrateur."}
          </p>
          <p className="text-xs text-slate-400">
            Vos avantages (accès à vie et perception de nouvelles commissions) sont temporairement désactivés. Contactez le support ou l'administration pour une éventuelle réactivation.
          </p>
        </div>
      </div>
    );
  }

  // If user has NOT yet subscribed to Partnership Program
  if (!isActivePartner) {
    const canJoin = Boolean(publicConfig?.isEnabled && !publicConfig?.isDeleted);
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-4 text-slate-100">
        <div className="rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-amber-950/35 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-3.5 py-1 text-xs font-black uppercase text-amber-300">
                <Crown className="h-3.5 w-3.5" /> Programme de Partenariat VIP
              </span>
              <h1 className="text-3xl font-black text-white">
                {publicConfig?.title || 'Devenez Partenaire VIP AI Chart Scanner'}
              </h1>
              <p className="text-sm text-slate-300 max-w-xl">
                {publicConfig?.subtitle || `Accès à vie illimité + ${commissionRate}% de commission chaque mois sur chaque abonné qui rejoint avec votre lien.`}
              </p>
              {canJoin && (
                <div className="flex flex-wrap gap-3 pt-1">
                  <span className="rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-xs font-bold text-amber-300">
                    Tarif unique : {Number(publicConfig.price || 0).toLocaleString('fr-FR')} {publicConfig.currency || 'XOF'}
                  </span>
                  <span className="rounded-lg bg-slate-950/80 border border-slate-800 px-3 py-1.5 text-xs font-bold text-emerald-400">
                    {publicConfig.spotsRemaining} / {publicConfig.maxPartners} places restantes
                  </span>
                </div>
              )}
            </div>

            {canJoin ? (
              <button
                type="button"
                disabled={Number(publicConfig.spotsRemaining) <= 0}
                onClick={() => setPartnerModalOpen(true)}
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-4 text-sm font-black text-slate-950 shadow-xl hover:brightness-110 transition disabled:opacity-40"
              >
                <Crown className="h-5 w-5" />
                <span>{Number(publicConfig.spotsRemaining) <= 0 ? 'Places Complètes' : 'Lire Conditions & Souscrire'}</span>
              </button>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs text-slate-400">
                Le programme de partenariat est actuellement fermé.
              </div>
            )}
          </div>
        </div>

        <PartnershipModal
          isOpen={partnerModalOpen}
          config={publicConfig}
          onClose={() => setPartnerModalOpen(false)}
          onCompleted={async () => {
            await refreshUser();
            await loadAll();
          }}
        />
      </div>
    );
  }

  // Active Partner Dashboard
  return (
    <div className="space-y-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-400" /> Dashboard Partenaire VIP
            </h1>
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-0.5 text-xs font-bold text-emerald-300">
              ★ Accès à Vie Actif · {commissionRate}% Commission
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Suivez vos filleuls, leurs souscriptions mensuelles/trimestrielles, vos commissions ({commissionRate}%) et retirez vos gains par Mobile Money.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Actualiser
          </button>
          <button
            type="button"
            onClick={() => {
              setWAmount(String(Math.max(200, Math.floor(p.balance || 0))));
              setWPhone(p.phone || '');
              setWithdrawOpen(true);
            }}
            disabled={(p.balance || 0) < 200}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg hover:brightness-110 disabled:opacity-40"
          >
            <Wallet className="h-4 w-4" /> Retirer mes gains
          </button>
        </div>
      </div>

      {/* Monthly 0-affiliate warning */}
      {stats.monthlyInactiveWarning && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-100">
            <strong>Attention — Règle d'activité mensuelle :</strong> Vous n'avez enregistré aucun nouvel utilisateur affilié au cours des 30 derniers jours. Conformément aux conditions du programme, vous risquez une exclusion par l'administrateur si aucun affilié ne rejoint via votre lien.
          </div>
        </div>
      )}

      {/* Affiliate Link Card */}
      <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
            Votre Lien d'Affiliation Partenaire ({commissionRate}% par souscription)
          </span>
          <p className="text-xs text-slate-400">
            Partagez ce lien : tout utilisateur inscrit via ce lien vous rapporte {commissionRate}% à chaque période de souscription.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            readOnly
            value={data.affiliateLink || ''}
            className="w-full md:w-80 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-cyan-300 focus:outline-none"
          />
          <button
            type="button"
            onClick={copyLink}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-400"
          >
            <Copy className="h-4 w-4" /> Copier
          </button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Utilisateurs Inscrits</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-3xl font-black text-white">{stats.totalInvited || 0}</p>
          <p className="mt-1 text-xs text-slate-400">Dont {stats.monthlyInvitedCount || 0} ce mois-ci</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Utilisateurs Ayant Payé</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-400">{stats.payingUsersCount || 0}</p>
          <p className="mt-1 text-xs text-slate-400">Filleuls convertis en abonnés</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>Total Gains ({commissionRate}%)</span>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-3xl font-black text-amber-400">
            {Number(p.totalEarned || 0).toLocaleString('fr-FR')} <span className="text-sm">{currency}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Total retiré : {Number(p.totalWithdrawn || 0).toLocaleString('fr-FR')} {currency}</p>
        </div>

        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
            <span>Solde Disponible Retirable</span>
            <Wallet className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-3xl font-black text-white">
            {Number(p.balance || 0).toLocaleString('fr-FR')} <span className="text-sm text-emerald-400">{currency}</span>
          </p>
          <p className="mt-1 text-xs text-emerald-300/80">Retrait instantané via iKeePay H2H</p>
        </div>
      </div>

      {/* Detailed Referred Users + Earnings Per User Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-400" /> Détails des Utilisateurs Parrainés &amp; Gains par Abonné
          </h2>
          <span className="text-xs text-slate-400">{data.referredUsers?.length || 0} utilisateur(s)</span>
        </div>

        {!data.referredUsers?.length ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Aucun utilisateur ne s'est encore inscrit avec votre lien d'affiliation. Partagez votre lien ci-dessus pour commencer à percevoir {commissionRate}% de commissions !
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950/70 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Utilisateur</th>
                  <th className="px-5 py-3">Date d'inscription</th>
                  <th className="px-5 py-3">Souscription</th>
                  <th className="px-5 py-3">A payé ?</th>
                  <th className="px-5 py-3">Total Payé</th>
                  <th className="px-5 py-3">Votre Gain ({commissionRate}%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data.referredUsers.map((ru) => (
                  <tr key={ru._id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white">{ru.name}</div>
                      <div className="text-xs text-slate-400">{ru.email}</div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {new Date(ru.registeredAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3.5 capitalize text-slate-200 font-semibold">
                      {ru.subscriptionPlan} ({ru.subscriptionStatus})
                    </td>
                    <td className="px-5 py-3.5">
                      {ru.hasPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Oui ({ru.paymentsCount} paiement{ru.paymentsCount > 1 ? 's' : ''})
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">Pas encore payé</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-200">
                      {Number(ru.totalPaidByUser || 0).toLocaleString('fr-FR')} {currency}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-black text-amber-400">
                        +{Number(ru.partnerEarningsFromUser || 0).toLocaleString('fr-FR')} {currency}
                      </span>
                      {ru.scheduledEarnings > 0 && (
                        <span className="block text-[10px] text-cyan-300">
                          (+{Number(ru.scheduledEarnings).toLocaleString('fr-FR')} {currency} programmé fin période)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payouts History */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-400" /> Historique de vos Retraits (iKeePay H2H Payout)
          </h2>
        </div>

        {!data.payouts?.length ? (
          <div className="p-8 text-center text-xs text-slate-400">Aucun retrait effectué pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Référence / Date</th>
                  <th className="px-5 py-3">Destination</th>
                  <th className="px-5 py-3">Montant</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {data.payouts.map((po) => (
                  <tr key={po._id}>
                    <td className="px-5 py-3">
                      <span className="font-mono font-bold text-white block">{po.externalRef}</span>
                      <span className="text-slate-400">{new Date(po.createdAt).toLocaleString('fr-FR')}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-200">
                      {po.operator} ({po.country}) · {po.phoneNumber}
                    </td>
                    <td className="px-5 py-3 font-black text-emerald-400">
                      {Number(po.amount).toLocaleString('fr-FR')} {po.currency}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold ${
                          po.status === 'approved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : po.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {po.status === 'approved' ? 'Transféré' : po.status === 'pending' ? 'En cours' : 'Échoué'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {po.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => verifyPayout(po.externalRef)}
                          className="text-cyan-400 hover:underline font-semibold"
                        >
                          Vérifier statut
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* H2H Payout Withdrawal Modal */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-400" /> Retrait Mobile Money H2H
              </h3>
              <button
                type="button"
                onClick={() => setWithdrawOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold"
              >
                Fermer
              </button>
            </div>

            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 flex justify-between text-xs">
              <span className="text-emerald-300">Solde disponible :</span>
              <span className="font-black text-white">{Number(p.balance || 0).toLocaleString('fr-FR')} {currency}</span>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Pays</label>
                  <select
                    value={wCountry}
                    onChange={(e) => setWCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {H2H_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name} (+{c.dial})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">Opérateur</label>
                  <select
                    value={wOperator}
                    onChange={(e) => setWOperator(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    {selectedCountry.operators.map((op) => (
                      <option key={op} value={op}>{OPERATOR_LABELS[op] || op}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Numéro bénéficiaire</label>
                <input
                  type="tel"
                  required
                  value={wPhone}
                  onChange={(e) => setWPhone(e.target.value)}
                  placeholder={`${selectedCountry.dial}0700000000`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">Montant à retirer ({currency})</label>
                <input
                  type="number"
                  required
                  min={200}
                  max={Math.floor(p.balance || 0)}
                  value={wAmount}
                  onChange={(e) => setWAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={withdrawing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 text-sm font-black text-slate-950 hover:brightness-110 disabled:opacity-50"
              >
                {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                <span>Confirmer le Retrait iKeePay H2H</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
