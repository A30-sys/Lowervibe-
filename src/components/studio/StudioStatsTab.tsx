import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import {
  Activity,
  BarChart3,
  Clock,
  Disc3,
  Heart,
  Play,
  Pause,
  Radio,
  TrendingUp,
  Users,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLanguage } from '../../context/LanguageContext';
import { db } from '../../services/firebase';
import { Track } from '../../types';
import { CountUpValue } from './CountUpValue';
import { formatTime } from '../../utils/formatters';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { translateGenreCategory } from '../../utils/genreCategories';

interface StudioStatsTabProps {
  artistId?: string;
  artistName?: string;
  userArtistId?: string;
  userName?: string;
  isAdmin?: boolean;
  isMonetized?: boolean;
  ratePerPlayMwk?: number;
  fallbackTracks: Track[];
  currentTrackId?: string;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onTogglePlayPause: () => void;
  onOpenTrackDetails: (track: Track) => void;
  onGoToUpload: () => void;
}

export const StudioStatsTab: React.FC<StudioStatsTabProps> = ({
  artistId,
  artistName,
  userArtistId,
  userName,
  isAdmin,
  isMonetized = false,
  ratePerPlayMwk = 4.5,
  fallbackTracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTogglePlayPause,
  onOpenTrackDetails,
  onGoToUpload,
}) => {
  const { language } = useLanguage();
  const isNy = language === 'ny';
  const [liveArtistTracks, setLiveArtistTracks] = useState<Track[] | null>(null);
  const [chartMode, setChartMode] = useState<'plays_likes' | 'reach'>('plays_likes');

  const resolvedArtistId = artistId || userArtistId;
  const resolvedArtistName = artistName || userName;

  useEffect(() => {
    if (!resolvedArtistId && !isAdmin) {
      setLiveArtistTracks(null);
      return;
    }

    try {
      const tracksRef = collection(db, 'tracks');
      const tracksQuery = resolvedArtistId
        ? query(tracksRef, where('artistId', '==', resolvedArtistId))
        : tracksRef;

      const unsubscribe = onSnapshot(
        tracksQuery,
        (snapshot) => {
          const docs = snapshot.docs.map((docSnap) => ({
            ...docSnap.data(),
            id: docSnap.id,
          })) as Track[];
          setLiveArtistTracks(docs);
        },
        () => {
          setLiveArtistTracks(null);
        }
      );

      return () => unsubscribe();
    } catch {
      setLiveArtistTracks(null);
    }
  }, [resolvedArtistId, isAdmin]);

  const artistTracks = useMemo(() => {
    const source = liveArtistTracks && liveArtistTracks.length > 0 ? liveArtistTracks : fallbackTracks;
    return source
      .filter((t) => {
        if (isAdmin && !resolvedArtistId) return true;
        return (
          (resolvedArtistId && t.artistId === resolvedArtistId) ||
          (resolvedArtistName && t.artistName.toLowerCase() === resolvedArtistName.toLowerCase())
        );
      })
      .sort((a, b) => (b.plays || 0) - (a.plays || 0));
  }, [liveArtistTracks, fallbackTracks, resolvedArtistId, resolvedArtistName, isAdmin]);

  const totals = useMemo(() => {
    return artistTracks.reduce(
      (acc, track) => {
        const plays = Math.max(0, track.plays || 0);
        const likes = Math.max(0, track.likes || 0);
        const reach = Object.keys(track.regionStats || {}).length;
        acc.plays += plays;
        acc.likes += likes;
        acc.regions = Math.max(acc.regions, reach);
        return acc;
      },
      { plays: 0, likes: 0, regions: 0 }
    );
  }, [artistTracks]);

  const trackChartData = useMemo(() => {
    return artistTracks.slice(0, 8).map((track) => {
      const plays = Math.max(0, track.plays || 0);
      const likes = Math.max(0, track.likes || 0);
      const shortTitle = track.title.length > 14 ? `${track.title.slice(0, 12)}…` : track.title;
      return {
        id: track.id,
        name: shortTitle,
        fullTitle: track.title,
        plays,
        likes,
        durationSeconds: track.metadata?.Duration || track.durationSeconds || 0,
        genre: track.genre,
      };
    });
  }, [artistTracks]);

  const regionChartData = useMemo(() => {
    const map = new Map<string, number>();
    artistTracks.forEach((t) => {
      if (t.regionStats) {
        Object.entries(t.regionStats).forEach(([region, count]) => {
          map.set(region, (map.get(region) || 0) + (count || 0));
        });
      }
    });
    return Array.from(map.entries())
      .map(([name, plays]) => ({ name, plays }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 8);
  }, [artistTracks]);

  if (artistTracks.length === 0) {
    return (
      <div className="p-8 sm:p-12 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
          <BarChart3 className="w-7 h-7" />
        </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[var(--text)]">
              {isNy ? 'Palibe ziwerengero pakadali pano' : 'No analytics yet'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              {isNy
                ? 'Kwezani nyimbo yanu yoyamba kuti muone kuwerenga, okonda ndi maiko omwe akumvera panthawiyi.'
                : 'Upload your first track to see real-time plays, likes, and listener regions.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToUpload}
            className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
          >
            {isNy ? 'Kwezani nyimbo' : 'Upload track'}
          </button>
        </div>
      );
    }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Real KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
            <span>{isNy ? 'Kuwerenga konke' : 'Total plays'}</span>
            <Play className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--text)] tabular-nums">
            {totals.plays.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
            <span>{isNy ? 'Okonda nyimbo' : 'Unique likes'}</span>
            <Heart className="w-3.5 h-3.5 text-[var(--violet)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--text)] tabular-nums">
            {totals.likes.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
            <span>{isNy ? 'Nyimbo' : 'Tracks'}</span>
            <Disc3 className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </div>
          <div className="text-2xl font-extrabold text-[var(--text)] tabular-nums">
            {artistTracks.length}
          </div>
        </div>

        <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
            <span>
              {isMonetized
                ? isNy
                  ? 'Ndalama Zonse'
                  : 'Total Earnings'
                : isNy
                ? 'Madera'
                : 'Regions'}
            </span>
            {isMonetized ? (
              <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            ) : (
              <Users className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            )}
          </div>
          <div className="text-2xl font-extrabold text-[var(--text)] tabular-nums">
            {isMonetized ? (
              <CountUpValue value={Math.round(totals.plays * ratePerPlayMwk)} suffix=" MWK" />
            ) : (
              regionChartData.length
            )}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="p-5 sm:p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{isNy ? 'Mmene nyimbo zikuyendera' : 'Track performance'}</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              {isNy
                ? 'Zimasintha panthawiyi kutengera kuwerenga ndi kukonda kwenikweni'
                : 'Updated live from stored play and like events'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1 rounded-full border border-[var(--border)] self-start">
            <button
              type="button"
              onClick={() => setChartMode('plays_likes')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                chartMode === 'plays_likes'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {isNy ? 'Zalira & Okonda' : 'Plays & Likes'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('reach')}
              className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                chartMode === 'reach'
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {isNy ? 'Maiko Otsogola' : 'Top Regions'}
            </button>
          </div>
        </div>

        <div className="h-[260px] w-full">
          {chartMode === 'plays_likes' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trackChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)', opacity: 0.45 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof trackChartData)[0];
                    return (
                      <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl text-xs space-y-1">
                        <div className="font-bold text-[var(--text)]">{row.fullTitle}</div>
                        <div className="text-[var(--text-muted)]">
                          {isNy ? 'Zalira:' : 'Plays:'} {row.plays.toLocaleString()}
                        </div>
                        <div className="text-[var(--text-muted)]">
                          {isNy ? 'Okonda:' : 'Likes:'} {row.likes.toLocaleString()}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="plays" name={isNy ? 'Zalira' : 'Plays'} radius={[6, 6, 0, 0]} maxBarSize={38}>
                  {trackChartData.map((_, idx) => (
                    <Cell key={idx} fill={idx === 0 ? '#C6FF3D' : '#7C5CFF'} />
                  ))}
                </Bar>
                <Bar dataKey="likes" name={isNy ? 'Okonda' : 'Likes'} fill="#A1A1AA" radius={[6, 6, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : regionChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[var(--text-muted)]">
              {isNy
                ? 'Palibe deta ya maiko yomwe yasungidwa pakadali pano.'
                : 'No country play breakdown recorded yet.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={regionChartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="lvRegionFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C5CFF" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7C5CFF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border)' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as { name: string; plays: number };
                    return (
                      <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xl text-xs">
                        <div className="font-bold text-[var(--text)]">{row.name}</div>
                        <div className="text-[var(--text-muted)]">
                          {row.plays.toLocaleString()} {isNy ? 'zalira' : 'plays'}
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="plays"
                  stroke="#7C5CFF"
                  strokeWidth={2}
                  fill="url(#lvRegionFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Per-Track Table */}
      <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
            <Disc3 className="w-4 h-4 text-[var(--accent-text)]" />
            <span>
              {isNy ? 'Nyimbo' : 'Tracks'} ({artistTracks.length})
            </span>
          </h3>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {artistTracks.map((track, idx) => {
            const isTrackActive = currentTrackId === track.id;
            const durationSec = track.metadata?.Duration || track.durationSeconds || 0;
            return (
              <div
                key={track.id}
                onClick={() => onOpenTrackDetails(track)}
                className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)]/60 transition cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-[var(--text-muted)] w-5 shrink-0">
                    {idx + 1}
                  </span>
                  <div className="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[var(--border)]">
                    <img
                      src={track.coverArt || DEFAULT_ARTWORK_SVG}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTrackActive) onTogglePlayPause();
                        else onPlayTrack(track);
                      }}
                      className="absolute inset-0 bg-black/45 flex items-center justify-center text-white opacity-0 hover:opacity-100 transition cursor-pointer"
                    >
                      {isTrackActive && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">{track.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-2">
                      <span>{translateGenreCategory(track.genre, language)}</span>
                      <span>•</span>
                      <span className="font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(durationSec)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0">
                  <div className="text-right">
                    <div className="font-bold text-[var(--text)]">{(track.plays || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{isNy ? 'Zalira' : 'Plays'}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="font-bold text-[var(--text)]">{(track.likes || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{isNy ? 'Okonda' : 'Likes'}</div>
                  </div>
                  <div className="text-right min-w-[78px]">
                    <div className={`font-bold ${isMonetized ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}>
                      {isMonetized
                        ? `${Math.round((track.plays || 0) * ratePerPlayMwk).toLocaleString()} MWK`
                        : isNy
                        ? 'Zotsekedwa'
                        : 'Locked'}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">{isNy ? 'Zopeza' : 'Earned'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
