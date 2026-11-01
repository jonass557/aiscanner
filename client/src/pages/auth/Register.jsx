import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Lock, User } from 'lucide-react';
import AuthShell from '../../layouts/AuthShell.jsx';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getErrorMessage } from '../../services/api.js';

/** Client-side password rule mirroring the backend Joi schema. */
const passwordValid = (p) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

const getDeviceFingerprint = () => {
  let fp = localStorage.getItem('aiscanner_device_fp');
  if (!fp) {
    const raw = `${navigator.userAgent}_${screen.width}x${screen.height}_${screen.colorDepth}_${Intl.DateTimeFormat().resolvedOptions().timeZone}_${navigator.language}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    fp = `DEV_${Math.abs(hash).toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('aiscanner_device_fp', fp);
  }
  return fp;
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const paramEmail = searchParams.get('email') || '';
  const paramName = searchParams.get('name') || '';
  const orderId = searchParams.get('orderId') || '';
  const selectedPlan = searchParams.get('plan') || '1mois';

  // Si l'utilisateur clique directement sur le lien externe (ex: https://aiscanner-ten.vercel.app/register)
  // sans aucun paramètre ni plan ni commande, on le redirige vers la page d'accueil pour voir les forfaits d'abord.
  const isDirectExternalClick = !searchParams.get('join') && !searchParams.get('plan') && !orderId && !window.history.state?.idx;

  useEffect(() => {
    if (isDirectExternalClick) {
      navigate('/', { replace: true });
    }
  }, [isDirectExternalClick, navigate]);

  const [form, setForm] = useState({
    firstName: paramName ? paramName.split(' ')[0] : '',
    lastName: paramName ? paramName.split(' ').slice(1).join(' ') : '',
    email: paramEmail,
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  if (isDirectExternalClick) {
    return null;
  }

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!passwordValid(form.password)) {
      next.password = 'Au moins 8 caractères avec majuscule, minuscule et chiffre.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const fp = getDeviceFingerprint();
      const res = await register({
        ...form,
        plan: selectedPlan,
        deviceFingerprint: fp,
        orderId,
      });

      toast.success('Compte créé avec succès ! Un code OTP vous a été envoyé par email.');
      if (res?.data?.requireEmailVerification || res?.requireEmailVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(form.email)}`, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={orderId ? "Finaliser votre inscription" : "Créer votre compte & Démarrer"}
      subtitle={orderId ? "Votre commande a été enregistrée. Choisissez un mot de passe pour activer votre accès." : "Profitez de toutes les fonctionnalités et des scans illimités."}
      footer={
        <>
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-cyan-400 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      {orderId && (
        <div className="mb-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center justify-between">
          <span>✅ Souscription validée ({selectedPlan.toUpperCase()})</span>
          <span className="font-mono text-[10px] text-emerald-400">{orderId}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Prénom"
            icon={User}
            placeholder="John"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <Input
            label="Nom"
            placeholder="Doe"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>

        <Input
          label="Adresse Email"
          type="email"
          icon={Mail}
          placeholder="vous@example.com"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <Input
          label="Mot de passe"
          type="password"
          icon={Lock}
          placeholder="••••••••"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          hint="Au moins 8 caractères (majuscule, minuscule et chiffre)"
        />

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {orderId ? "Créer mon compte & Recevoir mon code OTP" : "Créer mon compte"}
        </Button>

        <p className="text-center text-xs text-slate-500">
          En vous inscrivant, vous acceptez nos conditions d'utilisation.
        </p>
      </form>
    </AuthShell>
  );
}
