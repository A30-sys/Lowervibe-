import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Disc,
  Heart,
  Music,
  Play,
  Radio,
  Share2,
  UserCheck,
  UserPlus,
  Users,
  Volume2,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../../context/AudioContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  FriendActivityItem,
  subscribeToFirestoreActivities,
} from '../../services/activityService';
import { Track } from '../../types';
import { formatTime } from '../../utils/formatters';
import { LazySlideImage } from '../common/LazySlideImage';

interface FriendsActivityFeedProps {
  onSelectArtist: (artistId: string) => void;
  onOpenTrackDetails?: (track: Track) => void;
  onSelectCategory: (category: string) => void;
}

export const FriendsActivityFeed: React.FC<FriendsActivityFeedProps> = ({
  onSelectArtist,
  onOpenTrackDetails,
  onSelectCategory,
}) => {
  const { tracks, artists, currentTrack, isPlaying, playTrack, togglePlayPause } = useAudio();
  const { currentUser, toggleFollowArtist, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();

  const [activities, setActivities] = useState<FriendActivityItem[]>([]);
  const [filterScope, setFilterScope] = useState<'followed' | 'community'>('followed');
  const [activityTypeFilter, setActivityTypeFilter] = useState<'all' | 'released' | 'liked'>('all');
  const [animatingHeartId, setAnimatingHeartId] = useState<string | null>(null);

  const carouselRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time Firestore activities
  useEffect(() => {
    const unsub = subscribeToFirestoreActivities(tracks, artists, (updated) => {
      setActivities(updated);
    });
    return () => unsub();
  }, [tracks, artists]);

  // Compute followed artists IDs
  const followedIds = useMemo(() => {
    return currentUser?.followingArtistIds || [];
  }, [currentUser?.followingArtistIds]);

  // Filter activities based on scope & activity type
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Scope filter: if 'followed', check if artist is followed
      if (filterScope === 'followed') {
        const isFollowed = followedIds.includes(act.artistId);
        if (!isFollowed) {
          return false;
        }
      }

      // Activity type filter
      if (activityTypeFilter !== 'all' && act.activityType !== activityTypeFilter) {
        return false;
      }

      return true;
    });
  }, [activities, filterScope, activityTypeFilter, followedIds]);

  // Horizontal scroll buttons
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -340 : 340;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handlePlayActivityTrack = (act: FriendActivityItem) => {
    const track = tracks.find((t) => t.id === act.trackId);
    if (track) {
      if (currentTrack?.id === track.id) {
        togglePlayPause();
      } else {
        playTrack(track);
      }
    } else {
      showToast('This track is no longer available in the catalog.');
    }
  };

  const handleToggleLike = (e: React.MouseEvent, trackId: string, title: string) => {
    e.stopPropagation();
    const isLiked = currentUser?.likedTrackIds.includes(trackId);
    toggleLikeTrack(trackId);
    if (!isLiked) {
      setAnimatingHeartId(trackId);
      setTimeout(() => setAnimatingHeartId(null), 600);
      showToast(`Saved "${title}" to your library`);
    } else {
      showToast(`Removed "${title}" from your library`);
    }
  };

  return (
    <section className="space-y-4 pt-2">
      {/* 1. Header with Live Pulse and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C6FF4A]" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#C6FF4A] flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Live Friends &amp; Artists Activity
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-white mt-0.5">
            Followed Creators Stream
          </h2>
          <p className="text-xs text-[#A0A0A8]">
            Real-time releases, library saves, and listening rotations from artists you follow.
          </p>
        </div>

        {/* Scope and Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Toggle: Followed vs Community Pulse */}
          <div className="flex items-center p-1 rounded-xl bg-[#121218] border border-[rgba(255,255,255,0.08)] text-xs">
            <button
              type="button"
              onClick={() => setFilterScope('followed')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterScope === 'followed'
                  ? 'bg-[#C6FF4A] text-black shadow-xs font-black'
                  : 'text-[#A0A0A8] hover:text-white'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Following ({followedIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('community')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterScope === 'community'
                  ? 'bg-[#C6FF4A] text-black shadow-xs font-black'
                  : 'text-[#A0A0A8] hover:text-white'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Community Pulse</span>
            </button>
          </div>

          {/* Activity Type Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#121218] border border-[rgba(255,255,255,0.08)] text-xs">
            <button
              type="button"
              onClick={() => setActivityTypeFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                activityTypeFilter === 'all'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-[#A0A0A8] hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActivityTypeFilter('released')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                activityTypeFilter === 'released'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-[#A0A0A8] hover:text-white'
              }`}
            >
              Releases
            </button>
            <button
              type="button"
              onClick={() => setActivityTypeFilter('liked')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                activityTypeFilter === 'liked'
                  ? 'bg-white/15 text-white font-bold'
                  : 'text-[#A0A0A8] hover:text-white'
              }`}
            >
              Likes
            </button>
          </div>

          {/* Carousel Slide Navigation Controls */}
          <div className="hidden sm:flex items-center gap-1.5 ml-1">
            <button
              type="button"
              onClick={() => scrollCarousel('left')}
              className="w-8 h-8 rounded-full bg-[#121218] hover:bg-[#1A1A24] border border-[rgba(255,255,255,0.08)] hover:border-white/20 text-[#A0A0A8] hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
              title="Slide Left"
              aria-label="Slide Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollCarousel('right')}
              className="w-8 h-8 rounded-full bg-[#121218] hover:bg-[#1A1A24] border border-[rgba(255,255,255,0.08)] hover:border-white/20 text-[#A0A0A8] hover:text-white flex items-center justify-center transition active:scale-90 cursor-pointer shadow-md"
              title="Slide Right"
              aria-label="Slide Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Horizontal Activity Cards Carousel with Slide Snapping & Lazy-Slide Animation */}
      {filteredActivities.length === 0 ? (
        <div className="p-8 rounded-3xl bg-[#121218] border border-[rgba(255,255,255,0.08)] text-center space-y-3">
          <Users className="w-8 h-8 text-[#A0A0A8] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-white font-heading">
            No Recent Activity from Followed Artists
          </h3>
          <p className="text-xs text-[#A0A0A8] max-w-md mx-auto">
            Follow independent underground artists to stay tuned to their latest studio master drops and library likes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {artists.slice(0, 3).map((artist) => {
              const isFollowed = followedIds.includes(artist.id);
              return (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() => toggleFollowArtist(artist.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isFollowed
                      ? 'bg-white/10 text-white'
                      : 'bg-[#C6FF4A] text-black hover:brightness-105'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Follow {artist.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          ref={carouselRef}
          className="flex items-stretch gap-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none snap-x snap-mandatory"
        >
          {filteredActivities.map((act, idx) => {
            const isPlayingThis = currentTrack?.id === act.trackId && isPlaying;
            const isLiked = currentUser?.likedTrackIds.includes(act.trackId);
            const isAnimatingHeart = animatingHeartId === act.trackId;
            const isFollowed = followedIds.includes(act.artistId);

            // Trusted badge styling
            const badgeMeta =
              act.activityType === 'released'
                ? {
                    label: 'Dropped Master',
                    icon: Disc,
                    bg: 'bg-[#C6FF4A]/15 text-[#C6FF4A] border-[#C6FF4A]/30',
                  }
                : act.activityType === 'liked'
                ? {
                    label: 'Liked Track',
                    icon: Heart,
                    bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
                  }
                : {
                    label: 'Curated Room',
                    icon: Radio,
                    bg: 'bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/30',
                  };

            const BadgeIcon = badgeMeta.icon;

            return (
              <div
                key={act.id}
                className="group shrink-0 snap-start w-[290px] sm:w-[320px] rounded-3xl p-4.5 border border-[rgba(255,255,255,0.08)] hover:border-[#C6FF4A]/40 transition-all duration-300 bg-[#121218] hover:bg-[#161620] shadow-xl hover:shadow-2xl hover:shadow-[#C6FF4A]/5 flex flex-col justify-between animate-slide-up"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div>
                  {/* Artist Header Info */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[rgba(255,255,255,0.06)]">
                    <div
                      onClick={() => onSelectArtist(act.artistId)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group/artist"
                    >
                      <div className="relative w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-black">
                        <LazySlideImage
                          src={act.artistAvatar}
                          alt={act.artistName}
                          containerClassName="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-xs font-bold text-white group-hover/artist:text-[#C6FF4A] transition-colors truncate">
                            {act.artistName}
                          </span>
                          {act.isVerified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-[#A0A0A8] truncate block">
                          {act.artistHandle || `@${act.artistName.toLowerCase().replace(/\s+/g, '')}`}
                        </span>
                      </div>
                    </div>

                    {/* Follow Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleFollowArtist(act.artistId)}
                      className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                        isFollowed
                          ? 'bg-white/10 hover:bg-white/20 text-[#A0A0A8] hover:text-white'
                          : 'bg-[#C6FF4A]/20 hover:bg-[#C6FF4A] text-[#C6FF4A] hover:text-black border border-[#C6FF4A]/30'
                      }`}
                      title={isFollowed ? 'Unfollow' : 'Follow artist'}
                    >
                      {isFollowed ? (
                        <>
                          <UserCheck className="w-2.5 h-2.5" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-2.5 h-2.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Activity Tag & Time */}
                  <div className="flex items-center justify-between gap-2 pt-3 pb-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeMeta.bg}`}
                    >
                      <BadgeIcon className="w-2.5 h-2.5" />
                      <span>{badgeMeta.label}</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#A0A0A8]">{act.timestamp}</span>
                  </div>

                  {/* Reflection Note */}
                  {act.note && (
                    <p className="text-xs text-[#DCDCE2] line-clamp-2 leading-relaxed italic mb-3">
                      "{act.note}"
                    </p>
                  )}

                  {/* Embedded Interactive Track Card */}
                  <div
                    onClick={() => handlePlayActivityTrack(act)}
                    className="group/track relative flex items-center gap-3 p-2.5 rounded-2xl bg-[#1A1A24] hover:bg-[#20202E] border border-[rgba(255,255,255,0.06)] hover:border-[#C6FF4A]/30 transition-all cursor-pointer shadow-md"
                  >
                    {/* Artwork with play overlay */}
                    <div className="relative w-13 h-13 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black">
                      <LazySlideImage
                        src={act.trackCoverArt}
                        alt={act.trackTitle}
                        containerClassName="w-full h-full"
                      />
                      <div
                        className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity ${
                          isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover/track:opacity-100'
                        }`}
                      >
                        {isPlayingThis ? (
                          <div className="flex items-center gap-0.5 h-3">
                            <span className="w-0.5 bg-[#C6FF4A] rounded-full animate-eq-1" />
                            <span className="w-0.5 bg-[#C6FF4A] rounded-full animate-eq-2" />
                            <span className="w-0.5 bg-[#C6FF4A] rounded-full animate-eq-3" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#C6FF4A] text-black flex items-center justify-center shadow-md">
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Track Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white group-hover/track:text-[#C6FF4A] transition-colors truncate">
                          {act.trackTitle}
                        </span>
                        {act.isMaster24Bit && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30 shrink-0">
                            24-Bit
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#A0A0A8] truncate block mt-0.5">
                        {act.trackArtistName}
                      </span>
                    </div>

                    {/* Direct Like Heart Button */}
                    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleLike(e, act.trackId, act.trackTitle)}
                        className={`p-2 rounded-xl transition-all duration-150 cursor-pointer active:scale-90 ${
                          isLiked
                            ? 'text-rose-400'
                            : 'text-[#A0A0A8] hover:text-white hover:bg-white/10'
                        }`}
                        title={isLiked ? 'Saved' : 'Save'}
                      >
                        <Heart
                          className={`w-4 h-4 ${isLiked ? 'fill-current' : ''} ${
                            isAnimatingHeart ? 'animate-heart-pop text-rose-400 fill-rose-400' : ''
                          }`}
                        />
                        {isAnimatingHeart && (
                          <span className="absolute inset-0 rounded-full bg-rose-500/25 animate-heart-burst pointer-events-none" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer with Clickable Category/Genre Pill */}
                <div className="pt-3 mt-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-[11px] font-mono text-[#A0A0A8]">
                  {/* Category Pill: Clickable! Navigates directly into Discover with that category */}
                  <button
                    type="button"
                    onClick={() => onSelectCategory(act.trackGenre)}
                    className="px-2.5 py-1 rounded-full bg-[#1A1A24] hover:bg-[#C6FF4A] text-[#DCDCE2] hover:text-black border border-white/10 transition-colors duration-150 font-bold flex items-center gap-1.5 cursor-pointer touch-target"
                    title={`Explore ${act.trackGenre} frequency`}
                  >
                    <span>#</span>
                    <span>{act.trackGenre}</span>
                  </button>

                  <span className="text-[10px] text-[#A0A0A8]">
                    {act.trackBpm} BPM • {formatTime(act.trackDurationSeconds)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
