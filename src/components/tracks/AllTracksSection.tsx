import { ChevronRight, Heart, ListPlus, Music, Pause, Play } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { formatTime, getTrackLikeCount, isTrackLikedByUser } from '../../utils/formatters';
import {
  groupTracksByCategory,
  normalizeGenreCategory,
  translateGenreCategory,
} from '../../utils/genreCategories';
import { LazySlideImage } from '../common/LazySlideImage';

interface AllTracksSectionProps {
  onSelectArtist: (artistId: string) => void;
  onOpenTrackDetails: (track: Track) => void;
  onSelectCategory?: (category: string) => void;
  selectedGenre?: string;
  onClearGenre?: () => void;
}

type FilterChip = 'categories' | 'top' | 'hot' | 'new';

const PAGE_SIZE = 6;
const SHELF_MAX_ITEMS = 8;

export const AllTracksSection: React.FC<AllTracksSectionProps> = ({
  onSelectArtist,
  onOpenTrackDetails,
  onSelectCategory,
  selectedGenre,
  onClearGenre,
}) => {
  const {
    tracks,
    currentTrack,
    isPlaying,
    playTrack,
    playTrackList,
    togglePlayPause,
    playNextInQueue,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<FilterChip>('categories');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);
  const [animatingHeartTrackId, setAnimatingHeartTrackId] = useState<string | null>(null);

  const publicTracks = useMemo(
    () => tracks.filter((tr) => !tr.isDraft && !tr.isDeranked),
    [tracks]
  );

  const activeGenre =
    selectedGenre && selectedGenre !== 'All' ? normalizeGenreCategory(selectedGenre) : '';

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [filter, activeGenre]);

  const categorizedGroups = useMemo(
    () => groupTracksByCategory(publicTracks),
    [publicTracks]
  );

  const filteredTracks = useMemo(() => {
    const baseList = activeGenre
      ? publicTracks.filter((tr) => normalizeGenreCategory(tr.genre) === activeGenre)
      : publicTracks;

    const list = [...baseList];
    if (filter === 'top') {
      return list.sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 12);
    }
    if (filter === 'hot') {
      return list.sort(
        (a, b) =>
          (b.plays || 0) + (b.likes || 0) * 3 - ((a.plays || 0) + (a.likes || 0) * 3)
      );
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

  const isCategoryBrowseMode = !activeGenre && filter === 'categories';
  const visibleTracks = filteredTracks.slice(0, visibleLimit);
  const remainingCount = Math.max(0, filteredTracks.length - visibleTracks.length);

  const filterChips: { id: FilterChip; label: string }[] = [
    {
      id: 'categories',
      label: activeGenre
        ? `${translateGenreCategory(activeGenre, language)} (${filteredTracks.length})`
        : `${t('tab_categories', 'Categories')} (${categorizedGroups.length})`,
    },
    { id: 'top', label: t('tab_charts', 'Charts') },
    { id: 'hot', label: t('tab_most_played', 'Most played') },
    { id: 'new', label: t('tab_newest', 'Newest') },
  ];

  const handlePlay = (track: Track, list?: Track[], idx?: number) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else if (list && typeof idx === 'number') {
      playTrackList(list, idx);
    } else {
      playTrack(track);
    }
  };

  const handleLike = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    const alreadyLiked = isTrackLikedByUser(track, currentUser);
    if (!alreadyLiked) {
      setAnimatingHeartTrackId(track.id);
      setTimeout(
        () => setAnimatingHeartTrackId((prev) => (prev === track.id ? null : prev)),
        300
      );
    }
    toggleLikeTrack(track.id);
    showToast(
      alreadyLiked
        ? t('removed_from_liked', 'Removed from Liked songs')
        : t('added_to_liked', 'Added to Liked songs')
    );
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--text)]">
              {activeGenre
                ? t('genre_tracks_title', '{genre} tracks', {
                    genre: translateGenreCategory(activeGenre, language),
                  })
                : t('explore_by_category', 'Explore by Category')}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {isCategoryBrowseMode
                ? t(
                    'explore_by_category_sub',
                    'Browse songs grouped by sound so every genre is easy to open'
                  )
                : t('tap_track_to_listen', 'Tap any track or category to start listening')}
            </p>
          </div>

          {activeGenre && onClearGenre && (
            <button
              type="button"
              onClick={onClearGenre}
              className="px-3.5 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:border-[var(--border-strong)] cursor-pointer min-h-[44px] whitespace-nowrap"
            >
              {t('show_all_categories', 'All categories')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-semibold transition shrink-0 active:scale-95 cursor-pointer min-h-[44px] whitespace-nowrap ${
                filter === chip.id
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                  : 'bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {isCategoryBrowseMode ? (
        <div className="space-y-6">
          {categorizedGroups.map((group) => {
            const shelfTracks = group.tracks.slice(0, SHELF_MAX_ITEMS);
            const displayGenre = translateGenreCategory(group.category, language);

            return (
              <div key={group.category} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-extrabold font-heading text-[var(--text)] truncate">
                      {displayGenre}
                    </h3>
                    <p className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
                      {t('songs_count_label', '{count} songs', {
                        count: group.tracks.length,
                      })}
                      {' · '}
                      {t('plays_count', '{count} plays', {
                        count: group.totalPlays.toLocaleString(),
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        playTrackList(group.tracks, 0);
                        showToast(displayGenre);
                      }}
                      className="px-3.5 py-2 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-xs font-bold text-[var(--text)] inline-flex items-center gap-1.5 transition active:scale-95 cursor-pointer min-h-[44px] whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{t('play_all', 'Play all')}</span>
                    </button>

                    {onSelectCategory && group.tracks.length > SHELF_MAX_ITEMS && (
                      <button
                        type="button"
                        onClick={() => onSelectCategory(group.category)}
                        className="px-3 py-2 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--accent-text)] inline-flex items-center gap-1 transition cursor-pointer min-h-[44px] whitespace-nowrap"
                      >
                        <span>{t('see_all', 'See all')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                  {shelfTracks.map((track, idx) => {
                    const isCurrent = currentTrack?.id === track.id;
                    const isCurrentPlaying = isCurrent && isPlaying;
                    const isLiked = isTrackLikedByUser(track, currentUser);

                    return (
                      <div
                        key={track.id}
                        onClick={() => handlePlay(track, shelfTracks, idx)}
                        className={`group shrink-0 snap-start w-[156px] sm:w-[178px] p-2.5 rounded-[20px] border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2.5 ${
                          isCurrent
                            ? 'bg-[var(--surface-2)] border-[var(--violet)]'
                            : 'bg-[var(--surface)] hover:bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                            <LazySlideImage
                              src={track.coverArt || DEFAULT_ARTWORK_SVG}
                              alt={track.title}
                              containerClassName="w-full h-full"
                              className="group-hover:scale-105 transition-transform duration-300"
                              watermark
                              watermarkPosition="bottom-left"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlay(track, shelfTracks, idx);
                              }}
                              aria-label={isCurrentPlaying ? t('pause', 'Pause') : t('play', 'Play')}
                              className={`absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-lg transition-all duration-150 cursor-pointer ${
                                isCurrentPlaying
                                  ? 'opacity-100 scale-100'
                                  : 'opacity-95 sm:opacity-0 sm:translate-y-1 sm:group-hover:opacity-100 sm:group-hover:translate-y-0'
                              }`}
                            >
                              {isCurrentPlaying ? (
                                <Pause className="w-4 h-4 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              )}
                            </button>
                          </div>

                          <div className="space-y-0.5 px-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTrackDetails(track);
                              }}
                              className="text-xs sm:text-sm font-bold text-[var(--text)] hover:underline line-clamp-1 text-left cursor-pointer block w-full"
                            >
                              {track.title}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectArtist(track.artistId);
                              }}
                              className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] truncate block text-left max-w-full cursor-pointer"
                            >
                              {track.artistName}
                            </button>
                          </div>
                        </div>

                        <div
                          className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] px-0.5 pt-1 border-t border-[var(--border)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="truncate tabular-nums">
                            {t('plays_count', '{count} plays', {
                              count: (track.plays || 0).toLocaleString(),
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleLike(e, track)}
                            className={`p-1.5 -mr-1.5 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer transition ${
                              isLiked
                                ? 'text-rose-500'
                                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                            }`}
                            aria-label={isLiked ? t('unlike', 'Unlike') : t('like', 'Like')}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500' : ''}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className="p-8 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-2">
          <Music className="w-7 h-7 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="text-sm font-bold text-[var(--text)]">
            {t('nothing_matches_filter', 'Nothing matches this filter')}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {t('try_another_filter', 'Try picking another filter or category above.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            {visibleTracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isCurrentPlaying = isCurrent && isPlaying;
              const isLiked = isTrackLikedByUser(track, currentUser);
              const likeCount = getTrackLikeCount(track);
              const isAnimatingHeart = animatingHeartTrackId === track.id;

              return (
                <div
                  key={track.id}
                  onClick={() => handlePlay(track, filteredTracks, idx)}
                  className={`group flex items-center justify-between gap-3 p-3 rounded-[20px] border transition-colors duration-150 cursor-pointer ${
                    isCurrent
                      ? 'bg-[var(--surface-2)] border-[var(--violet)]'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface-2)]">
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
                        className="text-sm font-bold text-[var(--text)] hover:underline line-clamp-2 text-left leading-snug cursor-pointer"
                      >
                        {track.title}
                      </button>

                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)] truncate">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectArtist(track.artistId);
                          }}
                          className="hover:text-[var(--text)] font-medium truncate cursor-pointer"
                        >
                          {track.artistName}
                        </button>
                        <span>·</span>
                        <span className="truncate">
                          {translateGenreCategory(track.genre, language)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-[var(--text-muted)]">
                        <span>
                          {t('plays_count', '{count} plays', {
                            count: (track.plays || 0).toLocaleString(),
                          })}
                        </span>
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
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                      aria-label={isLiked ? t('unlike', 'Unlike') : t('like', 'Like')}
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
                        showToast(
                          t('playing_next_toast', 'Playing "{title}" next', {
                            title: track.title,
                          })
                        );
                      }}
                      className="hidden sm:flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]/40 transition min-h-[48px] min-w-[48px] cursor-pointer"
                      title={t('play_next', 'Play next')}
                      aria-label={t('play_next', 'Play next')}
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePlay(track, filteredTracks, idx)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                        isCurrentPlaying
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                          : 'bg-[var(--surface-2)] hover:bg-[var(--accent)] text-[var(--text)] hover:text-[var(--accent-contrast)] border border-[var(--border)]'
                      }`}
                      aria-label={isCurrentPlaying ? t('pause', 'Pause') : t('play', 'Play')}
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

          {remainingCount > 0 && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                className="px-6 py-3 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-xs font-bold text-[var(--text)] transition active:scale-95 cursor-pointer min-h-[48px]"
              >
                {t('show_more_songs', 'Show {count} more', {
                  count: Math.min(PAGE_SIZE, remainingCount),
                })}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
