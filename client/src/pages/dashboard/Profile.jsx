import { useState } from 'react';
import toast from 'react-hot-toast';
import { User, Mail, Lock, BadgeCheck, AlertCircle } from 'lucide-react';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Badge from '../../components/ui/Badge.jsx';
import { userApi, authApi } from '../../services/endpoints.js';
import { getErrorMessage } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const passwordValid = (p) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

/** Profile management: personal info, email status, password change. */
export default function Profile() {
  const { user, setUser, requireEmailVerification } = useAuth();
  const [info, setInfo] = useState({ firstName: user?.firstName || '', lastName: user?.lastName || '' });
  const [savingInfo, setSavingInfo] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [resending, setResending] = useState(false);

  const saveInfo = async (e) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const { data } = await userApi.updateProfile(info);
      setUser(data.data.user);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingInfo(false);
    }
  };

  const savePw = async (e) => {
    e.preventDefault();
    if (!passwordValid(pw.newPassword)) return toast.error('New password too weak.');
    if (pw.newPassword !== pw.confirm) return toast.error('Passwords do not match.');
    setSavingPw(true);
    try {
      await userApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password changed.');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await authApi.resendVerification();
      toast.success('Verification email sent.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your personal information and security.</p>
      </div>

      {/* Account status */}
      <div className="card flex items-center justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-lg font-bold text-white">
            {(user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
          </div>
          <div>
            <p className="font-medium">{user?.email}</p>
            {user?.isVerified ? (
              <Badge tone="green"><BadgeCheck className="h-3.5 w-3.5" /> Verified</Badge>
            ) : (
              <Badge tone="yellow"><AlertCircle className="h-3.5 w-3.5" /> Unverified</Badge>
            )}
          </div>
        </div>
        {requireEmailVerification && !user?.isVerified && (
          <Button variant="secondary" loading={resending} onClick={resendVerification}>
            Resend email
          </Button>
        )}
      </div>

      {/* Personal info */}
      <form onSubmit={saveInfo} className="card space-y-4 p-6">
        <h3 className="font-semibold">Personal information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" icon={User} value={info.firstName} onChange={(e) => setInfo({ ...info, firstName: e.target.value })} />
          <Input label="Last name" value={info.lastName} onChange={(e) => setInfo({ ...info, lastName: e.target.value })} />
        </div>
        <Input label="Email" icon={Mail} value={user?.email} disabled />
        <div className="flex justify-end">
          <Button type="submit" loading={savingInfo}>Save changes</Button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePw} className="card space-y-4 p-6">
        <h3 className="font-semibold">Change password</h3>
        <Input label="Current password" type="password" icon={Lock} value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="New password" type="password" icon={Lock} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required />
          <Input label="Confirm new password" type="password" icon={Lock} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={savingPw}>Update password</Button>
        </div>
      </form>
    </div>
  );
}
