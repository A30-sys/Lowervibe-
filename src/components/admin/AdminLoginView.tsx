import { ArrowLeft, CheckCircle2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { isVerifiedAdminGoogleSession, PRIMARY_ADMIN_EMAIL } from '../../services/authService';

export const AdminLoginView: React.FC = () => {
  const { signInAdminWithGoogle, currentUser } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (
      currentUser?.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase() &&
      isVerifiedAdminGoogleSession()
    ) {
      navigate('/administration');
    }
  }, [currentUser, navigate]);

  const handleAdminGoogleSignIn = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
    try {
      const res = await signInAdminWithGoogle();
      if (!res.success) {
        setErrorMessage(
          res.error || `Access Denied: Only ${PRIMARY_ADMIN_EMAIL} via Google Auth can sign in.`
        );
        return;
      }
      setSuccessMessage('Verified with Google Auth. Opening administration...');
      showToast('Signed in to Administration');
      setTimeout(() => {
        navigate('/administration');
      }, 250);
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
            <span>LOWERVIBE Administration</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
            Administrator Sign In
          </h1>

          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto leading-relaxed">
            Google Login Auth required. Restricted strictly to{' '}
            <span className="font-mono font-semibold text-[var(--text)]">{PRIMARY_ADMIN_EMAIL}</span>.
          </p>
        </div>

        <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl space-y-5">
          <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-start gap-2.5 text-xs text-[var(--text-muted)]">
            <Lock className="w-4 h-4 text-[var(--accent-text)] shrink-0 mt-0.5" />
            <span>
              Password login is disabled for Administration. Authenticate with your verified Google account ({PRIMARY_ADMIN_EMAIL}) to continue.
            </span>
          </div>

          {currentUser && !isVerifiedAdminGoogleSession() && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Currently signed in as <strong className="font-mono">{currentUser.email || currentUser.name}</strong>. Switch to <strong className="font-mono">{PRIMARY_ADMIN_EMAIL}</strong> via Google below.
              </span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/35 text-[var(--danger)] text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={handleAdminGoogleSignIn}
            className="w-full h-12 px-4 rounded-xl bg-white text-neutral-900 border border-neutral-300 font-bold text-xs flex items-center justify-center gap-2.5 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>
              {isLoading ? 'Verifying Google account...' : `Sign in with Google (${PRIMARY_ADMIN_EMAIL})`}
            </span>
          </button>
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
