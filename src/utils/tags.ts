import { Artist, Track } from '../types';
import { normalizeGenreCategory } from './genreCategories';

export type TagKind = 'genre' | 'mood' | 'vibe';

export interface CatalogTagItem {
  tag: string;
  key: string;
  kind: TagKind;
  count: number;
  artistCount: number;
  totalPlays: number;
  score: number;
}

const UPPERCASE_TOKENS = new Set(['r&b', 'edm', 'uk', 'us', 'dj', 'mc', 'afro-r&b']);

function cleanRawTag(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
}

export function normalizeTagLabel(raw?: string): string {
  const cleaned = cleanRawTag(raw);
  if (!cleaned) return '';

  const normalizedGenre = normalizeGenreCategory(cleaned);
  // If normalizeGenreCategory mapped an explicit alias or matches a canonical category, preserve that
  if (
    normalizedGenre !== 'Other' &&
    normalizedGenre.toLowerCase() !== cleaned.toLowerCase()
  ) {
    return normalizedGenre;
  }

  const lower = cleaned.toLowerCase();
  if (UPPERCASE_TOKENS.has(lower)) {
    return lower.toUpperCase();
  }
  if (lower === 'rnb' || lower === 'r & b') return 'R&B';
  if (lower === 'lofi' || lower === 'lo fi') return 'Lo-Fi';
  if (lower === 'hiphop' || lower === 'hip hop') return 'Hip-Hop';

  return cleaned
    .split(/(\s+|-)/)
    .map((segment) => {
      if (!segment || segment === '-' || /^\s+$/.test(segment)) return segment;
      const segLower = segment.toLowerCase();
      if (UPPERCASE_TOKENS.has(segLower)) return segLower.toUpperCase();
      return segLower.charAt(0).toUpperCase() + segLower.slice(1);
    })
    .join('');
}

export function toTagKey(raw?: string): string {
  return normalizeTagLabel(raw).toLowerCase();
}

export function getTrackSubTags(track: Pick<Track, 'mood' | 'vibeTags'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const pushTag = (raw?: string) => {
    const label = normalizeTagLabel(raw);
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };

  if (track.mood) pushTag(track.mood);
  if (Array.isArray(track.vibeTags)) {
    track.vibeTags.forEach((v) => pushTag(v));
  }

  return out;
}

export function getTrackTags(
  track: Pick<Track, 'genre' | 'mood' | 'vibeTags'>,
  options?: { includeGenre?: boolean }
): string[] {
  const includeGenre = options?.includeGenre ?? true;
  const seen = new Set<string>();
  const out: string[] = [];

  const pushTag = (raw?: string) => {
    const label = normalizeTagLabel(raw);
    if (!label || label.toLowerCase() === 'other') return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  };

  if (includeGenre && track.genre) {
    pushTag(normalizeGenreCategory(track.genre));
  }
  getTrackSubTags(track).forEach((sub) => pushTag(sub));

  return out;
}

export function trackMatchesTag(
  track: Pick<Track, 'genre' | 'mood' | 'vibeTags'>,
  rawTag?: string
): boolean {
  const targetKey = toTagKey(rawTag);
  if (!targetKey) return true;

  const canonicalGenre = normalizeGenreCategory(track.genre);
  if (canonicalGenre.toLowerCase() === targetKey) return true;
  if (toTagKey(track.genre) === targetKey) return true;
  if (track.mood && toTagKey(track.mood) === targetKey) return true;

  if (Array.isArray(track.vibeTags)) {
    return track.vibeTags.some((v) => toTagKey(v) === targetKey);
  }
  return false;
}

export function artistMatchesTag(
  artist: Pick<Artist, 'genres'>,
  artistTracks: Track[],
  rawTag?: string
): boolean {
  const targetKey = toTagKey(rawTag);
  if (!targetKey) return true;

  if (Array.isArray(artist.genres)) {
    if (artist.genres.some((g) => toTagKey(g) === targetKey)) {
      return true;
    }
  }
  return artistTracks.some((t) => trackMatchesTag(t, targetKey));
}

export function extractArtistTags(
  artist: Pick<Artist, 'genres'> | null | undefined,
  artistTracks: Track[]
): CatalogTagItem[] {
  const map = new Map<string, CatalogTagItem>();

  const register = (raw: string | undefined, kind: TagKind, trackPlays: number, hasTrack: boolean) => {
    const label = normalizeTagLabel(raw);
    if (!label || label.toLowerCase() === 'other') return;
    const key = label.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      if (hasTrack) {
        existing.count += 1;
        existing.totalPlays += trackPlays;
      }
      // Prefer sub-genre/mood specificity if the same tag comes from vibe/mood
      if (existing.kind === 'genre' && kind !== 'genre') {
        existing.kind = kind;
      }
      existing.score = existing.count * 25 + existing.totalPlays;
    } else {
      map.set(key, {
        tag: label,
        key,
        kind,
        count: hasTrack ? 1 : 0,
        artistCount: 1,
        totalPlays: trackPlays,
        score: (hasTrack ? 25 : 10) + trackPlays,
      });
    }
  };

  for (const track of artistTracks) {
    const plays = Number(track.plays || 0);
    const seenOnTrack = new Set<string>();
    const pushTrackTag = (raw: string | undefined, kind: TagKind) => {
      const key = toTagKey(raw);
      if (!key || seenOnTrack.has(key)) return;
      seenOnTrack.add(key);
      register(raw, kind, plays, true);
    };

    if (track.mood) pushTrackTag(track.mood, 'mood');
    if (Array.isArray(track.vibeTags)) {
      track.vibeTags.forEach((v) => pushTrackTag(v, 'vibe'));
    }
    if (track.genre) {
      pushTrackTag(normalizeGenreCategory(track.genre), 'genre');
    }
  }

  if (artist && Array.isArray(artist.genres)) {
    artist.genres.forEach((g) => {
      const key = toTagKey(g);
      if (!key || map.has(key)) return;
      register(g, 'genre', 0, false);
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.totalPlays !== a.totalPlays) return b.totalPlays - a.totalPlays;
    return a.tag.localeCompare(b.tag);
  });
}

export function extractCatalogTags(tracks: Track[], artists: Artist[] = []): CatalogTagItem[] {
  const map = new Map<
    string,
    {
      item: CatalogTagItem;
      artistIds: Set<string>;
    }
  >();

  const register = (
    raw: string | undefined,
    kind: TagKind,
    trackPlays: number,
    artistId: string,
    isTrackSource: boolean
  ) => {
    const label = normalizeTagLabel(raw);
    if (!label || label.toLowerCase() === 'other') return;
    const key = label.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      if (isTrackSource) {
        existing.item.count += 1;
        existing.item.totalPlays += trackPlays;
      }
      if (artistId) existing.artistIds.add(artistId);
      existing.item.artistCount = existing.artistIds.size;
      if (existing.item.kind === 'genre' && kind !== 'genre') {
        existing.item.kind = kind;
      }
      existing.item.score = existing.item.count * 30 + existing.item.totalPlays + existing.artistIds.size * 15;
    } else {
      const artistIds = new Set<string>();
      if (artistId) artistIds.add(artistId);
      const count = isTrackSource ? 1 : 0;
      map.set(key, {
        artistIds,
        item: {
          tag: label,
          key,
          kind,
          count,
          artistCount: artistIds.size,
          totalPlays: trackPlays,
          score: count * 30 + trackPlays + artistIds.size * 15,
        },
      });
    }
  };

  for (const track of tracks) {
    const plays = Number(track.plays || 0);
    const seenOnTrack = new Set<string>();
    const addTrackTag = (raw: string | undefined, kind: TagKind) => {
      const key = toTagKey(raw);
      if (!key || seenOnTrack.has(key)) return;
      seenOnTrack.add(key);
      register(raw, kind, plays, track.artistId || '', true);
    };

    if (track.mood) addTrackTag(track.mood, 'mood');
    if (Array.isArray(track.vibeTags)) {
      track.vibeTags.forEach((v) => addTrackTag(v, 'vibe'));
    }
    if (track.genre) {
      addTrackTag(normalizeGenreCategory(track.genre), 'genre');
    }
  }

  for (const artist of artists) {
    if (!Array.isArray(artist.genres)) continue;
    for (const g of artist.genres) {
      register(g, 'genre', 0, artist.id, false);
    }
  }

  return Array.from(map.values())
    .map((entry) => entry.item)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.count !== a.count) return b.count - a.count;
      return b.totalPlays - a.totalPlays;
    });
}

export function getTrackEngagementScore(track: Track): number {
  const plays = Number(track.plays || 0);
  const likes = Number(track.likes || 0);
  const saves = Number(track.saves || 0);
  const reposts = Number(track.reposts || 0);
  const baseVelocity = plays + likes * 4 + saves * 3 + reposts * 5;

  const dateRaw = track.createdAt || track.releaseDate;
  const parsedMs = dateRaw ? new Date(dateRaw).getTime() : NaN;
  if (!Number.isFinite(parsedMs)) {
    return baseVelocity;
  }

  const ageDays = Math.max(0, (Date.now() - parsedMs) / (1000 * 60 * 60 * 24));
  // Gentle freshness boost for recent drops without hiding genuinely popular catalog songs
  const freshnessMultiplier = ageDays <= 14 ? 1.45 : ageDays <= 45 ? 1.2 : ageDays <= 120 ? 1.05 : 1.0;
  return Math.round(baseVelocity * freshnessMultiplier + (track.isFeaturedVibe ? 15 : 0));
}
