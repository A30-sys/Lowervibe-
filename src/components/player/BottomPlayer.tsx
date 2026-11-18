import {
  AlertCircle,
  Heart,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { audioEngine } from '../../services/audioEngine';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { formatTime, isTrackLikedByUser } from '../../utils/formatters';
import { triggerHaptic } from '../../utils/haptics';

interface DynamicVolumeCanvasProps {
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
  onChangeVolume: (val: number) => void;
}

const DynamicVolumeCanvas: React.FC<DynamicVolumeCanvasProps> = ({
  volume,
  isMuted,
  isPlaying,
  onChangeVolume,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulseUntilRef = useRef<number>(0);
  const smoothedBarsRef = useRef<number[]>(new Array(10).fill(0));
  const phaseRef = useRef<number>(0);
  const draggingRef = useRef<boolean>(false);
  const lastVolTickStepRef = useRef<number>(-1);
  const lastVolTickAtRef = useRef<number>(0);
  const [showLevelTag, setShowLevelTag] = useState(false);

  useEffect(() => {
    pulseUntilRef.current = performance.now() + 1100;
    setShowLevelTag(true);
    const timer = window.setTimeout(() => setShowLevelTag(false), 1200);
    return () => window.clearTimeout(timer);
  }, [volume, isMuted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cssWidth = 68;
    const cssHeight = 26;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    let rafId: number | null = null;
    let isMounted = true;

    const drawFrame = (now: number) => {
      if (!isMounted) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const snapshot = audioEngine.getVolumeLevelSnapshot(10);
      const effectiveVol = isMuted ? 0 : volume;
      const isRecentlyAdjusted = now < pulseUntilRef.current;
      phaseRef.current += isPlaying ? 0.14 : 0.05;

      const styles = getComputedStyle(document.documentElement);
      const accentColor = styles.getPropertyValue('--lv-accent').trim() || '#C6FF3D';
      const violetColor = styles.getPropertyValue('--lv-violet').trim() || '#7C5CFF';
      const dangerColor = styles.getPropertyValue('--lv-danger').trim() || '#EF4444';
      const trackBg = 'rgba(148, 163, 184, 0.22)';

      const barCount = 10;
      const gap = 2.5;
      const barWidth = (cssWidth - gap * (barCount - 1)) / barCount;
      const maxBarHeight = cssHeight - 4;

      for (let i = 0; i < barCount; i++) {
        const threshold = (i + 0.5) / barCount;
        const barInVolume = effectiveVol >= threshold - 0.06;

        let targetLevel = 0;
        if (isMuted || effectiveVol <= 0.005) {
          targetLevel = 0.08;
        } else if (snapshot.hasAnalyserSignal && isPlaying) {
          // Real Web Audio AnalyserNode energy combined with volume meter envelope
          const audioMod = Math.max(0.18, snapshot.bands[i] ?? snapshot.signalRms);
          targetLevel = barInVolume ? Math.min(1, audioMod * (0.65 + effectiveVol * 0.55)) : 0.12;
        } else if (isPlaying) {
          // Smooth harmonic fallback for streams without CORS analyser access
          const wave = 0.55 + 0.45 * Math.sin(phaseRef.current + i * 0.72);
          targetLevel = barInVolume ? Math.min(1, effectiveVol * (0.45 + 0.55 * wave)) : 0.12;
        } else {
          // Static proportional volume staircase when paused
          targetLevel = barInVolume ? Math.max(0.22, ((i + 1) / barCount) * 0.92) : 0.12;
        }

        const prev = smoothedBarsRef.current[i] || 0;
        const smoothed = prev + (targetLevel - prev) * 0.28;
        smoothedBarsRef.current[i] = smoothed;

        const barH = Math.max(3, smoothed * maxBarHeight);
        const x = i * (barWidth + gap);
        const y = cssHeight - 2 - barH;
        const radius = Math.min(barWidth / 2, 2);

        // Background meter slot
        ctx.fillStyle = trackBg;
        ctx.beginPath();
        ctx.roundRect(x, 2, barWidth, maxBarHeight, radius);
        ctx.fill();

        // Active dynamic bar
        if (isMuted || effectiveVol <= 0.005) {
          ctx.fillStyle = dangerColor;
          ctx.globalAlpha = 0.45;
        } else if (barInVolume) {
          ctx.fillStyle = i >= 8 ? violetColor : accentColor;
          ctx.globalAlpha = isRecentlyAdjusted || isPlaying ? 1 : 0.82;
        } else {
          ctx.fillStyle = trackBg;
          ctx.globalAlpha = 0.35;
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, radius);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      if (isPlaying || isRecentlyAdjusted) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        rafId = null;
      }
    };

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      isMounted = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [volume, isMuted, isPlaying]);

  const applyPointerVolume = (clientX: number, allowTickHaptic = false) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const rounded = Number(ratio.toFixed(2));
    if (allowTickHaptic) {
      const step = Math.round(rounded * 10);
      const now = performance.now();
      if (step !== lastVolTickStepRef.current && now - lastVolTickAtRef.current >= 55) {
        lastVolTickStepRef.current = step;
        lastVolTickAtRef.current = now;
        triggerHaptic('tick');
      }
    }
    onChangeVolume(rounded);
  };

  return (
    <div className="relative flex items-center">
      {showLevelTag && (
        <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-[var(--lv-surface)] border border-[var(--lv-border-strong)] text-[10px] font-mono font-bold text-[var(--lv-text)] shadow-md whitespace-nowrap">
          {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
        </span>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          draggingRef.current = true;
          lastVolTickStepRef.current = Math.round(volume * 10);
          lastVolTickAtRef.current = performance.now();
          triggerHaptic('tap');
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          applyPointerVolume(e.clientX, false);
        }}
        onPointerMove={(e) => {
          if (!draggingRef.current) return;
          e.stopPropagation();
          applyPointerVolume(e.clientX, true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          draggingRef.current = false;
          try {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          } catch {}
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        className="w-[46px] sm:w-[68px] h-[24px] sm:h-[26px] touch-none cursor-pointer rounded-md"
        title={`Volume: ${isMuted ? 'Muted' : `${Math.round(volume * 100)}%`} (drag to adjust)`}
        aria-label={`Dynamic volume level meter: ${isMuted ? 'Muted' : `${Math.round(volume * 100)} percent`}`}
      />
    </div>
  );
};

interface BottomPlayerProps {
  onOpenDetails: () => void;
  onOpenArtist: (artistId: string) => void;
  onOpenFullscreen: () => void;
  onClosePlayer?: () => void;
  isExiting?: boolean;
  fallbackTrack?: import('../../types').Track | null;
}

export const BottomPlayer: React.FC<BottomPlayerProps> = ({
  onOpenArtist,
  onOpenFullscreen,
  onClosePlayer,
  isExiting = false,
  fallbackTrack = null,
}) => {
  const {
    currentTrack,
    isPlaying,
    playbackState,
    isMiniPlayerVisible,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffling,
    playbackError,
    togglePlayPause,
    seekTo,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    playNextTrack,
    playPrevTrack,
    retryPlayback,
    clearPlaybackError,
    clearActiveTrack,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [likePopping, setLikePopping] = useState(false);

  // Touch & pointer scrubbing state
  const scrubTrackRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const lastScrubTickPercentRef = useRef<number>(0);
  const lastScrubTickAtRef = useRef<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  const displayTrack = currentTrack || (isExiting ? fallbackTrack : null);
  const isPlayerActive = Boolean(
    displayTrack && (isExiting || isPlaying || isMiniPlayerVisible || playbackState !== 'idle')
  );

  useEffect(() => {
    setIsScrubbing(false);
    setScrubTime(null);
    activePointerIdRef.current = null;
  }, [displayTrack?.id]);

  if (!isPlayerActive || !displayTrack) return null;

  const isLiked = isTrackLikedByUser(displayTrack, currentUser);
  const activeTime = isScrubbing && scrubTime !== null ? scrubTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (activeTime / duration) * 100)) : 0;

  const computeTimeFromClientX = (clientX: number): number => {
    const el = scrubTrackRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (duration <= 0 || isExiting) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const nextTime = computeTimeFromClientX(e.clientX);
    lastScrubTickPercentRef.current = (nextTime / duration) * 100;
    lastScrubTickAtRef.current = performance.now();
    triggerHaptic('tap');
    setIsScrubbing(true);
    setScrubTime(nextTime);
  };

  const handleScrubPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isScrubbing || activePointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    const nextTime = computeTimeFromClientX(e.clientX);
    if (duration > 0) {
      const nextPercent = (nextTime / duration) * 100;
      const now = performance.now();
      if (
        Math.abs(nextPercent - lastScrubTickPercentRef.current) >= 2 &&
        now - lastScrubTickAtRef.current >= 55
      ) {
        lastScrubTickPercentRef.current = nextPercent;
        lastScrubTickAtRef.current = now;
        triggerHaptic('tick');
      }
    }
    setScrubTime(nextTime);
  };

  const finishScrub = (clientX: number | null, pointerId: number, shouldCommit: boolean) => {
    if (activePointerIdRef.current !== pointerId) return;
    activePointerIdRef.current = null;

    if (shouldCommit && duration > 0) {
      const targetTime = clientX !== null ? computeTimeFromClientX(clientX) : scrubTime;
      if (targetTime !== null) {
        triggerHaptic('confirm');
        seekTo(targetTime);
      }
    }

    setIsScrubbing(false);
    setScrubTime(null);
  };

  const handleScrubPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    finishScrub(e.clientX, e.pointerId, true);
  };

  const handleScrubPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    finishScrub(null, e.pointerId, false);
  };

  const handleScrubKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const step = 5;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      triggerHaptic('tick');
      seekTo(Math.min(duration, currentTime + step));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      triggerHaptic('tick');
      seekTo(Math.max(0, currentTime - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      triggerHaptic('confirm');
      seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      triggerHaptic('confirm');
      seekTo(duration);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isScrubbing) return;
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleClose = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isExiting) return;
    triggerHaptic('dismiss');
    if (onClosePlayer) {
      onClosePlayer();
    } else {
      clearActiveTrack();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isScrubbing || touchStartX === null || touchStartY === null) {
      setTouchStartX(null);
      setTouchStartY(null);
      return;
    }
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (diffY < -35 && Math.abs(diffY) > Math.abs(diffX)) {
      triggerHaptic('tap');
      onOpenFullscreen();
    } else if (diffY > 45 && Math.abs(diffY) > Math.abs(diffX)) {
      handleClose();
    } else if (diffX < -45 && Math.abs(diffX) > Math.abs(diffY)) {
      triggerHaptic('tap');
      playNextTrack();
    } else if (diffX > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      triggerHaptic('tap');
      playPrevTrack();
    }

    setTouchStartX(null);
    setTouchStartY(null);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic(isLiked ? 'tap' : 'double');
    setLikePopping(true);
    setTimeout(() => setLikePopping(false), 240);
    toggleLikeTrack(displayTrack.id);
    showToast(isLiked ? 'Removed from Liked songs' : 'Added to Liked songs');
  };

  return (
    <div
      className="fixed bottom-[68px] md:bottom-4 left-0 right-0 z-30 px-2 sm:px-4 pb-[env(safe-area-inset-bottom,0px)] pointer-events-none"
      aria-label="Mini audio player"
    >
      <div className="relative max-w-4xl mx-auto">
        {/* Live floating scrub timestamp preview */}
        {isScrubbing && scrubTime !== null && duration > 0 && (
          <div
            className="pointer-events-none absolute -top-9 z-40 -translate-x-1/2 px-2.5 py-1 rounded-full bg-[var(--lv-surface)] border border-[var(--lv-border-strong)] shadow-xl text-[11px] font-mono font-bold text-[var(--lv-text)] whitespace-nowrap"
            style={{
              left: `clamp(48px, ${progressPercent}%, calc(100% - 48px))`,
            }}
          >
            <span className="text-[var(--lv-accent-text)]">{formatTime(scrubTime)}</span>
            <span className="text-[var(--lv-muted)]"> / {formatTime(duration)}</span>
          </div>
        )}

        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`rounded-[20px] bg-[var(--lv-surface)]/95 backdrop-blur-2xl border border-[var(--lv-border-strong)] shadow-2xl ${
            isExiting
              ? 'animate-player-slide-down pointer-events-none'
              : 'animate-player-pop-up pointer-events-auto'
          }`}
        >
          {/* Touch & pointer-enabled progress scrubber (isolated from swipe gestures) */}
          <div
            ref={scrubTrackRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek track position"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(activeTime)}
            aria-valuetext={`${formatTime(activeTime)} of ${formatTime(duration)}`}
            onPointerDown={handleScrubPointerDown}
            onPointerMove={handleScrubPointerMove}
            onPointerUp={handleScrubPointerUp}
            onPointerCancel={handleScrubPointerCancel}
            onKeyDown={handleScrubKeyDown}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className="relative w-full pt-0 pb-3 -mb-2.5 touch-none select-none cursor-pointer group focus:outline-none"
          >
            <div
              className={`relative w-full rounded-t-[20px] bg-[var(--lv-elevated)] transition-[height] duration-150 ${
                isScrubbing ? 'h-1.5' : 'h-[3px] group-hover:h-1.5'
              }`}
            >
              <div className="w-full h-full rounded-t-[20px] overflow-hidden">
                <div
                  className={`h-full bg-[var(--lv-accent)] ${
                    isScrubbing ? 'transition-none' : 'transition-[width] duration-150 ease-linear'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {duration > 0 && (
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--lv-accent)] shadow-md ring-2 ring-[var(--lv-surface)] transition-all duration-150 pointer-events-none ${
                    isScrubbing
                      ? 'w-3.5 h-3.5 opacity-100 scale-100'
                      : 'w-2.5 h-2.5 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100'
                  }`}
                  style={{ left: `${progressPercent}%` }}
                />
              )}
            </div>
          </div>

        {/* Playback error alert bar */}
        {playbackError && (
          <div className="px-3 py-2 bg-[var(--lv-danger)]/10 border-b border-[var(--lv-danger)]/25 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0 text-[var(--lv-danger)] font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{playbackError}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={retryPlayback}
                className="px-2.5 py-1 rounded-lg bg-[var(--lv-elevated)] text-[var(--lv-text)] font-semibold hover:opacity-90 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
              <button
                type="button"
                onClick={clearPlaybackError}
                className="p-1 text-[var(--lv-muted)] hover:text-[var(--lv-text)] cursor-pointer"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-4 px-2 sm:px-3.5 py-2">
          {/* Cover + Title + Artist (tapping expands Fullscreen Player) */}
          <div
            onClick={onOpenFullscreen}
            className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 cursor-pointer group"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenFullscreen();
              }
            }}
            aria-label={`Open full player for ${displayTrack.title}`}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 border border-[var(--lv-border)] bg-[var(--lv-elevated)]">
              <img
                src={displayTrack.coverArt || DEFAULT_ARTWORK_SVG}
                alt={displayTrack.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                }}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-[var(--lv-text)] line-clamp-1">
                {displayTrack.title}
              </p>
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--lv-muted)] mt-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenArtist(displayTrack.artistId);
                  }}
                  className="hover:text-[var(--lv-text)] truncate font-medium cursor-pointer text-left"
                >
                  {displayTrack.artistName}
                </button>
                <span className="hidden sm:inline font-mono text-[10px]">
                  · {formatTime(activeTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
          </div>

          {/* Transport Controls (min 48px touch targets) */}
          <div className="flex items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                toggleShuffle();
              }}
              className={`hidden md:flex items-center justify-center rounded-xl min-h-[48px] min-w-[48px] transition active:scale-95 cursor-pointer ${
                isShuffling
                  ? 'text-[var(--lv-accent-text)]'
                  : 'text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
              }`}
              title={isShuffling ? 'Shuffle on' : 'Shuffle off'}
              aria-label="Toggle shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                playPrevTrack();
              }}
              className="hidden sm:flex items-center justify-center rounded-xl text-[var(--lv-muted)] hover:text-[var(--lv-text)] transition active:scale-95 min-h-[48px] min-w-[48px] cursor-pointer"
              title="Previous track"
              aria-label="Previous track"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={handleLike}
              className={`flex items-center justify-center rounded-xl transition active:scale-90 min-h-[44px] min-w-[36px] sm:min-h-[48px] sm:min-w-[48px] cursor-pointer ${
                isLiked ? 'text-rose-500' : 'text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
              }`}
              title={isLiked ? 'Unlike song' : 'Like song'}
              aria-label={isLiked ? 'Unlike song' : 'Like song'}
            >
              <Heart
                className={`w-4 h-4 sm:w-5 sm:h-5 ${isLiked ? 'fill-rose-500' : ''} ${
                  likePopping ? 'animate-heart-pop' : ''
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('confirm');
                togglePlayPause();
              }}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center active:scale-95 transition-transform cursor-pointer shadow-md shrink-0"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                playNextTrack();
              }}
              className="flex items-center justify-center rounded-xl text-[var(--lv-muted)] hover:text-[var(--lv-text)] transition active:scale-95 min-h-[44px] min-w-[36px] sm:min-h-[48px] sm:min-w-[48px] cursor-pointer"
              title="Next track"
              aria-label="Next track"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                cycleRepeatMode();
              }}
              className={`hidden md:flex items-center justify-center rounded-xl min-h-[48px] min-w-[48px] transition active:scale-95 cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-[var(--lv-accent-text)]'
                  : 'text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
              }`}
              title={`Repeat: ${repeatMode}`}
              aria-label={`Repeat: ${repeatMode}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>

            {/* Dynamic Canvas Volume Level Indicator + Mute + Desktop Slider */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-0.5 sm:px-1">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tap');
                  toggleMute();
                }}
                className="hidden sm:flex p-2 text-[var(--lv-muted)] hover:text-[var(--lv-text)] transition cursor-pointer min-h-[44px] min-w-[40px] items-center justify-center"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[var(--lv-danger)]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <DynamicVolumeCanvas
                volume={volume}
                isMuted={isMuted}
                isPlaying={isPlaying}
                onChangeVolume={setVolume}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="hidden lg:block w-16 h-1 bg-[var(--lv-elevated)] rounded-full appearance-none cursor-pointer accent-[var(--lv-violet)]"
                aria-label="Volume"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('tap');
                onOpenFullscreen();
              }}
              className="hidden sm:flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] transition active:scale-95 min-h-[48px] min-w-[48px] cursor-pointer"
              title="Expand player"
              aria-label="Expand player"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] transition active:scale-95 min-h-[44px] min-w-[36px] sm:min-h-[48px] sm:min-w-[44px] cursor-pointer"
              title="Close player"
              aria-label="Close player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
