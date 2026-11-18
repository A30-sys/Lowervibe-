import { Heart, ListPlus, Music, Pause, Play } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { formatTime, getTrackLikeCount, isTrackLikedByUser } from '../../utils/formatters';
import { LazySlideImage } from '../common/LazySlideImage';

interface AllTracksSectionProps {
  onSelectArtist: (artistId: string) => void;
  onOpenTrackDetails: (track: Track) => void;
  onSelectCategory?: (category: string) => void;
  selectedGenre?: string;
  onClearGenre?: () => void;
}

type FilterChip = 'all' | 'top' | 'hot' | 'new';

export const AllTracksSection: React.FC<AllTracksSectionProps> = ({
  onSelectArtist,
  onOpenTrackDetails,
  selectedGenre,
  onClearGenre,
}) => {
  const {
    tracks,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    playNextInQueue,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<FilterChip>('all');
  const [animatingHeartTrackId, setAnimatingHeartTrackId] = useState<string | null>(null);

  const publicTracks = useMemo(
    () => tracks.filter((t) => !t.isDraft && !t.isDeranked),
    [tracks]
  );

  const activeGenre = selectedGenre && selectedGenre !== 'All' ? selectedGenre : '';

  const filteredTracks = useMemo(() => {
    const baseList = activeGenre
      ? publicTracks.filter(
          (t) => t.genre && t.genre.trim().toLowerCase() === activeGenre.trim().toLowerCase()
        )
      : publicTracks;

    const list = [...baseList];
    if (filter === 'top') {
      return list
        .sort((a, b) => (b.plays || 0) - (a.plays || 0))
        .slice(0, 10);
    }
    if (filter === 'hot') {
      return list.sort((a, b) => (b.plays || 0) + (b.likes || 0) * 3 - ((a.plays || 0) + (a.likes || 0) * 3));
    }
    if (filter === 'new') {
      return list.sort(
        (a, b) =>
          new Date(b.releaseDate || b.createdAt || 0).getTime() -
          new Date(a.releaseDate || a.createdAt || 0).getTime()
      );
    }
    return list;
  }, [publicTracks, activeGenre, filter]);

  if (publicTracks.length === 0) return null;

  const filterChips: { id: FilterChip; label: string }[] = [
    { id: 'all', label: activeGenre ? `${activeGenre} (${filteredTracks.length})` : `All (${publicTracks.length})` },
    { id: 'top', label: 'Charts' },
    { id: 'hot', label: 'Most played' },
    { id: 'new', label: 'Newest' },
  ];

  const handlePlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  const handleLike = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const alreadyLiked = isTrackLikedByUser(track, currentUser);
    if (!alreadyLiked) {
      setAnimatingHeartTrackId(track.id);
      setTimeout(() => setAnimatingHeartTrackId((prev) => (prev === track.id ? null : prev)), 300);
    }
    toggleLikeTrack(track.id);
    showToast(alreadyLiked ? 'Removed from Liked songs' : 'Added to Liked songs');
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--lv-text)]">
              {activeGenre ? `${activeGenre} tracks` : 'All tracks'}
            </h2>
            <p className="text-xs text-[var(--lv-muted)]">Tap a track to start listening</p>
          </div>
          {activeGenre && onClearGenre && (
            <button
              type="button"
              onClick={onClearGenre}
              className="px-3 py-1.5 rounded-xl bg-[var(--lv-elevated)] border border-[var(--lv-border)] text-xs font-semibold text-[var(--lv-text)] hover:border-[var(--lv-border-strong)] cursor-pointer min-h-[36px]"
            >
              Show all genres
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition shrink-0 active:scale-95 cursor-pointer min-h-[40px] ${
                filter === chip.id
                  ? 'bg-[var(--lv-accent)] text-[#0A0B0A] font-bold'
                  : 'bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] text-[var(--lv-muted)] hover:text-[var(--lv-text)] border border-[var(--lv-border)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="p-8 rounded-[20px] bg-[var(--lv-surface)] border border-[var(--lv-border)] text-center space-y-2">
          <Music className="w-7 h-7 text-[var(--lv-muted)] mx-auto opacity-50" />
          <p className="text-sm font-bold text-[var(--lv-text)]">Nothing matches this filter</p>
          <p className="text-xs text-[var(--lv-muted)]">Try picking another filter above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTracks.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            const isCurrentPlaying = isCurrent && isPlaying;
            const isLiked = isTrackLikedByUser(track, currentUser);
            const likeCount = getTrackLikeCount(track);
            const isAnimatingHeart = animatingHeartTrackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => handlePlay(track)}
                className={`group flex items-center justify-between gap-3 p-3 rounded-[20px] border transition-colors duration-150 cursor-pointer ${
                  isCurrent
                    ? 'bg-[var(--lv-elevated)] border-[var(--lv-violet)]'
                    : 'bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border-[var(--lv-border)] hover:border-[var(--lv-border-strong)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[var(--lv-border)] bg-[var(--lv-elevated)]">
                    <LazySlideImage
                      src={track.coverArt || DEFAULT_ARTWORK_SVG}
                      alt={track.title}
                      containerClassName="w-full h-full"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTrackDetails(track);
                      }}
                      className="text-sm font-bold text-[var(--lv-text)] hover:underline line-clamp-2 text-left leading-snug cursor-pointer"
                    >
                      {track.title}
                    </button>

                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--lv-muted)] truncate">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectArtist(track.artistId);
                        }}
                        className="hover:text-[var(--lv-text)] font-medium truncate cursor-pointer"
                      >
                        {track.artistName}
                      </button>
                      <span>·</span>
                      <span className="truncate">{track.genre}</span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-[var(--lv-muted)]">
                      <span>{(track.plays || 0).toLocaleString()} plays</span>
                      <span>·</span>
                      <span>{formatTime(track.durationSeconds)}</span>
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => handleLike(e, track)}
                    className={`px-2.5 rounded-xl transition active:scale-90 min-h-[48px] min-w-[48px] flex items-center justify-center gap-1.5 cursor-pointer ${
                      isLiked
                        ? 'text-rose-500'
                        : 'text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
                    }`}
                    aria-label={isLiked ? 'Unlike track' : 'Like track'}
                  >
                    <Heart
                      className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''} ${
                        isAnimatingHeart ? 'animate-heart-pop' : ''
                      }`}
                    />
                    <span className="text-xs font-mono font-bold tabular-nums">{likeCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playNextInQueue(track);
                      showToast(`Playing "${track.title}" next`);
                    }}
                    className="hidden sm:flex items-center justify-center rounded-xl text-[var(--lv-muted)] hover:text-[var(--lv-text)] hover:bg-[var(--lv-bg)]/40 transition min-h-[48px] min-w-[48px] cursor-pointer"
                    title="Play next"
                    aria-label="Play next"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePlay(track)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                      isCurrentPlaying
                        ? 'bg-[var(--lv-accent)] text-[#0A0B0A]'
                        : 'bg-[var(--lv-elevated)] hover:bg-[var(--lv-accent)] text-[var(--lv-text)] hover:text-[#0A0B0A] border border-[var(--lv-border)]'
                    }`}
                    aria-label={isCurrentPlaying ? 'Pause' : 'Play'}
                  >
                    {isCurrentPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
