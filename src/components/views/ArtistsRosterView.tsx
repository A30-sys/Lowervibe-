import { CheckCircle2, Heart, Search, Share2, ShieldCheck, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { Artist, Track } from '../../types';
import { DEFAULT_AVATAR_SVG } from '../../utils/artworkFallback';
import { formatNumber } from '../../utils/formatters';
import { normalizeGenreCategory, translateGenreCategory } from '../../utils/genreCategories';
import { artistMatchesTag, extractArtistTags, normalizeTagLabel } from '../../utils/tags';
import { SafeImage } from '../SafeImage';

export const ArtistsRosterView: React.FC = () => {
  const { artists, tracks, setActiveShareArtist } = useAudio();
  const { currentUser, toggleFollowArtist, toggleLikeArtist } = useAuth();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const publicTracks = useMemo(
    () => tracks.filter((tr) => !tr.isDraft && !tr.isDeranked),
    [tracks]
  );

  // Pre-compute song counts, track lists, and real plays per artist in O(T)
  const { trackCountById, trackCountByName, totalPlaysById, tracksByArtistId } = useMemo(() => {
    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    const playsById = new Map<string, number>();
    const tracksMap = new Map<string, Track[]>();

    for (const tr of publicTracks) {
      if (tr.artistId) {
        byId.set(tr.artistId, (byId.get(tr.artistId) || 0) + 1);
        playsById.set(tr.artistId, (playsById.get(tr.artistId) || 0) + (tr.plays || 0));
        const list = tracksMap.get(tr.artistId) || [];
        list.push(tr);
        tracksMap.set(tr.artistId, list);
      }
      const lowerName = (tr.artistName || '').trim().toLowerCase();
      if (lowerName) {
        byName.set(lowerName, (byName.get(lowerName) || 0) + 1);
      }
    }
    return {
      trackCountById: byId,
      trackCountByName: byName,
      totalPlaysById: playsById,
      tracksByArtistId: tracksMap,
    };
  }, [publicTracks]);

  const genres = useMemo(() => {
    const tagScore = new Map<string, { label: string; score: number }>();
    const pushTag = (raw: string | undefined, weight: number) => {
      const label = normalizeTagLabel(raw);
      if (!label || label.toLowerCase() === 'other') return;
      const key = label.toLowerCase();
      const prev = tagScore.get(key) || { label, score: 0 };
      prev.score += weight;
      tagScore.set(key, prev);
    };

    for (const a of artists) {
      (a.genres || []).forEach((g) => pushTag(normalizeGenreCategory(g), 10));
    }
    for (const tr of publicTracks) {
      if (tr.genre) pushTag(normalizeGenreCategory(tr.genre), 12);
      if (tr.mood) pushTag(tr.mood, 6);
      if (Array.isArray(tr.vibeTags)) {
        tr.vibeTags.forEach((v) => pushTag(v, 5));
      }
    }

    const sorted = Array.from(tagScore.values())
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 12)
      .map((entry) => entry.label);

    return ['all', ...sorted];
  }, [artists, publicTracks]);

  const filteredArtists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return artists
      .filter((artist) => {
        const isArtistVerified = Boolean(artist.verified || artist.isVerified);
        if (verifiedOnly && !isArtistVerified) return false;
        const artistTracks = tracksByArtistId.get(artist.id) || [];
        const matchesSearch =
          !q ||
          (artist.name || '').toLowerCase().includes(q) ||
          (artist.location || artist.country || '').toLowerCase().includes(q) ||
          (artist.bio || '').toLowerCase().includes(q) ||
          (artist.genres || []).some((g) => g.toLowerCase().includes(q)) ||
          artistTracks.some((tr) =>
            [tr.title, tr.genre, tr.mood, ...(tr.vibeTags || [])]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          );
        const matchesGenre =
          selectedGenre === 'all' || artistMatchesTag(artist, artistTracks, selectedGenre);
        return matchesSearch && matchesGenre;
      })
      .sort((a, b) => {
        const aVerified = a.verified || a.isVerified ? 1 : 0;
        const bVerified = b.verified || b.isVerified ? 1 : 0;
        if (aVerified !== bVerified) return bVerified - aVerified;
        const aScore =
          (totalPlaysById.get(a.id) || 0) +
          (a.followersCount || 0) * 5 +
          (trackCountById.get(a.id) || 0) * 10;
        const bScore =
          (totalPlaysById.get(b.id) || 0) +
          (b.followersCount || 0) * 5 +
          (trackCountById.get(b.id) || 0) * 10;
        return bScore - aScore;
      });
  }, [artists, searchQuery, selectedGenre, verifiedOnly, totalPlaysById, trackCountById, tracksByArtistId]);

  const verifiedCount = useMemo(
    () => artists.filter((a) => Boolean(a.verified || a.isVerified)).length,
    [artists]
  );

  const handleShare = (artist: Artist, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveShareArtist(artist);
  };

  const handleFollow = (artistId: string, artistName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFollowArtist(artistId);
    const isNowFollowing = !currentUser?.followingArtistIds.includes(artistId);
    showToast(
      isNowFollowing
        ? isNy
          ? `Mukutsatira ${artistName}`
          : `Following ${artistName}`
        : isNy
        ? `Mwasiya kutsatira ${artistName}`
        : `Unfollowed ${artistName}`
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-8">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-[28px] bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-2 flex-wrap">
            <span>
              {isNy
                ? `Oimba ${artists.length}`
                : `${artists.length} independent ${artists.length === 1 ? 'artist' : 'artists'}`}
            </span>
            {verifiedCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-[var(--accent-text)] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isNy ? `Ovomerezeka ${verifiedCount}` : `${verifiedCount} verified`}
                </span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
            {isNy ? 'Oimba pa LOWERVIBE' : 'Artists on LOWERVIBE'}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-xl">
            {isNy
              ? 'Pezani oimba ovomerereka a ku Malawi, Nigeria, ndi Africa yonse.'
              : 'Discover trusted independent musicians from Malawi, Nigeria, and across Africa.'}
          </p>
        </div>

        {verifiedCount > 0 && (
          <button
            type="button"
            onClick={() => setVerifiedOnly((prev) => !prev)}
            aria-pressed={verifiedOnly}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 min-h-[44px] ${
              verifiedOnly
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)] hover:border-[var(--border-strong)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isNy ? 'Ovomerezeka okha' : 'Verified only'}</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder={isNy ? 'Fufuzani oimba kapena mayiko...' : 'Search artists or countries...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)] transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedGenre(g)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer min-h-[40px] ${
                selectedGenre === g
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
              }`}
            >
              {g === 'all' ? t('all', 'All') : translateGenreCategory(g, language)}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Grid */}
      {filteredArtists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredArtists.map((artist) => {
            const isFollowing = currentUser?.followingArtistIds.includes(artist.id);
            const isArtistVerified = Boolean(artist.verified || artist.isVerified);
            const isArtistLiked = Boolean(
              currentUser &&
                ((currentUser.likedArtistIds || []).includes(artist.id) ||
                  (artist.likedByUserIds || []).includes(currentUser.id))
            );
            const artistLikes = Array.isArray(artist.likedByUserIds)
              ? new Set(artist.likedByUserIds.filter(Boolean)).size
              : artist.likesCount || 0;
            const artistTrackCount = Math.max(
              trackCountById.get(artist.id) || 0,
              trackCountByName.get((artist.name || '').trim().toLowerCase()) || 0
            );

            return (
              <div
                key={artist.id}
                onClick={() => navigate(`/artists/${artist.slug || artist.id}`)}
                className="group p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                    <SafeImage
                      src={artist.banner || artist.avatar || DEFAULT_AVATAR_SVG}
                      alt={artist.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {isArtistVerified && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-sm text-[var(--accent)] text-[10px] font-bold inline-flex items-center gap-1 border border-white/10">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t('verified', 'Verified')}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-[var(--surface)] -mt-7 bg-[var(--surface-2)] shadow-md">
                      <SafeImage
                        src={artist.avatar || DEFAULT_AVATAR_SVG}
                        alt={artist.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold font-heading text-[var(--text)] truncate">
                          {artist.name}
                        </h3>
                        {isArtistVerified && (
                          <CheckCircle2
                            className="w-4 h-4 text-[var(--accent-text)] shrink-0"
                            aria-label={t('verified', 'Verified')}
                          />
                        )}
                      </div>
                      {(artist.country || artist.location) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/discover?region=${encodeURIComponent(
                                (artist.country || artist.location) as string
                              )}`
                            );
                          }}
                          className="text-[11px] text-[var(--text-muted)] hover:text-[var(--accent-text)] hover:underline truncate mt-0.5 text-left block max-w-full cursor-pointer"
                        >
                          {artist.country || artist.location}
                        </button>
                      )}
                    </div>
                  </div>

                  {artist.bio && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {artist.bio}
                    </p>
                  )}

                  {(() => {
                    const cardTags = extractArtistTags(
                      artist,
                      tracksByArtistId.get(artist.id) || []
                    ).slice(0, 3);
                    if (cardTags.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cardTags.map((tagItem) => (
                          <button
                            key={tagItem.key}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/search?tag=${encodeURIComponent(tagItem.tag)}`);
                            }}
                            className="px-2.5 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-[10.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
                          >
                            #{tagItem.tag}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  <div className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                    <span className="text-[var(--text)] font-bold">{artistTrackCount}</span>{' '}
                    {isNy ? 'nyimbo' : artistTrackCount === 1 ? 'song' : 'songs'} ·{' '}
                    <span className="text-[var(--text)] font-bold">
                      {formatNumber(artist.followersCount || 0)}
                    </span>{' '}
                    {t('followers', 'followers')}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLikeArtist(artist.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1 transition cursor-pointer min-h-[38px] ${
                        isArtistLiked
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                          : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-muted)] hover:text-rose-500'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isArtistLiked ? 'fill-rose-500' : ''}`} />
                      <span className="tabular-nums">{artistLikes}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleShare(artist, e)}
                      className="p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                      title={isNy ? 'Gawani woimba' : 'Share artist'}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleFollow(artist.id, artist.name, e)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer min-h-[38px] ${
                        isFollowing
                          ? 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]'
                          : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      }`}
                    >
                      {isFollowing ? t('following', 'Following') : t('follow', 'Follow')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center space-y-4 bg-[var(--surface)] rounded-[28px] border border-[var(--border)] p-6">
          <Users className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-60" />
          <h3 className="text-base font-bold font-heading text-[var(--text)]">
            {isNy ? 'Palibe oimba omwe apezeka' : 'No artists found'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isNy
              ? 'Yesani kufufuza ndi dziko kapena chotsani zosefera.'
              : 'Try searching by country or clearing the genre filter.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedGenre('all');
              setVerifiedOnly(false);
            }}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
          >
            {isNy ? 'Chotsani zosefera' : 'Clear filters'}
          </button>
        </div>
      )}
    </div>
  );
};
