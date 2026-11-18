export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

export function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * Parse a duration input string ("3:45" or "225") or number into integer seconds.
 */
export function parseDurationInput(input: string | number | undefined | null): number {
  if (typeof input === 'number' && !Number.isNaN(input)) {
    return Math.max(0, Math.round(input));
  }
  const raw = String(input || '').trim();
  if (!raw) return 0;
  if (raw.includes(':')) {
    const parts = raw.split(':').map(p => parseInt(p.trim(), 10));
    if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
      return Math.max(0, parts[0] * 60 + parts[1]);
    }
    if (parts.length === 3 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1]) && !Number.isNaN(parts[2])) {
      return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
  }
  const numeric = parseFloat(raw);
  return Number.isNaN(numeric) ? 0 : Math.max(0, Math.round(numeric));
}

/**
 * Resolve canonical song length in seconds from Track.metadata.Duration first,
 * falling back to Track.metadata.duration and Track.durationSeconds.
 */
export function getTrackDurationSeconds(
  track?: {
    durationSeconds?: number;
    metadata?: { Duration?: number; duration?: number };
  } | null
): number {
  if (!track) return 0;
  const metaDur = track.metadata?.Duration ?? track.metadata?.duration;
  if (typeof metaDur === 'number' && metaDur > 0) return Math.round(metaDur);
  return Math.max(0, Math.round(track.durationSeconds || 0));
}

/**
 * Compute authoritative 1-person-per-like count from likedByUserIds when present,
 * falling back cleanly to track.likes.
 */
export function getTrackLikeCount(
  track?: {
    likes?: number;
    likedByUserIds?: string[];
  } | null
): number {
  if (!track) return 0;
  if (Array.isArray(track.likedByUserIds)) {
    return new Set(track.likedByUserIds.filter(Boolean)).size;
  }
  return Math.max(0, track.likes || 0);
}

/**
 * Check whether the given user has liked a track (one person per like).
 */
export function isTrackLikedByUser(
  track?: { id: string; likedByUserIds?: string[] } | null,
  user?: { id: string; likedTrackIds?: string[] } | null
): boolean {
  if (!track || !user) return false;
  if (Array.isArray(track.likedByUserIds)) {
    return track.likedByUserIds.includes(user.id);
  }
  return Boolean(user.likedTrackIds?.includes(track.id));
}

