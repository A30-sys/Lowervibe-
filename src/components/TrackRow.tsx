import {
  Heart,
  ListPlus,
  MessageSquare,
  Play,
  Share2,
  Volume2
} from 'lucide-react';
import React from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { Track } from '../types';
import {
  formatTime,
  getTrackDurationSeconds,
  isTrackLikedByUser,
} from '../utils/formatters';

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
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { navigate } = useRouter();
  const [isHeartAnimating, setIsHeartAnimating] = React.useState(false);
  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = isTrackLikedByUser(track, currentUser);

  const handleArtistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const artist = artists.find(a => a.id === track.artistId || a.name.toLowerCase() === track.artistName.toLowerCase());
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

  return (
    <div
      onClick={() => {
        if (isCurrent) togglePlayPause();
        else playTrack(track);
      }}
      className={`group flex items-center gap-3.5 p-3 rounded-xl border transition-colors duration-200 ease-out cursor-pointer ${
        isCurrent
          ? 'bg-amber-500/10 border-amber-400/50 shadow-md shadow-amber-500/5'
          : 'bg-zinc-950/70 border-zinc-800/80 hover:bg-zinc-900/90 hover:border-zinc-700 active:bg-zinc-800/60'
      }`}
    >
      {/* Index or Equalizer */}
      <div className="w-5 text-center text-xs font-mono text-zinc-500 shrink-0">
        {isPlayingThis ? (
          <div className="flex items-center justify-center gap-0.5 h-3">
            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-1" />
            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-2" />
            <span className="w-0.5 bg-amber-400 rounded-full animate-eq-3" />
          </div>
        ) : (
          <span>{index !== undefined ? index + 1 : '•'}</span>
        )}
      </div>

      {/* Artwork with play overlay */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 group/cover">
        <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition ${
            isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <Play className="w-5 h-5 text-amber-400 fill-amber-400" />
        </div>
      </div>

      {/* Track Title and Artist */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs sm:text-sm font-bold text-white truncate font-heading group-hover:text-amber-400 transition">
          {track.title}
        </h4>
        <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5 truncate">
          <span
            onClick={handleArtistClick}
            className="hover:text-zinc-200 transition font-medium hover:underline"
          >
            {track.artistName}
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-[11px] text-zinc-500 hidden sm:inline">{track.genre}</span>
        </div>
      </div>

      {/* Vibe Tags */}
      <div className="hidden lg:flex items-center gap-1.5">
        {track.vibeTags.slice(0, 2).map(tag => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800"
          >
            #{tag}
          </span>
        ))}
      </div>

      {/* BPM */}
      <div className="hidden md:block text-xs font-mono text-zinc-400 shrink-0">
        {track.bpm} BPM
      </div>

      {/* Duration */}
      <div className="text-xs font-mono tabular-nums text-zinc-400 shrink-0">
        {track.metadata?.durationFormatted || formatTime(getTrackDurationSeconds(track))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={handleLike}
          className={`p-2 rounded-lg transition-all relative ${
            isLiked ? 'text-rose-400' : 'text-zinc-500 hover:text-white'
          }`}
          title={isLiked ? 'Liked' : 'Like'}
        >
          <Heart
            className={`w-4 h-4 transition-transform duration-200 ${isLiked ? 'fill-rose-400' : ''} ${
              isHeartAnimating ? 'animate-heart-pop text-rose-400 fill-rose-400' : ''
            }`}
          />
          {isHeartAnimating && (
            <span className="absolute inset-0 rounded-full bg-rose-500/25 animate-heart-burst pointer-events-none" />
          )}
        </button>

        <button
          onClick={() => setActiveDetailTrack(track)}
          className="p-2 text-zinc-500 hover:text-white rounded-lg transition hidden sm:block"
          title="Liner notes & reflections"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={() => setActiveShareTrack(track)}
          className="p-2 text-zinc-500 hover:text-white rounded-lg transition"
          title="Share track"
        >
          <Share2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => openPlaylistModal(track)}
          className="p-2 text-zinc-500 hover:text-amber-400 rounded-lg transition hidden md:block"
          title="Add to playlist"
        >
          <ListPlus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
