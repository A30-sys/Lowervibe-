import { Language } from '../context/LanguageContext';
import { Track } from '../types';

const GENRE_ALIAS_MAP: Record<string, string> = {
  'afro pop': 'Afro-Pop',
  'afropop': 'Afro-Pop',
  'afro-pop': 'Afro-Pop',
  'malawi afro pop': 'Afro-Pop',
  'afro fusion': 'Afro-Fusion',
  'afro-fusion': 'Afro-Fusion',
  'afrofusion': 'Afro-Fusion',
  'afrobeats': 'Afrobeats',
  'afro beats': 'Afrobeats',
  'afrobeat': 'Afrobeats',
  'danceall': 'Dancehall',
  'dancehall': 'Dancehall',
  'dance hall': 'Dancehall',
  'zimdancehall': 'Dancehall',
  'trap music': 'Trap',
  'trap': 'Trap',
  'hip hop': 'Hip-Hop',
  'hip-hop': 'Hip-Hop',
  'hiphop': 'Hip-Hop',
  'rap': 'Hip-Hop',
  'amapiano': 'Amapiano',
  'ama piano': 'Amapiano',
  'gospel': 'Gospel',
  'r&b': 'R&B',
  'rnb': 'R&B',
  'r & b': 'R&B',
  'afro-soul': 'Afro-Soul',
  'afro soul': 'Afro-Soul',
  'afrosoul': 'Afro-Soul',
  'soul': 'Afro-Soul',
  'reggae': 'Reggae',
  'acoustic': 'Acoustic',
  'lo-fi': 'Lo-Fi',
  'lofi': 'Lo-Fi',
  'lo fi': 'Lo-Fi',
  'chillout': 'Chill & Ambient',
  'afro chillout': 'Chill & Ambient',
  'ambient': 'Chill & Ambient',
  'chill': 'Chill & Ambient',
};

const GENRE_CHICHEWA_MAP: Record<string, string> = {
  'Afro-Pop': 'Afro-Pop',
  'Afro-Fusion': 'Afro-Fusion',
  'Afrobeats': 'Afrobeats',
  'Dancehall': 'Dancehall',
  'Trap': 'Trap',
  'Hip-Hop': 'Hip-Hop',
  'Amapiano': 'Amapiano',
  'Gospel': 'Nyimbo za Uzimu',
  'R&B': 'R&B',
  'Afro-Soul': 'Afro-Soul',
  'Reggae': 'Reggae',
  'Acoustic': 'Nyimbo za Gitala',
  'Lo-Fi': 'Nyimbo Zofewetsa',
  'Chill & Ambient': 'Nyimbo Zopumulira',
  'Other': 'Zina',
};

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeGenreCategory(raw?: string): string {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Other';
  const key = cleaned.toLowerCase();
  if (GENRE_ALIAS_MAP[key]) {
    return GENRE_ALIAS_MAP[key];
  }
  return toTitleCase(cleaned);
}

export function translateGenreCategory(category: string, language: Language): string {
  const canonical = normalizeGenreCategory(category);
  if (language === 'ny') {
    return GENRE_CHICHEWA_MAP[canonical] || canonical;
  }
  return canonical;
}

export interface CategorizedTrackGroup {
  category: string;
  tracks: Track[];
  totalPlays: number;
}

export function groupTracksByCategory(tracks: Track[]): CategorizedTrackGroup[] {
  const map = new Map<string, CategorizedTrackGroup>();

  for (const track of tracks) {
    const category = normalizeGenreCategory(track.genre);
    const existing = map.get(category);
    if (existing) {
      existing.tracks.push(track);
      existing.totalPlays += track.plays || 0;
    } else {
      map.set(category, {
        category,
        tracks: [track],
        totalPlays: track.plays || 0,
      });
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      tracks: [...group.tracks].sort(
        (a, b) =>
          (b.plays || 0) +
          (b.likes || 0) * 2 -
          ((a.plays || 0) + (a.likes || 0) * 2)
      ),
    }))
    .sort((a, b) => b.tracks.length * 50 + b.totalPlays - (a.tracks.length * 50 + a.totalPlays));
}
