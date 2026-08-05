import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!passwordValid(form.password)) {
      next.password = 'Min 8 chars with uppercase, lowercase, and a number.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register(form);
      toast.success('Compte créé ! Saisissez le code envoyé par email pour le vérifier.');
      navigate('/verify-email', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start with 5 free scans every month."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            icon={User}
            placeholder="Jane"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <Input
            label="Last name"
            placeholder="Doe"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>
        <Input
          label="Email"
          type="email"
          icon={Mail}
          placeholder="you@example.com"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          icon={Lock}
          placeholder="••••••••"
          required
          error={errors.password}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
        <p className="text-center text-xs text-gray-400">
          By signing up you agree to our Terms and acknowledge this is not financial advice.
        </p>
      </form>
    </AuthShell>
  );
}
