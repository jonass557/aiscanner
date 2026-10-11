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

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Si l'utilisateur clique directement sur le lien externe (ex: https://aiscanner-ten.vercel.app/register),
  // on le redirige immédiatement vers la page d'accueil pour lui présenter la plateforme d'abord.
  const isDirectExternalClick = !searchParams.get('join') && !searchParams.get('plan') && !window.history.state?.idx;

  useEffect(() => {
    if (isDirectExternalClick) {
      navigate('/', { replace: true });
    }
  }, [isDirectExternalClick, navigate]);

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
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
      await register(form);
      toast.success('Compte créé avec succès ! Bienvenue.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Créer votre compte"
      subtitle="Commencez avec 5 analyses gratuites chaque mois."
      footer={
        <>
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-cyan-400 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
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
          Créer mon compte gratuitement
        </Button>

        <p className="text-center text-xs text-slate-500">
          En vous inscrivant, vous acceptez nos conditions d'utilisation. Pas de carte bancaire requise.
        </p>
      </form>
    </AuthShell>
  );
}
