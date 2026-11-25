import {
  CheckCircle2,
  Download,
  FolderPlus,
  Globe,
  Heart,
  ListMusic,
  Loader2,
  Lock,
  Play,
  Plus,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { matchesLocationFilter } from '../data/regions';
import { getOfflineCacheStats } from '../services/audioStorage';
import { Playlist, Track } from '../types';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';
import { TrackRow } from './TrackRow';
import { GenreSelectOrCustom } from './common/GenreSelectOrCustom';
import { RegionSelect } from './common/RegionSelect';

export const PlaylistsView: React.FC = () => {
  const {
    tracks,
    playTrack,
    playlists,
    selectedCountry,
    createPublicPlaylist,
    toggleLikePlaylist,
    recordPlaylistPlay,
    upsertGenre,
    activeBatchDownload,
    downloadPlaylistOffline,
    removeTracksOfflineBatch,
  } = useAudio();
  const { currentUser, createPlaylist } = useAuth();
  const { showToast } = useToast();
  const [cachedTrackIds, setCachedTrackIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const syncCached = async () => {
      const stats = await getOfflineCacheStats();
      setCachedTrackIds(new Set(stats.entries.map((e) => e.trackId)));
    };
    void syncCached();
    window.addEventListener('lowervibe:offline-cache-changed', syncCached);
    return () => window.removeEventListener('lowervibe:offline-cache-changed', syncCached);
  }, []);

  // Deduplicated live playlists (Firestore public + current user's personal playlists)
  const allPlaylists: Playlist[] = useMemo(() => {
    const map = new Map<string, Playlist>();
    playlists.forEach(p => {
      if (p?.id) map.set(p.id, p);
    });
    (currentUser?.playlists || []).forEach(p => {
      if (p?.id && !map.has(p.id)) {
        map.set(p.id, p);
      }
    });
    return Array.from(map.values());
  }, [playlists, currentUser?.playlists]);

  const [locationScope, setLocationScope] = useState<'local' | 'global'>(() =>
    selectedCountry && selectedCountry !== 'Global' ? 'local' : 'global'
  );
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newGenre, setNewGenre] = useState('Afro Chillout');
  const [newCountry, setNewCountry] = useState(() =>
    selectedCountry && selectedCountry !== 'Global' ? selectedCountry : currentUser?.country || 'Malawi'
  );
  const [newIsPublic, setNewIsPublic] = useState(true);

  useEffect(() => {
    if (selectedCountry && selectedCountry !== 'Global') {
      setNewCountry(selectedCountry);
    }
  }, [selectedCountry]);

  // Dynamic genre chips derived from actual playlists + tracks
  const genreChips = useMemo(() => {
    const counts = new Map<string, number>();
    allPlaylists.forEach(p => {
      if (p.genre) {
        const g = p.genre.trim();
        counts.set(g, (counts.get(g) || 0) + Math.max(1, (p.plays || 0) + (p.likes || 0) * 5));
      }
    });
    tracks.forEach(t => {
      if (t.genre && !t.isDraft && !t.isDeranked) {
        const g = t.genre.trim();
        counts.set(g, (counts.get(g) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [allPlaylists, tracks]);

  const filteredAndSortedPlaylists = useMemo(() => {
    const filtered = allPlaylists.filter(pl => {
      const matchesGenre =
        genreFilter === 'all' ||
        (pl.genre || '').toLowerCase() === genreFilter.toLowerCase();
      if (!matchesGenre) return false;

      if (locationScope === 'local' && selectedCountry && selectedCountry !== 'Global') {
        return matchesLocationFilter(pl.country || pl.region, selectedCountry);
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aLikes = Array.isArray(a.likedByUserIds) ? a.likedByUserIds.length : a.likes || 0;
      const bLikes = Array.isArray(b.likedByUserIds) ? b.likedByUserIds.length : b.likes || 0;
      const aScore = (a.plays || 0) + aLikes * 6;
      const bScore = (b.plays || 0) + bLikes * 6;
      return bScore - aScore;
    });
  }, [allPlaylists, genreFilter, locationScope, selectedCountry]);

  const selectedPlaylist = useMemo(() => {
    if (selectedPlaylistId) {
      const found = allPlaylists.find(p => p.id === selectedPlaylistId);
      if (found) return found;
    }
    return filteredAndSortedPlaylists[0] || allPlaylists[0] || null;
  }, [selectedPlaylistId, allPlaylists, filteredAndSortedPlaylists]);

  const currentPlTracks: Track[] = (selectedPlaylist?.trackIds || [])
    .map(id => tracks.find(t => t.id === id))
    .filter((t): t is Track => Boolean(t));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const cleanGenre = newGenre.trim() || 'Mixed Vibes';
    const cleanCountry = newCountry.trim() || 'Global';
    await upsertGenre(cleanGenre, { region: cleanCountry });

    if (newIsPublic) {
      const created = await createPublicPlaylist({
        name: newTitle.trim(),
        description: newDesc.trim() || `Community playlist in ${cleanGenre} (${cleanCountry}).`,
        coverArt: tracks[0]?.coverArt || DEFAULT_ARTWORK_SVG,
        country: cleanCountry,
        genre: cleanGenre,
        isPublic: true,
      });
      setSelectedPlaylistId(created.id);
    } else if (currentUser) {
      const created = createPlaylist(
        newTitle.trim(),
        newDesc.trim(),
        tracks[0]?.coverArt || DEFAULT_ARTWORK_SVG,
        { country: cleanCountry, region: cleanCountry, genre: cleanGenre, isPublic: false }
      );
      setSelectedPlaylistId(created.id);
    }

    showToast(newIsPublic ? 'Public playlist published!' : 'Private playlist saved!');
    setIsCreating(false);
    setNewTitle('');
    setNewDesc('');
  };

  const handlePlayAll = () => {
    if (currentPlTracks.length > 0 && selectedPlaylist) {
      recordPlaylistPlay(selectedPlaylist.id);
      playTrack(currentPlTracks[0]);
    }
  };

  const getPlaylistLikeCount = (pl: Playlist) =>
    Array.isArray(pl.likedByUserIds) ? new Set(pl.likedByUserIds).size : pl.likes || 0;

  const isPlaylistLikedByUser = (pl: Playlist) =>
    Boolean(currentUser && Array.isArray(pl.likedByUserIds) && pl.likedByUserIds.includes(currentUser.id));

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-[#121218] border border-[rgba(255,255,255,0.08)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#C6FF4A] mb-1">
            <ListMusic className="w-4 h-4" />
            <span>Community &amp; Creator Playlists</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-heading">
            Playlists &amp; Regional Soundscapes
          </h1>
          <p className="text-xs sm:text-sm text-[#A0A0A8] mt-1">
            Anyone can create and share playlists ranked by region, genre, and listener likes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#C6FF4A] hover:brightness-105 text-black font-black text-xs transition shadow-lg shadow-[#C6FF4A]/20 active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Playlist</span>
        </button>
      </div>

      {/* Location & Genre Trending Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocationScope('local')}
            className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              locationScope === 'local'
                ? 'bg-[#6C4BFF] text-white shadow'
                : 'bg-[#121218] text-[#A0A0A8] border border-white/10 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>
              Trending in {selectedCountry && selectedCountry !== 'Global' ? selectedCountry : 'Your Region'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLocationScope('global')}
            className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              locationScope === 'global'
                ? 'bg-[#C6FF4A] text-black font-black'
                : 'bg-[#121218] text-[#A0A0A8] border border-white/10 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Global Trending</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setGenreFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition ${
              genreFilter === 'all'
                ? 'bg-white text-black'
                : 'bg-[#121218] text-[#A0A0A8] border border-white/10 hover:text-white'
            }`}
          >
            All Genres
          </button>
          {genreChips.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGenreFilter(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition ${
                genreFilter === g
                  ? 'bg-[#C6FF4A] text-black'
                  : 'bg-[#121218] text-[#A0A0A8] border border-white/10 hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-5 sm:p-6 rounded-3xl bg-[#121218] border border-[#C6FF4A]/40 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-[#C6FF4A]" />
              <span>Create Playlist (Public or Private)</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="text-xs text-[#A0A0A8] hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Playlist Title (e.g. Rainy Afternoon Rhodes)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="px-3.5 py-2.5 bg-[#08080B] border border-white/10 rounded-xl text-xs text-white placeholder-[#707080] focus:outline-none focus:border-[#C6FF4A]"
            />
            <input
              type="text"
              placeholder="Description (e.g. Ambient tape chords for focus)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="px-3.5 py-2.5 bg-[#08080B] border border-white/10 rounded-xl text-xs text-white placeholder-[#707080] focus:outline-none focus:border-[#C6FF4A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[#A0A0A8] block">Genre (or Custom Genre)</label>
              <GenreSelectOrCustom
                value={newGenre}
                onChange={setNewGenre}
                onCustomGenreCreated={(name) => upsertGenre(name, { region: newCountry })}
                className="w-full px-3.5 py-2.5 bg-[#08080B] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#C6FF4A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-mono text-[#A0A0A8] block">Region / Country</label>
              <RegionSelect
                value={newCountry}
                onChange={setNewCountry}
                includeGlobal={true}
                className="w-full px-3.5 py-2.5 bg-[#08080B] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#C6FF4A]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
              <input
                type="checkbox"
                checked={newIsPublic}
                onChange={e => setNewIsPublic(e.target.checked)}
                className="accent-[#C6FF4A] rounded"
              />
              <span>Publish as Public Playlist (visible to listeners in {newCountry})</span>
            </label>

            <button
              type="submit"
              disabled={!newTitle.trim()}
              className="px-6 py-2.5 rounded-full bg-[#C6FF4A] hover:brightness-105 disabled:opacity-50 text-black font-black text-xs transition cursor-pointer"
            >
              {newIsPublic ? 'Publish Playlist' : 'Save Private Playlist'}
            </button>
          </div>
        </form>
      )}

      {/* Two column layout: Left playlist cards, Right selected tracks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Playlists Selector */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#A0A0A8] uppercase tracking-wider font-heading">
            Playlists ({filteredAndSortedPlaylists.length})
          </h3>

          {filteredAndSortedPlaylists.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#121218] border border-white/10 text-center space-y-2 text-xs text-[#A0A0A8]">
              <p>No playlists in this region/genre filter yet.</p>
              {locationScope === 'local' && (
                <button
                  type="button"
                  onClick={() => setLocationScope('global')}
                  className="text-[#C6FF4A] font-bold hover:underline cursor-pointer"
                >
                  Show Global Trending Playlists
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredAndSortedPlaylists.map(pl => {
                const isSelected = selectedPlaylist?.id === pl.id;
                const liked = isPlaylistLikedByUser(pl);
                const likeCount = getPlaylistLikeCount(pl);

                return (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    className={`flex items-center gap-3.5 p-3 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#6C4BFF]/15 border-[#6C4BFF] shadow-md'
                        : 'bg-[#121218] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <img
                      src={pl.coverArt || DEFAULT_ARTWORK_SVG}
                      alt={pl.name}
                      className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-white truncate font-heading">{pl.name}</h4>
                        {!pl.isPublic && <Lock className="w-3 h-3 text-[#A0A0A8] shrink-0" />}
                      </div>
                      <p className="text-xs text-[#A0A0A8] truncate mt-0.5">{pl.description || pl.creatorName}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-[#A0A0A8] truncate">
                        <span>{pl.trackIds.length} tracks</span>
                        {pl.genre && <span>· {pl.genre}</span>}
                        {(pl.country || pl.region) && <span>· {pl.country || pl.region}</span>}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleLikePlaylist(pl.id);
                      }}
                      className={`px-2 py-1.5 rounded-lg flex items-center gap-1 text-xs font-mono shrink-0 cursor-pointer transition ${
                        liked ? 'text-rose-400 bg-rose-500/10' : 'text-[#A0A0A8] hover:text-white'
                      }`}
                      title="Like playlist (1 per person)"
                    >
                      <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-400' : ''}`} />
                      <span className="tabular-nums">{likeCount}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Playlist Detailed View */}
        <div className="lg:col-span-2 space-y-4">
          {selectedPlaylist ? (
            <div className="p-6 rounded-3xl bg-[#121218] border border-white/10 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-5 border-b border-white/10">
                <img
                  src={selectedPlaylist.coverArt || DEFAULT_ARTWORK_SVG}
                  alt={selectedPlaylist.name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-white/15 shadow-xl shrink-0"
                />

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-[#C6FF4A]">
                    <span>{selectedPlaylist.isPublic ? 'PUBLIC PLAYLIST' : 'PRIVATE PLAYLIST'}</span>
                    <span>· {selectedPlaylist.creatorName}</span>
                    {selectedPlaylist.genre && <span>· {selectedPlaylist.genre}</span>}
                    {(selectedPlaylist.country || selectedPlaylist.region) && (
                      <span>· {selectedPlaylist.country || selectedPlaylist.region}</span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-white font-heading">{selectedPlaylist.name}</h2>
                  <p className="text-xs text-[#DCDCE2] leading-relaxed">{selectedPlaylist.description}</p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      disabled={currentPlTracks.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#C6FF4A] hover:brightness-105 disabled:opacity-50 text-black font-black text-xs transition cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-black" />
                      <span>Play Sequence</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleLikePlaylist(selectedPlaylist.id)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full border text-xs font-bold transition cursor-pointer ${
                        isPlaylistLikedByUser(selectedPlaylist)
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                          : 'bg-white/5 border-white/10 text-[#A0A0A8] hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isPlaylistLikedByUser(selectedPlaylist) ? 'fill-rose-400' : ''
                        }`}
                      />
                      <span className="font-mono tabular-nums">{getPlaylistLikeCount(selectedPlaylist)}</span>
                    </button>

                    {(() => {
                      const downloadableIds = currentPlTracks
                        .filter((tr) => tr.downloadable !== false && Boolean(tr.audioUrl))
                        .map((tr) => tr.id);
                      if (downloadableIds.length === 0) return null;
                      const cachedCount = downloadableIds.filter((id) => cachedTrackIds.has(id)).length;
                      const remaining = downloadableIds.length - cachedCount;
                      const isSyncing = Boolean(
                        activeBatchDownload &&
                          !activeBatchDownload.isComplete &&
                          activeBatchDownload.id === `playlist-${selectedPlaylist.id}`
                      );

                      if (isSyncing && activeBatchDownload) {
                        return (
                          <button
                            type="button"
                            disabled
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[#C6FF4A]/40 bg-[#C6FF4A]/15 text-[#C6FF4A] text-xs font-bold tabular-nums"
                          >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              Saving {activeBatchDownload.completed}/{activeBatchDownload.total}
                            </span>
                          </button>
                        );
                      }

                      if (remaining === 0) {
                        return (
                          <button
                            type="button"
                            onClick={async () => {
                              const removed = await removeTracksOfflineBatch(downloadableIds);
                              if (removed > 0) showToast(`Removed ${removed} tracks from offline storage`);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-[#C6FF4A]/50 bg-[#C6FF4A]/15 text-[#C6FF4A] hover:border-rose-400 hover:text-rose-300 text-xs font-bold transition cursor-pointer"
                            title="Tap to remove offline playlist"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Saved Offline</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await downloadPlaylistOffline(selectedPlaylist);
                            if (!res.blockedReason && res.saved > 0) {
                              showToast(`Saved ${res.saved} track${res.saved === 1 ? '' : 's'} offline`);
                            }
                          }}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/15 bg-white/5 hover:border-[#C6FF4A] text-white text-xs font-bold transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#C6FF4A]" />
                          <span>
                            {cachedCount > 0 ? `Sync ${remaining} Offline` : 'Save Playlist Offline'}
                          </span>
                        </button>
                      );
                    })()}

                    <span className="text-xs font-mono text-[#A0A0A8] tabular-nums">
                      {currentPlTracks.length} tracks · {selectedPlaylist.plays || 0} plays
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {currentPlTracks.length === 0 ? (
                  <p className="text-center text-xs text-[#A0A0A8] py-8">
                    No tracks in this playlist yet. Add tracks by clicking the &quot;+&quot; icon on any track!
                  </p>
                ) : (
                  currentPlTracks.map((tr, idx) => (
                    <TrackRow key={tr.id} track={tr} index={idx} />
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-[#A0A0A8] text-xs rounded-3xl bg-[#121218] border border-white/10">
              Create your first playlist above or select one from the list.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

