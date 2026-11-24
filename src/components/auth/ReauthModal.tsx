import { Eye, EyeOff, Lock, ShieldCheck, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export const ReauthModal: React.FC = () => {
  const {
    reauthPromptOpen,
    reauthPromptReason,
    firebaseProviders,
    submitReauth,
    cancelReauth,
  } = useAuth();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!reauthPromptOpen) return null;

  const hasPassword = firebaseProviders.includes('password');
  const hasGoogle = firebaseProviders.includes('google.com');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError(isNy ? 'Lembani mawu achinsinsi anu apano.' : 'Enter your current password.');
      return;
    }
    setSubmitting(true);
    const res = await submitReauth({ password });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || (isNy ? 'Sitinathe kutsimikizira mawu achinsinsi.' : 'Could not confirm your password.'));
    } else {
      setPassword('');
    }
  };

  const handleGoogleReauth = async () => {
    setError('');
    setSubmitting(true);
    const res = await submitReauth({ useGoogle: true });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error || (isNy ? 'Kutsimikizira ndi Google kwalephereka.' : 'Google confirmation failed.'));
    }
  };

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-[400px] rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] p-6 shadow-2xl space-y-5 text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">
                {isNy ? 'Tsimikizirani kuti ndi inu' : 'Confirm it’s you'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {reauthPromptReason ||
                  (isNy ? 'Tsimikizirani akaunti yanu musanapitirize.' : 'Verify your sign-in before continuing.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPassword('');
              setError('');
              cancelReauth();
            }}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer"
            aria-label={t('close', 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        {hasPassword && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
                {isNy ? 'Mawu achinsinsi apano' : 'Current password'}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isNy ? 'Lembani mawu achinsinsi' : 'Enter password'}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm hover:brightness-95 transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? (isNy ? 'Ikuyang\'ana...' : 'Checking...') : isNy ? 'Tsimikizirani' : 'Confirm'}
            </button>
          </form>
        )}

        {hasGoogle && (
          <button
            type="button"
            disabled={submitting}
            onClick={handleGoogleReauth}
            className="w-full h-11 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-2)] hover:border-[var(--accent)] text-sm font-semibold text-[var(--text)] flex items-center justify-center gap-2.5 transition cursor-pointer disabled:opacity-50"
          >
            <span>{t('auth_continue_google', 'Continue with Google')}</span>
          </button>
        )}

        {!hasPassword && !hasGoogle && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              {isNy
                ? 'Munalowa ndi nambala ya foni. Dinani pitilizani kuti mutsimikizire.'
                : 'You are signed in with phone OTP. Tap confirm to proceed with this action.'}
            </p>
            <button
              type="button"
              onClick={() => submitReauth({ useGoogle: false })}
              className="w-full h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer"
            >
              {t('next', 'Continue')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
