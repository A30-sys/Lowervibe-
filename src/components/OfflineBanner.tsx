import { RefreshCw, WifiOff } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, queuedActions, replayQueuedActions } = useOfflineQueue();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  if (isOnline) return null;

  return (
    <div
      role="alert"
      className="sticky top-16 z-30 w-full bg-[var(--lv-surface)] border-b border-amber-500/40 text-[var(--lv-text)] px-4 py-2.5 text-xs flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2 min-w-0">
        <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="font-semibold truncate">{t('offline_banner')}</span>
        {queuedActions.length > 0 && (
          <span className="hidden sm:inline font-mono text-[11px] text-[var(--lv-muted)]">
            ({queuedActions.length} {isNy ? 'zikudikira' : 'waiting to sync'})
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={replayQueuedActions}
        className="px-3 py-1.5 rounded-xl bg-[var(--lv-elevated)] hover:opacity-90 text-[var(--lv-text)] border border-[var(--lv-border)] text-xs font-semibold shrink-0 transition active:scale-95 cursor-pointer flex items-center gap-1.5 min-h-[36px]"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>{t('try_again')}</span>
      </button>
    </div>
  );
};
