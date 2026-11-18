import { Heart, ListPlus, Pause, Play, Share2 } from 'lucide-react';
import React from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Track } from '../types';
import { DEFAULT_ARTWORK_SVG } from '../utils/artworkFallback';
import {
  formatNumber,
  formatTime,
  getTrackLikeCount,
  isTrackLikedByUser,
} from '../utils/formatters';

interface TrackCardProps {
  track: Track;
  onSelectArtist?: (artistId: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({ track, onSelectArtist }) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    setActiveShareTrack,
    setActiveDetailTrack,
    openPlaylistModal,
    artists,
    setSelectedArtistModal,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = isTrackLikedByUser(track, currentUser);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrent) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelectArtist) {
      onSelectArtist(track.artistId);
      return;
    }
    const artist = artists.find(
      (a) =>
        a.id === track.artistId || a.name.toLowerCase() === track.artistName.toLowerCase()
    );
    if (artist) {
      setSelectedArtistModal(artist);
    }
  };

  return (
    <div
      onClick={handlePlayClick}
      className="group relative rounded-[20px] bg-[var(--lv-surface)] hover:bg-[var(--lv-elevated)] border border-[var(--lv-border)] hover:border-[var(--lv-border-strong)] p-3 transition-all duration-150 flex flex-col justify-between cursor-pointer"
    >
      {/* Square Cover Artwork */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden mb-3 bg-[var(--lv-elevated)] border border-[var(--lv-border)]">
        <img
          src={track.coverArt || DEFAULT_ARTWORK_SVG}
          alt={track.title}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
          }}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        <button
          type="button"
          onClick={handlePlayClick}
          className={`absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-150 shadow-lg cursor-pointer ${
            isPlayingThis
              ? 'bg-[var(--lv-accent)] text-[#0A0B0A] opacity-100 scale-100'
              : 'bg-[var(--lv-accent)] text-[#0A0B0A] opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
          }`}
          aria-label={isPlayingThis ? 'Pause' : 'Play'}
        >
          {isPlayingThis ? (
            <Pause className="w-4 h-4 fill-[#0A0B0A]" />
          ) : (
            <Play className="w-4 h-4 fill-[#0A0B0A] ml-0.5" />
          )}
        </button>
      </div>

      {/* Track Title & Metadata */}
      <div className="space-y-1">
        <h4
          onClick={(e) => {
            e.stopPropagation();
            setActiveDetailTrack(track);
          }}
          className="text-sm font-bold text-[var(--lv-text)] line-clamp-2 leading-snug hover:underline font-heading"
          title={track.title}
        >
          {track.title}
        </h4>

        <button
          type="button"
          onClick={handleArtistClick}
          className="text-xs text-[var(--lv-muted)] hover:text-[var(--lv-text)] truncate transition font-medium text-left block max-w-full cursor-pointer"
        >
          {track.artistName}
        </button>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--lv-muted)]">
          <span>{formatNumber(track.plays)} plays</span>
          <span>·</span>
          <span>{formatTime(track.durationSeconds)}</span>
        </div>
      </div>

      {/* Footer Actions */}
      <div
        className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[var(--lv-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            toggleLikeTrack(track.id);
            showToast(isLiked ? 'Removed from Liked songs' : 'Added to Liked songs');
          }}
          className={`flex items-center gap-1 text-xs min-h-[40px] px-1.5 cursor-pointer ${
            isLiked ? 'text-rose-500' : 'text-[var(--lv-muted)] hover:text-[var(--lv-text)]'
          }`}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
          <span className="text-[11px] font-mono tabular-nums">{getTrackLikeCount(track)}</span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => openPlaylistModal(track)}
            className="p-2 text-[var(--lv-muted)] hover:text-[var(--lv-text)] transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Add to playlist"
            aria-label="Add to playlist"
          >
            <ListPlus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveShareTrack(track)}
            className="p-2 text-[var(--lv-muted)] hover:text-[var(--lv-text)] transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Share track"
            aria-label="Share track"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
