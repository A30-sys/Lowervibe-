import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Disc,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Heart,
  MessageSquare,
  Mic2,
  Moon,
  Music,
  Pause,
  Play,
  Quote,
  Save,
  Send,
  Share2,
  Timer,
  Trash2,
  Type,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { Track } from '../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG } from '../utils/artworkFallback';
import {
  formatTime,
  getTrackDurationSeconds,
  getTrackLikeCount,
  isTrackLikedByUser,
  parseDurationInput,
} from '../utils/formatters';
import { translateGenreCategory } from '../utils/genreCategories';
import { GenreSelectOrCustom } from './common/GenreSelectOrCustom';
import { MoodSelectOrCustom } from './common/MoodSelectOrCustom';

interface TrackDetailDrawerProps {
  track: Track | null;
  onClose: () => void;
}

type DrawerTab = 'overview' | 'lyrics' | 'reflections';

export const TrackDetailDrawer: React.FC<TrackDetailDrawerProps> = ({ track, onClose }) => {
  const { navigate } = useRouter();
  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playTrack,
    togglePlayPause,
    updateTrack,
    addCommentToTrack,
    likeComment,
    deleteTrackComment,
    moderateTrackComment,
    submitContentReportRecord,
    setActiveShareTrack,
    setActiveDetailTrack,
    seekTo,
    sleepTimerMinutes,
    sleepTimerRemainingSeconds,
    setSleepTimer,
    cancelSleepTimer,
    upsertGenre,
  } = useAudio();

  const { currentUser, isAdmin, toggleLikeTrack } = useAuth();
  const { showToast } = useToast();
  const { language, t } = useLanguage();
  const isNy = language === 'ny';
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [commentText, setCommentText] = useState('');
  const [useCurrentTimeForComment, setUseCurrentTimeForComment] = useState(true);
  const [copiedIsrc, setCopiedIsrc] = useState(false);
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [lyricsFontSize, setLyricsFontSize] = useState<'normal' | 'large'>('normal');

  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editTitle, setEditTitle] = useState(track?.title || '');
  const [editGenre, setEditGenre] = useState(track?.genre || 'Afro Chillout');
  const [editMood, setEditMood] = useState(track?.mood || '');
  const [editDescription, setEditDescription] = useState(track?.story || '');
  const [editDuration, setEditDuration] = useState(
    track ? formatTime(getTrackDurationSeconds(track)) : ''
  );
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditingMetadata(false);
    setEditTitle(track?.title || '');
    setEditGenre(track?.genre || 'Afro Chillout');
    setEditMood(track?.mood || '');
    setEditDescription(track?.story || '');
    setEditDuration(track ? formatTime(getTrackDurationSeconds(track)) : '');
  }, [track?.id, track?.title, track?.genre, track?.mood, track?.story, track?.durationSeconds, track?.metadata?.Duration]);

  if (!track) return null;

  const artist = artists.find((a) => a.id === track.artistId);

  const canEditMetadata = Boolean(
    currentUser &&
      (track.uploadedByUserId
        ? track.uploadedByUserId === currentUser.id
        : Boolean(
            artist &&
              (artist.ownerId
                ? artist.ownerId === currentUser.id
                : artist.ownerUserId === currentUser.id ||
                  artist.claimedByUserId === currentUser.id ||
                  (!artist.ownerUserId && !artist.claimedByUserId && currentUser.artistId === artist.id))
          ))
  );

  const artistTracks = tracks.filter(
    (t) => t.artistId === track.artistId && t.id !== track.id && !t.isDraft && !t.isDeranked
  );

  const isCurrentTrackPlaying = currentTrack?.id === track.id && isPlaying;
  const isCurrentTrackSelected = currentTrack?.id === track.id;
  const isLiked = isTrackLikedByUser(track, currentUser);
  const likeCount = getTrackLikeCount(track);
  const trackDurationSec = getTrackDurationSeconds(track);

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditMetadata) {
      const msg = isNy
        ? 'Simuli ndi chilolezo: mwini nyimbo yekha ndi amene angasinthe izi.'
        : 'Permission denied: only the track owner can edit this song.';
      setMetadataError(msg);
      showToast(msg);
      return;
    }
    if (!editTitle.trim()) {
      const msg = isNy ? 'Dzina la nyimbo silingakhale lopanda kanthu.' : 'Track title cannot be empty.';
      setMetadataError(msg);
      showToast(msg);
      return;
    }
    setMetadataError(null);
    setIsSavingMetadata(true);
    try {
      const parsedDur = parseDurationInput(editDuration);
      const nextDuration = parsedDur > 0 ? parsedDur : trackDurationSec;
      const cleanGenre = editGenre.trim() || track.genre;
      const cleanMood = editMood.trim();
      await updateTrack(track.id, {
        title: editTitle.trim(),
        genre: cleanGenre,
        mood: cleanMood,
        vibeTags: [cleanGenre, ...(cleanMood ? [cleanMood] : [])].filter(Boolean),
        story: editDescription.trim(),
        durationSeconds: nextDuration,
        metadata: {
          ...(track.metadata || {}),
          Duration: nextDuration,
          duration: nextDuration,
          durationFormatted: formatTime(nextDuration),
        },
      });
      upsertGenre(cleanGenre, { region: track.region }).catch(() => {});
      setIsEditingMetadata(false);
      showToast(isNy ? 'Zambiri za nyimbo zasungidwa' : 'Song info saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : isNy ? 'Kusunga kwalephereka.' : 'Failed to save changes.';
      setMetadataError(msg);
      showToast(msg);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const timestampSec = isCurrentTrackSelected && useCurrentTimeForComment ? currentTime : 0;

    addCommentToTrack(track.id, {
      userId: currentUser?.id || 'guest',
      userName: currentUser?.name || 'Listener',
      userAvatar: currentUser?.avatar || DEFAULT_AVATAR_SVG,
      userRole: currentUser?.role || 'listener',
      timestampSeconds: timestampSec,
      content: commentText.trim(),
    });

    setCommentText('');
  };

  const handleCopyLyrics = () => {
    if (!track.lyrics) return;
    navigator.clipboard.writeText(track.lyrics);
    setCopiedLyrics(true);
    setTimeout(() => setCopiedLyrics(false), 2000);
  };

  const handleNavigateToTrack = (selectedTrack: Track) => {
    setActiveDetailTrack(selectedTrack);
    navigate(`/tracks/${selectedTrack.id}`);
    onClose();
  };

  const handleQuickSwitchDrawerTrack = (selectedTrack: Track) => {
    setActiveDetailTrack(selectedTrack);
    navigate(`/tracks/${selectedTrack.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md h-full bg-[var(--surface)] border-l border-[var(--border)] flex flex-col shadow-2xl text-[var(--text)]">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {activeTab === 'lyrics' ? (
                <Mic2 className="w-4 h-4 text-[var(--accent-text)]" />
              ) : activeTab === 'reflections' ? (
                <MessageSquare className="w-4 h-4 text-[var(--violet)]" />
              ) : (
                <FileText className="w-4 h-4 text-[var(--accent-text)]" />
              )}
              <h3 className="text-sm font-bold text-[var(--text)] font-heading">
                {activeTab === 'lyrics'
                  ? t('lyrics', 'Lyrics')
                  : activeTab === 'reflections'
                  ? isNy
                    ? 'Ndemanga'
                    : 'Comments'
                  : t('track_details', 'Song details')}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-xl transition cursor-pointer"
              aria-label={t('close', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex items-center p-1 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] gap-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'text-[var(--text)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {activeTab === 'overview' && (
                <motion.div
                  layoutId="trackDetailActiveTabIndicator"
                  className="absolute inset-0 bg-[var(--surface)] rounded-lg shadow-sm border border-[var(--border)] -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <FileText className="w-3.5 h-3.5" />
              <span>{t('studio_tab_overview', 'Overview')}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('lyrics')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'lyrics'
                  ? 'text-[var(--accent-contrast)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {activeTab === 'lyrics' && (
                <motion.div
                  layoutId="trackDetailActiveTabIndicator"
                  className="absolute inset-0 bg-[var(--accent)] rounded-lg shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <Mic2 className="w-3.5 h-3.5" />
              <span>{t('lyrics', 'Lyrics')}</span>
              {track.lyrics && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeTab === 'lyrics' ? 'bg-[var(--accent-contrast)]' : 'bg-[var(--accent)]'
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reflections')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === 'reflections'
                  ? 'text-white font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {activeTab === 'reflections' && (
                <motion.div
                  layoutId="trackDetailActiveTabIndicator"
                  className="absolute inset-0 bg-[var(--violet)] rounded-lg shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isNy ? 'Ndemanga' : 'Comments'}</span>
              <span
                className={`text-[10px] font-mono px-1 rounded-full ${
                  activeTab === 'reflections' ? 'bg-black/20 text-white font-bold' : 'text-[var(--text-muted)]'
                }`}
              >
                {track.comments?.length || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Track Hero Card */}
          <div className="flex gap-4 items-center bg-[var(--surface-2)] p-3.5 rounded-2xl border border-[var(--border)]">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 group bg-[var(--bg)] border border-[var(--border)]">
              <img
                src={track.coverArt || DEFAULT_ARTWORK_SVG}
                alt={track.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                }}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  if (currentTrack?.id === track.id) {
                    togglePlayPause();
                  } else {
                    playTrack(track);
                  }
                }}
                aria-label={isCurrentTrackPlaying ? 'Pause track' : 'Play track'}
                className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
              >
                {isCurrentTrackPlaying ? (
                  <Pause className="w-8 h-8 text-[var(--accent)] fill-current" />
                ) : (
                  <Play className="w-8 h-8 text-[var(--accent)] fill-current ml-0.5" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text)] truncate font-heading">
                  {track.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (artist) {
                    navigate(`/artists/${artist.slug || artist.id}`);
                    onClose();
                  }
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition truncate mt-0.5 text-left block cursor-pointer"
              >
                {track.artistName}
              </button>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => toggleLikeTrack(track.id)}
                  className={`flex items-center gap-1 text-xs transition cursor-pointer ${
                    isLiked ? 'text-rose-500' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500' : ''}`} />
                  <span className="font-mono tabular-nums">{likeCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveShareTrack(track)}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{t('share', 'Share')}</span>
                </button>

                {canEditMetadata && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('overview');
                      setEditTitle(track.title);
                      setEditGenre(track.genre);
                      setEditMood(track.mood || '');
                      setEditDescription(track.story || '');
                      setEditDuration(formatTime(trackDurationSec));
                      setIsEditingMetadata((prev) => !prev);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      isEditingMetadata
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)]'
                        : 'bg-[var(--surface)] hover:bg-[var(--bg)] text-[var(--text)] border-[var(--border-strong)]'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>
                      {isEditingMetadata
                        ? isNy
                          ? 'Ikukonza...'
                          : 'Editing...'
                        : isNy
                        ? 'Konzani Zambiri'
                        : 'Edit Metadata'}
                    </span>
                  </button>
                )}

                <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted)] ml-auto flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--accent-text)]" />
                  <span>{track.metadata?.durationFormatted || formatTime(trackDurationSec)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Inline Edit Metadata Form */}
          {isEditingMetadata && canEditMetadata && (
            <form
              onSubmit={handleSaveMetadata}
              className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-strong)] space-y-3.5 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[var(--accent-text)]" />
                  <h4 className="text-xs font-bold text-[var(--text)] font-heading">
                    {isNy ? 'Konzani zambiri za nyimbo' : 'Edit song details'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingMetadata(false)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {metadataError && (
                <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--danger)] text-xs text-[var(--danger)] font-medium">
                  {metadataError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">
                  {isNy ? 'Dzina la nyimbo' : 'Title'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={isNy ? 'Lembani dzina la nyimbo' : 'Enter song title'}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-dim)]">
                  {isNy ? 'Mtundu' : 'Genre'}
                </label>
                <GenreSelectOrCustom
                  value={editGenre}
                  onChange={setEditGenre}
                  onCustomGenreCreated={(name) => {
                    upsertGenre(name, { region: track.region }).catch(() => {});
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-dim)]">
                  {isNy ? 'Maganizo (posankha)' : 'Mood (optional)'}
                </label>
                <MoodSelectOrCustom
                  value={editMood}
                  onChange={setEditMood}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">
                  {isNy ? 'Utali (mm:ss kapena masekondi)' : 'Duration (mm:ss or seconds)'}
                </label>
                <input
                  type="text"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="e.g. 3:45 or 225"
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-xs font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-dim)]">
                  {isNy ? 'Kufotokozera' : 'Description'}
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={isNy ? 'Uzani omvera za nyimboyi...' : 'Tell listeners about this song...'}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border-strong)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingMetadata(false)}
                  className="px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--bg)] text-xs text-[var(--text)] border border-[var(--border)] cursor-pointer"
                >
                  {t('cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingMetadata}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:brightness-95 text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {isSavingMetadata
                      ? t('saving', 'Saving...')
                      : isNy
                      ? 'Sungani zosintha'
                      : 'Save changes'}
                  </span>
                </button>
              </div>
            </form>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="tab-overview"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="space-y-5"
              >
                {track.story && (
                  <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text)]">
                        {t('story_behind_song', 'About this song')}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {translateGenreCategory(track.genre, language)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-dim)] leading-relaxed">{track.story}</p>
                  </div>
                )}

                {/* Sleep Timer */}
                <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-[var(--violet)]" />
                      <h4 className="text-xs font-bold text-[var(--text)] font-heading">
                        {t('sleep_timer', 'Sleep timer')}
                      </h4>
                    </div>
                    {sleepTimerRemainingSeconds !== null && sleepTimerRemainingSeconds > 0 ? (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-[var(--violet)]/15 text-[var(--violet)]">
                        {Math.floor(sleepTimerRemainingSeconds / 60)}:
                        {(sleepTimerRemainingSeconds % 60).toString().padStart(2, '0')} {isNy ? 'yatsala' : 'left'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-[var(--text-muted)]">
                        {t('timer_off', 'Off')}
                      </span>
                    )}
                  </div>

                  {sleepTimerRemainingSeconds !== null && sleepTimerRemainingSeconds > 0 && (
                    <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {isNy ? 'Imayima patatha' : 'Stops in'}
                        </div>
                        <div className="text-base font-mono font-bold text-[var(--text)]">
                          {Math.floor(sleepTimerRemainingSeconds / 60)}m{' '}
                          {(sleepTimerRemainingSeconds % 60).toString().padStart(2, '0')}s
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newMins = (sleepTimerMinutes || 0) + 15;
                            setSleepTimer(newMins);
                            showToast(
                              isNy
                                ? `Nthawi yoimitsa yaikidwa ku mphindi ${newMins}`
                                : `Sleep timer updated to ${newMins} minutes`
                            );
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] text-xs font-mono font-semibold cursor-pointer"
                        >
                          +15m
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cancelSleepTimer();
                            showToast(isNy ? 'Nthawi yoimitsa yazimitsidwa' : 'Sleep timer turned off');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] text-xs font-medium cursor-pointer"
                        >
                          {isNy ? 'Zimitsani' : 'Turn off'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 45, 60].map((minutes) => {
                      const isSelected = sleepTimerMinutes === minutes;
                      return (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              cancelSleepTimer();
                              showToast(isNy ? 'Nthawi yoimitsa yazimitsidwa' : 'Sleep timer turned off');
                            } else {
                              setSleepTimer(minutes);
                              showToast(
                                isNy
                                  ? `Nyimbo iyima patatha mphindi ${minutes}`
                                  : `Music will stop in ${minutes} minutes`
                              );
                            }
                          }}
                          className={`py-2 px-1.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                            isSelected
                              ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-[var(--accent)] font-bold'
                              : 'bg-[var(--surface)] hover:bg-[var(--bg)] border-[var(--border)] text-[var(--text)]'
                          }`}
                        >
                          <Timer className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-mono font-semibold">
                            {t('timer_minutes', `${minutes} min`, { min: minutes })}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Lyrics Preview */}
                <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Mic2 className="w-4 h-4 text-[var(--accent-text)]" />
                      <h4 className="text-xs font-bold text-[var(--text)] font-heading">
                        {t('lyrics', 'Lyrics')}
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {track.lyrics
                        ? isNy
                          ? 'Alipo'
                          : 'Available'
                        : isNy
                        ? 'Zida zokha'
                        : 'Instrumental'}
                    </span>
                  </div>

                  {track.lyrics ? (
                    <div className="space-y-3">
                      <div className="relative p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                        <Quote className="w-5 h-5 text-[var(--text-muted)]/30 absolute top-2 right-2 pointer-events-none" />
                        <div className="text-xs text-[var(--text-dim)] space-y-1 max-h-24 overflow-hidden">
                          {track.lyrics
                            .split('\n')
                            .filter((l) => l.trim() && !l.startsWith('['))
                            .slice(0, 4)
                            .map((line, idx) => (
                              <p key={idx} className="truncate">
                                {line}
                              </p>
                            ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('lyrics')}
                        className="w-full py-2.5 px-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--bg)] border border-[var(--border-strong)] text-[var(--text)] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Mic2 className="w-3.5 h-3.5" />
                        <span>{isNy ? 'Werengani mawu onse' : 'Read full lyrics'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      {t('no_lyrics_yet', 'No lyrics added for this song yet.')}
                    </p>
                  )}
                </div>

                {/* Song Info */}
                <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
                    <h4 className="text-xs font-bold text-[var(--text)] font-heading">
                      {isNy ? 'Zambiri za nyimbo' : 'Song info'}
                    </h4>
                    {canEditMetadata && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditTitle(track.title);
                          setEditGenre(track.genre);
                          setEditDescription(track.story || '');
                          setIsEditingMetadata(true);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--surface)] border border-[var(--border-strong)] text-[var(--text)] hover:opacity-80 cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isNy ? 'Konzani' : 'Edit'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center justify-between">
                        <span>ISRC</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(track.isrcCode || track.id);
                            setCopiedIsrc(true);
                            setTimeout(() => setCopiedIsrc(false), 2000);
                          }}
                          className="text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                          title={isNy ? 'Koperani nambala' : 'Copy code'}
                        >
                          {copiedIsrc ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-xs font-mono font-bold text-[var(--text)] mt-0.5 truncate">
                        {track.isrcCode || (isNy ? 'Sinaikidwe' : 'Not set')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {isNy ? 'Utali' : 'Duration'}
                      </div>
                      <div className="text-xs font-mono font-bold text-[var(--text)] mt-0.5 tabular-nums">
                        {track.metadata?.durationFormatted || formatTime(trackDurationSec)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {isNy ? 'Mtundu' : 'Genre'}
                      </div>
                      <div className="text-xs font-bold text-[var(--text)] mt-0.5 truncate">
                        {translateGenreCategory(track.genre, language)}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {isNy ? 'Tsiku lotulutsidwa' : 'Release date'}
                      </div>
                      <div className="text-xs font-mono font-bold text-[var(--text)] mt-0.5 truncate">
                        {track.releaseDate || (isNy ? 'Sinatchulidwe' : 'Not specified')}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] col-span-2 flex items-center justify-between">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {isNy ? 'Wolemba / Lebolo' : 'Composer / Label'}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text)] truncate max-w-[200px]">
                        {track.composer || track.artistName}
                        {track.recordLabel ? ` · ${track.recordLabel}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* More from this artist */}
                <div className="pt-2 border-t border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-[var(--accent-text)]" />
                      <h4 className="text-xs font-bold text-[var(--text)] font-heading">
                        {isNy ? `Zina za ${track.artistName}` : `More from ${track.artistName}`}
                      </h4>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--surface-2)] text-[var(--text-muted)]">
                        {artistTracks.length}
                      </span>
                    </div>
                    {artist && (
                      <button
                        type="button"
                        onClick={() => {
                          navigate(`/artists/${artist.slug || artist.id}`);
                          onClose();
                        }}
                        className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition cursor-pointer"
                      >
                        <User className="w-3 h-3" />
                        <span>{t('profile', 'Profile')}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {artistTracks.length > 0 ? (
                    <div className="space-y-2.5">
                      {artistTracks.map((otherTrack) => {
                        const isOtherPlaying = currentTrack?.id === otherTrack.id && isPlaying;
                        const isOtherActive = currentTrack?.id === otherTrack.id;

                        return (
                          <div
                            key={otherTrack.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNavigateToTrack(otherTrack)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleNavigateToTrack(otherTrack);
                              }
                            }}
                            className={`group flex items-center justify-between gap-3 p-3 rounded-2xl border transition cursor-pointer ${
                              isOtherActive
                                ? 'bg-[var(--surface-2)] border-[var(--border-strong)]'
                                : 'bg-[var(--surface)] hover:bg-[var(--surface-2)] border-[var(--border)]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[var(--surface-2)]">
                                <img
                                  src={otherTrack.coverArt || DEFAULT_ARTWORK_SVG}
                                  alt={otherTrack.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isOtherActive) {
                                      togglePlayPause();
                                    } else {
                                      playTrack(otherTrack);
                                    }
                                  }}
                                  aria-label={
                                    isOtherPlaying ? `Pause ${otherTrack.title}` : `Play ${otherTrack.title}`
                                  }
                                  className={`absolute inset-0 flex items-center justify-center transition cursor-pointer ${
                                    isOtherPlaying
                                      ? 'bg-black/50 opacity-100'
                                      : 'bg-black/40 opacity-0 group-hover:opacity-100'
                                  }`}
                                >
                                  {isOtherPlaying ? (
                                    <Pause className="w-5 h-5 text-[var(--accent)] fill-current" />
                                  ) : (
                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                  )}
                                </button>
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[var(--text)] truncate">
                                  {otherTrack.title}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-0.5">
                                  <span className="truncate">{translateGenreCategory(otherTrack.genre, language)}</span>
                                  <span>·</span>
                                  <span className="font-mono">{formatTime(otherTrack.durationSeconds)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickSwitchDrawerTrack(otherTrack);
                                }}
                                className="p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                title={isNy ? 'Onani zambiri' : 'Inspect song'}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNavigateToTrack(otherTrack);
                                }}
                                className="p-2 rounded-lg bg-[var(--accent)] text-[var(--accent-contrast)] cursor-pointer"
                                title={isNy ? 'Tsegulani tsamba la nyimbo' : 'Open song page'}
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center space-y-1.5">
                      <Disc className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                      <p className="text-xs text-[var(--text-muted)]">
                        {isNy
                          ? `Palibe nyimbo zina za ${track.artistName} pakadali pano.`
                          : `No other tracks from ${track.artistName} yet.`}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'lyrics' && (
              <motion.div
                key="tab-lyrics"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <span className="text-xs font-semibold text-[var(--text)]">
                    {track.lyrics
                      ? t('lyrics', 'Lyrics')
                      : isNy
                      ? 'Zida zokha'
                      : 'Instrumental'}
                  </span>
                  {track.lyrics && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setLyricsFontSize((prev) => (prev === 'normal' ? 'large' : 'normal'))
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs font-mono cursor-pointer"
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span>{lyricsFontSize === 'large' ? '16px' : '14px'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyLyrics}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-xs cursor-pointer"
                      >
                        {copiedLyrics ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500 font-semibold">
                              {isNy ? 'Zakopedwa' : 'Copied'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>{isNy ? 'Koperani' : 'Copy'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {track.lyrics ? (
                  <div className="p-5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2 select-text">
                    {track.lyrics.split('\n').map((line, idx) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                        return (
                          <div key={idx} className="pt-3 pb-1">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase bg-[var(--surface)] text-[var(--violet)] border border-[var(--border)]">
                              {trimmed.slice(1, -1)}
                            </span>
                          </div>
                        );
                      }
                      if (!trimmed) return <div key={idx} className="h-2" />;
                      return (
                        <p
                          key={idx}
                          className={`leading-relaxed text-[var(--text)] ${
                            lyricsFontSize === 'large' ? 'text-base font-medium' : 'text-sm'
                          }`}
                        >
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 px-6 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-center space-y-3">
                    <Mic2 className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                    <h4 className="text-sm font-bold text-[var(--text)] font-heading">
                      {isNy ? 'Nyimbo ya zida zokha' : 'Instrumental track'}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t('no_lyrics_yet', 'No lyrics were added for this track.')}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'reflections' && (() => {
              const isTrackOwnerOrAdmin = Boolean(isAdmin || canEditMetadata);
              const visibleComments = (track.comments || []).filter(
                (c) => !c.hiddenByModeration || isTrackOwnerOrAdmin
              );
              const commentsAllowed = track.allowComments !== false;
              return (
                <motion.div
                  key="tab-reflections"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--text)] font-heading">
                      {isNy ? 'Ndemanga' : 'Comments'} ({visibleComments.length})
                    </h4>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isNy ? 'Dinani nthawi kuti mupiteko' : 'Tap timestamp to jump'}
                    </span>
                  </div>

                  {visibleComments.length === 0 ? (
                    <div className="text-center py-12 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] text-xs space-y-1">
                      <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-60" />
                      <p className="font-semibold text-[var(--text)]">
                        {commentsAllowed
                          ? isNy
                            ? 'Palibe ndemanga pakadali pano'
                            : 'No comments yet'
                          : t('comments_disabled', 'Comments are turned off for this track.')}
                      </p>
                      {commentsAllowed && (
                        <p>
                          {isNy ? 'Khalani woyamba kunena maganizo anu.' : 'Be the first to share what you think.'}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleComments.map((c) => {
                        const canDelete = Boolean(
                          isTrackOwnerOrAdmin || (currentUser && c.userId === currentUser.id)
                        );
                        return (
                          <div
                            key={c.id}
                            className={`p-3 rounded-2xl bg-[var(--surface-2)] border ${
                              c.hiddenByModeration ? 'border-amber-500/40 opacity-75' : 'border-[var(--border)]'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <img
                                  src={c.userAvatar || DEFAULT_AVATAR_SVG}
                                  alt={c.userName}
                                  referrerPolicy="no-referrer"
                                  className="w-5 h-5 rounded-full object-cover border border-[var(--border)] shrink-0"
                                />
                                <span className="text-xs font-semibold text-[var(--text)] truncate">{c.userName}</span>
                                {c.hiddenByModeration && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[10px] font-mono">
                                    {isNy ? 'Yobisika' : 'Hidden'}
                                  </span>
                                )}
                              </div>

                              {c.timestampSeconds > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (currentTrack?.id !== track.id) {
                                      playTrack(track);
                                    }
                                    seekTo(c.timestampSeconds);
                                  }}
                                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer shrink-0"
                                >
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{formatTime(c.timestampSeconds)}</span>
                                </button>
                              )}
                            </div>

                            <p className="text-xs text-[var(--text-dim)] leading-relaxed">{c.content}</p>

                            <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                              <span>{c.createdAt}</span>
                              <div className="flex items-center gap-2">
                                {isTrackOwnerOrAdmin && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await moderateTrackComment(
                                        track.id,
                                        c.id,
                                        !c.hiddenByModeration
                                      );
                                      if (res.success) {
                                        showToast(
                                          c.hiddenByModeration
                                            ? isNy ? 'Ndemanga ikuwonekeranso' : 'Comment restored'
                                            : isNy ? 'Ndemanga yabisika' : 'Comment hidden'
                                        );
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 hover:text-[var(--text)] cursor-pointer"
                                  >
                                    {c.hiddenByModeration ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                    <span>{c.hiddenByModeration ? (isNy ? 'Onetsani' : 'Show') : (isNy ? 'Bisani' : 'Hide')}</span>
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await deleteTrackComment(track.id, c.id);
                                      if (res.success) {
                                        showToast(isNy ? 'Ndemanga yafufutidwa' : 'Comment deleted');
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 hover:text-[var(--danger)] cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t('delete_comment', 'Delete')}</span>
                                  </button>
                                )}
                                {currentUser && !canDelete && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await submitContentReportRecord({
                                        type: 'comment',
                                        trackId: track.id,
                                        trackTitle: track.title,
                                        commentId: c.id,
                                        reason: 'Flagged listener comment',
                                        details: `Comment by ${c.userName}: "${c.content}"`,
                                      });
                                      showToast(isNy ? 'Ndemanga yanenedwa kwa oyang\'anira' : 'Comment reported for review');
                                    }}
                                    className="inline-flex items-center gap-1 hover:text-amber-500 cursor-pointer"
                                  >
                                    <Flag className="w-3 h-3" />
                                    <span>{t('report_comment', 'Report')}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => likeComment(track.id, c.id)}
                                  className="flex items-center gap-1 hover:text-rose-500 transition cursor-pointer"
                                >
                                  <Heart className="w-3 h-3" />
                                  <span>{c.likes}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* Bottom Bar */}
        {activeTab === 'lyrics' ? (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)] flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (currentTrack?.id === track.id) {
                  togglePlayPause();
                } else {
                  playTrack(track);
                }
              }}
              className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shrink-0 cursor-pointer"
              aria-label={isCurrentTrackPlaying ? t('pause', 'Pause') : t('play', 'Play')}
            >
              {isCurrentTrackPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] mb-1">
                <span className="truncate font-semibold text-[var(--text)]">
                  {isCurrentTrackSelected
                    ? t('now_playing', 'Now playing')
                    : isNy
                    ? 'Dinani kuti mumvere'
                    : 'Tap play to listen'}
                </span>
                <span>
                  {isCurrentTrackSelected
                    ? `${formatTime(currentTime)} / ${formatTime(duration || trackDurationSec)}`
                    : formatTime(trackDurationSec)}
                </span>
              </div>
              <div className="w-full bg-[var(--surface-2)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[var(--accent)] h-full transition-all duration-200"
                  style={{
                    width: `${
                      isCurrentTrackSelected && duration > 0
                        ? Math.min(100, (currentTime / duration) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        ) : track.allowComments === false ? (
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg)] text-center text-xs text-[var(--text-muted)]">
            {t('comments_disabled', 'Comments are turned off for this track.')}
          </div>
        ) : (
          <form onSubmit={handlePostComment} className="p-4 border-t border-[var(--border)] bg-[var(--bg)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-[var(--text-muted)]">
                {isNy ? 'Ikutumiza ngati' : 'Posting as'}{' '}
                <strong className="text-[var(--text)]">{currentUser?.name || (isNy ? 'Mlendo' : 'Guest')}</strong>
              </span>
              {isCurrentTrackSelected && (
                <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCurrentTimeForComment}
                    onChange={(e) => setUseCurrentTimeForComment(e.target.checked)}
                    className="accent-[var(--violet)] rounded cursor-pointer"
                  />
                  <span>
                    {isNy ? `Chongani pa ${formatTime(currentTime)}` : `Tag at ${formatTime(currentTime)}`}
                  </span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={isNy ? 'Lembani ndemanga...' : 'Write a comment...'}
                className="flex-1 px-3.5 py-2.5 bg-[var(--surface)] border border-[var(--border-strong)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-text)]"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="p-2.5 rounded-xl bg-[var(--accent)] hover:brightness-95 disabled:opacity-40 text-[var(--accent-contrast)] transition cursor-pointer"
                aria-label={isNy ? 'Tumizani ndemanga' : 'Post comment'}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
