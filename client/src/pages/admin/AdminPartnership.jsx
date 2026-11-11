import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Crown,
  Users,
  Wallet,
  Settings,
  CheckCircle2,
  Ban,
  Power,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Save,
  RotateCcw,
  Loader2,
  FileText,
  Phone,
  Mail,
} from 'lucide-react';
import { partnershipApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { H2H_COUNTRIES, OPERATOR_LABELS } from '../../constants/h2hCountries.js';
import Spinner from '../../components/ui/Spinner.jsx';

export default function AdminPartnership() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('partners'); // 'partners' | 'config' | 'revenue'

  // Config editor state
  const [cfgForm, setCfgForm] = useState(null);
  const [savingCfg, setSavingCfg] = useState(false);

  // Admin Payout state
  const [wCountry, setWCountry] = useState('CI');
  const [wOperator, setWOperator] = useState('ORANGE');
  const [wPhone, setWPhone] = useState('');
  const [wAmount, setWAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const { data: res } = await partnershipApi.adminOverview();
      const d = res?.data;
      setData(d);
      if (d?.config) {
        setCfgForm({
          isEnabled: Boolean(d.config.isEnabled),
          isDeleted: Boolean(d.config.isDeleted),
          title: d.config.title || '',
          subtitle: d.config.subtitle || '',
          badgeText: d.config.badgeText || '',
          price: d.config.price ?? 50000,
          currency: d.config.currency || 'XOF',
          maxPartners: d.config.maxPartners ?? 50,
          commissionRate: d.config.commissionRate ?? 30,
          creditTiming: d.config.creditTiming || 'instant',
          benefitsText: Array.isArray(d.config.benefits) ? d.config.benefits.join('\n') : '',
          termsAndConditions: d.config.termsAndConditions || '',
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const selectedCountry = H2H_COUNTRIES.find((c) => c.code === wCountry) || H2H_COUNTRIES[0];
  useEffect(() => {
    if (!selectedCountry.operators.includes(wOperator)) {
      setWOperator(selectedCountry.operators[0]);
    }
  }, [wCountry, selectedCountry, wOperator]);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingCfg(true);
    try {
      const benefits = cfgForm.benefitsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await partnershipApi.adminUpdateConfig({
        isEnabled: cfgForm.isEnabled,
        isDeleted: cfgForm.isDeleted,
        title: cfgForm.title,
        subtitle: cfgForm.subtitle,
        badgeText: cfgForm.badgeText,
        price: Number(cfgForm.price),
        currency: cfgForm.currency,
        maxPartners: Number(cfgForm.maxPartners),
        commissionRate: Number(cfgForm.commissionRate),
        creditTiming: cfgForm.creditTiming,
        benefits,
        termsAndConditions: cfgForm.termsAndConditions,
      });
      toast.success('Paramètres du Programme de Partenariat mis à jour !');
      await loadOverview();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingCfg(false);
    }
  };

  const handleDeleteProgram = async () => {
    if (!window.confirm('Voulez-vous vraiment supprimer/masquer le Programme de Partenariat du site public ?')) return;
    try {
      await partnershipApi.adminDeleteProgram();
      toast.success('Programme supprimé du site public.');
      await loadOverview();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRestoreProgram = async () => {
    try {
      await partnershipApi.adminUpdateConfig({ isDeleted: false, isEnabled: true });
      toast.success('Programme de Partenariat restauré et réactivé !');
      await loadOverview();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePartnerAction = async (partner, action) => {
    const labelMap = {
      activate: `Réactiver le partenaire ${partner.formFullName || partner.email} ?`,
      exclude: `Exclure le partenaire ${partner.formFullName || partner.email} (perte de l'accès à vie et des avantages) ?`,
      disable: `Désactiver temporairement le partenaire ${partner.formFullName || partner.email} ?`,
      remove: `Retirer complètement ${partner.formFullName || partner.email} du programme ?`,
    };
    if (!window.confirm(labelMap[action] || 'Confirmer action ?')) return;

    try {
      const reason = action === 'exclude' && partner.eligibleForMonthlyExclusion
        ? 'Exclu pour inactivité mensuelle (0 affilié durant 30 jours)'
        : undefined;
      await partnershipApi.adminUpdatePartnerStatus(partner._id, { action, reason });
      toast.success('Statut du partenaire mis à jour.');
      await loadOverview();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleAdminWithdraw = async (e) => {
    e.preventDefault();
    const amt = Math.round(Number(wAmount));
    if (!amt || amt < 200) {
      toast.error('Montant minimum : 200 FCFA.');
      return;
    }
    if (!wPhone.trim()) {
      toast.error('Numéro Mobile Money requis.');
      return;
    }

    setWithdrawing(true);
    try {
      const res = await partnershipApi.adminWithdraw({
        amount: amt,
        country: wCountry,
        operator: wOperator,
        phoneNumber: wPhone.trim(),
      });
      toast.success(res.data?.message || 'Retrait Admin initié via iKeePay H2H !');
      setWAmount('');
      await loadOverview();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWithdrawing(false);
    }
  };

  const verifyAdminPayout = async (externalRef) => {
    try {
      await partnershipApi.adminVerifyPayout({ externalRef });
      toast.success('Statut du retrait actualisé.');
      await loadOverview();
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

  const adminRev = data?.adminRevenue || {};
  const partners = data?.partners || [];
  const cfg = data?.config || {};
  const currency = cfg.currency || 'XOF';
  const inactiveCount = partners.filter((p) => p.eligibleForMonthlyExclusion).length;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2.5">
            <Crown className="h-6 w-6 text-amber-400" /> Programme de Partenariat &amp; Revenus 70%
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Gérez les places, tarifs, conditions, formulaires reçus, exclusions mensuelles et retraits de la part Admin ({100 - (cfg.commissionRate || 30)}%).
          </p>
        </div>

        <button
          type="button"
          onClick={loadOverview}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-800"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* Program Deleted Alert */}
      {cfg.isDeleted && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-rose-200">
            <strong>Programme supprimé du site public :</strong> La bannière et l'offre partenariat ne sont plus visibles par les visiteurs.
          </div>
          <button
            type="button"
            onClick={handleRestoreProgram}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-emerald-400"
          >
            <RotateCcw className="h-4 w-4" /> Restaurer le Programme
          </button>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs font-semibold text-slate-400">Partenaires Actifs / Limite</span>
          <p className="mt-2 text-3xl font-black text-amber-400">
            {data?.activePartnersCount || 0} <span className="text-lg text-slate-500">/ {cfg.maxPartners || 50}</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">{data?.spotsRemaining || 0} places restantes</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs font-semibold text-slate-400">Inactifs à Exclure (0 affilié / 30j)</span>
          <p className={`mt-2 text-3xl font-black ${inactiveCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {inactiveCount}
          </p>
          <p className="mt-1 text-xs text-slate-400">Surveillance règle mensuelle</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <span className="text-xs font-semibold text-slate-400">Adhésions Partenariat</span>
          <p className="mt-2 text-2xl font-black text-cyan-400">
            {Number(adminRev.partnershipSalesTotal || 0).toLocaleString('fr-FR')} {currency}
          </p>
          <p className="mt-1 text-xs text-slate-400">{adminRev.partnershipSalesCount || 0} souscription(s)</p>
        </div>

        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-950/20 p-5">
          <span className="text-xs font-bold text-emerald-300">Solde Admin Retirable ({100 - (cfg.commissionRate || 30)}%)</span>
          <p className="mt-2 text-2xl font-black text-white">
            {Number(adminRev.poolBalance || 0).toLocaleString('fr-FR')} {currency}
          </p>
          <p className="mt-1 text-xs text-emerald-300/80">
            Total cumulé : {Number(adminRev.totalAdminShareEarned || 0).toLocaleString('fr-FR')} {currency}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'partners', label: `Partenaires & Formulaires (${partners.length})`, icon: Users },
          { id: 'config', label: 'Configuration, Prix & Conditions', icon: Settings },
          { id: 'revenue', label: `Revenus Admin (${100 - (cfg.commissionRate || 30)}%) & Retraits`, icon: Wallet },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
              tab === item.id
                ? 'bg-amber-500 text-slate-950 shadow-lg'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: PARTNERS & SUBMITTED FORMS */}
      {tab === 'partners' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">
          {partners.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Aucun partenaire inscrit pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Partenaire / Formulaire Reçu</th>
                    <th className="px-4 py-3">Invités / Payants</th>
                    <th className="px-4 py-3">Activité 30j</th>
                    <th className="px-4 py-3">Gains ({cfg.commissionRate || 30}% / {100 - (cfg.commissionRate || 30)}%)</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Actions Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {partners.map((p) => (
                    <tr key={p._id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-4 space-y-1">
                        <div className="font-bold text-white text-sm">{p.formFullName || p.accountName}</div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Mail className="h-3 w-3 text-cyan-400" /> {p.formEmail}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Phone className="h-3 w-3 text-emerald-400" /> {p.formPhone || 'Non renseigné'}
                        </div>
                        <div className="text-[11px] font-mono text-amber-300">
                          Code: {p.referralCode} {p.paymentRef ? `· ${p.paymentRef}` : ''}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-bold text-white text-sm">{p.totalInvited} inscrits</div>
                        <div className="text-emerald-400 font-semibold">{p.payingUsersCount} abonné(s) payants</div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-200">{p.monthlyAffiliatesCount} ce mois</div>
                        {p.eligibleForMonthlyExclusion && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            <AlertTriangle className="h-3 w-3" /> 0 affilié — À exclure
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 space-y-0.5 font-mono">
                        <div className="text-amber-400 font-bold">
                          Partenaire: {Number(p.totalEarned || 0).toLocaleString('fr-FR')} {currency}
                        </div>
                        <div className="text-slate-400">
                          Solde dispo: {Number(p.balance || 0).toLocaleString('fr-FR')} {currency}
                        </div>
                        <div className="text-emerald-400 font-bold">
                          Admin ({100 - (cfg.commissionRate || 30)}%): {Number(p.totalAdminShareFromPartner || 0).toLocaleString('fr-FR')} {currency}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {p.isActive && p.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 font-bold text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Actif à Vie
                          </span>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 font-bold text-rose-300">
                              <Ban className="h-3 w-3" /> {p.status === 'excluded' ? 'Exclu' : 'Désactivé'}
                            </span>
                            {p.excludedReason && <p className="mt-1 text-[10px] text-rose-300/80 max-w-[160px]">{p.excludedReason}</p>}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {p.isActive && p.status === 'active' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePartnerAction(p, 'exclude')}
                                className="rounded-lg bg-rose-500/20 border border-rose-500/40 px-2.5 py-1.5 font-bold text-rose-300 hover:bg-rose-500/30"
                              >
                                Exclure
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePartnerAction(p, 'disable')}
                                className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1.5 font-bold text-slate-300 hover:bg-slate-700"
                              >
                                Désactiver
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePartnerAction(p, 'activate')}
                              className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1.5 font-bold text-emerald-300 hover:bg-emerald-500/30"
                            >
                              Activer à nouveau
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePartnerAction(p, 'remove')}
                            className="rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-400 hover:text-rose-400"
                            title="Retirer du programme"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROGRAM CONFIGURATION */}
      {tab === 'config' && cfgForm && (
        <form onSubmit={handleSaveConfig} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cfgForm.isEnabled}
                onChange={(e) => setCfgForm({ ...cfgForm, isEnabled: e.target.checked })}
                className="h-5 w-5 rounded border-slate-600 text-amber-500"
              />
              <div>
                <span className="text-sm font-black text-white block">Activer le Programme de Partenariat</span>
                <span className="text-xs text-slate-400">Affiche le programme en carrousel sur la bannière d'accueil et dans la section Plans</span>
              </div>
            </label>

            <button
              type="button"
              onClick={handleDeleteProgram}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
            >
              <Trash2 className="h-4 w-4" /> Supprimer le Programme
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Titre du programme</label>
              <input
                type="text"
                value={cfgForm.title}
                onChange={(e) => setCfgForm({ ...cfgForm, title: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Badge carrousel</label>
              <input
                type="text"
                value={cfgForm.badgeText}
                onChange={(e) => setCfgForm({ ...cfgForm, badgeText: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-300">Sous-titre / Accroche</label>
              <input
                type="text"
                value={cfgForm.subtitle}
                onChange={(e) => setCfgForm({ ...cfgForm, subtitle: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Prix d'adhésion</label>
              <input
                type="number"
                min={0}
                value={cfgForm.price}
                onChange={(e) => setCfgForm({ ...cfgForm, price: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Devise</label>
              <select
                value={cfgForm.currency}
                onChange={(e) => setCfgForm({ ...cfgForm, currency: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
              >
                <option value="XOF">XOF (FCFA)</option>
                <option value="XAF">XAF (FCFA)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">Limite maximale de partenaires (Places)</label>
              <input
                type="number"
                min={1}
                value={cfgForm.maxPartners}
                onChange={(e) => setCfgForm({ ...cfgForm, maxPartners: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-bold"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Commission Partenaire (%) — Part Admin = {100 - Number(cfgForm.commissionRate || 0)}%
              </label>
              <input
                type="number"
                min={1}
                max={95}
                value={cfgForm.commissionRate}
                onChange={(e) => setCfgForm({ ...cfgForm, commissionRate: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-bold"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-300">Moment du crédit des commissions (30% / 70%)</label>
              <select
                value={cfgForm.creditTiming}
                onChange={(e) => setCfgForm({ ...cfgForm, creditTiming: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white"
              >
                <option value="instant">Crédit immédiat dès validation du paiement de l'abonné</option>
                <option value="period_end">Libération automatique à la fin de la période de souscription</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-300">Liste des Avantages (1 par ligne)</label>
              <textarea
                rows={4}
                value={cfgForm.benefitsText}
                onChange={(e) => setCfgForm({ ...cfgForm, benefitsText: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-300">Termes et Conditions du Partenariat</label>
              <textarea
                rows={10}
                value={cfgForm.termsAndConditions}
                onChange={(e) => setCfgForm({ ...cfgForm, termsAndConditions: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-200 leading-relaxed"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingCfg}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Enregistrer la configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: ADMIN 70% REVENUE POOL & H2H PAYOUT */}
      {tab === 'revenue' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleAdminWithdraw} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" /> Retirer la Part Admin ({100 - (cfg.commissionRate || 30)}%) via iKeePay H2H
            </h2>

            <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-semibold">Solde Admin disponible :</span>
              <span className="text-xl font-black text-white">
                {Number(adminRev.poolBalance || 0).toLocaleString('fr-FR')} {currency}
              </span>
            </div>

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
              <label className="mb-1 block text-xs font-semibold text-slate-300">Numéro de réception Mobile Money</label>
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
              <label className="mb-1 block text-xs font-semibold text-slate-300">Montant ({currency})</label>
              <input
                type="number"
                required
                min={200}
                max={Math.floor(adminRev.poolBalance || 0)}
                value={wAmount}
                onChange={(e) => setWAmount(e.target.value)}
                placeholder="Ex : 10000"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white font-bold"
              />
            </div>

            <button
              type="submit"
              disabled={withdrawing || (adminRev.poolBalance || 0) < 200}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black text-slate-950 hover:brightness-110 disabled:opacity-40"
            >
              {withdrawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              <span>Transférer vers mon compte Mobile Money</span>
            </button>
          </form>

          {/* Admin Payout History */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Historique des Retraits Admin</h2>
            {!data?.adminPayouts?.length ? (
              <p className="text-xs text-slate-400">Aucun retrait effectué par l'administrateur pour l'instant.</p>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {data.adminPayouts.map((po) => (
                  <div key={po._id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-white block">{po.externalRef}</span>
                      <span className="text-slate-400">
                        {po.operator} ({po.country}) · {po.phoneNumber}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-emerald-400 block">
                        {Number(po.amount).toLocaleString('fr-FR')} {po.currency}
                      </span>
                      <span className="text-[11px] uppercase font-bold text-slate-300">{po.status}</span>
                      {po.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => verifyAdminPayout(po.externalRef)}
                          className="ml-2 text-cyan-400 hover:underline"
                        >
                          Vérifier
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
