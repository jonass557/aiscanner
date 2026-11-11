import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CreditCard,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Globe,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { H2H_COUNTRIES, OPERATOR_LABELS } from '../../constants/h2hCountries.js';

/**
 * Shared iKeePay H2H Plan Checkout Modal (used on both Public Pricing and Dashboard Subscription).
 * Supports POST /h2h-payin (country, operator, phoneNumber, otp, payment_link) + polling GET /h2h-verify/:reference.
 */
export default function H2HPlanCheckoutModal({
  isOpen,
  plan,
  isAuthenticated = false,
  userEmail = '',
  userName = '',
  userPhone = '',
  onClose,
  onApproved,
}) {
  const [step, setStep] = useState('form'); // 'form' | 'pending' | 'success'
  const [fullName, setFullName] = useState(userName || '');
  const [email, setEmail] = useState(userEmail || '');
  const [country, setCountry] = useState('CI');
  const [operator, setOperator] = useState('ORANGE');
  const [phoneNumber, setPhoneNumber] = useState(userPhone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [txData, setTxData] = useState({ orderId: '', providerRef: '', paymentLink: '', amount: 0, currency: 'XOF' });

  const selectedCountryObj = H2H_COUNTRIES.find((c) => c.code === country) || H2H_COUNTRIES[0];
  const requiresOtpHint = country === 'BF' && operator === 'ORANGE';

  // Reset modal when opening for a new plan
  useEffect(() => {
    if (isOpen && plan) {
      setStep('form');
      setFullName(userName || '');
      setEmail(userEmail || '');
      setPhoneNumber(userPhone || '');
      setOtp('');
      setLoading(false);
      setVerifying(false);
      setTxData({ orderId: '', providerRef: '', paymentLink: '', amount: 0, currency: plan.currency || 'XOF' });
    }
  }, [isOpen, plan, userEmail, userName, userPhone]);

  // Keep valid operator when country changes
  useEffect(() => {
    if (!selectedCountryObj.operators.includes(operator)) {
      setOperator(selectedCountryObj.operators[0]);
    }
  }, [country, selectedCountryObj, operator]);

  // Automatic status polling every 4 seconds while payment is pending
  useEffect(() => {
    if (!isOpen || step !== 'pending' || !txData.orderId) return undefined;
    const timer = setInterval(() => {
      handleVerify(txData.orderId, true);
    }, 4500);
    return () => clearInterval(timer);
  }, [isOpen, step, txData.orderId]);

  const effectivePrice = plan
    ? (plan.promo?.enabled && Number(plan.promo?.price) > 0 ? Number(plan.promo.price) : Number(plan.price || 0))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated && (!email.trim() || !fullName.trim())) {
      toast.error('Veuillez renseigner votre nom complet et votre adresse email.');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.replace(/[^\d]/g, '').length < 8) {
      toast.error('Veuillez saisir un numéro Mobile Money valide (avec indicatif pays).');
      return;
    }

    const storedRef = typeof window !== 'undefined' ? (localStorage.getItem('ai_scanner_ref') || '') : '';

    setLoading(true);
    try {
      let res;
      if (isAuthenticated) {
        res = await paymentApi.initiateIkeepay({
          planId: plan.id,
          country,
          operator,
          phoneNumber: phoneNumber.trim(),
          otp: otp.trim() || undefined,
          customerEmail: email.trim() || undefined,
        });
      } else {
        res = await paymentApi.initiatePublicIkeepay({
          planId: plan.id,
          email: email.trim(),
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          country,
          operator,
          otp: otp.trim() || undefined,
          referralCode: storedRef || undefined,
        });
      }

      const d = res.data?.data || {};
      setTxData({
        orderId: d.orderId || '',
        providerRef: d.providerRef || '',
        paymentLink: d.paymentLink || d.checkoutUrl || '',
        amount: d.amount ?? effectivePrice,
        currency: d.currency || plan.currency || 'XOF',
      });

      if (d.isFree || d.status === 'approved') {
        toast.success('Paiement confirmé avec succès !');
        setStep('success');
        onApproved?.({ orderId: d.orderId, email: email.trim(), fullName: fullName.trim(), plan });
        return;
      }

      setStep('pending');
      if (d.paymentLink) {
        toast.success('Lien de paiement iKeePay généré ! Finalisez le règlement.');
      } else {
        toast.success('Demande envoyée sur votre téléphone Mobile Money !');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (orderIdToCheck, silent = false) => {
    const oid = orderIdToCheck || txData.orderId;
    if (!oid) return;
    if (!silent) setVerifying(true);
    try {
      const res = isAuthenticated
        ? await paymentApi.verifyIkeepay({ orderId: oid, providerRef: txData.providerRef })
        : await paymentApi.verifyPublicIkeepay({ orderId: oid, providerRef: txData.providerRef });

      const status = res.data?.data?.status;
      if (status === 'approved') {
        toast.success('Paiement iKeePay H2H validé !');
        setStep('success');
        onApproved?.({ orderId: oid, email: email.trim(), fullName: fullName.trim(), plan });
      } else if (status === 'rejected') {
        if (!silent) toast.error('La transaction a échoué ou a été annulée.');
        setStep('form');
      } else if (!silent) {
        toast('Paiement toujours en attente de confirmation...', { icon: '⏳' });
      }
    } catch (err) {
      if (!silent) toast.error(getErrorMessage(err));
    } finally {
      if (!silent) setVerifying(false);
    }
  };

  if (!isOpen || !plan) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl text-white my-8 max-h-[92vh] overflow-y-auto"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          {step === 'form' && (
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <CreditCard className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-white">Paiement Direct Mobile Money (H2H)</h3>
                  <p className="text-xs text-slate-400">
                    Forfait : <span className="font-bold text-cyan-300">{plan.name}</span> ·{' '}
                    <span className="font-bold text-emerald-400">
                      {effectivePrice.toLocaleString('fr-FR')} {plan.currency || 'XOF'}
                    </span>
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {!isAuthenticated && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Nom complet *</label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Ex : Kouame Valdes"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-300">Adresse Email *</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="votre-email@exemple.com"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Pays *</label>
                    <div className="relative">
                      <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-9 pr-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
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
                    <label className="mb-1.5 block text-xs font-semibold text-slate-300">Opérateur *</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/90 px-3 py-2.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
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
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Numéro Mobile Money * (ex: {selectedCountryObj.dial}0700000000)
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder={`${selectedCountryObj.dial}0700000000`}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* OTP field — essential for Burkina Faso Orange or when operator requires OTP */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Code OTP Mobile Money {requiresOtpHint ? '(Obligatoire pour Orange BF)' : '(Si requis par opérateur)'}
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required={requiresOtpHint}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder={requiresOtpHint ? 'Code OTP (ex: *144*4*6*MONTANT#)' : 'Optionnel — laissez vide sinon'}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                  {requiresOtpHint && (
                    <p className="mt-1 text-[11px] text-amber-400">
                      Pour Orange Burkina Faso, le montant est automatiquement arrondi au multiple de 100 XOF supérieur.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-cyan-500/20 hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Connexion iKeePay H2H...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>Payer {effectivePrice.toLocaleString('fr-FR')} {plan.currency || 'XOF'} via iKeePay</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'pending' && (
            <div className="space-y-5 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Confirmation de Paiement en cours</h3>
                <p className="mt-1 text-xs font-mono text-cyan-400">
                  Réf : {txData.orderId} {txData.providerRef ? `· ${txData.providerRef}` : ''}
                </p>
              </div>

              {txData.paymentLink ? (
                <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4 space-y-3">
                  <p className="text-xs text-slate-200">
                    Un lien de validation sécurisé a été généré pour {OPERATOR_LABELS[operator] || operator}. Cliquez ci-dessous pour finaliser :
                  </p>
                  <a
                    href={txData.paymentLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400 transition"
                  >
                    <span>Finaliser le paiement {OPERATOR_LABELS[operator] || operator}</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-300">
                  Veuillez confirmer la demande de débit sur votre téléphone ({phoneNumber}). La vérification automatique détectera la validation dès réception.
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => handleVerify(txData.orderId, false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 px-4 text-xs font-black text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span>Vérifier le statut maintenant</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Modifier numéro
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-black text-white">Paiement Validé !</h3>
              <p className="text-sm text-slate-300">
                Votre transaction iKeePay H2H est approuvée.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
