import { Cookie, ShieldCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { getCookieConsent, setCookieConsent } from '../../services/analyticsService';

interface CookieBannerProps {
  hasPlayerOffset?: boolean;
}

export const CookieBanner: React.FC<CookieBannerProps> = ({ hasPlayerOffset = false }) => {
  const { navigate } = useRouter();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      const timer = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    setCookieConsent('all');
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    setCookieConsent('essential');
    setVisible(false);
  };

  return (
    <aside
      role="region"
      aria-label={isNy ? 'Zokonda za ma cookie' : 'Cookie consent'}
      className={`fixed left-3 right-3 sm:left-6 sm:right-auto sm:max-w-md z-40 rounded-[22px] bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl p-4 space-y-3 animate-slideUp ${
        hasPlayerOffset ? 'bottom-36 md:bottom-24' : 'bottom-20 md:bottom-5'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/35 text-[var(--accent-text)] flex items-center justify-center shrink-0">
          <Cookie className="w-4 h-4" />
        </div>
        <div className="space-y-1 min-w-0">
          <h2 className="text-xs font-extrabold text-[var(--text)] flex items-center gap-1.5">
            <span>{isNy ? 'Ma Cookie & Chinsinsi' : 'Cookies & Privacy Preferences'}</span>
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
          </h2>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
            {t('cookie_notice')}{' '}
            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="underline font-semibold text-[var(--accent-text)] cursor-pointer"
            >
              {t('footer_privacy')}
            </button>
            .
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleEssentialOnly}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[11px] font-semibold text-[var(--text)] cursor-pointer transition min-h-[38px]"
        >
          {t('cookie_essential')}
        </button>
        <button
          type="button"
          onClick={handleAcceptAll}
          className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-[11px] font-bold cursor-pointer hover:brightness-95 transition min-h-[38px]"
        >
          {t('cookie_accept_all')}
        </button>
      </div>
    </aside>
  );
};
