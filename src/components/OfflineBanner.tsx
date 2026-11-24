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
      className="sticky top-16 z-30 w-full bg-[var(--lv-surface)]/95 backdrop-blur-md border-b border-amber-500/40 text-[var(--lv-text)] px-4 sm:px-6 py-2.5 text-xs shadow-sm"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <WifiOff className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold truncate">{t('offline_banner')}</span>
            {queuedActions.length > 0 && (
              <>
                <span aria-hidden="true" className="hidden sm:inline text-[var(--lv-muted)]">
                  ·
                </span>
                <span className="hidden sm:inline font-mono text-[11px] text-[var(--lv-muted)] tabular-nums whitespace-nowrap">
                  {queuedActions.length} {isNy ? 'zikudikira' : 'waiting to sync'}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={replayQueuedActions}
          className="px-3.5 py-1.5 rounded-xl bg-[var(--lv-elevated)] hover:opacity-90 text-[var(--lv-text)] border border-[var(--lv-border)] text-xs font-bold shrink-0 transition active:scale-95 cursor-pointer inline-flex items-center gap-1.5 min-h-[38px] whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('try_again')}</span>
        </button>
      </div>
    </div>
  );
};
