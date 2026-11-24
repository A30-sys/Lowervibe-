import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  Gauge,
  Heart,
  ListMusic,
  ListPlus,
  MessageCircle,
  MessageSquare,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Send,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { AudioQualityPreference, isTrackLosslessSource, useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import { ExtractedPalette, extractDominantColor } from '../utils/colorExtract';
import { formatTime, getTrackLikeCount, isTrackLikedByUser } from '../utils/formatters';
import { translateGenreCategory } from '../utils/genreCategories';
import { parseLrc } from '../utils/lrcParser';

export const FullscreenPlayerModal: React.FC = () => {
  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreenPlayerOpen,
    setIsFullscreenPlayerOpen,
    togglePlayPause,
    seekTo,
    playNextTrack,
    playPrevTrack,
    repeatMode,
    cycleRepeatMode,
    isShuffling,
    toggleShuffle,
    setVolume,
    toggleMute,
    downloadTrack,
    setActiveShareTrack,
    openPlaylistModal,
    playTrack,
    queue,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    crossfadeSeconds,
    setCrossfadeSeconds,
    playbackRate,
    setPlaybackRate,
    audioQuality,
    effectiveAudioQuality,
    estimatedMbPerMinute,
    setAudioQuality,
    playbackError,
    retryPlayback,
    sleepTimerMinutes,
    sleepAtEndOfTrack,
    sleepTimerRemainingSeconds,
    setSleepTimer,
    setSleepAtEndOfTrack,
    cancelSleepTimer,
    addCommentToTrack,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const isNy = language === 'ny';

  const [activeTab, setActiveTab] = useState<'playing' | 'queue' | 'lyrics' | 'comments'>('playing');
  const [commentText, setCommentText] = useState('');
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [likePopping, setLikePopping] = useState(false);
  const [palette, setPalette] = useState<ExtractedPalette>({
    primary: 'rgba(124, 92, 255, 0.34)',
    secondary: 'rgba(198, 255, 61, 0.14)',
  });
  const [openDrawer, setOpenDrawer] = useState<'sleep' | 'speed' | 'quality' | null>(null);

  const parsedLyrics = useMemo(() => parseLrc(currentTrack?.lyrics), [currentTrack?.lyrics]);
  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.isSynced || parsedLyrics.lines.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.lines.length; i++) {
      if (currentTime >= parsedLyrics.lines[i].timeSeconds) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [parsedLyrics, currentTime]);

  // Extract dominant color from album cover for background tint
  useEffect(() => {
    let active = true;
    if (!currentTrack?.coverArt) {
      setPalette({
        primary: 'rgba(124, 92, 255, 0.34)',
        secondary: 'rgba(198, 255, 61, 0.14)',
      });
      return;
    }
    extractDominantColor(currentTrack.coverArt).then((result) => {
      if (active) setPalette(result);
    });
    return () => {
      active = false;
    };
  }, [currentTrack?.coverArt]);

  // If user switched to a track with no lyrics while on lyrics tab, fall back to playing
  useEffect(() => {
    if (activeTab === 'lyrics' && !parsedLyrics.hasLyrics) {
      setActiveTab('playing');
    }
  }, [activeTab, parsedLyrics.hasLyrics]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenPlayerOpen) {
        setIsFullscreenPlayerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen]);

  if (!isFullscreenPlayerOpen || !currentTrack) return null;

  const isLiked = isTrackLikedByUser(currentTrack, currentUser);
  const likeCount = getTrackLikeCount(currentTrack);
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const losslessAvailable = isTrackLosslessSource(currentTrack);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only capture swipe down when at scroll top or on non-scrollable header area
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const diff = e.touches[0].clientY - touchStartY;
    if (diff > 0) setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (dragOffset > 80) {
      setIsFullscreenPlayerOpen(false);
    }
    setTouchStartY(null);
    setDragOffset(0);
  };

  const handleLike = () => {
    setLikePopping(true);
    setTimeout(() => setLikePopping(false), 240);
    toggleLikeTrack(currentTrack.id);
    showToast(isLiked ? t('removed_from_liked') : t('added_to_liked'));
  };

  const handleOpenArtist = () => {
    const artist = artists.find((a) => a.id === currentTrack.artistId);
    setIsFullscreenPlayerOpen(false);
    navigate(`/artists/${artist?.slug || currentTrack.artistId}`);
  };

  const handleWhatsAppShare = () => {
    const shareUrl = `${window.location.origin}?track=${currentTrack.id}`;
    const text = isNy
      ? `Mverani "${currentTrack.title}" ya ${currentTrack.artistName} pa LOWERVIBE: ${shareUrl}`
      : `Listen to "${currentTrack.title}" by ${currentTrack.artistName} on LOWERVIBE: ${shareUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.location.href = waUrl;
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addCommentToTrack(currentTrack.id, {
      userId: currentUser?.id || 'guest',
      userName: currentUser?.name || t('listener'),
      userAvatar: currentUser?.avatar || DEFAULT_AVATAR_SVG,
      timestampSeconds: Math.floor(currentTime),
      content: commentText.trim(),
    });
    setCommentText('');
    showToast(isNy ? 'Ndemanga yawonjezedwa' : 'Comment added');
  };

  const tabs: { id: 'playing' | 'queue' | 'lyrics' | 'comments'; label: string }[] = [
    { id: 'playing', label: isNy ? 'Ikulira' : 'Playing' },
    { id: 'queue', label: isNy ? `Mndandanda (${queue.length})` : `Queue (${queue.length})` },
    ...(parsedLyrics.hasLyrics ? [{ id: 'lyrics' as const, label: t('lyrics') }] : []),
    {
      id: 'comments',
      label: isNy
        ? `Ndemanga (${currentTrack.comments?.length || 0})`
        : `Comments (${currentTrack.comments?.length || 0})`,
    },
  ];

  const qualityOptions: { id: AudioQualityPreference; label: string; desc: string }[] = [
    {
      id: 'auto',
      label: isNy ? 'Yokha (Auto)' : 'Auto',
      desc: isNy
        ? `Imasintha malinga ndi intaneti (${effectiveAudioQuality})`
        : `Adapts to network (${effectiveAudioQuality})`,
    },
    { id: 'high', label: isNy ? 'Wapamwamba' : 'High', desc: '~1.8 MB/min' },
    { id: 'saver', label: isNy ? 'Kusunga Deta' : 'Data Saver', desc: '~0.6 MB/min' },
    ...(losslessAvailable
      ? [
          {
            id: 'lossless' as const,
            label: isNy ? 'Lossless (Woyamba)' : 'Lossless',
            desc: isNy ? '~6.5 MB/min · Fayilo yoyambirira' : '~6.5 MB/min · Original file',
          },
        ]
      : []),
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full screen music player"
      className="fixed inset-0 z-50 bg-[#0A0B0A] text-[#F4F5F3] flex flex-col justify-between p-4 sm:p-6 pb-[calc(16px+env(safe-area-inset-bottom,0px))] select-none animate-fadeIn overflow-y-auto transition-transform duration-150"
      style={{
        transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Dynamic cover tint + high-contrast dark scrim */}
      <div
        className="fixed inset-0 pointer-events-none transition-all duration-500"
        style={{
          background: `radial-gradient(circle at 50% 18%, ${palette.primary} 0%, ${palette.secondary} 36%, rgba(10, 11, 10, 0.94) 72%, #0A0B0A 100%)`,
        }}
      />

      {/* Top Header */}
      <div className="relative z-10 w-full max-w-lg mx-auto space-y-3">
        <div
          className="w-10 h-1 rounded-full bg-white/25 mx-auto sm:hidden cursor-pointer"
          onClick={() => setIsFullscreenPlayerOpen(false)}
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsFullscreenPlayerOpen(false)}
            className="rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/10 transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            title={isNy ? 'Chepetsani choleretsa' : 'Minimize player'}
            aria-label={t('close_player')}
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {/* Clean Tab Switcher (no horizontal clipping) */}
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-2xl border border-white/10 overflow-x-auto scrollbar-none max-w-full">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer min-h-[36px] ${
                  activeTab === tab.id
                    ? 'bg-[#C6FF3D] text-[#0A0B0A] font-bold'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActiveShareTrack(currentTrack)}
            className="rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/10 transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
            title={t('share')}
            aria-label={t('share')}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-lg mx-auto my-auto py-4">
        {activeTab === 'playing' && (
          <div className="space-y-5">
            {/* Hero Cover Artwork (clean artwork only — no badge overlays) */}
            <div className="w-64 h-64 sm:w-80 sm:h-80 mx-auto rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.7)] border border-white/10 bg-[#131513]">
              <img
                src={currentTrack.coverArt || DEFAULT_ARTWORK_SVG}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                }}
                className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                  isPlaying ? 'scale-[1.02]' : 'scale-100'
                }`}
              />
            </div>

            {/* Playback error alert */}
            {playbackError && (
              <div className="p-3 rounded-2xl bg-[#FF5C6C]/15 border border-[#FF5C6C]/35 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#FF5C6C] font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{playbackError}</span>
                </div>
                <button
                  type="button"
                  onClick={retryPlayback}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('try_again')}</span>
                </button>
              </div>
            )}

            {/* Full 2-line Title + Artist + Single Like + Playlist */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-white leading-snug line-clamp-2">
                  {currentTrack.title}
                </h1>
                <button
                  type="button"
                  onClick={handleOpenArtist}
                  className="text-sm font-medium text-white/75 hover:text-white mt-1 cursor-pointer text-left truncate max-w-full block"
                >
                  {currentTrack.artistName}
                  {currentTrack.genre
                    ? ` · ${translateGenreCategory(currentTrack.genre, language)}`
                    : ''}
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleLike}
                  className={`flex items-center gap-1.5 px-3 rounded-2xl border transition active:scale-95 cursor-pointer min-h-[48px] ${
                    isLiked
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : 'bg-white/10 border-white/10 text-white/80 hover:text-white'
                  }`}
                  aria-label={isLiked ? t('unlike') : t('like')}
                >
                  <Heart
                    className={`w-5 h-5 ${isLiked ? 'fill-rose-400' : ''} ${
                      likePopping ? 'animate-heart-pop' : ''
                    }`}
                  />
                  <span className="font-mono text-xs font-bold tabular-nums">{likeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openPlaylistModal(currentTrack)}
                  className="rounded-2xl bg-white/10 border border-white/10 text-white/80 hover:text-white transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
                  title={t('add_to_playlist')}
                  aria-label={t('add_to_playlist')}
                >
                  <ListPlus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Real Seek Scrubber + Time Labels */}
            <div className="space-y-2">
              <div className="relative h-6 flex items-center">
                <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#C6FF3D] rounded-full transition-[width] duration-150 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.2"
                  value={progressPercent}
                  onChange={(e) => {
                    if (duration > 0) seekTo((parseFloat(e.target.value) / 100) * duration);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Seek audio timeline"
                />
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-white/70">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
              </div>
            </div>

            {/* Primary Transport Controls */}
            <div className="flex items-center justify-between px-2">
              <button
                type="button"
                onClick={toggleShuffle}
                className={`rounded-2xl transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center ${
                  isShuffling ? 'text-[#C6FF3D]' : 'text-white/70 hover:text-white'
                }`}
                title="Shuffle"
                aria-label="Toggle shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={playPrevTrack}
                className="text-white/85 hover:text-white transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
                title={t('previous')}
                aria-label={t('previous')}
              >
                <SkipBack className="w-7 h-7 fill-current" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="w-16 h-16 rounded-full bg-[#C6FF3D] text-[#0A0B0A] flex items-center justify-center hover:brightness-95 active:scale-95 transition cursor-pointer shadow-xl"
                title={isPlaying ? t('pause') : t('play')}
                aria-label={isPlaying ? t('pause') : t('play')}
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-[#0A0B0A]" />
                ) : (
                  <Play className="w-7 h-7 fill-[#0A0B0A] ml-1" />
                )}
              </button>

              <button
                type="button"
                onClick={playNextTrack}
                className="text-white/85 hover:text-white transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
                title={t('next_track')}
                aria-label={t('next_track')}
              >
                <SkipForward className="w-7 h-7 fill-current" />
              </button>

              <button
                type="button"
                onClick={cycleRepeatMode}
                className={`rounded-2xl transition active:scale-95 cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center relative ${
                  repeatMode !== 'off' ? 'text-[#C6FF3D]' : 'text-white/70 hover:text-white'
                }`}
                title={`${t('repeat')}: ${repeatMode}`}
                aria-label={`${t('repeat')}: ${repeatMode}`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Volume + Quick Utility Row (Sleep Timer, Speed, Quality, WhatsApp Share, Save Offline) */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3 px-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="text-white/70 hover:text-white cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label={isMuted ? (isNy ? 'Yatsani phokoso' : 'Unmute') : (isNy ? 'Zimitsani phokoso' : 'Mute')}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-[#FF5C6C]" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 rounded-full bg-white/15 accent-[#7C5CFF] cursor-pointer"
                  aria-label={isNy ? 'Phokoso' : 'Volume'}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpenDrawer(openDrawer === 'sleep' ? null : 'sleep')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border transition cursor-pointer min-h-[44px] ${
                    sleepTimerRemainingSeconds !== null || sleepAtEndOfTrack
                      ? 'bg-[#C6FF3D]/15 border-[#C6FF3D]/40 text-[#C6FF3D]'
                      : 'bg-white/10 border-white/10 text-white/80 hover:text-white'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>
                    {sleepAtEndOfTrack
                      ? t('timer_end_of_track')
                      : sleepTimerRemainingSeconds !== null
                      ? formatTime(sleepTimerRemainingSeconds)
                      : t('sleep_timer')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenDrawer(openDrawer === 'speed' ? null : 'speed')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border transition cursor-pointer min-h-[44px] ${
                    playbackRate !== 1
                      ? 'bg-[#7C5CFF]/25 border-[#7C5CFF]/50 text-white'
                      : 'bg-white/10 border-white/10 text-white/80 hover:text-white'
                  }`}
                >
                  <Gauge className="w-4 h-4" />
                  <span className="font-mono">{playbackRate}x</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenDrawer(openDrawer === 'quality' ? null : 'quality')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-white/10 border border-white/10 text-white/80 hover:text-white transition cursor-pointer min-h-[44px]"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="capitalize">
                    {audioQuality === 'saver'
                      ? isNy ? 'Kusunga Deta' : 'Data Saver'
                      : audioQuality === 'auto'
                      ? isNy ? 'Yokha' : 'Auto'
                      : audioQuality === 'high'
                      ? isNy ? 'Wapamwamba' : 'High'
                      : audioQuality}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-white/10 border border-white/10 text-white/80 hover:text-white transition cursor-pointer min-h-[44px]"
                  title={isNy ? 'Gawani pa WhatsApp' : 'Share on WhatsApp'}
                >
                  <MessageCircle className="w-4 h-4 text-[#C6FF3D]" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadTrack(currentTrack);
                    showToast(isNy ? 'Ikusunga kuti muzimvera popanda intaneti' : 'Saving for offline playback');
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold bg-white/10 border border-white/10 text-white/80 hover:text-white transition cursor-pointer min-h-[44px]"
                  title={isNy ? 'Sungani popanda intaneti' : 'Save offline'}
                >
                  <Download className="w-4 h-4" />
                  <span>{t('save')}</span>
                </button>
              </div>

              {/* Contextual Option Drawer (Sleep / Speed / Quality) */}
              {openDrawer === 'sleep' && (
                <div className="p-3.5 rounded-2xl bg-[#131513] border border-white/15 space-y-2.5 animate-slideUp">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {isNy ? 'Imitsani nyimbo yokha' : 'Stop audio automatically'}
                    </span>
                    {(sleepTimerRemainingSeconds !== null || sleepAtEndOfTrack) && (
                      <button
                        type="button"
                        onClick={() => {
                          cancelSleepTimer();
                          setOpenDrawer(null);
                          showToast(isNy ? 'Nthawi yoimitsa yazimitsidwa' : 'Sleep timer turned off');
                        }}
                        className="text-xs font-semibold text-[#FF5C6C] cursor-pointer"
                      >
                        {isNy ? 'Zimitsani' : 'Turn off'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setSleepTimer(mins);
                          setOpenDrawer(null);
                          showToast(
                            isNy
                              ? `Nyimbo iima pakatha mphindi ${mins}`
                              : `Sleep timer set for ${mins} min`
                          );
                        }}
                        className={`py-2 rounded-xl text-xs font-mono font-bold cursor-pointer min-h-[44px] ${
                          sleepTimerMinutes === mins
                            ? 'bg-[#C6FF3D] text-[#0A0B0A]'
                            : 'bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setSleepAtEndOfTrack(true);
                        setOpenDrawer(null);
                        showToast(
                          isNy ? 'Nyimbo iima ikatha iyi' : 'Playback will stop after this song'
                        );
                      }}
                      className={`col-span-2 py-2 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px] ${
                        sleepAtEndOfTrack
                          ? 'bg-[#C6FF3D] text-[#0A0B0A]'
                          : 'bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {t('timer_end_of_track')}
                    </button>
                  </div>
                </div>
              )}

              {openDrawer === 'speed' && (
                <div className="p-3.5 rounded-2xl bg-[#131513] border border-white/15 space-y-2.5 animate-slideUp">
                  <span className="text-xs font-bold text-white block">
                    {isNy ? 'Liwiro la nyimbo' : 'Playback speed'}
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {[0.85, 1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(rate);
                          setOpenDrawer(null);
                        }}
                        className={`py-2 rounded-xl text-xs font-mono font-bold cursor-pointer min-h-[44px] ${
                          playbackRate === rate
                            ? 'bg-[#C6FF3D] text-[#0A0B0A]'
                            : 'bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {openDrawer === 'quality' && (
                <div className="p-3.5 rounded-2xl bg-[#131513] border border-white/15 space-y-2 animate-slideUp">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{t('audio_quality')}</span>
                    <span className="text-[11px] font-mono text-white/60">
                      ~{estimatedMbPerMinute.toFixed(1)} MB/min
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {qualityOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setAudioQuality(opt.id);
                          setOpenDrawer(null);
                          showToast(`${t('audio_quality')}: ${opt.label}`);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition cursor-pointer min-h-[44px] ${
                          audioQuality === opt.id
                            ? 'bg-[#C6FF3D] text-[#0A0B0A] font-bold'
                            : 'bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span
                          className={`font-mono text-[11px] ${
                            audioQuality === opt.id ? 'text-[#0A0B0A]/80' : 'text-white/65'
                          }`}
                        >
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUEUE & CROSSFADE TAB */}
        {activeTab === 'queue' && (
          <div className="rounded-[24px] bg-[#131513] border border-white/10 p-4 flex flex-col gap-4 max-h-[68vh]">
            {/* Real Crossfade Control (0-12s, default Off) */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  {isNy ? 'Kusakaniza pakati pa nyimbo' : 'Crossfade'}
                </span>
                <span className="font-mono font-bold text-[#C6FF3D]">
                  {crossfadeSeconds === 0 ? t('timer_off') : `${crossfadeSeconds}s`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={crossfadeSeconds}
                onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
                className="w-full h-1.5 rounded-full bg-white/15 accent-[#C6FF3D] cursor-pointer"
                aria-label={isNy ? 'Masekondi okonza kusakaniza' : 'Crossfade duration in seconds'}
              />
              <p className="text-[11px] text-white/60">
                {isNy
                  ? 'Nyimbo za m\'chimbale chimodzi zimalira mosaduka.'
                  : 'Tracks from the same release always play gapless.'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ListMusic className="w-4 h-4 text-[#C6FF3D]" />
                <span>{t('up_next')}</span>
              </div>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={clearQueue}
                  className="text-xs font-semibold text-white/65 hover:text-white cursor-pointer"
                >
                  {isNy ? 'Fufutani mndandanda' : 'Clear queue'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {(queue.length > 0 ? queue : tracks.filter((t) => t.id !== currentTrack.id)).length === 0 ? (
                <div className="py-10 text-center text-xs text-white/60">
                  {t('queue_empty')}
                </div>
              ) : (
                (queue.length > 0 ? queue : tracks.filter((t) => t.id !== currentTrack.id)).map(
                  (t, idx, arr) => {
                    const isCustomQueue = queue.length > 0;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 transition"
                      >
                        <button
                          type="button"
                          onClick={() => playTrack(t)}
                          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <img
                            src={t.coverArt || DEFAULT_ARTWORK_SVG}
                            alt={t.title}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-xl object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white line-clamp-1">{t.title}</p>
                            <p className="text-[11px] text-white/60 truncate">{t.artistName}</p>
                          </div>
                        </button>

                        {isCustomQueue && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => reorderQueue(idx, idx - 1)}
                              className="p-2 text-white/60 hover:text-white disabled:opacity-25 cursor-pointer"
                              aria-label="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => reorderQueue(idx, idx + 1)}
                              className="p-2 text-white/60 hover:text-white disabled:opacity-25 cursor-pointer"
                              aria-label="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromQueue(idx)}
                              className="p-2 text-white/60 hover:text-[#FF5C6C] cursor-pointer"
                              aria-label="Remove from queue"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                )
              )}
            </div>
          </div>
        )}

        {/* SYNCED LYRICS TAB (Only mounted when track actually has lyrics) */}
        {activeTab === 'lyrics' && parsedLyrics.hasLyrics && (
          <div className="rounded-[24px] bg-[#131513] border border-white/10 p-5 max-h-[68vh] overflow-y-auto space-y-3">
            {parsedLyrics.isSynced
              ? parsedLyrics.lines.map((line, idx) => {
                  const isActiveLine = idx === activeLyricIndex;
                  return (
                    <button
                      key={`${idx}-${line.timeSeconds}`}
                      type="button"
                      onClick={() => seekTo(line.timeSeconds)}
                      className={`block w-full text-left text-base sm:text-lg font-bold transition leading-relaxed cursor-pointer ${
                        isActiveLine ? 'text-[#C6FF3D]' : 'text-white/55 hover:text-white/85'
                      }`}
                    >
                      {line.text}
                    </button>
                  );
                })
              : parsedLyrics.plainLines.map((line, idx) => (
                  <p
                    key={`${idx}-${line.slice(0, 12)}`}
                    className="text-base sm:text-lg font-semibold text-white/85 leading-relaxed"
                  >
                    {line}
                  </p>
                ))}
          </div>
        )}

        {/* COMMENTS TAB */}
        {activeTab === 'comments' && (
          <div className="rounded-[24px] bg-[#131513] border border-white/10 p-4 flex flex-col gap-3 max-h-[68vh]">
            <div className="flex items-center gap-2 text-xs font-bold text-white pb-2 border-b border-white/10">
              <MessageSquare className="w-4 h-4 text-[#7C5CFF]" />
              <span>{isNy ? 'Ndemanga za omvera' : 'Listener notes'}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[180px]">
              {(currentTrack.comments || []).length === 0 ? (
                <div className="py-10 text-center text-xs text-white/60">
                  {isNy
                    ? 'Khalani woyamba kulemba ndemanga pa nyimboyi.'
                    : 'Be the first to leave a note on this track.'}
                </div>
              ) : (
                currentTrack.comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <img
                          src={c.userAvatar || DEFAULT_AVATAR_SVG}
                          alt={c.userName}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="font-bold text-white">{c.userName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => seekTo(c.timestampSeconds)}
                        className="font-mono text-[11px] font-bold text-[#C6FF3D] cursor-pointer"
                      >
                        {formatTime(c.timestampSeconds)}
                      </button>
                    </div>
                    <p className="text-xs text-white/85 leading-relaxed">{c.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handlePostComment} className="flex items-center gap-2 pt-2 border-t border-white/10">
              <input
                type="text"
                placeholder={
                  isNy
                    ? `Lembani ndemanga pa ${formatTime(currentTime)}...`
                    : `Write a comment at ${formatTime(currentTime)}...`
                }
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-white/10 border border-white/15 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-[#C6FF3D] min-h-[44px]"
              />
              <button
                type="submit"
                className="w-11 h-11 rounded-2xl bg-[#C6FF3D] text-[#0A0B0A] flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={isNy ? 'Tumizani ndemanga' : 'Send comment'}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom spacer for thumb comfort */}
      <div className="h-2 shrink-0" />
    </div>
  );
};
