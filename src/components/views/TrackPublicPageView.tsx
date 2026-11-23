import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  Download,
  Edit3,
  FolderHeart,
  Heart,
  Loader2,
  Moon,
  Music,
  Pause,
  Play,
  Send,
  Share2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../services/firebase';
import { Track } from '../../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import {
  formatTime,
  getTrackDurationSeconds,
  getTrackLikeCount,
  isTrackLikedByUser,
} from '../../utils/formatters';
import { applyTrackSeoMeta, resetDefaultSeoMeta } from '../../utils/seoMeta';
import { SafeImage } from '../SafeImage';

export const TrackPublicPageView: React.FC = () => {
  const { currentRoute, navigate } = useRouter();
  const trackId = currentRoute.params.id;

  const {
    tracks,
    artists,
    isCatalogLoaded,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    seekTo,
    currentTime,
    duration,
    downloadTrack,
    savedTrackIds,
    toggleSaveTrack,
    addCommentToTrack,
    setActiveDetailTrack,
    setActiveShareTrack,
  } = useAudio();

  const { currentUser, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();

  const [commentText, setCommentText] = useState('');
  const [audioError, setAudioError] = useState(false);
  const [fetchedTrack, setFetchedTrack] = useState<Track | null>(null);
  const [isResolvingTrack, setIsResolvingTrack] = useState(false);

  const contextTrack =
    tracks.find((t) => t.id === trackId && !t.isDraft && !t.isDeranked) ||
    tracks.find((t) => t.id === trackId);
  const track = contextTrack || (fetchedTrack?.id === trackId ? fetchedTrack : undefined);
  const artistForTrack = track ? artists.find((a) => a.id === track.artistId) : undefined;

  useEffect(() => {
    let active = true;
    if (!trackId || contextTrack) {
      setIsResolvingTrack(false);
      return;
    }
    setIsResolvingTrack(true);
    getDoc(doc(db, 'tracks', trackId))
      .then((snap) => {
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data() as Omit<Track, 'id'>;
          if (!data.isDraft && !data.isDeranked) {
            setFetchedTrack({ ...data, id: snap.id });
          } else {
            setFetchedTrack(null);
          }
        } else {
          setFetchedTrack(null);
        }
      })
      .catch(() => {
        if (active) setFetchedTrack(null);
      })
      .finally(() => {
        if (active) setIsResolvingTrack(false);
      });
    return () => {
      active = false;
    };
  }, [trackId, contextTrack]);

  useEffect(() => {
    if (!track) {
      if (isCatalogLoaded && !isResolvingTrack) {
        resetDefaultSeoMeta();
      }
      return;
    }
    applyTrackSeoMeta(track, artistForTrack);
  }, [track, artistForTrack, isCatalogLoaded, isResolvingTrack]);

  useEffect(() => {
    return () => {
      resetDefaultSeoMeta();
    };
  }, []);

  if (!track && (!isCatalogLoaded || isResolvingTrack)) {
    return (
      <div className="py-20 px-4 text-center max-w-md mx-auto space-y-4 animate-fadeIn">
        <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--accent-text)] flex items-center justify-center mx-auto">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-xs font-semibold text-[var(--text-muted)]">Loading song...</p>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="py-16 px-4 text-center max-w-lg mx-auto space-y-5 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-[var(--accent-text)] flex items-center justify-center mx-auto">
          <Music className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold font-heading text-[var(--text)]">Song not found</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            This song may have been removed or moved.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-6 py-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const isCurrent = currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && isPlaying;
  const isLiked = isTrackLikedByUser(track, currentUser);
  const likeCount = getTrackLikeCount(track);
  const isSaved = (savedTrackIds || []).includes(track.id);
  const trackMetaDuration = getTrackDurationSeconds(track);
  const activeDuration = isCurrent && duration > 0 ? duration : trackMetaDuration;
  const activeProgress = isCurrent && activeDuration > 0 ? (currentTime / activeDuration) * 100 : 0;
  const canEditMetadata = Boolean(
    currentUser &&
      (track.uploadedByUserId
        ? track.uploadedByUserId === currentUser.id
        : Boolean(
            artistForTrack &&
              (artistForTrack.ownerId
                ? artistForTrack.ownerId === currentUser.id
                : artistForTrack.ownerUserId === currentUser.id ||
                  artistForTrack.claimedByUserId === currentUser.id ||
                  (!artistForTrack.ownerUserId &&
                    !artistForTrack.claimedByUserId &&
                    currentUser.artistId === artistForTrack.id))
          ))
  );

  const handlePlayToggle = () => {
    try {
      if (isCurrent) {
        togglePlayPause();
      } else {
        playTrack(track);
      }
      setAudioError(false);
    } catch {
      setAudioError(true);
    }
  };

  const handleShare = () => {
    setActiveShareTrack(track);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    addCommentToTrack(track.id, {
      userId: currentUser?.id || 'guest',
      userName: currentUser?.name || 'Listener',
      userAvatar: currentUser?.avatar || DEFAULT_AVATAR_SVG,
      timestampSeconds: isCurrent ? Math.floor(currentTime) : 0,
      content: commentText.trim(),
    });

    setCommentText('');
    showToast('Comment posted');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-8 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {audioError && (
        <div className="p-4 rounded-2xl bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--text)] flex items-center justify-between gap-3">
          <div className="text-xs">
            <span className="font-bold text-[var(--danger)]">Playback error</span>
            <p className="text-[var(--text-muted)] mt-0.5">Could not play audio. Please try again.</p>
          </div>
          <button
            type="button"
            onClick={handlePlayToggle}
            className="px-4 py-2 rounded-xl bg-[var(--danger)] text-white font-bold text-xs cursor-pointer shrink-0"
          >
            Try again
          </button>
        </div>
      )}

      {/* Main Song Card */}
      <div className="p-6 sm:p-8 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-start shadow-sm">
        <div className="relative w-56 h-56 sm:w-68 sm:h-68 rounded-[24px] overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface-2)]">
          <SafeImage
            src={track.coverArt || DEFAULT_ARTWORK_SVG}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="space-y-4 flex-1 w-full text-center md:text-left">
          <div className="space-y-1">
            <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
              <span className="text-xs font-semibold text-[var(--accent-text)]">{track.genre}</span>
              {track.mood && (
                <span className="text-xs text-[var(--text-muted)]">· {track.mood}</span>
              )}
              {track.region && (
                <span className="text-xs text-[var(--text-muted)]">· {track.region}</span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold font-heading text-[var(--text)] tracking-tight">
              {track.title}
            </h1>

            <button
              type="button"
              onClick={() => navigate(`/artists/${track.artistId}`)}
              className="text-sm sm:text-base font-bold text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
            >
              {track.artistName}
            </button>
          </div>

          {track.story && (
            <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed max-w-xl">
              {track.story}
            </p>
          )}

          {/* Seekable Progress Bar */}
          <div className="space-y-1.5 pt-2">
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, clickX / rect.width));
                seekTo(pct * activeDuration);
              }}
              className="relative h-10 w-full flex items-end justify-between gap-1 p-2 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)] cursor-pointer group"
            >
              {(track.waveformData || Array.from({ length: 48 }, () => 0.45)).map((peak, idx) => {
                const barPct = (idx / 48) * 100;
                const isPast = isCurrent ? barPct <= activeProgress : false;
                return (
                  <div
                    key={idx}
                    className={`flex-1 rounded-full transition-all ${
                      isPast ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'
                    }`}
                    style={{ height: `${Math.max(15, peak * 100)}%` }}
                  />
                );
              })}
            </div>

            <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)] px-1">
              <span>{isCurrent ? formatTime(currentTime) : '0:00'}</span>
              <span>{formatTime(activeDuration)}</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap pt-1">
            <button
              type="button"
              onClick={handlePlayToggle}
              className="px-6 py-3 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs flex items-center gap-2 hover:brightness-95 active:scale-95 transition cursor-pointer min-h-[48px]"
            >
              {isPlayingThis ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              <span>{isPlayingThis ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toggleSaveTrack(track.id);
                showToast(isSaved ? `Removed "${track.title}" from Library` : `Saved "${track.title}" to Library`);
              }}
              className={`p-3 rounded-2xl border transition cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center ${
                isSaved
                  ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent-text)]'
                  : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]'
              }`}
              title="Save to Library"
            >
              <FolderHeart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => {
                toggleLikeTrack(track.id);
                showToast(isLiked ? 'Removed from Liked songs' : 'Added to Liked songs');
              }}
              className={`px-3.5 py-3 rounded-2xl border transition cursor-pointer min-h-[48px] flex items-center justify-center gap-1.5 ${
                isLiked
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                  : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]'
              }`}
            >
              <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
              <span className="font-mono text-xs font-bold tabular-nums">{likeCount}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                downloadTrack(track);
                showToast(`Saving "${track.title}" offline`);
              }}
              className="p-3 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              title="Download offline"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="p-3 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition cursor-pointer min-h-[48px] min-w-[48px] flex items-center justify-center"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveDetailTrack(track)}
              className="px-4 py-3 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold min-h-[48px]"
            >
              {canEditMetadata ? (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>Edit &amp; Details</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[var(--violet)]" />
                  <span>Details &amp; Timer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Song Info */}
      <div className="p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Song info</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] block">Duration</span>
            <span className="font-mono font-bold text-[var(--text)]">{formatTime(activeDuration)}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] block">Plays</span>
            <span className="font-mono font-bold text-[var(--text)]">{track.plays.toLocaleString()}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] block">Release date</span>
            <span className="font-mono font-bold text-[var(--text)]">{track.releaseDate || 'N/A'}</span>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
            <span className="text-[11px] text-[var(--text-muted)] block">ISRC</span>
            <span className="font-mono font-bold text-[var(--text)]">{track.isrcCode || 'Not set'}</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
        <h3 className="text-base font-bold font-heading text-[var(--text)]">
          Comments ({(track.comments || []).length})
        </h3>

        <div className="space-y-3">
          {(track.comments || []).length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No comments yet. Share what you think below.
            </div>
          ) : (
            track.comments.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={c.userAvatar || DEFAULT_AVATAR_SVG}
                      alt={c.userName}
                      referrerPolicy="no-referrer"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="font-bold text-[var(--text)]">{c.userName}</span>
                  </div>
                  {c.timestampSeconds > 0 && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--surface)] text-[var(--accent-text)] font-bold">
                      {formatTime(c.timestampSeconds)}
                    </span>
                  )}
                </div>
                <p className="text-[var(--text-muted)] pt-1">{c.content}</p>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleCommentSubmit} className="pt-2 flex items-center gap-2 border-t border-[var(--border)]">
          <input
            type="text"
            required
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-strong)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)]"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post</span>
          </button>
        </form>
      </div>
    </div>
  );
};
