import { Heart, Pause, Play, Share2 } from 'lucide-react';
import React, { useMemo } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { matchesLocationFilter } from '../../data/regions';
import { DEFAULT_ARTWORK_SVG } from '../../utils/artworkFallback';
import { formatTime, getTrackLikeCount, isTrackLikedByUser } from '../../utils/formatters';
import { translateGenreCategory } from '../../utils/genreCategories';
import { LazySlideImage } from '../common/LazySlideImage';

interface HeroFeaturedCardProps {
  onOpenArtist: (artistId: string) => void;
  onOpenTrackDetails: () => void;
  onSelectCategory?: (category: string) => void;
}

export const HeroFeaturedCard: React.FC<HeroFeaturedCardProps> = ({
  onOpenArtist,
  onOpenTrackDetails,
  onSelectCategory,
}) => {
  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    setActiveShareTrack,
    featuredVibe,
    selectedCountry,
  } = useAudio();
  const { currentUser, toggleLikeTrack } = useAuth();
  const { language, t } = useLanguage();
  const { showToast } = useToast();

  const { featuredTrack, spotlightLabel } = useMemo(() => {
    const playableTracks = tracks.filter((tr) => !tr.isDraft && !tr.isDeranked);
    if (playableTracks.length === 0) {
      return { featuredTrack: null, spotlightLabel: t('featured_pick', 'Featured Pick') };
    }

    const activeLocation =
      selectedCountry && selectedCountry !== 'Global'
        ? selectedCountry
        : currentUser?.country || '';

    const artistById = new Map(artists.map((a) => [a.id, a]));
    const trackMatchesLocation = (t: (typeof playableTracks)[number]) => {
      if (!activeLocation || activeLocation === 'Global') return false;
      if (matchesLocationFilter(t.region, activeLocation)) return true;
      const artist = artistById.get(t.artistId);
      if (!artist) return false;
      return (
        matchesLocationFilter(artist.country, activeLocation) ||
        matchesLocationFilter(artist.location, activeLocation)
      );
    };

    const scoreTrack = (t: (typeof playableTracks)[number]) =>
      (t.plays || 0) + getTrackLikeCount(t) * 2;

    // 1. Curated featured track matching user/artist location
    const curatedTrack = featuredVibe?.trackId
      ? playableTracks.find((t) => t.id === featuredVibe.trackId) || null
      : null;

    if (curatedTrack && (!activeLocation || activeLocation === 'Global' || trackMatchesLocation(curatedTrack))) {
      return {
        featuredTrack: curatedTrack,
        spotlightLabel: activeLocation && activeLocation !== 'Global'
          ? `${t('featured_pick', 'Featured Pick')} · ${activeLocation}`
          : t('featured_pick', 'Featured Pick'),
      };
    }

    // 2. Location-matched top pick for artist/listener location
    if (activeLocation && activeLocation !== 'Global') {
      const localMatches = playableTracks.filter(trackMatchesLocation);
      if (localMatches.length > 0) {
        const localBest = [...localMatches].sort((a, b) => scoreTrack(b) - scoreTrack(a))[0];
        return {
          featuredTrack: localBest,
          spotlightLabel: `${t('featured_pick', 'Featured Pick')} · ${activeLocation}`,
        };
      }
    }

    // 3. Fallback single spotlight across catalog: Most Trending
    const mostTrending = [...playableTracks].sort((a, b) => scoreTrack(b) - scoreTrack(a))[0];
    return {
      featuredTrack: mostTrending,
      spotlightLabel: t('trending', 'Most Trending'),
    };
  }, [tracks, artists, featuredVibe?.trackId, selectedCountry, currentUser?.country, t]);

  if (!featuredTrack) return null;

  const isCurrent = currentTrack?.id === featuredTrack.id;
  const isCurrentPlaying = isCurrent && isPlaying;
  const isLiked = isTrackLikedByUser(featuredTrack, currentUser);
  const likeCount = getTrackLikeCount(featuredTrack);

  const handlePlayHero = () => {
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(featuredTrack);
    }
  };

  const handleLike = () => {
    toggleLikeTrack(featuredTrack.id);
    showToast(
      isLiked
        ? t('removed_from_liked', 'Removed from Liked songs')
        : t('added_to_liked', 'Added to Liked songs')
    );
  };

  return (
    <section className="rounded-[28px] overflow-hidden border border-[var(--lv-border)] bg-[var(--lv-surface)] shadow-xl transition-colors duration-200">
      <div className="p-5 sm:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8">
        {/* Hero Cover Art (clean artwork only — no overlaid badges or logos) */}
        <div
          onClick={handlePlayHero}
          className="w-full sm:w-60 md:w-68 aspect-square rounded-[20px] overflow-hidden shrink-0 border border-[var(--lv-border)] bg-[var(--lv-elevated)] shadow-lg cursor-pointer group"
        >
          <LazySlideImage
            src={featuredTrack.coverArt || DEFAULT_ARTWORK_SVG}
            alt={featuredTrack.title}
            containerClassName="w-full h-full"
            className="group-hover:scale-[1.03] transition-transform duration-300"
            watermark
            watermarkCompact={false}
          />
        </div>

        {/* Metadata & Primary CTA */}
        <div className="flex-1 min-w-0 space-y-4 text-center md:text-left w-full">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--lv-violet)] block">
            {spotlightLabel}
          </span>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-4xl font-extrabold font-heading tracking-tight text-[var(--lv-text)] leading-tight line-clamp-2">
              {featuredTrack.title}
            </h1>
            <p className="text-sm sm:text-base text-[var(--lv-muted)] truncate">
              <button
                type="button"
                onClick={() => onOpenArtist(featuredTrack.artistId)}
                className="font-semibold text-[var(--lv-text)] hover:underline cursor-pointer"
              >
                {featuredTrack.artistName}
              </button>
              {featuredTrack.genre && (
                <>
                  <span> · </span>
                  <button
                    type="button"
                    onClick={() => onSelectCategory?.(featuredTrack.genre)}
                    className="hover:text-[var(--lv-text)] cursor-pointer"
                  >
                    {translateGenreCategory(featuredTrack.genre, language)}
                  </button>
                </>
              )}
              {featuredTrack.region && <span> · {featuredTrack.region}</span>}
            </p>
          </div>

          {/* Monospace Track Metadata */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs font-mono text-[var(--lv-muted)]">
            <span>
              {t('plays_count', '{count} plays', {
                count: (featuredTrack.plays || 0).toLocaleString(),
              })}
            </span>
            <span>·</span>
            <span>{formatTime(featuredTrack.durationSeconds)}</span>
            {featuredTrack.bpm > 0 && (
              <>
                <span>·</span>
                <span>{featuredTrack.bpm} BPM</span>
              </>
            )}
          </div>

          {/* Primary Action Row */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
            <button
              type="button"
              onClick={handlePlayHero}
              className="px-6 py-3 rounded-2xl bg-[var(--lv-accent)] text-[#0A0B0A] font-bold text-sm hover:brightness-95 active:scale-95 transition flex items-center gap-2 cursor-pointer min-h-[48px] shadow-md"
            >
              {isCurrentPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-[#0A0B0A]" />
                  <span>{t('pause', 'Pause')}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-[#0A0B0A]" />
                  <span>{t('play_now', 'Play now')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleLike}
              className={`px-4 rounded-2xl border transition active:scale-95 min-h-[48px] flex items-center justify-center gap-2 cursor-pointer text-xs font-mono font-bold ${
                isLiked
                  ? 'bg-rose-500/15 border-rose-500/35 text-rose-500'
                  : 'bg-[var(--lv-elevated)] border-[var(--lv-border)] text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
              }`}
              aria-label={isLiked ? t('unlike', 'Unlike') : t('like', 'Like')}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
              <span>{likeCount}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveShareTrack(featuredTrack)}
              className="p-3 rounded-2xl bg-[var(--lv-elevated)] hover:opacity-90 border border-[var(--lv-border)] text-[var(--lv-muted)] hover:text-[var(--lv-text)] transition active:scale-95 min-h-[48px] min-w-[48px] flex items-center justify-center cursor-pointer"
              title={t('share', 'Share')}
              aria-label={t('share', 'Share')}
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenTrackDetails}
              className="px-4 rounded-2xl bg-[var(--lv-elevated)] hover:opacity-90 border border-[var(--lv-border)] text-[var(--lv-text)] text-xs font-semibold transition active:scale-95 min-h-[48px] cursor-pointer"
            >
              {t('track_details', 'Details')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
