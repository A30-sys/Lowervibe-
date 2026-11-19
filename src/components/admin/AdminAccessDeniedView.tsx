import { ArrowLeft, ShieldAlert } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { PRIMARY_ADMIN_EMAIL } from '../../services/authService';

export const AdminAccessDeniedView: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser, signInAdminWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      const res = await signInAdminWithGoogle();
      if (!res.success) {
        setErrorMessage(
          res.error || `Access Denied: Only ${PRIMARY_ADMIN_EMAIL} via Google Auth can open Administration.`
        );
        return;
      }
      navigate('/administration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-6 shadow-xl animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold font-heading text-[var(--text)]">
            Admin Google Auth Required
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Only <span className="font-mono text-[var(--text)] font-semibold">{PRIMARY_ADMIN_EMAIL}</span> signed in via{' '}
            <strong className="text-[var(--text)]">Google Login Auth</strong> can access this page.
          </p>
          {currentUser && (
            <p className="text-[11px] text-[var(--text-muted)]">
              Current session: <span className="font-mono text-[var(--text)]">{currentUser.email || currentUser.name}</span>
            </p>
          )}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/35 text-[var(--danger)] text-xs font-semibold text-left">
            {errorMessage}
          </div>
        )}

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className="w-full h-12 px-4 rounded-2xl bg-white text-neutral-900 border border-neutral-300 font-bold text-xs hover:bg-neutral-50 transition cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isLoading ? 'Signing in...' : `Sign in with Google (${PRIMARY_ADMIN_EMAIL})`}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--bg)] text-[var(--text)] font-semibold text-xs transition cursor-pointer flex items-center justify-center gap-2 border border-[var(--border)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
