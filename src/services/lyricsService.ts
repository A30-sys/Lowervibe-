import { doc, getDoc } from 'firebase/firestore';
import { Track } from '../types';
import { parseLrc, ParsedLyrics } from '../utils/lrcParser';
import { db } from './firebase';

export type LyricsSource = 'track' | 'firestore' | 'lrclib' | 'none';

export interface ResolvedTrackLyrics {
  trackId: string;
  rawLyrics: string;
  parsed: ParsedLyrics;
  source: LyricsSource;
}

interface CachedLyricsEntry {
  rawLyrics: string;
  source: LyricsSource;
  cachedAt: number;
}

const CACHE_KEY = 'lowervibe_lyrics_cache_v1';
const FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ITEMS = 60;

const memoryCache = new Map<string, CachedLyricsEntry>();

function readLocalCache(): Record<string, CachedLyricsEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalCache(trackId: string, entry: CachedLyricsEntry): void {
  memoryCache.set(trackId, entry);
  try {
    const all = readLocalCache();
    all[trackId] = entry;
    const keys = Object.keys(all);
    if (keys.length > MAX_CACHE_ITEMS) {
      keys
        .sort((a, b) => (all[a]?.cachedAt || 0) - (all[b]?.cachedAt || 0))
        .slice(0, keys.length - MAX_CACHE_ITEMS)
        .forEach((k) => {
          delete all[k];
        });
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    // Ignore quota errors
  }
}

function getCachedEntry(trackId: string): CachedLyricsEntry | null {
  const now = Date.now();
  const mem = memoryCache.get(trackId);
  if (mem) {
    const ttl = mem.source === 'none' ? MISS_TTL_MS : FOUND_TTL_MS;
    if (now - mem.cachedAt < ttl) return mem;
    memoryCache.delete(trackId);
  }

  const stored = readLocalCache()[trackId];
  if (!stored) return null;
  const ttl = stored.source === 'none' ? MISS_TTL_MS : FOUND_TTL_MS;
  if (now - stored.cachedAt < ttl) {
    memoryCache.set(trackId, stored);
    return stored;
  }
  return null;
}

function cleanQueryTitle(title: string): string {
  return title
    .replace(/\((?:official\s*(?:audio|video|music\s*video|lyric\s*video|visualizer)|lyrics?|audio|explicit|clean|prod\.?[^)]*)\)/gi, '')
    .replace(/\[(?:official\s*(?:audio|video|visualizer)|lyrics?|prod\.?[^\]]*)\]/gi, '')
    .replace(/\s+(?:feat\.?|ft\.?)\s+.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanQueryArtist(artistName: string): string {
  return artistName
    .split(/\s*(?:,|&|feat\.?|ft\.?|x)\s+/i)[0]
    .trim();
}

function buildResult(trackId: string, rawLyrics: string, source: LyricsSource): ResolvedTrackLyrics {
  const parsed = parseLrc(rawLyrics);
  return {
    trackId,
    rawLyrics,
    parsed,
    source: parsed.hasLyrics ? source : 'none',
  };
}

async function fetchFromLrclib(
  track: Track,
  signal?: AbortSignal
): Promise<string | null> {
  const cleanTitle = cleanQueryTitle(track.title);
  const cleanArtist = cleanQueryArtist(track.artistName);
  if (!cleanTitle || !cleanArtist) return null;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3800);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const params = new URLSearchParams({
      artist_name: cleanArtist,
      track_name: cleanTitle,
    });
    if (track.durationSeconds && track.durationSeconds > 0) {
      params.set('duration', String(Math.round(track.durationSeconds)));
    }

    const res = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        syncedLyrics?: string | null;
        plainLyrics?: string | null;
      };
      if (data.syncedLyrics?.trim()) return data.syncedLyrics.trim();
      if (data.plainLyrics?.trim()) return data.plainLyrics.trim();
    }

    if (controller.signal.aborted) return null;

    const searchParams = new URLSearchParams({
      q: `${cleanArtist} ${cleanTitle}`,
    });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!searchRes.ok) return null;
    const list = (await searchRes.json()) as Array<{
      trackName?: string;
      artistName?: string;
      duration?: number;
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
    }>;

    if (!Array.isArray(list) || list.length === 0) return null;

    const targetTitleLower = cleanTitle.toLowerCase();
    const targetArtistLower = cleanArtist.toLowerCase();

    const scored = list
      .filter((item) => Boolean(item.syncedLyrics?.trim() || item.plainLyrics?.trim()))
      .map((item) => {
        const itemTitle = (item.trackName || '').toLowerCase();
        const itemArtist = (item.artistName || '').toLowerCase();
        let score = 0;
        if (item.syncedLyrics?.trim()) score += 40;
        if (itemTitle === targetTitleLower) score += 35;
        else if (itemTitle.includes(targetTitleLower) || targetTitleLower.includes(itemTitle)) score += 18;
        if (itemArtist.includes(targetArtistLower) || targetArtistLower.includes(itemArtist)) score += 25;
        if (
          track.durationSeconds > 0 &&
          typeof item.duration === 'number' &&
          Math.abs(item.duration - track.durationSeconds) <= 6
        ) {
          score += 15;
        }
        return { item, score };
      })
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 35) return null;
    return best.item.syncedLyrics?.trim() || best.item.plainLyrics?.trim() || null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function fetchTrackLyrics(
  track: Track,
  options?: { forceRefresh?: boolean; signal?: AbortSignal }
): Promise<ResolvedTrackLyrics> {
  const localParsed = parseLrc(track.lyrics);
  if (localParsed.isSynced && !options?.forceRefresh) {
    const raw = (track.lyrics || '').trim();
    writeLocalCache(track.id, { rawLyrics: raw, source: 'track', cachedAt: Date.now() });
    return buildResult(track.id, raw, 'track');
  }

  if (!options?.forceRefresh) {
    const cached = getCachedEntry(track.id);
    if (cached) {
      if (cached.source !== 'none') {
        return buildResult(track.id, cached.rawLyrics, cached.source);
      }
      if (localParsed.hasLyrics) {
        return buildResult(track.id, (track.lyrics || '').trim(), 'track');
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return buildResult(track.id, '', 'none');
      }
      return buildResult(track.id, '', 'none');
    }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (localParsed.hasLyrics) {
      return buildResult(track.id, (track.lyrics || '').trim(), 'track');
    }
    return buildResult(track.id, '', 'none');
  }

  // Check Firestore live document first so creator-updated synced LRC arrives immediately
  try {
    const snap = await getDoc(doc(db, 'tracks', track.id));
    if (options?.signal?.aborted) {
      return buildResult(track.id, (track.lyrics || '').trim(), localParsed.hasLyrics ? 'track' : 'none');
    }
    if (snap.exists()) {
      const firestoreLyrics = String((snap.data() as { lyrics?: unknown })?.lyrics || '').trim();
      const fsParsed = parseLrc(firestoreLyrics);
      if (fsParsed.isSynced) {
        writeLocalCache(track.id, { rawLyrics: firestoreLyrics, source: 'firestore', cachedAt: Date.now() });
        return buildResult(track.id, firestoreLyrics, 'firestore');
      }
      if (fsParsed.hasLyrics && !localParsed.hasLyrics) {
        // Keep plain lyrics from Firestore as backup while trying LRCLIB for time-synced version
        const synced = await fetchFromLrclib(track, options?.signal);
        if (synced && parseLrc(synced).isSynced) {
          writeLocalCache(track.id, { rawLyrics: synced, source: 'lrclib', cachedAt: Date.now() });
          return buildResult(track.id, synced, 'lrclib');
        }
        writeLocalCache(track.id, { rawLyrics: firestoreLyrics, source: 'firestore', cachedAt: Date.now() });
        return buildResult(track.id, firestoreLyrics, 'firestore');
      }
    }
  } catch {
    // Offline or Firestore read blocked — continue cleanly
  }

  if (options?.signal?.aborted) {
    return buildResult(track.id, (track.lyrics || '').trim(), localParsed.hasLyrics ? 'track' : 'none');
  }

  const externalLyrics = await fetchFromLrclib(track, options?.signal);
  if (externalLyrics) {
    const extParsed = parseLrc(externalLyrics);
    if (extParsed.isSynced || !localParsed.hasLyrics) {
      writeLocalCache(track.id, { rawLyrics: externalLyrics, source: 'lrclib', cachedAt: Date.now() });
      return buildResult(track.id, externalLyrics, 'lrclib');
    }
  }

  if (localParsed.hasLyrics) {
    const raw = (track.lyrics || '').trim();
    writeLocalCache(track.id, { rawLyrics: raw, source: 'track', cachedAt: Date.now() });
    return buildResult(track.id, raw, 'track');
  }

  writeLocalCache(track.id, { rawLyrics: '', source: 'none', cachedAt: Date.now() });
  return buildResult(track.id, '', 'none');
}
