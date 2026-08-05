import { useState } from 'react';
import toast from 'react-hot-toast';
import { MailCheck, ShieldCheck } from 'lucide-react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import { authApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Email-verification card shown to users whose email isn't verified yet.
 * They paste the 6-digit OTP received by email and confirm; "Renvoyer le code"
 * issues a fresh one. On success the auth user is refreshed and onVerified fires.
 */
export default function EmailVerification({ onVerified, title, description }) {
  const { user, refreshUser } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const verify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error('Entrez le code à 6 chiffres reçu par email.');
      return;
    }
    setVerifying(true);
    try {
      await authApi.verifyEmail(code);
      await refreshUser();
      toast.success('Email vérifié avec succès !');
      onVerified?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success('Un nouveau code a été envoyé à votre email.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="card p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
        <MailCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{title || 'Vérifiez votre email'}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        {description || (
          <>
            Un code à 6 chiffres a été envoyé à{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">{user?.email || 'votre email'}</span>.
            Collez-le ci-dessous pour activer votre compte.
          </>
        )}
      </p>

      <form onSubmit={verify} className="mx-auto mt-5 max-w-xs space-y-3">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          aria-label="Code de vérification"
          className="[&_input]:text-center [&_input]:text-2xl [&_input]:font-semibold [&_input]:tracking-[0.4em]"
        />
        <Button type="submit" loading={verifying} className="w-full py-3 text-base">
          <ShieldCheck className="h-5 w-5" /> Vérifier l'email
        </Button>
      </form>

      <p className="mt-4 text-xs text-gray-400">
        Vous n'avez pas reçu le code ?{' '}
        <button
          type="button"
          onClick={resend}
          disabled={resending}
          className="font-semibold text-brand-600 hover:underline disabled:opacity-50"
        >
          {resending ? 'Envoi…' : 'Renvoyer le code'}
        </button>
      </p>
    </div>
  );
}
