import { ArrowRight, Disc3 } from 'lucide-react';
import React, { useMemo } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { matchesLocationFilter } from '../../data/regions';
import { normalizeGenreCategory, translateGenreCategory } from '../../utils/genreCategories';

interface VibeTrendsShelfProps {
  onFilterVibe: (category: string) => void;
}

export const VibeTrendsShelf: React.FC<VibeTrendsShelfProps> = ({ onFilterVibe }) => {
  const { tracks, selectedCountry } = useAudio();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();

  const hasCountryScope = Boolean(
    selectedCountry && selectedCountry !== 'Global' && selectedCountry !== 'Africa'
  );

  const genres = useMemo(() => {
    const publicTracks = tracks.filter((tr) => !tr.isDraft && !tr.isDeranked && Boolean(tr.genre));
    if (publicTracks.length === 0) return [];

    const byGenre = new Map<
      string,
      { name: string; count: number; totalPlays: number; localScore: number }
    >();

    for (const track of publicTracks) {
      const name = normalizeGenreCategory(track.genre);
      if (!name || name === 'Other') continue;
      const existing = byGenre.get(name) || { name, count: 0, totalPlays: 0, localScore: 0 };
      const plays = track.plays || 0;
      const isLocal = hasCountryScope && matchesLocationFilter(track.region, selectedCountry);
      existing.count += 1;
      existing.totalPlays += plays;
      existing.localScore += plays + (isLocal ? 100 + plays : 0) + 1;
      byGenre.set(name, existing);
    }

    return Array.from(byGenre.values())
      .sort((a, b) => b.localScore - a.localScore || b.totalPlays - a.totalPlays)
      .slice(0, 8);
  }, [tracks, selectedCountry, hasCountryScope]);

  if (genres.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold font-heading text-[var(--lv-text)]">
            {t('vibe_frequencies', 'Browse by Genre')}
          </h2>
          <p className="text-xs text-[var(--lv-muted)]">
            {hasCountryScope
              ? t('trending_in_country', 'Trending in {country}', { country: selectedCountry })
              : t('vibe_subheading', 'Explore sounds across Malawi, Nigeria, and Africa')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/charts?tab=genres')}
          className="px-3.5 py-2 rounded-2xl bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border border-[var(--lv-border)] text-xs font-bold text-[var(--lv-accent-text)] inline-flex items-center gap-1 transition cursor-pointer min-h-[40px] whitespace-nowrap"
        >
          <span>{language === 'ny' ? 'Mitundu Yotchuka' : 'Trending Charts'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {genres.map((genre) => (
          <button
            key={genre.name}
            type="button"
            onClick={() => onFilterVibe(genre.name)}
            className="text-left p-4 rounded-[20px] bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border border-[var(--lv-border)] hover:border-[var(--lv-border-strong)] transition-all duration-150 active:scale-[0.98] cursor-pointer space-y-2 min-h-[88px]"
          >
            <div className="flex items-center justify-between gap-2">
              <Disc3 className="w-4 h-4 text-[var(--lv-violet)] shrink-0" />
              <span className="text-[11px] font-mono text-[var(--lv-muted)]">
                {genre.count}{' '}
                {genre.count === 1
                  ? t('song_singular', 'song')
                  : t('song_plural', 'songs')}
              </span>
            </div>
            <div className="font-bold text-sm text-[var(--lv-text)] line-clamp-1">
              {translateGenreCategory(genre.name, language)}
            </div>
            <div className="text-[11px] font-mono text-[var(--lv-muted)]">
              {t('plays_count', '{count} plays', {
                count: genre.totalPlays.toLocaleString(),
              })}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
