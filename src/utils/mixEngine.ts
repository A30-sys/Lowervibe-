import { Track } from '../types';

const VISIT_SEED_SESSION_KEY = 'lowervibe_visit_mix_seed_v1';
const LAST_LEAD_TRACKS_STORAGE_KEY = 'lowervibe_last_lead_tracks_v1';

let fallbackMemorySeed: number | null = null;

function generateFreshSeed(): number {
  const nowPart = Date.now() & 0x7fffffff;
  const randPart = Math.floor(Math.random() * 0x7fffffff);
  return ((nowPart ^ randPart) || 133742) >>> 0;
}

export function getVisitMixSeed(): number {
  if (typeof window === 'undefined') {
    if (fallbackMemorySeed === null) {
      fallbackMemorySeed = generateFreshSeed();
    }
    return fallbackMemorySeed;
  }

  try {
    const existing = window.sessionStorage.getItem(VISIT_SEED_SESSION_KEY);
    if (existing) {
      const parsed = Number.parseInt(existing, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    const fresh = generateFreshSeed();
    window.sessionStorage.setItem(VISIT_SEED_SESSION_KEY, String(fresh));
    return fresh;
  } catch {
    if (fallbackMemorySeed === null) {
      fallbackMemorySeed = generateFreshSeed();
    }
    return fallbackMemorySeed;
  }
}

export function bumpVisitMixSeed(): number {
  const next = generateFreshSeed();
  fallbackMemorySeed = next;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(VISIT_SEED_SESSION_KEY, String(next));
    } catch {}
  }
  return next;
}

export function getLastLeadTrackIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LAST_LEAD_TRACKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function recordLeadTrackIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  const cleanIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 6);
  if (cleanIds.length === 0) return;
  try {
    window.localStorage.setItem(LAST_LEAD_TRACKS_STORAGE_KEY, JSON.stringify(cleanIds));
  } catch {}
}

/**
 * Deterministic Fisher-Yates shuffle using Mulberry32 PRNG for a given seed.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  if (arr.length <= 1) return arr;

  let state = (Math.abs(Math.floor(seed)) || 1) >>> 0;
  const nextRandom = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Mixes tracks fresh for each visit while avoiding repeating the exact same lead track(s)
 * at slot #1 across consecutive visits and keeping artist variety well-spaced near the top.
 */
export function mixTracksForVisit(
  tracks: readonly Track[],
  seed: number,
  options?: {
    avoidLeadIds?: readonly string[];
    salt?: number;
  }
): Track[] {
  if (tracks.length <= 1) return [...tracks];

  const effectiveSeed = (seed ^ ((options?.salt || 0) * 2654435761)) >>> 0;
  const shuffled = seededShuffle(tracks, effectiveSeed);

  const avoidSet = new Set(options?.avoidLeadIds ?? getLastLeadTrackIds());
  if (avoidSet.size > 0 && avoidSet.has(shuffled[0].id)) {
    const freshLeadIdx = shuffled.findIndex((t) => !avoidSet.has(t.id));
    if (freshLeadIdx > 0) {
      [shuffled[0], shuffled[freshLeadIdx]] = [shuffled[freshLeadIdx], shuffled[0]];
    }
  }

  // Soft de-clustering: avoid placing two tracks by the same artist back-to-back near the top
  const spaced: Track[] = [];
  const remaining = [...shuffled];
  let prevArtistKey = '';
  while (remaining.length > 0) {
    const nextIdx = remaining.findIndex(
      (t) => (t.artistId || t.artistName || '').toLowerCase() !== prevArtistKey
    );
    const chosenIdx = nextIdx >= 0 ? nextIdx : 0;
    const chosen = remaining.splice(chosenIdx, 1)[0];
    spaced.push(chosen);
    prevArtistKey = (chosen.artistId || chosen.artistName || '').toLowerCase();
  }

  return spaced;
}
