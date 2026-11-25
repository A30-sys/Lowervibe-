import {
  AlertCircle,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Flag,
  Gauge,
  Heart,
  ListMusic,
  ListPlus,
  Loader2,
  Maximize2,
  MessageCircle,
  MessageSquare,
  Minimize2,
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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AudioQualityPreference, isTrackLosslessSource, useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { fetchTrackLyrics, ResolvedTrackLyrics } from '../services/lyricsService';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import { ExtractedPalette, extractDominantColor } from '../utils/colorExtract';
import { formatTime, getTrackLikeCount, isTrackLikedByUser } from '../utils/formatters';
import { translateGenreCategory } from '../utils/genreCategories';
import { triggerHaptic } from '../utils/haptics';
import { parseLrc } from '../utils/lrcParser';
import { getShortTrackShareUrl } from '../utils/shareLinks';
import { LowervibeCornerWatermark } from './brand/LowerVibeLogo';

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
    playHistory,
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
    deleteTrackComment,
    moderateTrackComment,
    submitContentReportRecord,
  } = useAudio();

  const { currentUser, isAdmin, toggleLikeTrack } = useAuth();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const isNy = language === 'ny';

  const [activeTab, setActiveTab] = useState<'playing' | 'queue' | 'lyrics' | 'comments'>('playing');
  const [commentText, setCommentText] = useState('');
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [artSwipeX, setArtSwipeX] = useState<number>(0);
  const [isArtDragging, setIsArtDragging] = useState<boolean>(false);
  const [artSlideDir, setArtSlideDir] = useState<'next' | 'prev' | null>(null);
  const artTouchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const artGestureAxisRef = useRef<'horizontal' | 'vertical' | null>(null);
  const artCommitTimerRef = useRef<number | null>(null);
  const pendingSlideDirRef = useRef<'next' | 'prev' | null>(null);
  const prevTrackIdRef = useRef<string | null>(null);
  const [likePopping, setLikePopping] = useState(false);
  const [palette, setPalette] = useState<ExtractedPalette>({
    primary: 'rgba(124, 92, 255, 0.34)',
    secondary: 'rgba(198, 255, 61, 0.14)',
  });
  const [openDrawer, setOpenDrawer] = useState<'sleep' | 'speed' | 'quality' | null>(null);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [resolvedLyrics, setResolvedLyrics] = useState<ResolvedTrackLyrics | null>(null);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [lyricsRetryTick, setLyricsRetryTick] = useState(0);
  const [manualScrollPaused, setManualScrollPaused] = useState(false);
  const activeLyricLineRef = useRef<HTMLButtonElement | null>(null);
  const manualScrollTimerRef = useRef<number | null>(null);

  const localParsedLyrics = useMemo(() => parseLrc(currentTrack?.lyrics), [currentTrack?.lyrics]);
  const parsedLyrics =
    resolvedLyrics && resolvedLyrics.trackId === currentTrack?.id
      ? resolvedLyrics.parsed
      : localParsedLyrics;
  const lyricsSource =
    resolvedLyrics && resolvedLyrics.trackId === currentTrack?.id
      ? resolvedLyrics.source
      : localParsedLyrics.hasLyrics
      ? 'track'
      : 'none';

  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.isSynced || parsedLyrics.lines.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.lines.length; i++) {
      if (currentTime + 0.15 >= parsedLyrics.lines[i].timeSeconds) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [parsedLyrics, currentTime]);

  // Fetch synced lyrics whenever FullscreenPlayer is open for a track (with abort & cache)
  useEffect(() => {
    if (!isFullscreenPlayerOpen || !currentTrack) return;
    if (!isLyricsExpanded && activeTab !== 'lyrics' && !currentTrack.lyrics) return;

    const controller = new AbortController();
    let active = true;
    setIsFetchingLyrics(true);

    fetchTrackLyrics(currentTrack, {
      forceRefresh: lyricsRetryTick > 0,
      signal: controller.signal,
    })
      .then((res) => {
        if (active) setResolvedLyrics(res);
      })
      .finally(() => {
        if (active) setIsFetchingLyrics(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isFullscreenPlayerOpen, currentTrack?.id, isLyricsExpanded, activeTab, lyricsRetryTick]);

  // Auto-scroll active synced line into center view unless user just scrolled manually
  useEffect(() => {
    if (!isFullscreenPlayerOpen || (!isLyricsExpanded && activeTab !== 'lyrics')) return;
    if (manualScrollPaused || activeLyricIndex < 0) return;
    activeLyricLineRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [activeLyricIndex, isFullscreenPlayerOpen, isLyricsExpanded, activeTab, manualScrollPaused]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreenPlayerOpen) {
        setIsFullscreenPlayerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen]);

  const playableTracks = useMemo(
    () => tracks.filter((t) => !t.isDraft && !t.isDeranked),
    [tracks]
  );

  const nextTrackCandidate = useMemo(() => {
    if (!currentTrack) return null;
    const queued = queue.find((t) => !t.isDraft && !t.isDeranked && t.id !== currentTrack.id);
    if (queued) return queued;
    if (playableTracks.length <= 1) return null;
    const idx = playableTracks.findIndex((t) => t.id === currentTrack.id);
    if (idx >= 0) {
      const candidate = playableTracks[(idx + 1) % playableTracks.length];
      return candidate && candidate.id !== currentTrack.id ? candidate : null;
    }
    return playableTracks[0]?.id !== currentTrack.id ? playableTracks[0] || null : null;
  }, [currentTrack, queue, playableTracks]);

  const prevTrackCandidate = useMemo(() => {
    if (!currentTrack) return null;
    const recentPrev = playHistory.find(
      (item) => item.trackId !== currentTrack.id && !item.track.isDraft && !item.track.isDeranked
    )?.track;
    if (playableTracks.length <= 1) return recentPrev || null;
    const idx = playableTracks.findIndex((t) => t.id === currentTrack.id);
    if (idx >= 0) {
      const candidate = playableTracks[(idx - 1 + playableTracks.length) % playableTracks.length];
      if (candidate && candidate.id !== currentTrack.id) return candidate;
    }
    return recentPrev || null;
  }, [currentTrack, playableTracks, playHistory]);

  useEffect(() => {
    const nextId = currentTrack?.id || null;
    if (prevTrackIdRef.current && nextId && prevTrackIdRef.current !== nextId) {
      const dir = pendingSlideDirRef.current || 'next';
      pendingSlideDirRef.current = null;
      setArtSlideDir(dir);
      const timer = window.setTimeout(() => setArtSlideDir(null), 300);
      prevTrackIdRef.current = nextId;
      return () => window.clearTimeout(timer);
    }
    prevTrackIdRef.current = nextId;
  }, [currentTrack?.id]);

  useEffect(() => {
    return () => {
      if (artCommitTimerRef.current !== null) {
        window.clearTimeout(artCommitTimerRef.current);
      }
      if (manualScrollTimerRef.current !== null) {
        window.clearTimeout(manualScrollTimerRef.current);
      }
    };
  }, []);

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

  const resetArtSwipe = () => {
    artTouchStartRef.current = null;
    artGestureAxisRef.current = null;
    setIsArtDragging(false);
    setArtSwipeX(0);
  };

  const triggerSlideSkip = (direction: 'next' | 'prev') => {
    pendingSlideDirRef.current = direction;
    triggerHaptic('tap');
    if (direction === 'next') {
      if (queue.length > 0 || !isShuffling) {
        playNextTrack();
      } else if (nextTrackCandidate) {
        playTrack(nextTrackCandidate, { crossfade: true });
      } else {
        playNextTrack();
      }
    } else if (prevTrackCandidate) {
      playTrack(prevTrackCandidate, { crossfade: true });
    } else {
      playPrevTrack();
    }
  };

  const finishArtSwipe = (deltaX: number, startTime: number) => {
    const elapsed = Math.max(1, Date.now() - startTime);
    const velocity = Math.abs(deltaX) / elapsed;
    const triggered = Math.abs(deltaX) > 52 || (Math.abs(deltaX) > 26 && velocity > 0.32);
    const canGoNext = deltaX < 0 && Boolean(nextTrackCandidate);
    const canGoPrev = deltaX > 0 && Boolean(prevTrackCandidate);

    if (triggered && (canGoNext || canGoPrev)) {
      const direction: 'next' | 'prev' = deltaX < 0 ? 'next' : 'prev';
      artTouchStartRef.current = null;
      artGestureAxisRef.current = null;
      setIsArtDragging(false);
      // Slide card smoothly across the stage before switching track so transition has zero snap
      setArtSwipeX(direction === 'next' ? -290 : 290);
      if (artCommitTimerRef.current !== null) {
        window.clearTimeout(artCommitTimerRef.current);
      }
      artCommitTimerRef.current = window.setTimeout(() => {
        artCommitTimerRef.current = null;
        setArtSwipeX(0);
        triggerSlideSkip(direction);
      }, 150);
      return;
    }
    resetArtSwipe();
  };

  const handleArtworkTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (artCommitTimerRef.current !== null) {
      window.clearTimeout(artCommitTimerRef.current);
      artCommitTimerRef.current = null;
    }
    artTouchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    artGestureAxisRef.current = null;
  };

  const handleArtworkTouchMove = (e: React.TouchEvent) => {
    const start = artTouchStartRef.current;
    if (!start || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - start.x;
    const dy = e.touches[0].clientY - start.y;

    if (artGestureAxisRef.current === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (Math.abs(dx) > Math.abs(dy) * 1.1) {
          artGestureAxisRef.current = 'horizontal';
          setIsArtDragging(true);
          setTouchStartY(null);
          setDragOffset(0);
        } else {
          artGestureAxisRef.current = 'vertical';
        }
      }
    }

    if (artGestureAxisRef.current === 'horizontal') {
      e.stopPropagation();
      const maxLeft = nextTrackCandidate ? -260 : -45;
      const maxRight = prevTrackCandidate ? 260 : 45;
      const clamped = Math.max(maxLeft, Math.min(maxRight, dx));
      setArtSwipeX(clamped);
    }
  };

  const handleArtworkTouchEnd = (e: React.TouchEvent) => {
    const start = artTouchStartRef.current;
    if (artGestureAxisRef.current === 'horizontal' && start) {
      e.stopPropagation();
      finishArtSwipe(artSwipeX, start.time);
    } else {
      resetArtSwipe();
    }
  };

  const handleArtworkMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (artCommitTimerRef.current !== null) {
      window.clearTimeout(artCommitTimerRef.current);
      artCommitTimerRef.current = null;
    }
    artTouchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    artGestureAxisRef.current = 'horizontal';
    setIsArtDragging(true);
  };

  const handleArtworkMouseMove = (e: React.MouseEvent) => {
    const start = artTouchStartRef.current;
    if (!start || !isArtDragging) return;
    const dx = e.clientX - start.x;
    const maxLeft = nextTrackCandidate ? -260 : -45;
    const maxRight = prevTrackCandidate ? 260 : 45;
    setArtSwipeX(Math.max(maxLeft, Math.min(maxRight, dx)));
  };

  const handleArtworkMouseUp = () => {
    const start = artTouchStartRef.current;
    if (start && isArtDragging) {
      finishArtSwipe(artSwipeX, start.time);
    } else {
      resetArtSwipe();
    }
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
    const shareUrl = getShortTrackShareUrl(currentTrack.id);
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

  const isTrackOwnerOrAdmin = Boolean(
    isAdmin ||
      (currentUser &&
        (currentTrack.uploadedByUserId === currentUser.id ||
          (currentUser.artistId && currentUser.artistId === currentTrack.artistId)))
  );
  const visibleComments = (currentTrack.comments || []).filter(
    (c) => !c.hiddenByModeration || isTrackOwnerOrAdmin
  );
  const commentsAllowed = currentTrack.allowComments !== false;

  const tabs: { id: 'playing' | 'queue' | 'lyrics' | 'comments'; label: string }[] = [
    { id: 'playing', label: isNy ? 'Ikulira' : 'Playing' },
    { id: 'queue', label: isNy ? `Mndandanda (${queue.length})` : `Queue (${queue.length})` },
    { id: 'lyrics', label: t('lyrics') },
    {
      id: 'comments',
      label: isNy
        ? `Ndemanga (${visibleComments.length})`
        : `Comments (${visibleComments.length})`,
    },
  ];

  const handleToggleExpandLyrics = () => {
    triggerHaptic('tap');
    setManualScrollPaused(false);
    setIsLyricsExpanded((prev) => {
      const next = !prev;
      if (next && activeTab !== 'playing') {
        setActiveTab('playing');
      }
      return next;
    });
  };

  const handleLyricsWheelOrTouch = () => {
    setManualScrollPaused(true);
    if (manualScrollTimerRef.current !== null) {
      window.clearTimeout(manualScrollTimerRef.current);
    }
    manualScrollTimerRef.current = window.setTimeout(() => {
      setManualScrollPaused(false);
    }, 3500);
  };

  const hasUploadedArtwork = Boolean(
    currentTrack.coverArt &&
      currentTrack.coverArt !== DEFAULT_ARTWORK_SVG &&
      !currentTrack.coverArt.startsWith('data:image/svg+xml')
  );

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
            {/* Interactive 3-Card Cover Carousel (shows previous & next song artwork on swipe) */}
            <div
              className="relative w-full overflow-hidden py-1 touch-pan-y cursor-grab active:cursor-grabbing select-none"
              onTouchStart={handleArtworkTouchStart}
              onTouchMove={handleArtworkTouchMove}
              onTouchEnd={handleArtworkTouchEnd}
              onTouchCancel={resetArtSwipe}
              onMouseDown={handleArtworkMouseDown}
              onMouseMove={handleArtworkMouseMove}
              onMouseUp={handleArtworkMouseUp}
              onMouseLeave={() => {
                if (isArtDragging) handleArtworkMouseUp();
              }}
              aria-label={
                isNy
                  ? 'Chithunzi cha nyimbo — kwezani kumanzere kapena kumanja kuona ndi kusintha nyimbo'
                  : 'Album artwork — swipe left or right to preview and switch tracks'
              }
            >
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 mx-auto">
                {/* Previous Song Artwork Slide (slides in from left when swiping right) */}
                {prevTrackCandidate && (
                  <div
                    aria-hidden={artSwipeX <= 8}
                    className={`absolute inset-0 rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.65)] border border-white/10 bg-[#131513] pointer-events-none ${
                      isArtDragging ? 'transition-none' : 'transition-all duration-200 ease-out'
                    }`}
                    style={{
                      transform: `translate3d(calc(-100% - 20px + ${artSwipeX}px), 0, 0) scale(${
                        0.9 + Math.min(0.1, Math.max(0, artSwipeX) / 2600)
                      })`,
                      opacity: artSwipeX > 4 ? Math.min(1, 0.35 + artSwipeX / 220) : 0,
                    }}
                  >
                    <img
                      src={prevTrackCandidate.coverArt || DEFAULT_ARTWORK_SVG}
                      alt={prevTrackCandidate.title}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent">
                      <p className="text-[11px] font-semibold text-[#C6FF3D] flex items-center gap-1.5">
                        <SkipBack className="w-3.5 h-3.5 shrink-0" />
                        <span>{isNy ? "Yam'mbuyo" : 'Previous'}</span>
                      </p>
                      <p className="text-sm font-bold text-white truncate mt-0.5">
                        {prevTrackCandidate.title}
                      </p>
                      <p className="text-xs text-white/75 truncate">
                        {prevTrackCandidate.artistName}
                      </p>
                    </div>
                  </div>
                )}

                {/* Active Song Artwork Slide */}
                <div
                  key={currentTrack.id}
                  className={`relative w-full h-full rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.7)] border border-white/10 bg-[#131513] ${
                    isArtDragging
                      ? 'transition-none'
                      : artSlideDir === 'next'
                      ? 'animate-art-slide-next'
                      : artSlideDir === 'prev'
                      ? 'animate-art-slide-prev'
                      : 'transition-all duration-200 ease-out'
                  }`}
                  style={{
                    transform:
                      artSwipeX !== 0
                        ? `translate3d(${artSwipeX}px, 0, 0) scale(${Math.max(
                            0.91,
                            1 - Math.abs(artSwipeX) / 2200
                          )})`
                        : undefined,
                    opacity:
                      artSwipeX !== 0
                        ? Math.max(0.45, 1 - Math.abs(artSwipeX) / 360)
                        : 1,
                  }}
                >
                  <img
                    src={currentTrack.coverArt || DEFAULT_ARTWORK_SVG}
                    alt={currentTrack.title}
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                    }}
                    className={`w-full h-full object-cover pointer-events-none transition-transform duration-500 ease-out ${
                      isPlaying ? 'scale-[1.02]' : 'scale-100'
                    }`}
                  />
                  {hasUploadedArtwork && (
                    <LowervibeCornerWatermark position="bottom-right" compact={false} />
                  )}
                </div>

                {/* Next Song Artwork Slide (slides in from right when swiping left) */}
                {nextTrackCandidate && (
                  <div
                    aria-hidden={artSwipeX >= -8}
                    className={`absolute inset-0 rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.65)] border border-white/10 bg-[#131513] pointer-events-none ${
                      isArtDragging ? 'transition-none' : 'transition-all duration-200 ease-out'
                    }`}
                    style={{
                      transform: `translate3d(calc(100% + 20px + ${artSwipeX}px), 0, 0) scale(${
                        0.9 + Math.min(0.1, Math.max(0, -artSwipeX) / 2600)
                      })`,
                      opacity: artSwipeX < -4 ? Math.min(1, 0.35 + Math.abs(artSwipeX) / 220) : 0,
                    }}
                  >
                    <img
                      src={nextTrackCandidate.coverArt || DEFAULT_ARTWORK_SVG}
                      alt={nextTrackCandidate.title}
                      draggable={false}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent">
                      <p className="text-[11px] font-semibold text-[#C6FF3D] flex items-center gap-1.5">
                        <SkipForward className="w-3.5 h-3.5 shrink-0" />
                        <span>{isNy ? 'Yotsatira' : 'Up Next'}</span>
                      </p>
                      <p className="text-sm font-bold text-white truncate mt-0.5">
                        {nextTrackCandidate.title}
                      </p>
                      <p className="text-xs text-white/75 truncate">
                        {nextTrackCandidate.artistName}
                      </p>
                    </div>
                  </div>
                )}
              </div>
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
                onClick={() => {
                  pendingSlideDirRef.current = 'prev';
                  playPrevTrack();
                }}
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
                onClick={() => {
                  pendingSlideDirRef.current = 'next';
                  playNextTrack();
                }}
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

                {currentTrack.downloadable !== false && Boolean(currentTrack.audioUrl) && (
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
                )}

                <button
                  type="button"
                  onClick={handleToggleExpandLyrics}
                  aria-pressed={isLyricsExpanded}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border transition cursor-pointer min-h-[44px] ${
                    isLyricsExpanded
                      ? 'bg-[#C6FF3D] border-[#C6FF3D] text-[#0A0B0A] font-bold'
                      : 'bg-white/10 border-white/10 text-white/85 hover:text-white'
                  }`}
                >
                  {isLyricsExpanded ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                  <span>
                    {isLyricsExpanded
                      ? t('collapse_lyrics', 'Collapse Lyrics')
                      : t('expand_lyrics', 'Expand Lyrics')}
                  </span>
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
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:text-white disabled:opacity-25 cursor-pointer"
                              aria-label="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => reorderQueue(idx, idx + 1)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:text-white disabled:opacity-25 cursor-pointer"
                              aria-label="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromQueue(idx)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/60 hover:text-[#FF5C6C] cursor-pointer"
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

        {/* EXPANDED TIME-SYNCED LYRICS OVERLAY IN PLAYING VIEW */}
        {activeTab === 'playing' && isLyricsExpanded && (
          <div className="fixed inset-0 z-30 bg-[#0A0B0A] flex flex-col p-4 sm:p-6 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-[calc(18px+env(safe-area-inset-bottom,0px))] animate-fadeIn">
            <div
              className="fixed inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 50% 12%, ${palette.primary} 0%, rgba(10, 11, 10, 0.96) 68%, #0A0B0A 100%)`,
              }}
            />

            <div className="relative z-10 w-full max-w-lg mx-auto flex flex-col flex-1 min-h-0 gap-4">
              {/* Top Mini Header */}
              <div className="flex items-center justify-between gap-3 shrink-0 pb-3 border-b border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={currentTrack.coverArt || DEFAULT_ARTWORK_SVG}
                    alt={currentTrack.title}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                    }}
                    className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-white truncate">{currentTrack.title}</p>
                    <p className="text-xs text-white/70 truncate">
                      {currentTrack.artistName}
                      {parsedLyrics.isSynced
                        ? ` · ${t('synced_lyrics', 'Synced Lyrics')}`
                        : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleExpandLyrics}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white cursor-pointer min-h-[44px] shrink-0"
                >
                  <Minimize2 className="w-4 h-4 text-[#C6FF3D]" />
                  <span>{t('collapse_lyrics', 'Collapse Lyrics')}</span>
                </button>
              </div>

              {/* Scrollable Time-Synced Lyrics Sheet */}
              <div
                onWheel={handleLyricsWheelOrTouch}
                onTouchMove={handleLyricsWheelOrTouch}
                className="flex-1 overflow-y-auto px-1 py-4 space-y-4 scrollbar-none"
              >
                {isFetchingLyrics && !parsedLyrics.hasLyrics ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-3 text-white/70 text-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-[#C6FF3D]" />
                    <span>{t('loading_lyrics', 'Finding synced lyrics...')}</span>
                  </div>
                ) : !parsedLyrics.hasLyrics ? (
                  <div className="py-16 text-center space-y-3">
                    <AlignLeft className="w-8 h-8 text-white/35 mx-auto" />
                    <p className="text-sm font-bold text-white">
                      {t('no_lyrics_yet', 'No synced lyrics available for this song yet.')}
                    </p>
                    <p className="text-xs text-white/60 max-w-xs mx-auto">
                      {isNy
                        ? 'Mawu a nyimboyi akaikidwa ndi woimba kapena kupezeka pa intaneti adzaoneka apa.'
                        : 'Once the artist adds lyrics or timed lyrics match this release, lines highlight in real time.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setLyricsRetryTick((n) => n + 1)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{t('try_again', 'Try again')}</span>
                    </button>
                  </div>
                ) : parsedLyrics.isSynced ? (
                  parsedLyrics.lines.map((line, idx) => {
                    const isActiveLine = idx === activeLyricIndex;
                    const isPast = activeLyricIndex >= 0 && idx < activeLyricIndex;
                    return (
                      <button
                        key={`${idx}-${line.timeSeconds}`}
                        ref={isActiveLine ? activeLyricLineRef : undefined}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tap');
                          setManualScrollPaused(false);
                          seekTo(line.timeSeconds);
                        }}
                        className={`block w-full text-left transition-all duration-200 leading-snug cursor-pointer py-1 ${
                          isActiveLine
                            ? 'text-xl sm:text-2xl font-extrabold text-[#C6FF3D]'
                            : isPast
                            ? 'text-base sm:text-lg font-bold text-white/40 hover:text-white/75'
                            : 'text-base sm:text-lg font-bold text-white/75 hover:text-white'
                        }`}
                      >
                        {line.text}
                      </button>
                    );
                  })
                ) : (
                  parsedLyrics.plainLines.map((line, idx) => (
                    <p
                      key={`${idx}-${line.slice(0, 12)}`}
                      className="text-lg sm:text-xl font-bold text-white/85 leading-relaxed"
                    >
                      {line}
                    </p>
                  ))
                )}
              </div>

              {manualScrollPaused && parsedLyrics.isSynced && activeLyricIndex >= 0 && (
                <div className="flex justify-center shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setManualScrollPaused(false);
                      activeLyricLineRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                      });
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#C6FF3D] text-[#0A0B0A] text-xs font-bold shadow-lg cursor-pointer"
                  >
                    {t('sync_to_playing', 'Sync to current line')}
                  </button>
                </div>
              )}

              {/* Compact Bottom Scrubber & Play Control */}
              <div className="shrink-0 pt-3 border-t border-white/10 space-y-2.5">
                <div className="relative h-5 flex items-center">
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
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-mono text-white/65 tabular-nums">
                    {formatTime(currentTime)}
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        pendingSlideDirRef.current = 'prev';
                        playPrevTrack();
                      }}
                      className="text-white/85 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      aria-label={t('previous')}
                    >
                      <SkipBack className="w-5 h-5 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="w-12 h-12 rounded-full bg-[#C6FF3D] text-[#0A0B0A] flex items-center justify-center cursor-pointer shadow-lg"
                      aria-label={isPlaying ? t('pause') : t('play')}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-[#0A0B0A]" />
                      ) : (
                        <Play className="w-5 h-5 fill-[#0A0B0A] ml-0.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pendingSlideDirRef.current = 'next';
                        playNextTrack();
                      }}
                      className="text-white/85 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                      aria-label={t('next_track')}
                    >
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                  <span className="text-xs font-mono text-white/65 tabular-nums">
                    -{formatTime(Math.max(0, duration - currentTime))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SYNCED LYRICS TAB */}
        {activeTab === 'lyrics' && (
          <div className="rounded-[24px] bg-[#131513] border border-white/10 p-5 max-h-[68vh] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <AlignLeft className="w-4 h-4 text-[#C6FF3D]" />
                <span>
                  {parsedLyrics.isSynced
                    ? t('synced_lyrics', 'Synced Lyrics')
                    : t('lyrics', 'Lyrics')}
                </span>
                {lyricsSource === 'lrclib' && (
                  <span className="text-[10px] font-mono text-white/50">· LRCLIB</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleToggleExpandLyrics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-[#C6FF3D] cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{t('expand_lyrics', 'Expand Lyrics')}</span>
              </button>
            </div>

            <div
              onWheel={handleLyricsWheelOrTouch}
              onTouchMove={handleLyricsWheelOrTouch}
              className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none"
            >
              {isFetchingLyrics && !parsedLyrics.hasLyrics ? (
                <div className="py-14 flex flex-col items-center justify-center gap-3 text-white/70 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin text-[#C6FF3D]" />
                  <span>{t('loading_lyrics', 'Finding synced lyrics...')}</span>
                </div>
              ) : !parsedLyrics.hasLyrics ? (
                <div className="py-12 text-center space-y-2.5">
                  <p className="text-sm font-bold text-white">
                    {t('no_lyrics_yet', 'No synced lyrics available for this song yet.')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setLyricsRetryTick((n) => n + 1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('try_again', 'Try again')}</span>
                  </button>
                </div>
              ) : parsedLyrics.isSynced ? (
                parsedLyrics.lines.map((line, idx) => {
                  const isActiveLine = idx === activeLyricIndex;
                  return (
                    <button
                      key={`${idx}-${line.timeSeconds}`}
                      ref={isActiveLine ? activeLyricLineRef : undefined}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tap');
                        setManualScrollPaused(false);
                        seekTo(line.timeSeconds);
                      }}
                      className={`block w-full text-left text-base sm:text-lg font-bold transition leading-relaxed cursor-pointer ${
                        isActiveLine ? 'text-[#C6FF3D]' : 'text-white/55 hover:text-white/85'
                      }`}
                    >
                      {line.text}
                    </button>
                  );
                })
              ) : (
                parsedLyrics.plainLines.map((line, idx) => (
                  <p
                    key={`${idx}-${line.slice(0, 12)}`}
                    className="text-base sm:text-lg font-semibold text-white/85 leading-relaxed"
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
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
              {visibleComments.length === 0 ? (
                <div className="py-10 text-center text-xs text-white/60">
                  {commentsAllowed
                    ? isNy
                      ? 'Khalani woyamba kulemba ndemanga pa nyimboyi.'
                      : 'Be the first to leave a note on this track.'
                    : t('comments_disabled', 'Comments are turned off for this track.')}
                </div>
              ) : (
                visibleComments.map((c) => {
                  const canDelete = Boolean(
                    isTrackOwnerOrAdmin || (currentUser && c.userId === currentUser.id)
                  );
                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-2xl bg-white/[0.04] border space-y-1.5 ${
                        c.hiddenByModeration ? 'border-amber-500/40 opacity-75' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={c.userAvatar || DEFAULT_AVATAR_SVG}
                            alt={c.userName}
                            referrerPolicy="no-referrer"
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                          />
                          <span className="font-bold text-white truncate">{c.userName}</span>
                          {c.hiddenByModeration && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                              {isNy ? 'Yobisika' : 'Hidden'}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => seekTo(c.timestampSeconds)}
                          className="font-mono text-[11px] font-bold text-[#C6FF3D] cursor-pointer shrink-0"
                        >
                          {formatTime(c.timestampSeconds)}
                        </button>
                      </div>
                      <p className="text-xs text-white/85 leading-relaxed">{c.content}</p>
                      <div className="flex items-center justify-end gap-1.5 pt-1 text-[11px]">
                        {isTrackOwnerOrAdmin && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await moderateTrackComment(
                                currentTrack.id,
                                c.id,
                                !c.hiddenByModeration
                              );
                              if (res.success) {
                                showToast(
                                  c.hiddenByModeration
                                    ? isNy ? 'Ndemanga ikuwonekeranso' : 'Comment restored'
                                    : isNy ? 'Ndemanga yabisika' : 'Comment hidden'
                                );
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                            title={c.hiddenByModeration ? 'Unhide' : 'Hide'}
                          >
                            {c.hiddenByModeration ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            <span>{c.hiddenByModeration ? (isNy ? 'Onetsani' : 'Show') : (isNy ? 'Bisani' : 'Hide')}</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await deleteTrackComment(currentTrack.id, c.id);
                              if (res.success) {
                                showToast(isNy ? 'Ndemanga yafufutidwa' : 'Comment deleted');
                              }
                            }}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-[#FF5C6C] inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>{t('delete_comment', 'Delete')}</span>
                          </button>
                        )}
                        {currentUser && !canDelete && (
                          <button
                            type="button"
                            onClick={async () => {
                              await submitContentReportRecord({
                                type: 'comment',
                                trackId: currentTrack.id,
                                trackTitle: currentTrack.title,
                                commentId: c.id,
                                reason: 'Flagged listener comment',
                                details: `Comment by ${c.userName}: "${c.content}"`,
                              });
                              showToast(isNy ? 'Ndemanga yanenedwa kwa oyang\'anira' : 'Comment reported for review');
                            }}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-amber-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Flag className="w-3 h-3" />
                            <span>{t('report_comment', 'Report')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {commentsAllowed ? (
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
            ) : (
              <div className="pt-2 border-t border-white/10 text-center text-xs text-white/55">
                {t('comments_disabled', 'Comments are turned off for this track.')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom spacer for thumb comfort */}
      <div className="h-2 shrink-0" />
    </div>
  );
};
