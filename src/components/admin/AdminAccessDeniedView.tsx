import { ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import React from 'react';
import { useRouter } from '../../context/RouterContext';

export const AdminAccessDeniedView: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md p-8 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-6 shadow-xl animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-[var(--danger)]/15 text-[var(--danger)] border border-[var(--danger)]/30 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold font-heading text-[var(--text)]">
            Admin access required
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            Only the authorized admin account (<span className="font-mono text-[var(--text)]">odulamw@gmail.com</span>) can view this page.
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={() => navigate('/administration/login')}
            className="w-full py-3.5 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs hover:brightness-95 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>Sign in as admin</span>
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
