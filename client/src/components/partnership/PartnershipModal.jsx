import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Crown,
  Check,
  ShieldCheck,
  FileText,
  CreditCard,
  Globe,
  Phone,
  Mail,
  KeyRound,
  User,
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { partnershipApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { H2H_COUNTRIES, OPERATOR_LABELS } from '../../constants/h2hCountries.js';

/**
 * Multi-step VIP Partnership Program Modal:
 * 1. Details & Terms and Conditions reading + consent checkbox
 * 2. iKeePay H2H Payment (Payin POST /h2h-payin + Verify GET /h2h-verify/:ref + payment_link)
 * 3. Mandatory Partner Identification Form (Full Name, Email, Phone -> sent to Admin & activates immediately)
 * 4. Immediate Partner Success + Redirect to /dashboard/partner
 */
export default function PartnershipModal({ isOpen, config, onClose, onCompleted }) {
  const { user, isAuthenticated, refreshUser, setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('details'); // 'details' | 'payment' | 'pending' | 'form' | 'success'
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Payment fields
  const [country, setCountry] = useState('CI');
  const [operator, setOperator] = useState('ORANGE');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone || '');
  const [payEmail, setPayEmail] = useState(user?.email || '');
  const [otp, setOtp] = useState('');
  const [orderId, setOrderId] = useState('');
  const [providerRef, setProviderRef] = useState('');
  const [paymentLink, setPaymentLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Post-payment form fields (Email, Name, Phone -> sent to Admin)
  const [formFullName, setFormFullName] = useState(
    user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : ''
  );
  const [formEmail, setFormEmail] = useState(user?.email || '');
  const [formPhone, setFormPhone] = useState(user?.phone || '');
  const [formPassword, setFormPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [needsLoginRedirect, setNeedsLoginRedirect] = useState(false);

  const selectedCountryObj = H2H_COUNTRIES.find((c) => c.code === country) || H2H_COUNTRIES[0];
  const requiresOtpHint = country === 'BF' && operator === 'ORANGE';

  useEffect(() => {
    if (isOpen) {
      setStep('details');
      setAcceptedTerms(false);
      setPayEmail(user?.email || '');
      setPhoneNumber(user?.phone || '');
      setFormFullName(user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '');
      setFormEmail(user?.email || '');
      setFormPhone(user?.phone || '');
      setFormPassword('');
      setNeedsPassword(false);
      setNeedsLoginRedirect(false);
      setOrderId('');
      setProviderRef('');
      setPaymentLink('');
      setOtp('');
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (!selectedCountryObj.operators.includes(operator)) {
      setOperator(selectedCountryObj.operators[0]);
    }
  }, [country, selectedCountryObj, operator]);

  // Poll H2H verify while awaiting Mobile Money approval
  useEffect(() => {
    if (!isOpen || step !== 'pending' || !orderId) return undefined;
    const interval = setInterval(() => {
      verifyPaymentStatus(true);
    }, 4500);
    return () => clearInterval(interval);
  }, [isOpen, step, orderId]);

  const initiatePayment = async (e) => {
    e.preventDefault();
    if (!payEmail.trim()) {
      toast.error('Votre adresse email est requise.');
      return;
    }
    if (Number(config?.price || 0) > 0 && (!phoneNumber.trim() || phoneNumber.replace(/[^\d]/g, '').length < 8)) {
      toast.error('Veuillez saisir un numéro Mobile Money valide.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await partnershipApi.pay({
        email: payEmail.trim(),
        phoneNumber: phoneNumber.trim(),
        country,
        operator,
        otp: otp.trim() || undefined,
        fullName: formFullName.trim() || undefined,
        acceptedTerms: true,
      });

      const d = data?.data || {};
      setOrderId(d.orderId || '');
      setProviderRef(d.providerRef || '');
      setPaymentLink(d.paymentLink || '');
      if (!formEmail) setFormEmail(payEmail.trim());
      if (!formPhone) setFormPhone(phoneNumber.trim());

      if (d.status === 'approved') {
        toast.success('Paiement confirmé ! Remplissez maintenant votre formulaire Partenaire.');
        setStep('form');
      } else {
        setStep('pending');
        if (d.paymentLink) {
          toast.success('Lien de paiement iKeePay prêt ! Finalisez pour continuer.');
        } else {
          toast.success('Demande Mobile Money envoyée sur votre téléphone.');
        }
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyPaymentStatus = async (silent = false) => {
    if (!orderId) return;
    if (!silent) setVerifying(true);
    try {
      const { data } = await partnershipApi.verifyPayment({ orderId, providerRef });
      const status = data?.data?.status;
      if (status === 'approved') {
        toast.success('Paiement Partenaire confirmé ! Veuillez compléter votre formulaire.');
        if (!formEmail) setFormEmail(data?.data?.email || payEmail);
        if (!formPhone) setFormPhone(phoneNumber);
        setStep('form');
      } else if (status === 'rejected') {
        if (!silent) toast.error('Le paiement a échoué ou a été annulé.');
        setStep('payment');
      } else if (!silent) {
        toast('Paiement toujours en attente de confirmation...', { icon: '⏳' });
      }
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err));
    } finally {
      if (!silent) setVerifying(false);
    }
  };

  const submitPartnerForm = async (e) => {
    e.preventDefault();
    if (!formFullName.trim() || !formEmail.trim() || !formPhone.trim()) {
      toast.error('Veuillez remplir votre nom, email et numéro de téléphone.');
      return;
    }
    if (needsPassword && formPassword.length < 8) {
      toast.error('Veuillez choisir un mot de passe d’au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await partnershipApi.completeRegistration({
        orderId,
        fullName: formFullName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        password: formPassword || undefined,
      });

      const d = data?.data || {};
      if (d.requiresPassword) {
        setNeedsPassword(true);
        toast('Choisissez un mot de passe pour créer votre accès immédiat.', { icon: '🔐' });
        setLoading(false);
        return;
      }

      if (d.accessToken && d.refreshToken && d.user) {
        setSession({ accessToken: d.accessToken, refreshToken: d.refreshToken, user: d.user });
      } else if (isAuthenticated) {
        await refreshUser();
      }

      setNeedsLoginRedirect(Boolean(d.needsLogin));
      toast.success(data.message || 'Statut Partenaire VIP activé immédiatement !');
      setStep('success');
      onCompleted?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !config) return null;

  const spotsRemaining = Number(config.spotsRemaining ?? config.maxPartners ?? 0);
  const priceDisplay = `${Number(config.price || 0).toLocaleString('fr-FR')} ${config.currency || 'XOF'}`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 18 }}
          className="relative w-full max-w-2xl rounded-3xl border border-amber-500/40 bg-slate-900 p-6 sm:p-8 shadow-2xl shadow-amber-500/10 text-white my-6 max-h-[92vh] overflow-y-auto"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header Stepper */}
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/25">
              <Crown className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-white">{config.title || 'Programme de Partenariat VIP'}</h2>
                <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                  {spotsRemaining} places restantes / {config.maxPartners}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {priceDisplay} · Accès à vie + {config.commissionRate || 30}% de commission chaque mois
              </p>
            </div>
          </div>

          {/* Step 1: Details + Terms & Conditions */}
          {step === 'details' && (
            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-300 mb-3">
                  Avantages Exclusifs Partenaire
                </h3>
                <ul className="space-y-2">
                  {(config.benefits || []).map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <Check className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                  <FileText className="h-4 w-4 text-amber-400" />
                  <span>Détails, Termes &amp; Conditions du Partenariat</span>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950/90 p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
                  {config.termsAndConditions}
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 cursor-pointer hover:border-amber-500/40 transition">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs text-slate-200">
                  J'ai lu et j'accepte les détails, avantages et conditions du Programme de Partenariat (notamment la règle d'activité mensuelle et le partage {config.commissionRate || 30}% / {100 - (config.commissionRate || 30)}%).
                </span>
              </label>

              <button
                type="button"
                disabled={!acceptedTerms || spotsRemaining <= 0}
                onClick={() => setStep('payment')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 py-3.5 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/20 hover:brightness-110 transition disabled:opacity-40"
              >
                {spotsRemaining <= 0 ? (
                  <span>Programme Complet ({config.maxPartners}/{config.maxPartners})</span>
                ) : (
                  <>
                    <span>Souscrire &amp; Payer {priceDisplay}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: iKeePay H2H Payment */}
          {step === 'payment' && (
            <form onSubmit={initiatePayment} className="mt-6 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Montant d'adhésion Partenaire à Vie :</span>
                <span className="text-base font-black text-amber-400">{priceDisplay}</span>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Adresse Email *</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={payEmail}
                    onChange={(e) => setPayEmail(e.target.value)}
                    placeholder="votre-email@exemple.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">Pays *</label>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                    >
                      {H2H_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name} ({c.code} · +{c.dial})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">Opérateur Mobile Money *</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  >
                    {selectedCountryObj.operators.map((op) => (
                      <option key={op} value={op}>
                        {OPERATOR_LABELS[op] || op}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Numéro de paiement Mobile Money *</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder={`${selectedCountryObj.dial}0700000000`}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Code OTP Mobile Money {requiresOtpHint ? '(Requis Orange BF)' : '(Optionnel)'}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required={requiresOtpHint}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder={requiresOtpHint ? 'Code OTP Orange Money BF' : 'Laissez vide si non requis'}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-black text-slate-950 shadow-lg hover:brightness-110 transition disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  <span>{loading ? 'Initialisation iKeePay...' : `Payer ${priceDisplay} maintenant`}</span>
                </button>
              </div>
            </form>
          )}

          {/* Step 2B: Pending confirmation */}
          {step === 'pending' && (
            <div className="mt-6 space-y-5 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Validation du Paiement Partenaire</h3>
                <p className="mt-1 text-xs font-mono text-amber-300">Réf : {orderId}</p>
              </div>

              {paymentLink ? (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                  <p className="text-xs text-slate-200">
                    Cliquez ci-dessous pour finaliser votre paiement sécurisé {OPERATOR_LABELS[operator] || operator} :
                  </p>
                  <a
                    href={paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400"
                  >
                    <span>Payer sur iKeePay</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                  Validez le paiement sur votre téléphone ({phoneNumber}). Dès confirmation, le formulaire d'identification partenaire s'ouvrira automatiquement.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => verifyPaymentStatus(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 px-4 text-xs font-black text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span>J'ai payé — Vérifier maintenant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('payment')}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Changer numéro
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Post-Payment Partner Form sent to Admin */}
          {step === 'form' && (
            <form onSubmit={submitPartnerForm} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-200">
                  <strong>Paiement approuvé ({orderId}) !</strong> Complétez ce formulaire officiel pour transmettre vos coordonnées à l'administrateur et débloquer immédiatement votre accès à vie et votre Dashboard Partenaire.
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Nom complet du Partenaire *</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Ex : Kouame Valdes"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Adresse Email du compte *</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="votre-email@exemple.com"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">Numéro de téléphone / WhatsApp *</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {needsPassword && !isAuthenticated && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-amber-300">
                    Créer un mot de passe (min. 8 caractères) pour votre nouvel espace *
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="w-full rounded-xl border border-amber-500/50 bg-slate-950 pl-10 pr-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-black text-slate-950 shadow-xl hover:brightness-110 transition disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>{loading ? 'Activation en cours...' : 'Envoyer le formulaire & Activer mes avantages'}</span>
              </button>
            </form>
          )}

          {/* Step 4: Instant Activation Confirmation */}
          {step === 'success' && (
            <div className="mt-6 py-6 text-center space-y-5">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <Crown className="h-9 w-9 text-amber-400" />
              </div>

              <div>
                <h3 className="text-2xl font-black text-white">Bienvenue parmi nos Partenaires VIP !</h3>
                <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
                  Votre formulaire a bien été transmis à l'administrateur. Votre accès à vie est actif dès maintenant et vous percevez {config.commissionRate || 30}% de commission chaque mois sur vos filleuls.
                </p>
              </div>

              {needsLoginRedirect ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    navigate('/login');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-black text-slate-950 hover:bg-amber-400 transition"
                >
                  <span>Me connecter à mon Dashboard Partenaire</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    navigate('/dashboard/partner');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 px-6 py-3.5 text-sm font-black text-slate-950 hover:brightness-110 transition"
                >
                  <span>Accéder à mon Dashboard Partenaire</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
