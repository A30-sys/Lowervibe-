import {
  CheckCircle2,
  Heart,
  ListPlus,
  MessageSquare,
  Play,
  Share2,
} from 'lucide-react';
import React from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import { Track } from '../types';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';
import {
  formatTime,
  getTrackDurationSeconds,
  isTrackLikedByUser,
} from '../utils/formatters';
import { translateGenreCategory } from '../utils/genreCategories';

interface TrackRowProps {
  track: Track;
  index?: number;
}

export const TrackRow: React.FC<TrackRowProps> = ({ track, index }) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    setActiveShareTrack,
    setActiveDetailTrack,
    openPlaylistModal,
    artists,
    savedTrackIds,
    toggleSaveTrack,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { language, t } = useLanguage();
  const { navigate } = useRouter();
  const [isHeartAnimating, setIsHeartAnimating] = React.useState(false);

  const isNy = language === 'ny';
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = isTrackLikedByUser(track, currentUser);
  const isSaved = (savedTrackIds || []).includes(track.id);

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const artist = artists.find(
      (a) => a.id === track.artistId || a.name.toLowerCase() === track.artistName.toLowerCase()
    );
    if (artist) {
      navigate(`/artists/${artist.slug || artist.id}`);
    } else if (track.artistId) {
      navigate(`/artists/${track.artistId}`);
    }
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLiked) {
      setIsHeartAnimating(true);
      setTimeout(() => setIsHeartAnimating(false), 600);
    }
    toggleLikeTrack(track.id);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSaveTrack(track.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (isCurrent) togglePlayPause();
        else playTrack(track);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isCurrent) togglePlayPause();
          else playTrack(track);
        }
      }}
      className={`group flex items-center gap-3 p-3 rounded-2xl border transition-colors duration-200 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        isCurrent
          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/60'
          : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]'
      }`}
    >
      {/* Index or Equalizer */}
      <div className="w-6 text-center text-xs font-mono text-[var(--text-muted)] shrink-0 tabular-nums">
        {isPlayingThis ? (
          <div className="flex items-center justify-center gap-0.5 h-3" aria-label={t('playing', 'Playing')}>
            <span className="w-0.5 bg-[var(--accent-text)] rounded-full animate-eq-1" />
            <span className="w-0.5 bg-[var(--accent-text)] rounded-full animate-eq-2" />
            <span className="w-0.5 bg-[var(--accent-text)] rounded-full animate-eq-3" />
          </div>
        ) : (
          <span>{index !== undefined ? index + 1 : '•'}</span>
        )}
      </div>

      {/* Artwork with play overlay */}
      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[var(--surface-2)] border border-[var(--border)]">
        <img
          src={track.coverArt || DEFAULT_ARTWORK_SVG}
          alt={track.title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (!img.dataset.fallbackTried) {
              img.dataset.fallbackTried = '1';
              img.src = DEFAULT_ARTWORK_SVG;
            }
          }}
          className="w-full h-full object-cover"
        />
        <div
          className={`absolute inset-0 bg-black/45 flex items-center justify-center transition ${
            isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Play className="w-5 h-5 text-[var(--accent)] fill-[var(--accent)]" />
        </div>
      </div>

      {/* Track Title and Artist */}
      <div className="flex-1 min-w-0">
        <h4
          className={`text-xs sm:text-sm font-bold truncate font-heading transition-colors ${
            isCurrent
              ? 'text-[var(--accent-text)]'
              : 'text-[var(--text)] group-hover:text-[var(--accent-text)]'
          }`}
        >
          {track.title}
        </h4>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5 truncate">
          <button
            type="button"
            onClick={handleArtistClick}
            className="hover:text-[var(--text)] transition font-medium hover:underline truncate cursor-pointer text-left"
          >
            {track.artistName}
          </button>
          <span className="opacity-45 hidden sm:inline">·</span>
          <span className="text-[11px] hidden sm:inline truncate">
            {translateGenreCategory(track.genre, language)}
          </span>
        </div>
      </div>

      {/* Interactive Filter Tags */}
      {Array.isArray(track.vibeTags) && track.vibeTags.length > 0 && (
        <div className="hidden lg:flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {track.vibeTags.slice(0, 2).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => navigate(`/search?tag=${encodeURIComponent(tag)}`)}
              className="px-2.5 min-h-[32px] rounded-lg text-[11px] font-medium bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer"
              title={isNy ? `Fufuzani #${tag}` : `Explore #${tag}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Duration */}
      <div className="text-xs font-mono tabular-nums text-[var(--text-muted)] shrink-0">
        {track.metadata?.durationFormatted || formatTime(getTrackDurationSeconds(track))}
      </div>

      {/* Action Buttons (>= 44px touch targets) */}
      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleSave}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            isSaved
              ? 'text-[var(--accent-text)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
          title={isSaved ? (isNy ? 'Zasungidwa mu Nyumba' : 'Saved to Library') : (isNy ? 'Sungani mu Nyumba' : 'Save to Library')}
          aria-label={isSaved ? 'Saved to Library' : 'Save to Library'}
          aria-pressed={isSaved}
        >
          <CheckCircle2 className={`w-4 h-4 ${isSaved ? 'fill-[var(--accent)]/20' : ''}`} />
        </button>

        <button
          type="button"
          onClick={handleLike}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-all relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            isLiked ? 'text-rose-500' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
          title={isLiked ? t('unlike', 'Unlike') : t('like', 'Like')}
          aria-label={isLiked ? t('unlike', 'Unlike') : t('like', 'Like')}
          aria-pressed={isLiked}
        >
          <Heart
            className={`w-4 h-4 transition-transform duration-200 ${isLiked ? 'fill-rose-500' : ''} ${
              isHeartAnimating ? 'animate-heart-pop text-rose-500 fill-rose-500' : ''
            }`}
          />
          {isHeartAnimating && (
            <span className="absolute inset-1 rounded-full bg-rose-500/20 animate-heart-burst pointer-events-none" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveDetailTrack(track)}
          className="min-h-[44px] min-w-[44px] hidden sm:flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title={isNy ? 'Zambiri za nyimbo' : 'Track details & comments'}
          aria-label="Track details"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveShareTrack(track)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title={t('share', 'Share track')}
          aria-label={t('share', 'Share track')}
        >
          <Share2 className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => openPlaylistModal(track)}
          className="min-h-[44px] min-w-[44px] hidden md:flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-text)] rounded-xl transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          title={t('add_to_playlist', 'Add to playlist')}
          aria-label={t('add_to_playlist', 'Add to playlist')}
        >
          <ListPlus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
