import { CheckCircle2, Heart, Search, Share2, Users } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { CANONICAL_GENRES } from '../../services/genresService';
import { Artist } from '../../types';
import { SafeImage } from '../SafeImage';

export const ArtistsRosterView: React.FC = () => {
  const { artists, tracks, setActiveShareArtist } = useAudio();
  const { currentUser, toggleFollowArtist, toggleLikeArtist } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');

  const genres = useMemo(() => {
    const artistGenres = artists.flatMap((a) => a.genres || []);
    const trackGenres = tracks.map((t) => t.genre).filter(Boolean);
    const merged = Array.from(
      new Set([
        ...CANONICAL_GENRES.slice(0, 5).map((g) => g.name),
        ...artistGenres,
        ...trackGenres,
      ])
    ).filter(Boolean);
    return ['all', ...merged];
  }, [artists, tracks]);

  const filteredArtists = artists.filter((artist) => {
    const matchesSearch =
      (artist.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (artist.location || artist.country || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (artist.bio || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre =
      selectedGenre === 'all' ||
      (artist.genres || []).some((g) => g.toLowerCase().includes(selectedGenre.toLowerCase()));
    return matchesSearch && matchesGenre;
  });

  const handleShare = (artist: Artist, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveShareArtist(artist);
  };

  const handleFollow = (artistId: string, artistName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFollowArtist(artistId);
    const isNowFollowing = !currentUser?.followingArtistIds.includes(artistId);
    showToast(isNowFollowing ? `Following ${artistName}` : `Unfollowed ${artistName}`);
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-8">
      {/* Header */}
      <div className="p-6 sm:p-8 rounded-[28px] bg-[var(--surface)] border border-[var(--border)]">
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-[var(--text-muted)]">
            {artists.length} independent {artists.length === 1 ? 'artist' : 'artists'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
            Artists on LOWERVIBE
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-xl">
            Discover independent musicians from Malawi, Nigeria, and across Africa.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search artists or countries..."
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
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer min-h-[40px] capitalize ${
                selectedGenre === g
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Roster Grid */}
      {filteredArtists.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredArtists.map((artist) => {
            const isFollowing = currentUser?.followingArtistIds.includes(artist.id);
            const isArtistLiked = Boolean(
              currentUser &&
                ((currentUser.likedArtistIds || []).includes(artist.id) ||
                  (artist.likedByUserIds || []).includes(currentUser.id))
            );
            const artistLikes = Array.isArray(artist.likedByUserIds)
              ? new Set(artist.likedByUserIds.filter(Boolean)).size
              : artist.likesCount || 0;
            const artistTrackCount = tracks.filter(
              (t) =>
                !t.isDraft &&
                !t.isDeranked &&
                (t.artistId === artist.id ||
                  (t.artistName || '').toLowerCase() === (artist.name || '').toLowerCase())
            ).length;

            return (
              <div
                key={artist.id}
                onClick={() => navigate(`/artists/${artist.slug || artist.id}`)}
                className="group p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] transition cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-[var(--surface-2)] border border-[var(--border)]">
                    <SafeImage
                      src={artist.banner || artist.avatar}
                      alt={artist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="relative w-14 h-14 rounded-2xl overflow-hidden shrink-0 border-2 border-[var(--surface)] -mt-7 bg-[var(--surface-2)] shadow-md">
                      <SafeImage src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold font-heading text-[var(--text)] truncate">
                          {artist.name}
                        </h3>
                        {artist.verified && (
                          <CheckCircle2 className="w-4 h-4 text-[var(--violet)] shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                        {artist.country || artist.location || 'Africa'}
                      </p>
                    </div>
                  </div>

                  {artist.bio && (
                    <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                      {artist.bio}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                  <div className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                    <span className="text-[var(--text)] font-bold">{artistTrackCount}</span>{' '}
                    {artistTrackCount === 1 ? 'song' : 'songs'} ·{' '}
                    <span className="text-[var(--text)] font-bold">{artist.followersCount || 0}</span>{' '}
                    followers
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
                      title="Share artist"
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
                      {isFollowing ? 'Following' : 'Follow'}
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
          <h3 className="text-base font-bold font-heading text-[var(--text)]">No artists found</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            Try searching by country or clearing the genre filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedGenre('all');
            }}
            className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-xs cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
};
