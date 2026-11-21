import { ArrowRight, Sparkles, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { trackEvent } from '../../services/analyticsService';

const DISMISS_KEY = 'lowervibe_sticky_cta_dismissed_v1';

interface StickyMobileCtaProps {
  isPlayerVisible: boolean;
}

export const StickyMobileCta: React.FC<StickyMobileCtaProps> = ({ isPlayerVisible }) => {
  const { currentRoute, navigate } = useRouter();
  const { currentUser, isArtist, isAdmin, isGuestMode } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === 'true') {
        setDismissed(true);
      }
    } catch {}
  }, []);

  if (dismissed || isPlayerVisible) return null;

  const allowedRoutes = ['home', 'discover', 'artists', 'artist_detail', 'track_detail'];
  if (!allowedRoutes.includes(currentRoute.route)) return null;

  // Approved artists/admins don't need the acquisition CTA bar
  if (currentUser && (isArtist || isAdmin)) return null;

  const isGuest = !currentUser || isGuestMode;
  const label = isGuest ? 'Join Free · Stream & Save' : 'Release Your Music';
  const subLabel = isGuest ? 'Unlimited African music & offline saves' : 'Apply for LOWERVIBE Artist Studio';
  const targetRoute = isGuest ? '/register' : '/artistcreator';

  return (
    <div
      className="md:hidden fixed left-3 right-3 bottom-[calc(70px+env(safe-area-inset-bottom,0px))] z-30 animate-slideUp"
      role="region"
      aria-label="Quick action"
    >
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--surface)]/95 backdrop-blur-xl border border-[var(--accent)]/40 shadow-2xl">
        <button
          type="button"
          onClick={() => {
            trackEvent('sticky_mobile_cta_click', {
              target: targetRoute,
              route: currentRoute.route,
              userState: isGuest ? 'guest' : 'listener',
            });
            navigate(targetRoute);
          }}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
        >
          <span className="w-8 h-8 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-extrabold text-[var(--text)] truncate">{label}</span>
            <span className="block text-[10px] text-[var(--text-muted)] truncate">{subLabel}</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[11px] font-bold flex items-center gap-1 shrink-0">
            <span>{isGuest ? 'Start' : 'Studio'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            try {
              sessionStorage.setItem(DISMISS_KEY, 'true');
            } catch {}
          }}
          aria-label="Dismiss quick action banner"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
