import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { FirestoreGenre, Track } from '../types';

export type { FirestoreGenre };

export const CANONICAL_GENRES: Omit<FirestoreGenre, 'trackCount'>[] = [
  {
    id: 'afro-fusion',
    name: 'Afro-Fusion',
    description: 'Organic acoustic chords, regional polyrhythms, and atmospheric roots.',
    isFeatured: true,
    color: '#C6FF4A',
    icon: 'globe',
  },
  {
    id: 'afro-soul-amapiano',
    name: 'Afro-Soul / Amapiano',
    description: 'Deep log-drum grooves, warm Rhodes keys, and soulful vocal layers.',
    isFeatured: true,
    color: '#A855F7',
    icon: 'disc',
  },
  {
    id: 'ambient',
    name: 'Ambient',
    description: 'Spatial modular synthesizer drones, field recordings, and resonant textures.',
    isFeatured: true,
    color: '#38BDF8',
    icon: 'waves',
  },
  {
    id: 'afro-chillout',
    name: 'Afro Chillout',
    description: 'Relaxed sunset tempos, nylon chords, and nocturnal downtempo grooves.',
    isFeatured: true,
    color: '#F59E0B',
    icon: 'sun',
  },
  {
    id: 'ambient-drone',
    name: 'Ambient Drone',
    description: 'Deep analog tape saturation, 24-bit soundscapes, and cinematic drone textures.',
    isFeatured: true,
    color: '#818CF8',
    icon: 'radio',
  },
  {
    id: 'field-modular',
    name: 'Field & Modular',
    description: 'Binaural microphones, Eurorack ambient pulses, and organic environmental layers.',
    isFeatured: false,
    color: '#10B981',
    icon: 'mic',
  },
  {
    id: 'lo-fi-hip-hop',
    name: 'Lo-Fi Hip-Hop',
    description: 'Tape saturation, dusty drums, and mellow nocturnal swing.',
    isFeatured: true,
    color: '#F472B6',
    icon: 'cassette',
  },
  {
    id: 'downtempo-lo-fi',
    name: 'Downtempo Lo-Fi',
    description: 'Warm electric piano voicings, mellow bass, and deep focus rhythms.',
    isFeatured: false,
    color: '#E879F9',
    icon: 'moon',
  },
  {
    id: 'deep-dub',
    name: 'Deep Dub',
    description: 'Sub-bass pressure, tape space echoes, and minimalist rhythm.',
    isFeatured: false,
    color: '#2DD4BF',
    icon: 'speaker',
  },
  {
    id: 'ambient-folk',
    name: 'Ambient Folk',
    description: 'Fingerstyle acoustic guitar, intimate breath, and analog ambience.',
    isFeatured: false,
    color: '#FB923C',
    icon: 'music',
  },
];

export function slugifyGenreName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-genre';
}

/**
 * Ensures initial canonical genres exist in the Firestore database
 */
export async function seedFirestoreGenresIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'genres'));
    if (snap.empty) {
      const writes = CANONICAL_GENRES.map(g =>
        setDoc(doc(db, 'genres', g.id), {
          ...g,
          trackCount: 0,
          playsCount: 0,
          likesCount: 0,
          createdAt: new Date().toISOString(),
        })
      );
      await Promise.all(writes);
    }
  } catch (err) {
    console.warn('Could not seed genres to Firestore:', err);
  }
}

/**
 * Create or merge a custom (or canonical) genre document into Firestore /genres
 */
export async function upsertCustomGenre(
  rawName: string,
  options?: { description?: string; region?: string; createdBy?: string }
): Promise<FirestoreGenre> {
  const cleanName = rawName.trim();
  const id = slugifyGenreName(cleanName);
  const genreDoc: FirestoreGenre = {
    id,
    name: cleanName,
    description:
      options?.description?.trim() ||
      `Creator-defined sonic channel in ${cleanName}.`,
    trackCount: 0,
    isFeatured: false,
    isCustom: !CANONICAL_GENRES.some(g => g.name.toLowerCase() === cleanName.toLowerCase()),
    color: '#C6FF4A',
    icon: 'music',
    ...(options?.region ? { topRegion: options.region } : {}),
    ...(options?.createdBy ? { createdBy: options.createdBy } : {}),
  };

  try {
    await setDoc(
      doc(db, 'genres', id),
      {
        ...genreDoc,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Failed to persist custom genre to Firestore:', err);
  }
  return genreDoc;
}

/**
 * Compute ranked genres globally or weighted toward a chosen country/region.
 */
export function getTrendingGenres(
  genres: FirestoreGenre[],
  selectedCountry?: string
): FirestoreGenre[] {
  const normalizedCountry = selectedCountry?.trim().toLowerCase();
  const hasLocationFilter =
    Boolean(normalizedCountry) &&
    normalizedCountry !== 'global' &&
    normalizedCountry !== 'all regions';

  return [...genres]
    .map(g => {
      const baseScore =
        (g.playsCount || 0) * 1 +
        (g.likesCount || 0) * 6 +
        (g.trackCount || 0) * 30 +
        (g.isFeatured ? 10 : 0);

      let locationBoost = 0;
      if (hasLocationFilter && normalizedCountry) {
        const matchEntry = Object.entries(g.regionCounts || {}).find(([reg]) =>
          reg.toLowerCase().includes(normalizedCountry) ||
          normalizedCountry.includes(reg.toLowerCase())
        );
        if (matchEntry) {
          locationBoost = matchEntry[1] * 100;
        } else if (
          g.topRegion &&
          g.topRegion.toLowerCase().includes(normalizedCountry)
        ) {
          locationBoost = 50;
        }
      }

      return {
        ...g,
        trendingScore: baseScore + locationBoost,
      };
    })
    .sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
}

/**
 * Subscribes to musical genres in real time from the Firestore database.
 * Aggregates genre items from `/genres` and live `/tracks` telemetry (plays, likes, region distribution)
 * so most famous & trending genres update dynamically from real user data.
 */
export function subscribeToFirestoreGenres(
  onGenresUpdated: (genres: FirestoreGenre[], isFromCache: boolean) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  let genreDocsMap = new Map<string, FirestoreGenre>();
  let trackStatsMap = new Map<
    string,
    {
      displayName: string;
      count: number;
      plays: number;
      likes: number;
      regionCounts: Record<string, number>;
    }
  >();

  const emitCombined = (fromCache = false) => {
    const combined: FirestoreGenre[] = [];
    const seenNames = new Set<string>();

    genreDocsMap.forEach((genre) => {
      const key = genre.name.toLowerCase();
      const stats = trackStatsMap.get(key);
      const count = stats?.count ?? genre.trackCount ?? 0;
      const playsCount = stats?.plays ?? genre.playsCount ?? 0;
      const likesCount = stats?.likes ?? genre.likesCount ?? 0;
      const regionCounts = stats?.regionCounts || genre.regionCounts || {};
      const topRegionEntry = Object.entries(regionCounts).sort((a, b) => b[1] - a[1])[0];

      combined.push({
        ...genre,
        trackCount: count,
        playsCount,
        likesCount,
        regionCounts,
        topRegion: topRegionEntry?.[0] || genre.topRegion,
        trendingScore: playsCount + likesCount * 6 + count * 30,
      });
      seenNames.add(key);
    });

    trackStatsMap.forEach((stats, genreLower) => {
      if (!seenNames.has(genreLower)) {
        const topRegionEntry = Object.entries(stats.regionCounts).sort((a, b) => b[1] - a[1])[0];
        combined.push({
          id: slugifyGenreName(stats.displayName),
          name: stats.displayName,
          description: `Creator-defined channel in ${stats.displayName}.`,
          trackCount: stats.count,
          playsCount: stats.plays,
          likesCount: stats.likes,
          regionCounts: stats.regionCounts,
          topRegion: topRegionEntry?.[0],
          trendingScore: stats.plays + stats.likes * 6 + stats.count * 30,
          isFeatured: false,
          isCustom: true,
          color: '#C6FF4A',
          icon: 'music',
        });
        seenNames.add(genreLower);
      }
    });

    combined.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
    onGenresUpdated(combined, fromCache);
  };

  const unsubGenres = onSnapshot(
    collection(db, 'genres'),
    (snap) => {
      genreDocsMap = new Map();
      snap.docs.forEach((d) => {
        const data = d.data() as Partial<FirestoreGenre>;
        genreDocsMap.set(d.id, {
          id: d.id,
          name: data.name || d.id,
          description: data.description || 'Underground soundscapes from LOWERVIBE catalog.',
          trackCount: data.trackCount || 0,
          playsCount: data.playsCount || 0,
          likesCount: data.likesCount || 0,
          topRegion: data.topRegion,
          regionCounts: data.regionCounts || {},
          isFeatured: !!data.isFeatured,
          isCustom: !!data.isCustom,
          createdBy: data.createdBy,
          color: data.color || '#C6FF4A',
          icon: data.icon || 'music',
        });
      });
      emitCombined(snap.metadata.fromCache);
    },
    (err) => {
      console.warn('Firestore genres subscription notice:', err);
      onError?.(err);
      emitCombined(true);
    }
  );

  const unsubTracks = onSnapshot(
    collection(db, 'tracks'),
    (snap) => {
      trackStatsMap = new Map();
      snap.docs.forEach((d) => {
        const track = d.data() as Track;
        if (track && track.genre && !track.isDraft && !track.isDeranked) {
          const cleanName = track.genre.trim();
          const key = cleanName.toLowerCase();
          const existing = trackStatsMap.get(key) || {
            displayName: cleanName,
            count: 0,
            plays: 0,
            likes: 0,
            regionCounts: {},
          };
          existing.count += 1;
          existing.plays += track.plays || 0;
          const likeCount = Array.isArray(track.likedByUserIds)
            ? new Set(track.likedByUserIds.filter(Boolean)).size
            : track.likes || 0;
          existing.likes += likeCount;
          if (track.region) {
            existing.regionCounts[track.region] =
              (existing.regionCounts[track.region] || 0) + Math.max(1, track.plays || 1);
          }
          if (track.regionStats) {
            Object.entries(track.regionStats).forEach(([reg, cnt]) => {
              existing.regionCounts[reg] = (existing.regionCounts[reg] || 0) + (cnt || 0);
            });
          }
          trackStatsMap.set(key, existing);
        }
      });
      emitCombined(snap.metadata.fromCache);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'tracks');
      } catch {}
    }
  );

  return () => {
    unsubGenres();
    unsubTracks();
  };
}

