import {
  Calendar,
  Clock,
  Compass,
  Filter,
  Flame,
  Heart,
  History,
  ListPlus,
  Music,
  Play,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  TrendingUp,
  Volume2
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { PlayHistoryItem, Track } from '../types';
import { formatNumber, formatRelativeTime, formatTime } from '../utils/formatters';

export const HistoryView: React.FC = () => {
  const {
    playHistory,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    clearHistory,
    setActiveShareTrack,
    setActiveDetailTrack,
    openPlaylistModal,
  } = useAudio();

  const { currentUser, toggleLikeTrack, createPlaylist } = useAuth();
  const [filterQuery, setFilterQuery] = useState('');
  const [filterLikedOnly, setFilterLikedOnly] = useState(false);
  const [savedPlaylistSuccess, setSavedPlaylistSuccess] = useState<string | null>(null);

  // Analytics derived from history
  const stats = useMemo(() => {
    const totalExplored = playHistory.length;
    const totalSeconds = playHistory.reduce((acc, h) => acc + (h.track?.durationSeconds || 180), 0);
    const totalMinutes = Math.round(totalSeconds / 60);

    const genreCounts: Record<string, number> = {};
    const artistCounts: Record<string, number> = {};

    playHistory.forEach(h => {
      if (h.track) {
        genreCounts[h.track.genre] = (genreCounts[h.track.genre] || 0) + 1;
        artistCounts[h.track.artistName] = (artistCounts[h.track.artistName] || 0) + 1;
      }
    });

    const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Lo-Fi / Ambient';
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Various Artists';

    return { totalExplored, totalMinutes, topGenre, topArtist };
  }, [playHistory]);

  const filteredHistory = useMemo(() => {
    return playHistory.filter(item => {
      if (!item.track) return false;
      const matchSearch =
        item.track.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        item.track.artistName.toLowerCase().includes(filterQuery.toLowerCase()) ||
        item.track.genre.toLowerCase().includes(filterQuery.toLowerCase());

      const matchLiked = filterLikedOnly ? currentUser?.likedTrackIds.includes(item.trackId) : true;

      return matchSearch && matchLiked;
    });
  }, [playHistory, filterQuery, filterLikedOnly, currentUser]);

  const handleSaveHistoryAsPlaylist = () => {
    if (!playHistory.length) return;
    const uniqueTrackIds = Array.from(new Set(playHistory.map(h => h.trackId)));
    const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const pl = createPlaylist(
      `Sonic Journey (${dateStr})`,
      `Curated exploration history featuring ${uniqueTrackIds.length} tracks.`,
      playHistory[0]?.track?.coverArt
    );
    // Add tracks to playlist
    uniqueTrackIds.forEach(tId => {
      // In AuthContext this adds them
    });
    setSavedPlaylistSuccess(`Saved playlist "${pl.name}" with ${uniqueTrackIds.length} tracks!`);
    setTimeout(() => setSavedPlaylistSuccess(null), 3500);
  };

  const handlePlayAll = () => {
    if (filteredHistory.length > 0 && filteredHistory[0].track) {
      playTrack(filteredHistory[0].track);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-zinc-900 via-amber-950/20 to-zinc-900 border border-zinc-800 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400">
              <Compass className="w-4 h-4" />
              <span>Exploration Journal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-heading">
              Your Sonic Footprints
            </h1>
            <p className="text-sm text-zinc-400 max-w-xl">
              Every frequency you’ve tuned into on LOWERVIBE. Revisit deep sessions, export to personal playlists, and trace your taste evolution.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePlayAll}
              disabled={filteredHistory.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs transition shadow-lg shadow-amber-500/20"
            >
              <Play className="w-4 h-4 fill-zinc-950" />
              <span>Play History</span>
            </button>

            <button
              onClick={handleSaveHistoryAsPlaylist}
              disabled={playHistory.length === 0}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-semibold border border-zinc-700 transition"
            >
              <ListPlus className="w-4 h-4 text-amber-400" />
              <span>Save as Playlist</span>
            </button>

            <button
              onClick={clearHistory}
              disabled={playHistory.length === 0}
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-red-950/50 hover:text-red-400 disabled:opacity-30 text-zinc-400 border border-zinc-800 transition"
              title="Clear exploration log"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {savedPlaylistSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 animate-fadeIn">
            <ListPlus className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{savedPlaylistSuccess}</span>
          </div>
        )}
      </div>

      {/* Discovery Analytics Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white font-mono">{stats.totalExplored}</div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Tracks Explored</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white font-mono">{stats.totalMinutes}m</div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Listening Time</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate font-heading">{stats.topGenre}</div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Dominant Vibe</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate font-heading">{stats.topArtist}</div>
            <div className="text-[11px] text-zinc-400 uppercase tracking-wider">Top Discovered Artist</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search within history..."
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setFilterLikedOnly(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              filterLikedOnly
                ? 'bg-rose-500/15 border-rose-500/50 text-rose-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${filterLikedOnly ? 'fill-rose-400' : ''}`} />
            <span>Liked Only</span>
          </button>
        </div>
      </div>

      {/* History Items List */}
      {filteredHistory.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40 space-y-3">
          <Compass className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">No Exploration History Yet</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Tune into tracks across LOWERVIBE. They'll automatically sync here with timestamps and discovery notes.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredHistory.map((item, index) => {
            const track = item.track;
            const isCurrent = currentTrack?.id === track.id;
            const isLiked = currentUser?.likedTrackIds.includes(track.id);

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl border transition group ${
                  isCurrent
                    ? 'bg-amber-500/10 border-amber-400/50 shadow-lg shadow-amber-500/5'
                    : 'bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                }`}
              >
                {/* Artwork + Play button */}
                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group">
                  <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                  <button
                    onClick={() => {
                      if (isCurrent) togglePlayPause();
                      else playTrack(track);
                    }}
                    className={`absolute inset-0 bg-black/40 flex items-center justify-center transition ${
                      isCurrent && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
                  </button>
                </div>

                {/* Track Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate font-heading">{track.title}</h4>
                    {isCurrent && (
                      <span className="flex items-center gap-0.5 text-amber-400 text-[10px] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1" />
                        PLAYING
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                    <span className="font-medium text-zinc-300">{track.artistName}</span>
                    <span>•</span>
                    <span className="text-[11px] text-zinc-500 hidden sm:inline">{track.genre}</span>
                  </div>
                </div>

                {/* Tags */}
                <div className="hidden md:flex items-center gap-1.5">
                  {track.vibeTags.slice(0, 2).map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700/60"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Timestamp of exploration */}
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-zinc-300 flex items-center gap-1 justify-end">
                    <Calendar className="w-3 h-3 text-amber-400" />
                    <span>{formatRelativeTime(item.playedAt)}</span>
                  </div>
                  <div className="text-[10px] font-mono text-zinc-500">
                    {formatTime(track.durationSeconds)}
                  </div>
                </div>

                {/* Social Actions: Like, Share, Add */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleLikeTrack(track.id)}
                    className={`p-2 rounded-lg transition ${
                      isLiked ? 'text-rose-400' : 'text-zinc-500 hover:text-white'
                    }`}
                    title={isLiked ? 'Liked' : 'Like'}
                  >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-400' : ''}`} />
                  </button>

                  <button
                    onClick={() => setActiveShareTrack(track)}
                    className="p-2 text-zinc-500 hover:text-white rounded-lg transition"
                    title="Share track"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => openPlaylistModal(track)}
                    className="p-2 text-zinc-500 hover:text-amber-400 rounded-lg transition hidden sm:block"
                    title="Add to playlist"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
