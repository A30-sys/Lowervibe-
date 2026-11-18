import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { fetchAdminSetupStatus, PRIMARY_ADMIN_EMAIL } from '../../services/authService';
import { auth } from '../../services/firebase';

export const AdminLoginView: React.FC = () => {
  const { adminLogin, adminInitialize, signInWithGoogle, logout, currentUser } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [email, setEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    fetchAdminSetupStatus().then((status) => {
      if (!status.isConfigured) {
        setMode('setup');
      }
    });
  }, []);

  useEffect(() => {
    if (currentUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      navigate('/administration');
    }
  }, [currentUser, navigate]);

  const handleAdminGoogleSignIn = async () => {
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const res = await signInWithGoogle(true);
      if (!res.success) {
        setErrorMessage(res.error || 'Google sign-in failed.');
        setErrorCode(res.errorCode || '');
        return;
      }
      const signedInEmail = (auth.currentUser?.email || '').toLowerCase();
      if (signedInEmail !== PRIMARY_ADMIN_EMAIL.toLowerCase()) {
        await logout();
        setErrorMessage(`Access Denied: Signed in as ${signedInEmail || 'another account'}, but Admin requires ${PRIMARY_ADMIN_EMAIL}.`);
        return;
      }
      setSuccessMessage('Signed in with Google. Opening dashboard...');
      showToast('Signed in to Admin');
      setTimeout(() => {
        navigate('/administration');
      }, 300);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');

    if (email.trim().toLowerCase() !== PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      setErrorMessage(`Only ${PRIMARY_ADMIN_EMAIL} can access Admin.`);
      return;
    }

    if (!password) {
      setErrorMessage('Enter your admin password.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await adminLogin(password);
      if (result.success) {
        setSuccessMessage('Signed in. Opening dashboard...');
        showToast('Signed in to Admin');
        setTimeout(() => {
          navigate('/administration');
        }, 400);
      } else {
        setErrorMessage(result.error || 'Incorrect admin password.');
        setErrorCode(result.errorCode || '');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Sign in error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorCode('');
    setSuccessMessage('');

    if (email.trim().toLowerCase() !== PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      setErrorMessage(`Setup is restricted to ${PRIMARY_ADMIN_EMAIL}.`);
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await adminInitialize(password);
      if (result.success) {
        setSuccessMessage('Admin password saved. Opening dashboard...');
        showToast('Admin setup complete');
        setTimeout(() => {
          navigate('/administration');
        }, 400);
      } else {
        setErrorMessage(result.error || 'Could not save password.');
        setErrorCode(result.errorCode || '');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Setup error.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col justify-between px-4 py-8 sm:py-12">
      <div className="w-full max-w-[440px] mx-auto my-auto space-y-6">
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--accent-text)]">
            <ShieldCheck className="w-4 h-4" />
            <span>LOWERVIBE Admin</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
            Admin sign in
          </h1>

          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Restricted to authorized staff.
          </p>
        </div>

        <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-5">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleAdminGoogleSignIn}
            className="w-full h-12 px-4 rounded-xl bg-white text-neutral-900 border border-neutral-300 font-bold text-xs flex items-center justify-center gap-2.5 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google ({PRIMARY_ADMIN_EMAIL})</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-[var(--surface)] px-2.5 text-[var(--text-muted)] font-semibold">or password</span>
            </div>
          </div>

          <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setErrorCode('');
                setSuccessMessage('');
              }}
              className={`py-2.5 rounded-lg transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('setup');
                setErrorMessage('');
                setErrorCode('');
                setSuccessMessage('');
              }}
              className={`py-2.5 rounded-lg transition cursor-pointer ${
                mode === 'setup'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Set password
            </button>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/35 text-[var(--danger)] text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
              {errorCode === 'auth/operation-not-allowed' && (
                <p className="text-[11px] text-[var(--text-dim)] leading-relaxed">
                  Use <strong>Sign in with Google</strong> above, or turn on Email/Password in Firebase Console → Authentication → Sign-in method.
                </p>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleAdminSignIn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">Admin email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent-text)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent-text)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs hover:brightness-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isLoading ? 'Checking...' : 'Sign in to Admin'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminSetup} className="space-y-4">
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                Set or update the admin password for <strong className="text-[var(--text)]">{PRIMARY_ADMIN_EMAIL}</strong>.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">New password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent-text)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">Confirm password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-10 pr-10 py-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-[var(--text)] font-mono text-xs focus:outline-none focus:border-[var(--accent-text)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs hover:brightness-95 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Shield className="w-4 h-4" />
                <span>{isLoading ? 'Saving...' : 'Save password & continue'}</span>
              </button>
            </form>
          )}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to LOWERVIBE</span>
          </button>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
};
