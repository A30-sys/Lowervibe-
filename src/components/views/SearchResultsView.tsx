import React, { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Disc3,
  Heart,
  ListMusic,
  Music,
  Pause,
  Play,
  Search,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { Artist, Playlist, Track } from '../../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import { formatTime } from '../../utils/formatters';
import { normalizeGenreCategory, translateGenreCategory } from '../../utils/genreCategories';

const RECENT_SEARCHES_KEY = 'lowervibe_recent_searches_v1';

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
}

function fuzzyScore(query: string, candidateText: string): number {
  const q = query.trim().toLowerCase();
  const c = (candidateText || '').trim().toLowerCase();
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 90;
  if (c.includes(q)) return 75;

  const qWords = q.split(/\s+/).filter(Boolean);
  const cWords = c.split(/[\s,._-]+/).filter(Boolean);
  let best = 0;

  for (const qw of qWords) {
    if (qw.length < 3) continue;
    for (const cw of cWords) {
      if (Math.abs(qw.length - cw.length) > 2) continue;
      const dist = levenshteinDistance(qw, cw);
      const maxEdits = qw.length >= 6 ? 2 : 1;
      if (dist <= maxEdits) {
        best = Math.max(best, dist === 1 ? 55 : 40);
      }
    }
  }
  return best;
}

export const SearchResultsView: React.FC<{ onOpenTrackDetails: (track: Track) => void }> = ({
  onOpenTrackDetails,
}) => {
  const { currentUser, updateCurrentUser } = useAuth();
  const {
    tracks,
    artists,
    playlists,
    currentTrack,
    isPlaying,
    playTrack,
    playTrackList,
    togglePlayPause,
    setActiveDetailTrack,
  } = useAudio();
  const { currentRoute, navigate } = useRouter();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  const initialQuery = currentRoute.searchQuery || '';
  const [rawQuery, setRawQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<'all' | 'tracks' | 'artists' | 'playlists' | 'genres'>('all');

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (currentUser?.recentSearches?.length) return currentUser.recentSearches;
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Sync external URL query parameter
  useEffect(() => {
    const q = currentRoute.searchQuery || '';
    if (q !== rawQuery) {
      setRawQuery(q);
      setDebouncedQuery(q);
    }
  }, [currentRoute.searchQuery]);

  // 300ms Debounce
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(rawQuery);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const saveSearchTerm = (term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    const next = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    setRecentSearches(next);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {}
    if (currentUser) {
      updateCurrentUser({ recentSearches: next });
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
    if (currentUser) {
      updateCurrentUser({ recentSearches: [] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSearchTerm(rawQuery);
    navigate(`/search?q=${encodeURIComponent(rawQuery.trim())}`);
  };

  const publicTracks = useMemo(
    () => tracks.filter((t) => !t.isDraft && !t.isDeranked),
    [tracks]
  );

  const trendingGenres = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; plays: number }>();
    publicTracks.forEach((t) => {
      const g = normalizeGenreCategory(t.genre);
      const prev = counts.get(g) || { name: g, count: 0, plays: 0 };
      prev.count += 1;
      prev.plays += t.plays || 0;
      counts.set(g, prev);
    });
    return Array.from(counts.values())
      .sort((a, b) => b.plays - a.plays || b.count - a.count)
      .slice(0, 8);
  }, [publicTracks]);

  const { matchedTracks, matchedArtists, matchedPlaylists, matchedGenres, topResult } = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      return {
        matchedTracks: [] as Track[],
        matchedArtists: [] as Artist[],
        matchedPlaylists: [] as Playlist[],
        matchedGenres: [] as { name: string; count: number; plays: number }[],
        topResult: null as
          | { kind: 'artist'; item: Artist; score: number }
          | { kind: 'track'; item: Track; score: number }
          | { kind: 'playlist'; item: Playlist; score: number }
          | null,
      };
    }

    const scoredTracks = publicTracks
      .map((t) => ({
        item: t,
        score: Math.max(
          fuzzyScore(q, t.title),
          fuzzyScore(q, t.artistName) * 0.9,
          fuzzyScore(q, t.genre) * 0.7,
          fuzzyScore(q, normalizeGenreCategory(t.genre)) * 0.7,
          fuzzyScore(q, translateGenreCategory(t.genre, language)) * 0.7
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.item.plays || 0) - (a.item.plays || 0));

    const scoredArtists = artists
      .map((a) => ({
        item: a,
        score: Math.max(
          fuzzyScore(q, a.name),
          fuzzyScore(q, a.handle),
          fuzzyScore(q, (a.genres || []).join(' ')) * 0.7
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.item.followersCount || 0) - (a.item.followersCount || 0));

    const allPlaylists = playlists.filter((p) => p.isPublic);
    const scoredPlaylists = allPlaylists
      .map((p) => ({
        item: p,
        score: Math.max(fuzzyScore(q, p.name), fuzzyScore(q, p.genre || '') * 0.8),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const scoredGenres = trendingGenres.filter(
      (g) => fuzzyScore(q, g.name) > 0 || fuzzyScore(q, translateGenreCategory(g.name, language)) > 0
    );

    const bestArtist = scoredArtists[0];
    const bestTrack = scoredTracks[0];
    const bestPlaylist = scoredPlaylists[0];

    let best:
      | { kind: 'artist'; item: Artist; score: number }
      | { kind: 'track'; item: Track; score: number }
      | { kind: 'playlist'; item: Playlist; score: number }
      | null = null;

    if (bestArtist && (!bestTrack || bestArtist.score >= bestTrack.score)) {
      best = { kind: 'artist', item: bestArtist.item, score: bestArtist.score };
    } else if (bestTrack) {
      best = { kind: 'track', item: bestTrack.item, score: bestTrack.score };
    } else if (bestPlaylist) {
      best = { kind: 'playlist', item: bestPlaylist.item, score: bestPlaylist.score };
    }

    return {
      matchedTracks: scoredTracks.map((x) => x.item),
      matchedArtists: scoredArtists.map((x) => x.item),
      matchedPlaylists: scoredPlaylists.map((x) => x.item),
      matchedGenres: scoredGenres,
      topResult: best,
    };
  }, [debouncedQuery, publicTracks, artists, playlists, trendingGenres, language]);

  const totalMatches =
    matchedTracks.length + matchedArtists.length + matchedPlaylists.length + matchedGenres.length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-4 space-y-6 animate-fadeIn">
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <Search className="w-5 h-5 text-[var(--text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder={t('search_placeholder', 'Search songs, artists, playlists, or genres...')}
          className="w-full pl-12 pr-24 py-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)]"
        />
        {rawQuery && (
          <button
            type="button"
            onClick={() => {
              setRawQuery('');
              setDebouncedQuery('');
              navigate('/search');
            }}
            className="absolute right-16 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
        >
          {t('search', 'Search')}
        </button>
      </form>

      {/* Instant Live Suggestions when typing */}
      {rawQuery.trim().length >= 2 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] shrink-0">
            {t('search_suggestions_heading', 'Try searching for')}:
          </span>
          {Array.from(
            new Set([
              ...matchedArtists.slice(0, 3).map((a) => a.name),
              ...matchedTracks.slice(0, 3).map((tr) => tr.title),
              ...trendingGenres.slice(0, 3).map((g) => g.name),
            ])
          )
            .slice(0, 6)
            .map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  setRawQuery(suggestion);
                  setDebouncedQuery(suggestion);
                  saveSearchTerm(suggestion);
                }}
                className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[11px] font-semibold text-[var(--text)] whitespace-nowrap cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
        </div>
      )}

      {/* EMPTY QUERY STATE: Recent Searches + Trending Genres */}
      {!debouncedQuery.trim() ? (
        <div className="space-y-6">
          {recentSearches.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[var(--text)]">
                  {isNy ? 'Zomwe munasaka posachedwa' : 'Recent searches'}
                </h2>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('clear_history', 'Clear history')}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setRawQuery(term);
                      setDebouncedQuery(term);
                      navigate(`/search?q=${encodeURIComponent(term)}`);
                    }}
                    className="px-3.5 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:border-[var(--border-strong)] transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-[var(--text)]">
              {isNy ? 'Mitundu yotchuka' : 'Trending genres'}
            </h2>
            {trendingGenres.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                {t('search_empty_prompt', 'Start typing to search music on LOWERVIBE.')}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {trendingGenres.map((g) => (
                  <button
                    key={g.name}
                    type="button"
                    onClick={() => {
                      setRawQuery(g.name);
                      setDebouncedQuery(g.name);
                      saveSearchTerm(g.name);
                    }}
                    className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] text-left transition cursor-pointer space-y-1"
                  >
                    <div className="text-sm font-bold text-[var(--text)] truncate">
                      {translateGenreCategory(g.name, language)}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {t('songs_count_label', `${g.count} song${g.count === 1 ? '' : 's'}`, {
                        count: g.count,
                      })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* SEARCH RESULTS */
        <div className="space-y-6">
          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all' as const, label: `${t('all', 'All')} (${totalMatches})` },
              { id: 'tracks' as const, label: `${t('artist_songs', 'Songs')} (${matchedTracks.length})` },
              { id: 'artists' as const, label: `${t('artists', 'Artists')} (${matchedArtists.length})` },
              { id: 'playlists' as const, label: `${t('playlists', 'Playlists')} (${matchedPlaylists.length})` },
              { id: 'genres' as const, label: `${isNy ? 'Mitundu' : 'Genres'} (${matchedGenres.length})` },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setActiveCategory(chip.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
                  activeCategory === chip.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                    : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {totalMatches === 0 ? (
            <div className="p-8 sm:p-10 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-5">
              <Search className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
              <div className="space-y-1.5">
                <h2 className="text-base font-extrabold text-[var(--text)]">
                  {t('search_no_match', 'Nothing matched your search yet.')}
                </h2>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  {isNy
                    ? `Sitinapeze "${debouncedQuery}". Yesani mitundu, oimba, kapena nyimbo zomwe zilipo pansipa.`
                    : `We could not find "${debouncedQuery}". Explore available genres, artists, or songs below.`}
                </p>
              </div>

              {trendingGenres.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('genres', 'Genres')}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {trendingGenres.slice(0, 6).map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => {
                          setRawQuery(g.name);
                          setDebouncedQuery(g.name);
                        }}
                        className="px-3.5 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] cursor-pointer"
                      >
                        {translateGenreCategory(g.name, language)} ({g.count})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {artists.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {t('artists', 'Artists')}
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {artists.slice(0, 5).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => navigate(`/artists/${a.slug || a.id}`)}
                        className="px-3.5 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--accent-text)] cursor-pointer"
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {publicTracks.length > 0 && (
                <div className="pt-2 text-left max-w-md mx-auto space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-center">
                    {t('popular_music_title', 'Popular on LOWERVIBE')}
                  </div>
                  <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                    {[...publicTracks]
                      .sort((a, b) => (b.plays || 0) - (a.plays || 0))
                      .slice(0, 3)
                      .map((tr) => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => playTrack(tr)}
                          className="w-full p-2.5 flex items-center justify-between gap-2.5 text-left hover:bg-[var(--surface)] transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={tr.coverArt || DEFAULT_ARTWORK_SVG}
                              alt={tr.title}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-lg object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text)] truncate">{tr.title}</div>
                              <div className="text-[11px] text-[var(--text-muted)] truncate">{tr.artistName}</div>
                            </div>
                          </div>
                          <Play className="w-4 h-4 text-[var(--accent-text)] shrink-0 fill-current" />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* TOP RESULT */}
              {activeCategory === 'all' && topResult && (
                <section className="space-y-2.5">
                  <h2 className="text-sm font-bold text-[var(--text)]">
                    {isNy ? 'Chotsogola' : 'Top result'}
                  </h2>
                  {topResult.kind === 'artist' ? (
                    <div
                      onClick={() => {
                        saveSearchTerm(debouncedQuery);
                        navigate(`/artists/${topResult.item.id}`);
                      }}
                      className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between gap-4 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={topResult.item.avatar || DEFAULT_AVATAR_SVG}
                          alt={topResult.item.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-full object-cover border border-[var(--border)] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-[var(--text)] truncate">
                            {topResult.item.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {t('artist', 'Artist')} · {topResult.item.country || 'Malawi'} ·{' '}
                            {topResult.item.followersCount || 0} {isNy ? 'otsatira' : 'followers'}
                          </div>
                        </div>
                      </div>
                      <span className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold shrink-0">
                        {isNy ? 'Onani woimba' : 'View artist'}
                      </span>
                    </div>
                  ) : topResult.kind === 'track' ? (
                    <div
                      onClick={() => {
                        saveSearchTerm(debouncedQuery);
                        if (currentTrack?.id === topResult.item.id) togglePlayPause();
                        else playTrack(topResult.item);
                      }}
                      className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between gap-4 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={topResult.item.coverArt || DEFAULT_ARTWORK_SVG}
                          alt={topResult.item.title}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-2xl object-cover border border-[var(--border)] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-[var(--text)] truncate">
                            {topResult.item.title}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {isNy ? 'Nyimbo' : 'Song'} · {topResult.item.artistName} ·{' '}
                            {translateGenreCategory(topResult.item.genre, language)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        {currentTrack?.id === topResult.item.id && isPlaying ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        saveSearchTerm(debouncedQuery);
                        const resolved = (topResult.item.trackIds || [])
                          .map((id) => publicTracks.find((tItem) => tItem.id === id))
                          .filter((x): x is Track => Boolean(x));
                        if (resolved.length > 0) {
                          playTrackList(resolved, 0);
                        } else {
                          navigate('/library');
                        }
                      }}
                      className="p-5 rounded-[22px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between gap-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={topResult.item.coverArt || DEFAULT_ARTWORK_SVG}
                          alt={topResult.item.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-2xl object-cover border border-[var(--border)] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-base font-extrabold text-[var(--text)] truncate">{topResult.item.name}</div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {isNy ? 'Mndandanda' : 'Playlist'} ·{' '}
                            {t('songs_count_label', `${topResult.item.trackIds.length} songs`, {
                              count: topResult.item.trackIds.length,
                            })}
                          </div>
                        </div>
                      </div>
                      <span className="w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </span>
                    </div>
                  )}
                </section>
              )}

              {/* SONGS */}
              {(activeCategory === 'all' || activeCategory === 'tracks') && matchedTracks.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-sm font-bold text-[var(--text)]">{t('artist_songs', 'Songs')}</h2>
                  <div className="rounded-[20px] bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                    {matchedTracks.slice(0, activeCategory === 'tracks' ? 30 : 6).map((tItem) => {
                      const active = currentTrack?.id === tItem.id;
                      return (
                        <div
                          key={tItem.id}
                          onClick={() => {
                            saveSearchTerm(debouncedQuery);
                            if (active) togglePlayPause();
                            else playTrack(tItem);
                          }}
                          className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)]/60 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={tItem.coverArt || DEFAULT_ARTWORK_SVG}
                              alt={tItem.title}
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[var(--text)] truncate">{tItem.title}</div>
                              <div className="text-xs text-[var(--text-muted)] truncate">
                                {tItem.artistName} · {translateGenreCategory(tItem.genre, language)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                              {formatTime(tItem.metadata?.Duration || tItem.durationSeconds || 0)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDetailTrack(tItem);
                                onOpenTrackDetails(tItem);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)] cursor-pointer"
                            >
                              {isNy ? 'Zambiri' : 'Details'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ARTISTS */}
              {(activeCategory === 'all' || activeCategory === 'artists') && matchedArtists.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-sm font-bold text-[var(--text)]">{t('artists', 'Artists')}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {matchedArtists.slice(0, 8).map((a) => (
                      <div
                        key={a.id}
                        onClick={() => {
                          saveSearchTerm(debouncedQuery);
                          navigate(`/artists/${a.id}`);
                        }}
                        className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] text-center space-y-2.5 cursor-pointer transition"
                      >
                        <img
                          src={a.avatar || DEFAULT_AVATAR_SVG}
                          alt={a.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-full object-cover mx-auto border border-[var(--border)]"
                        />
                        <div>
                          <div className="text-xs font-bold text-[var(--text)] truncate">{a.name}</div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            {a.country || t('artist', 'Artist')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* PLAYLISTS */}
              {(activeCategory === 'all' || activeCategory === 'playlists') && matchedPlaylists.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-sm font-bold text-[var(--text)]">{t('playlists', 'Playlists')}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {matchedPlaylists.map((pl) => {
                      const resolved = (pl.trackIds || [])
                        .map((id) => publicTracks.find((tItem) => tItem.id === id))
                        .filter((x): x is Track => Boolean(x));
                      return (
                        <div
                          key={pl.id}
                          onClick={() => {
                            saveSearchTerm(debouncedQuery);
                            if (resolved.length > 0) {
                              playTrackList(resolved, 0);
                            } else {
                              navigate('/library');
                            }
                          }}
                          className="p-3.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between gap-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={pl.coverArt || resolved[0]?.coverArt || DEFAULT_ARTWORK_SVG}
                              alt={pl.name}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[var(--text)] truncate">{pl.name}</div>
                              <div className="text-xs text-[var(--text-muted)]">
                                {t('songs_count_label', `${pl.trackIds.length} songs`, {
                                  count: pl.trackIds.length,
                                })}{' '}
                                · {pl.creatorName}
                              </div>
                            </div>
                          </div>
                          {resolved.length > 0 && (
                            <span className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0">
                              <Play className="w-4 h-4 fill-current ml-0.5" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* GENRES */}
              {(activeCategory === 'all' || activeCategory === 'genres') && matchedGenres.length > 0 && (
                <section className="space-y-2.5">
                  <h2 className="text-sm font-bold text-[var(--text)]">
                    {isNy ? 'Ma Alubamu & Mitundu' : 'Albums & Genres'}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {matchedGenres.map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => navigate(`/discover?genre=${encodeURIComponent(g.name)}`)}
                        className="px-4 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer"
                      >
                        {translateGenreCategory(g.name, language)} ({g.count})
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
