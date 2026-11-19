import { ArrowRight, CheckCircle2, Home, Music2, Wallet } from 'lucide-react';
import React from 'react';
import { useRouter } from '../../context/RouterContext';

export const ThankYouView: React.FC = () => {
  const { navigate, searchParams } = useRouter();
  const type = searchParams.get('type') || 'general';
  const refCode = searchParams.get('ref') || '';
  const itemTitle = searchParams.get('title') || '';

  const copy = (() => {
    switch (type) {
      case 'artist':
        return {
          badge: 'Application Received',
          heading: 'Thank you for applying to LOWERVIBE Studio',
          body: 'Your creator profile application has been saved safely. We are reviewing your details and you will get an instant notification as soon as your artist studio unlocks.',
          primaryLabel: 'View Approval Status',
          primaryRoute: '/studio',
        };
      case 'upload':
        return {
          badge: 'Release Live',
          heading: itemTitle ? `Thank you — “${itemTitle}” is published` : 'Thank you — Your release is live',
          body: 'Your track has been validated, stored, and published to the LOWERVIBE catalog. Real plays and listener metrics update automatically in Studio.',
          primaryLabel: 'Open Studio Tracks',
          primaryRoute: '/studio',
        };
      case 'payout':
        return {
          badge: 'Withdrawal Logged',
          heading: 'Thank you — Your payout request is recorded',
          body: 'Your withdrawal request and cryptographic settlement token are recorded on your artist ledger. Track real-time status updates anytime in Withdrawals.',
          primaryLabel: 'Open Withdrawals',
          primaryRoute: '/studio?tab=withdrawals',
        };
      case 'support':
        return {
          badge: 'Message Sent',
          heading: 'Thank you for contacting LOWERVIBE Support',
          body: 'Our support team has received your inquiry. Expect a response at your account email or inside your Account support panel.',
          primaryLabel: 'Back to Account',
          primaryRoute: '/account',
        };
      default:
        return {
          badge: 'Confirmed',
          heading: 'Thank you for supporting independent music',
          body: 'Your action has been completed and saved on LOWERVIBE. Continue discovering artists from Malawi, Nigeria, and across Africa.',
          primaryLabel: 'Explore Music',
          primaryRoute: '/discover',
        };
    }
  })();

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12 px-4 animate-fadeIn">
      <div className="max-w-lg w-full rounded-[28px] bg-[var(--surface)] border border-[var(--border-strong)] p-7 sm:p-9 text-center space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/35 text-[var(--accent-text)] flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2.5">
          <span className="inline-block px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--accent-text)]">
            {copy.badge}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)] tracking-tight">
            {copy.heading}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
            {copy.body}
          </p>
        </div>

        {refCode && (
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]">
            Reference: <span className="text-[var(--accent-text)] font-bold">{refCode}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => navigate(copy.primaryRoute)}
            className="flex-1 py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            {type === 'payout' ? (
              <Wallet className="w-4 h-4" />
            ) : (
              <Music2 className="w-4 h-4" />
            )}
            <span>{copy.primaryLabel}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="py-3 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
