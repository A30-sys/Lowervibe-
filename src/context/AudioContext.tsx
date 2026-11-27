import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  enableNetwork,
  getDocs,
  getDocsFromServer,
  increment,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, formatFirebaseError, handleFirestoreError, OperationType, testFirestoreConnection } from '../services/firebase';
import { audioEngine } from '../services/audioEngine';
import {
  getAudioBlobUrl,
  getCachedAudioTrackIds,
  getOfflineTrackSnapshots,
  isTrackCachedOffline,
  readLocalOfflineSnapshotsSync,
  removeTrackOfflineCache,
  saveAudioBlob,
  saveOfflineTrackSnapshot,
} from '../services/audioStorage';
import { fetchTrackLyrics } from '../services/lyricsService';
import { upsertCustomGenre } from '../services/genresService';
import { requestServerApprovalToken, requestServerPayoutToken } from '../services/payoutTokenService';
import { durableDeleteDoc, durableSetDoc, durableUpdateDoc, flushPendingSyncOperations } from '../services/reliableSync';
import { detectDefaultCountry } from '../data/regions';
import {
  Artist,
  ArtistClaim,
  ArtistEvent,
  AuditLogEntry,
  DEFAULT_MONETIZATION_CONFIG,
  EqPreset,
  FeaturedVibe,
  FirestoreGenre,
  FullscreenPlayerTab,
  MonetizationConfig,
  PayoutMethod,
  PayoutProviderType,
  PayoutRequest,
  PlayHistoryItem,
  Playlist,
  PlayRecord,
  ReportRecord,
  SupportTicket,
  Track,
  TrackComment,
} from '../types';
import { formatTime } from '../utils/formatters';
import {
  DEFAULT_ARTWORK_SVG,
  DEFAULT_AVATAR_SVG,
  DEFAULT_BANNER_SVG,
  LOWERVIBE_ICON_ARTWORK,
} from '../utils/artworkFallback';
import {
  clearPinnedPlayerSession,
  flushPinnedPlayerSession,
  getPinnedPlayerSession,
  pinPlayerSession,
  updatePinnedPlayerPosition,
} from '../utils/playerSessionStore';
import { useAuth } from './AuthContext';
import { useRouter } from './RouterContext';
import { useToast } from './ToastContext';
import { isVerifiedAdminGoogleSession, PRIMARY_ADMIN_EMAIL } from '../services/authService';
import { getIsBatterySaverActive } from '../utils/batterySaver';
import { sanitizePlatformSocialLinks } from '../utils/socialLinks';

export type RepeatMode = 'off' | 'all' | 'one';
export type AudioQualityPreference = 'auto' | 'high' | 'saver' | 'lossless';
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'error';

export interface BatchOfflineDownloadState {
  id: string;
  label: string;
  completed: number;
  total: number;
  skippedAlreadySaved: number;
  failed: number;
  currentTrackTitle: string;
  isComplete: boolean;
}

interface ResumePlaybackState {
  trackId: string;
  positionSeconds: number;
  playbackRate: number;
  updatedAt: number;
}

interface AudioContextType {
  tracks: Track[];
  artists: Artist[];
  playlists: Playlist[];
  events: ArtistEvent[];
  claims: ArtistClaim[];
  auditLogs: AuditLogEntry[];
  featuredVibe: FeaturedVibe;
  savedTrackIds: string[];
  offlineTrackIds: string[];
  currentTrack: Track | null;
  isPlaying: boolean;
  playbackState: PlaybackState;
  isMiniPlayerVisible: boolean;
  hasPlayedInSession: boolean;
  resumedFromStorage: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: RepeatMode;
  isLooping: boolean;
  isShuffling: boolean;
  queue: Track[];
  crossfadeSeconds: number;
  playbackRate: number;
  audioQuality: AudioQualityPreference;
  effectiveAudioQuality: 'high' | 'saver' | 'lossless';
  effectiveBitrateKbps: string;
  estimatedMbPerMinute: number;
  playbackError: string | null;
  catalogError: string | null;
  playHistory: PlayHistoryItem[];
  isFullscreenPlayerOpen: boolean;
  fullscreenPlayerTab: FullscreenPlayerTab;
  activeShareTrack: Track | null;
  activeShareArtist: Artist | null;
  activeDetailTrack: Track | null;
  selectedArtistModal: Artist | null;
  isArtistSubmitModalOpen: boolean;
  isAuthModalOpen: boolean;
  authModalTab: 'login' | 'register';
  isPlaylistModalOpen: boolean;
  playlistModalTrack: Track | null;

  // Visualizer & Audio Quality
  isVisualizerActive: boolean;
  visualizerStyle: 'bars' | 'wave' | 'pulse';
  toggleVisualizer: () => void;
  setVisualizerStyle: (style: 'bars' | 'wave' | 'pulse') => void;
  eqPreset: EqPreset;
  setEqPreset: (preset: EqPreset) => void;

  isCatalogLoaded: boolean;

  // Playback Controls
  playTrack: (
    track: Track,
    options?: {
      crossfade?: boolean;
      crossfadeDurationOverride?: number;
      startAtSeconds?: number;
      expandFullscreen?: boolean;
    }
  ) => void;
  playTrackList: (items: Track[], startIndex?: number) => void;
  togglePlayPause: () => void;
  clearActiveTrack: () => void;
  seekTo: (timeInSeconds: number) => void;
  setVolume: (val: number) => void;
  toggleMute: () => void;
  cycleRepeatMode: () => void;
  toggleLoop: () => void;
  toggleShuffle: () => void;
  playNextTrack: () => void;
  playPrevTrack: () => void;
  addToQueue: (track: Track) => void;
  playNextInQueue: (track: Track) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setCrossfadeSeconds: (sec: number) => void;
  setPlaybackRate: (rate: number) => void;
  setAudioQuality: (q: AudioQualityPreference) => void;
  clearPlaybackError: () => void;
  retryPlayback: () => void;
  retryCatalogLoad: () => void;
  refreshCatalog: () => Promise<boolean>;

  // Sleep Timer
  sleepTimerMinutes: number | null;
  sleepAtEndOfTrack: boolean;
  sleepTimerRemainingSeconds: number | null;
  setSleepTimer: (minutes: number | null) => void;
  setSleepAtEndOfTrack: (enabled: boolean) => void;
  cancelSleepTimer: () => void;

  clearHistory: () => void;
  addCommentToTrack: (trackId: string, comment: Omit<TrackComment, 'id' | 'createdAt' | 'likes'>) => void;
  likeComment: (trackId: string, commentId: string) => void;
  deleteTrackComment: (trackId: string, commentId: string) => Promise<{ success: boolean; error?: string }>;
  moderateTrackComment: (trackId: string, commentId: string, hidden: boolean) => Promise<{ success: boolean; error?: string }>;
  setTrackModerationStatus: (
    trackId: string,
    status: NonNullable<Track['moderationStatus']>,
    feedback?: string
  ) => Promise<{ success: boolean; error?: string }>;
  addNewArtist: (artist: Omit<Artist, 'id' | 'followersCount' | 'monthlyListeners' | 'joinedDate' | 'verified'>) => Artist;
  addNewTrack: (
    trackData: Omit<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'> &
      Partial<Pick<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'>>
  ) => Track;
  saveNewTrack: (
    trackData: Omit<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'> &
      Partial<Pick<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'>>
  ) => Promise<Track>;
  updateArtistProfile: (artistId: string, updates: Partial<Artist>) => Promise<{ success: boolean; error?: string }>;
  deleteArtistProfile: (artistId: string) => Promise<{ success: boolean; deletedTracks: number; error?: string }>;
  updateTrack: (trackId: string, updates: Partial<Track>) => Promise<void>;
  downloadTrack: (track: Track) => void;
  downloadTrackBatch: (
    tracksToSync: Track[],
    label: string,
    batchId?: string
  ) => Promise<{ saved: number; skipped: number; failed: number; blockedReason?: string }>;
  downloadPlaylistOffline: (
    playlist: Playlist
  ) => Promise<{ saved: number; skipped: number; failed: number; blockedReason?: string }>;
  downloadArtistCatalogOffline: (
    artist: Artist,
    artistTracks: Track[]
  ) => Promise<{ saved: number; skipped: number; failed: number; blockedReason?: string }>;
  removeTracksOfflineBatch: (trackIds: string[]) => Promise<number>;
  deleteTrack: (trackId: string) => Promise<{ success: boolean; error?: string }>;
  setCertifiedStatus: (trackId: string, certified: boolean) => void;
  setTrackChartRank: (trackId: string, rank?: number) => void;

  // Library & Social
  toggleSaveTrack: (trackId: string) => void;
  addReaction: (trackId: string, emoji: string) => void;
  addEvent: (evt: Omit<ArtistEvent, 'id'>) => ArtistEvent;
  submitClaim: (claim: Omit<ArtistClaim, 'id' | 'status' | 'submittedAt'>) => ArtistClaim;
  approveClaim: (claimId: string, adminReason?: string) => void;
  rejectClaim: (claimId: string, adminReason: string) => void;
  setFeaturedVibeTrack: (trackId: string, curatorNote: string, quote: string) => void;
  toggleDerankTrack: (trackId: string) => void;
  toggleDraftTrack: (trackId: string) => Promise<{ success: boolean; error?: string }>;
  scheduleRelease: (trackId: string, scheduledDate: string) => void;
  addAuditLog: (action: string, targetType: AuditLogEntry['targetType'], targetId: string, details: string) => void;

  // Location & Region
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  upsertGenre: (name: string, options?: { description?: string; region?: string }) => Promise<FirestoreGenre>;

  // Playlists
  createPublicPlaylist: (input: {
    name: string;
    description?: string;
    coverArt?: string;
    country?: string;
    genre?: string;
    trackIds?: string[];
    isPublic?: boolean;
  }) => Promise<Playlist>;
  updatePublicPlaylist: (playlistId: string, updates: Partial<Playlist>) => Promise<void>;
  deletePublicPlaylist: (playlistId: string) => Promise<void>;
  reorderPlaylistTracks: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  toggleLikePlaylist: (playlistId: string) => void;
  recordPlaylistPlay: (playlistId: string) => void;

  // Monetization, Payouts, Reports & Support Tickets
  monetizationConfig: MonetizationConfig;
  updateMonetizationConfig: (updates: Partial<MonetizationConfig>) => Promise<void>;
  payoutMethods: PayoutMethod[];
  payoutRequests: PayoutRequest[];
  supportTickets: SupportTicket[];
  requestArtistMonetization: (
    artistId: string,
    termsAccepted: boolean
  ) => Promise<{ success: boolean; autoApproved?: boolean; error?: string }>;
  approveArtistMonetization: (artistId: string, approverOverride?: string) => void;
  rejectArtistMonetization: (artistId: string, reason: string) => Promise<void>;
  suspendArtistMonetization: (artistId: string, reason: string) => Promise<void>;
  revokeArtistMonetization: (artistId: string, reason?: string) => void;
  addPayoutMethod: (input: {
    type: PayoutProviderType;
    identifier: string;
    accountHolderName: string;
    artistId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  removePayoutMethod: (methodId: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultPayoutMethod: (methodId: string) => Promise<{ success: boolean; error?: string }>;
  submitPayoutRequest: (input: {
    artistId: string;
    artistName: string;
    payoutMethodId: string;
    grossAmountMwk: number;
  }) => Promise<{ success: boolean; error?: string; request?: PayoutRequest }>;
  updatePayoutRequestStatus: (
    requestId: string,
    status: PayoutRequest['status'],
    failureReason?: string
  ) => Promise<void>;
  submitContentReportRecord: (input: {
    type: ReportRecord['type'];
    trackId?: string;
    trackTitle?: string;
    commentId?: string;
    artistId?: string;
    artistName?: string;
    reason: string;
    details?: string;
    evidenceUrl?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  submitSupportTicket: (input: {
    subject: string;
    category: SupportTicket['category'];
    message: string;
  }) => Promise<{ success: boolean; error?: string }>;
  boostArtistFollowers: (artistId: string, amount?: number) => void;

  // Analytics Modal
  isAnalyticsModalOpen: boolean;
  analyticsArtist: Artist | null;
  openAnalyticsModal: (artist?: Artist | null) => void;
  closeAnalyticsModal: () => void;

  // UI state setters
  setIsFullscreenPlayerOpen: (open: boolean) => void;
  openFullscreenPlayer: (tab?: FullscreenPlayerTab) => void;
  setFullscreenPlayerTab: (tab: FullscreenPlayerTab) => void;
  setActiveShareTrack: (track: Track | null) => void;
  setActiveShareArtist: (artist: Artist | null) => void;
  setActiveDetailTrack: (track: Track | null) => void;
  setSelectedArtistModal: (artist: Artist | null) => void;
  setIsArtistSubmitModalOpen: (open: boolean) => void;
  openAuthModal: (tab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  openPlaylistModal: (track: Track) => void;
  closePlaylistModal: () => void;
  isLegalModalOpen: boolean;
  legalModalType: 'terms' | 'privacy' | null;
  openLegalModal: (type: 'terms' | 'privacy') => void;
  closeLegalModal: () => void;

  activeDownload: {
    trackId: string;
    trackTitle: string;
    artistName: string;
    progress: number;
    isComplete: boolean;
  } | null;
  activeBatchDownload: BatchOfflineDownloadState | null;

  dismissAllModals: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const TRACKS_STORAGE_KEY = 'lowervibe_tracks_v3';
const ARTISTS_STORAGE_KEY = 'lowervibe_artists_v3';
const EVENTS_STORAGE_KEY = 'lowervibe_events_v3';
const AUDIT_STORAGE_KEY = 'lowervibe_audit_v3';
const FEATURED_VIBE_KEY = 'lowervibe_featured_vibe_v3';
const HISTORY_STORAGE_KEY = 'lowervibe_history_v3';
const RESUME_PLAYBACK_KEY = 'lowervibe_resume_playback_v1';
const QUALITY_PREF_KEY = 'lowervibe_audio_quality_v1';
const PLAY_DEDUPE_KEY = 'lowervibe_play_dedupe_v1';

function dedupeTracksById(items: Track[]): Track[] {
  const seen = new Map<string, Track>();
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.set(item.id, item);
    }
  }
  return Array.from(seen.values());
}

function stripOversizedInlineDataUrl(value?: string): string | undefined {
  if (!value) return value;
  if (value.startsWith('data:') && value.length > 2048) {
    return undefined;
  }
  return value;
}

function inferMediaImageMimeType(url: string): string | undefined {
  const lower = url.toLowerCase();
  if (lower.startsWith('data:image/png')) return 'image/png';
  if (lower.startsWith('data:image/jpeg') || lower.startsWith('data:image/jpg')) return 'image/jpeg';
  if (lower.startsWith('data:image/webp')) return 'image/webp';
  if (/\.(png)(\?|$|#)/i.test(lower)) return 'image/png';
  if (/\.(jpe?g)(\?|$|#)/i.test(lower)) return 'image/jpeg';
  if (/\.(webp)(\?|$|#)/i.test(lower)) return 'image/webp';
  return undefined;
}

function buildMediaSessionArtwork(coverArt?: string): {
  artwork: MediaImage[];
  trackCoverUrl: string | null;
  fallbackIcons: MediaImage[];
} {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const fallbackIcons: MediaImage[] = origin
    ? [
        { src: `${origin}/icons/pwa-192x192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${origin}/icons/pwa-512x512.png`, sizes: '512x512', type: 'image/png' },
      ]
    : [
        { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ];

  const rawCover = (coverArt || '').trim();
  const isDefaultFallbackPath =
    !rawCover ||
    rawCover === LOWERVIBE_ICON_ARTWORK ||
    rawCover.endsWith('/icons/pwa-512x512.png') ||
    rawCover.startsWith('data:image/svg+xml');

  if (isDefaultFallbackPath) {
    return { artwork: fallbackIcons, trackCoverUrl: null, fallbackIcons };
  }

  let absoluteCover = rawCover;
  if (!rawCover.startsWith('http://') && !rawCover.startsWith('https://') && !rawCover.startsWith('data:')) {
    try {
      absoluteCover = origin ? new URL(rawCover, origin).href : rawCover;
    } catch {
      return { artwork: fallbackIcons, trackCoverUrl: null, fallbackIcons };
    }
  }

  const mimeType = inferMediaImageMimeType(absoluteCover);
  // Provide only the real song artwork at standard sizes so Android Chrome lockscreen
  // never overrides the track cover with a locally-cached fallback app icon.
  const trackArtwork: MediaImage[] = ['96x96', '128x128', '192x192', '256x256', '384x384', '512x512'].map(
    (sizes) => (mimeType ? { src: absoluteCover, sizes, type: mimeType } : { src: absoluteCover, sizes })
  );

  return {
    artwork: trackArtwork,
    trackCoverUrl: absoluteCover,
    fallbackIcons,
  };
}

function syncMediaSessionPositionState(position: number, duration: number, playbackRate: number) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (typeof navigator.mediaSession.setPositionState !== 'function') return;
  if (!Number.isFinite(duration) || duration <= 0) return;

  try {
    const safeRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    const clampedPos = Math.max(0, Math.min(duration, Number.isFinite(position) ? position : 0));
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: safeRate,
      position: clampedPos,
    });
  } catch {}
}

function clearMediaSessionMetadata() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
  } catch {}
  try {
    navigator.mediaSession.playbackState = 'none';
  } catch {}
  const actions: MediaSessionAction[] = [
    'play',
    'pause',
    'previoustrack',
    'nexttrack',
    'seekbackward',
    'seekforward',
    'seekto',
    'stop',
  ];
  actions.forEach((action) => {
    try {
      navigator.mediaSession.setActionHandler(action, null);
    } catch {}
  });
}

const REMOVED_DEMO_ARTIST_KEYS = new Set(['dontoliver', 'zezekingston', 'emkay']);
const REMOVED_DEMO_ARTIST_REGEX = /(?:^|[^a-z0-9])(don[\s_-]*toliver|zeze[\s_-]*kingston|emkay)(?:[^a-z0-9]|$)/i;

function isRemovedDemoArtistValue(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (REMOVED_DEMO_ARTIST_KEYS.has(compact)) return true;
  return REMOVED_DEMO_ARTIST_REGEX.test(trimmed);
}

function isRemovedDemoArtistRecord(artist?: Partial<Artist> & { slug?: string } | null): boolean {
  if (!artist) return false;
  return (
    isRemovedDemoArtistValue(artist.id) ||
    isRemovedDemoArtistValue(artist.name) ||
    isRemovedDemoArtistValue(artist.handle) ||
    isRemovedDemoArtistValue(artist.slug)
  );
}

function isRemovedDemoTrackRecord(track?: Partial<Track> | null, extraRemovedArtistIds?: Set<string>): boolean {
  if (!track) return false;
  if (track.artistId && extraRemovedArtistIds?.has(track.artistId)) return true;
  return (
    isRemovedDemoArtistValue(track.artistId) ||
    isRemovedDemoArtistValue(track.artistName)
  );
}

function safeCacheSnapshotWrite<T>(key: string, items: T[], maxItems: number, mapItem?: (item: T) => T) {
  try {
    const sliced = items.slice(0, maxItems);
    const payload = mapItem ? sliced.map(mapItem) : sliced;
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {}
}

/**
 * Clean artist display name (never contain raw slashes like "THALIBANI/victolpee")
 * and canonicalize matching key for deduplicating artist records on startup.
 */
function cleanArtistDisplayName(rawName: string): string {
  const trimmed = (rawName || 'Artist').trim();
  if (!trimmed.includes('/')) return trimmed;
  const parts = trimmed
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return 'Artist';
  if (parts.length === 1) return parts[0];
  // Prefer the second collaborator or clean joined form; if one is an alias of a single artist, keep clean title case
  const last = parts[parts.length - 1];
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function artistMatchKeys(rawName: string): string[] {
  const parts = (rawName || '')
    .split(/[/,&]+/)
    .map((p) => p.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((k) => k.length >= 3);
  const fullKey = (rawName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return Array.from(new Set([fullKey, ...parts].filter(Boolean)));
}

function dedupeArtistsCatalog(rawArtists: Artist[]): {
  artists: Artist[];
  idRemap: Map<string, Artist>;
} {
  const canonicalByKey = new Map<string, Artist>();
  const idRemap = new Map<string, Artist>();

  // Sort verified or higher follower artists first so they win canonical identity
  const sorted = [...rawArtists].sort((a, b) => {
    const aHasSlash = (a.name || '').includes('/') ? 1 : 0;
    const bHasSlash = (b.name || '').includes('/') ? 1 : 0;
    if (aHasSlash !== bHasSlash) return aHasSlash - bHasSlash;
    if (Boolean(a.verified) !== Boolean(b.verified)) return a.verified ? -1 : 1;
    return (b.followersCount || 0) - (a.followersCount || 0);
  });

  for (const candidate of sorted) {
    const cleanName = cleanArtistDisplayName(candidate.name);
    const keys = artistMatchKeys(candidate.name);
    let existing: Artist | undefined;
    for (const key of keys) {
      if (canonicalByKey.has(key)) {
        existing = canonicalByKey.get(key);
        break;
      }
    }

    if (existing) {
      existing.followersCount = Math.max(existing.followersCount || 0, candidate.followersCount || 0);
      existing.monthlyListeners = Math.max(existing.monthlyListeners || 0, candidate.monthlyListeners || 0);
      existing.totalStreams = (existing.totalStreams || 0) + (candidate.totalStreams || 0);
      existing.verified = Boolean(existing.verified || candidate.verified);
      existing.likedByUserIds = Array.from(
        new Set([...(existing.likedByUserIds || []), ...(candidate.likedByUserIds || [])])
      );
      existing.likesCount = existing.likedByUserIds.length;
      idRemap.set(candidate.id, existing);
      for (const key of keys) {
        canonicalByKey.set(key, existing);
      }
    } else {
      const normalized: Artist = {
        ...candidate,
        name: cleanName,
      };
      idRemap.set(candidate.id, normalized);
      for (const key of keys) {
        canonicalByKey.set(key, normalized);
      }
    }
  }

  const uniqueMap = new Map<string, Artist>();
  canonicalByKey.forEach((a) => uniqueMap.set(a.id, a));
  return {
    artists: Array.from(uniqueMap.values()),
    idRemap,
  };
}

function getEffectiveConnectionQuality(): 'high' | 'saver' {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  if (nav.connection?.saveData) return 'saver';
  const eff = nav.connection?.effectiveType;
  if (eff === 'slow-2g' || eff === '2g') return 'saver';
  return 'high';
}

export function isTrackLosslessSource(track?: Track | null): boolean {
  if (!track) return false;
  const fmt = `${track.audioFormat || ''} ${track.metadata?.audioFormat || ''} ${track.audioQuality || ''}`.toLowerCase();
  return fmt.includes('flac') || fmt.includes('wav') || fmt.includes('aiff') || fmt.includes('alac');
}

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, authReady, emailVerified, requireAuth, userSettings, updateUserSettings, updateCurrentUser } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const initialTracksSnapshot = (() => {
    const byId = new Map<string, Track>();
    try {
      const saved = localStorage.getItem(TRACKS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (t?.id && !isRemovedDemoTrackRecord(t)) byId.set(t.id, t);
          }
        }
      }
    } catch {}
    for (const snap of readLocalOfflineSnapshotsSync()) {
      if (snap?.id && !isRemovedDemoTrackRecord(snap) && !byId.has(snap.id)) {
        byId.set(snap.id, snap);
      }
    }
    return dedupeTracksById(Array.from(byId.values()));
  })();

  const [isCatalogLoaded, setIsCatalogLoaded] = useState<boolean>(
    () =>
      initialTracksSnapshot.length > 0 ||
      (typeof navigator !== 'undefined' && navigator.onLine === false)
  );
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogReloadNonce, setCatalogReloadNonce] = useState<number>(0);

  const [tracks, setTracks] = useState<Track[]>(initialTracksSnapshot);
  const [offlineTrackIds, setOfflineTrackIds] = useState<string[]>([]);
  const tracksCountRef = useRef<number>(initialTracksSnapshot.length);
  tracksCountRef.current = tracks.length;

  const [artists, setArtists] = useState<Artist[]>(() => {
    try {
      const saved = localStorage.getItem(ARTISTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return dedupeArtistsCatalog(parsed.filter((a) => !isRemovedDemoArtistRecord(a))).artists;
        }
      }
    } catch {}
    return [];
  });

  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const saved = localStorage.getItem('lowervibe_playlists_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [events, setEvents] = useState<ArtistEvent[]>(() => {
    try {
      const saved = localStorage.getItem(EVENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (e: ArtistEvent) =>
              !isRemovedDemoArtistValue(e?.artistId) &&
              !isRemovedDemoArtistValue(e?.artistName)
          );
        }
      }
    } catch {}
    return [];
  });

  const [claims, setClaims] = useState<ArtistClaim[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [monetizationConfig, setMonetizationConfig] = useState<MonetizationConfig>(DEFAULT_MONETIZATION_CONFIG);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [featuredVibe, setFeaturedVibe] = useState<FeaturedVibe>(() => {
    try {
      const saved = localStorage.getItem(FEATURED_VIBE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {
      trackId: '',
      date: new Date().toISOString().split('T')[0],
      curatorName: 'LOWERVIBE',
      curatorRole: 'Featured',
      curatorNote: '',
      quoteSnippet: '',
    };
  });

  const [savedTrackIds, setSavedTrackIds] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem('lowervibe_saved_tracks');
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    if (!authReady) return;
    if (!currentUser) {
      setSavedTrackIds([]);
      try {
        localStorage.removeItem('lowervibe_saved_tracks');
      } catch {}
      return;
    }
    const nextSaved = Array.isArray(currentUser.savedTrackIds) ? currentUser.savedTrackIds : [];
    setSavedTrackIds(nextSaved);
    try {
      localStorage.setItem('lowervibe_saved_tracks', JSON.stringify(nextSaved));
    } catch {}
  }, [authReady, currentUser?.id, currentUser?.savedTrackIds]);

  const [playHistory, setPlayHistory] = useState<PlayHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Always ensure deduplicated by trackId, newest first
          const seen = new Set<string>();
          return parsed.filter((item: PlayHistoryItem) => {
            if (!item?.trackId || seen.has(item.trackId)) return false;
            seen.add(item.trackId);
            return true;
          });
        }
      }
    } catch {}
    return [];
  });

  const initialPinnedSessionRef = useRef(getPinnedPlayerSession());
  const initialPinned = initialPinnedSessionRef.current;

  const [currentTrack, setCurrentTrack] = useState<Track | null>(() =>
    initialPinned.pinned ? initialPinned.track : null
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [hasPlayedInSession, setHasPlayedInSession] = useState<boolean>(() =>
    Boolean(initialPinned.pinned && initialPinned.track)
  );
  const [resumedFromStorage, setResumedFromStorage] = useState<boolean>(() =>
    Boolean(initialPinned.pinned && initialPinned.track)
  );
  const [pendingResumeSeekSeconds, setPendingResumeSeekSeconds] = useState<number>(() =>
    initialPinned.pinned ? initialPinned.currentTime : 0
  );

  const [currentTime, setCurrentTime] = useState<number>(() =>
    initialPinned.pinned ? initialPinned.currentTime : 0
  );
  const [duration, setDuration] = useState<number>(() =>
    initialPinned.pinned ? initialPinned.duration || initialPinned.track?.durationSeconds || 0 : 0
  );
  const [volume, setVolumeState] = useState<number>(() => initialPinned.volume);
  const [isMuted, setIsMuted] = useState<boolean>(() => initialPinned.isMuted);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => initialPinned.repeatMode);
  const [isShuffling, setIsShuffling] = useState<boolean>(() => initialPinned.isShuffling);
  const [queue, setQueue] = useState<Track[]>(() => initialPinned.queue);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const [crossfadeSeconds, setCrossfadeSecondsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('lowervibe_crossfade_v2');
      return saved !== null ? Math.max(0, Math.min(12, Number(saved))) : 4;
    } catch {
      return 4;
    }
  });

  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  crossfadeSecondsRef.current = crossfadeSeconds;
  const gaplessRef = useRef(userSettings.playback.gapless);
  gaplessRef.current = userSettings.playback.gapless;
  const isShufflingRef = useRef(isShuffling);
  isShufflingRef.current = isShuffling;
  const playSessionIdRef = useRef(0);
  const autoCrossfadedSessionRef = useRef<number | null>(null);
  const advanceNextTrackRef = useRef<(fadeOverrideSeconds?: number) => void>(() => {});

  const [playbackRate, setPlaybackRateState] = useState<number>(() => initialPinned.playbackRate || 1);

  // Sync audioEngine with hydrated session audio preferences once on mount
  useEffect(() => {
    audioEngine.setVolume(initialPinnedSessionRef.current.volume);
    audioEngine.setMute(initialPinnedSessionRef.current.isMuted);
    audioEngine.setPlaybackRate(initialPinnedSessionRef.current.playbackRate || 1);
  }, []);

  const [audioQuality, setAudioQualityState] = useState<AudioQualityPreference>(() => {
    try {
      const saved = localStorage.getItem(QUALITY_PREF_KEY);
      if (saved === 'auto' || saved === 'high' || saved === 'saver' || saved === 'lossless') {
        return saved;
      }
    } catch {}
    return 'auto';
  });

  // Sync user settings playback options to AudioEngine
  useEffect(() => {
    const p = userSettings.playback;
    if (typeof p.crossfadeSeconds === 'number') {
      setCrossfadeSecondsState(Math.max(0, Math.min(12, p.crossfadeSeconds)));
    }
    if (p.streamingQuality) {
      setAudioQualityState((prev) => {
        if (userSettings.dataSaver.enabled) return 'saver';
        if (prev === 'lossless' && p.streamingQuality === 'high') return 'lossless';
        return p.streamingQuality;
      });
    }
    if (p.eqPreset) {
      setEqPresetState(p.eqPreset);
      audioEngine.setEqPreset(p.eqPreset);
    }
    audioEngine.setNormalizeVolume(Boolean(p.normalizeVolume));
    audioEngine.setMonoAudio(Boolean(p.monoAudio));
  }, [userSettings.playback, userSettings.dataSaver.enabled]);

  const setCrossfadeSeconds = (sec: number) => {
    const clamped = Math.max(0, Math.min(12, Math.round(sec)));
    setCrossfadeSecondsState(clamped);
    try {
      localStorage.setItem('lowervibe_crossfade_v2', String(clamped));
    } catch {}
    updateUserSettings({ playback: { crossfadeSeconds: clamped } });
  };

  const setPlaybackRate = (rate: number) => {
    const clamped = Math.max(0.5, Math.min(2, rate));
    setPlaybackRateState(clamped);
    audioEngine.setPlaybackRate(clamped);
    pinPlayerSession({ playbackRate: clamped });
    syncMediaSessionPositionState(currentTime, duration, clamped);
  };

  const setAudioQuality = (q: AudioQualityPreference) => {
    setAudioQualityState(q);
    try {
      localStorage.setItem(QUALITY_PREF_KEY, q);
    } catch {}
    if (q === 'saver') {
      updateUserSettings({ playback: { streamingQuality: 'saver' }, dataSaver: { enabled: true } });
    } else if (q === 'auto' || q === 'high') {
      updateUserSettings({ playback: { streamingQuality: q }, dataSaver: { enabled: false } });
    } else if (q === 'lossless') {
      updateUserSettings({ playback: { streamingQuality: 'high' }, dataSaver: { enabled: false } });
    }
  };

  const [networkEffectiveQuality, setNetworkEffectiveQuality] = useState<'high' | 'saver'>(
    getEffectiveConnectionQuality
  );

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as Navigator & {
      connection?: { addEventListener?: (e: string, fn: () => void) => void; removeEventListener?: (e: string, fn: () => void) => void };
    };
    const update = () => setNetworkEffectiveQuality(getEffectiveConnectionQuality());
    nav.connection?.addEventListener?.('change', update);
    return () => nav.connection?.removeEventListener?.('change', update);
  }, []);

  const effectiveAudioQuality: 'high' | 'saver' | 'lossless' = (() => {
    if (userSettings.dataSaver.enabled) return 'saver';
    if (audioQuality === 'lossless') {
      return isTrackLosslessSource(currentTrack) ? 'lossless' : 'high';
    }
    if (audioQuality === 'saver') return 'saver';
    if (audioQuality === 'high') return 'high';
    return networkEffectiveQuality;
  })();

  const effectiveBitrateKbps =
    effectiveAudioQuality === 'lossless'
      ? 'FLAC / WAV'
      : effectiveAudioQuality === 'high'
      ? '320 kbps'
      : '96 kbps';

  const estimatedMbPerMinute =
    effectiveAudioQuality === 'lossless' ? 6.5 : effectiveAudioQuality === 'high' ? 1.8 : 0.6;

  useEffect(() => {
    audioEngine.setDataSaverMode(effectiveAudioQuality === 'saver');
  }, [effectiveAudioQuality]);

  // Sleep Timer state
  const [sleepTimerMinutes, setSleepTimerMinutesState] = useState<number | null>(null);
  const [sleepAtEndOfTrack, setSleepAtEndOfTrackState] = useState<boolean>(false);
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const [sleepTimerRemainingSeconds, setSleepTimerRemainingSeconds] = useState<number | null>(null);
  const isFadingOutSleepRef = useRef<boolean>(false);

  const setSleepTimer = (minutes: number | null) => {
    isFadingOutSleepRef.current = false;
    setSleepAtEndOfTrackState(false);
    if (minutes === null || minutes <= 0) {
      setSleepTimerMinutesState(null);
      setSleepTimerEndsAt(null);
      setSleepTimerRemainingSeconds(null);
    } else {
      setSleepTimerMinutesState(minutes);
      const endsAt = Date.now() + minutes * 60 * 1000;
      setSleepTimerEndsAt(endsAt);
      setSleepTimerRemainingSeconds(minutes * 60);
    }
  };

  const setSleepAtEndOfTrack = (enabled: boolean) => {
    if (enabled) {
      setSleepTimerMinutesState(null);
      setSleepTimerEndsAt(null);
      setSleepTimerRemainingSeconds(null);
    }
    setSleepAtEndOfTrackState(enabled);
  };

  const cancelSleepTimer = () => {
    setSleepAtEndOfTrackState(false);
    setSleepTimer(null);
  };

  useEffect(() => {
    if (!sleepTimerEndsAt) {
      setSleepTimerRemainingSeconds(null);
      isFadingOutSleepRef.current = false;
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((sleepTimerEndsAt - now) / 1000));
      setSleepTimerRemainingSeconds(remaining);

      if (remaining <= 0 && !isFadingOutSleepRef.current) {
        isFadingOutSleepRef.current = true;
        clearInterval(interval);
        setSleepTimerMinutesState(null);
        setSleepTimerEndsAt(null);
        setSleepTimerRemainingSeconds(null);
        audioEngine.fadeOutAndPause(3, () => {
          setIsPlaying(false);
          isFadingOutSleepRef.current = false;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerEndsAt]);

  // Location / Country selector state
  const [selectedCountry, setSelectedCountryState] = useState<string>(() => detectDefaultCountry());

  useEffect(() => {
    if (currentUser?.country && currentUser.country.trim()) {
      setSelectedCountryState(currentUser.country);
      try {
        localStorage.setItem('lowervibe_user_country', currentUser.country);
      } catch {}
    }
  }, [currentUser?.country]);

  const setSelectedCountry = (country: string) => {
    const clean = country.trim() || 'Malawi';
    setSelectedCountryState(clean);
    try {
      localStorage.setItem('lowervibe_user_country', clean);
    } catch {}
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.id), { country: clean }).catch(() => {});
    }
  };

  // Modals & Drawers
  const [isFullscreenPlayerOpen, setIsFullscreenPlayerOpen] = useState<boolean>(false);
  const [fullscreenPlayerTab, setFullscreenPlayerTab] = useState<FullscreenPlayerTab>('playing');
  const openFullscreenPlayer = (tab: FullscreenPlayerTab = 'playing') => {
    setFullscreenPlayerTab(tab);
    setIsFullscreenPlayerOpen(true);
  };
  const [activeShareTrack, setActiveShareTrack] = useState<Track | null>(null);
  const [activeShareArtist, setActiveShareArtist] = useState<Artist | null>(null);
  const [activeDetailTrack, setActiveDetailTrack] = useState<Track | null>(null);
  const [selectedArtistModal, setSelectedArtistModal] = useState<Artist | null>(null);
  const [isArtistSubmitModalOpen, setIsArtistSubmitModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'register'>('login');
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState<boolean>(false);
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [analyticsArtist, setAnalyticsArtist] = useState<Artist | null>(null);

  const [isVisualizerActive, setIsVisualizerActive] = useState<boolean>(true);
  const [visualizerStyle, setVisualizerStyleState] = useState<'bars' | 'wave' | 'pulse'>('bars');
  const [eqPreset, setEqPresetState] = useState<EqPreset>('flat');

  const [isLegalModalOpen, setIsLegalModalOpen] = useState<boolean>(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  const [activeDownload, setActiveDownload] = useState<{
    trackId: string;
    trackTitle: string;
    artistName: string;
    progress: number;
    isComplete: boolean;
  } | null>(null);
  const [activeBatchDownload, setActiveBatchDownload] = useState<BatchOfflineDownloadState | null>(null);

  const sessionListenedSeconds = useRef<number>(0);
  const actualListenedSecRef = useRef<number>(0);
  const lastTimeUpdatePosRef = useRef<number | null>(null);
  const hasStreamBeenValidated = useRef<boolean>(false);
  const hasAttemptedResumeRestoreRef = useRef<boolean>(false);
  const artistRemapRef = useRef<Map<string, Artist>>(new Map());

  // Debounced, size-bounded local cache persistence (prevents synchronous blocking & QuotaExceededError)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      safeCacheSnapshotWrite(TRACKS_STORAGE_KEY, tracks, 100, (t) => ({
        ...t,
        coverArt: stripOversizedInlineDataUrl(t.coverArt) || DEFAULT_ARTWORK_SVG,
        artistAvatar: stripOversizedInlineDataUrl(t.artistAvatar) || DEFAULT_AVATAR_SVG,
      }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [tracks]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      safeCacheSnapshotWrite(ARTISTS_STORAGE_KEY, artists, 100, (a) => ({
        ...a,
        avatar: stripOversizedInlineDataUrl(a.avatar) || DEFAULT_AVATAR_SVG,
        banner: stripOversizedInlineDataUrl(a.banner) || DEFAULT_BANNER_SVG,
      }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [artists]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      safeCacheSnapshotWrite(EVENTS_STORAGE_KEY, events, 50);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [events]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      safeCacheSnapshotWrite(AUDIT_STORAGE_KEY, auditLogs, 80);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [auditLogs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(FEATURED_VIBE_KEY, JSON.stringify(featuredVibe));
      } catch {}
    }, 500);
    return () => window.clearTimeout(timer);
  }, [featuredVibe]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      safeCacheSnapshotWrite(HISTORY_STORAGE_KEY, playHistory, 80);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [playHistory]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      safeCacheSnapshotWrite('lowervibe_playlists_v3', playlists, 60, (p) => ({
        ...p,
        coverArt: stripOversizedInlineDataUrl(p.coverArt) || DEFAULT_ARTWORK_SVG,
      }));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [playlists]);

  // Flush pinned session store immediately on pagehide or background transition
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFlush = () => flushPinnedPlayerSession();
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushPinnedPlayerSession();
      }
    };
    window.addEventListener('pagehide', handleFlush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Save exact playback track + position so reopen restores cleanly (only while active)
  useEffect(() => {
    if (!currentTrack) {
      return;
    }
    updatePinnedPlayerPosition(currentTime, duration);
  }, [currentTrack?.id, Math.floor(currentTime / 2), duration, playbackRate]);

  // Update playHistory listened progress periodically for "Continue listening" bar
  useEffect(() => {
    if (!currentTrack || currentTime <= 1) return;
    const roundedPos = Math.floor(currentTime);
    setPlayHistory((prev) =>
      prev.map((item) =>
        item.trackId === currentTrack.id
          ? {
              ...item,
              listenedDurationSeconds: roundedPos,
              completed: duration > 0 && roundedPos >= Math.max(0, duration - 5),
            }
          : item
      )
    );
  }, [currentTrack?.id, Math.floor(currentTime / 5), duration]);

  // Restore saved track + position once catalog loads (for cold new tabs where sessionStorage wasn't populated)
  useEffect(() => {
    if (hasAttemptedResumeRestoreRef.current || tracks.length === 0) return;
    hasAttemptedResumeRestoreRef.current = true;
    if (initialPinnedSessionRef.current.pinned && initialPinnedSessionRef.current.track) {
      // Refresh metadata snapshot from authoritative Firestore catalog without disturbing position
      const fresh = tracks.find(
        (t) => t.id === initialPinnedSessionRef.current.track?.id && !t.isDraft && !t.isDeranked
      );
      if (fresh) {
        setCurrentTrack(fresh);
        pinPlayerSession({ pinned: true, track: fresh });
      }
      return;
    }
    try {
      const raw = localStorage.getItem(RESUME_PLAYBACK_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as ResumePlaybackState;
      if (!saved?.trackId) return;
      const found = tracks.find((t) => t.id === saved.trackId && !t.isDraft && !t.isDeranked);
      if (!found) return;
      const resolvedDur = found.metadata?.Duration ?? found.metadata?.duration ?? found.durationSeconds ?? 0;
      const maxPos = Math.max(
        0,
        Math.min(saved.positionSeconds || 0, Math.max(0, resolvedDur - 2))
      );
      const restoredRate = saved.playbackRate || 1;
      setCurrentTrack(found);
      setDuration(resolvedDur);
      setCurrentTime(maxPos);
      setPendingResumeSeekSeconds(maxPos);
      setHasPlayedInSession(true);
      if (saved.playbackRate) {
        setPlaybackRateState(restoredRate);
        audioEngine.setPlaybackRate(restoredRate);
      }
      setResumedFromStorage(true);
      pinPlayerSession({
        pinned: true,
        track: found,
        currentTime: maxPos,
        duration: resolvedDur,
        isPlaying: false,
        playbackRate: restoredRate,
      });
    } catch {}
  }, [tracks]);

  const didRunConnectionCheckRef = useRef(false);
  const publicPlaylistsRef = useRef<Playlist[]>([]);
  const ownPlaylistsRef = useRef<Playlist[]>([]);
  const adminPlaylistsRef = useRef<Playlist[] | null>(null);

  const syncMergedPlaylists = () => {
    if (adminPlaylistsRef.current) {
      setPlaylists(adminPlaylistsRef.current);
      return;
    }
    const merged = new Map<string, Playlist>();
    publicPlaylistsRef.current.forEach((p) => merged.set(p.id, p));
    ownPlaylistsRef.current.forEach((p) => merged.set(p.id, p));
    setPlaylists(Array.from(merged.values()));
  };

  // Sync offline IndexedDB audio keys & hydrate offline track snapshots cleanly
  useEffect(() => {
    let active = true;
    const syncOfflineCache = async () => {
      try {
        const [cachedIds, offlineSnaps] = await Promise.all([
          getCachedAudioTrackIds(),
          getOfflineTrackSnapshots(),
        ]);
        if (!active) return;
        setOfflineTrackIds(cachedIds);
        if (offlineSnaps.length > 0) {
          setTracks((prev) => {
            const byId = new Map(prev.map((t) => [t.id, t]));
            let added = false;
            for (const snap of offlineSnaps) {
              if (snap?.id && !isRemovedDemoTrackRecord(snap) && !byId.has(snap.id)) {
                byId.set(snap.id, snap);
                added = true;
              }
            }
            return added ? dedupeTracksById(Array.from(byId.values())) : prev;
          });
          setIsCatalogLoaded(true);
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setIsCatalogLoaded(true);
        }
      } catch {}
    };

    void syncOfflineCache();
    const onCacheChanged = () => {
      void syncOfflineCache();
    };
    window.addEventListener('lowervibe:offline-cache-changed', onCacheChanged);
    window.addEventListener('offline', onCacheChanged);
    return () => {
      active = false;
      window.removeEventListener('lowervibe:offline-cache-changed', onCacheChanged);
      window.removeEventListener('offline', onCacheChanged);
    };
  }, []);

  // Public Firestore Real-time Catalog Synchronizers (never torn down on auth state transitions)
  useEffect(() => {
    setCatalogError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsCatalogLoaded(true);
    }
    if (!didRunConnectionCheckRef.current) {
      didRunConnectionCheckRef.current = true;
      testFirestoreConnection().catch(() => {});
    }

    const offlineSafetyTimer = window.setTimeout(() => {
      if (typeof navigator !== 'undefined' && (!navigator.onLine || tracksCountRef.current > 0)) {
        setIsCatalogLoaded(true);
      }
    }, 3000);

    const mapTrackDoc = (id: string, raw: Track): Track => {
      const resolvedDuration = Math.max(
        0,
        Math.round(raw.metadata?.Duration ?? raw.metadata?.duration ?? raw.durationSeconds ?? 0)
      );
      const likedBy = Array.isArray(raw.likedByUserIds)
        ? Array.from(new Set(raw.likedByUserIds.filter(Boolean)))
        : undefined;
      const remappedArtist = artistRemapRef.current.get(raw.artistId);
      return {
        ...raw,
        id,
        artistId: remappedArtist ? remappedArtist.id : raw.artistId,
        artistName: remappedArtist ? remappedArtist.name : cleanArtistDisplayName(raw.artistName),
        coverArt: raw.coverArt || DEFAULT_ARTWORK_SVG,
        artistAvatar: raw.artistAvatar || DEFAULT_AVATAR_SVG,
        durationSeconds: resolvedDuration,
        metadata: {
          ...(raw.metadata || {}),
          Duration: resolvedDuration,
          duration: resolvedDuration,
          durationFormatted: raw.metadata?.durationFormatted || formatTime(resolvedDuration),
          bitrate: raw.metadata?.bitrate || raw.bitrate,
          sampleRate: raw.metadata?.sampleRate || raw.sampleRate,
          bitDepth: raw.metadata?.bitDepth || raw.bitDepth,
          fileSize: raw.metadata?.fileSize || raw.fileSize,
          audioFormat: raw.metadata?.audioFormat || raw.audioFormat || raw.audioQuality,
          isrcCode: raw.metadata?.isrcCode || raw.isrcCode,
          bpm: raw.metadata?.bpm ?? raw.bpm,
          keySignature: raw.metadata?.keySignature || raw.keySignature,
          composer: raw.metadata?.composer || raw.composer,
          recordLabel: raw.metadata?.recordLabel || raw.recordLabel,
        },
        likedByUserIds: likedBy,
        likes: likedBy ? likedBy.length : Math.max(0, raw.likes || 0),
        lyrics: typeof raw.lyrics === 'string' ? raw.lyrics : typeof raw.metadata?.lyrics === 'string' ? raw.metadata.lyrics : undefined,
      } as Track;
    };

    const unsubTracks = onSnapshot(
      query(collection(db, 'tracks'), limit(250)),
      (snap) => {
        window.clearTimeout(offlineSafetyTimer);
        const mapped = snap.docs
          .map((d) => mapTrackDoc(d.id, d.data() as Track))
          .filter((t) => !isRemovedDemoTrackRecord(t));

        const loadedTracks = dedupeTracksById(mapped);
        setTracks(loadedTracks);
        setIsCatalogLoaded(true);
        setCatalogError(null);
        setCurrentTrack((prev) => {
          if (!prev) return null;
          return loadedTracks.find((t) => t.id === prev.id) || (isRemovedDemoTrackRecord(prev) ? null : prev);
        });
        setActiveDetailTrack((prev) => {
          if (!prev) return null;
          return loadedTracks.find((t) => t.id === prev.id) || (isRemovedDemoTrackRecord(prev) ? null : prev);
        });
      },
      (err) => {
        window.clearTimeout(offlineSafetyTimer);
        setIsCatalogLoaded(true);
        if (tracksCountRef.current === 0 && (typeof navigator === 'undefined' || navigator.onLine)) {
          setCatalogError(formatFirebaseError(err, 'Could not load music catalog'));
        }
        try {
          handleFirestoreError(err, OperationType.LIST, 'tracks');
        } catch {}
      }
    );

    const unsubArtists = onSnapshot(
      query(collection(db, 'artists'), limit(200)),
      (snap) => {
        const removedIds = new Set<string>();
        const rawArtists = snap.docs
          .map((d) => {
            const raw = d.data() as Partial<Artist> & { headerImage?: string; genre?: string; region?: string };
            const safeName = raw.name || 'Artist';
            const cleanName = cleanArtistDisplayName(safeName);
            const safeHandle = raw.handle || `@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'artist'}`;
            const likedBy = Array.isArray(raw.likedByUserIds)
              ? Array.from(new Set(raw.likedByUserIds.filter(Boolean)))
              : undefined;
            return {
              ...raw,
              id: d.id,
              name: safeName,
              handle: safeHandle,
              avatar: raw.avatar || DEFAULT_AVATAR_SVG,
              banner: raw.banner || raw.headerImage || DEFAULT_BANNER_SVG,
              bio: raw.bio || '',
              location: raw.location || raw.region || raw.country || 'Malawi',
              country: raw.country || raw.location || raw.region || '',
              followersCount: typeof raw.followersCount === 'number' ? raw.followersCount : 0,
              likedByUserIds: likedBy,
              likesCount: likedBy ? likedBy.length : Math.max(0, raw.likesCount || 0),
              monthlyListeners: typeof raw.monthlyListeners === 'number' ? raw.monthlyListeners : 0,
              verified: Boolean(raw.verified),
              joinedDate: raw.joinedDate || new Date().toISOString(),
              genres: Array.isArray(raw.genres) ? raw.genres : raw.genre ? [raw.genre] : ['Afro-Fusion'],
              socials: raw.socials && typeof raw.socials === 'object' ? raw.socials : {},
              gearAndSetup: Array.isArray(raw.gearAndSetup) ? raw.gearAndSetup : [],
              endorsedBy: Array.isArray(raw.endorsedBy) ? raw.endorsedBy : [],
            } as Artist;
          })
          .filter((artist) => {
            if (isRemovedDemoArtistRecord(artist)) {
              removedIds.add(artist.id);
              return false;
            }
            return true;
          });

        const { artists: dedupedArtists, idRemap } = dedupeArtistsCatalog(rawArtists);
        artistRemapRef.current = idRemap;
        setArtists(dedupedArtists);

        // Apply artist name/ID deduplication and demo-artist exclusion to loaded tracks immediately
        setTracks((prevTracks) =>
          prevTracks
            .filter((t) => !isRemovedDemoTrackRecord(t, removedIds))
            .map((t) => {
              const canonical = idRemap.get(t.artistId);
              if (!canonical) return t;
              if (canonical.id !== t.artistId || canonical.name !== t.artistName) {
                return { ...t, artistId: canonical.id, artistName: canonical.name };
              }
              return t;
            })
        );
      },
      (err) => {
        console.error('Artists listener error:', formatFirebaseError(err));
      }
    );

    const unsubPublicPlaylists = onSnapshot(
      query(collection(db, 'playlists'), where('isPublic', '==', true), limit(120)),
      (snap) => {
        publicPlaylistsRef.current = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Playlist));
        syncMergedPlaylists();
      },
      () => {}
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'events'), limit(100)),
      (snap) => {
        const loadedEvents = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as ArtistEvent))
          .filter(
            (e) =>
              !isRemovedDemoArtistValue(e.artistId) &&
              !isRemovedDemoArtistValue(e.artistName)
          );
        setEvents(loadedEvents);
      },
      () => {}
    );

    const unsubPlatformConfig = onSnapshot(
      doc(db, 'config', 'platform'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<MonetizationConfig>;
          setMonetizationConfig({
            ...DEFAULT_MONETIZATION_CONFIG,
            ...data,
            socialLinks: sanitizePlatformSocialLinks(data.socialLinks),
          });
        }
      },
      () => {}
    );

    return () => {
      unsubTracks();
      unsubArtists();
      unsubPublicPlaylists();
      unsubEvents();
      unsubPlatformConfig();
    };
  }, [catalogReloadNonce]);

  // Authenticated & Admin-scoped Firestore Synchronizers (start only after authReady settles)
  useEffect(() => {
    const fbUser = auth.currentUser;
    const isAuthenticatedSession = Boolean(
      authReady && currentUser && fbUser && fbUser.uid === currentUser.id
    );
    const activeUid = isAuthenticatedSession && fbUser ? fbUser.uid : null;
    const isVerifiedAdminUser = Boolean(
      isAuthenticatedSession && fbUser && isVerifiedAdminGoogleSession(fbUser)
    );

    if (!activeUid) {
      adminPlaylistsRef.current = null;
      ownPlaylistsRef.current = [];
      syncMergedPlaylists();
      setPayoutMethods([]);
      setPayoutRequests([]);
      setSupportTickets([]);
      setAuditLogs([]);
      return;
    }

    let unsubAdminPlaylists = () => {};
    let unsubOwnPlaylists = () => {};

    if (isVerifiedAdminUser) {
      unsubAdminPlaylists = onSnapshot(
        query(collection(db, 'playlists'), limit(200)),
        (snap) => {
          adminPlaylistsRef.current = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Playlist));
          syncMergedPlaylists();
        },
        () => {}
      );
    } else {
      adminPlaylistsRef.current = null;
      unsubOwnPlaylists = onSnapshot(
        query(collection(db, 'playlists'), where('createdBy', '==', activeUid), limit(80)),
        (snap) => {
          ownPlaylistsRef.current = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Playlist));
          syncMergedPlaylists();
        },
        () => {}
      );
    }

    const unsubPayoutMethods = onSnapshot(
      query(collection(db, 'payoutMethods'), where('userId', '==', activeUid), limit(30)),
      (snap) => {
        setPayoutMethods(snap.docs.map((d) => ({ ...d.data(), id: d.id } as PayoutMethod)));
      },
      (err) => {
        console.error('Payout methods listener error:', formatFirebaseError(err));
      }
    );

    const unsubPayoutRequests = onSnapshot(
      isVerifiedAdminUser
        ? query(collection(db, 'payoutRequests'), limit(200))
        : query(collection(db, 'payoutRequests'), where('userId', '==', activeUid), limit(100)),
      (snap) => {
        setPayoutRequests(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id } as PayoutRequest))
            .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
        );
      },
      (err) => {
        console.error('Payout requests listener error:', formatFirebaseError(err));
      }
    );

    const unsubTickets = onSnapshot(
      isVerifiedAdminUser
        ? query(collection(db, 'tickets'), limit(200))
        : query(collection(db, 'tickets'), where('userId', '==', activeUid), limit(80)),
      (snap) => {
        setSupportTickets(
          snap.docs
            .map((d) => ({ ...d.data(), id: d.id } as SupportTicket))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
      },
      () => {}
    );

    let unsubAudit = () => {};
    if (isVerifiedAdminUser) {
      unsubAudit = onSnapshot(
        query(collection(db, 'audit_logs'), limit(200)),
        (snap) => {
          setAuditLogs(snap.docs.map((d) => ({ ...d.data(), id: d.id } as AuditLogEntry)));
        },
        () => {}
      );
    } else {
      setAuditLogs([]);
    }

    return () => {
      unsubAdminPlaylists();
      unsubOwnPlaylists();
      unsubPayoutMethods();
      unsubPayoutRequests();
      unsubTickets();
      unsubAudit();
    };
  }, [authReady, currentUser?.id, currentUser?.email, emailVerified, catalogReloadNonce]);

  const catalogRefreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const lastCatalogRefreshAtRef = useRef<number>(0);

  const refreshCatalog = async (): Promise<boolean> => {
    if (catalogRefreshInFlightRef.current) {
      return catalogRefreshInFlightRef.current;
    }

    const now = Date.now();
    if (now - lastCatalogRefreshAtRef.current < 3000) {
      void flushPendingSyncOperations().catch(() => {});
      return true;
    }

    const run = (async () => {
      lastCatalogRefreshAtRef.current = Date.now();
      try {
        const [connRes, , tracksRes, artistsRes] = await Promise.allSettled([
          testFirestoreConnection(),
          flushPendingSyncOperations(),
          getDocsFromServer(query(collection(db, 'tracks'), limit(150))),
          getDocsFromServer(query(collection(db, 'artists'), limit(150))),
        ]);

        let refreshedAny = false;
        const removedArtistIds = new Set<string>();
        if (artistsRes.status === 'fulfilled') {
          refreshedAny = true;
          const rawArtists = artistsRes.value.docs
            .map((d) => {
              const raw = d.data() as Partial<Artist> & { headerImage?: string; genre?: string; region?: string };
              const safeName = raw.name || 'Artist';
              const cleanName = cleanArtistDisplayName(safeName);
              const safeHandle = raw.handle || `@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'artist'}`;
              const likedBy = Array.isArray(raw.likedByUserIds)
                ? Array.from(new Set(raw.likedByUserIds.filter(Boolean)))
                : undefined;
              return {
                ...raw,
                id: d.id,
                name: safeName,
                handle: safeHandle,
                avatar: raw.avatar || DEFAULT_AVATAR_SVG,
                banner: raw.banner || raw.headerImage || DEFAULT_BANNER_SVG,
                bio: raw.bio || '',
                location: raw.location || raw.region || raw.country || 'Malawi',
                country: raw.country || raw.location || raw.region || '',
                followersCount: typeof raw.followersCount === 'number' ? raw.followersCount : 0,
                likedByUserIds: likedBy,
                likesCount: likedBy ? likedBy.length : Math.max(0, raw.likesCount || 0),
                monthlyListeners: typeof raw.monthlyListeners === 'number' ? raw.monthlyListeners : 0,
                verified: Boolean(raw.verified),
                joinedDate: raw.joinedDate || new Date().toISOString(),
                genres: Array.isArray(raw.genres) ? raw.genres : raw.genre ? [raw.genre] : ['Afro-Fusion'],
                socials: raw.socials && typeof raw.socials === 'object' ? raw.socials : {},
                gearAndSetup: Array.isArray(raw.gearAndSetup) ? raw.gearAndSetup : [],
                endorsedBy: Array.isArray(raw.endorsedBy) ? raw.endorsedBy : [],
              } as Artist;
            })
            .filter((artist) => {
              if (isRemovedDemoArtistRecord(artist)) {
                removedArtistIds.add(artist.id);
                return false;
              }
              return true;
            });
          const { artists: dedupedArtists, idRemap } = dedupeArtistsCatalog(rawArtists);
          artistRemapRef.current = idRemap;
          setArtists(dedupedArtists);
        }

        if (tracksRes.status === 'fulfilled') {
          refreshedAny = true;
          const freshTracks = dedupeTracksById(
            tracksRes.value.docs
              .map((d) => {
                const raw = d.data() as Track;
                const resolvedDuration = Math.max(
                  0,
                  Math.round(raw.metadata?.Duration ?? raw.metadata?.duration ?? raw.durationSeconds ?? 0)
                );
                const likedBy = Array.isArray(raw.likedByUserIds)
                  ? Array.from(new Set(raw.likedByUserIds.filter(Boolean)))
                  : undefined;
                const remappedArtist = artistRemapRef.current.get(raw.artistId);
                return {
                  ...raw,
                  id: d.id,
                  artistId: remappedArtist ? remappedArtist.id : raw.artistId,
                  artistName: remappedArtist ? remappedArtist.name : cleanArtistDisplayName(raw.artistName),
                  coverArt: raw.coverArt || DEFAULT_ARTWORK_SVG,
                  artistAvatar: raw.artistAvatar || DEFAULT_AVATAR_SVG,
                  durationSeconds: resolvedDuration,
                  metadata: {
                    ...(raw.metadata || {}),
                    Duration: resolvedDuration,
                    duration: resolvedDuration,
                    durationFormatted: raw.metadata?.durationFormatted || formatTime(resolvedDuration),
                    bitrate: raw.metadata?.bitrate || raw.bitrate,
                    sampleRate: raw.metadata?.sampleRate || raw.sampleRate,
                    bitDepth: raw.metadata?.bitDepth || raw.bitDepth,
                    fileSize: raw.metadata?.fileSize || raw.fileSize,
                    audioFormat: raw.metadata?.audioFormat || raw.audioFormat || raw.audioQuality,
                    isrcCode: raw.metadata?.isrcCode || raw.isrcCode,
                    bpm: raw.metadata?.bpm ?? raw.bpm,
                    keySignature: raw.metadata?.keySignature || raw.keySignature,
                    composer: raw.metadata?.composer || raw.composer,
                    recordLabel: raw.metadata?.recordLabel || raw.recordLabel,
                  },
                  likedByUserIds: likedBy,
                  likes: likedBy ? likedBy.length : Math.max(0, raw.likes || 0),
                } as Track;
              })
              .filter((t) => !isRemovedDemoTrackRecord(t, removedArtistIds))
          );
          setTracks((prev) => {
            const byId = new Map(
              prev.filter((t) => !isRemovedDemoTrackRecord(t, removedArtistIds)).map((t) => [t.id, t])
            );
            for (const ft of freshTracks) {
              byId.set(ft.id, ft);
            }
            return dedupeTracksById(Array.from(byId.values())).slice(0, 250);
          });
          setIsCatalogLoaded(true);
          setCatalogError(null);
        }

        const connected = connRes.status === 'fulfilled' && Boolean(connRes.value);
        return refreshedAny || connected;
      } catch {
        return false;
      } finally {
        catalogRefreshInFlightRef.current = null;
      }
    })();

    catalogRefreshInFlightRef.current = run;
    return run;
  };

  const retryCatalogLoad = () => {
    setIsCatalogLoaded(false);
    setCatalogError(null);
    enableNetwork(db).catch(() => {});
    setCatalogReloadNonce((n) => n + 1);
  };

  // Preload next track for gapless / crossfade handoff
  useEffect(() => {
    if (!currentTrack) return;
    const available = tracks.filter((t) => !t.isDraft && !t.isDeranked);
    let nextCandidate: Track | undefined = queue.find((t) => !t.isDraft && !t.isDeranked);
    if (!nextCandidate && available.length > 0 && !isShuffling) {
      const curIdx = available.findIndex((x) => x.id === currentTrack.id);
      if (curIdx >= 0) {
        const candidate = available[(curIdx + 1) % available.length];
        if (candidate && candidate.id !== currentTrack.id) {
          nextCandidate = candidate;
        }
      }
    }

    if (nextCandidate?.audioUrl) {
      audioEngine.preloadNext(nextCandidate.audioUrl, effectiveAudioQuality === 'saver');
    }
  }, [currentTrack?.id, queue, tracks, isShuffling, effectiveAudioQuality]);

  const isAuthenticatedListener = Boolean(
    currentUser && auth.currentUser && auth.currentUser.uid === currentUser.id
  );

  // Reset per-track play validation when listener signs in so post-signup streams count
  useEffect(() => {
    if (isAuthenticatedListener) {
      hasStreamBeenValidated.current = false;
    }
  }, [currentUser?.id, isAuthenticatedListener]);

  /**
   * Append-only real play event recording:
   * - Counts after 30 seconds of listening or 50% of the track, whichever is shorter.
   * - Same user replaying the same track counts once per hour.
   * - Recorded server-side (/api/plays/record) with durable offline fallback.
   */
  const recordValidatedPlay = async (playedTrack: Track, listenedSeconds: number, trackDurationSeconds: number) => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return;
    }
    const userId = currentUser.id;
    const windowKey = Math.floor(Date.now() / (60 * 60 * 1000));
    const dedupeToken = `${userId}_${playedTrack.id}_${windowKey}`;

    try {
      const raw = sessionStorage.getItem(PLAY_DEDUPE_KEY);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      if (seen.includes(dedupeToken)) {
        return; // Deduplicate inside same 1-hour window
      }
      const nextSeen = [...seen.slice(-50), dedupeToken];
      sessionStorage.setItem(PLAY_DEDUPE_KEY, JSON.stringify(nextSeen));
    } catch {}

    const regionKey =
      selectedCountry && selectedCountry !== 'Global'
        ? selectedCountry
        : playedTrack.region || 'Malawi';
    const safeRegionField = regionKey.replace(/[.$/[\]#]/g, '_');

    const isArtistSelfPlay = Boolean(
      currentUser &&
        (currentUser.id === playedTrack.uploadedByUserId ||
          (currentUser.artistId && currentUser.artistId === playedTrack.artistId))
    );

    // Update UI count immediately
    setTracks((all) =>
      all.map((t) => {
        if (t.id !== playedTrack.id) return t;
        const nextRegionStats = { ...(t.regionStats || {}) };
        nextRegionStats[regionKey] = (nextRegionStats[regionKey] || 0) + 1;
        return { ...t, plays: (t.plays || 0) + 1, regionStats: nextRegionStats };
      })
    );

    // Track real estimated data used this month
    const usedBytes = Math.round(
      ((playedTrack.durationSeconds || 180) / 60) * estimatedMbPerMinute * 1024 * 1024
    );
    const curMonth = new Date().toISOString().slice(0, 7);
    const prevBytes =
      userSettings.dataSaver.dataUsageMonthKey === curMonth
        ? userSettings.dataSaver.estimatedDataUsedBytesThisMonth
        : 0;
    updateUserSettings({
      dataSaver: {
        dataUsageMonthKey: curMonth,
        estimatedDataUsedBytesThisMonth: prevBytes + usedBytes,
      },
    });

    const normalizedListened = Math.max(1, Math.round(listenedSeconds));
    let serverCounted = false;
    let serverRejected = false;
    let serverPersistedToFirestore = false;

    try {
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('/api/plays/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          trackId: playedTrack.id,
          listenedSeconds: normalizedListened,
          durationSeconds: trackDurationSeconds || playedTrack.durationSeconds || 0,
          country: regionKey,
        }),
      });
      if (resp.ok) {
        const json = (await resp.json()) as {
          ok?: boolean;
          counted?: boolean;
          firestorePersisted?: boolean;
        };
        if (json.ok && json.counted === false) {
          serverRejected = true;
        } else if (json.ok && json.counted) {
          serverCounted = true;
          serverPersistedToFirestore = Boolean(json.firestorePersisted);
        }
      }
    } catch {
      // Offline / unreachable: fall through to durable Firestore outbox below
    }

    if (serverRejected) {
      // Server 1-hour dedupe or duration threshold rejected this duplicate replay; revert optimistic increment
      setTracks((all) =>
        all.map((t) => {
          if (t.id !== playedTrack.id) return t;
          const nextRegionStats = { ...(t.regionStats || {}) };
          if ((nextRegionStats[regionKey] || 0) > 0) {
            nextRegionStats[regionKey] = nextRegionStats[regionKey] - 1;
          }
          return { ...t, plays: Math.max(0, (t.plays || 0) - 1), regionStats: nextRegionStats };
        })
      );
      return;
    }

    if (serverCounted && serverPersistedToFirestore) {
      return;
    }

    const playId = `play-${dedupeToken}-${Date.now()}`;
    const playRecord: PlayRecord = {
      id: playId,
      trackId: playedTrack.id,
      artistId: playedTrack.artistId,
      userId,
      country: regionKey,
      listenedSeconds: normalizedListened,
      windowKey,
      isArtistSelfPlay,
      qualifiesForPayout: !isArtistSelfPlay,
      playedAt: new Date().toISOString(),
    };

    try {
      void durableSetDoc('plays', playId, playRecord as unknown as Record<string, unknown>, {
        mirrorBackup: false,
      });

      void durableUpdateDoc(
        'tracks',
        playedTrack.id,
        {},
        {
          increments: {
            plays: 1,
            [`regionStats.${safeRegionField}`]: 1,
          },
        }
      );

      const matchedArtist = artists.find((a) => a.id === playedTrack.artistId);
      if (matchedArtist) {
        void durableUpdateDoc(
          'artists',
          matchedArtist.id,
          {},
          {
            increments: {
              totalStreams: 1,
              [`regionStats.${safeRegionField}`]: 1,
            },
          }
        );
      }
    } catch {}
  };

  // Hook AudioEngine events (with Battery Saver UI refresh throttling)
  const lastUiTimeUpdateMsRef = useRef<number>(0);
  useEffect(() => {
    audioEngine.onTimeUpdate = (curr, dur) => {
      const nowMs = Date.now();
      const batterySaverOn = getIsBatterySaverActive();
      const effectiveDur = dur > 0 ? Math.round(dur) : duration;

      // In Battery Saver mode, throttle React UI time updates to ~1Hz while keeping play counting accurate
      if (
        !batterySaverOn ||
        curr <= 0.5 ||
        (dur > 0 && curr >= dur - 0.5) ||
        nowMs - lastUiTimeUpdateMsRef.current >= 950
      ) {
        lastUiTimeUpdateMsRef.current = nowMs;
        setCurrentTime(curr);
        if (dur > 0 && effectiveDur !== duration) {
          setDuration(effectiveDur);
        }
        updatePinnedPlayerPosition(curr, effectiveDur);
      }

      if (lastTimeUpdatePosRef.current !== null) {
        const delta = curr - lastTimeUpdatePosRef.current;
        if (delta > 0 && delta <= 3) {
          actualListenedSecRef.current += delta;
        }
      }
      lastTimeUpdatePosRef.current = curr;
      sessionListenedSeconds.current = Math.floor(actualListenedSecRef.current);

      const trackDurForRule = effectiveDur > 0 ? effectiveDur : currentTrack?.durationSeconds || 0;
      const playThresholdSeconds =
        trackDurForRule > 0 ? Math.min(30, Math.max(1, Math.floor(trackDurForRule * 0.5))) : 30;

      if (
        isAuthenticatedListener &&
        sessionListenedSeconds.current >= playThresholdSeconds &&
        !hasStreamBeenValidated.current &&
        currentTrack
      ) {
        hasStreamBeenValidated.current = true;
        void recordValidatedPlay(currentTrack, sessionListenedSeconds.current, trackDurForRule);
      }

      if (dur > 0) {
        syncMediaSessionPositionState(curr, dur, playbackRate);
      }

      // Automatic early crossfade before EOF so Song A blends smoothly into Song B
      // even when the phone is locked and JS timers are throttled
      if (
        currentTrack &&
        dur > 10 &&
        curr > 3 &&
        crossfadeSecondsRef.current > 0 &&
        !sleepAtEndOfTrack &&
        repeatMode !== 'one' &&
        autoCrossfadedSessionRef.current !== playSessionIdRef.current
      ) {
        const wallRemaining = (dur - curr) / Math.max(0.5, playbackRate);
        const available = tracks.filter((t) => !t.isDraft && !t.isDeranked);
        let nextCandidate: Track | null = queue.find((t) => !t.isDraft && !t.isDeranked) || null;
        if (!nextCandidate && available.length > 0) {
          const curIdx = available.findIndex((t) => t.id === currentTrack.id);
          if (repeatMode === 'off' && curIdx >= 0 && curIdx === available.length - 1) {
            nextCandidate = null;
          } else if (isShufflingRef.current) {
            const others = available.length > 1 ? available.filter((t) => t.id !== currentTrack.id) : available;
            nextCandidate = others[0] || null;
          } else if (curIdx >= 0) {
            nextCandidate = available[(curIdx + 1) % available.length] || null;
          }
        }

        if (nextCandidate && nextCandidate.audioUrl && nextCandidate.id !== currentTrack.id) {
          const sameAlbum = Boolean(
            currentTrack.artistId === nextCandidate.artistId &&
              currentTrack.recordLabel &&
              nextCandidate.recordLabel &&
              currentTrack.recordLabel === nextCandidate.recordLabel
          );
          const effectiveCrossfade =
            sameAlbum && gaplessRef.current ? 0 : crossfadeSecondsRef.current;

          if (effectiveCrossfade > 0 && wallRemaining <= effectiveCrossfade && wallRemaining > 0.15) {
            autoCrossfadedSessionRef.current = playSessionIdRef.current;
            const clampedFade = Math.max(0.8, Math.min(effectiveCrossfade, wallRemaining - 0.1));
            advanceNextTrackRef.current(clampedFade);
          }
        }
      }
    };

    audioEngine.onEnded = () => {
      if (sleepAtEndOfTrack) {
        setSleepAtEndOfTrackState(false);
        setIsPlaying(false);
        pinPlayerSession({ isPlaying: false });
        return;
      }
      if (repeatMode === 'one') {
        seekTo(0);
        audioEngine.resume();
        return;
      }
      if (repeatMode === 'off' && queue.length === 0) {
        const available = tracks.filter((t) => !t.isDraft && !t.isDeranked);
        const curIdx = available.findIndex((t) => t.id === currentTrack?.id);
        if (curIdx >= 0 && curIdx === available.length - 1) {
          setIsPlaying(false);
          pinPlayerSession({ isPlaying: false, currentTime: 0 });
          return;
        }
      }
      playNextTrack();
    };

    audioEngine.onError = (message: string) => {
      setPlaybackError(message);
      setIsPlaying(false);
      pinPlayerSession({ isPlaying: false });
    };

    audioEngine.onExternalPlayState = (playing: boolean) => {
      setIsPlaying(playing);
      pinPlayerSession({
        isPlaying: playing,
        currentTime: mediaControlRef.current.currentTime,
      });
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
        } catch {}
      }
    };

    return () => {
      audioEngine.onTimeUpdate = null;
      audioEngine.onEnded = null;
      audioEngine.onError = null;
      audioEngine.onExternalPlayState = null;
    };
  }, [
    repeatMode,
    sleepAtEndOfTrack,
    currentTrack,
    duration,
    selectedCountry,
    playbackRate,
    queue,
    tracks,
    currentUser?.id,
    isAuthenticatedListener,
  ]);

  const logTrackToHistory = (trackToLog: Track, startSeconds: number = 0) => {
    const newEntry: PlayHistoryItem = {
      id: 'hist-' + Date.now(),
      trackId: trackToLog.id,
      track: trackToLog,
      playedAt: new Date().toISOString(),
      listenedDurationSeconds: Math.max(0, Math.floor(startSeconds)),
      completed: false,
    };

    setPlayHistory((prev) => {
      const filtered = prev.filter((item) => item.trackId !== trackToLog.id);
      return [newEntry, ...filtered].slice(0, 50);
    });
  };

  const playTrack = async (
    track: Track,
    options?: {
      crossfade?: boolean;
      crossfadeDurationOverride?: number;
      startAtSeconds?: number;
      expandFullscreen?: boolean;
    }
  ) => {
    // Allow anyone (including unauthenticated / guest visitors) to stream tracks immediately.
    // Real play counts remain gated until the listener signs up / logs in.

    if (currentTrack?.id === track.id && isPlaying && options?.startAtSeconds === undefined) {
      if (options?.expandFullscreen) setIsFullscreenPlayerOpen(true);
      return;
    }

    const mySessionId = ++playSessionIdRef.current;
    autoCrossfadedSessionRef.current = null;

    // Check Wi-Fi-only streaming setting if offline blob isn't cached
    const offlineBlobUrl = await getAudioBlobUrl(track.id);
    if (playSessionIdRef.current !== mySessionId) return;
    if (!offlineBlobUrl && userSettings.dataSaver.streamWifiOnly) {
      const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
      if (conn?.type && conn.type === 'cellular') {
        setPlaybackError('Stream on Wi-Fi only is turned on in Settings > Data & Storage.');
        return;
      }
    }

    audioEngine.init();
    setPlaybackError(null);

    const sameAlbum = Boolean(
      currentTrack &&
        currentTrack.id !== track.id &&
        currentTrack.artistId === track.artistId &&
        currentTrack.recordLabel &&
        track.recordLabel &&
        currentTrack.recordLabel === track.recordLabel
    );

    const isSwitchingActive = Boolean(isPlaying && currentTrack && currentTrack.id !== track.id);
    const activeFadeSeconds =
      typeof options?.crossfadeDurationOverride === 'number'
        ? Math.max(0, Math.min(12, options.crossfadeDurationOverride))
        : crossfadeSecondsRef.current;
    const fadeDuration =
      sameAlbum && userSettings.playback.gapless
        ? 0
        : options?.crossfade && activeFadeSeconds > 0
        ? activeFadeSeconds
        : isSwitchingActive
        ? activeFadeSeconds
        : 0;

    sessionListenedSeconds.current = 0;
    actualListenedSecRef.current = 0;
    lastTimeUpdatePosRef.current = options?.startAtSeconds ?? 0;
    hasStreamBeenValidated.current = false;

    const startPos = options?.startAtSeconds ?? 0;
    const resolvedDuration = track.metadata?.Duration ?? track.metadata?.duration ?? track.durationSeconds;
    setCurrentTrack(track);
    setDuration(resolvedDuration);
    setCurrentTime(startPos);
    setPendingResumeSeekSeconds(0);
    setHasPlayedInSession(true);
    setIsPlaying(true);
    if (options?.expandFullscreen) {
      setIsFullscreenPlayerOpen(true);
    }

    let nextQueueSnapshot = queue;
    if (queue.length === 0) {
      const available = tracks.filter((t) => !t.isDraft && !t.isDeranked && t.id !== track.id);
      const curIdx = tracks.findIndex((t) => t.id === track.id);
      if (curIdx >= 0) {
        const after = tracks.slice(curIdx + 1).filter((t) => !t.isDraft && !t.isDeranked);
        const before = tracks.slice(0, curIdx).filter((t) => !t.isDraft && !t.isDeranked);
        nextQueueSnapshot = [...after, ...before];
      } else {
        nextQueueSnapshot = available;
      }
      setQueue(nextQueueSnapshot);
    }

    pinPlayerSession({
      pinned: true,
      track,
      currentTime: startPos,
      duration: resolvedDuration,
      isPlaying: true,
      volume,
      isMuted,
      repeatMode,
      isShuffling,
      playbackRate,
      queue: nextQueueSnapshot,
    });
    syncMediaSessionPositionState(startPos, resolvedDuration, playbackRate);

    const resolvedAudioUrl = offlineBlobUrl || track.audioUrl;

    if (!resolvedAudioUrl) {
      setIsPlaying(false);
      pinPlayerSession({ isPlaying: false });
      setPlaybackError('This track does not have an audio file uploaded yet.');
      return;
    }

    audioEngine.setPlaybackRate(playbackRate);
    audioEngine.playCustomAudio(resolvedAudioUrl, fadeDuration, startPos);
    logTrackToHistory(track, startPos);
  };

  const playTrackList = (items: Track[], startIndex: number = 0) => {
    const playable = items.filter((t) => !t.isDraft && !t.isDeranked);
    if (playable.length === 0) return;
    const safeIdx = Math.max(0, Math.min(playable.length - 1, startIndex));
    const head = playable[safeIdx];
    const upcoming = [...playable.slice(safeIdx + 1), ...playable.slice(0, safeIdx)];
    setQueue(upcoming);
    pinPlayerSession({ queue: upcoming });
    playTrack(head);
  };

  const clearActiveTrack = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setCurrentTrack(null);
    setHasPlayedInSession(false);
    setResumedFromStorage(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackError(null);
    setIsFullscreenPlayerOpen(false);
    clearPinnedPlayerSession();
    clearMediaSessionMetadata();
  };

  const isMiniPlayerVisible = Boolean(
    currentTrack && (isPlaying || hasPlayedInSession || resumedFromStorage)
  );
  const playbackState: PlaybackState = !isMiniPlayerVisible
    ? 'idle'
    : playbackError
    ? 'error'
    : isPlaying
    ? 'playing'
    : 'paused';

  const togglePlayPause = async () => {
    audioEngine.init();
    setPlaybackError(null);
    if (!currentTrack) {
      const firstPlayable = tracks.find((t) => !t.isDraft && !t.isDeranked && Boolean(t.audioUrl));
      if (firstPlayable) playTrack(firstPlayable);
      return;
    }

    if (isPlaying) {
      audioEngine.pause();
      setIsPlaying(false);
      pinPlayerSession({
        pinned: true,
        track: currentTrack,
        currentTime,
        duration,
        isPlaying: false,
      });
    } else {
      setHasPlayedInSession(true);
      if (!audioEngine.getIsActive()) {
        const offlineBlobUrl = await getAudioBlobUrl(currentTrack.id);
        const resolvedAudioUrl = offlineBlobUrl || currentTrack.audioUrl;

        if (!resolvedAudioUrl) {
          setIsPlaying(false);
          pinPlayerSession({ isPlaying: false });
          setPlaybackError('This track does not have an audio file available.');
          return;
        }

        const seekStart = pendingResumeSeekSeconds > 0 ? pendingResumeSeekSeconds : currentTime;
        setPendingResumeSeekSeconds(0);
        audioEngine.setPlaybackRate(playbackRate);
        audioEngine.playCustomAudio(resolvedAudioUrl, 0, seekStart);
        setIsPlaying(true);
        pinPlayerSession({
          pinned: true,
          track: currentTrack,
          currentTime: seekStart,
          duration,
          isPlaying: true,
        });
      } else {
        audioEngine.resume();
        setIsPlaying(true);
        pinPlayerSession({
          pinned: true,
          track: currentTrack,
          currentTime,
          duration,
          isPlaying: true,
        });
      }
    }
  };

  const retryPlayback = () => {
    if (currentTrack) {
      playTrack(currentTrack, { startAtSeconds: currentTime });
    }
  };

  const clearPlaybackError = () => setPlaybackError(null);

  const seekTo = (timeInSeconds: number) => {
    const clamped = Math.max(0, Math.min(duration || 0, timeInSeconds));
    if (clamped < Math.max(0, (duration || 0) - Math.max(2, crossfadeSecondsRef.current) - 1)) {
      autoCrossfadedSessionRef.current = null;
    }
    setCurrentTime(clamped);
    setPendingResumeSeekSeconds(0);
    audioEngine.seek(clamped);
    updatePinnedPlayerPosition(clamped, duration, true);
    syncMediaSessionPositionState(clamped, duration, playbackRate);
  };

  const setVolume = (val: number) => {
    const safeVal = Math.max(0, Math.min(1, val));
    setVolumeState(safeVal);
    audioEngine.setVolume(safeVal);
    if (safeVal > 0 && isMuted) {
      setIsMuted(false);
      audioEngine.setMute(false);
      pinPlayerSession({ volume: safeVal, isMuted: false });
    } else {
      pinPlayerSession({ volume: safeVal });
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioEngine.setMute(next);
    pinPlayerSession({ isMuted: next });
  };

  const cycleRepeatMode = () => {
    setRepeatMode((prev) => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      pinPlayerSession({ repeatMode: next });
      return next;
    });
  };

  const toggleLoop = cycleRepeatMode;
  const toggleShuffle = () => {
    setIsShuffling((prev) => {
      const next = !prev;
      pinPlayerSession({ isShuffling: next });
      return next;
    });
  };

  const advanceToNextTrack = (fadeOverrideSeconds?: number) => {
    const crossfadeOpt =
      typeof fadeOverrideSeconds === 'number'
        ? { crossfade: true, crossfadeDurationOverride: fadeOverrideSeconds }
        : { crossfade: true };
    const available = tracks.filter((t) => !t.isDraft && !t.isDeranked);
    if (queue.length > 0) {
      const next = queue[0];
      setQueue((prev) => prev.slice(1));
      playTrack(next, crossfadeOpt);
      return;
    }

    if (available.length === 0) return;

    if (isShuffling) {
      const others = available.length > 1 ? available.filter((t) => t.id !== currentTrack?.id) : available;
      const rand = others[Math.floor(Math.random() * others.length)];
      playTrack(rand, crossfadeOpt);
      return;
    }

    const currentIndex = available.findIndex((t) => t.id === currentTrack?.id);
    const nextIndex = (currentIndex + 1) % available.length;
    playTrack(available[nextIndex], crossfadeOpt);
  };
  advanceNextTrackRef.current = advanceToNextTrack;

  const playNextTrack = () => {
    advanceToNextTrack();
  };

  const playPrevTrack = () => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }
    const available = tracks.filter((t) => !t.isDraft && !t.isDeranked);
    if (available.length === 0) return;
    const currentIndex = available.findIndex((t) => t.id === currentTrack?.id);
    const prevIndex = (currentIndex - 1 + available.length) % available.length;
    playTrack(available[prevIndex], { crossfade: true });
  };

  const addToQueue = (track: Track) => {
    setQueue((prev) => {
      const next = [...prev.filter((t) => t.id !== track.id), track];
      pinPlayerSession({ queue: next });
      return next;
    });
  };

  const playNextInQueue = (track: Track) => {
    setQueue((prev) => {
      const next = [track, ...prev.filter((t) => t.id !== track.id)];
      pinPlayerSession({ queue: next });
      return next;
    });
  };

  const reorderQueue = (startIndex: number, endIndex: number) => {
    setQueue((prev) => {
      const result = Array.from(prev);
      if (startIndex < 0 || startIndex >= result.length || endIndex < 0 || endIndex >= result.length) {
        return prev;
      }
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      pinPlayerSession({ queue: result });
      return result;
    });
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      const next = prev.filter((_, i) => i !== index);
      pinPlayerSession({ queue: next });
      return next;
    });
  };

  const clearQueue = () => {
    setQueue([]);
    pinPlayerSession({ queue: [] });
  };

  const mediaControlRef = useRef({
    currentTime: 0,
    duration: 0,
    playbackRate: 1,
    isPlaying: false,
    togglePlayPause: () => {},
    playPrevTrack: () => {},
    playNextTrack: () => {},
    seekTo: (_pos: number) => {},
    clearActiveTrack: () => {},
  });

  mediaControlRef.current = {
    currentTime,
    duration,
    playbackRate,
    isPlaying,
    togglePlayPause,
    playPrevTrack,
    playNextTrack,
    seekTo,
    clearActiveTrack,
  };

  // Device / lockscreen Media Session metadata, position state & hardware controls
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!currentTrack) {
      clearMediaSessionMetadata();
      return;
    }

    let cancelled = false;
    const { artwork, trackCoverUrl, fallbackIcons } = buildMediaSessionArtwork(currentTrack.coverArt);
    const baseLabel = currentTrack.recordLabel?.trim() || currentTrack.genre?.trim();
    const albumLabel = baseLabel
      ? baseLabel.toLowerCase().includes('lowervibe')
        ? baseLabel
        : `${baseLabel} · LOWERVIBE`
      : 'LOWERVIBE Music';

    const applyMetadata = (chosenArtwork: MediaImage[]) => {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title || 'Untitled Track',
          artist: currentTrack.artistName || 'LOWERVIBE Artist',
          album: albumLabel,
          artwork: chosenArtwork,
        });
      } catch {}
    };

    applyMetadata(artwork);

    // Verify remote track artwork resolves; fall back to PNG LOWERVIBE icons if broken
    if (trackCoverUrl && !trackCoverUrl.startsWith('data:')) {
      const probe = new Image();
      probe.referrerPolicy = 'no-referrer';
      probe.onerror = () => {
        if (!cancelled) {
          applyMetadata(fallbackIcons);
        }
      };
      probe.src = trackCoverUrl;
    }

    syncMediaSessionPositionState(
      mediaControlRef.current.currentTime,
      duration || currentTrack.durationSeconds || 0,
      mediaControlRef.current.playbackRate
    );

    const registerHandler = <T extends MediaSessionAction>(
      action: T,
      handler: MediaSessionActionHandler
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {}
    };

    registerHandler('play', () => {
      if (!audioEngine.getIsCustomAudio()) {
        mediaControlRef.current.togglePlayPause();
      } else {
        audioEngine.resume();
        setIsPlaying(true);
        pinPlayerSession({ isPlaying: true });
      }
      try {
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    });

    registerHandler('pause', () => {
      audioEngine.pause();
      setIsPlaying(false);
      pinPlayerSession({
        isPlaying: false,
        currentTime: mediaControlRef.current.currentTime,
      });
      try {
        navigator.mediaSession.playbackState = 'paused';
      } catch {}
    });

    registerHandler('previoustrack', () => {
      mediaControlRef.current.playPrevTrack();
    });

    registerHandler('nexttrack', () => {
      mediaControlRef.current.playNextTrack();
    });

    registerHandler('seekbackward', (details) => {
      const { currentTime: t, duration: d, playbackRate: r } = mediaControlRef.current;
      const target = Math.max(0, t - (details?.seekOffset || 10));
      mediaControlRef.current.seekTo(target);
      syncMediaSessionPositionState(target, d, r);
    });

    registerHandler('seekforward', (details) => {
      const { currentTime: t, duration: d, playbackRate: r } = mediaControlRef.current;
      const target = Math.min(d || 0, t + (details?.seekOffset || 10));
      mediaControlRef.current.seekTo(target);
      syncMediaSessionPositionState(target, d, r);
    });

    registerHandler('seekto', (details) => {
      if (details?.seekTime !== undefined) {
        const { duration: d, playbackRate: r } = mediaControlRef.current;
        mediaControlRef.current.seekTo(details.seekTime);
        syncMediaSessionPositionState(details.seekTime, d, r);
      }
    });

    registerHandler('stop', () => {
      mediaControlRef.current.clearActiveTrack();
    });

    return () => {
      cancelled = true;
    };
  }, [
    currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artistName,
    currentTrack?.coverArt,
    currentTrack?.recordLabel,
    currentTrack?.genre,
    currentTrack?.durationSeconds,
    duration,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return;
    const syncState = () => {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch {}
      syncMediaSessionPositionState(
        mediaControlRef.current.currentTime,
        mediaControlRef.current.duration || currentTrack.durationSeconds || 0,
        mediaControlRef.current.playbackRate
      );
    };

    syncState();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentTrack?.id, currentTrack?.durationSeconds, isPlaying]);

  // Synchronize 1-person-per-like optimistic counts
  const prevLikedIds = useRef<string[]>(currentUser?.likedTrackIds || []);
  useEffect(() => {
    const prev = prevLikedIds.current;
    const curr = currentUser?.likedTrackIds || [];
    prevLikedIds.current = curr;

    if (!currentUser) return;
    const added = curr.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !curr.includes(id));

    if (added.length > 0 || removed.length > 0) {
      const applyUserLikeDelta = (t: Track): Track => {
        const baseSet = new Set(Array.isArray(t.likedByUserIds) ? t.likedByUserIds.filter(Boolean) : []);
        if (added.includes(t.id)) {
          baseSet.add(currentUser.id);
          const nextIds = Array.from(baseSet);
          return { ...t, likedByUserIds: nextIds, likes: nextIds.length };
        }
        if (removed.includes(t.id)) {
          baseSet.delete(currentUser.id);
          const nextIds = Array.from(baseSet);
          return { ...t, likedByUserIds: nextIds, likes: nextIds.length };
        }
        return t;
      };

      setTracks((all) => all.map(applyUserLikeDelta));
      setCurrentTrack((t) => (t ? applyUserLikeDelta(t) : null));
      setActiveDetailTrack((t) => (t ? applyUserLikeDelta(t) : null));
    }
  }, [currentUser?.likedTrackIds, currentUser?.id]);

  const prevLikedArtistIds = useRef<string[]>(currentUser?.likedArtistIds || []);
  useEffect(() => {
    const prev = prevLikedArtistIds.current;
    const curr = currentUser?.likedArtistIds || [];
    prevLikedArtistIds.current = curr;

    if (!currentUser) return;
    const added = curr.filter((id) => !prev.includes(id));
    const removed = prev.filter((id) => !curr.includes(id));

    if (added.length > 0 || removed.length > 0) {
      setArtists((all) =>
        all.map((a) => {
          const baseSet = new Set(Array.isArray(a.likedByUserIds) ? a.likedByUserIds.filter(Boolean) : []);
          if (added.includes(a.id)) {
            baseSet.add(currentUser.id);
            const nextIds = Array.from(baseSet);
            return { ...a, likedByUserIds: nextIds, likesCount: nextIds.length };
          }
          if (removed.includes(a.id)) {
            baseSet.delete(currentUser.id);
            const nextIds = Array.from(baseSet);
            return { ...a, likedByUserIds: nextIds, likesCount: nextIds.length };
          }
          return a;
        })
      );
    }
  }, [currentUser?.likedArtistIds, currentUser?.id]);

  const saveTrackInFlightRef = useRef<Set<string>>(new Set());
  const toggleSaveTrack = (trackId: string) => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      requireAuth(() => toggleSaveTrack(trackId), 'Sign in to save songs to your library');
      return;
    }
    if (saveTrackInFlightRef.current.has(trackId)) return;

    const prevIds = savedTrackIds;
    const exists = prevIds.includes(trackId);
    const next = exists ? prevIds.filter((id) => id !== trackId) : Array.from(new Set([...prevIds, trackId]));

    // Optimistic state + local storage + user profile update
    setSavedTrackIds(next);
    updateCurrentUser({ savedTrackIds: next });
    try {
      localStorage.setItem('lowervibe_saved_tracks', JSON.stringify(next));
    } catch {}

    saveTrackInFlightRef.current.add(trackId);
    void updateDoc(doc(db, 'users', currentUser.id), {
      savedTrackIds: next,
      updatedAt: new Date().toISOString(),
    })
      .catch((err) => {
        console.warn('toggleSaveTrack failed, rolling back:', formatFirebaseError(err, 'Save failed'));
        setSavedTrackIds(prevIds);
        updateCurrentUser({ savedTrackIds: prevIds });
        try {
          localStorage.setItem('lowervibe_saved_tracks', JSON.stringify(prevIds));
        } catch {}
        showToast('Could not save to library. Changes reverted.', 'error');
      })
      .finally(() => {
        saveTrackInFlightRef.current.delete(trackId);
      });
  };

  const addReaction = (trackId: string, emoji: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const reactions = { ...(t.reactions || {}) };
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          void durableUpdateDoc('tracks', trackId, { reactions });
          return { ...t, reactions };
        }
        return t;
      })
    );
    setCurrentTrack((prev) => {
      if (prev && prev.id === trackId) {
        const reactions = { ...(prev.reactions || {}) };
        reactions[emoji] = (reactions[emoji] || 0) + 1;
        return { ...prev, reactions };
      }
      return prev;
    });
  };

  const addEvent = (evt: Omit<ArtistEvent, 'id'>): ArtistEvent => {
    const newEvent: ArtistEvent = { ...evt, id: `evt-${Date.now()}` };
    setEvents((prev) => [newEvent, ...prev]);
    return newEvent;
  };

  const submitClaim = (claim: Omit<ArtistClaim, 'id' | 'status' | 'submittedAt'>): ArtistClaim => ({
    ...claim,
    id: `claim-${Date.now()}`,
    status: 'pending',
    submittedAt: new Date().toISOString(),
  });
  const approveClaim = () => {};
  const rejectClaim = () => {};

  const setFeaturedVibeTrack = (trackId: string, curatorNote: string, quote: string) => {
    const updated: FeaturedVibe = {
      trackId,
      date: new Date().toISOString().split('T')[0],
      curatorName: currentUser?.name || currentUser?.email || 'Curator',
      curatorRole: 'Featured',
      curatorNote,
      quoteSnippet: quote,
    };
    setFeaturedVibe(updated);
    addAuditLog('SET_FEATURED_VIBE', 'track', trackId, `Set featured track: "${quote}"`);
  };

  const toggleDerankTrack = (trackId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const next = !t.isDeranked;
          addAuditLog(next ? 'DERANK_TRACK' : 'FEATURE_TRACK', 'track', trackId, `${next ? 'Hidden' : 'Restored'} ${t.title}`);
          void durableUpdateDoc('tracks', trackId, { isDeranked: next });
          return { ...t, isDeranked: next };
        }
        return t;
      })
    );
  };

  const isUserOwnerOfArtist = (artistId?: string): boolean => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id || !artistId) return false;
    const target = artists.find((a) => a.id === artistId);
    if (!target) return false;
    if (target.ownerId) {
      return target.ownerId === currentUser.id;
    }
    if (target.ownerUserId || target.claimedByUserId) {
      return target.ownerUserId === currentUser.id || target.claimedByUserId === currentUser.id;
    }
    return currentUser.artistId === artistId;
  };

  const isUserOwnerOfTrack = (track: Track): boolean => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) return false;
    if (track.uploadedByUserId) return track.uploadedByUserId === currentUser.id;
    return isUserOwnerOfArtist(track.artistId);
  };

  const toggleDraftTrack = async (trackId: string): Promise<{ success: boolean; error?: string }> => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) return { success: false, error: 'Track not found.' };
    if (!isUserOwnerOfTrack(target)) {
      return { success: false, error: 'Permission denied: only the track owner can publish or unpublish this song.' };
    }
    const previousDraft = Boolean(target.isDraft);
    const nextDraft = !previousDraft;
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isDraft: nextDraft } : t)));
    try {
      await updateDoc(doc(db, 'tracks', trackId), {
        isDraft: nextDraft,
        updatedAt: new Date().toISOString(),
      });
      if (previousDraft && !nextDraft) {
        const notifId = `notif-release-${target.id}-${Date.now()}`;
        setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: 'all',
          type: 'new_release',
          title: `New release: ${target.title}`,
          message: `${target.artistName} just published "${target.title}" on LOWERVIBE.`,
          readBy: currentUser?.id ? [currentUser.id] : [],
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.email || target.artistName,
          actionRoute: `/tracks/${target.id}`,
        }).catch(() => {});
      }
      return { success: true };
    } catch (err) {
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isDraft: previousDraft } : t)));
      return { success: false, error: formatFirebaseError(err, 'Could not update publish status') };
    }
  };

  const scheduleRelease = (trackId: string, scheduledDate: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target || !isUserOwnerOfTrack(target)) {
      console.warn('Blocked unauthorized release schedule update.');
      return;
    }
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          void durableUpdateDoc('tracks', trackId, {
            scheduledPublishDate: scheduledDate,
            isDraft: true,
          });
          return { ...t, scheduledPublishDate: scheduledDate, isDraft: true };
        }
        return t;
      })
    );
    addAuditLog('SCHEDULE_RELEASE', 'track', trackId, `Scheduled release for ${scheduledDate}`);
  };

  const addAuditLog = (action: string, targetType: AuditLogEntry['targetType'], targetId: string, details: string) => {
    const log: AuditLogEntry = {
      id: `log-${Date.now()}`,
      adminEmail: currentUser?.email || PRIMARY_ADMIN_EMAIL,
      action,
      targetType,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [log, ...prev].slice(0, 100));
    void durableSetDoc('audit_logs', log.id, log as unknown as Record<string, unknown>, {
      mirrorBackup: true,
    });
  };

  const downloadTrack = async (track: Track) => {
    if (track.downloadable === false || !track.audioUrl) {
      setPlaybackError('Offline saving is not enabled for this release.');
      return;
    }
    if (!currentUser) {
      requireAuth(() => downloadTrack(track), `Sign in to save "${track.title}" offline`);
      return;
    }

    if (userSettings.dataSaver.downloadWifiOnly) {
      const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
      if (conn?.type && conn.type === 'cellular') {
        setPlaybackError('Download on Wi-Fi only is enabled in Settings > Data & Storage.');
        return;
      }
    }

    setActiveDownload({
      trackId: track.id,
      trackTitle: track.title,
      artistName: track.artistName,
      progress: 20,
      isComplete: false,
    });

    try {
      if (track.audioUrl) {
        const res = await fetch(track.audioUrl);
        if (res.ok) {
          const blob = await res.blob();
          setActiveDownload((prev) => (prev ? { ...prev, progress: 80 } : prev));
          await saveAudioBlob(track.id, blob);
          await saveOfflineTrackSnapshot(track);
          void fetchTrackLyrics(track).catch(() => {});
        }
      }
      const nextDownloads = (track.downloads || 0) + 1;
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, downloads: nextDownloads } : t)));
      void durableUpdateDoc('tracks', track.id, {}, { increments: { downloads: 1 } });

      setActiveDownload((prev) => (prev ? { ...prev, progress: 100, isComplete: true } : prev));
      window.setTimeout(() => setActiveDownload(null), 2600);
    } catch {
      setActiveDownload(null);
      setPlaybackError('Could not save this song offline. Try again on a stronger connection.');
    }
  };

  const downloadTrackBatch = async (
    tracksToSync: Track[],
    label: string,
    batchId: string = `batch-${Date.now()}`
  ): Promise<{ saved: number; skipped: number; failed: number; blockedReason?: string }> => {
    if (!currentUser) {
      requireAuth(
        () => {
          void downloadTrackBatch(tracksToSync, label, batchId);
        },
        `Sign in to save "${label}" offline`
      );
      return { saved: 0, skipped: 0, failed: 0, blockedReason: 'auth' };
    }

    if (userSettings.dataSaver.downloadWifiOnly) {
      const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
      if (conn?.type && conn.type === 'cellular') {
        setPlaybackError('Download on Wi-Fi only is enabled in Settings > Data & Storage.');
        return { saved: 0, skipped: 0, failed: 0, blockedReason: 'wifi_only' };
      }
    }

    const uniqueEligible = dedupeTracksById(
      tracksToSync.filter((t) => Boolean(t?.id) && t.downloadable !== false && Boolean(t.audioUrl))
    );
    if (uniqueEligible.length === 0) {
      setPlaybackError(`No downloadable audio tracks available in "${label}".`);
      return { saved: 0, skipped: 0, failed: 0, blockedReason: 'none_downloadable' };
    }

    const cacheChecks = await Promise.all(
      uniqueEligible.map(async (t) => ({
        track: t,
        cached: await isTrackCachedOffline(t.id),
      }))
    );

    const alreadySavedCount = cacheChecks.filter((c) => c.cached).length;
    const pendingTracks = cacheChecks.filter((c) => !c.cached).map((c) => c.track);
    const total = uniqueEligible.length;

    if (pendingTracks.length === 0) {
      setActiveBatchDownload({
        id: batchId,
        label,
        completed: total,
        total,
        skippedAlreadySaved: alreadySavedCount,
        failed: 0,
        currentTrackTitle: uniqueEligible[uniqueEligible.length - 1].title,
        isComplete: true,
      });
      window.setTimeout(() => {
        setActiveBatchDownload((prev) => (prev?.id === batchId ? null : prev));
      }, 2800);
      return { saved: 0, skipped: alreadySavedCount, failed: 0 };
    }

    let completedCount = alreadySavedCount;
    let savedCount = 0;
    let failedCount = 0;

    setActiveBatchDownload({
      id: batchId,
      label,
      completed: completedCount,
      total,
      skippedAlreadySaved: alreadySavedCount,
      failed: 0,
      currentTrackTitle: pendingTracks[0].title,
      isComplete: false,
    });

    let cursor = 0;
    const workerCount = Math.min(2, pendingTracks.length);

    const runWorker = async () => {
      while (cursor < pendingTracks.length) {
        const idx = cursor++;
        const track = pendingTracks[idx];
        if (!track) break;

        setActiveBatchDownload((prev) =>
          prev && prev.id === batchId
            ? { ...prev, currentTrackTitle: track.title }
            : prev
        );

        try {
          const res = await fetch(track.audioUrl!);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const blob = await res.blob();
          await saveAudioBlob(track.id, blob);
          await saveOfflineTrackSnapshot(track);
          void fetchTrackLyrics(track).catch(() => {});
          savedCount += 1;
          setTracks((prev) =>
            prev.map((t) =>
              t.id === track.id ? { ...t, downloads: (t.downloads || 0) + 1 } : t
            )
          );
          void durableUpdateDoc('tracks', track.id, {}, { increments: { downloads: 1 } });
        } catch {
          failedCount += 1;
        } finally {
          completedCount += 1;
          setActiveBatchDownload((prev) =>
            prev && prev.id === batchId
              ? {
                  ...prev,
                  completed: completedCount,
                  failed: failedCount,
                }
              : prev
          );
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    setActiveBatchDownload((prev) =>
      prev && prev.id === batchId
        ? {
            ...prev,
            completed: total,
            failed: failedCount,
            isComplete: true,
          }
        : prev
    );
    window.setTimeout(() => {
      setActiveBatchDownload((prev) => (prev?.id === batchId ? null : prev));
    }, 3200);

    return { saved: savedCount, skipped: alreadySavedCount, failed: failedCount };
  };

  const downloadPlaylistOffline = async (playlist: Playlist) => {
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const playlistTracks = (playlist.trackIds || [])
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    return downloadTrackBatch(
      playlistTracks,
      playlist.name || 'Playlist',
      `playlist-${playlist.id}`
    );
  };

  const downloadArtistCatalogOffline = async (artist: Artist, artistTracks: Track[]) => {
    return downloadTrackBatch(
      artistTracks,
      `${artist.name} releases`,
      `artist-${artist.id}`
    );
  };

  const removeTracksOfflineBatch = async (trackIds: string[]): Promise<number> => {
    const uniqueIds = Array.from(new Set(trackIds.filter((id) => typeof id === 'string' && id)));
    let removed = 0;
    for (const id of uniqueIds) {
      const isCached = await isTrackCachedOffline(id);
      if (isCached) {
        await removeTrackOfflineCache(id);
        removed += 1;
      }
    }
    return removed;
  };

  const buildNewTrackRecord = (
    trackData: Omit<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'> &
      Partial<Pick<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'>>
  ): Track => ({
    ...trackData,
    uploadedByUserId: trackData.uploadedByUserId || currentUser?.id,
    artistName: cleanArtistDisplayName(trackData.artistName),
    id: trackData.id || `track-${Date.now()}`,
    plays: trackData.plays ?? 0,
    likes: trackData.likes ?? 0,
    reposts: trackData.reposts ?? 0,
    downloads: trackData.downloads ?? 0,
    releaseDate: trackData.releaseDate || new Date().toISOString().split('T')[0],
    comments: trackData.comments || [],
  });

  const addNewTrack = (
    trackData: Omit<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'> &
      Partial<Pick<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'>>
  ): Track => {
    const newTrack = buildNewTrackRecord(trackData);
    setTracks((prev) => dedupeTracksById([newTrack, ...prev]));
    addAuditLog('UPLOAD_TRACK', 'track', newTrack.id, `Uploaded ${newTrack.title} by ${newTrack.artistName}`);
    setDoc(doc(db, 'tracks', newTrack.id), newTrack, { merge: true }).catch((err) => {
      console.error('Track save error:', formatFirebaseError(err));
    });
    return newTrack;
  };

  const saveNewTrack = async (
    trackData: Omit<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'> &
      Partial<Pick<Track, 'id' | 'plays' | 'likes' | 'reposts' | 'releaseDate' | 'comments'>>
  ): Promise<Track> => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      throw new Error('Authentication required: sign in to publish tracks.');
    }
    const newTrack = buildNewTrackRecord({
      ...trackData,
      uploadedByUserId: currentUser.id,
    });
    try {
      await setDoc(doc(db, 'tracks', newTrack.id), newTrack, { merge: true });
      setTracks((prev) => dedupeTracksById([newTrack, ...prev]));
      addAuditLog('UPLOAD_TRACK', 'track', newTrack.id, `Uploaded ${newTrack.title} by ${newTrack.artistName}`);
      if (!newTrack.isDraft) {
        const notifId = `notif-release-${newTrack.id}-${Date.now()}`;
        setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: 'all',
          type: 'new_release',
          title: `New release: ${newTrack.title}`,
          message: `${newTrack.artistName} just released "${newTrack.title}" on LOWERVIBE.`,
          readBy: currentUser?.id ? [currentUser.id] : [],
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.email || newTrack.artistName,
          actionRoute: `/tracks/${newTrack.id}`,
        }).catch(() => {});
      }
      return newTrack;
    } catch (err) {
      throw new Error(formatFirebaseError(err, 'Could not save track'));
    }
  };

  const addNewArtist = (
    artistData: Omit<Artist, 'id' | 'followersCount' | 'monthlyListeners' | 'joinedDate' | 'verified'>
  ): Artist => {
    const ownerUid = artistData.ownerId || artistData.ownerUserId || currentUser?.id;
    const newArtist: Artist = {
      ...artistData,
      ownerId: ownerUid,
      ownerUserId: ownerUid,
      claimedByUserId: artistData.claimedByUserId || ownerUid,
      name: cleanArtistDisplayName(artistData.name),
      id: `artist-${Date.now()}`,
      followersCount: 0,
      monthlyListeners: 0,
      joinedDate: new Date().toISOString(),
      verified: false,
    };
    setArtists((prev) => [newArtist, ...prev]);
    setDoc(doc(db, 'artists', newArtist.id), newArtist).catch((err) => {
      console.error('Artist save error:', formatFirebaseError(err));
    });
    return newArtist;
  };

  const updateArtistProfile = async (
    artistId: string,
    updates: Partial<Artist>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isUserOwnerOfArtist(artistId)) {
      return {
        success: false,
        error: 'Permission denied: only the artist matching ownerId can edit this profile.',
      };
    }
    const previous = artists.find((a) => a.id === artistId);
    const {
      id: _ignoreId,
      ownerId: _ignoreOwnerId,
      ownerUserId: _ignoreOwner,
      claimedByUserId: _ignoreClaimed,
      verified: _ignoreVerified,
      isVerified: _ignoreIsVerified,
      isMonetized: _ignoreMonetized,
      monetizationStatus: _ignoreMonStatus,
      earningsBalanceMwk: _ignoreBalance,
      followersCount: _ignoreFollowers,
      monthlyListeners: _ignoreListeners,
      ...safeUpdates
    } = updates;
    const cleanUpdates = {
      ...(safeUpdates.name ? { ...safeUpdates, name: cleanArtistDisplayName(safeUpdates.name) } : safeUpdates),
      ...(previous && !previous.ownerId && currentUser ? { ownerId: currentUser.id } : {}),
      updatedAt: new Date().toISOString(),
    };
    setArtists((prev) => prev.map((a) => (a.id === artistId ? { ...a, ...cleanUpdates } : a)));
    try {
      await updateDoc(doc(db, 'artists', artistId), cleanUpdates);
      return { success: true };
    } catch (err) {
      if (previous) {
        setArtists((prev) => prev.map((a) => (a.id === artistId ? previous : a)));
      }
      return { success: false, error: formatFirebaseError(err, 'Could not update artist profile') };
    }
  };

  const updateTrack = async (trackId: string, updates: Partial<Track>) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target || !isUserOwnerOfTrack(target)) {
      throw new Error('Permission denied: only the track owner can edit this song.');
    }
    const {
      id: _ignoreId,
      uploadedByUserId: _ignoreUploader,
      artistId: _ignoreArtistId,
      plays: _ignorePlays,
      likes: _ignoreLikes,
      likedByUserIds: _ignoreLikedBy,
      isCertified: _ignoreCertified,
      chartRank: _ignoreChart,
      isDeranked: _ignoreDeranked,
      ...safeUpdates
    } = updates;
    const payload = { ...safeUpdates, updatedAt: new Date().toISOString() };

    try {
      await updateDoc(doc(db, 'tracks', trackId), payload);
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...payload } : t)));
      setCurrentTrack((prev) => (prev && prev.id === trackId ? { ...prev, ...payload } : prev));
      setActiveDetailTrack((prev) => (prev && prev.id === trackId ? { ...prev, ...payload } : prev));
      setQueue((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...payload } : t)));
      addAuditLog('UPDATE_METADATA', 'track', trackId, `Updated fields: ${Object.keys(safeUpdates).join(', ')}`);
    } catch (err) {
      throw new Error(formatFirebaseError(err, 'Could not save track updates'));
    }
  };

  const deleteTrack = async (trackId: string): Promise<{ success: boolean; error?: string }> => {
    const target = tracks.find((t) => t.id === trackId);
    const isAdminUser = isVerifiedAdminGoogleSession();
    if (target && !isUserOwnerOfTrack(target) && !isAdminUser) {
      return {
        success: false,
        error: 'Permission denied: only the track owner or platform admin can delete this song.',
      };
    }
    try {
      await deleteDoc(doc(db, 'tracks', trackId));
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      if (currentTrack?.id === trackId) clearActiveTrack();
      addAuditLog('DELETE_TRACK', 'track', trackId, `Deleted track ${trackId}`);
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not delete track') };
    }
  };

  const deleteArtistProfile = async (
    artistId: string
  ): Promise<{ success: boolean; deletedTracks: number; error?: string }> => {
    const targetArtist = artists.find((a) => a.id === artistId);
    const isAdminUser = isVerifiedAdminGoogleSession();
    const isOwnerUser = Boolean(
      currentUser &&
        targetArtist &&
        (targetArtist.ownerId === currentUser.id ||
          targetArtist.ownerUserId === currentUser.id ||
          targetArtist.claimedByUserId === currentUser.id)
    );

    if (!isAdminUser && !isOwnerUser) {
      return {
        success: false,
        deletedTracks: 0,
        error: 'Permission denied: only the platform administrator or artist owner can remove this artist.',
      };
    }

    try {
      const artistTracks = tracks.filter((t) => t.artistId === artistId);
      let deletedTracks = 0;

      for (const tr of artistTracks) {
        try {
          await deleteDoc(doc(db, 'tracks', tr.id));
          deletedTracks += 1;
        } catch {}
      }

      const artistEvents = events.filter((ev) => ev.artistId === artistId);
      for (const ev of artistEvents) {
        try {
          await deleteDoc(doc(db, 'events', ev.id));
        } catch {}
      }

      await deleteDoc(doc(db, 'artists', artistId));

      setArtists((prev) => prev.filter((a) => a.id !== artistId));
      setTracks((prev) => prev.filter((t) => t.artistId !== artistId));
      setEvents((prev) => prev.filter((e) => e.artistId !== artistId));
      setQueue((prev) => prev.filter((t) => t.artistId !== artistId));
      if (currentTrack?.artistId === artistId) {
        clearActiveTrack();
      }
      if (selectedArtistModal?.id === artistId) {
        setSelectedArtistModal(null);
      }

      addAuditLog(
        'DELETE_ARTIST',
        'artist',
        artistId,
        `Removed artist ${targetArtist?.name || artistId} and ${deletedTracks} track(s)`
      );
      return { success: true, deletedTracks };
    } catch (err) {
      return {
        success: false,
        deletedTracks: 0,
        error: formatFirebaseError(err, 'Could not remove artist'),
      };
    }
  };

  // Automatic one-time Firestore purge for removed demo artists (Don Toliver, Zeze Kingston, Emkay) when admin signs in
  const didPurgeNamedDemoArtistsRef = useRef(false);
  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!authReady || !currentUser || !fbUser || !isVerifiedAdminGoogleSession(fbUser)) {
      return;
    }
    if (didPurgeNamedDemoArtistsRef.current) return;
    didPurgeNamedDemoArtistsRef.current = true;

    void (async () => {
      try {
        const [artistsSnap, tracksSnap, eventsSnap] = await Promise.all([
          getDocs(collection(db, 'artists')),
          getDocs(collection(db, 'tracks')),
          getDocs(collection(db, 'events')),
        ]);

        const demoArtistIds = new Set<string>();
        const deletePromises: Array<Promise<void>> = [];

        for (const d of artistsSnap.docs) {
          const data = d.data() as Partial<Artist> & { slug?: string };
          if (isRemovedDemoArtistRecord({ ...data, id: d.id })) {
            demoArtistIds.add(d.id);
            deletePromises.push(deleteDoc(doc(db, 'artists', d.id)).catch(() => {}));
          }
        }

        for (const d of tracksSnap.docs) {
          const data = d.data() as Partial<Track>;
          if (isRemovedDemoTrackRecord({ ...data, id: d.id }, demoArtistIds)) {
            deletePromises.push(deleteDoc(doc(db, 'tracks', d.id)).catch(() => {}));
          }
        }

        for (const d of eventsSnap.docs) {
          const data = d.data() as Partial<ArtistEvent>;
          if (
            (data.artistId && demoArtistIds.has(data.artistId)) ||
            isRemovedDemoArtistValue(data.artistId) ||
            isRemovedDemoArtistValue(data.artistName)
          ) {
            deletePromises.push(deleteDoc(doc(db, 'events', d.id)).catch(() => {}));
          }
        }

        if (deletePromises.length > 0) {
          await Promise.allSettled(deletePromises);
        }
      } catch (err) {
        console.warn('Demo artist cleanup skipped:', err);
      }
    })();
  }, [authReady, currentUser?.id, currentUser?.email]);

  const setCertifiedStatus = (trackId: string, certified: boolean) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, isCertified: certified } : t)));
    void durableUpdateDoc('tracks', trackId, { isCertified: certified });
  };

  const setTrackChartRank = (trackId: string, rank?: number) => {
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, chartRank: rank } : t)));
    void durableUpdateDoc('tracks', trackId, { chartRank: rank || null });
  };

  const upsertGenre = async (
    name: string,
    options?: { description?: string; region?: string }
  ): Promise<FirestoreGenre> => {
    return await upsertCustomGenre(name, {
      ...options,
      createdBy: currentUser?.id || currentUser?.email || 'creator',
    });
  };

  const createPublicPlaylist = async (input: {
    name: string;
    description?: string;
    coverArt?: string;
    country?: string;
    genre?: string;
    trackIds?: string[];
    isPublic?: boolean;
  }): Promise<Playlist> => {
    const nowIso = new Date().toISOString();
    const resolvedCountry = input.country || selectedCountry || currentUser?.country || 'Malawi';
    const firstTrack = input.trackIds?.[0] ? tracks.find((t) => t.id === input.trackIds?.[0]) : undefined;
    const newPlaylist: Playlist = {
      id: `pl-${Date.now()}`,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      coverArt: input.coverArt || firstTrack?.coverArt || DEFAULT_ARTWORK_SVG,
      trackIds: input.trackIds || [],
      createdBy: currentUser?.id || 'community',
      creatorName: currentUser?.name || 'Listener',
      isPublic: input.isPublic ?? true,
      followers: 1,
      country: resolvedCountry,
      region: resolvedCountry,
      genre: input.genre?.trim() || firstTrack?.genre || 'Mixed',
      plays: 0,
      likes: 0,
      likedByUserIds: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setPlaylists((prev) => [newPlaylist, ...prev.filter((p) => p.id !== newPlaylist.id)]);
    if (currentUser) {
      updateCurrentUser({ playlists: [newPlaylist, ...(currentUser.playlists || [])] });
    }
    await durableSetDoc('playlists', newPlaylist.id, newPlaylist as unknown as Record<string, unknown>, {
      merge: true,
      mirrorBackup: true,
    });
    return newPlaylist;
  };

  const updatePublicPlaylist = async (playlistId: string, updates: Partial<Playlist>) => {
    const target = playlists.find((p) => p.id === playlistId) || currentUser?.playlists?.find((p) => p.id === playlistId);
    if (!currentUser || (target && target.createdBy !== currentUser.id)) {
      console.warn('Blocked unauthorized playlist edit attempt.');
      return;
    }
    const nextUpdates = { ...updates, updatedAt: new Date().toISOString() };
    setPlaylists((prev) => prev.map((p) => (p.id === playlistId ? { ...p, ...nextUpdates } : p)));
    updateCurrentUser({
      playlists: (currentUser.playlists || []).map((p) =>
        p.id === playlistId ? { ...p, ...nextUpdates } : p
      ),
    });
    await durableSetDoc('playlists', playlistId, nextUpdates as Record<string, unknown>, { merge: true });
  };

  const deletePublicPlaylist = async (playlistId: string) => {
    const target = playlists.find((p) => p.id === playlistId) || currentUser?.playlists?.find((p) => p.id === playlistId);
    const isAdminUser = isVerifiedAdminGoogleSession();
    if (!currentUser || (target && target.createdBy !== currentUser.id && !isAdminUser)) {
      console.warn('Blocked unauthorized playlist delete attempt.');
      return;
    }
    setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    updateCurrentUser({
      playlists: (currentUser.playlists || []).filter((p) => p.id !== playlistId),
    });
    await durableDeleteDoc('playlists', playlistId);
  };

  const reorderPlaylistTracks = async (playlistId: string, fromIndex: number, toIndex: number) => {
    const target =
      playlists.find((p) => p.id === playlistId) ||
      currentUser?.playlists?.find((p) => p.id === playlistId);
    if (!target) return;
    const list = [...target.trackIds];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    await updatePublicPlaylist(playlistId, { trackIds: list });
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    const target =
      playlists.find((p) => p.id === playlistId) ||
      currentUser?.playlists?.find((p) => p.id === playlistId);
    if (!target) return;
    await updatePublicPlaylist(playlistId, {
      trackIds: target.trackIds.filter((id) => id !== trackId),
    });
  };

  const playlistLikeInFlightRef = useRef<Set<string>>(new Set());

  const toggleLikePlaylist = (playlistId: string) => {
    if (!currentUser) {
      requireAuth(() => toggleLikePlaylist(playlistId), 'Sign in to like this playlist');
      return;
    }
    if (playlistLikeInFlightRef.current.has(playlistId)) return;

    const target = playlists.find((p) => p.id === playlistId);
    const existing = Array.isArray(target?.likedByUserIds) ? target.likedByUserIds : [];
    const alreadyLiked = existing.includes(currentUser.id);
    const optimisticIds = alreadyLiked
      ? existing.filter((id) => id !== currentUser.id)
      : Array.from(new Set([...existing, currentUser.id]));

    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId
          ? { ...p, likedByUserIds: optimisticIds, likes: optimisticIds.length }
          : p
      )
    );

    playlistLikeInFlightRef.current.add(playlistId);
    const plRef = doc(db, 'playlists', playlistId);
    runTransaction(db, async (tx) => {
      const snap = await tx.get(plRef);
      if (!snap.exists()) return;
      const data = snap.data() as { likedByUserIds?: string[] };
      const ids = Array.isArray(data.likedByUserIds) ? data.likedByUserIds.filter(Boolean) : [];
      const nextSet = new Set(ids);
      if (alreadyLiked) nextSet.delete(currentUser.id);
      else nextSet.add(currentUser.id);
      const nextLikedBy = Array.from(nextSet);
      tx.update(plRef, {
        likedByUserIds: nextLikedBy,
        likes: nextLikedBy.length,
      });
    })
      .catch(() => {})
      .finally(() => {
        playlistLikeInFlightRef.current.delete(playlistId);
      });
  };

  const recordPlaylistPlay = (playlistId: string) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, plays: (p.plays || 0) + 1 } : p))
    );
    void durableUpdateDoc('playlists', playlistId, {}, { increments: { plays: 1 } });
  };

  // Monetization & Payouts
  const updateMonetizationConfig = async (updates: Partial<MonetizationConfig>) => {
    const nextSocials = updates.socialLinks !== undefined
      ? sanitizePlatformSocialLinks(updates.socialLinks)
      : sanitizePlatformSocialLinks(monetizationConfig.socialLinks);
    const next: MonetizationConfig = {
      ...DEFAULT_MONETIZATION_CONFIG,
      ...monetizationConfig,
      ...updates,
      socialLinks: nextSocials,
      updatedAt: new Date().toISOString(),
    };
    setMonetizationConfig(next);
    await setDoc(doc(db, 'config', 'platform'), next);
    addAuditLog(
      'UPDATE_MONETIZATION_CONFIG',
      'system',
      'platform',
      updates.socialLinks !== undefined
        ? 'Updated platform settings and official social media links'
        : 'Updated monetization thresholds & rate'
    );
  };

  const isArtistEligibleForMonetization = (artist: Artist): boolean => {
    const artistTracks = tracks.filter(
      (t) =>
        !t.isDraft &&
        !t.isDeranked &&
        (t.artistId === artist.id ||
          (artist.ownerUserId && t.uploadedByUserId === artist.ownerUserId))
    );
    const artistPlays = artistTracks.reduce((sum, t) => sum + (t.plays || 0), 0);
    const activeStrikes = artist.copyrightStrikes || 0;
    const followers = artist.followersCount || 0;

    return (
      artistTracks.length >= monetizationConfig.requiredPublishedTracks &&
      artistPlays >= monetizationConfig.requiredPlays30d &&
      followers >= monetizationConfig.requiredFollowers &&
      activeStrikes <= monetizationConfig.maxActiveStrikes
    );
  };

  const approveArtistMonetization = (artistId: string, approverOverride?: string) => {
    const nowIso = new Date().toISOString();
    const approver = approverOverride || currentUser?.email || PRIMARY_ADMIN_EMAIL;
    const targetArtist = artists.find((a) => a.id === artistId);

    void (async () => {
      const tokenRes = await requestServerApprovalToken(artistId);
      const approvalToken = tokenRes.ok ? tokenRes.approvalToken : undefined;
      const tokenSignature = tokenRes.ok ? tokenRes.tokenSignature : undefined;

      setArtists((prev) =>
        prev.map((a) =>
          a.id === artistId
            ? {
                ...a,
                isMonetized: true,
                monetizationStatus: 'approved',
                monetizationApprovedAt: tokenRes.issuedAt || nowIso,
                monetizationApprovedBy: tokenRes.approvedBy || approver,
                ...(approvalToken ? { monetizationApprovalToken: approvalToken } : {}),
                ...(tokenSignature ? { monetizationTokenSignature: tokenSignature } : {}),
                monetizationRejectionReason: undefined,
                monetizationRevokedReason: undefined,
              }
            : a
        )
      );

      await durableSetDoc(
        'artists',
        artistId,
        {
          isMonetized: true,
          monetizationStatus: 'approved',
          monetizationApprovedAt: tokenRes.issuedAt || nowIso,
          monetizationApprovedBy: tokenRes.approvedBy || approver,
          ...(approvalToken ? { monetizationApprovalToken: approvalToken } : {}),
          ...(tokenSignature ? { monetizationTokenSignature: tokenSignature } : {}),
          monetizationRejectionReason: null,
          monetizationRevokedReason: null,
          updatedAt: nowIso,
        },
        { merge: true, mirrorBackup: true }
      );

      const recipientUid =
        targetArtist?.ownerUserId ||
        targetArtist?.claimedByUserId ||
        targetArtist?.contactEmail ||
        artistId;
      const notifId = `notif-mon-ok-${artistId}-${Date.now()}`;
      await durableSetDoc(
        'notifications',
        notifId,
        {
          id: notifId,
          userId: recipientUid,
          ...(targetArtist?.contactEmail ? { userEmail: targetArtist.contactEmail.toLowerCase() } : {}),
          type: 'artist_approved',
          title: 'Monetization approved',
          message: `Your Creator Studio monetization is now approved for ${
            targetArtist?.name || 'your profile'
          }${approvalToken ? ` (Token ${approvalToken})` : ''}. Add a payout method to receive withdrawals.`,
          readBy: [],
          createdAt: nowIso,
          createdBy: approver,
          actionRoute: '/artistcreator',
        },
        { mirrorBackup: true }
      );

      addAuditLog(
        'APPROVE_MONETIZATION',
        'monetization',
        artistId,
        `Approved monetization for ${artistId} (${approver})${approvalToken ? ` [${approvalToken}]` : ''}`
      );
    })();
  };

  const requestArtistMonetization = async (
    artistId: string,
    termsAccepted: boolean
  ): Promise<{ success: boolean; autoApproved?: boolean; error?: string }> => {
    if (!termsAccepted) {
      return { success: false, error: 'You must accept the Creator Monetization Terms first.' };
    }
    if (!isUserOwnerOfArtist(artistId)) {
      return {
        success: false,
        error: 'Permission denied: only the artist owner can request monetization for this profile.',
      };
    }
    const nowIso = new Date().toISOString();
    const targetArtist = artists.find((a) => a.id === artistId);
    const eligibleNow = targetArtist ? isArtistEligibleForMonetization(targetArtist) : false;

    if (targetArtist?.monetizationStatus === 'suspended') {
      return {
        success: false,
        error: targetArtist.monetizationRevokedReason || 'Monetization is currently paused.',
      };
    }

    try {
      if (eligibleNow) {
        const tokenRes = await requestServerApprovalToken(artistId);
        if (!tokenRes.ok || !tokenRes.approvalToken || !tokenRes.tokenSignature) {
          return {
            success: false,
            error: tokenRes.error || 'Server eligibility token check failed. Ensure your stats are synced and retry.',
          };
        }

        await updateDoc(doc(db, 'artists', artistId), {
          isMonetized: true,
          monetizationStatus: 'approved',
          monetizationTermsAcceptedAt: nowIso,
          monetizationRequestedAt: nowIso,
          monetizationApprovedAt: tokenRes.issuedAt || nowIso,
          monetizationApprovedBy: 'auto-eligibility',
          monetizationApprovalToken: tokenRes.approvalToken,
          monetizationTokenSignature: tokenRes.tokenSignature,
          monetizationRejectionReason: null,
          updatedAt: nowIso,
        });

        setArtists((prev) =>
          prev.map((a) =>
            a.id === artistId
              ? {
                  ...a,
                  isMonetized: true,
                  monetizationStatus: 'approved',
                  monetizationTermsAcceptedAt: nowIso,
                  monetizationRequestedAt: nowIso,
                  monetizationApprovedAt: tokenRes.issuedAt || nowIso,
                  monetizationApprovedBy: 'auto-eligibility',
                  monetizationApprovalToken: tokenRes.approvalToken,
                  monetizationTokenSignature: tokenRes.tokenSignature,
                  monetizationRejectionReason: undefined,
                }
              : a
          )
        );

        const notifId = `notif-mon-auto-${artistId}-${Date.now()}`;
        void durableSetDoc(
          'notifications',
          notifId,
          {
            id: notifId,
            userId: currentUser?.id || artistId,
            ...(currentUser?.email ? { userEmail: currentUser.email.toLowerCase() } : {}),
            type: 'artist_approved',
            title: 'Monetization automatically approved',
            message: `${targetArtist?.name || 'Your artist profile'} received verified approval token ${tokenRes.approvalToken}. Revenue & withdrawals are now active.`,
            readBy: [],
            createdAt: nowIso,
            createdBy: 'auto-eligibility',
            actionRoute: '/artistcreator',
          },
          { mirrorBackup: true }
        );

        addAuditLog(
          'AUTO_APPROVE_MONETIZATION',
          'monetization',
          artistId,
          `${targetArtist?.name || artistId} automatically approved with token ${tokenRes.approvalToken}`
        );
        return { success: true, autoApproved: true };
      }

      await durableUpdateDoc('artists', artistId, {
        monetizationStatus: 'pending',
        monetizationTermsAcceptedAt: nowIso,
        monetizationRequestedAt: nowIso,
        updatedAt: nowIso,
      }, { mirrorBackup: true });

      setArtists((prev) =>
        prev.map((a) =>
          a.id === artistId
            ? {
                ...a,
                isMonetized: false,
                monetizationStatus: 'pending',
                monetizationTermsAcceptedAt: nowIso,
                monetizationRequestedAt: nowIso,
                monetizationRejectionReason: undefined,
              }
            : a
        )
      );

      const notifId = `notif-mon-req-${artistId}-${Date.now()}`;
      void durableSetDoc('notifications', notifId, {
        id: notifId,
        userId: PRIMARY_ADMIN_EMAIL,
        userEmail: PRIMARY_ADMIN_EMAIL,
        type: 'system',
        title: 'Monetization review requested',
        message: `${targetArtist?.name || artistId} requested monetization review.`,
        readBy: [],
        createdAt: nowIso,
        createdBy: currentUser?.email || 'creator',
        actionRoute: '/administrationside',
      });

      addAuditLog('REQUEST_MONETIZATION', 'monetization', artistId, `${targetArtist?.name || artistId} requested monetization review`);
      return { success: true, autoApproved: false };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not submit monetization request') };
    }
  };

  // Automatically approve eligible artists with real server-issued approval tokens
  const autoApprovedArtistsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUser || !auth.currentUser || artists.length === 0) return;
    const isAdminSession = isVerifiedAdminGoogleSession(auth.currentUser);

    void flushPendingSyncOperations();

    artists.forEach((artist) => {
      if (autoApprovedArtistsRef.current.has(artist.id)) return;
      if (artist.monetizationStatus === 'approved' || artist.monetizationStatus === 'suspended') {
        return;
      }
      const canProcess = isAdminSession || isUserOwnerOfArtist(artist.id);
      if (!canProcess) return;
      if (!isArtistEligibleForMonetization(artist)) return;

      autoApprovedArtistsRef.current.add(artist.id);
      const nowIso = new Date().toISOString();
      const approver = isAdminSession ? PRIMARY_ADMIN_EMAIL : 'auto-eligibility';

      void (async () => {
        const tokenRes = await requestServerApprovalToken(artist.id);
        if (!tokenRes.ok || !tokenRes.approvalToken || !tokenRes.tokenSignature) {
          autoApprovedArtistsRef.current.delete(artist.id);
          return;
        }

        try {
          await updateDoc(doc(db, 'artists', artist.id), {
            isMonetized: true,
            monetizationStatus: 'approved',
            monetizationApprovedAt: tokenRes.issuedAt || nowIso,
            monetizationApprovedBy: approver,
            monetizationApprovalToken: tokenRes.approvalToken,
            monetizationTokenSignature: tokenRes.tokenSignature,
            monetizationRejectionReason: null,
            updatedAt: nowIso,
          });
          setArtists((prev) =>
            prev.map((a) =>
              a.id === artist.id
                ? {
                    ...a,
                    isMonetized: true,
                    monetizationStatus: 'approved',
                    monetizationApprovedAt: tokenRes.issuedAt || nowIso,
                    monetizationApprovedBy: approver,
                    monetizationApprovalToken: tokenRes.approvalToken,
                    monetizationTokenSignature: tokenRes.tokenSignature,
                    monetizationRejectionReason: undefined,
                  }
                : a
            )
          );
        } catch {
          autoApprovedArtistsRef.current.delete(artist.id);
        }
      })();
    });
  }, [artists, tracks, monetizationConfig, currentUser?.id, currentUser?.email]);

  const rejectArtistMonetization = async (artistId: string, reason: string) => {
    const nowIso = new Date().toISOString();
    const cooldownDays = monetizationConfig.reapplyCooldownDays || 14;
    const reapplyIso = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000).toISOString();
    const targetArtist = artists.find((a) => a.id === artistId);

    setArtists((prev) =>
      prev.map((a) =>
        a.id === artistId
          ? {
              ...a,
              isMonetized: false,
              monetizationStatus: 'rejected',
              monetizationRejectedAt: nowIso,
              monetizationRejectionReason: reason,
              monetizationReapplyAvailableAt: reapplyIso,
            }
          : a
      )
    );

    await durableSetDoc(
      'artists',
      artistId,
      {
        isMonetized: false,
        monetizationStatus: 'rejected',
        monetizationRejectedAt: nowIso,
        monetizationRejectionReason: reason,
        monetizationReapplyAvailableAt: reapplyIso,
      },
      { merge: true, mirrorBackup: true }
    );

    const recipientUid = targetArtist?.ownerUserId || targetArtist?.claimedByUserId || targetArtist?.contactEmail || artistId;
    const notifId = `notif-mon-rej-${artistId}-${Date.now()}`;
    void durableSetDoc('notifications', notifId, {
      id: notifId,
      userId: recipientUid,
      ...(targetArtist?.contactEmail ? { userEmail: targetArtist.contactEmail.toLowerCase() } : {}),
      type: 'artist_rejected',
      title: 'Monetization request not approved',
      message: `${reason}. You can re-apply after ${cooldownDays} days.`,
      readBy: [],
      createdAt: nowIso,
      createdBy: currentUser?.email || PRIMARY_ADMIN_EMAIL,
      actionRoute: '/artistcreator',
    });

    addAuditLog('REJECT_MONETIZATION', 'monetization', artistId, `Rejected monetization: ${reason}`);
  };

  const suspendArtistMonetization = async (artistId: string, reason: string) => {
    const nowIso = new Date().toISOString();
    const targetArtist = artists.find((a) => a.id === artistId);
    setArtists((prev) =>
      prev.map((a) =>
        a.id === artistId
          ? {
              ...a,
              isMonetized: false,
              monetizationStatus: 'suspended',
              monetizationRevokedReason: reason,
            }
          : a
      )
    );
    await durableSetDoc(
      'artists',
      artistId,
      {
        isMonetized: false,
        monetizationStatus: 'suspended',
        monetizationRevokedReason: reason,
      },
      { merge: true, mirrorBackup: true }
    );

    const recipientUid = targetArtist?.ownerUserId || targetArtist?.claimedByUserId || targetArtist?.contactEmail || artistId;
    const notifId = `notif-mon-susp-${artistId}-${Date.now()}`;
    void durableSetDoc('notifications', notifId, {
      id: notifId,
      userId: recipientUid,
      type: 'artist_rejected',
      title: 'Monetization suspended',
      message: reason,
      readBy: [],
      createdAt: nowIso,
      createdBy: currentUser?.email || PRIMARY_ADMIN_EMAIL,
      actionRoute: '/artistcreator',
    });
  };

  const revokeArtistMonetization = (artistId: string, reason?: string) => {
    suspendArtistMonetization(artistId, reason || 'Monetization paused pending review.');
  };

  const addPayoutMethod = async (input: {
    type: PayoutProviderType;
    identifier: string;
    accountHolderName: string;
    artistId?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Please sign in first.' };

    const cleanId = input.identifier.trim().replace(/\s+/g, '');
    const cleanName = input.accountHolderName.trim();
    if (cleanName.length < 2) {
      return { success: false, error: 'Enter the full account holder name.' };
    }

    let label = '';
    let masked = '';
    let network: 'TRC-20' | 'BEP-20' | undefined;

    if (input.type === 'airtel_money') {
      const normalized = cleanId.startsWith('+265')
        ? cleanId
        : cleanId.startsWith('265')
        ? `+${cleanId}`
        : cleanId.startsWith('0')
        ? `+265${cleanId.slice(1)}`
        : `+265${cleanId}`;
      if (!/^\+2659[89]\d{7}$/.test(normalized)) {
        return {
          success: false,
          error: 'Enter a valid Malawi Airtel Money number starting with +265 99 or +265 98.',
        };
      }
      label = 'Airtel Money (Malawi)';
      masked = `+265 •••• ${normalized.slice(-4)}`;
    } else if (input.type === 'tnm_mpamba') {
      const normalized = cleanId.startsWith('+265')
        ? cleanId
        : cleanId.startsWith('265')
        ? `+${cleanId}`
        : cleanId.startsWith('0')
        ? `+265${cleanId.slice(1)}`
        : `+265${cleanId}`;
      if (!/^\+2658[89]\d{7}$/.test(normalized)) {
        return {
          success: false,
          error: 'Enter a valid Malawi TNM Mpamba number starting with +265 88 or +265 89.',
        };
      }
      label = 'TNM Mpamba (Malawi)';
      masked = `+265 •••• ${normalized.slice(-4)}`;
    } else if (input.type === 'usdt_trc20') {
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(cleanId)) {
        return {
          success: false,
          error: 'Invalid TRON (TRC-20) USDT address. It must start with "T" and be 34 characters.',
        };
      }
      label = 'USDT (TRON / TRC-20)';
      masked = `${cleanId.slice(0, 5)} •••• ${cleanId.slice(-4)}`;
      network = 'TRC-20';
    } else if (input.type === 'usdt_bep20') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(cleanId)) {
        return {
          success: false,
          error: 'Invalid BNB Smart Chain (BEP-20) USDT address. It must start with "0x" and be 42 characters.',
        };
      }
      label = 'USDT (BNB Smart Chain / BEP-20)';
      masked = `${cleanId.slice(0, 6)} •••• ${cleanId.slice(-4)}`;
      network = 'BEP-20';
    }

    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return { success: false, error: 'Please sign in to manage your payout methods.' };
    }
    const targetArtistId = input.artistId || currentUser.artistId;
    if (targetArtistId && !isUserOwnerOfArtist(targetArtistId)) {
      return {
        success: false,
        error: 'Permission denied: only the artist owner can manage payout settings for this artist.',
      };
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const targetArtistObj = targetArtistId ? artists.find((a) => a.id === targetArtistId) : undefined;
    const isAutoAccepted = Boolean(
      targetArtistObj &&
        (targetArtistObj.monetizationStatus === 'approved' ||
          isArtistEligibleForMonetization(targetArtistObj))
    );
    const holdUntilIso = isAutoAccepted
      ? nowIso
      : new Date(now + 24 * 60 * 60 * 1000).toISOString();

    const method: PayoutMethod = {
      id: `pm-${now}`,
      userId: currentUser.id,
      ...(targetArtistId ? { artistId: targetArtistId } : {}),
      type: input.type,
      label,
      maskedIdentifier: masked,
      rawDestination: cleanId,
      accountHolderName: cleanName,
      ...(network ? { network } : {}),
      isDefault: payoutMethods.length === 0,
      status: isAutoAccepted ? 'accepted' : 'pending',
      ...(isAutoAccepted ? { acceptedAt: nowIso } : {}),
      addedAt: nowIso,
      payoutHoldUntil: holdUntilIso,
    };

    try {
      await setDoc(doc(db, 'payoutMethods', method.id), method);
      const notifId = `notif-pm-${now}`;
      void durableSetDoc('notifications', notifId, {
        id: notifId,
        userId: currentUser.id,
        userEmail: currentUser.email,
        type: 'system',
        title: isAutoAccepted ? 'Payout method accepted' : 'Payout method added',
        message: isAutoAccepted
          ? `${label} (${masked}) was automatically accepted in administration for your eligible account.`
          : `${label} (${masked}) was saved to your account.`,
        readBy: [],
        createdAt: nowIso,
        actionRoute: '/artistcreator',
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not save payout method') };
    }
  };

  const removePayoutMethod = async (methodId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return { success: false, error: 'Authentication required.' };
    }
    const existing = payoutMethods.find((m) => m.id === methodId);
    if (!existing || existing.userId !== currentUser.id) {
      return { success: false, error: 'Permission denied: only the account owner can remove this payout method.' };
    }
    try {
      await deleteDoc(doc(db, 'payoutMethods', methodId));
      setPayoutMethods((prev) => prev.filter((m) => m.id !== methodId));
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not remove payout method') };
    }
  };

  const setDefaultPayoutMethod = async (methodId: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return { success: false, error: 'Authentication required.' };
    }
    const owned = payoutMethods.filter((m) => m.userId === currentUser.id);
    if (!owned.some((m) => m.id === methodId)) {
      return { success: false, error: 'Permission denied: only the account owner can update payout settings.' };
    }
    try {
      await Promise.all(
        owned.map((m) => updateDoc(doc(db, 'payoutMethods', m.id), { isDefault: m.id === methodId }))
      );
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not update default payout method') };
    }
  };

  const submitPayoutRequest = async (input: {
    artistId: string;
    artistName: string;
    payoutMethodId: string;
    grossAmountMwk: number;
  }): Promise<{ success: boolean; error?: string; request?: PayoutRequest }> => {
    if (!currentUser || !auth.currentUser || auth.currentUser.uid !== currentUser.id) {
      return { success: false, error: 'Please sign in first.' };
    }
    if (!isUserOwnerOfArtist(input.artistId)) {
      return {
        success: false,
        error: 'Permission denied: only the artist owner can request withdrawals for this profile.',
      };
    }

    const method = payoutMethods.find((m) => m.id === input.payoutMethodId);
    if (!method || method.userId !== currentUser.id) {
      return { success: false, error: 'Select one of your verified payout methods.' };
    }

    if (new Date(method.payoutHoldUntil).getTime() > Date.now()) {
      const hoursLeft = Math.ceil((new Date(method.payoutHoldUntil).getTime() - Date.now()) / (1000 * 60 * 60));
      return {
        success: false,
        error: `New payout methods have a 24-hour security hold (${hoursLeft}h remaining).`,
      };
    }

    if (input.grossAmountMwk < monetizationConfig.minWithdrawalMwk) {
      return {
        success: false,
        error: `Minimum withdrawal is ${monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK.`,
      };
    }

    // Generate server-verified cryptographic payout settlement token from backend ledger
    const tokenRes = await requestServerPayoutToken({
      artistId: input.artistId,
      payoutMethodId: method.id,
      grossAmountMwk: input.grossAmountMwk,
    });

    if (!tokenRes.ok || !tokenRes.payoutToken || !tokenRes.tokenSignature) {
      return {
        success: false,
        error: tokenRes.error || 'Server could not verify your balance and issue a payout token.',
      };
    }

    const nowIso = tokenRes.issuedAt || new Date().toISOString();
    const feeMwk = tokenRes.feeMwk ?? Math.round((input.grossAmountMwk * (monetizationConfig.payoutFeePercent || 0)) / 100);
    const netAmountMwk = tokenRes.netAmountMwk ?? Math.max(0, input.grossAmountMwk - feeMwk);

    const reqObj: PayoutRequest = {
      id: tokenRes.requestId || `po-${Date.now()}`,
      artistId: input.artistId,
      artistName: input.artistName,
      userId: currentUser.id,
      userEmail: currentUser.email,
      payoutMethodId: method.id,
      payoutMethodLabel: method.label,
      payoutDestinationMasked: method.maskedIdentifier,
      grossAmountMwk: tokenRes.grossAmountMwk ?? Math.round(input.grossAmountMwk),
      feeMwk,
      netAmountMwk,
      status: tokenRes.status || (monetizationConfig.payoutProviderConfigured ? 'processing' : 'awaiting_review'),
      providerConfigured: Boolean(tokenRes.providerConfigured ?? monetizationConfig.payoutProviderConfigured),
      requestedAt: nowIso,
      txRef: tokenRes.txRef,
      payoutToken: tokenRes.payoutToken,
      payoutTokenSignature: tokenRes.tokenSignature,
      settlementVerified: true,
    };

    try {
      await durableSetDoc('payoutRequests', reqObj.id, reqObj as unknown as Record<string, unknown>, {
        mirrorBackup: true,
      });
      const notifId = `notif-po-req-${Date.now()}`;
      void durableSetDoc('notifications', notifId, {
        id: notifId,
        userId: PRIMARY_ADMIN_EMAIL,
        userEmail: PRIMARY_ADMIN_EMAIL,
        type: 'system',
        title: 'Verified withdrawal request',
        message: `${input.artistName} requested ${netAmountMwk.toLocaleString()} MWK via ${method.label} (Token ${tokenRes.payoutToken}).`,
        readBy: [],
        createdAt: nowIso,
        actionRoute: '/administrationside',
      });
      addAuditLog('GENERATE_PAYOUT_TOKEN', 'payout', reqObj.id, `Issued ${tokenRes.payoutToken} (${tokenRes.txRef}) for ${netAmountMwk} MWK`);
      return { success: true, request: reqObj };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Withdrawal request failed') };
    }
  };

  const updatePayoutRequestStatus = async (
    requestId: string,
    status: PayoutRequest['status'],
    failureReason?: string
  ) => {
    const existingReq = payoutRequests.find((r) => r.id === requestId);
    const prevStatus = existingReq?.status;
    const nowIso = new Date().toISOString();
    const updates: Partial<PayoutRequest> = {
      status,
      processedAt: nowIso,
      ...(failureReason ? { failureReason } : {}),
      ...(status === 'paid' ? { txRef: existingReq?.txRef || `TXN-LV-${Date.now().toString().slice(-8)}` } : {}),
    };
    await durableUpdateDoc('payoutRequests', requestId, updates as Record<string, unknown>, {
      mirrorBackup: true,
    });

    if (existingReq?.userId && prevStatus !== status) {
      const statusLabel = (s?: PayoutRequest['status']) => {
        switch (s) {
          case 'paid':
            return 'Paid';
          case 'processing':
            return 'Processing';
          case 'failed':
            return 'Failed';
          case 'awaiting_review':
            return 'Awaiting Review';
          default:
            return 'Pending';
        }
      };
      const titleMap: Record<PayoutRequest['status'], string> = {
        paid: 'Withdrawal Paid',
        processing: 'Withdrawal Processing',
        failed: 'Withdrawal Failed',
        awaiting_review: 'Withdrawal Under Review',
      };
      const notifId = `notif-payout-${requestId}-${status}-${Date.now()}`;
      const amountLabel = `${(existingReq.netAmountMwk || existingReq.grossAmountMwk || 0).toLocaleString()} MWK`;
      const tokenRef = existingReq.payoutToken ? ` (${existingReq.payoutToken})` : '';
      const transitionText = prevStatus
        ? `changed from ${statusLabel(prevStatus)} to ${statusLabel(status)}`
        : `is now ${statusLabel(status)}`;
      void durableSetDoc('notifications', notifId, {
        id: notifId,
        userId: existingReq.userId,
        type: 'withdrawal_status',
        title: titleMap[status] || 'Withdrawal Status Updated',
        message:
          status === 'failed' && failureReason
            ? `${amountLabel} payout${tokenRef} ${transitionText}: ${failureReason}`
            : `${amountLabel} payout${tokenRef} ${transitionText}.`,
        readBy: [],
        createdAt: nowIso,
        createdBy: currentUser?.email || PRIMARY_ADMIN_EMAIL,
        actionRoute: '/artistcreator?tab=withdrawals',
        payoutRequestId: requestId,
        payoutStatus: status,
      });
    }

    addAuditLog('UPDATE_PAYOUT_STATUS', 'payout', requestId, `Payout ${requestId} set to ${status}`);
  };

  const submitContentReportRecord = async (input: {
    type: ReportRecord['type'];
    trackId?: string;
    trackTitle?: string;
    commentId?: string;
    artistId?: string;
    artistName?: string;
    reason: string;
    details?: string;
    evidenceUrl?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const reportId = `rep-${Date.now()}`;
    const record: ReportRecord = {
      id: reportId,
      type: input.type || 'track_report',
      trackId: input.trackId || '',
      trackTitle: input.trackTitle || input.artistName || 'Platform Report',
      ...(input.commentId ? { commentId: input.commentId } : {}),
      ...(input.artistId ? { artistId: input.artistId } : {}),
      ...(input.artistName ? { artistName: input.artistName } : {}),
      reporterEmail: currentUser?.email || 'anonymous@lowervibe.mw',
      reporterName: currentUser?.name || 'User',
      reporterUserId: currentUser?.id,
      reason: input.reason,
      details: input.details,
      evidenceUrl: input.evidenceUrl,
      deviceInfo: {
        os: typeof navigator !== 'undefined' ? navigator.platform || 'Unknown' : 'Unknown',
        browser: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : 'Unknown',
        appVersion: '2.0.0',
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'reports', reportId), record);
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not submit report') };
    }
  };

  const submitSupportTicket = async (input: {
    subject: string;
    category: SupportTicket['category'];
    message: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Authentication required: sign in to contact support.' };
    }
    const ticket: SupportTicket = {
      id: `tkt-${Date.now()}`,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      subject: input.subject.trim(),
      category: input.category,
      message: input.message.trim(),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'tickets', ticket.id), ticket);
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not send support ticket') };
    }
  };

  const boostArtistFollowers = (artistId: string, amount: number = 1) => {
    setArtists((prev) =>
      prev.map((a) => {
        if (a.id === artistId) {
          const nextCount = Math.max(0, a.followersCount + amount);
          void durableUpdateDoc('artists', artistId, { followersCount: nextCount });
          return { ...a, followersCount: nextCount };
        }
        return a;
      })
    );
  };

  const clearHistory = () => {
    setPlayHistory([]);
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {}
  };

  const addCommentToTrack = (trackId: string, comment: Omit<TrackComment, 'id' | 'createdAt' | 'likes'>) => {
    const newComment: TrackComment = {
      ...comment,
      id: `comment-${Date.now()}`,
      createdAt: new Date().toISOString(),
      likes: 0,
    };
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const nextComments = [newComment, ...(t.comments || [])];
          void durableUpdateDoc('tracks', trackId, { comments: nextComments });
          return { ...t, comments: nextComments };
        }
        return t;
      })
    );
    setActiveDetailTrack((prev) =>
      prev && prev.id === trackId ? { ...prev, comments: [newComment, ...(prev.comments || [])] } : prev
    );
    setCurrentTrack((prev) =>
      prev && prev.id === trackId ? { ...prev, comments: [newComment, ...(prev.comments || [])] } : prev
    );
  };

  const likeComment = (trackId: string, commentId: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          const nextComments = (t.comments || []).map((c) =>
            c.id === commentId ? { ...c, likes: c.likes + 1 } : c
          );
          void durableUpdateDoc('tracks', trackId, { comments: nextComments });
          return { ...t, comments: nextComments };
        }
        return t;
      })
    );
  };

  const deleteTrackComment = async (
    trackId: string,
    commentId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const targetTrack = tracks.find((t) => t.id === trackId);
    if (!targetTrack) return { success: false, error: 'Track not found.' };
    const targetComment = (targetTrack.comments || []).find((c) => c.id === commentId);
    if (!targetComment) return { success: false, error: 'Comment not found.' };

    const isAdminUser = isVerifiedAdminGoogleSession();
    const isCommentAuthor = Boolean(currentUser && targetComment.userId === currentUser.id);
    const isTrackOwner = isUserOwnerOfTrack(targetTrack);
    if (!isAdminUser && !isCommentAuthor && !isTrackOwner) {
      return { success: false, error: 'Permission denied.' };
    }

    const nextComments = (targetTrack.comments || []).filter((c) => c.id !== commentId);
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, comments: nextComments } : t)));
    setCurrentTrack((prev) => (prev && prev.id === trackId ? { ...prev, comments: nextComments } : prev));
    setActiveDetailTrack((prev) => (prev && prev.id === trackId ? { ...prev, comments: nextComments } : prev));
    try {
      await updateDoc(doc(db, 'tracks', trackId), { comments: nextComments });
      if (isAdminUser) {
        addAuditLog('DELETE_COMMENT', 'track', trackId, `Removed comment ${commentId}`);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not remove comment') };
    }
  };

  const moderateTrackComment = async (
    trackId: string,
    commentId: string,
    hidden: boolean
  ): Promise<{ success: boolean; error?: string }> => {
    const targetTrack = tracks.find((t) => t.id === trackId);
    if (!targetTrack) return { success: false, error: 'Track not found.' };
    const isAdminUser = isVerifiedAdminGoogleSession();
    if (!isAdminUser && !isUserOwnerOfTrack(targetTrack)) {
      return { success: false, error: 'Permission denied.' };
    }

    const nextComments = (targetTrack.comments || []).map((c) =>
      c.id === commentId ? { ...c, hiddenByModeration: hidden } : c
    );
    setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, comments: nextComments } : t)));
    setCurrentTrack((prev) => (prev && prev.id === trackId ? { ...prev, comments: nextComments } : prev));
    setActiveDetailTrack((prev) => (prev && prev.id === trackId ? { ...prev, comments: nextComments } : prev));
    try {
      await updateDoc(doc(db, 'tracks', trackId), { comments: nextComments });
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not update comment visibility') };
    }
  };

  const setTrackModerationStatus = async (
    trackId: string,
    status: NonNullable<Track['moderationStatus']>,
    feedback?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isVerifiedAdminGoogleSession()) {
      return { success: false, error: 'Admin verification required.' };
    }
    const targetTrack = tracks.find((t) => t.id === trackId);
    if (!targetTrack) return { success: false, error: 'Track not found.' };

    const isRejected = status === 'rejected';
    const isPublished = status === 'approved' || status === 'published';
    const nowIso = new Date().toISOString();
    const updates: Partial<Track> = {
      moderationStatus: status,
      moderationFeedback: feedback?.trim() || undefined,
      isDeranked: isRejected ? true : isPublished ? false : targetTrack.isDeranked,
      isDraft: status === 'draft' ? true : isPublished ? false : targetTrack.isDraft,
      updatedAt: nowIso,
    };

    try {
      await updateDoc(doc(db, 'tracks', trackId), {
        moderationStatus: status,
        moderationFeedback: feedback?.trim() || null,
        isDeranked: updates.isDeranked ?? false,
        isDraft: updates.isDraft ?? false,
        updatedAt: nowIso,
      });
      setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, ...updates } : t)));
      addAuditLog('MODERATE_TRACK', 'track', trackId, `Set ${targetTrack.title} status to ${status}`);

      if (targetTrack.uploadedByUserId) {
        const notifId = `notif-mod-${trackId}-${Date.now()}`;
        const notifType = isRejected ? 'artist_rejected' : isPublished ? 'upload_completed' : 'system';
        void setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: targetTrack.uploadedByUserId,
          type: notifType,
          category: 'essential',
          title: isRejected
            ? `Release requires attention: ${targetTrack.title}`
            : isPublished
            ? `Release published: ${targetTrack.title}`
            : `Release status updated: ${targetTrack.title}`,
          message:
            feedback?.trim() ||
            (isRejected
              ? 'This upload was flagged during moderation review. Open Studio for details.'
              : isPublished
              ? 'Your release passed review and is live on LOWERVIBE.'
              : `Release status is now "${status.replace('_', ' ')}".`),
          readBy: [],
          createdAt: nowIso,
          createdBy: currentUser?.email || PRIMARY_ADMIN_EMAIL,
          actionRoute: '/artistcreator?tab=tracks',
        }).catch(() => {});
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: formatFirebaseError(err, 'Could not update moderation status') };
    }
  };

  const toggleVisualizer = () => setIsVisualizerActive((prev) => !prev);
  const setVisualizerStyle = (style: 'bars' | 'wave' | 'pulse') => setVisualizerStyleState(style);
  const setEqPreset = (preset: EqPreset) => {
    setEqPresetState(preset);
    audioEngine.setEqPreset(preset);
    if (preset === 'flat' || preset === 'bass_boost' || preset === 'vocal' || preset === 'treble') {
      updateUserSettings({ playback: { eqPreset: preset } });
    }
  };

  const openAnalyticsModal = (artist?: Artist | null) => {
    setAnalyticsArtist(artist || null);
    setIsAnalyticsModalOpen(true);
  };
  const closeAnalyticsModal = () => setIsAnalyticsModalOpen(false);
  const openAuthModal = (tab: 'login' | 'register' = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  };
  const closeAuthModal = () => setIsAuthModalOpen(false);
  const openPlaylistModal = (track: Track) => {
    setPlaylistModalTrack(track);
    setIsPlaylistModalOpen(true);
  };
  const closePlaylistModal = () => {
    setIsPlaylistModalOpen(false);
    setPlaylistModalTrack(null);
  };

  // Navigate to full-screen legal pages instead of cramped modal
  const openLegalModal = (type: 'terms' | 'privacy') => {
    navigate(type === 'terms' ? '/terms' : '/privacy');
  };
  const closeLegalModal = () => {
    setIsLegalModalOpen(false);
    setLegalModalType(null);
  };

  const dismissAllModals = () => {
    setActiveShareTrack(null);
    setActiveShareArtist(null);
    setActiveDetailTrack(null);
    setSelectedArtistModal(null);
    setIsArtistSubmitModalOpen(false);
    setIsAuthModalOpen(false);
    setIsPlaylistModalOpen(false);
    setPlaylistModalTrack(null);
    setIsAnalyticsModalOpen(false);
    setIsLegalModalOpen(false);
  };

  return (
    <AudioContext.Provider
      value={{
        tracks,
        artists,
        playlists,
        events,
        claims,
        auditLogs,
        featuredVibe,
        savedTrackIds,
        offlineTrackIds,
        currentTrack,
        isPlaying,
        playbackState,
        isMiniPlayerVisible,
        hasPlayedInSession,
        resumedFromStorage,
        currentTime,
        duration,
        volume,
        isMuted,
        repeatMode,
        isLooping: repeatMode === 'one',
        isShuffling,
        queue,
        crossfadeSeconds,
        playbackRate,
        audioQuality,
        effectiveAudioQuality,
        estimatedMbPerMinute,
        playbackError,
        catalogError,
        playHistory,
        isFullscreenPlayerOpen,
        fullscreenPlayerTab,
        activeShareTrack,
        activeShareArtist,
        activeDetailTrack,
        selectedArtistModal,
        isArtistSubmitModalOpen,
        isAuthModalOpen,
        authModalTab,
        isPlaylistModalOpen,
        playlistModalTrack,
        isCatalogLoaded,
        isVisualizerActive,
        visualizerStyle,
        toggleVisualizer,
        setVisualizerStyle,
        eqPreset,
        setEqPreset,
        playTrack,
        playTrackList,
        togglePlayPause,
        clearActiveTrack,
        seekTo,
        setVolume,
        toggleMute,
        cycleRepeatMode,
        toggleLoop,
        toggleShuffle,
        playNextTrack,
        playPrevTrack,
        addToQueue,
        playNextInQueue,
        reorderQueue,
        removeFromQueue,
        clearQueue,
        setCrossfadeSeconds,
        setPlaybackRate,
        setAudioQuality,
        effectiveBitrateKbps,
        clearPlaybackError,
        retryPlayback,
        retryCatalogLoad,
        refreshCatalog,
        sleepTimerMinutes,
        sleepAtEndOfTrack,
        sleepTimerRemainingSeconds,
        setSleepTimer,
        setSleepAtEndOfTrack,
        cancelSleepTimer,
        clearHistory,
        addCommentToTrack,
        likeComment,
        deleteTrackComment,
        moderateTrackComment,
        setTrackModerationStatus,
        addNewArtist,
        addNewTrack,
        saveNewTrack,
        updateArtistProfile,
        deleteArtistProfile,
        updateTrack,
        downloadTrack,
        downloadTrackBatch,
        downloadPlaylistOffline,
        downloadArtistCatalogOffline,
        removeTracksOfflineBatch,
        deleteTrack,
        setCertifiedStatus,
        setTrackChartRank,
        toggleSaveTrack,
        addReaction,
        addEvent,
        submitClaim,
        approveClaim,
        rejectClaim,
        setFeaturedVibeTrack,
        toggleDerankTrack,
        toggleDraftTrack,
        scheduleRelease,
        addAuditLog,
        selectedCountry,
        setSelectedCountry,
        upsertGenre,
        createPublicPlaylist,
        updatePublicPlaylist,
        deletePublicPlaylist,
        reorderPlaylistTracks,
        removeTrackFromPlaylist,
        toggleLikePlaylist,
        recordPlaylistPlay,
        monetizationConfig,
        updateMonetizationConfig,
        payoutMethods,
        payoutRequests,
        supportTickets,
        requestArtistMonetization,
        approveArtistMonetization,
        rejectArtistMonetization,
        suspendArtistMonetization,
        revokeArtistMonetization,
        addPayoutMethod,
        removePayoutMethod,
        setDefaultPayoutMethod,
        submitPayoutRequest,
        updatePayoutRequestStatus,
        submitContentReportRecord,
        submitSupportTicket,
        boostArtistFollowers,
        isAnalyticsModalOpen,
        analyticsArtist,
        openAnalyticsModal,
        closeAnalyticsModal,
        setIsFullscreenPlayerOpen,
        openFullscreenPlayer,
        setFullscreenPlayerTab,
        setActiveShareTrack,
        setActiveShareArtist,
        setActiveDetailTrack,
        setSelectedArtistModal,
        setIsArtistSubmitModalOpen,
        openAuthModal,
        closeAuthModal,
        openPlaylistModal,
        closePlaylistModal,
        isLegalModalOpen,
        legalModalType,
        openLegalModal,
        closeLegalModal,
        activeDownload,
        activeBatchDownload,
        dismissAllModals,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) throw new Error('useAudio must be used within an AudioProvider');
  return context;
};
