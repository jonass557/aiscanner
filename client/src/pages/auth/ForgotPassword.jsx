import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, CheckCircle2 } from 'lucide-react';
import AuthShell from '../../layouts/AuthShell.jsx';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { authApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link."
      footer={
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900 dark:bg-green-950/40">
          <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
          <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
            If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            icon={Mail}
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
