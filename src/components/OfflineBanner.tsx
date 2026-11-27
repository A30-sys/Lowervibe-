import { HardDrive, Play, RefreshCw, WifiOff } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineQueue } from '../context/OfflineQueueContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, queuedActions, pendingSyncOps, replayQueuedActions } = useOfflineQueue();
  const { tracks, offlineTrackIds, refreshCatalog, playTrackList } = useAudio();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const isNy = language === 'ny';
  const [isChecking, setIsChecking] = useState(false);

  const cachedSongs = useMemo(
    () => tracks.filter((tr) => !tr.isDraft && !tr.isDeranked),
    [tracks]
  );

  const downloadedPlayableTracks = useMemo(() => {
    if (offlineTrackIds.length === 0) return [];
    const idSet = new Set(offlineTrackIds);
    return cachedSongs.filter((tr) => idSet.has(tr.id));
  }, [cachedSongs, offlineTrackIds]);

  if (isOnline) return null;

  const pendingCount = queuedActions.length + pendingSyncOps.length;
  const downloadedCount = downloadedPlayableTracks.length || offlineTrackIds.length;

  const handleReconnect = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const ok = await refreshCatalog();
      if (ok && typeof navigator !== 'undefined' && navigator.onLine) {
        await replayQueuedActions();
        showToast(
          isNy ? 'Intaneti yabwerera — nyimbo zatsopano zatsegulidwa.' : 'Back online — catalog synced.',
          'success'
        );
      } else {
        showToast(
          downloadedCount > 0
            ? isNy
              ? 'Muli popanda intaneti — mverani nyimbo zosungidwa.'
              : `Still offline — ${downloadedCount} downloaded ${downloadedCount === 1 ? 'song is' : 'songs are'} ready to play.`
            : isNy
            ? 'Intaneti sinabwererebe. Yang\'anani Wi-Fi kapena deta yanu.'
            : 'Still offline. Check your mobile data or Wi-Fi connection.',
          'info'
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 w-full bg-[var(--lv-surface)] border-b border-[var(--lv-border-strong)] text-[var(--lv-text)] shadow-sm"
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-500 flex items-center justify-center shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs sm:text-[13px] font-bold font-heading text-[var(--lv-text)] truncate">
                {isNy ? 'Simuli pa intaneti' : 'Offline Mode'}
              </span>
              <span className="hidden xs:inline text-[var(--lv-muted)]" aria-hidden="true">
                ·
              </span>
              <span className="hidden sm:inline text-xs font-medium text-[var(--lv-text-dim)] truncate">
                {downloadedCount > 0
                  ? isNy
                    ? 'Nyimbo zosungidwa zikhoza kusewera'
                    : 'Downloaded songs ready for playback'
                  : isNy
                  ? 'Mukhoza kuyang\'ana nyimbo zosungidwa'
                  : 'Browsing locally cached catalog'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--lv-muted)] font-mono tabular-nums truncate mt-0.5">
              <span>
                {downloadedCount > 0
                  ? isNy
                    ? `${downloadedCount} zosungidwa`
                    : `${downloadedCount} downloaded`
                  : cachedSongs.length > 0
                  ? isNy
                    ? `${cachedSongs.length} za mu cache`
                    : `${cachedSongs.length} cached`
                  : isNy
                  ? 'Palibe nyimbo zosungidwa'
                  : 'No local audio cached'}
              </span>
              {cachedSongs.length > 0 && downloadedCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="hidden sm:inline">
                    {isNy ? `${cachedSongs.length} m'ndandanda` : `${cachedSongs.length} in cache`}
                  </span>
                </>
              )}
              {pendingCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[var(--lv-accent-text)] font-semibold">
                    {pendingCount} {isNy ? 'zikudikira sync' : 'pending sync'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {downloadedPlayableTracks.length > 0 ? (
            <button
              type="button"
              onClick={() => playTrackList(downloadedPlayableTracks, 0)}
              className="px-3 py-2 rounded-xl bg-[var(--lv-accent)] text-[var(--lv-accent-ink)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:brightness-95 active:scale-95 transition min-h-[44px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <Play className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden sm:inline">
                {isNy ? 'Sewerani zosungidwa' : 'Play Offline'}
              </span>
              <span className="sm:hidden">{isNy ? 'Sewera' : 'Play'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/library?tab=downloads')}
              className="px-3 py-2 rounded-xl bg-[var(--lv-elevated)] hover:border-[var(--lv-border-strong)] text-[var(--lv-text)] border border-[var(--lv-border)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition min-h-[44px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <HardDrive className="w-3.5 h-3.5 text-[var(--lv-accent-text)] shrink-0" />
              <span className="hidden sm:inline">{isNy ? 'Zosungidwa' : 'Downloads'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReconnect}
            disabled={isChecking}
            aria-label={t('try_again', 'Reconnect')}
            className="px-3 py-2 rounded-xl bg-[var(--lv-elevated)] hover:border-[var(--lv-border-strong)] text-[var(--lv-text)] border border-[var(--lv-border)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition min-h-[44px] whitespace-nowrap disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isNy ? 'Yesaninso' : 'Reconnect'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
