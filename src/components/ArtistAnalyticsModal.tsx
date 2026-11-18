import {
  Activity,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  Globe,
  Lock,
  MapPin,
  Music,
  Play,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { Artist } from '../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import { formatNumber, formatTime, getTrackLikeCount } from '../utils/formatters';

interface ArtistAnalyticsModalProps {
  isOpen: boolean;
  artist: Artist | null;
  onClose: () => void;
}

type AnalyticsTab = 'overview' | 'geography' | 'tracks' | 'royalties';

export const ArtistAnalyticsModal: React.FC<ArtistAnalyticsModalProps> = ({
  isOpen,
  artist,
  onClose,
}) => {
  const { tracks, artists } = useAudio();
  const { payoutRecords } = useAuth();

  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const currentArtist = artist || artists[0];

  const artistTracks = useMemo(() => {
    if (!currentArtist) return [];
    return tracks.filter(
      t =>
        t.artistId === currentArtist.id ||
        t.artistName.toLowerCase() === currentArtist.name.toLowerCase()
    );
  }, [tracks, currentArtist]);

  if (!isOpen || !currentArtist) return null;

  const totalPlays = artistTracks.reduce((sum, t) => sum + (t.plays || 0), 0);
  const totalDownloads = artistTracks.reduce((sum, t) => sum + (t.downloads || 0), 0);
  const totalLikes = artistTracks.reduce((sum, t) => sum + getTrackLikeCount(t), 0);
  const totalSecondsStreamed = artistTracks.reduce(
    (sum, t) => sum + (t.plays || 0) * (t.durationSeconds || 0),
    0
  );
  const totalHours = Number((totalSecondsStreamed / 3600).toFixed(1));
  const avgDurationSec =
    artistTracks.length > 0
      ? Math.round(
          artistTracks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0) /
            artistTracks.length
        )
      : 0;

  const ROYALTY_PER_STREAM = 0.0078;
  const directRoyalties = (totalPlays * ROYALTY_PER_STREAM).toFixed(2);

  // Real per-track bars (no fabricated synthetic multipliers)
  const chartTracks = artistTracks.slice(0, 8);
  const maxTrackPlays = Math.max(1, ...chartTracks.map(t => t.plays || 0));

  // Real city / region data if present on artist record
  const realCities = currentArtist.stats?.topCities || [];
  const artistPayouts = payoutRecords.filter(
    p => p.artistId === currentArtist.id || p.artistName?.toLowerCase() === currentArtist.name.toLowerCase()
  );

  const handleExport = (type: 'csv' | 'pdf') => {
    if (type === 'csv') {
      const headers = ['Track Title', 'Genre', 'Duration (s)', 'Plays', 'Likes', 'Downloads', 'Estimated Royalties (USD)'];
      const rows = artistTracks.map(tr => [
        `"${tr.title.replace(/"/g, '""')}"`,
        `"${tr.genre}"`,
        tr.durationSeconds || 0,
        tr.plays || 0,
        getTrackLikeCount(tr),
        tr.downloads || 0,
        ((tr.plays || 0) * ROYALTY_PER_STREAM).toFixed(2),
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentArtist.name.toLowerCase().replace(/\s+/g, '-')}-analytics-${selectedDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setExportSuccess(
      `Exported real ${type.toUpperCase()} analytics ledger for ${currentArtist.name} (${selectedDate}).`
    );
    setTimeout(() => setExportSuccess(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-lime-400 to-emerald-600 shrink-0" />

        {/* Modal Top Bar */}
        <div className="p-4 sm:p-6 pb-4 border-b border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-950/60">
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 rounded-2xl overflow-hidden border border-emerald-400 shadow-lg shrink-0 bg-black">
              <img
                src={currentArtist.avatar || DEFAULT_AVATAR_SVG}
                alt={currentArtist.name}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                }}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold text-white font-heading">
                  {currentArtist.name} • Studio Analytics
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span>FIRESTORE LIVE</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono mt-0.5">
                <span className="text-emerald-400">{currentArtist.handle}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  {currentArtist.location || 'Independent Studio'}
                </span>
                <span>•</span>
                <span className="text-zinc-500">Snapshot: {selectedDate}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-mono">
              <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-transparent text-white text-[11px] focus:outline-none cursor-pointer"
                title="Snapshot date"
              />
            </div>

            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
              title="Export CSV Dataset"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 px-6 gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Live Streams & Engagement</span>
          </button>

          <button
            onClick={() => setActiveTab('geography')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'geography'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Audience & Reach</span>
          </button>

          <button
            onClick={() => setActiveTab('tracks')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'tracks'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Track Breakdown ({artistTracks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('royalties')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition shrink-0 cursor-pointer ${
              activeTab === 'royalties'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Royalties & Settlements</span>
          </button>
        </div>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-700/80 text-xs text-emerald-200 flex items-center justify-between animate-fadeIn font-mono">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {exportSuccess}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">DOWNLOADED</span>
            </div>
          )}

          {/* Top Real KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider">Verified Streams</span>
                <Play className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono tabular-nums">{formatNumber(totalPlays)}</div>
              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5 mt-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>{totalLikes} verified likes</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider">Followers</span>
                <Users className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono tabular-nums">
                {formatNumber(currentArtist.followersCount || 0)}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {currentArtist.monthlyListeners || 0} monthly listeners
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider">Master Downloads</span>
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
                {formatNumber(totalDownloads)}
              </div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {artistTracks.length} published tracks
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider">Stream Volume</span>
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <div className="text-lg font-bold text-white font-mono tabular-nums">{totalHours} hrs</div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Avg track length: {formatTime(avgDurationSec)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between text-zinc-500 mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider">Direct Royalties</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums">${directRoyalties}</div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                ${ROYALTY_PER_STREAM}/stream rate
              </div>
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white font-heading">
                      Real-Time Track Playback Distribution
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Live stream counts recorded directly in Firestore across {artistTracks.length} track(s).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />
                    <span>Verified Plays</span>
                  </div>
                </div>

                {chartTracks.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-400 font-mono border border-dashed border-zinc-800 rounded-2xl">
                    No published tracks found for {currentArtist.name} yet. Upload a master to begin tracking real stream telemetry.
                  </div>
                ) : (
                  <div className="pt-6 pb-2">
                    <div className="h-44 flex items-end gap-2 sm:gap-4 justify-between border-b border-zinc-800 pb-2">
                      {chartTracks.map(tr => {
                        const plays = tr.plays || 0;
                        const barHeightPercent =
                          totalPlays > 0 ? Math.max(8, Math.round((plays / maxTrackPlays) * 90)) : 4;
                        return (
                          <div key={tr.id} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end min-w-0">
                            <span className="text-[10px] font-mono text-amber-400 tabular-nums">
                              {formatNumber(plays)}
                            </span>
                            <div
                              style={{ height: `${barHeightPercent}%` }}
                              className="w-full max-w-[48px] rounded-t-xl bg-gradient-to-t from-amber-600 to-amber-400 group-hover:from-amber-500 group-hover:to-amber-300 transition-all duration-300 shadow-lg shadow-amber-500/10 relative"
                            />
                            <span className="text-[10px] font-mono text-zinc-400 truncate w-full text-center">
                              {tr.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GEOGRAPHY & AUDIENCE */}
          {activeTab === 'geography' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white font-heading">
                      Audience & Listener Reach
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Verified geographic telemetry logged from listener playback sessions.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400">
                    {realCities.length} recorded hub(s)
                  </span>
                </div>

                {realCities.length === 0 ? (
                  <div className="py-10 text-center text-xs text-zinc-400 font-mono border border-dashed border-zinc-800 rounded-2xl">
                    No regional listener breakdown recorded yet. Real city metrics appear here as listeners stream your releases.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {realCities.map(reg => (
                      <div
                        key={reg.city}
                        className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{reg.city}</div>
                        </div>
                        <div className="text-xs font-bold font-mono text-amber-400 tabular-nums">
                          {formatNumber(reg.count)} streams
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TRACK BREAKDOWN */}
          {activeTab === 'tracks' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white font-heading">
                    Track Performance Breakdown
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Live metrics for all works registered under {currentArtist.name}.
                  </p>
                </div>
                <span className="text-xs font-mono text-zinc-400">{artistTracks.length} catalog items</span>
              </div>

              {artistTracks.length === 0 ? (
                <div className="py-10 text-center text-xs text-zinc-400 font-mono border border-dashed border-zinc-800 rounded-2xl">
                  No tracks uploaded for this artist yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {artistTracks.map((tr, index) => {
                    const trackStreams = tr.plays || 0;
                    const trackLikes = getTrackLikeCount(tr);
                    const trackEarnings = (trackStreams * ROYALTY_PER_STREAM).toFixed(2);
                    const downloads = tr.downloads || 0;

                    return (
                      <div
                        key={tr.id}
                        className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-5 text-center text-xs font-mono text-zinc-500">
                            {index + 1}
                          </span>
                          <img
                            src={tr.coverArt || DEFAULT_ARTWORK_SVG}
                            alt={tr.title}
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                            }}
                            className="w-11 h-11 rounded-xl object-cover border border-zinc-800 shrink-0"
                          />
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-white font-heading">{tr.title}</h4>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-mono mt-0.5">
                              <span>{tr.genre}</span>
                              <span>•</span>
                              <span>{formatTime(tr.durationSeconds)}</span>
                              <span>•</span>
                              <span className="text-amber-400">{tr.bpm} BPM</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 justify-between sm:justify-end text-xs font-mono tabular-nums">
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-zinc-500 block uppercase">Streams</span>
                            <span className="font-bold text-zinc-200">{formatNumber(trackStreams)}</span>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-zinc-500 block uppercase">Likes</span>
                            <span className="font-bold text-rose-400">{formatNumber(trackLikes)}</span>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-zinc-500 block uppercase">Downloads</span>
                            <span className="font-bold text-indigo-400">{formatNumber(downloads)}</span>
                          </div>

                          <div className="text-left sm:text-right min-w-[70px]">
                            <span className="text-[10px] text-zinc-500 block uppercase">Royalties</span>
                            <span className="font-bold text-amber-400">${trackEarnings}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DIRECT ROYALTIES */}
          {activeTab === 'royalties' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-zinc-950 to-amber-950/20 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-heading">
                      LowerVibe Fair Direct Royalty Protocol
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Calculated strictly from verified track stream counts at ${ROYALTY_PER_STREAM} per stream.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Stream Rate</span>
                    <div className="text-base font-bold text-emerald-400 font-mono">${ROYALTY_PER_STREAM} / Stream</div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Accrued Balance</span>
                    <div className="text-base font-bold text-amber-400 font-mono">${directRoyalties}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] uppercase font-mono text-zinc-500 block">Payout Records</span>
                    <div className="text-base font-bold text-white font-mono">{artistPayouts.length}</div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-heading">
                    Settlement Ledger
                  </h4>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>VERIFIED LEDGER</span>
                  </span>
                </div>

                {artistPayouts.length === 0 ? (
                  <p className="text-xs text-zinc-400 font-mono">
                    No settlement payouts processed yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {artistPayouts.map(rec => (
                      <div key={rec.id} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs font-mono">
                        <span className="text-zinc-200">{rec.period} • {rec.txRef || rec.status.toUpperCase()}</span>
                        <span className="text-emerald-400 font-bold">${rec.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => handleExport('csv')}
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Download CSV Ledger</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
