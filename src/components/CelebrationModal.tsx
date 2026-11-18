import { CheckCircle2, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { LowerVibeLogo } from './brand/LowerVibeLogo';

interface CelebrationModalProps {
  onGoToStudio: () => void;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ onGoToStudio }) => {
  const { celebrationModal, dismissCelebrationModal, currentUser } = useAuth();
  const { navigate } = useRouter();

  if (!celebrationModal?.isOpen) return null;

  const artistRoute = currentUser?.artistId ? `/artists/${currentUser.artistId}` : '/studio';

  return (
    <div
      className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={dismissCelebrationModal}
    >
      <div
        className="relative w-full max-w-md rounded-[28px] overflow-hidden bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-6 sm:p-8 text-center space-y-5 text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismissCelebrationModal}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center gap-2">
          <LowerVibeLogo size="md" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-500 text-[11px] font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Artist Registration Approved</span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-[var(--text)]">
            Welcome to Studio, {celebrationModal.artistName}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed max-w-sm mx-auto">
            Your artist account is approved! You now have exclusive access to install the standalone LOWERVIBE Artist WebApp and open your dedicated Artist Page, uploads, and Withdrawals dashboard.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => {
              dismissCelebrationModal();
              window.dispatchEvent(new Event('lowervibe:open-install-prompt'));
            }}
            className="w-full py-3.5 rounded-2xl font-bold text-sm text-[var(--accent-contrast)] bg-[var(--accent)] hover:brightness-95 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Install Artist WebApp</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                dismissCelebrationModal();
                onGoToStudio();
              }}
              className="py-3 px-3 rounded-2xl font-bold text-xs text-[var(--text)] bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Open Studio</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                dismissCelebrationModal();
                navigate(artistRoute);
              }}
              className="py-3 px-3 rounded-2xl font-bold text-xs text-[var(--text)] bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[var(--violet)]" />
              <span>Artist Page</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
