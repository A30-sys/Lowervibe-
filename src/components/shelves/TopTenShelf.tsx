import { ArrowDown, ArrowRight, ArrowUp, Pause, Play } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { matchesLocationFilter } from '../../data/regions';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { LazySlideImage } from '../common/LazySlideImage';

interface TopTenShelfProps {
  onSelectArtist: (artistId: string) => void;
  onSelectCategory?: (category: string) => void;
}

type ChartMode = 'local' | 'africa' | 'rising';

export const TopTenShelf: React.FC<TopTenShelfProps> = ({ onSelectArtist }) => {
  const { tracks, currentTrack, isPlaying, playTrack, togglePlayPause, selectedCountry } =
    useAudio();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();
  const [chartMode, setChartMode] = useState<ChartMode>('local');

  const hasCountryScope = Boolean(
    selectedCountry && selectedCountry !== 'Global' && selectedCountry !== 'Africa'
  );

  const rankedTracks = useMemo(() => {
    const publicTracks = tracks.filter((t) => !t.isDraft && !t.isDeranked);
    if (publicTracks.length === 0) return [];

    if (chartMode === 'rising') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recent = publicTracks.filter(
        (t) => new Date(t.releaseDate || t.createdAt || 0).getTime() >= thirtyDaysAgo
      );
      const source = recent.length >= 3 ? recent : publicTracks;
      return [...source]
        .sort((a, b) => (b.plays || 0) + (b.likes || 0) * 3 - ((a.plays || 0) + (a.likes || 0) * 3))
        .slice(0, 10);
    }

    if (chartMode === 'local' && hasCountryScope) {
      const localMatches = publicTracks.filter((t) =>
        matchesLocationFilter(t.region, selectedCountry)
      );
      const source = localMatches.length >= 3 ? localMatches : publicTracks;
      return [...source].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 10);
    }

    return [...publicTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 10);
  }, [tracks, chartMode, selectedCountry, hasCountryScope]);

  if (rankedTracks.length === 0) return null;

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--lv-text)]">
            {t('top_ten_title', 'Top Charts')}
          </h2>
          <p className="text-xs text-[var(--lv-muted)]">
            {t('top_ten_sub', 'Most streamed songs right now')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="flex items-center gap-1.5 bg-[var(--lv-surface)] p-1 rounded-2xl border border-[var(--lv-border)]">
            {[
              {
                id: 'local' as const,
                label: hasCountryScope
                  ? language === 'ny'
                    ? `Zotchuka ku ${selectedCountry}`
                    : `Top in ${selectedCountry}`
                  : t('top_10', 'Top 10'),
              },
              { id: 'africa' as const, label: language === 'ny' ? 'Africa Yonse' : 'All Africa' },
              { id: 'rising' as const, label: language === 'ny' ? 'Zokwera' : 'New & Rising' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartMode(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer min-h-[36px] whitespace-nowrap ${
                  chartMode === tab.id
                    ? 'bg-[var(--lv-accent)] text-[#0A0B0A] font-bold'
                    : 'text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/charts')}
            className="px-3.5 py-2 rounded-2xl bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border border-[var(--lv-border)] text-xs font-bold text-[var(--lv-accent-text)] inline-flex items-center gap-1 transition cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <span>{language === 'ny' ? 'Tchati & Kutsatsa' : 'Charts & Share'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {rankedTracks.map((track, idx) => {
          const liveRank = idx + 1;
          const isCurrent = currentTrack?.id === track.id;
          const isCurrentPlaying = isCurrent && isPlaying;
          const rankMovement =
            typeof track.chartRank === 'number' && track.chartRank > 0
              ? track.chartRank - liveRank
              : 0;

          return (
            <div
              key={track.id}
              onClick={() => handleTrackClick(track)}
              className="group flex items-center gap-3 shrink-0 snap-start bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border border-[var(--lv-border)] hover:border-[var(--lv-border-strong)] rounded-[20px] p-3 transition-all duration-150 cursor-pointer w-[264px] sm:w-[280px]"
            >
              <div className="w-10 shrink-0 text-center">
                <div
                  className={`text-2xl font-extrabold font-mono tabular-nums ${
                    isCurrent ? 'text-[var(--lv-accent-text)]' : 'text-[var(--lv-text)]'
                  }`}
                >
                  {liveRank}
                </div>
                {rankMovement > 0 && (
                  <span className="inline-flex items-center text-[10px] font-mono font-bold text-emerald-500">
                    <ArrowUp className="w-2.5 h-2.5" />
                    {rankMovement}
                  </span>
                )}
                {rankMovement < 0 && (
                  <span className="inline-flex items-center text-[10px] font-mono font-bold text-rose-500">
                    <ArrowDown className="w-2.5 h-2.5" />
                    {Math.abs(rankMovement)}
                  </span>
                )}
              </div>

              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[var(--lv-border)] bg-[var(--lv-elevated)]">
                <LazySlideImage
                  src={track.coverArt || DEFAULT_ARTWORK_SVG}
                  alt={track.title}
                  containerClassName="w-full h-full"
                />
                <div
                  className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                    isCurrentPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--lv-accent)] text-[#0A0B0A] flex items-center justify-center">
                    {isCurrentPlaying ? (
                      <Pause className="w-4 h-4 fill-[#0A0B0A]" />
                    ) : (
                      <Play className="w-4 h-4 fill-[#0A0B0A] ml-0.5" />
                    )}
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/tracks/${track.id}`);
                  }}
                  className="text-sm font-bold text-[var(--lv-text)] hover:text-[var(--lv-accent-text)] hover:underline line-clamp-2 leading-snug text-left block w-full cursor-pointer"
                >
                  {track.title}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectArtist(track.artistId);
                  }}
                  className="text-xs text-[var(--lv-muted)] hover:text-[var(--lv-text)] truncate block mt-0.5 cursor-pointer text-left max-w-full"
                >
                  {track.artistName}
                </button>
                <span className="text-[11px] font-mono text-[var(--lv-muted)] mt-0.5 block">
                  {t('plays_count', '{count} plays', {
                    count: (track.plays || 0).toLocaleString(),
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
