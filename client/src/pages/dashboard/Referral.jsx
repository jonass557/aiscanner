import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Share2,
  Users,
  Award,
  Wallet,
  ArrowUpRight,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Smartphone,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import { referralApi } from '../../services/endpoints.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Referral() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Withdrawal modal state
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mtn_mobile_money');
  const [phone, setPhone] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const res = await referralApi.getMy();
      setData(res.data?.data || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors du chargement des données de parrainage.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, []);

  const referralLink = typeof window !== 'undefined' && data?.referralCode
    ? `${window.location.origin}/register?ref=${data.referralCode}`
    : `https://aiscanner-ten.vercel.app/register?ref=${data?.referralCode || 'TRD'}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Lien de parrainage copié dans le presse-papiers !');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWithdrawal = () => {
    if (!data?.balance || data.balance < 500) {
      toast.error('Votre solde disponible est inférieur au montant minimum de retrait (500 FCFA).');
      return;
    }
    setAmount(String(data.balance));
    setShowModal(true);
  };

  const handleSubmitWithdrawal = async (e) => {
    e.preventDefault();
    const withdrawAmt = Number(amount);
    if (!withdrawAmt || withdrawAmt < 500) {
      toast.error('Le montant minimum de retrait est de 500 FCFA.');
      return;
    }
    if (withdrawAmt > (data?.balance || 0)) {
      toast.error(`Le montant dépasse votre solde disponible (${(data?.balance || 0).toLocaleString()} FCFA).`);
      return;
    }
    if (!phone.trim()) {
      toast.error('Veuillez saisir votre numéro Mobile Money.');
      return;
    }
    if (!accountHolder.trim()) {
      toast.error('Veuillez saisir le nom complet du titulaire de la ligne.');
      return;
    }

    try {
      setSubmitting(true);
      await referralApi.requestWithdrawal({
        amount: withdrawAmt,
        method,
        phone: phone.trim(),
        accountHolder: accountHolder.trim(),
      });
      toast.success('Votre demande de retrait a été transmise avec succès !');
      setShowModal(false);
      setPhone('');
      setAccountHolder('');
      await fetchReferralData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi de la demande de retrait.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <Share2 className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Programme Partenaire & Parrainage</h1>
        <p className="mt-2 text-slate-400">
          Le programme de parrainage vous permet de toucher 20% de commission récurrente sur tous les abonnements de vos affiliés, directement payables par Mobile Money (MTN & Orange Money).
        </p>
        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-slate-300">
          <p className="text-sm">
            Votre compte n'a pas encore le parrainage activé. Contactez l'administrateur ou le support pour activer votre statut d'apporteur d'affaires et obtenir votre lien de parrainage exclusif.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">Programme Partenaire Vérifié</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-100 sm:text-3xl">Espace Parrainage & Affiliation</h1>
          <p className="text-sm text-slate-400">
            Partagez votre lien exclusif et touchez {data.commissionRate || 20}% de commission sur chaque abonnement. Retraits instantanés par MTN & Orange Money.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReferralData} className="border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </div>

      {/* Referral Link Box */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900/90 to-cyan-950/20 p-6 shadow-xl shadow-cyan-950/10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Votre lien d'affiliation personnel</span>
            <p className="text-sm text-slate-300">
              Chaque utilisateur inscrit via ce lien est lié à vie à votre compte partenaire.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-slate-800/90 px-3 py-1 font-mono text-xs font-bold text-cyan-300 border border-slate-700">
              Code: {data.referralCode}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 font-mono text-sm text-slate-200 outline-none select-all"
            />
          </div>
          <Button
            onClick={copyToClipboard}
            className="flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-600/25 hover:bg-cyan-500"
          >
            {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copié !' : 'Copier mon lien'}
          </Button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Referred */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Filleuls Inscrits</span>
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-slate-100">{data.totalReferred || 0}</p>
          <span className="mt-1 block text-xs text-slate-500">Membres inscrits avec votre lien</span>
        </div>

        {/* Active Subscribers */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Abonnés Actifs</span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-400">{data.activeSubscribed || 0}</p>
          <span className="mt-1 block text-xs text-slate-500">Abonnements payants en cours</span>
        </div>

        {/* Commission Rate */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Taux de Commission</span>
            <div className="rounded-xl bg-purple-500/10 p-2.5 text-purple-400">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold text-purple-400">{data.commissionRate || 20}%</p>
          <span className="mt-1 block text-xs text-slate-500">Revenus reversés sur chaque vente</span>
        </div>

        {/* Available Balance & Withdraw Button */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 p-5 shadow-lg shadow-emerald-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Solde Disponible</span>
            <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-400">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-100">
            {(data.balance || 0).toLocaleString()} <span className="text-sm font-semibold text-emerald-400">FCFA</span>
          </p>
          <Button
            onClick={handleOpenWithdrawal}
            size="sm"
            disabled={(data.balance || 0) < 500}
            className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 font-semibold text-white shadow-md shadow-emerald-600/20"
          >
            <ArrowUpRight className="mr-1.5 h-4 w-4" />
            Demander un Retrait
          </Button>
        </div>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
          <span className="text-sm text-slate-400">Gains totaux générés à vie :</span>
          <span className="font-mono text-base font-bold text-slate-200">{(data.totalEarned || 0).toLocaleString()} FCFA</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
          <span className="text-sm text-slate-400">Total des retraits validés :</span>
          <span className="font-mono text-base font-bold text-emerald-400">{(data.totalWithdrawn || 0).toLocaleString()} FCFA</span>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100">Historique des Demandes de Retrait</h2>
            <p className="text-xs text-slate-400">Suivi des transferts Mobile Money (MTN & Orange)</p>
          </div>
        </div>

        {(!data.withdrawals || data.withdrawals.length === 0) ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Aucune demande de retrait effectuée pour le moment.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Montant</th>
                  <th className="pb-3 font-semibold">Moyen</th>
                  <th className="pb-3 font-semibold">Bénéficiaire</th>
                  <th className="pb-3 font-semibold">Numéro</th>
                  <th className="pb-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.withdrawals.map((w) => (
                  <tr key={w._id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 text-xs text-slate-400">
                      {new Date(w.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 font-bold font-mono text-slate-100">
                      {w.amount.toLocaleString()} FCFA
                    </td>
                    <td className="py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                        <Smartphone className="h-3.5 w-3.5 text-cyan-400" />
                        {w.method === 'mtn_mobile_money' ? 'MTN MoMo' : 'Orange Money'}
                      </span>
                    </td>
                    <td className="py-3.5 font-medium text-slate-200">{w.accountHolder}</td>
                    <td className="py-3.5 font-mono text-xs text-slate-300">{w.phone}</td>
                    <td className="py-3.5">
                      {w.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" /> Validé
                        </span>
                      )}
                      {w.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3" /> En attente
                        </span>
                      )}
                      {w.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-400 border border-red-500/20">
                          <AlertCircle className="h-3 w-3" /> Rejeté
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

      {/* Withdrawal Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Demande de Retrait Mobile Money</h3>
                <p className="text-xs text-slate-400">Solde disponible : {(data?.balance || 0).toLocaleString()} FCFA</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitWithdrawal} className="mt-4 space-y-4">
              {/* Operator */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Moyen de paiement Mobile Money
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMethod('mtn_mobile_money')}
                    className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition border ${
                      method === 'mtn_mobile_money'
                        ? 'border-yellow-500 bg-yellow-500/15 text-yellow-400'
                        : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    MTN Mobile Money
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('orange_money')}
                    className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition border ${
                      method === 'orange_money'
                        ? 'border-orange-500 bg-orange-500/15 text-orange-400'
                        : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    Orange Money
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Montant du retrait (FCFA)
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmount(String(data?.balance || 0))}
                    className="text-xs font-semibold text-cyan-400 hover:underline"
                  >
                    Tout retirer
                  </button>
                </div>
                <input
                  type="number"
                  min="500"
                  max={data?.balance || 0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
                  placeholder="Ex: 5000"
                  required
                />
                <span className="mt-1 block text-xs text-slate-500">Minimum 500 FCFA</span>
              </div>

              {/* Account Holder Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nom complet du titulaire de la ligne
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-500"
                  placeholder="Ex: Jean Paul Kouam"
                  required
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Numéro de téléphone Mobile Money
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500"
                  placeholder="Ex: +237 670 00 00 00"
                  required
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                <ShieldCheck className="inline mr-1 h-3.5 w-3.5 text-emerald-400" />
                Les fonds sont transférés directement sur votre compte Mobile Money dès validation par l'administrateur.
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="border-slate-800 bg-slate-800/40 text-slate-300"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/20"
                >
                  {submitting ? 'Traitement...' : 'Confirmer le retrait'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
