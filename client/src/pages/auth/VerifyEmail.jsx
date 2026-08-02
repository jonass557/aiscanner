import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import AuthShell from '../../layouts/AuthShell.jsx';
import { authApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';

/**
 * Handles the email-verification link. Reads the token from the query string
 * and confirms it against the backend on mount.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard against StrictMode double-invoke
    ran.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Verification token is missing.');
      return;
    }
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setMessage(getErrorMessage(err));
      });
  }, [token]);

  const content = {
    verifying: {
      icon: <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-500" />,
      title: 'Verifying your email…',
      text: 'Hang tight, this only takes a second.',
    },
    success: {
      icon: <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />,
      title: 'Email verified!',
      text: 'Your account is now active. You can start scanning charts.',
    },
    error: {
      icon: <XCircle className="mx-auto h-12 w-12 text-red-500" />,
      title: 'Verification failed',
      text: message || 'This link may be invalid or expired.',
    },
  }[status];

  return (
    <AuthShell title="Email verification">
      <div className="text-center">
        {content.icon}
        <h2 className="mt-4 text-xl font-semibold">{content.title}</h2>
        <p className="mt-2 text-sm text-gray-500">{content.text}</p>
        {status !== 'verifying' && (
          <Link to={status === 'success' ? '/dashboard' : '/login'} className="btn-primary mt-6 inline-flex">
            {status === 'success' ? 'Go to dashboard' : 'Back to log in'}
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
