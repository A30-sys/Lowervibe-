import { Pause, Play } from 'lucide-react';
import React from 'react';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { formatTime } from '../../utils/formatters';
import { translateGenreCategory } from '../../utils/genreCategories';
import { LazySlideImage } from '../common/LazySlideImage';
import { ShelfSkeleton } from '../common/LoadingSkeleton';

interface NewReleasesShelfProps {
  onSelectArtist: (artistId: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const NewReleasesShelf: React.FC<NewReleasesShelfProps> = ({ onSelectArtist }) => {
  const { tracks, isCatalogLoaded, currentTrack, isPlaying, playTrack, togglePlayPause } =
    useAudio();
  const { language, t } = useLanguage();

  const newReleases = [...tracks]
    .filter((t) => !t.isDraft && !t.isDeranked)
    .sort(
      (a, b) =>
        new Date(b.releaseDate || b.createdAt || 0).getTime() -
        new Date(a.releaseDate || a.createdAt || 0).getTime()
    )
    .slice(0, 10);

  if (!isCatalogLoaded && tracks.length === 0) {
    return <ShelfSkeleton count={4} />;
  }

  // Hide shelf if fewer than 3 items exist
  if (newReleases.length < 3) return null;

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--lv-text)]">
          {t('new_releases_title', 'New Releases')}
        </h2>
        <p className="text-xs text-[var(--lv-muted)]">
          {t('new_releases_sub', 'Fresh songs just added to LOWERVIBE')}
        </p>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {newReleases.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          const isCurrentPlaying = isCurrent && isPlaying;

          return (
            <div
              key={track.id}
              onClick={() => handleTrackClick(track)}
              className="group shrink-0 snap-start w-[152px] sm:w-[172px] p-2.5 rounded-[20px] bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border border-[var(--lv-border)] hover:border-[var(--lv-border-strong)] transition-all duration-150 cursor-pointer space-y-2.5"
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-[var(--lv-elevated)] border border-[var(--lv-border)]">
                <LazySlideImage
                  src={track.coverArt || DEFAULT_ARTWORK_SVG}
                  alt={track.title}
                  containerClassName="w-full h-full"
                  className="group-hover:scale-105 transition-transform duration-300"
                />

                <div
                  className={`absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--lv-accent)] text-[#0A0B0A] flex items-center justify-center shadow-lg transition-all duration-150 ${
                    isCurrentPlaying
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                  }`}
                >
                  {isCurrentPlaying ? (
                    <Pause className="w-4 h-4 fill-[#0A0B0A]" />
                  ) : (
                    <Play className="w-4 h-4 fill-[#0A0B0A] ml-0.5" />
                  )}
                </div>
              </div>

              <div className="space-y-0.5 px-0.5">
                <h3 className="text-xs sm:text-sm font-bold text-[var(--lv-text)] line-clamp-2 leading-snug">
                  {track.title}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectArtist(track.artistId);
                  }}
                  className="text-xs text-[var(--lv-muted)] hover:text-[var(--lv-text)] truncate block text-left max-w-full cursor-pointer"
                >
                  {track.artistName}
                </button>
                <span className="text-[11px] font-mono text-[var(--lv-muted)] block truncate">
                  {translateGenreCategory(track.genre, language)} · {formatTime(track.durationSeconds)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
