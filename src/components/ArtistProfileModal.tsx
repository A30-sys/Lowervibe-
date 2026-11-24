import {
  Check,
  CheckCircle2,
  Edit3,
  Heart,
  MapPin,
  Music,
  Pause,
  Play,
  Share2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { Artist } from '../types';
import { DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import { formatNumber, formatTime, getTrackDurationSeconds, getTrackLikeCount, isTrackLikedByUser } from '../utils/formatters';
import { translateGenreCategory } from '../utils/genreCategories';

interface ArtistProfileModalProps {
  artist: Artist | null;
  onClose: () => void;
}

export const ArtistProfileModal: React.FC<ArtistProfileModalProps> = ({ artist, onClose }) => {
  const {
    tracks,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    updateArtistProfile,
  } = useAudio();
  const { currentUser, toggleFollowArtist, toggleLikeTrack } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: artist?.name || '',
    bio: artist?.bio || '',
    location: artist?.location || '',
  });

  useEffect(() => {
    if (artist) {
      setProfileForm({
        name: artist.name || '',
        bio: artist.bio || '',
        location: artist.location || '',
      });
      setIsEditingProfile(false);
    }
  }, [artist]);

  if (!artist) return null;

  const safeName = artist.name || 'Artist';
  const safeAvatar = artist.avatar || DEFAULT_AVATAR_SVG;
  const isVerified = Boolean(artist.verified || artist.isVerified);
  const isFollowing = Boolean(currentUser?.followingArtistIds?.includes(artist.id));
  const artistTracks = tracks.filter(
    (t) =>
      !t.isDraft &&
      (t.artistId === artist.id || (t.artistName || '').toLowerCase() === safeName.toLowerCase())
  );

  const isOwner = Boolean(
    currentUser &&
      (artist.ownerId
        ? artist.ownerId === currentUser.id
        : artist.ownerUserId === currentUser.id ||
          artist.claimedByUserId === currentUser.id ||
          (currentUser.artistId === artist.id && !artist.ownerUserId && !artist.claimedByUserId))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[var(--surface)] border border-[var(--border-strong)] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={safeAvatar}
              alt={safeName}
              referrerPolicy="no-referrer"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-[var(--border)] bg-[var(--surface-2)] shrink-0"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-[var(--text)] truncate">{safeName}</h2>
                {isVerified && <CheckCircle2 className="w-5 h-5 text-[var(--accent-text)] shrink-0" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                {artist.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{artist.location}</span>
                  </span>
                )}
                <span>·</span>
                <span className="tabular-nums">
                  {formatNumber(artist.monthlyListeners || 0)} {isNy ? 'omvera pamwezi' : 'monthly listeners'}
                </span>
                <span>·</span>
                <span className="tabular-nums">
                  {formatNumber(artist.followersCount || 0)} {isNy ? 'otsatira' : 'followers'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('close', 'Close')}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Strip */}
        <div className="px-5 sm:px-6 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]/50 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              toggleFollowArtist(artist.id);
              showToast(
                isFollowing
                  ? isNy
                    ? `Mwasiya kutsatira ${safeName}`
                    : `Unfollowed ${safeName}`
                  : isNy
                  ? `Mukutsatira ${safeName}`
                  : `Following ${safeName}`
              );
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
              isFollowing
                ? 'bg-[var(--surface)] border border-[var(--accent)] text-[var(--accent-text)]'
                : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
            }`}
          >
            {isFollowing ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            <span>{isFollowing ? t('following', 'Following') : t('follow', 'Follow')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigate(`/artists/${artist.slug || artist.id}`);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:border-[var(--border-strong)] cursor-pointer"
          >
            {isNy ? 'Tsegulani tsamba la woimba' : 'Open artist page'}
          </button>

          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/artists/${artist.slug || artist.id}`;
              await navigator.clipboard.writeText(url).catch(() => {});
              showToast(t('link_copied', 'Artist link copied'));
            }}
            className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('share', 'Share')}</span>
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setIsEditingProfile((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isNy ? 'Konzani' : 'Edit'}</span>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {isEditingProfile && isOwner && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setProfileSaveError(null);
                if (!profileForm.name.trim()) {
                  setProfileSaveError(
                    isNy ? 'Dzina la woimba silingakhale lopanda kanthu.' : 'Artist display name cannot be empty.'
                  );
                  return;
                }
                setIsSavingProfile(true);
                const res = await updateArtistProfile(artist.id, {
                  name: profileForm.name.trim(),
                  bio: profileForm.bio.trim(),
                  location: profileForm.location.trim(),
                });
                setIsSavingProfile(false);
                if (!res.success) {
                  const errText =
                    res.error || (isNy ? 'Sitinathe kukonza mbiri ya woimba.' : 'Could not update artist profile.');
                  setProfileSaveError(errText);
                  showToast(errText);
                  return;
                }
                setIsEditingProfile(false);
                showToast(isNy ? 'Mbiri ya woimba yakonzedwa' : 'Artist profile updated');
              }}
              className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3"
            >
              {profileSaveError && (
                <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--danger)] text-xs text-[var(--danger)] font-medium">
                  {profileSaveError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  {isNy ? 'Dzina lowonekera' : 'Display name'}
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  {isNy ? 'Mzinda / Dziko' : 'City / country'}
                </label>
                <input
                  type="text"
                  value={profileForm.location}
                  onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                  {isNy ? 'Mbiri ya Woimba' : 'Bio'}
                </label>
                <textarea
                  rows={3}
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setProfileSaveError(null);
                    setIsEditingProfile(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-semibold cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-60"
                >
                  {isSavingProfile ? t('saving', 'Saving...') : t('save', 'Save')}
                </button>
              </div>
            </form>
          )}

          {artist.bio && (
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t('artist_about', 'About')}
              </h3>
              <p className="text-sm text-[var(--text)] leading-relaxed">{artist.bio}</p>
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" />
              <span>
                {isNy ? 'Nyimbo' : 'Tracks'} ({artistTracks.length})
              </span>
            </h3>

            {artistTracks.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-4">
                {isNy ? 'Palibe nyimbo zotulutsidwa pakadali pano.' : 'No songs released yet.'}
              </p>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                {artistTracks.map((tr) => {
                  const isCurrent = currentTrack?.id === tr.id;
                  const isCurrentPlaying = isCurrent && isPlaying;
                  const liked = isTrackLikedByUser(tr, currentUser);
                  return (
                    <div
                      key={tr.id}
                      onClick={() => (isCurrent ? togglePlayPause() : playTrack(tr))}
                      className="p-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition cursor-pointer"
                    >
                      <img
                        src={tr.coverArt}
                        alt={tr.title}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-[var(--text)] truncate">{tr.title}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {translateGenreCategory(tr.genre, language)} · {formatTime(getTrackDurationSeconds(tr))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLikeTrack(tr.id);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer ${
                          liked ? 'text-rose-500' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-500' : ''}`} />
                        <span>{getTrackLikeCount(tr)}</span>
                      </button>
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0">
                        {isCurrentPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
