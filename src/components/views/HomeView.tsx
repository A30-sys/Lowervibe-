import {
  AlertCircle,
  Check,
  CheckCircle2,
  Heart,
  ListMusic,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Shuffle,
  Upload,
  UserPlus,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { matchesLocationFilter } from '../../data/regions';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import { formatNumber, formatTime } from '../../utils/formatters';
import { HeroSkeleton, ShelfSkeleton } from '../common/LoadingSkeleton';
import { LazySlideImage } from '../common/LazySlideImage';
import { HeroFeaturedCard } from '../hero/HeroFeaturedCard';
import { NewReleasesShelf } from '../shelves/NewReleasesShelf';
import { TopTenShelf } from '../shelves/TopTenShelf';
import { VibeTrendsShelf } from '../shelves/VibeTrendsShelf';
import { AllTracksSection } from '../tracks/AllTracksSection';

interface HomeViewProps {
  onSelectArtist: (artistId: string) => void;
  onOpenTrackDetails: (track?: Track) => void;
  onOpenLegal: (type: 'terms' | 'privacy') => void;
  onOpenStudio: () => void;
  onSelectCategory?: (category: string) => void;
}

function getTimeGreeting(name?: string): string {
  const hour = new Date().getHours();
  const base = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${base}, ${first}` : base;
}

interface ShelfSectionProps {
  title: string;
  subtitle: string;
  items: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onPlayAll?: (items: Track[]) => void;
  onSelectArtist: (artistId: string) => void;
  minItems?: number;
}

const HorizontalTrackShelf: React.FC<ShelfSectionProps> = ({
  title,
  subtitle,
  items,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onPlayAll,
  onSelectArtist,
  minItems = 3,
}) => {
  if (items.length < minItems) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--text)] truncate">
            {title}
          </h2>
          <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>
        </div>
        {onPlayAll && items.length > 0 && (
          <button
            type="button"
            onClick={() => onPlayAll(items)}
            className="px-3.5 py-2 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-xs font-bold text-[var(--text)] inline-flex items-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer min-h-[40px]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play all</span>
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {items.map((track) => {
          const isCurrent = currentTrackId === track.id;
          const isCurrentPlaying = isCurrent && isPlaying;
          return (
            <div
              key={track.id}
              onClick={() => onPlayTrack(track)}
              className="group shrink-0 snap-start w-[152px] sm:w-[172px] p-2.5 rounded-[20px] bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-all duration-150 cursor-pointer space-y-2.5"
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                <LazySlideImage
                  src={track.coverArt || DEFAULT_ARTWORK_SVG}
                  alt={track.title}
                  containerClassName="w-full h-full"
                  className="group-hover:scale-105 transition-transform duration-300"
                />
                <div
                  className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-lg transition-all duration-150 ${
                    isCurrentPlaying
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                  }`}
                >
                  {isCurrentPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </div>
              </div>
              <div className="space-y-0.5 px-0.5">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--text)] line-clamp-2 leading-snug">
                  {track.title}
                </h3>
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
          );
        })}
      </div>
    </section>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectArtist,
  onOpenTrackDetails,
  onOpenStudio,
  onSelectCategory = () => {},
}) => {
  const {
    tracks,
    artists,
    playlists,
    isCatalogLoaded,
    catalogError,
    retryCatalogLoad,
    playHistory,
    currentTrack,
    currentTime,
    isPlaying,
    playTrack,
    playTrackList,
    togglePlayPause,
    toggleLikePlaylist,
    recordPlaylistPlay,
    selectedCountry,
  } = useAudio();
  const { currentUser, toggleFollowArtist } = useAuth();
  const { showToast } = useToast();
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  const publicTracks = useMemo(
    () => tracks.filter((t) => !t.isDraft && !t.isDeranked),
    [tracks]
  );

  // Live genre chips computed strictly from stored public tracks
  const topGenres = useMemo(() => {
    const counts = new Map<string, { label: string; score: number }>();
    for (const t of publicTracks) {
      const clean = (t.genre || '').trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      const prev = counts.get(key) || { label: clean, score: 0 };
      prev.score += 10 + (t.plays || 0);
      counts.set(key, prev);
    }
    return Array.from(counts.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.label);
  }, [publicTracks]);

  const genreSpotlightTracks = useMemo(() => {
    if (!selectedGenre || selectedGenre === 'All') return [];
    const target = selectedGenre.trim().toLowerCase();
    return publicTracks
      .filter((t) => (t.genre || '').trim().toLowerCase() === target)
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, 10);
  }, [publicTracks, selectedGenre]);

  const handleTrackPlay = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  const handlePlayMix = (shuffleAll: boolean) => {
    if (publicTracks.length === 0) return;
    const pool = shuffleAll
      ? [...publicTracks].sort(() => Math.random() - 0.5)
      : [...publicTracks].sort((a, b) => (b.plays || 0) + (b.likes || 0) * 2 - ((a.plays || 0) + (a.likes || 0) * 2));
    playTrackList(pool.slice(0, 20), 0);
    showToast(shuffleAll ? 'Shuffling tracks' : 'Playing top mix');
  };

  // Real Continue Listening tracks from actual playHistory + active resumed track (deduped by trackId, sorted by last played)
  const continueListening = useMemo(() => {
    const byId = new Map<
      string,
      { track: Track; listenedSec: number; durationSec: number; playedAtMs: number }
    >();

    if (currentTrack && !currentTrack.isDraft && !currentTrack.isDeranked) {
      const dur = Math.max(1, currentTrack.durationSeconds || currentTrack.metadata?.Duration || 0);
      byId.set(currentTrack.id, {
        track: currentTrack,
        listenedSec: Math.min(
          dur,
          playHistory.find((h) => h.trackId === currentTrack.id)?.listenedDurationSeconds || 0
        ),
        durationSec: dur,
        playedAtMs: Date.now(),
      });
    }

    const sortedHistory = [...playHistory].sort(
      (a, b) => new Date(b.playedAt || 0).getTime() - new Date(a.playedAt || 0).getTime()
    );

    for (const item of sortedHistory) {
      const liveTrack = publicTracks.find((t) => t.id === item.trackId);
      if (liveTrack && !byId.has(liveTrack.id)) {
        const dur = Math.max(1, liveTrack.durationSeconds || liveTrack.metadata?.Duration || 0);
        byId.set(liveTrack.id, {
          track: liveTrack,
          listenedSec: Math.min(dur, Math.max(0, item.listenedDurationSeconds || 0)),
          durationSec: dur,
          playedAtMs: new Date(item.playedAt || 0).getTime(),
        });
      }
      if (byId.size >= 8) break;
    }

    return Array.from(byId.values()).sort((a, b) => b.playedAtMs - a.playedAtMs);
  }, [playHistory, currentTrack, publicTracks]);

  // Spotlight Artists with real catalog tracks
  const spotlightArtists = useMemo(() => {
    const trackCountByArtist = new Map<string, number>();
    const playsByArtist = new Map<string, number>();
    for (const t of publicTracks) {
      trackCountByArtist.set(t.artistId, (trackCountByArtist.get(t.artistId) || 0) + 1);
      playsByArtist.set(t.artistId, (playsByArtist.get(t.artistId) || 0) + (t.plays || 0));
    }

    return artists
      .map((artist) => ({
        artist,
        songCount: trackCountByArtist.get(artist.id) || 0,
        totalPlays: playsByArtist.get(artist.id) || 0,
      }))
      .filter((entry) => entry.songCount > 0 || (entry.artist.followersCount || 0) > 0)
      .sort(
        (a, b) =>
          b.totalPlays +
          (b.artist.followersCount || 0) * 5 -
          (a.totalPlays + (a.artist.followersCount || 0) * 5)
      )
      .slice(0, 10);
  }, [artists, publicTracks]);

  // Public Community Playlists with real resolved tracks
  const publicPlaylists = useMemo(() => {
    const trackMap = new Map(publicTracks.map((t) => [t.id, t]));
    return playlists
      .filter((pl) => pl.isPublic !== false && Array.isArray(pl.trackIds) && pl.trackIds.length > 0)
      .map((pl) => {
        const resolvedTracks = pl.trackIds
          .map((id) => trackMap.get(id))
          .filter((t): t is Track => Boolean(t));
        return { playlist: pl, resolvedTracks };
      })
      .filter((item) => item.resolvedTracks.length > 0)
      .sort(
        (a, b) =>
          (b.playlist.likes || 0) * 3 +
          (b.playlist.plays || 0) -
          ((a.playlist.likes || 0) * 3 + (a.playlist.plays || 0))
      )
      .slice(0, 8);
  }, [playlists, publicTracks]);

  // Personalized Shelf 1: Daily Mix (prefers user's liked/played genres, otherwise varied top tracks; min 3 items)
  const dailyMixTracks = useMemo(() => {
    if (publicTracks.length < 3) return [];
    const likedSet = new Set(currentUser?.likedTrackIds || []);
    const affinityGenres = new Set<string>();
    for (const t of publicTracks) {
      if (likedSet.has(t.id) && t.genre) affinityGenres.add(t.genre.toLowerCase());
    }
    for (const h of playHistory) {
      if (h.track?.genre) affinityGenres.add(h.track.genre.toLowerCase());
    }

    const matching =
      affinityGenres.size > 0
        ? publicTracks.filter((t) => t.genre && affinityGenres.has(t.genre.toLowerCase()))
        : publicTracks;
    const pool = matching.length >= 3 ? matching : publicTracks;
    return pool.slice(0, 8);
  }, [publicTracks, currentUser?.likedTrackIds, playHistory]);

  // Personalized Shelf 2: Because you played [LastTrack] (min 3 similar tracks)
  const becauseYouPlayed = useMemo(() => {
    const anchor = continueListening[0]?.track;
    if (!anchor) return { anchorTitle: '', items: [] as Track[] };
    const related = publicTracks.filter(
      (t) =>
        t.id !== anchor.id &&
        ((t.genre && anchor.genre && t.genre.toLowerCase() === anchor.genre.toLowerCase()) ||
          t.artistId === anchor.artistId ||
          (t.region && anchor.region && t.region === anchor.region))
    );
    return {
      anchorTitle: anchor.title,
      items: related.slice(0, 8),
    };
  }, [continueListening, publicTracks]);

  // Personalized Shelf 3: Fresh from artists you follow (min 3 items)
  const followedArtistTracks = useMemo(() => {
    const following = new Set(currentUser?.followingArtistIds || []);
    if (following.size === 0) return [];
    return publicTracks
      .filter((t) => following.has(t.artistId))
      .sort(
        (a, b) =>
          new Date(b.releaseDate || b.createdAt || 0).getTime() -
          new Date(a.releaseDate || a.createdAt || 0).getTime()
      )
      .slice(0, 8);
  }, [publicTracks, currentUser?.followingArtistIds]);

  // Personalized Shelf 4: Trending in [Country] (min 3 items)
  const countryTrending = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'Global') return [];
    return publicTracks
      .filter((t) => matchesLocationFilter(t.region, selectedCountry))
      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
      .slice(0, 8);
  }, [publicTracks, selectedCountry]);

  // Real user activity summary parts (only shown when > 0)
  const activityParts = useMemo(() => {
    if (!currentUser) return [];
    const parts: string[] = [];
    const likedCount = currentUser.likedTrackIds?.length || 0;
    const followingCount = currentUser.followingArtistIds?.length || 0;
    const playedCount = playHistory.length;
    if (likedCount > 0) parts.push(`${likedCount} liked`);
    if (followingCount > 0) parts.push(`${followingCount} following`);
    if (playedCount > 0) parts.push(`${playedCount} recently played`);
    return parts;
  }, [currentUser, playHistory.length]);

  // 1. Skeleton Loading State
  if (!isCatalogLoaded && tracks.length === 0) {
    return (
      <div className="space-y-8 pb-8">
        <HeroSkeleton />
        <ShelfSkeleton count={4} />
        <ShelfSkeleton count={4} />
      </div>
    );
  }

  // 2. Catalog Error State with Retry
  if (catalogError && tracks.length === 0) {
    return (
      <div className="py-16">
        <div className="max-w-md mx-auto p-8 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--danger)]/15 text-[var(--danger)] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-extrabold font-heading text-[var(--text)]">
              Could not load music
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">{catalogError}</p>
          </div>
          <button
            type="button"
            onClick={retryCatalogLoad}
            className="px-5 py-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm inline-flex items-center gap-2 cursor-pointer min-h-[48px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Designed Empty Catalog State
  if (isCatalogLoaded && publicTracks.length === 0) {
    return (
      <div className="space-y-8 pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
            {getTimeGreeting(currentUser?.name)}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Music feed for {selectedCountry || 'Africa'}
          </p>
        </div>

        <div className="max-w-lg mx-auto p-8 sm:p-10 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--violet)] flex items-center justify-center mx-auto">
            <Music2 className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold font-heading text-[var(--text)]">
              No songs uploaded yet
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
              Share the first track on LOWERVIBE and listeners can stream it right away.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenStudio}
            className="px-6 py-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm inline-flex items-center gap-2 hover:brightness-95 active:scale-95 transition cursor-pointer min-h-[48px]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload a song</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10 animate-fadeIn pb-6">
      {/* Greeting, Real Activity Strip & Quick Play Actions */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
              {getTimeGreeting(currentUser?.name)}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              Music feed for {selectedCountry || 'Africa'}
              {activityParts.length > 0 ? ` · ${activityParts.join(' · ')}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handlePlayMix(false)}
              className="px-5 py-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs sm:text-sm inline-flex items-center gap-2 hover:brightness-95 active:scale-95 transition cursor-pointer min-h-[48px]"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play mix</span>
            </button>
            <button
              type="button"
              onClick={() => handlePlayMix(true)}
              className="px-4 py-3 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] font-semibold text-xs sm:text-sm inline-flex items-center gap-2 active:scale-95 transition cursor-pointer min-h-[48px]"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>
          </div>
        </div>

        {/* Live Genre Filter Strip */}
        {topGenres.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {['All', ...topGenres].map((genreName) => {
              const active = selectedGenre === genreName;
              return (
                <button
                  key={genreName}
                  type="button"
                  onClick={() => setSelectedGenre(genreName)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-semibold shrink-0 transition active:scale-95 cursor-pointer min-h-[44px] ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                  }`}
                >
                  {genreName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Instant Genre Spotlight when user picks a specific genre chip */}
      {selectedGenre !== 'All' && genreSpotlightTracks.length > 0 && (
        <HorizontalTrackShelf
          title={`${selectedGenre} spotlight`}
          subtitle={`Top ${selectedGenre} songs playing right now`}
          items={genreSpotlightTracks}
          minItems={1}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlayTrack={handleTrackPlay}
          onPlayAll={(list) => {
            playTrackList(list, 0);
            showToast(`Playing ${selectedGenre}`);
          }}
          onSelectArtist={onSelectArtist}
        />
      )}

      {/* Resume Song (strictly single most recent track at the top) */}
      {continueListening.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm sm:text-base font-extrabold font-heading text-[var(--text)]">
            Resume song
          </h2>
          {continueListening.slice(0, 1).map(({ track, listenedSec, durationSec }) => {
            const isCurrent = currentTrack?.id === track.id;
            const isCurrentPlaying = isCurrent && isPlaying;
            const elapsed = isCurrent ? currentTime : listenedSec;
            const safeDuration = Math.max(1, durationSec);
            const remainingSec = Math.max(0, safeDuration - elapsed);
            const pct = Math.min(100, Math.max(0, (elapsed / safeDuration) * 100));
            return (
              <div
                key={track.id}
                onClick={() => handleTrackPlay(track)}
                className="flex flex-col gap-2.5 p-3 sm:p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={track.coverArt || DEFAULT_ARTWORK_SVG}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-[var(--text)] line-clamp-1">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)] truncate">
                      {track.artistName} ·{' '}
                      <span className="font-mono tabular-nums">{formatTime(remainingSec)} left</span>
                    </p>
                  </div>
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                      isCurrentPlaying
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text)]'
                    }`}
                  >
                    {isCurrentPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </div>
                </div>
                <div className="h-1 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Single Top Spotlight (Location-based Featured Pick or Most Trending) */}
      <HeroFeaturedCard
        onOpenArtist={onSelectArtist}
        onOpenTrackDetails={() => onOpenTrackDetails()}
        onSelectCategory={onSelectCategory}
      />

      {/* Charts */}
      <TopTenShelf onSelectArtist={onSelectArtist} onSelectCategory={onSelectCategory} />

      {/* Public Playlists */}
      {publicPlaylists.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--text)]">
              Public playlists
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Listener-made collections ready to stream
            </p>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
            {publicPlaylists.map(({ playlist, resolvedTracks }) => {
              const cover =
                playlist.coverArt || resolvedTracks[0]?.coverArt || DEFAULT_ARTWORK_SVG;
              const isLiked = Boolean(
                currentUser && playlist.likedByUserIds?.includes(currentUser.id)
              );
              const likeCount = playlist.likedByUserIds
                ? playlist.likedByUserIds.length
                : playlist.likes || 0;

              return (
                <div
                  key={playlist.id}
                  onClick={() => {
                    playTrackList(resolvedTracks, 0);
                    recordPlaylistPlay(playlist.id);
                    showToast(`Playing ${playlist.name}`);
                  }}
                  className="group shrink-0 snap-start w-[184px] sm:w-[208px] p-3 rounded-[20px] bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                      <LazySlideImage
                        src={cover}
                        alt={playlist.name}
                        containerClassName="w-full h-full"
                        className="group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <h3 className="text-xs sm:text-sm font-bold text-[var(--text)] line-clamp-1">
                        {playlist.name}
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1">
                        <ListMusic className="w-3 h-3 shrink-0" />
                        <span>
                          {resolvedTracks.length}{' '}
                          {resolvedTracks.length === 1 ? 'song' : 'songs'} ·{' '}
                          {playlist.creatorName || 'Listener'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
                    <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                      {formatNumber(likeCount)} {likeCount === 1 ? 'like' : 'likes'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikePlaylist(playlist.id);
                      }}
                      className={`p-2 -mr-1 rounded-xl transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                        isLiked
                          ? 'text-rose-500'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                      aria-label={isLiked ? 'Unlike playlist' : 'Like playlist'}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Personalized Shelves (automatically hidden when < 3 items) */}
      <HorizontalTrackShelf
        title="Daily Mix"
        subtitle="Built from genres you listen to"
        items={dailyMixTracks}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onPlayTrack={handleTrackPlay}
        onPlayAll={(list) => {
          playTrackList(list, 0);
          showToast('Playing Daily Mix');
        }}
        onSelectArtist={onSelectArtist}
      />

      {/* Artists to Follow */}
      {spotlightArtists.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--text)]">
              Artists to follow
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Independent creators releasing on LOWERVIBE
            </p>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
            {spotlightArtists.map(({ artist, songCount }) => {
              const isFollowing = Boolean(currentUser?.followingArtistIds?.includes(artist.id));
              return (
                <div
                  key={artist.id}
                  onClick={() => onSelectArtist(artist.id)}
                  className="shrink-0 snap-start w-[172px] sm:w-[190px] p-3.5 rounded-[20px] bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5 text-center">
                    <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
                      <img
                        src={artist.avatar || DEFAULT_AVATAR_SVG}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-center gap-1">
                        <h3 className="text-xs sm:text-sm font-bold text-[var(--text)] truncate">
                          {artist.name}
                        </h3>
                        {artist.verified && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
                        {formatNumber(artist.followersCount || 0)} followers · {songCount}{' '}
                        {songCount === 1 ? 'song' : 'songs'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFollowArtist(artist.id);
                    }}
                    className={`w-full py-2.5 px-3 rounded-2xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer min-h-[44px] ${
                      isFollowing
                        ? 'bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]'
                        : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {becauseYouPlayed.items.length >= 3 && (
        <HorizontalTrackShelf
          title={`Because you played ${becauseYouPlayed.anchorTitle}`}
          subtitle="Similar genre and sound"
          items={becauseYouPlayed.items}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlayTrack={handleTrackPlay}
          onPlayAll={(list) => playTrackList(list, 0)}
          onSelectArtist={onSelectArtist}
        />
      )}

      <HorizontalTrackShelf
        title="From artists you follow"
        subtitle="Latest songs from creators in your list"
        items={followedArtistTracks}
        currentTrackId={currentTrack?.id}
        isPlaying={isPlaying}
        onPlayTrack={handleTrackPlay}
        onPlayAll={(list) => playTrackList(list, 0)}
        onSelectArtist={onSelectArtist}
      />

      {selectedCountry && selectedCountry !== 'Global' && (
        <HorizontalTrackShelf
          title={`Trending in ${selectedCountry}`}
          subtitle={`Most played tracks from ${selectedCountry}`}
          items={countryTrending}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlayTrack={handleTrackPlay}
          onPlayAll={(list) => playTrackList(list, 0)}
          onSelectArtist={onSelectArtist}
        />
      )}

      {/* Browse Genres (clicking sets quick genre filter on Home) */}
      <VibeTrendsShelf
        onFilterVibe={(genre) => {
          setSelectedGenre(genre);
          onSelectCategory(genre);
        }}
      />

      {/* New Releases (hides if < 3 items) */}
      <NewReleasesShelf onSelectArtist={onSelectArtist} onSelectCategory={onSelectCategory} />

      {/* All Tracks */}
      <AllTracksSection
        onSelectArtist={onSelectArtist}
        onOpenTrackDetails={onOpenTrackDetails}
        onSelectCategory={onSelectCategory}
        selectedGenre={selectedGenre}
        onClearGenre={() => setSelectedGenre('All')}
      />
    </div>
  );
};
