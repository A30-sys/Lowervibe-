import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  Globe,
  HardDrive,
  Heart,
  ListMusic,
  Lock,
  Music,
  Pause,
  Play,
  Plus,
  Share2,
  Trash2,
  UserCheck,
  Wifi,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import {
  clearOfflineCache,
  formatStorageBytes,
  getOfflineCacheStats,
  getStorageQuotaEstimate,
  OfflineCacheStats,
  removeTrackOfflineCache,
  StorageQuotaInfo,
} from '../../services/audioStorage';
import { Playlist, Track } from '../../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import { formatTime } from '../../utils/formatters';
import { translateGenreCategory } from '../../utils/genreCategories';

type LibraryTab = 'saved' | 'liked' | 'playlists' | 'downloads' | 'following' | 'history';

export const LibraryView: React.FC<{ onOpenTrackDetails: (track: Track) => void }> = ({
  onOpenTrackDetails,
}) => {
  const { currentUser, userSettings, createPlaylist, toggleFollowArtist } = useAuth();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const {
    tracks,
    artists,
    playlists,
    savedTrackIds,
    playHistory,
    currentTrack,
    isPlaying,
    activeDownload,
    activeBatchDownload,
    playTrack,
    togglePlayPause,
    downloadTrack,
    downloadPlaylistOffline,
    removeTracksOfflineBatch,
    clearHistory,
    updatePublicPlaylist,
    deletePublicPlaylist,
    reorderPlaylistTracks,
    removeTrackFromPlaylist,
    setActiveDetailTrack,
  } = useAudio();
  const { navigate, searchParams } = useRouter();

  const initialTabParam = searchParams.get('tab');
  const resolvedInitialTab: LibraryTab =
    initialTabParam === 'downloads' ||
    initialTabParam === 'saved' ||
    initialTabParam === 'liked' ||
    initialTabParam === 'playlists' ||
    initialTabParam === 'following' ||
    initialTabParam === 'history'
      ? initialTabParam
      : 'saved';

  const [activeTab, setActiveTab] = useState<LibraryTab>(resolvedInitialTab);
  const [offlineStats, setOfflineStats] = useState<OfflineCacheStats>({ totalBytes: 0, count: 0, entries: [] });
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo>({
    supported: false,
    usageBytes: 0,
    quotaBytes: 0,
  });
  const [confirmClearDownloads, setConfirmClearDownloads] = useState(false);
  const [isClearingDownloads, setIsClearingDownloads] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // Playlist creation & editing
  const [isCreatingPl, setIsCreatingPl] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [newPlPublic, setNewPlPublic] = useState(true);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [confirmDeletePlId, setConfirmDeletePlId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadOffline = useCallback(async () => {
    const [stats, quota] = await Promise.all([getOfflineCacheStats(), getStorageQuotaEstimate()]);
    setOfflineStats(stats);
    setStorageQuota(quota);
  }, []);

  useEffect(() => {
    void loadOffline();
  }, [loadOffline, savedTrackIds.length]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (
      tabParam === 'downloads' ||
      tabParam === 'saved' ||
      tabParam === 'liked' ||
      tabParam === 'playlists' ||
      tabParam === 'following' ||
      tabParam === 'history'
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleCacheChange = () => {
      void loadOffline();
    };
    window.addEventListener('lowervibe:offline-cache-changed', handleCacheChange);
    return () => window.removeEventListener('lowervibe:offline-cache-changed', handleCacheChange);
  }, [loadOffline]);

  const savedTracks = useMemo(
    () => tracks.filter((t) => savedTrackIds.includes(t.id) && !t.isDraft && !t.isDeranked),
    [tracks, savedTrackIds]
  );

  const likedTracks = useMemo(() => {
    if (!currentUser) return [];
    const likedSet = new Set(currentUser.likedTrackIds || []);
    return tracks.filter((t) => likedSet.has(t.id) && !t.isDraft && !t.isDeranked);
  }, [tracks, currentUser]);

  const followingArtists = useMemo(() => {
    if (!currentUser) return [];
    const set = new Set(currentUser.followingArtistIds || []);
    return artists.filter((a) => set.has(a.id));
  }, [artists, currentUser]);

  const myPlaylists = useMemo(() => {
    if (!currentUser) return [];
    const map = new Map<string, Playlist>();
    (currentUser.playlists || []).forEach((p) => map.set(p.id, p));
    playlists
      .filter((p) => p.createdBy === currentUser.id)
      .forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [currentUser, playlists]);

  const activePlaylist = useMemo(
    () => myPlaylists.find((p) => p.id === selectedPlaylistId) || null,
    [myPlaylists, selectedPlaylistId]
  );

  const downloadedTracks = useMemo(() => {
    return offlineStats.entries.map((entry) => ({
      entry,
      track: tracks.find((t) => t.id === entry.trackId),
    }));
  }, [offlineStats, tracks]);

  const downloadedIdSet = useMemo(
    () => new Set(offlineStats.entries.map((e) => e.trackId)),
    [offlineStats.entries]
  );

  const suggestedForOffline = useMemo(() => {
    const seen = new Set<string>();
    const combined: Track[] = [];
    for (const tr of [...savedTracks, ...likedTracks]) {
      if (!downloadedIdSet.has(tr.id) && !seen.has(tr.id) && tr.downloadable !== false && tr.audioUrl) {
        seen.add(tr.id);
        combined.push(tr);
      }
      if (combined.length >= 6) break;
    }
    return combined;
  }, [savedTracks, likedTracks, downloadedIdSet]);

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlName.trim() || !currentUser) return;
    const pl = createPlaylist(newPlName.trim(), '', undefined, {
      country: currentUser.country || 'Malawi',
      isPublic: newPlPublic,
    });
    setNewPlName('');
    setIsCreatingPl(false);
    setSelectedPlaylistId(pl.id);
  };

  const renderTrackRow = (track: Track, extraRight?: React.ReactNode) => {
    const active = currentTrack?.id === track.id;
    return (
      <div
        key={track.id}
        onClick={() => (active ? togglePlayPause() : playTrack(track))}
        className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)]/60 transition cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[var(--border)]">
            <img
              src={track.coverArt || DEFAULT_ARTWORK_SVG}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/35 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition">
              {active && isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)] truncate">{track.title}</div>
            <div className="text-xs text-[var(--text-muted)] truncate">
              {track.artistName} · {translateGenreCategory(track.genre, language)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {extraRight}
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {formatTime(track.metadata?.Duration || track.durationSeconds || 0)}
          </span>
          <button
            type="button"
            onClick={() => {
              setActiveDetailTrack(track);
              onOpenTrackDetails(track);
            }}
            className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)] cursor-pointer"
          >
            {isNy ? 'Zambiri' : 'Info'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-4 space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--text)]">{t('library')}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {isNy
              ? 'Nyimbo zosungidwa, zokondedwa, mindandanda ndi zopanda intaneti'
              : 'Your saved songs, likes, playlists, and offline downloads'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('downloads');
              setSelectedPlaylistId(null);
            }}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition border ${
              activeTab === 'downloads'
                ? 'bg-[var(--surface-2)] border-[var(--accent)] text-[var(--accent-text)]'
                : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--border-strong)]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            <span>{isNy ? 'Zotsitsidwa' : 'Downloads'} · {formatStorageBytes(offlineStats.totalBytes)}</span>
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('playlists');
                setIsCreatingPl(true);
              }}
              className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isNy ? 'Mndandanda watsopano' : 'New playlist'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'saved' as const, label: `${t('saved')} (${savedTracks.length})` },
          { id: 'liked' as const, label: `${t('library_liked')} (${likedTracks.length})` },
          { id: 'playlists' as const, label: `${t('library_playlists')} (${myPlaylists.length})` },
          { id: 'downloads' as const, label: `${isNy ? 'Zotsitsidwa' : 'Downloads'} (${downloadedTracks.length})` },
          { id: 'following' as const, label: `${isNy ? 'Oimba Omwe Ndimatsatira' : 'Artists I Follow'} (${followingArtists.length})` },
          { id: 'history' as const, label: `${t('library_history')} (${playHistory.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== 'playlists') setSelectedPlaylistId(null);
            }}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition ${
              activeTab === tab.id
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Artists I Follow Strip when viewing Saved */}
      {activeTab === 'saved' && followingArtists.length > 0 && (
        <section className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--text)]">
              {isNy ? 'Oimba Omwe Ndimatsatira' : 'Artists I Follow'}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('following')}
              className="text-xs font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
            >
              {isNy ? `Onani onse (${followingArtists.length})` : `View all (${followingArtists.length})`}
            </button>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
            {followingArtists.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/artists/${a.slug || a.id}`)}
                className="flex items-center gap-2.5 p-2 pr-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] shrink-0 cursor-pointer transition"
              >
                <img
                  src={a.avatar || DEFAULT_AVATAR_SVG}
                  alt={a.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-xl object-cover border border-[var(--border)]"
                />
                <div className="text-left min-w-0">
                  <div className="text-xs font-bold text-[var(--text)] truncate max-w-[120px]">
                    {a.name}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] tabular-nums">
                    {(a.followersCount || 0).toLocaleString()} {isNy ? 'otsatira' : 'followers'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SAVED */}
      {activeTab === 'saved' && (
        <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {savedTracks.length === 0 ? (
            <EmptyBox
              icon={Music}
              title={isNy ? 'Palibe nyimbo zosungidwa' : 'No saved songs yet'}
              subtitle={
                isNy
                  ? 'Sungani nyimbo kuchokera pacholeretsa kapena tsamba lofufuza kuti muzipeze mwachangu pano.'
                  : 'Save songs from the player or discover feed to find them quickly here.'
              }
              cta={isNy ? 'Fufuzani nyimbo' : 'Browse music'}
              onCta={() => navigate('/discover')}
            />
          ) : (
            savedTracks.map((track) =>
              renderTrackRow(
                track,
                downloadedIdSet.has(track.id) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-text)] text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="hidden sm:inline">{t('library_offline')}</span>
                  </span>
                ) : track.downloadable !== false && Boolean(track.audioUrl) ? (
                  <button
                    type="button"
                    onClick={() => downloadTrack(track)}
                    title={isNy ? 'Tsitsani kuti mumvere popanda intaneti' : 'Download for offline listening'}
                    className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent-text)] cursor-pointer transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                ) : null
              )
            )
          )}
        </div>
      )}

      {/* LIKED */}
      {activeTab === 'liked' && (
        <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {!currentUser ? (
            <EmptyBox
              icon={Heart}
              title={isNy ? 'Lowani kuti muwone nyimbo zokondedwa' : 'Sign in to see liked songs'}
              subtitle={
                isNy
                  ? 'Nyimbo zomwe mumakonda zimatsatira akaunti yanu pa chipangizo chilichonse.'
                  : 'Your liked tracks follow your account across devices.'
              }
              cta={t('sign_in')}
              onCta={() => navigate('/login')}
            />
          ) : likedTracks.length === 0 ? (
            <EmptyBox
              icon={Heart}
              title={isNy ? 'Palibe nyimbo zokondedwa pakadali pano' : 'No liked songs yet'}
              subtitle={
                isNy
                  ? 'Dinani chizindikiro cha mtima pa nyimbo iliyonse kuti muwonjezere pano.'
                  : 'Tap the heart button on any song to add it here.'
              }
              cta={isNy ? 'Pezani nyimbo' : 'Find songs'}
              onCta={() => navigate('/discover')}
            />
          ) : (
            likedTracks.map((tr) =>
              renderTrackRow(
                tr,
                downloadedIdSet.has(tr.id) ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-text)] text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="hidden sm:inline">{t('library_offline')}</span>
                  </span>
                ) : tr.downloadable !== false && Boolean(tr.audioUrl) ? (
                  <button
                    type="button"
                    onClick={() => downloadTrack(tr)}
                    title={isNy ? 'Tsitsani kuti mumvere popanda intaneti' : 'Download for offline listening'}
                    className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--accent-text)] cursor-pointer transition min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                ) : null
              )
            )
          )}
        </div>
      )}

      {/* PLAYLISTS (Create, Reorder Up/Down, Remove Track, Rename, Public/Private, Share, Delete) */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          {!currentUser ? (
            <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)]">
              <EmptyBox
                icon={ListMusic}
                title={isNy ? 'Lowani kuti mupange mindandanda' : 'Sign in to make playlists'}
                subtitle={
                  isNy
                    ? 'Sonkhanitsani nyimbo zomwe mumakonda ndi kuzigawana ndi anzanu.'
                    : 'Group your favorite songs and share them with friends.'
                }
                cta={t('sign_in')}
                onCta={() => navigate('/login')}
              />
            </div>
          ) : (
            <>
              {isCreatingPl && (
                <form
                  onSubmit={handleCreatePlaylist}
                  className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-3"
                >
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      placeholder={t('playlist_name_placeholder')}
                      value={newPlName}
                      onChange={(e) => setNewPlName(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)]"
                    />
                    <label className="flex items-center gap-2 text-xs text-[var(--text)] px-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPlPublic}
                        onChange={(e) => setNewPlPublic(e.target.checked)}
                        className="accent-[var(--accent)]"
                      />
                      <span>{isNy ? 'Wa aliyense' : 'Public'}</span>
                    </label>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                    >
                      {isNy ? 'Pangani' : 'Create'}
                    </button>
                  </div>
                </form>
              )}

              {activePlaylist ? (
                <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPlaylistId(null)}
                        className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        ← {isNy ? 'Mindandanda yonse' : 'All playlists'}
                      </button>

                      {renamingPlaylistId === activePlaylist.id ? (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={renameText}
                            onChange={(e) => setRenameText(e.target.value)}
                            className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (renameText.trim()) {
                                await updatePublicPlaylist(activePlaylist.id, { name: renameText.trim() });
                              }
                              setRenamingPlaylistId(null);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                          >
                            {t('save')}
                          </button>
                        </div>
                      ) : (
                        <h2 className="text-lg font-extrabold text-[var(--text)]">{activePlaylist.name}</h2>
                      )}
                      <div className="text-xs text-[var(--text-muted)]">
                        {t('songs_count_label', undefined, { count: activePlaylist.trackIds.length })} ·{' '}
                        {activePlaylist.isPublic ? (isNy ? 'Wa aliyense' : 'Public') : (isNy ? 'Wachinsinsi' : 'Private')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const plDownloadableIds = (activePlaylist.trackIds || []).filter((tid) => {
                          const tr = tracks.find((t) => t.id === tid);
                          return Boolean(tr && tr.downloadable !== false && tr.audioUrl);
                        });
                        const plCachedCount = plDownloadableIds.filter((tid) => downloadedIdSet.has(tid)).length;
                        const plRemaining = plDownloadableIds.length - plCachedCount;
                        const isPlSyncing = Boolean(
                          activeBatchDownload &&
                            !activeBatchDownload.isComplete &&
                            activeBatchDownload.id === `playlist-${activePlaylist.id}`
                        );
                        if (plDownloadableIds.length === 0) return null;

                        return isPlSyncing && activeBatchDownload ? (
                          <button
                            type="button"
                            disabled
                            className="px-3 py-1.5 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/40 text-xs font-bold text-[var(--accent-text)] flex items-center gap-1.5 tabular-nums"
                          >
                            <Download className="w-3.5 h-3.5 animate-pulse" />
                            <span>
                              {t('syncing_offline_progress', 'Saving offline {completed}/{total}', {
                                completed: activeBatchDownload.completed,
                                total: activeBatchDownload.total,
                              })}
                            </span>
                          </button>
                        ) : plRemaining === 0 ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await removeTracksOfflineBatch(plDownloadableIds);
                              await loadOffline();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--accent)]/40 hover:border-[var(--danger)] text-xs font-semibold text-[var(--accent-text)] hover:text-[var(--danger)] cursor-pointer flex items-center gap-1.5 transition"
                            title={t('remove_offline_batch', 'Remove offline')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('playlist_saved_offline', 'Saved offline')}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              void downloadPlaylistOffline(activePlaylist);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer flex items-center gap-1.5 hover:brightness-95 transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {plCachedCount > 0
                                ? t('sync_remaining_offline', 'Sync {count} offline', {
                                    count: plRemaining,
                                  })
                                : t('save_playlist_offline', 'Save playlist offline')}
                            </span>
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        onClick={() => {
                          setRenamingPlaylistId(activePlaylist.id);
                          setRenameText(activePlaylist.name);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isNy ? 'Sinthani dzina' : 'Rename'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          updatePublicPlaylist(activePlaylist.id, { isPublic: !activePlaylist.isPublic })
                        }
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer flex items-center gap-1"
                      >
                        {activePlaylist.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>{activePlaylist.isPublic ? (isNy ? 'Wa aliyense' : 'Public') : (isNy ? 'Wachinsinsi' : 'Private')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(window.location.href);
                          setCopiedId(activePlaylist.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer flex items-center gap-1"
                      >
                        {copiedId === activePlaylist.id ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                        <span>{copiedId === activePlaylist.id ? (isNy ? 'Zakopedwa' : 'Copied') : t('share')}</span>
                      </button>
                    </div>
                  </div>

                  {activePlaylist.trackIds.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                      {isNy
                        ? 'Palibe nyimbo m\'mndandandawu pakadali pano. Dinani "+ Mndandanda" pa nyimbo iliyonse.'
                        : 'No songs in this playlist yet. Tap "+ Playlist" on any track to add songs.'}
                    </p>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {activePlaylist.trackIds.map((tid, idx) => {
                        const track = tracks.find((tr) => tr.id === tid);
                        if (!track) return null;
                        return renderTrackRow(
                          track,
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => reorderPlaylistTracks(activePlaylist.id, idx, idx - 1)}
                              className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-35 cursor-pointer"
                              title={isNy ? 'Kwezani pamwamba' : 'Move up'}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === activePlaylist.trackIds.length - 1}
                              onClick={() => reorderPlaylistTracks(activePlaylist.id, idx, idx + 1)}
                              className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-35 cursor-pointer"
                              title={isNy ? 'Tsitsani pansi' : 'Move down'}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTrackFromPlaylist(activePlaylist.id, tid)}
                              className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                              title={isNy ? 'Chotsani m\'mndandanda' : 'Remove from playlist'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : myPlaylists.length === 0 ? (
                <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)]">
                  <EmptyBox
                    icon={ListMusic}
                    title={isNy ? 'Palibe mindandanda pakadali pano' : 'No playlists yet'}
                    subtitle={
                      isNy
                        ? 'Pangani mndandanda kuti musonkhanitse nyimbo zomwe mumakonda.'
                        : 'Create a playlist to organize your favorite tracks.'
                    }
                    cta={t('create_playlist')}
                    onCta={() => setIsCreatingPl(true)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {myPlaylists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between gap-3 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={pl.coverArt || DEFAULT_ARTWORK_SVG}
                          alt={pl.name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[var(--text)] truncate">{pl.name}</div>
                          <div className="text-xs text-[var(--text-muted)] tabular-nums truncate">
                            {t('songs_count_label', undefined, { count: pl.trackIds.length })} ·{' '}
                            {pl.isPublic ? (isNy ? 'Wa aliyense' : 'Public') : (isNy ? 'Wachinsinsi' : 'Private')}
                            {(() => {
                              const cached = (pl.trackIds || []).filter((id) => downloadedIdSet.has(id)).length;
                              if (cached === 0) return '';
                              return cached >= pl.trackIds.length && pl.trackIds.length > 0
                                ? ` · ${t('library_offline', 'Offline')}`
                                : ` · ${cached}/${pl.trackIds.length} ${t('library_offline', 'Offline').toLowerCase()}`;
                            })()}
                          </div>
                        </div>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        {confirmDeletePlId === pl.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await deletePublicPlaylist(pl.id);
                                setConfirmDeletePlId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-[var(--danger)] text-white text-[10px] font-bold cursor-pointer"
                            >
                              {isNy ? 'Fufutani' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePlId(null)}
                              className="text-[10px] text-[var(--text-muted)] px-1 cursor-pointer"
                            >
                              {t('cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePlId(pl.id)}
                            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* DOWNLOADS: Dedicated Offline Manager & Device Storage Usage */}
      {activeTab === 'downloads' && (
        <section className="space-y-4" aria-label={isNy ? 'Zotsitsidwa ndi malo osungira' : 'Offline downloads and storage usage'}>
          {/* Storage Usage Overview Card */}
          <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent-text)] flex items-center justify-center shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-[var(--text)]">
                      {isNy ? 'Nyimbo Zopanda Intaneti' : 'Offline Downloads'}
                    </h2>
                    {userSettings.dataSaver.downloadWifiOnly && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-semibold text-[var(--text-muted)]">
                        <Wifi className="w-3 h-3 text-[var(--accent-text)]" />
                        <span>{isNy ? 'Wi-Fi yokha' : 'Wi-Fi only'}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {offlineStats.count === 0
                      ? isNy
                        ? 'Palibe nyimbo zosungidwa pa foni — tsitsani nyimbo kuti mumvere nthawi iliyonse popanda deta.'
                        : 'No tracks stored locally yet — download songs to play anytime without data.'
                      : isNy
                        ? `Nyimbo ${offlineStats.count} zasungidwa pafoni · ${formatStorageBytes(offlineStats.totalBytes)} zagwiritsidwa ntchito`
                        : `${offlineStats.count} track${offlineStats.count === 1 ? '' : 's'} saved for offline playback · ${formatStorageBytes(offlineStats.totalBytes)} used`}
                  </p>
                </div>
              </div>

              {offlineStats.count > 0 && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {downloadedTracks.some((d) => Boolean(d.track)) && (
                    <button
                      type="button"
                      onClick={() => {
                        const first = downloadedTracks.find((d) => d.track)?.track;
                        if (first) playTrack(first);
                      }}
                      className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isNy ? 'Lizani zopanda intaneti' : 'Play offline'}</span>
                    </button>
                  )}

                  {!confirmClearDownloads ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearDownloads(true)}
                      className="px-3.5 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--danger)] text-xs font-semibold text-[var(--danger)] cursor-pointer transition"
                    >
                      {isNy ? 'Fufutani zonse' : 'Clear all'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmClearDownloads(false)}
                        className="px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        disabled={isClearingDownloads}
                        onClick={async () => {
                          setIsClearingDownloads(true);
                          await clearOfflineCache();
                          await loadOffline();
                          setIsClearingDownloads(false);
                          setConfirmClearDownloads(false);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[var(--danger)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {isClearingDownloads
                          ? isNy ? 'Ikufufuta...' : 'Clearing...'
                          : isNy ? 'Tsimikizirani kufufuta' : 'Confirm clear'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Storage Progress Bar */}
            {(() => {
              const quotaMax =
                storageQuota.supported && storageQuota.quotaBytes > 0
                  ? storageQuota.quotaBytes
                  : 512 * 1024 * 1024;
              const offlinePct = Math.min(
                100,
                offlineStats.totalBytes > 0
                  ? Math.max(2, Math.round((offlineStats.totalBytes / quotaMax) * 100))
                  : 0
              );
              const totalAppUsed =
                storageQuota.supported && storageQuota.usageBytes > 0
                  ? Math.max(storageQuota.usageBytes, offlineStats.totalBytes)
                  : offlineStats.totalBytes;
              const freeBytes =
                storageQuota.supported && storageQuota.quotaBytes > 0
                  ? Math.max(0, storageQuota.quotaBytes - totalAppUsed)
                  : null;

              return (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[var(--text)] font-bold">
                      {isNy ? 'Malo a Nyimbo' : 'Music Cache'}: {formatStorageBytes(offlineStats.totalBytes)}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {freeBytes !== null
                        ? isNy
                          ? `Patsala ${formatStorageBytes(freeBytes)} pa ${formatStorageBytes(quotaMax)}`
                          : `${formatStorageBytes(freeBytes)} available of ${formatStorageBytes(quotaMax)}`
                        : isNy
                          ? 'Malo osungira a pafoni (IndexedDB)'
                          : 'Local IndexedDB offline storage'}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--violet)] to-[var(--accent)] transition-all duration-300"
                      style={{ width: `${offlinePct}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Downloaded Tracks List */}
          <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {downloadedTracks.length === 0 ? (
              <EmptyBox
                icon={Download}
                title={isNy ? 'Palibe nyimbo zotsitsidwa' : 'No offline downloads yet'}
                subtitle={
                  isNy
                    ? 'Tsitsani nyimbo pogwiritsa ntchito Wi-Fi kuti mumvere popanda kuwononga deta.'
                    : 'Download tracks over Wi-Fi to listen smoothly on the road without using mobile data.'
                }
                cta={isNy ? 'Fufuzani nyimbo' : 'Browse music'}
                onCta={() => navigate('/discover')}
              />
            ) : (
              downloadedTracks.map(({ entry, track }) => {
                if (!track) {
                  return (
                    <div
                      key={entry.trackId}
                      className="p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[var(--text)] truncate">
                            {isNy ? `Nyimbo Yosungidwa (${entry.trackId})` : `Cached Track (${entry.trackId})`}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] font-mono">
                            {formatStorageBytes(entry.sizeBytes)} · {isNy ? 'Yasungidwa pafoni' : 'Cached locally'}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await removeTrackOfflineCache(entry.trackId);
                          await loadOffline();
                        }}
                        className="p-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                        title={isNy ? 'Chotsani nyimbo pafoni' : 'Remove cached file'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }

                const cachedDate = entry.timestamp
                  ? new Date(entry.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';

                return renderTrackRow(
                  track,
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-text)] text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('library_offline')}</span>
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                      {formatStorageBytes(entry.sizeBytes)}
                      {cachedDate ? ` · ${cachedDate}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await removeTrackOfflineCache(entry.trackId);
                        await loadOffline();
                      }}
                      className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                      title={isNy ? 'Fufutani yotsitsidwa' : 'Delete download'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Download Suggestions from Saved / Liked Songs */}
          {suggestedForOffline.length > 0 && (
            <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5 space-y-3">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {isNy ? 'Zokonzeka Kusungidwa Popanda Intaneti' : 'Ready to Save Offline'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  {isNy
                    ? 'Kuchokera ku nyimbo zanu zosungidwa ndi zokondedwa zomwe sizinatsitsidwe pafoni'
                    : 'From your saved and liked songs not yet stored on this device'}
                </p>
              </div>
              <div className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] overflow-hidden">
                {suggestedForOffline.map((track) => {
                  const isDownloadingThis = activeDownload?.trackId === track.id;
                  return renderTrackRow(
                    track,
                    <button
                      type="button"
                      disabled={isDownloadingThis}
                      onClick={() => downloadTrack(track)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--accent)]/15 hover:bg-[var(--accent)]/25 border border-[var(--accent)]/30 text-[var(--accent-text)] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>
                        {isDownloadingThis ? `${activeDownload?.progress || 0}%` : t('download')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ARTISTS I FOLLOW */}
      {activeTab === 'following' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">
                {isNy ? 'Oimba Omwe Ndimatsatira' : 'Artists I Follow'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? 'Oimba omwe mumawatsatira aonekera pano kuti mumvere mosavuta ndi kudziwa nyimbo zatsopano.'
                  : 'Artists you follow appear here for fast listening and release updates.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/artists')}
              className="px-3.5 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:border-[var(--border-strong)] cursor-pointer shrink-0"
            >
              {isNy ? 'Onani oimba' : 'Browse artists'}
            </button>
          </div>

          {!currentUser ? (
            <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)]">
              <EmptyBox
                icon={UserCheck}
                title={isNy ? 'Lowani kuti muwone oimba omwe mumatsatira' : 'Sign in to see Artists I Follow'}
                subtitle={
                  isNy
                    ? 'Tsatirani oimba omwe mumakonda ndipo bwererani ku nyimbo zawo nthawi iliyonse.'
                    : 'Follow your favorite artists and jump back into their music anytime.'
                }
                cta={t('sign_in')}
                onCta={() => navigate('/login')}
              />
            </div>
          ) : followingArtists.length === 0 ? (
            <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)]">
              <EmptyBox
                icon={UserCheck}
                title={isNy ? 'Simukutsatira woimba aliyense' : 'Not following any artists yet'}
                subtitle={
                  isNy
                    ? 'Dinani Tsatirani pa tsamba la woimba aliyense kuti mupange mndandanda wanu pano.'
                    : 'Tap Follow on any artist page to build your list here.'
                }
                cta={isNy ? 'Pezani oimba' : 'Find artists'}
                onCta={() => navigate('/artists')}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {followingArtists.map((a) => {
                const topTrack = tracks
                  .filter((tr) => !tr.isDraft && !tr.isDeranked && tr.artistId === a.id)
                  .sort((x, y) => (y.plays || 0) - (x.plays || 0))[0];
                const isArtistPlaying = Boolean(
                  topTrack && currentTrack?.id === topTrack.id && isPlaying
                );

                return (
                  <div
                    key={a.id}
                    className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between gap-3 transition"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/artists/${a.slug || a.id}`)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <img
                        src={a.avatar || DEFAULT_AVATAR_SVG}
                        alt={a.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-2xl object-cover border border-[var(--border)] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[var(--text)] truncate">
                          {a.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate">
                          {[a.city, a.country].filter(Boolean).join(', ') || (isNy ? 'Woimba Wodziyimira Yekha' : 'Independent Artist')}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">
                          {(a.followersCount || 0).toLocaleString()} {isNy ? 'otsatira' : 'followers'}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {topTrack && (
                        <button
                          type="button"
                          onClick={() =>
                            currentTrack?.id === topTrack.id
                              ? togglePlayPause()
                              : playTrack(topTrack)
                          }
                          title={isArtistPlaying ? `${t('pause')} ${a.name}` : `${t('play')} ${a.name}`}
                          className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center cursor-pointer"
                        >
                          {isArtistPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleFollowArtist(a.id)}
                        className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)] text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer transition"
                      >
                        {t('unfollow')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {playHistory.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? 'Mbiri yanu yomvera imapanga mndandanda wa Pitilizani kumvera.'
                  : 'Your recently played songs appear here and in Continue listening.'}
              </p>
              {!confirmClearHistory ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearHistory(true)}
                  className="px-3.5 py-2 rounded-full bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--danger)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer transition min-h-[40px]"
                >
                  {t('clear_history', 'Clear history')}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearHistory(false)}
                    className="px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      setConfirmClearHistory(false);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                  >
                    {isNy ? 'Fufutani zonse' : 'Confirm clear'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-[22px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
            {playHistory.length === 0 ? (
              <EmptyBox
                icon={Clock}
                title={isNy ? 'Palibe mbiri yakale pakadali pano' : 'No listening history yet'}
                subtitle={
                  isNy
                    ? 'Nyimbo zomwe mumamvera zionekera pano kuti mubwerere mosavuta.'
                    : 'Songs you play appear here so you can easily jump back in.'
                }
                cta={isNy ? 'Lizani nyimbo' : 'Play something'}
                onCta={() => navigate('/')}
              />
            ) : (
              playHistory.map((item) => renderTrackRow(item.track))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyBox: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  cta: string;
  onCta: () => void;
}> = ({ icon: Icon, title, subtitle, cta, onCta }) => (
  <div className="p-10 text-center space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
      <Icon className="w-6 h-6" />
    </div>
    <div className="space-y-1">
      <h3 className="text-sm font-bold text-[var(--text)]">{title}</h3>
      <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">{subtitle}</p>
    </div>
    <button
      type="button"
      onClick={onCta}
      className="px-5 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
    >
      {cta}
    </button>
  </div>
);
