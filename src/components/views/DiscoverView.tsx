import {
  ArrowUpDown,
  Bookmark,
  Compass,
  Flame,
  Heart,
  LayoutGrid,
  LayoutList,
  Music,
  Play,
  RotateCcw,
  Search,
  Sliders,
  Sparkles,
  Tag,
  Volume2,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { MACRO_REGIONS, matchesLocationFilter, WORLD_REGIONS } from '../../data/regions';
import { getTrendingGenres, subscribeToFirestoreGenres } from '../../services/genresService';
import { FirestoreGenre, GenreSortMode, Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { formatTime, getTrackLikeCount, isTrackLikedByUser } from '../../utils/formatters';
import { TrackRowSkeleton } from '../common/LoadingSkeleton';

interface DiscoverViewProps {
  onSelectArtist: (artistId: string) => void;
  onOpenTrackDetails: (track: Track) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  onSelectArtist,
  onOpenTrackDetails,
}) => {
  const {
    tracks,
    isCatalogLoaded,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    featuredVibe,
    toggleSaveTrack,
    selectedCountry,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();
  const { searchParams } = useRouter();

  const [activeTab, setActiveTab] = useState<'all' | 'charts' | 'chill' | 'rising' | 'verified'>('all');
  const [viewMode, setViewMode] = useState<'rows' | 'grid'>('rows');
  const [animatingHeartTrackId, setAnimatingHeartTrackId] = useState<string | null>(null);

  const [firestoreGenres, setFirestoreGenres] = useState<FirestoreGenre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [genreFilterBehavior, setGenreFilterBehavior] = useState<'prioritize_sort' | 'strict_filter'>('prioritize_sort');
  const [genreSortMode, setGenreSortMode] = useState<GenreSortMode>('genre_priority');

  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [bpmRange, setBpmRange] = useState<'all' | 'chill' | 'mid' | 'groove'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [displayCount, setDisplayCount] = useState(8);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    const genreParam = searchParams.get('genre') || searchParams.get('category');
    if (genreParam) {
      setSelectedGenre(genreParam);
    }
    const tabParam = searchParams.get('tab');
    if (tabParam && ['all', 'charts', 'chill', 'rising', 'verified'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
    const moodParam = searchParams.get('mood');
    if (moodParam) {
      setSelectedMood(moodParam);
    }
    const regionParam = searchParams.get('region');
    if (regionParam) {
      setSelectedRegion(regionParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const unsub = subscribeToFirestoreGenres(
      (loadedGenres) => {
        setFirestoreGenres(loadedGenres);
      },
      (error) => {
        console.warn('Failed to stream genres from Firestore:', error);
      }
    );
    return () => unsub();
  }, []);

  const publicTracks = useMemo(
    () => tracks.filter((t) => !t.isDraft && !t.isDeranked),
    [tracks]
  );

  const featuredRecord = useMemo(() => {
    return publicTracks.find((t) => t.id === featuredVibe.trackId) || publicTracks[0];
  }, [publicTracks, featuredVibe]);

  const rankedGenres = useMemo(
    () => getTrendingGenres(firestoreGenres, selectedCountry),
    [firestoreGenres, selectedCountry]
  );

  const allAvailableGenres = useMemo(() => {
    const fromFirestore = rankedGenres.map((g) => g.name);
    const fromTracks = publicTracks.map((t) => t.genre).filter(Boolean);
    const merged = Array.from(new Set([...fromFirestore, ...fromTracks]));
    return ['all', ...merged];
  }, [rankedGenres, publicTracks]);

  const moods = useMemo(() => {
    const list = Array.from(new Set(publicTracks.map((t) => t.mood).filter(Boolean)));
    return ['all', ...(list as string[])];
  }, [publicTracks]);

  const currentGenreMeta = useMemo(() => {
    if (selectedGenre === 'all') return null;
    return (
      firestoreGenres.find((g) => g.name.toLowerCase() === selectedGenre.toLowerCase()) || {
        id: selectedGenre.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        name: selectedGenre,
        description: `Songs tagged under ${selectedGenre}.`,
        trackCount: publicTracks.filter((t) => t.genre.toLowerCase() === selectedGenre.toLowerCase()).length,
        isFeatured: false,
        icon: '🎵',
      }
    );
  }, [selectedGenre, firestoreGenres, publicTracks]);

  const sortedAndFilteredTracks = useMemo(() => {
    const list = publicTracks.filter((t) => {
      if (
        activeTab === 'chill' &&
        !t.genre.toLowerCase().includes('chill') &&
        !t.genre.toLowerCase().includes('ambient') &&
        !t.vibeTags.some((v) => v.toLowerCase().includes('chill') || v.toLowerCase().includes('ambient'))
      ) {
        return false;
      }
      if (activeTab === 'rising' && (t.plays || 0) > 100) return false;
      if (activeTab === 'verified' && !t.isCertified) return false;

      if (selectedGenre !== 'all' && genreFilterBehavior === 'strict_filter') {
        const matchesExactGenre = t.genre.toLowerCase() === selectedGenre.toLowerCase();
        const matchesTag = t.vibeTags.some((tag) => tag.toLowerCase() === selectedGenre.toLowerCase());
        if (!matchesExactGenre && !matchesTag) return false;
      }

      if (selectedMood !== 'all' && t.mood !== selectedMood) return false;
      if (selectedRegion !== 'all' && !matchesLocationFilter(t.region, selectedRegion)) return false;

      if (bpmRange === 'chill' && t.bpm >= 80) return false;
      if (bpmRange === 'mid' && (t.bpm < 80 || t.bpm > 105)) return false;
      if (bpmRange === 'groove' && t.bpm <= 105) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.artistName.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          (t.region && t.region.toLowerCase().includes(q))
        );
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const aMatchesGenre =
        selectedGenre !== 'all' &&
        (a.genre.toLowerCase() === selectedGenre.toLowerCase() ||
          a.vibeTags.some((v) => v.toLowerCase() === selectedGenre.toLowerCase()));
      const bMatchesGenre =
        selectedGenre !== 'all' &&
        (b.genre.toLowerCase() === selectedGenre.toLowerCase() ||
          b.vibeTags.some((v) => v.toLowerCase() === selectedGenre.toLowerCase()));

      if (selectedGenre !== 'all' && (genreFilterBehavior === 'prioritize_sort' || genreSortMode === 'genre_priority')) {
        if (aMatchesGenre && !bMatchesGenre) return -1;
        if (!aMatchesGenre && bMatchesGenre) return 1;
      }

      if (genreSortMode === 'most_played') return (b.plays || 0) - (a.plays || 0);
      if (genreSortMode === 'newest') return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
      if (genreSortMode === 'bpm_asc') return (a.bpm || 0) - (b.bpm || 0);
      if (genreSortMode === 'bpm_desc') return (b.bpm || 0) - (a.bpm || 0);
      if (genreSortMode === 'title_asc') return a.title.localeCompare(b.title);
      if (genreSortMode === 'duration_desc') return (b.durationSeconds || 0) - (a.durationSeconds || 0);

      if (aMatchesGenre && bMatchesGenre) return (b.plays || 0) - (a.plays || 0);
      return 0;
    });
  }, [publicTracks, activeTab, selectedGenre, genreFilterBehavior, genreSortMode, selectedMood, selectedRegion, bpmRange, searchFilter]);

  const topPlayedTracks = useMemo(
    () => [...publicTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 5),
    [publicTracks]
  );

  const mostLikedTracks = useMemo(
    () => [...publicTracks].sort((a, b) => getTrackLikeCount(b) - getTrackLikeCount(a)).slice(0, 5),
    [publicTracks]
  );

  const newestTracks = useMemo(
    () => [...publicTracks].sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()).slice(0, 5),
    [publicTracks]
  );

  const visibleTracks = sortedAndFilteredTracks.slice(0, displayCount);
  const hasMore = displayCount < sortedAndFilteredTracks.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((prev) => prev + 6);
      setIsLoadingMore(false);
    }, 200);
  };

  const handleToggleLikeTrack = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (!currentUser) {
      toggleLikeTrack(track.id);
      return;
    }
    const isLiked = currentUser?.likedTrackIds?.includes(track.id);
    toggleLikeTrack(track.id);
    toggleSaveTrack(track.id);
    if (!isLiked) {
      setAnimatingHeartTrackId(track.id);
      setTimeout(() => {
        setAnimatingHeartTrackId((prev) => (prev === track.id ? null : prev));
      }, 700);
      showToast(`Added "${track.title}" to your library`);
    } else {
      showToast(`Removed "${track.title}" from your library`);
    }
  };

  const handleResetFilters = () => {
    setSelectedGenre('all');
    setGenreSortMode('genre_priority');
    setGenreFilterBehavior('prioritize_sort');
    setSelectedMood('all');
    setSelectedRegion('all');
    setBpmRange('all');
    setSearchFilter('');
    setActiveTab('all');
    showToast('Filters reset');
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent-text)] font-bold">
            Discover · {publicTracks.length} songs
          </span>
          <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-[var(--text)] mt-1">
            Discover Music
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Browse independent songs by genre, mood, city, and tempo.
          </p>
        </div>

        {/* Search Input Filter & View Mode Switcher */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter title, artist, country..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition"
            />
          </div>

          <div className="flex items-center p-1 rounded-full bg-[var(--surface)] border border-[var(--border)] shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('rows')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                viewMode === 'rows'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
              title="List view"
              aria-label="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Featured Pick */}
      {featuredRecord && (
        <div className="relative rounded-3xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-sm">
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6">
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden shrink-0 border border-[var(--border)] shadow-md group">
              <img
                src={featuredRecord.coverArt || DEFAULT_ARTWORK_SVG}
                alt={featuredRecord.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <button
                type="button"
                onClick={() => playTrack(featuredRecord)}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                aria-label={`Play ${featuredRecord.title}`}
              >
                <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-lg">
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                </div>
              </button>
            </div>

            <div className="space-y-3 flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/30 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Featured Pick</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {featuredRecord.region || 'Global'}
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black font-heading text-[var(--text)] tracking-tight">
                  {featuredRecord.title}
                </h2>
                <button
                  type="button"
                  onClick={() => onSelectArtist(featuredRecord.artistId)}
                  className="text-sm font-bold text-[var(--text-muted)] hover:text-[var(--accent-text)] transition cursor-pointer"
                >
                  {featuredRecord.artistName}
                </button>
              </div>

              {featuredVibe?.curatorNote && (
                <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] leading-relaxed">
                  <div className="text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1">
                    Curator Note · {featuredVibe.curatorName}
                  </div>
                  <p>"{featuredVibe.curatorNote}"</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    currentTrack?.id === featuredRecord.id ? togglePlayPause() : playTrack(featuredRecord)
                  }
                  className="px-6 py-3 rounded-full font-bold text-xs text-[var(--accent-contrast)] bg-[var(--accent)] hover:brightness-105 transition shadow-sm flex items-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                  <span>{currentTrack?.id === featuredRecord.id && isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleToggleLikeTrack(e, featuredRecord)}
                  className="px-4 py-3 rounded-full bg-[var(--surface-2)] hover:border-[var(--border-strong)] text-[var(--text)] text-xs font-bold border border-[var(--border)] transition flex items-center gap-2 cursor-pointer min-h-[44px]"
                >
                  <Bookmark className="w-4 h-4 text-[var(--accent-text)]" />
                  <span>Save</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenTrackDetails(featuredRecord)}
                  className="px-4 py-3 rounded-full bg-[var(--surface-2)] hover:border-[var(--border-strong)] text-[var(--text-muted)] hover:text-[var(--text)] text-xs font-bold border border-[var(--border)] transition cursor-pointer min-h-[44px]"
                >
                  Track info
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Genre Bar */}
      <div className="space-y-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Genres' },
            { id: 'charts', label: 'Charts' },
            { id: 'chill', label: 'Chill & Ambient' },
            { id: 'rising', label: 'Rising Artists' },
            { id: 'verified', label: 'Verified Uploads' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition min-h-[44px] cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Genre & Sorting Controls */}
        <div className="space-y-4 rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[var(--border)]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-text)] font-bold">
                  Trending genres {selectedCountry && selectedCountry !== 'Global' ? `(${selectedCountry})` : '(Global)'}
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  · {rankedGenres.length} genres
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black font-heading text-[var(--text)] tracking-tight mt-1">
                Explore sounds &amp; moods
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs">
                <button
                  type="button"
                  onClick={() => setGenreFilterBehavior('prioritize_sort')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    genreFilterBehavior === 'prioritize_sort'
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Sort to Top
                </button>
                <button
                  type="button"
                  onClick={() => setGenreFilterBehavior('strict_filter')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    genreFilterBehavior === 'strict_filter'
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Filter Only
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" />
                <select
                  value={genreSortMode}
                  onChange={(e) => setGenreSortMode(e.target.value as GenreSortMode)}
                  className="bg-transparent text-[var(--text)] text-xs font-semibold focus:outline-none cursor-pointer pr-1"
                  title="Sort songs"
                >
                  <option value="genre_priority">Sort: Genre Match First</option>
                  <option value="most_played">Sort: Most Played</option>
                  <option value="newest">Sort: Newest Releases</option>
                  <option value="bpm_asc">Sort: BPM (Low to High)</option>
                  <option value="bpm_desc">Sort: BPM (High to Low)</option>
                  <option value="title_asc">Sort: Title (A-Z)</option>
                  <option value="duration_desc">Sort: Duration (Longest)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Genre Chips Carousel */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedGenre('all')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer border ${
                selectedGenre === 'all'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                  : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border-[var(--border)]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>All Genres</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-black/15">
                {publicTracks.length}
              </span>
            </button>

            {rankedGenres.map((g) => {
              const isSelected = selectedGenre.toLowerCase() === g.name.toLowerCase();
              const matchingCount = publicTracks.filter(
                (t) =>
                  t.genre.toLowerCase() === g.name.toLowerCase() ||
                  t.vibeTags.some((tag) => tag.toLowerCase() === g.name.toLowerCase())
              ).length;

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGenre(isSelected ? 'all' : g.name)}
                  className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 shrink-0 cursor-pointer border ${
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                      : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  <Tag className={`w-3.5 h-3.5 ${isSelected ? 'text-[var(--accent-contrast)]' : 'text-[var(--accent-text)]'}`} />
                  <span>{g.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums opacity-75">
                    {matchingCount || g.trackCount}
                  </span>
                </button>
              );
            })}
          </div>

          {currentGenreMeta && (
            <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--accent)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl p-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] shrink-0">
                  {currentGenreMeta.icon || '🎵'}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-[var(--text)] font-heading">
                      {currentGenreMeta.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--accent)]/15 text-[var(--accent-text)]">
                      {genreFilterBehavior === 'strict_filter' ? 'Filtered' : 'Top matches'}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] text-xs line-clamp-1 mt-0.5">
                    {currentGenreMeta.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedGenre('all')}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] font-bold flex items-center gap-1.5 cursor-pointer text-xs self-start sm:self-auto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Genre</span>
              </button>
            </div>
          )}

          {/* Secondary Filters Bar */}
          <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">Genre</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {allAvailableGenres.map((g) => (
                  <option key={g} value={g}>{g === 'all' ? 'All Genres' : g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">Mood</label>
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                {moods.map((m) => (
                  <option key={m} value={m}>{m === 'all' ? 'All Moods' : m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">
                Country ({WORLD_REGIONS.length})
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Countries</option>
                {MACRO_REGIONS.map((macro) => (
                  <optgroup key={macro} label={macro}>
                    {WORLD_REGIONS.filter((r) => r.macroRegion === macro).map((r) => (
                      <option key={r.code} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[var(--text-muted)] block mb-1">BPM Tempo</label>
              <select
                value={bpmRange}
                onChange={(e) => setBpmRange(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Tempos</option>
                <option value="chill">&lt; 80 BPM (Slow)</option>
                <option value="mid">80–105 BPM (Mid)</option>
                <option value="groove">105+ BPM (Fast)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Charts or Tracks Feed */}
      {activeTab === 'charts' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Most Played', icon: Flame, list: topPlayedTracks, metric: (t: Track) => `${t.plays || 0} plays` },
            { title: 'Most Liked', icon: Heart, list: mostLikedTracks, metric: (t: Track) => `${getTrackLikeCount(t)} likes` },
            { title: 'New Releases', icon: Sparkles, list: newestTracks, metric: (t: Track) => formatTime(t.durationSeconds) },
          ].map((col) => {
            const Icon = col.icon;
            return (
              <div key={col.title} className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
                  <Icon className="w-4 h-4 text-[var(--accent-text)]" />
                  <h3 className="text-sm font-black font-heading text-[var(--text)]">{col.title}</h3>
                </div>
                <div className="space-y-2">
                  {col.list.map((t, idx) => {
                    const isCurrent = currentTrack?.id === t.id;
                    const isLiked = isTrackLikedByUser(t, currentUser);
                    const isAnimating = animatingHeartTrackId === t.id;

                    return (
                      <div
                        key={t.id}
                        onClick={() => playTrack(t)}
                        className={`group/row flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--surface-2)] border-[var(--violet)]'
                            : 'border-transparent hover:bg-[var(--surface-2)] hover:border-[var(--border)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-xs font-mono font-bold text-[var(--accent-text)] w-5">0{idx + 1}</span>
                          <img
                            src={t.coverArt || DEFAULT_ARTWORK_SVG}
                            alt={t.title}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                            }}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[var(--text)] truncate group-hover/row:text-[var(--accent-text)] transition">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] truncate">{t.artistName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline tabular-nums">
                            {col.metric(t)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleToggleLikeTrack(e, t)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isLiked ? 'text-rose-500' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                            }`}
                            title={isLiked ? 'Unlike' : 'Like'}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''} ${isAnimating ? 'animate-heart-pop' : ''}`} />
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
      ) : (
        <div className="space-y-6">
          {!isCatalogLoaded && tracks.length === 0 ? (
            <div className="space-y-2.5">
              <TrackRowSkeleton />
              <TrackRowSkeleton />
              <TrackRowSkeleton />
              <TrackRowSkeleton />
            </div>
          ) : publicTracks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
              <Music className="w-10 h-10 text-[var(--accent-text)] mx-auto opacity-70" />
              <h3 className="text-base font-bold text-[var(--text)] font-heading">No songs uploaded yet</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Publish a song in Upload to start streaming.
              </p>
            </div>
          ) : visibleTracks.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
              <Music className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
              <h3 className="text-base font-bold text-[var(--text)] font-heading">No matching songs</h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Try clearing or changing your genre, mood, or tempo filters.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          ) : viewMode === 'rows' ? (
            <div className="space-y-2.5">
              {visibleTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isCurrentPlaying = isCurrent && isPlaying;
                const isLiked = isTrackLikedByUser(track, currentUser);
                const isAnimatingHeart = animatingHeartTrackId === track.id;
                const matchesSelectedGenre =
                  selectedGenre !== 'all' &&
                  (track.genre.toLowerCase() === selectedGenre.toLowerCase() ||
                    track.vibeTags.some((v) => v.toLowerCase() === selectedGenre.toLowerCase()));

                return (
                  <div
                    key={track.id}
                    onClick={() => (isCurrent ? togglePlayPause() : playTrack(track))}
                    className={`group relative flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer ${
                      isCurrent
                        ? 'bg-[var(--surface-2)] border-[var(--violet)]'
                        : matchesSelectedGenre
                        ? 'bg-[var(--surface)] border-[var(--accent)]/60 hover:bg-[var(--surface-2)]'
                        : 'bg-[var(--surface)] hover:bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                      <div className="w-5 text-center text-xs font-mono text-[var(--text-muted)] shrink-0">
                        {isCurrentPlaying ? (
                          <div className="flex items-center justify-center gap-0.5 h-3">
                            <span className="w-0.5 bg-[var(--accent-text)] rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-[var(--accent-text)] rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-[var(--accent-text)] rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface-2)]">
                        <img
                          src={track.coverArt || DEFAULT_ARTWORK_SVG}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-[var(--text)] group-hover:text-[var(--accent-text)] transition truncate">
                            {track.title}
                          </h4>
                          {matchesSelectedGenre && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/30 shrink-0">
                              Match
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-0.5 truncate">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectArtist(track.artistId);
                            }}
                            className="hover:text-[var(--text)] transition truncate font-medium hover:underline text-left cursor-pointer"
                          >
                            {track.artistName}
                          </button>
                          <span className="opacity-40 hidden sm:inline">•</span>
                          <span className="text-[11px] hidden sm:inline">{track.genre}</span>
                          {track.region && (
                            <>
                              <span className="opacity-40 hidden md:inline">•</span>
                              <span className="text-[11px] text-[var(--accent-text)] hidden md:inline">{track.region}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-[var(--text-muted)] shrink-0">
                      <span className="hidden md:inline">{track.bpm} BPM</span>
                      <span>{formatTime(track.durationSeconds)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleLikeTrack(e, track)}
                        className={`px-2.5 py-2 rounded-xl transition min-h-[40px] flex items-center justify-center gap-1.5 cursor-pointer ${
                          isLiked
                            ? 'text-rose-500'
                            : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                        }`}
                        title={isLiked ? 'Unlike' : 'Like'}
                        aria-label="Like track"
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''} ${isAnimatingHeart ? 'animate-heart-pop' : ''}`} />
                        <span className="text-[11px] font-mono font-bold tabular-nums">
                          {getTrackLikeCount(track)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenTrackDetails(track)}
                        className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition hidden sm:flex items-center justify-center min-h-[40px] min-w-[40px] cursor-pointer"
                        title="Track details"
                      >
                        <Sliders className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => (isCurrent ? togglePlayPause() : playTrack(track))}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition cursor-pointer ${
                          isCurrentPlaying
                            ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                            : 'bg-[var(--surface-2)] hover:bg-[var(--accent)] text-[var(--text)] hover:text-[var(--accent-contrast)] border border-[var(--border)]'
                        }`}
                        title={isCurrentPlaying ? 'Pause' : 'Play'}
                      >
                        {isCurrentPlaying ? <Volume2 className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleTracks.map((track) => {
                const isCurrent = currentTrack?.id === track.id;
                const isCurrentPlaying = isCurrent && isPlaying;
                const isLiked = isTrackLikedByUser(track, currentUser);
                const isAnimatingHeart = animatingHeartTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track)}
                    className={`group relative p-4 rounded-3xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border transition cursor-pointer flex flex-col justify-between ${
                      isCurrent ? 'border-[var(--violet)]' : 'border-[var(--border)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div>
                      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[var(--surface-2)] mb-3 border border-[var(--border)]">
                        <img
                          src={track.coverArt || DEFAULT_ARTWORK_SVG}
                          alt={track.title}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        <button
                          type="button"
                          onClick={(e) => handleToggleLikeTrack(e, track)}
                          className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full backdrop-blur-md flex items-center justify-center transition cursor-pointer ${
                            isLiked
                              ? 'bg-rose-500/25 text-rose-400 border border-rose-500/40'
                              : 'bg-black/60 text-white hover:bg-black/80'
                          }`}
                          title={isLiked ? 'Unlike' : 'Like'}
                        >
                          <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''} ${isAnimatingHeart ? 'animate-heart-pop' : ''}`} />
                        </button>

                        <div
                          className={`absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-lg transition-transform duration-200 ${
                            isCurrentPlaying ? 'scale-100 opacity-100' : 'scale-90 opacity-0 group-hover:scale-100 group-hover:opacity-100'
                          }`}
                        >
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-black font-heading text-[var(--text)] truncate group-hover:text-[var(--accent-text)] transition-colors">
                            {track.title}
                          </h4>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                            {formatTime(track.durationSeconds)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectArtist(track.artistId);
                            }}
                            className="text-[var(--text-muted)] hover:text-[var(--accent-text)] truncate cursor-pointer text-left"
                          >
                            {track.artistName}
                          </button>
                          <span className="text-[10px] font-mono text-[var(--accent-text)]">{track.region || 'Global'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                      <span>{track.genre}</span>
                      <span>{track.bpm} BPM</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="px-8 py-3 rounded-full bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-xs font-bold transition cursor-pointer min-h-[44px]"
              >
                {isLoadingMore
                  ? 'Loading more songs...'
                  : `Load more songs (${sortedAndFilteredTracks.length - displayCount} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
