import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ExternalLink,
  Flag,
  Heart,
  MapPin,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  Share2,
  Shuffle,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import {
  formatNumber,
  formatTime,
  getTrackDurationSeconds,
  getTrackLikeCount,
  isTrackLikedByUser,
} from '../../utils/formatters';
import { DEFAULT_AVATAR_SVG, DEFAULT_BANNER_SVG } from '../../utils/artworkFallback';
import { applyArtistSeoMeta, resetDefaultSeoMeta } from '../../utils/seoMeta';
import { SafeImage } from '../SafeImage';

export const ArtistPublicPageView: React.FC = () => {
  const { currentRoute, navigate } = useRouter();
  const slug = currentRoute.params.slug;

  const {
    tracks,
    artists,
    playTrack,
    currentTrack,
    isPlaying,
    togglePlayPause,
    addToQueue,
    setActiveShareTrack,
    setActiveDetailTrack,
    submitContentReportRecord,
  } = useAudio();
  const { currentUser, toggleFollowArtist, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'popular' | 'releases' | 'about'>('popular');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSending, setReportSending] = useState(false);

  const artist = artists.find(
    (a) =>
      (a.slug && a.slug.toLowerCase() === slug?.toLowerCase()) ||
      a.id.toLowerCase() === slug?.toLowerCase() ||
      (a.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-') === slug?.toLowerCase()
  );

  const artistTracks = useMemo(() => {
    if (!artist) return [];
    const artistNameLower = (artist.name || '').toLowerCase();
    return tracks
      .filter(
        (t) =>
          !t.isDraft &&
          !t.isDeranked &&
          (t.artistId === artist.id ||
            (t.artistName || '').toLowerCase() === artistNameLower)
      );
  }, [tracks, artist]);

  const popularTracks = useMemo(
    () => [...artistTracks].sort((a, b) => (b.plays || 0) - (a.plays || 0)),
    [artistTracks]
  );

  const latestReleases = useMemo(
    () =>
      [...artistTracks].sort(
        (a, b) =>
          new Date(b.releaseDate || b.createdAt || 0).getTime() -
          new Date(a.releaseDate || a.createdAt || 0).getTime()
      ),
    [artistTracks]
  );

  useEffect(() => {
    if (!artist) {
      resetDefaultSeoMeta();
      return;
    }
    applyArtistSeoMeta(artist, artistTracks.length);
  }, [artist, artistTracks.length]);

  useEffect(() => {
    return () => {
      resetDefaultSeoMeta();
    };
  }, []);

  if (!artist) {
    return (
      <div className="py-16 px-4 text-center max-w-md mx-auto space-y-5 animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
          <Music className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-[var(--text)]">Artist not found</h1>
          <p className="text-sm text-[var(--text-muted)]">
            We couldn’t find that artist profile. Explore other creators on LOWERVIBE.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/artists')}
          className="px-6 py-3 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer"
        >
          Browse artists
        </button>
      </div>
    );
  }

  const safeName = artist.name || 'Artist';
  const safeAvatar = artist.avatar || DEFAULT_AVATAR_SVG;
  const safeBanner =
    artist.banner && artist.banner !== DEFAULT_BANNER_SVG ? artist.banner : undefined;
  const isVerified = Boolean(artist.verified || artist.isVerified);
  const locationText =
    [artist.city, artist.country].filter(Boolean).join(', ') ||
    artist.location ||
    '';

  const isFollowing = Boolean(currentUser?.followingArtistIds?.includes(artist.id));
  const followersCount = Math.max(0, artist.followersCount || 0);
  const monthlyListeners = Math.max(0, artist.monthlyListeners || 0);

  const isOwner = Boolean(
    currentUser &&
      (artist.ownerUserId === currentUser.id ||
        artist.claimedByUserId === currentUser.id ||
        (currentUser.artistId === artist.id && !artist.ownerUserId && !artist.claimedByUserId))
  );

  const handlePlayPopular = () => {
    if (popularTracks.length === 0) {
      showToast('No tracks uploaded yet');
      return;
    }
    const first = popularTracks[0];
    if (currentTrack?.id === first.id) {
      togglePlayPause();
    } else {
      playTrack(first);
      popularTracks.slice(1).forEach((t) => addToQueue(t));
    }
  };

  const handleShufflePlay = () => {
    if (popularTracks.length === 0) {
      showToast('No tracks uploaded yet');
      return;
    }
    const shuffled = [...popularTracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0]);
    shuffled.slice(1).forEach((t) => addToQueue(t));
    showToast(`Playing ${safeName} on shuffle`);
  };

  const handleShareProfile = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${safeName} on LOWERVIBE`, url });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Profile link copied');
    } catch {}
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setReportSending(true);
    const res = await submitContentReportRecord({
      type: 'artist_report',
      artistId: artist.id,
      artistName: safeName,
      reason: reportReason.trim(),
    });
    setReportSending(false);
    if (res.success) {
      setReportModalOpen(false);
      setReportReason('');
      showToast('Report sent to moderation');
    } else {
      showToast(res.error || 'Could not send report');
    }
  };

  const socials = Object.entries(artist.socials || {}).filter(([, val]) => Boolean(val && val.trim()));

  return (
    <div className="space-y-6 pb-6 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/artists')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Artists</span>
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold transition cursor-pointer min-h-[40px]"
          >
            Manage in Studio
          </button>
        )}
      </div>

      {/* Artist Header */}
      <section className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        {safeBanner && (
          <div className="w-full h-36 sm:h-52 bg-[var(--surface-2)] border-b border-[var(--border)] overflow-hidden">
            <SafeImage
              src={safeBanner}
              alt={`${safeName} cover`}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-5 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-7">
          <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-2)] shrink-0">
            <SafeImage
              src={safeAvatar}
              alt={safeName}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text)] break-words">
                  {safeName}
                </h1>
              {isVerified && (
                <CheckCircle2
                  className="w-6 h-6 text-[var(--accent-text)] shrink-0"
                  aria-label="Verified artist"
                />
              )}
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap text-xs sm:text-sm text-[var(--text-muted)]">
              {locationText && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{locationText}</span>
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span className="tabular-nums">{formatNumber(monthlyListeners)} monthly listeners</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatNumber(followersCount)} followers</span>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1 relative">
            <button
              type="button"
              onClick={handlePlayPopular}
              className="px-5 h-11 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center gap-2 hover:brightness-95 transition cursor-pointer"
            >
              {currentTrack && popularTracks.some((t) => t.id === currentTrack.id) && isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleShufflePlay}
              className="px-4 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-sm font-semibold text-[var(--text)] flex items-center gap-2 transition cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle</span>
            </button>

            <button
              type="button"
              onClick={() => {
                toggleFollowArtist(artist.id);
                if (currentUser) {
                  showToast(isFollowing ? `Unfollowed ${safeName}` : `Following ${safeName}`);
                }
              }}
              className={`px-5 h-11 rounded-xl border text-sm font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer ${
                isFollowing
                  ? 'bg-[var(--surface-2)] border-[var(--accent)] text-[var(--accent-text)]'
                  : 'bg-[var(--surface-2)] border-[var(--border-strong)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]'
              }`}
            >
              {isFollowing ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{isFollowing ? 'Following' : 'Follow'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareProfile}
              aria-label="Share artist"
              className="w-11 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] flex items-center justify-center transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="More options"
                className="w-11 h-11 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] text-[var(--text)] flex items-center justify-center transition cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 z-20 w-44 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-xl p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setReportModalOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-xs font-semibold text-[var(--danger)] hover:bg-[var(--surface-2)] flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report artist</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Tabs: Popular / Releases / About */}
      <div className="flex items-center gap-2 border-b border-[var(--border)]">
        {[
          { id: 'popular' as const, label: 'Popular' },
          { id: 'releases' as const, label: `Releases (${artistTracks.length})` },
          { id: 'about' as const, label: 'About' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Popular Tracks */}
      {activeTab === 'popular' && (
        <section className="space-y-2">
          {popularTracks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
              No songs released yet.
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
              {popularTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isLiked = isTrackLikedByUser(track, currentUser);
                const likes = getTrackLikeCount(track);
                const dur = getTrackDurationSeconds(track);

                return (
                  <div
                    key={track.id}
                    onClick={() => (isCurrent ? togglePlayPause() : playTrack(track))}
                    className={`p-3.5 flex items-center gap-3.5 cursor-pointer transition ${
                      isCurrent ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]/70'
                    }`}
                  >
                    <span className="w-6 text-center text-xs font-mono text-[var(--text-muted)] tabular-nums">
                      {idx + 1}
                    </span>

                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)] shrink-0">
                      <SafeImage src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-[var(--text)] truncate">{track.title}</div>
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                        <span>{track.genre || 'Music'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatNumber(track.plays || 0)} plays</span>
                      </div>
                    </div>

                    <span className="hidden sm:inline text-xs font-mono text-[var(--text-muted)] tabular-nums">
                      {formatTime(dur)}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeTrack(track.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer ${
                        isLiked ? 'text-rose-500' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-500' : ''}`} />
                      <span className="tabular-nums">{likes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDetailTrack(track);
                      }}
                      className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] px-2 py-1 cursor-pointer"
                    >
                      Details
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Releases */}
      {activeTab === 'releases' && (
        <section>
          {latestReleases.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
              No releases yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {latestReleases.map((track) => {
                const isCurrentPlaying = currentTrack?.id === track.id && isPlaying;
                return (
                  <div
                    key={track.id}
                    onClick={() => (currentTrack?.id === track.id ? togglePlayPause() : playTrack(track))}
                    className="p-3 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer space-y-2.5 group"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                      <SafeImage src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                      <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-lg">
                        {isCurrentPlaying ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-[var(--text)] truncate">{track.title}</div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {track.releaseDate ? track.releaseDate.slice(0, 4) : 'Single'} · {track.genre}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Tab 3: About */}
      {activeTab === 'about' && (
        <section className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-5 max-w-2xl">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-[var(--text)]">Bio</h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed whitespace-pre-line">
              {artist.bio?.trim() ? artist.bio : 'This artist has not added a bio yet.'}
            </p>
          </div>

          {socials.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text)]">Links</h3>
              <div className="flex flex-wrap gap-2">
                {socials.map(([label, href]) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 capitalize"
                  >
                    <span>{label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {artist.joinedDate && (
            <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
              Joined LOWERVIBE on {new Date(artist.joinedDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          )}
        </section>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setReportModalOpen(false)}
        >
          <form
            onSubmit={handleReportSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text)]">Report {safeName}</h3>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              rows={4}
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Tell us what is wrong (impersonation, copyright, spam, or abuse)"
              className="w-full p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportSending}
                className="px-4 py-2 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {reportSending ? 'Sending...' : 'Submit report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
