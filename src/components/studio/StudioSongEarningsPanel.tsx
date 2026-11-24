import {
  AlertCircle,
  ArrowUpDown,
  DollarSign,
  Lock,
  Music,
  Play,
  Radio,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { CountUpValue } from './CountUpValue';
import { useStudioLiveTrackMetrics } from './useStudioLiveTrackMetrics';

interface StudioSongEarningsPanelProps {
  artistId?: string;
  userId?: string;
  isMonetized: boolean;
  ratePerPlayMwk: number;
  fallbackTracks: Track[];
  onPlayTrack?: (track: Track) => void;
  onOpenTrackDetails?: (track: Track) => void;
  title?: string;
  subtitle?: string;
  maxRows?: number;
  replayKey?: number;
}

type SortMode = 'earnings' | 'plays' | 'newest';

export const StudioSongEarningsPanel: React.FC<StudioSongEarningsPanelProps> = ({
  artistId,
  userId,
  isMonetized,
  ratePerPlayMwk,
  fallbackTracks,
  onPlayTrack,
  onOpenTrackDetails,
  title,
  subtitle,
  maxRows,
  replayKey = 0,
}) => {
  const { language } = useLanguage();
  const isNy = language === 'ny';
  const [sortBy, setSortBy] = useState<SortMode>('earnings');
  const displayTitle = title || (isNy ? 'Ndalama za nyimbo iliyonse panthawiyi' : 'Real-time earnings per song');

  const { songs, totalEarningsMwk, isSynced, listenerError } = useStudioLiveTrackMetrics({
    artistId,
    userId,
    isMonetized,
    ratePerPlayMwk,
    fallbackTracks,
  });

  const sortedSongs = useMemo(() => {
    const copy = [...songs];
    copy.sort((a, b) => {
      if (sortBy === 'plays') return b.effectivePlays - a.effectivePlays;
      if (sortBy === 'newest') {
        return (
          new Date(b.track.releaseDate || b.track.createdAt || 0).getTime() -
          new Date(a.track.releaseDate || a.track.createdAt || 0).getTime()
        );
      }
      return b.earnedMwk - a.earnedMwk || b.effectivePlays - a.effectivePlays;
    });
    return copy;
  }, [songs, sortBy]);

  const visibleSongs = maxRows ? sortedSongs.slice(0, maxRows) : sortedSongs;

  return (
    <section className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-[var(--text)] flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{displayTitle}</span>
            </h3>
            {isSynced && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--accent-text)]">
                <Radio className="w-3 h-3" />
                <span>{isNy ? 'Zikugwirizana' : 'Synced'}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {subtitle ||
              (isMonetized
                ? isNy
                  ? `Kuchokera ku Firestore · ${ratePerPlayMwk} MWK pa kuwerenga koyenera`
                  : `Synced from Firestore · ${ratePerPlayMwk} MWK per qualifying play`
                : isNy
                ? 'Kuchokera ku Firestore · Ndalama zimatseguka mukakwaniritsa zofunikira'
                : 'Synced from Firestore · Earnings unlock automatically when eligibility is met')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono font-bold tabular-nums text-[var(--text)]">
            <CountUpValue value={totalEarningsMwk} suffix=" MWK" replayKey={replayKey} />
          </div>
          {sortedSongs.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setSortBy((prev) =>
                  prev === 'earnings' ? 'plays' : prev === 'plays' ? 'newest' : 'earnings'
                )
              }
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>
                {isNy ? 'Sankhani: ' : 'Sort: '}
                {sortBy === 'earnings'
                  ? isNy
                    ? 'Ndalama'
                    : 'Earned'
                  : sortBy === 'plays'
                  ? isNy
                    ? 'Zalira'
                    : 'Plays'
                  : isNy
                  ? 'Zatsopano'
                  : 'Newest'}
              </span>
            </button>
          )}
        </div>
      </div>

      {listenerError && (
        <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)] text-xs text-[var(--danger)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{listenerError}</span>
        </div>
      )}

      {visibleSongs.length === 0 ? (
        <div className="p-6 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center space-y-2">
          <Music className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
          <p className="text-xs text-[var(--text-muted)]">
            {isNy
              ? 'Palibe nyimbo pakadali pano. Kwezani nyimbo kuti muone ndalama zake panthawiyi.'
              : 'No songs found yet. Upload a track to see real-time per-song earnings.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden">
          {visibleSongs.map(({ track, effectivePlays, verifiedLedgerPlays, earnedMwk, sharePct }) => (
            <div
              key={track.id}
              onClick={() => onOpenTrackDetails?.(track)}
              className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-[var(--surface)]/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] shrink-0">
                  <img
                    src={track.coverArt || DEFAULT_ARTWORK_SVG}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {onPlayTrack && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack(track);
                      }}
                      aria-label={`${isNy ? 'Liza' : 'Play'} ${track.title}`}
                      className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">
                      {track.title}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      · {track.isDraft ? (isNy ? 'Zolembedwa' : 'Draft') : isNy ? 'Zotulutsidwa' : 'Published'}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
                    <span>
                      {effectivePlays.toLocaleString()} {isNy ? 'zalira' : 'plays'}
                    </span>
                    {verifiedLedgerPlays > 0 && (
                      <span>
                        · {verifiedLedgerPlays.toLocaleString()} {isNy ? 'zotsimikizika' : 'verified ledger'}
                      </span>
                    )}
                    {isMonetized && totalEarningsMwk > 0 && (
                      <span>
                        · {sharePct}% {isNy ? 'pa zonse' : 'of total'}
                      </span>
                    )}
                  </div>

                  {isMonetized && totalEarningsMwk > 0 && (
                    <div className="w-full max-w-[220px] h-1 rounded-full bg-[var(--surface)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-300"
                        style={{ width: `${Math.max(4, sharePct)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                {isMonetized ? (
                  <>
                    <div className="text-sm font-mono font-extrabold text-[var(--accent-text)] tabular-nums">
                      {earnedMwk.toLocaleString()} MWK
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono">
                      @{ratePerPlayMwk} {isNy ? 'MWK/nyimbo' : 'MWK/play'}
                    </div>
                  </>
                ) : (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono tabular-nums text-[var(--text-muted)]">
                    <Lock className="w-3 h-3" />
                    <span>0 MWK</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
