import { useSyncExternalStore } from 'react';
import { Track } from '../types';
import { LOWERVIBE_ICON_ARTWORK } from './artworkFallback';

export type PinnedRepeatMode = 'off' | 'all' | 'one';

export const PINNED_PLAYER_SESSION_KEY = 'lowervibe_pinned_player_session_v1';
export const LEGACY_RESUME_PLAYBACK_KEY = 'lowervibe_resume_playback_v1';

export interface PinnedPlayerSession {
  pinned: boolean;
  track: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  repeatMode: PinnedRepeatMode;
  isShuffling: boolean;
  playbackRate: number;
  queue: Track[];
  updatedAt: number;
}

const DEFAULT_PINNED_SESSION: PinnedPlayerSession = {
  pinned: false,
  track: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  volume: 0.85,
  isMuted: false,
  repeatMode: 'off',
  isShuffling: false,
  playbackRate: 1,
  queue: [],
  updatedAt: 0,
};

function stripOversizedInlineData(value?: string): string | undefined {
  if (!value) return value;
  if (value.startsWith('data:') && value.length > 2048) {
    return undefined;
  }
  return value;
}

function sanitizeTrackForSessionStorage(track: Track | null): Track | null {
  if (!track || !track.id) return null;
  return {
    ...track,
    coverArt: stripOversizedInlineData(track.coverArt) || LOWERVIBE_ICON_ARTWORK,
    artistAvatar: stripOversizedInlineData(track.artistAvatar) || '',
    comments: Array.isArray(track.comments) ? track.comments.slice(0, 5) : [],
  };
}

function readInitialSession(): PinnedPlayerSession {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_PINNED_SESSION };
  }

  try {
    const raw = window.sessionStorage.getItem(PINNED_PLAYER_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PinnedPlayerSession>;
      if (parsed && typeof parsed === 'object') {
        const track = parsed.track && parsed.track.id ? parsed.track : null;
        return {
          pinned: Boolean(parsed.pinned && track),
          track,
          currentTime:
            typeof parsed.currentTime === 'number' && Number.isFinite(parsed.currentTime)
              ? Math.max(0, parsed.currentTime)
              : 0,
          duration:
            typeof parsed.duration === 'number' && Number.isFinite(parsed.duration)
              ? Math.max(0, parsed.duration)
              : track?.durationSeconds || 0,
          // Never auto-start audio on fresh page reload without a user gesture,
          // keep sticky pinned paused UI ready to resume instantly.
          isPlaying: false,
          volume:
            typeof parsed.volume === 'number' && Number.isFinite(parsed.volume)
              ? Math.min(1, Math.max(0, parsed.volume))
              : 0.85,
          isMuted: Boolean(parsed.isMuted),
          repeatMode:
            parsed.repeatMode === 'one' || parsed.repeatMode === 'all' ? parsed.repeatMode : 'off',
          isShuffling: Boolean(parsed.isShuffling),
          playbackRate:
            typeof parsed.playbackRate === 'number' && Number.isFinite(parsed.playbackRate)
              ? Math.min(2, Math.max(0.5, parsed.playbackRate))
              : 1,
          queue: Array.isArray(parsed.queue) ? parsed.queue.filter((t) => Boolean(t?.id)) : [],
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        };
      }
    }
  } catch {}

  return { ...DEFAULT_PINNED_SESSION };
}

let currentSnapshot: PinnedPlayerSession = readInitialSession();
const listeners = new Set<() => void>();
let lastStorageFlushAt = 0;

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

function persistSnapshotToBrowserStorage(snapshot: PinnedPlayerSession) {
  if (typeof window === 'undefined') return;
  try {
    const serializable: PinnedPlayerSession = {
      ...snapshot,
      track: sanitizeTrackForSessionStorage(snapshot.track),
      queue: snapshot.queue
        .slice(0, 40)
        .map((q) => sanitizeTrackForSessionStorage(q))
        .filter((q): q is Track => Boolean(q)),
    };
    window.sessionStorage.setItem(PINNED_PLAYER_SESSION_KEY, JSON.stringify(serializable));
  } catch {}

  if (snapshot.pinned && snapshot.track) {
    try {
      window.localStorage.setItem(
        LEGACY_RESUME_PLAYBACK_KEY,
        JSON.stringify({
          trackId: snapshot.track.id,
          positionSeconds: Math.floor(snapshot.currentTime),
          playbackRate: snapshot.playbackRate,
          updatedAt: snapshot.updatedAt,
        })
      );
    } catch {}
  }
}

export function getPinnedPlayerSession(): PinnedPlayerSession {
  return currentSnapshot;
}

export function subscribePinnedPlayerSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePinnedPlayerSession(): PinnedPlayerSession {
  return useSyncExternalStore(
    subscribePinnedPlayerSession,
    getPinnedPlayerSession,
    () => DEFAULT_PINNED_SESSION
  );
}

export function pinPlayerSession(
  patch: Partial<PinnedPlayerSession>,
  options: { persistNow?: boolean } = {}
) {
  const nextTrack = patch.track !== undefined ? patch.track : currentSnapshot.track;
  const nextPinned =
    patch.pinned !== undefined ? Boolean(patch.pinned && nextTrack) : Boolean(currentSnapshot.pinned && nextTrack);

  currentSnapshot = {
    ...currentSnapshot,
    ...patch,
    track: nextTrack,
    pinned: nextPinned,
    updatedAt: Date.now(),
  };

  emitChange();

  const shouldPersist = options.persistNow !== false;
  if (shouldPersist) {
    lastStorageFlushAt = Date.now();
    persistSnapshotToBrowserStorage(currentSnapshot);
  }
}

export function updatePinnedPlayerPosition(
  currentTime: number,
  duration?: number,
  forcePersist: boolean = false
) {
  if (!currentSnapshot.pinned || !currentSnapshot.track) return;

  const safeTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : currentSnapshot.currentTime;
  const safeDuration =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0
      ? Math.round(duration)
      : currentSnapshot.duration;

  currentSnapshot = {
    ...currentSnapshot,
    currentTime: safeTime,
    duration: safeDuration,
    updatedAt: Date.now(),
  };

  // Avoid triggering subscriber re-renders on every sub-second timeupdate frame;
  // only flush to sessionStorage once per second unless forced (seek / pause / pagehide).
  const now = Date.now();
  if (forcePersist || now - lastStorageFlushAt >= 1000) {
    lastStorageFlushAt = now;
    persistSnapshotToBrowserStorage(currentSnapshot);
  }
}

export function flushPinnedPlayerSession() {
  if (!currentSnapshot.pinned || !currentSnapshot.track) return;
  lastStorageFlushAt = Date.now();
  persistSnapshotToBrowserStorage(currentSnapshot);
}

export function clearPinnedPlayerSession() {
  currentSnapshot = {
    ...DEFAULT_PINNED_SESSION,
    volume: currentSnapshot.volume,
    isMuted: currentSnapshot.isMuted,
    repeatMode: currentSnapshot.repeatMode,
    isShuffling: currentSnapshot.isShuffling,
    playbackRate: currentSnapshot.playbackRate,
    updatedAt: Date.now(),
  };
  emitChange();

  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(PINNED_PLAYER_SESSION_KEY);
      window.localStorage.removeItem(LEGACY_RESUME_PLAYBACK_KEY);
    } catch {}
  }
}
