import { FileText } from 'lucide-react';
import React from 'react';
import { LEGAL_CONFIG } from '../config/legalConfig';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';

export const LegalModals: React.FC = () => {
  const { needTermsUpdateAck, acceptLatestTerms } = useAuth();
  const { currentRoute, navigate } = useRouter();
  const { showToast } = useToast();

  // Never block reading the legal page itself
  const isReadingLegal =
    currentRoute.route === 'terms' ||
    currentRoute.route === 'privacy' ||
    currentRoute.route === 'copyright';

  if (!needTermsUpdateAck || isReadingLegal) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5 pointer-events-none">
      <div className="max-w-xl mx-auto rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl p-4 sm:p-5 pointer-events-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--accent-text)]">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[var(--text)]">Terms updated</h3>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Our{' '}
              <button
                type="button"
                onClick={() => navigate('/terms')}
                className="underline text-[var(--text)] hover:text-[var(--accent-text)] cursor-pointer"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => navigate('/privacy')}
                className="underline text-[var(--text)] hover:text-[var(--accent-text)] cursor-pointer"
              >
                Privacy Policy
              </button>{' '}
              were updated on {LEGAL_CONFIG.lastUpdated}.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await acceptLatestTerms();
            showToast('Preferences saved');
          }}
          className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs hover:brightness-95 transition shrink-0 cursor-pointer min-h-[44px]"
        >
          I accept
        </button>
      </div>
    </div>
  );
};
