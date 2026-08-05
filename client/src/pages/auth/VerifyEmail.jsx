import { Link } from 'react-router-dom';
import AuthShell from '../../layouts/AuthShell.jsx';
import EmailVerification from '../../components/auth/EmailVerification.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Standalone email-verification page. Verification is now a 6-digit OTP the
 * logged-in user pastes here (or from the Scanner / Profile). If they aren't
 * logged in, we point them to log in first — the OTP endpoint is authenticated.
 */
export default function VerifyEmail() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return (
      <AuthShell title="Vérification de l'email">
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Connectez-vous d'abord, puis saisissez le code à 6 chiffres reçu par email.
          </p>
          <Link to="/login" className="btn-primary mt-6 inline-flex">
            Se connecter
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (user?.isVerified) {
    return (
      <AuthShell title="Email vérifié">
        <div className="text-center">
          <p className="text-sm text-gray-500">Votre email est déjà vérifié. 🎉</p>
          <Link to="/dashboard" className="btn-primary mt-6 inline-flex">
            Aller au tableau de bord
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Vérification de l'email">
      <EmailVerification onVerified={() => {}} />
    </AuthShell>
  );
}
