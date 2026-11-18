import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  auth,
  db,
  formatFirebaseError,
  handleFirestoreError,
  OperationType,
} from '../../services/firebase';
import { PlayRecord, Track } from '../../types';

export interface LiveTrackMetrics {
  track: Track;
  storedPlays: number;
  verifiedLedgerPlays: number;
  effectivePlays: number;
  totalLikes: number;
  totalDownloads: number;
  earnedMwk: number;
  sharePct: number;
  lastPlayedAt?: string;
}

export interface StudioLiveMetricsResult {
  songs: LiveTrackMetrics[];
  metricsByTrackId: Map<string, LiveTrackMetrics>;
  totalLivePlays: number;
  totalVerifiedLedgerPlays: number;
  totalLikes: number;
  totalDownloads: number;
  totalEarningsMwk: number;
  isSynced: boolean;
  listenerError: string | null;
}

export function useStudioLiveTrackMetrics(params: {
  artistId?: string;
  userId?: string;
  isMonetized: boolean;
  ratePerPlayMwk: number;
  fallbackTracks: Track[];
}): StudioLiveMetricsResult {
  const { artistId, userId, isMonetized, ratePerPlayMwk, fallbackTracks } = params;

  const [liveTracks, setLiveTracks] = useState<Track[] | null>(null);
  const [livePlays, setLivePlays] = useState<PlayRecord[]>([]);
  const [isSynced, setIsSynced] = useState(false);
  const [listenerError, setListenerError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser || (!artistId && !userId)) {
      setLiveTracks(null);
      setLivePlays([]);
      setIsSynced(false);
      return;
    }

    setListenerError(null);
    const tracksRef = collection(db, 'tracks');
    const tracksQuery = artistId
      ? query(tracksRef, where('artistId', '==', artistId))
      : query(tracksRef, where('uploadedByUserId', '==', userId));

    const unsubTracks = onSnapshot(
      tracksQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Track),
          id: docSnap.id,
        }));
        setLiveTracks(docs);
        setIsSynced(true);
      },
      (err) => {
        setIsSynced(false);
        setListenerError(formatFirebaseError(err, 'Could not stream track metrics'));
        try {
          handleFirestoreError(err, OperationType.LIST, 'tracks');
        } catch {
          // Structured diagnostic logged; UI shows inline error cleanly
        }
      }
    );

    let unsubPlays: (() => void) | undefined;
    if (artistId) {
      const playsQuery = query(collection(db, 'plays'), where('artistId', '==', artistId));
      unsubPlays = onSnapshot(
        playsQuery,
        (snapshot) => {
          const rows = snapshot.docs.map((docSnap) => ({
            ...(docSnap.data() as PlayRecord),
            id: docSnap.id,
          }));
          setLivePlays(rows);
        },
        (err) => {
          try {
            handleFirestoreError(err, OperationType.LIST, 'plays');
          } catch {
            // Non-blocking fallback to track.plays counter
          }
        }
      );
    }

    return () => {
      unsubTracks();
      if (unsubPlays) unsubPlays();
    };
  }, [artistId, userId]);

  return useMemo(() => {
    // Merge live Firestore tracks with fallbackTracks so local edits/uploads appear instantaneously
    const mergedMap = new Map<string, Track>();
    fallbackTracks.forEach((t) => mergedMap.set(t.id, t));
    if (liveTracks !== null) {
      liveTracks.forEach((t) => mergedMap.set(t.id, t));
    }
    const sourceTracks = Array.from(mergedMap.values());

    const verifiedPlaysByTrack = new Map<string, number>();
    const lastPlayedByTrack = new Map<string, string>();

    livePlays.forEach((play) => {
      if (!play.trackId) return;
      if (
        play.listenedSeconds >= 30 &&
        !play.isArtistSelfPlay &&
        play.qualifiesForPayout !== false
      ) {
        verifiedPlaysByTrack.set(
          play.trackId,
          (verifiedPlaysByTrack.get(play.trackId) || 0) + 1
        );
      }
      if (play.playedAt) {
        const prev = lastPlayedByTrack.get(play.trackId);
        if (!prev || play.playedAt > prev) {
          lastPlayedByTrack.set(play.trackId, play.playedAt);
        }
      }
    });

    const prelimRows = sourceTracks.map((track) => {
      const storedPlays = Math.max(0, track.plays || 0);
      const verifiedLedgerPlays = verifiedPlaysByTrack.get(track.id) || 0;
      const effectivePlays = Math.max(storedPlays, verifiedLedgerPlays);
      const totalLikes = Math.max(0, track.likes || 0);
      const totalDownloads = Math.max(0, track.downloads || 0);
      const earnedMwk = isMonetized ? Math.round(effectivePlays * ratePerPlayMwk) : 0;

      return {
        track,
        storedPlays,
        verifiedLedgerPlays,
        effectivePlays,
        totalLikes,
        totalDownloads,
        earnedMwk,
        sharePct: 0,
        lastPlayedAt: lastPlayedByTrack.get(track.id),
      };
    });

    const totalLivePlays = prelimRows.reduce((sum, r) => sum + r.effectivePlays, 0);
    const totalVerifiedLedgerPlays = prelimRows.reduce((sum, r) => sum + r.verifiedLedgerPlays, 0);
    const totalLikes = prelimRows.reduce((sum, r) => sum + r.totalLikes, 0);
    const totalDownloads = prelimRows.reduce((sum, r) => sum + r.totalDownloads, 0);
    const totalEarningsMwk = prelimRows.reduce((sum, r) => sum + r.earnedMwk, 0);

    const songs: LiveTrackMetrics[] = prelimRows.map((row) => ({
      ...row,
      sharePct:
        totalLivePlays > 0 ? Math.round((row.effectivePlays / totalLivePlays) * 100) : 0,
    }));

    const metricsByTrackId = new Map<string, LiveTrackMetrics>();
    songs.forEach((s) => metricsByTrackId.set(s.track.id, s));

    return {
      songs,
      metricsByTrackId,
      totalLivePlays,
      totalVerifiedLedgerPlays,
      totalLikes,
      totalDownloads,
      totalEarningsMwk,
      isSynced,
      listenerError,
    };
  }, [liveTracks, fallbackTracks, livePlays, isMonetized, ratePerPlayMwk, isSynced, listenerError]);
}
