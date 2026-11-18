import {
  Award,
  Check,
  Disc,
  Download,
  Flame,
  Headphones,
  Heart,
  Music,
  Pause,
  Play,
  Radio,
  Share2,
  Sparkles,
  TrendingUp,
  Upload,
  UserCheck,
  Users
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Track } from '../types';

export interface ExploreViewProps {
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  searchQuery?: string;
  onOpenArtistGate?: () => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  selectedCategory = 'all',
  onSelectCategory,
  searchQuery = '',
  onOpenArtistGate,
}) => {
  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    downloadTrack,
    activeDownload,
    setIsArtistSubmitModalOpen,
    setSelectedArtistModal,
    setActiveDetailTrack,
  } = useAudio();

  const { currentUser, toggleFollowArtist } = useAuth();
  const { t } = useLanguage();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleShareClick = () => {
    if (currentUser?.role === 'artist') {
      setIsArtistSubmitModalOpen(true);
    } else {
      onOpenArtistGate?.();
    }
  };

  const handleDownload = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    setDownloadingId(track.id);
    downloadTrack(track);
    setTimeout(() => setDownloadingId(null), 2500);
  };

  // Vibe Trends Data
  const vibeTrends = useMemo(() => [
    {
      id: 'afro-chill',
      title: 'Afro Chillout & Malawi Frequencies',
      icon: '🌴',
      badge: '🔥 #1 Trending • +148%',
      category: 'afro',
      streams: '124.5k streams',
      description: 'Warm organic rhythms, Lilongwe acoustic chords & lakeside breeze',
      bgGradient: 'from-emerald-500/10 via-lime-500/5 to-transparent',
      borderColor: 'border-emerald-300/80 dark:border-emerald-800',
    },
    {
      id: 'lofi-tape',
      title: 'Late Night Tape Delays & Dust',
      icon: '📼',
      badge: '✨ Viral Pick • 98k',
      category: 'throwbacks',
      streams: '98.4k streams',
      description: 'Analog tape saturation, dusty 4-track cassettes & vinyl warmth',
      bgGradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
      borderColor: 'border-amber-300/80 dark:border-amber-800',
    },
    {
      id: 'amapiano-heat',
      title: 'Amapiano Deep Log Drum Waves',
      icon: '🇿🇦',
      badge: '⚡ +210% Velocity',
      category: 'amapiano',
      streams: '186.2k streams',
      description: 'Hypnotic log drum baselines, private school keys & soulful vocal cuts',
      bgGradient: 'from-indigo-500/10 via-purple-500/5 to-transparent',
      borderColor: 'border-indigo-300/80 dark:border-indigo-800',
    },
    {
      id: 'rainy-study',
      title: 'Rainy Window Ambient & Focus',
      icon: '🌧️',
      badge: '🎧 Deep Focus',
      category: 'all',
      streams: '82.1k streams',
      description: 'Modular synthesizer drones, gentle tape noise & 432Hz spatial depth',
      bgGradient: 'from-cyan-500/10 via-sky-500/5 to-transparent',
      borderColor: 'border-cyan-300/80 dark:border-cyan-800',
    },
  ], []);

  const handlePlayVibe = (trendCategory: string) => {
    onSelectCategory?.(trendCategory);
    const match = tracks.find(t => {
      if (trendCategory === 'afro') return t.genre.toLowerCase().includes('afro') || t.genre.toLowerCase().includes('malawi');
      if (trendCategory === 'amapiano') return t.genre.toLowerCase().includes('amapiano');
      if (trendCategory === 'throwbacks') return t.bpm < 95;
      return true;
    });
    if (match) playTrack(match);
  };

  // Top 10 Music Chart ranked by chartRank / plays & downloads (Screenshot Feature)
  const top10ChartTracks = useMemo(() => {
    return [...tracks]
      .sort((a, b) => {
        if (a.chartRank && b.chartRank) return a.chartRank - b.chartRank;
        if (a.chartRank) return -1;
        if (b.chartRank) return 1;
        return (b.plays + (b.downloads || 0) * 2) - (a.plays + (a.downloads || 0) * 2);
      })
      .slice(0, 10);
  }, [tracks]);

  // Category filter pills matching the screenshot
  const filterPills = useMemo(() => [
    { id: 'all', label: 'All Tracks' },
    { id: 'top10', label: '🏆 Top 10' },
    { id: 'hot', label: '🔥 Hot Songs' },
    { id: 'new', label: '🆕 New Releases' },
    { id: 'throwbacks', label: '📼 Throwbacks' },
    { id: 'afro', label: '🌍 Afrobeats & Afro' },
    { id: 'hiphop', label: '🎤 Hip Hop & Trap' },
    { id: 'rnb', label: '💜 R&B & Neo-Soul' },
    { id: 'amapiano', label: '🇿🇦 Amapiano' },
  ], []);

  // Filtered and sorted tracks
  const filteredTracks = useMemo(() => {
    let result = [...tracks];

    // Category filter
    if (selectedCategory === 'top10') {
      result = top10ChartTracks;
    } else if (selectedCategory === 'hot') {
      result.sort((a, b) => b.plays - a.plays);
    } else if (selectedCategory === 'new') {
      result.sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime());
    } else if (selectedCategory === 'throwbacks') {
      result = result.filter(t => t.bpm < 95 || t.vibeTags.some(tag => tag.toLowerCase().includes('boom bap') || tag.toLowerCase().includes('tape')));
    } else if (selectedCategory === 'afro') {
      result = result.filter(
        t =>
          t.genre.toLowerCase().includes('afro') ||
          t.genre.toLowerCase().includes('malawi') ||
          t.vibeTags.some(tag => tag.toLowerCase().includes('afro') || tag.toLowerCase().includes('lagos'))
      );
    } else if (selectedCategory === 'hiphop') {
      result = result.filter(
        t =>
          t.genre.toLowerCase().includes('hip hop') ||
          t.genre.toLowerCase().includes('trap') ||
          t.genre.toLowerCase().includes('boom bap')
      );
    } else if (selectedCategory === 'rnb') {
      result = result.filter(
        t =>
          t.genre.toLowerCase().includes('r&b') ||
          t.genre.toLowerCase().includes('soul')
      );
    } else if (selectedCategory === 'amapiano') {
      result = result.filter(
        t =>
          t.genre.toLowerCase().includes('amapiano') ||
          t.vibeTags.some(tag => tag.toLowerCase().includes('log drum') || tag.toLowerCase().includes('amapiano'))
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        t =>
          t.title.toLowerCase().includes(q) ||
          t.artistName.toLowerCase().includes(q) ||
          t.genre.toLowerCase().includes(q) ||
          t.vibeTags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    return result;
  }, [tracks, selectedCategory, searchQuery, top10ChartTracks]);

  return (
    <div className="space-y-8 animate-fadeIn pb-16 text-slate-900 dark:text-zinc-100">
      {/* SECTION 1: TOP 10 MUSIC CHART (Exact Screenshot Match) */}
      {!searchQuery && selectedCategory === 'all' && (
        <section className="space-y-3.5 pt-1">
          {/* Section Header with Lime/Green Accent Bar */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-6 rounded-full bg-lime-500 inline-block shrink-0 shadow-sm" />
                <h2 className="text-2xl sm:text-3xl font-black font-heading text-slate-900 dark:text-white tracking-tight">
                  Top 10 Music Chart
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium ml-4 mt-0.5">
                Ranked by plays and downloads
              </p>
            </div>

            {/* Quick Upload Action */}
            <button
              onClick={handleShareClick}
              className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Submit for Chart</span>
            </button>
          </div>

          {/* Horizontal Scroll Chart Cards */}
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
            {top10ChartTracks.map((track, idx) => {
              const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;
              const isTrackDownloading = downloadingId === track.id || activeDownload?.trackId === track.id;
              const badgeStyle =
                idx === 0
                  ? 'bg-amber-400 text-amber-950 font-black'
                  : idx === 1
                  ? 'bg-slate-300 text-slate-800 font-black'
                  : idx === 2
                  ? 'bg-amber-700 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 font-bold dark:bg-zinc-800 dark:text-zinc-300';

              return (
                <div
                  key={track.id}
                  onClick={() => {
                    if (isCurrentPlaying) togglePlayPause();
                    else playTrack(track);
                  }}
                  className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-3.5 min-w-[175px] max-w-[175px] sm:min-w-[195px] sm:max-w-[195px] shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer shrink-0 snap-start active:scale-98"
                >
                  {/* Rank Badge */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1">
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs shadow-sm ${badgeStyle}`}>
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Artwork with Play Overlay */}
                  <div className="relative w-full h-40 sm:h-44 rounded-2xl overflow-hidden mb-3 bg-slate-100 dark:bg-zinc-800">
                    <img
                      src={track.coverArt}
                      alt={track.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-transform ${isCurrentPlaying ? 'bg-emerald-600 scale-105' : 'bg-black/60 group-hover:scale-110'}`}>
                        {isCurrentPlaying ? (
                          <Pause className="w-4 h-4 fill-white" />
                        ) : (
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Track Meta */}
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate leading-tight group-hover:text-emerald-600 transition-colors">
                    {track.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {track.artistName}
                  </p>

                  {/* Stats Pill & Quick Download */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-0.5">
                        <Play className="w-3 h-3 fill-emerald-600 inline" />
                        {track.plays}
                      </span>
                      <span className="text-slate-300 dark:text-zinc-700">•</span>
                      <span className="flex items-center gap-0.5">
                        <Download className="w-3 h-3 inline" />
                        {track.downloads || 0}
                      </span>
                    </div>

                    <button
                      onClick={e => handleDownload(e, track)}
                      className={`p-1 rounded-full transition ${isTrackDownloading ? 'bg-emerald-500 text-white animate-download-pulse' : 'hover:bg-emerald-100 dark:hover:bg-emerald-950/60'}`}
                      title="Download Song Master"
                    >
                      {isTrackDownloading ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <Download className="w-3 h-3 text-emerald-600" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2: VIBE TRENDS (Requested Feature) */}
      {!searchQuery && (
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-6 rounded-full bg-lime-500 inline-block shrink-0 shadow-sm" />
              <div>
                <h2 className="text-xl sm:text-2xl font-black font-heading text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Vibe Trends</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono font-bold">
                    LIVE
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
                  Real-time sonic momentum & trending aesthetics
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {vibeTrends.map(vibe => (
              <div
                key={vibe.id}
                onClick={() => handlePlayVibe(vibe.category)}
                className={`group relative p-4 rounded-3xl bg-gradient-to-br ${vibe.bgGradient} bg-white dark:bg-zinc-900 border ${vibe.borderColor} shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{vibe.icon}</span>
                    <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-full bg-white/80 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 shadow-2xs">
                      {vibe.badge}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading group-hover:text-emerald-600 transition-colors">
                    {vibe.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {vibe.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {vibe.streams}
                  </span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handlePlayVibe(vibe.category);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm active:scale-95 transition"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Play Vibe</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: ALL TRACKS (Exact Screenshot Match) */}
      <section className="space-y-4 pt-3">
        {/* Section Header with Lime/Green Accent Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-6 rounded-full bg-lime-500 inline-block shrink-0 shadow-sm" />
            <h2 className="text-2xl sm:text-3xl font-black font-heading text-slate-900 dark:text-white tracking-tight">
              All Tracks
            </h2>
          </div>

          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
            {filteredTracks.length} tracks available
          </span>
        </div>

        {/* Category Filter Pills (From Screenshot) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {filterPills.map(pill => {
            const isActive = selectedCategory === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => onSelectCategory?.(pill.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-sm'
                    : 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Subtitle instructions matching screenshot */}
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
          Click play to stream or the ↓ button to download
        </p>

        {/* Track List Matching Screenshot Row Design */}
        <div className="space-y-3">
          {filteredTracks.map(track => {
            const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;
            const isDownloading = downloadingId === track.id || activeDownload?.trackId === track.id;

            return (
              <div
                key={track.id}
                onClick={() => {
                  if (isCurrentPlaying) togglePlayPause();
                  else playTrack(track);
                }}
                className={`group bg-white dark:bg-zinc-900 border rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${
                  isCurrentPlaying
                    ? 'border-emerald-500/70 shadow-md ring-1 ring-emerald-500/20'
                    : 'border-slate-200/90 dark:border-zinc-800'
                }`}
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden shadow-sm shrink-0 bg-slate-100 dark:bg-zinc-800">
                    <img
                      src={track.coverArt}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {isCurrentPlaying && (
                      <div className="absolute inset-0 bg-emerald-900/45 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-white shadow" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition-colors">
                        {track.title}
                      </h4>
                      {track.chartRank && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-amber-950 shrink-0">
                          #{track.chartRank}
                        </span>
                      )}
                      {track.isCertified && (
                        <span className="hidden sm:inline px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          CERTIFIED
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5 font-medium">
                      {track.artistName}
                    </p>

                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 mt-1">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                        <Play className="w-3 h-3 fill-emerald-600 inline" />
                        {track.plays} plays
                      </span>
                      <span className="text-slate-300 dark:text-zinc-700">•</span>
                      <span>{track.downloads || 0} downloads</span>
                    </div>
                  </div>
                </div>

                {/* Right: Circular Green Play and Soft Green Download Buttons */}
                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0" onClick={e => e.stopPropagation()}>
                  {/* Circular Green Play Button */}
                  <button
                    onClick={() => {
                      if (isCurrentPlaying) togglePlayPause();
                      else playTrack(track);
                    }}
                    className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white shadow-md active:scale-95 transition cursor-pointer ${
                      isCurrentPlaying ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                    title={isCurrentPlaying ? 'Pause' : 'Play Stream'}
                  >
                    {isCurrentPlaying ? (
                      <Pause className="w-5 h-5 fill-white" />
                    ) : (
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    )}
                  </button>

                  {/* Circular Soft Green Download Button (Matching Screenshot) */}
                  <button
                    onClick={e => handleDownload(e, track)}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold active:scale-95 transition shadow-sm cursor-pointer ${
                      isDownloading
                        ? 'bg-emerald-500 text-white animate-download-pulse shadow-md shadow-emerald-500/30'
                        : 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300'
                    }`}
                    title={isDownloading ? 'Packaging Lossless Master...' : `Download ${track.title}`}
                  >
                    {isDownloading ? (
                      <Check className="w-4 h-4 text-white animate-scaleUp stroke-[2.5]" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredTracks.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-3">
            <Music className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-200">No tracks found in this category</h3>
            <p className="text-xs text-slate-500">Try selecting "All Tracks" or upload a certified song as an artist.</p>
          </div>
        )}
      </section>
    </div>
  );
};
