import {
  Award,
  BarChart3,
  Check,
  CheckCircle2,
  Compass,
  Download,
  Flame,
  Globe,
  Heart,
  MapPin,
  Music,
  Pause,
  Play,
  Search,
  Share2,
  ShieldCheck,
  Upload,
  UserCheck,
  Users
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Artist, Track } from '../types';
import { formatNumber, formatTime } from '../utils/formatters';

export const ArtistsView: React.FC = () => {
  const {
    artists,
    setIsArtistSubmitModalOpen,
    openAnalyticsModal,
    tracks,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    downloadTrack,
    activeDownload,
    setActiveShareTrack
  } = useAudio();

  const { currentUser, toggleFollowArtist } = useAuth();
  const { navigate } = useRouter();
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [sortBy, setSortBy] = useState<'popular' | 'followers' | 'releases'>('popular');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const genresList = useMemo(() => {
    const set = new Set<string>();
    artists.forEach(a => (a.genres || []).forEach(g => set.add(g)));
    return ['all', ...Array.from(set)];
  }, [artists]);

  const filteredArtists = useMemo(() => {
    const list = artists.filter(a => {
      const genres = a.genres || [];
      const matchSearch =
        (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.handle || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.location || '').toLowerCase().includes(search.toLowerCase()) ||
        genres.some(g => g.toLowerCase().includes(search.toLowerCase()));

      const matchGenre = selectedGenre === 'all' || genres.includes(selectedGenre);

      return matchSearch && matchGenre;
    });

    if (sortBy === 'followers') {
      list.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));
    } else if (sortBy === 'releases') {
      list.sort((a, b) => {
        const countA = tracks.filter(t => t.artistId === a.id || (t.artistName || '').toLowerCase() === (a.name || '').toLowerCase()).length;
        const countB = tracks.filter(t => t.artistId === b.id || (t.artistName || '').toLowerCase() === (b.name || '').toLowerCase()).length;
        return countB - countA;
      });
    } else {
      list.sort((a, b) => (b.monthlyListeners || 0) - (a.monthlyListeners || 0));
    }

    return list;
  }, [artists, search, selectedGenre, sortBy, tracks]);

  const handleDownloadTrack = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    setDownloadingId(track.id);
    downloadTrack(track);
    setTimeout(() => setDownloadingId(null), 2500);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-20 text-slate-900 dark:text-zinc-100">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 sm:p-10 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 rounded-full bg-lime-500 inline-block shrink-0 shadow-sm" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Verified Creators Directory
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black font-heading text-slate-900 dark:text-white tracking-tight">
              Featured Artists & Producers
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed font-normal">
              Explore master rights creators, Lilongwe & international beatmakers, and underground sound designers. Listen to verified releases, download master soundpacks, and connect directly.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <button
              onClick={() => setIsArtistSubmitModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Submit Artist Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-88">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search artists by name, city, handle, genre..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-emerald-500 shadow-2xs"
          />
        </div>

        {/* Sort & Genre Filters */}
        <div className="flex flex-wrap items-center gap-2.5 justify-between md:justify-end">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400">
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="popular">Most Popular</option>
              <option value="followers">Most Followers</option>
              <option value="releases">Catalog Works</option>
            </select>
          </div>

          {/* Genre Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-none">
            {genresList.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer ${
                  selectedGenre === g
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 border border-slate-200 dark:border-zinc-800'
                }`}
              >
                {g === 'all' ? 'All Genres' : g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Artists Upgraded Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArtists.map(artist => {
          const isFollowing = currentUser?.followingArtistIds.includes(artist.id);
          const artistTracks = tracks.filter(
            t => t.artistId === artist.id || t.artistName.toLowerCase() === artist.name.toLowerCase()
          );
          const topTracks = artistTracks.slice(0, 2);

          return (
            <div
              key={artist.id}
              className="group rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
            >
              {/* Card Banner */}
              <div
                onClick={() => navigate(`/artists/${artist.slug || artist.id}`)}
                className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-zinc-950 cursor-pointer"
              >
                <img
                  src={artist.banner}
                  alt={artist.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-zinc-900 via-transparent to-transparent" />

                {/* Top Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 shadow-sm flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span>VERIFIED</span>
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 pt-0 relative z-10 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  {/* Avatar & Header Row */}
                  <div className="flex items-end justify-between -mt-10 mb-3">
                    <div
                      onClick={() => navigate(`/artists/${artist.slug || artist.id}`)}
                      className="relative w-18 h-18 rounded-2xl overflow-hidden border-2 border-white dark:border-zinc-900 shadow-md bg-white dark:bg-zinc-950 shrink-0 cursor-pointer"
                    >
                      <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
                    </div>

                    {/* Follow Toggle */}
                    <button
                      onClick={() => toggleFollowArtist(artist.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm ${
                        isFollowing
                          ? 'bg-slate-100 dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <Heart className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Artist Identity */}
                  <div onClick={() => navigate(`/artists/${artist.slug || artist.id}`)} className="cursor-pointer">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate font-heading group-hover:text-emerald-600 transition-colors">
                        {artist.name}
                      </h3>
                      {artist.verified && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 fill-emerald-100 dark:fill-emerald-950" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5 flex-wrap">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{artist.handle}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {artist.location}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 mt-2 leading-relaxed">
                      {artist.bio}
                    </p>
                  </div>

                  {/* Artist Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-center">
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Followers</div>
                      <div className="text-xs font-black font-mono text-slate-900 dark:text-white">
                        {formatNumber(artist.followersCount + (isFollowing ? 1 : 0))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Monthly</div>
                      <div className="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatNumber(artist.monthlyListeners)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Releases</div>
                      <div className="text-xs font-black font-mono text-slate-900 dark:text-white">
                        {artistTracks.length}
                      </div>
                    </div>
                  </div>

                  {/* Top Tracks Inline Preview */}
                  {topTracks.length > 0 && (
                    <div className="mt-3.5 space-y-2">
                      <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                        Top Master Releases:
                      </div>
                      <div className="space-y-1.5">
                        {topTracks.map(tr => {
                          const isTrPlaying = currentTrack?.id === tr.id && isPlaying;
                          const isTrDownloading = downloadingId === tr.id || activeDownload?.trackId === tr.id;

                          return (
                            <div
                              key={tr.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/70 dark:bg-zinc-950/70 border border-slate-200/60 dark:border-zinc-800/80 hover:border-emerald-300 dark:hover:border-emerald-700 transition"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  onClick={() => {
                                    if (isTrPlaying) togglePlayPause();
                                    else playTrack(tr);
                                  }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition ${
                                    isTrPlaying
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200'
                                  }`}
                                  title={isTrPlaying ? 'Pause' : 'Play'}
                                >
                                  {isTrPlaying ? (
                                    <Pause className="w-3.5 h-3.5 fill-current" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                  )}
                                </button>
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[140px] sm:max-w-[170px]">
                                  {tr.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono text-slate-400">
                                  {formatTime(tr.durationSeconds)}
                                </span>
                                <button
                                  onClick={e => handleDownloadTrack(e, tr)}
                                  className={`p-1 rounded-lg transition cursor-pointer ${
                                    isTrDownloading
                                      ? 'bg-emerald-500 text-white animate-download-pulse'
                                      : 'text-slate-400 hover:text-emerald-600'
                                  }`}
                                  title={`Download ${tr.title}`}
                                >
                                  {isTrDownloading ? (
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/artists/${artist.slug || artist.id}`)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 text-xs font-bold transition text-center cursor-pointer"
                  >
                    View Visionary Page
                  </button>

                  <button
                    onClick={() => {
                      const firstTrack = artistTracks[0] || tracks[0];
                      if (firstTrack) setActiveShareTrack(firstTrack);
                    }}
                    className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 transition cursor-pointer"
                    title="Share Artist Catalog"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openAnalyticsModal(artist)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 hover:text-amber-500 dark:text-zinc-400 dark:hover:text-amber-400 transition cursor-pointer"
                    title="View Artist Analytics"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredArtists.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
          <Users className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-bold text-slate-800 dark:text-zinc-200">No artists found</h3>
          <p className="text-xs text-slate-500">Try modifying your search query or genre filter.</p>
        </div>
      )}
    </div>
  );
};
