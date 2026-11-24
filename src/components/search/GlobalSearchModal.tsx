import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, ListMusic, Play, Search, Trash2, X } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import { formatTime } from '../../utils/formatters';
import { normalizeGenreCategory, translateGenreCategory } from '../../utils/genreCategories';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArtistProfile: (artistId: string) => void;
}

const RECENT_SEARCHES_KEY = 'lowervibe_recent_searches_v1';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

function fuzzyMatch(q: string, text: string): boolean {
  const cleanQ = q.trim().toLowerCase();
  const cleanT = (text || '').trim().toLowerCase();
  if (!cleanQ || !cleanT) return false;
  if (cleanT.includes(cleanQ)) return true;
  if (cleanQ.length < 3) return false;
  return cleanT
    .split(/[\s,._-]+/)
    .some((word) => Math.abs(word.length - cleanQ.length) <= 2 && levenshtein(cleanQ, word) <= 2);
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectArtistProfile,
}) => {
  const { tracks, artists, playlists, playTrack, playTrackList } = useAudio();
  const { currentUser, updateCurrentUser } = useAuth();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const { navigate } = useRouter();
  const [rawQuery, setRawQuery] = useState('');
  const [query, setQuery] = useState('');
  const [localRecent, setLocalRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser?.recentSearches) {
      setLocalRecent(currentUser.recentSearches);
      return;
    }
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      setLocalRecent(saved ? JSON.parse(saved) : []);
    } catch {
      setLocalRecent([]);
    }
  }, [currentUser?.recentSearches, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setRawQuery('');
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(rawQuery), 180);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const publicTracks = useMemo(
    () => tracks.filter((tItem) => !tItem.isDraft && !tItem.isDeranked),
    [tracks]
  );

  const catalogGenres = useMemo(() => {
    const counts = new Map<string, number>();
    publicTracks.forEach((tr) => {
      const norm = normalizeGenreCategory(tr.genre);
      if (norm && norm !== 'Other') counts.set(norm, (counts.get(norm) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
      .slice(0, 8);
  }, [publicTracks]);

  const recordSearch = (term: string) => {
    const clean = term.trim();
    if (clean.length < 2) return;
    const next = [clean, ...localRecent.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
    setLocalRecent(next);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {}
    if (currentUser) updateCurrentUser({ recentSearches: next });
  };

  const clearRecent = () => {
    setLocalRecent([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
    if (currentUser) updateCurrentUser({ recentSearches: [] });
  };

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return { tracks: [], artists: [], playlists: [], genres: [] as { name: string; count: number }[] };
    return {
      tracks: publicTracks
        .filter((tItem) => fuzzyMatch(q, `${tItem.title} ${tItem.artistName} ${tItem.genre}`))
        .slice(0, 6),
      artists: artists.filter((a) => fuzzyMatch(q, `${a.name} ${a.handle} ${(a.genres || []).join(' ')}`)).slice(0, 4),
      playlists: playlists
        .filter((p) => p.isPublic !== false && fuzzyMatch(q, `${p.name} ${p.genre || ''}`))
        .slice(0, 4),
      genres: catalogGenres.filter(
        (g) => fuzzyMatch(q, g.name) || fuzzyMatch(q, translateGenreCategory(g.name, language))
      ),
    };
  }, [query, publicTracks, artists, playlists, catalogGenres, language]);

  const hasAnyResult =
    results.tracks.length > 0 ||
    results.artists.length > 0 ||
    results.playlists.length > 0 ||
    results.genres.length > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center p-3 sm:p-6 pt-16 sm:pt-20 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[24px] bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--border)] flex items-center gap-3">
          <Search className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && rawQuery.trim()) {
                recordSearch(rawQuery);
                onClose();
                navigate(`/search?q=${encodeURIComponent(rawQuery.trim())}`);
              }
            }}
            placeholder={t('search_placeholder', 'Search songs, artists, playlists...')}
            className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close', 'Close')}
            className="p-2 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!query.trim() ? (
            <div className="space-y-5">
              {localRecent.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      {isNy ? 'Zomwe munafufuza posachedwa' : 'Recent searches'}
                    </span>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t('clear_history', 'Clear history')}</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {localRecent.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setRawQuery(term);
                          setQuery(term);
                        }}
                        className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] flex items-center gap-1.5 cursor-pointer hover:border-[var(--border-strong)]"
                      >
                        <Clock className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{term}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {catalogGenres.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[var(--text-muted)]">
                    {t('search_suggestions_heading', 'Try searching for')}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {catalogGenres.slice(0, 6).map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => {
                          setRawQuery(g.name);
                          setQuery(g.name);
                        }}
                        className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer hover:border-[var(--accent)]"
                      >
                        {translateGenreCategory(g.name, language)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/search');
                }}
                className="w-full py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer"
              >
                {isNy ? 'Tsegulani tsamba lonse lofufuzira' : 'Open full search page'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {!hasAnyResult ? (
                <div className="py-6 px-3 text-center space-y-4">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-[var(--text)]">
                      {t('search_no_match', 'Nothing matched your search yet.')}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {isNy
                        ? `Palibe chapezeka pa "${query}". Yesani imodzi mwa malingaliro awa:`
                        : `We could not find "${query}". Try one of these available genres or artists:`}
                    </p>
                  </div>

                  {catalogGenres.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {catalogGenres.slice(0, 5).map((g) => (
                        <button
                          key={g.name}
                          type="button"
                          onClick={() => {
                            setRawQuery(g.name);
                            setQuery(g.name);
                          }}
                          className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer hover:border-[var(--accent)]"
                        >
                          {translateGenreCategory(g.name, language)}
                        </button>
                      ))}
                    </div>
                  )}

                  {artists.slice(0, 3).length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {artists.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectArtistProfile(a.id);
                          }}
                          className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--accent-text)] font-semibold cursor-pointer"
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {results.genres.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[var(--text-muted)]">
                        {isNy ? 'Mitundu' : 'Genres'}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {results.genres.map((g) => (
                          <button
                            key={g.name}
                            type="button"
                            onClick={() => {
                              recordSearch(g.name);
                              onClose();
                              navigate(`/discover?genre=${encodeURIComponent(g.name)}`);
                            }}
                            className="px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer hover:border-[var(--accent)]"
                          >
                            {translateGenreCategory(g.name, language)} ({g.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.artists.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[var(--text-muted)]">
                        {t('artists', 'Artists')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.artists.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              recordSearch(query);
                              onClose();
                              onSelectArtistProfile(a.id);
                            }}
                            className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-2.5 text-left cursor-pointer hover:border-[var(--border-strong)]"
                          >
                            <img
                              src={a.avatar || DEFAULT_AVATAR_SVG}
                              alt={a.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text)] truncate">{a.name}</div>
                              <div className="text-[10px] text-[var(--text-muted)] truncate">
                                {a.country || (isNy ? 'Woimba' : 'Artist')}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.tracks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[var(--text-muted)]">
                        {t('songs', 'Songs')}
                      </div>
                      {results.tracks.map((tr) => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            recordSearch(query);
                            playTrack(tr);
                            onClose();
                          }}
                          className="w-full p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3 text-left cursor-pointer hover:border-[var(--border-strong)]"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={tr.coverArt || DEFAULT_ARTWORK_SVG}
                              alt={tr.title}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text)] truncate">{tr.title}</div>
                              <div className="text-[11px] text-[var(--text-muted)] truncate">{tr.artistName}</div>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                            {formatTime(tr.metadata?.Duration || tr.durationSeconds || 0)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {results.playlists.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-[var(--text-muted)]">
                        {t('playlists', 'Playlists')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.playlists.map((pl) => {
                          const resolved = (pl.trackIds || [])
                            .map((id) => publicTracks.find((tItem) => tItem.id === id))
                            .filter((x): x is NonNullable<typeof x> => Boolean(x));
                          return (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => {
                                recordSearch(query);
                                onClose();
                                if (resolved.length > 0) {
                                  playTrackList(resolved, 0);
                                } else {
                                  navigate('/library');
                                }
                              }}
                              className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-2.5 text-left cursor-pointer hover:border-[var(--border-strong)]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={pl.coverArt || resolved[0]?.coverArt || DEFAULT_ARTWORK_SVG}
                                  alt={pl.name}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-[var(--text)] truncate">{pl.name}</div>
                                  <div className="text-[10px] text-[var(--text-muted)] truncate flex items-center gap-1">
                                    <ListMusic className="w-3 h-3 shrink-0" />
                                    <span>{pl.trackIds.length}</span>
                                  </div>
                                </div>
                              </div>
                              {resolved.length > 0 && (
                                <Play className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0 fill-current" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      recordSearch(query);
                      onClose();
                      navigate(`/search?q=${encodeURIComponent(query)}`);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                  >
                    {isNy ? 'Onani zonse zopezeka' : 'See all results'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
