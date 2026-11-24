import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bell,
  BellRing,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  FileAudio,
  Heart,
  Image as ImageIcon,
  Lock,
  Music,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotifications } from '../../context/NotificationContext';
import { useRouter } from '../../context/RouterContext';
import {
  ExtractedAudioMetadata,
  probeAudioUrlMetadata,
  saveAudioBlob,
} from '../../services/audioStorage';
import {
  compressImage,
  deleteUploadedStoragePaths,
  ResumableUploadController,
  uploadCompressedAvatar,
  uploadCompressedCoverBanner,
  uploadTrackCoverArtwork,
  uploadValidatedTrackAudio,
  validateTrack,
} from '../../services/uploadService';
import { verifyServerToken } from '../../services/payoutTokenService';
import { PayoutProviderType, Track } from '../../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG, DEFAULT_BANNER_SVG, LOWERVIBE_ICON_ARTWORK } from '../../utils/artworkFallback';
import { formatTime } from '../../utils/formatters';
import { normalizeGenreCategory, translateGenreCategory } from '../../utils/genreCategories';
import { openPwaInstallPrompt } from '../../utils/pwaManifest';
import { GenreSelectOrCustom } from '../common/GenreSelectOrCustom';
import { MoodSelectOrCustom } from '../common/MoodSelectOrCustom';
import { RegionSelect } from '../common/RegionSelect';
import { CountUpValue } from '../studio/CountUpValue';
import { StudioSongEarningsPanel } from '../studio/StudioSongEarningsPanel';
import { StudioStatsTab } from '../studio/StudioStatsTab';
import { StudioWithdrawalsTab } from '../studio/StudioWithdrawalsTab';
import { useStudioLiveTrackMetrics } from '../studio/useStudioLiveTrackMetrics';

type StudioTab = 'overview' | 'upload' | 'tracks' | 'analytics' | 'monetization' | 'withdrawals';

function isValidHttpsUrl(val: string): boolean {
  try {
    const parsed = new URL(val.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const StudioView: React.FC<{ onOpenTrackDetails: (track: Track) => void }> = ({
  onOpenTrackDetails,
}) => {
  const {
    currentUser,
    isAdmin,
    isArtist,
    submitArtistApplication,
    requireReauth,
  } = useAuth();
  const {
    tracks,
    artists,
    currentTrack,
    isPlaying,
    playTrack,
    togglePlayPause,
    saveNewTrack,
    updateArtistProfile,
    updateTrack,
    deleteTrack,
    toggleDraftTrack,
    upsertGenre,
    monetizationConfig,
    payoutMethods,
    payoutRequests,
    requestArtistMonetization,
    addPayoutMethod,
    removePayoutMethod,
    setDefaultPayoutMethod,
    submitPayoutRequest,
    setActiveDetailTrack,
    setActiveShareTrack,
  } = useAudio();
  const {
    notifications,
    isNotificationRead,
    markAsRead,
    sendNotification,
  } = useNotifications();
  const { navigate, searchParams } = useRouter();
  const { language, t: translate } = useLanguage();
  const isNy = language === 'ny';

  const [activeTab, setActiveTab] = useState<StudioTab>('overview');
  const [notice, setNotice] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const [earningsRefreshKey, setEarningsRefreshKey] = useState(0);
  const [isRefreshingEarnings, setIsRefreshingEarnings] = useState(false);
  const [publishedCelebrationTrack, setPublishedCelebrationTrack] = useState<Track | null>(null);
  const [isPayoutNotifOpen, setIsPayoutNotifOpen] = useState(false);
  const payoutNotifPopoverRef = useRef<HTMLDivElement | null>(null);
  const prevPayoutStatusMapRef = useRef<Record<string, string>>({});
  const payoutInitializedRef = useRef(false);
  const notifiedTransitionKeysRef = useRef<Set<string>>(new Set());
  const showNotice = (text: string, type: 'ok' | 'err' = 'ok') => {
    setNotice({ text, type });
    window.setTimeout(() => setNotice(null), 5000);
  };

  // Detect live Firestore withdrawal status changes (e.g. Processing -> Paid) and push to NotificationProvider
  useEffect(() => {
    if (!currentUser) {
      prevPayoutStatusMapRef.current = {};
      payoutInitializedRef.current = false;
      return;
    }

    const myRequests = payoutRequests.filter(
      (r) => !r.userId || r.userId === currentUser.id
    );

    if (!payoutInitializedRef.current) {
      const initialMap: Record<string, string> = {};
      myRequests.forEach((r) => {
        initialMap[r.id] = r.status;
      });
      prevPayoutStatusMapRef.current = initialMap;
      if (myRequests.length > 0) {
        payoutInitializedRef.current = true;
      }
      return;
    }

    const formatStatus = (s: string) => {
      switch (s) {
        case 'paid':
          return isNy ? 'Zaperekedwa' : 'Paid';
        case 'processing':
          return isNy ? 'Zikukonzedwa' : 'Processing';
        case 'failed':
          return isNy ? 'Zalephera' : 'Failed';
        default:
          return isNy ? 'Zikuyang\'aniridwa' : 'Awaiting Review';
      }
    };

    const nextMap: Record<string, string> = { ...prevPayoutStatusMapRef.current };
    for (const req of myRequests) {
      const prevStatus = prevPayoutStatusMapRef.current[req.id];
      if (prevStatus && prevStatus !== req.status) {
        const transitionKey = `${req.id}:${req.status}`;
        const alreadyInProvider = notifications.some(
          (n) =>
            n.type === 'withdrawal_status' &&
            n.payoutRequestId === req.id &&
            n.payoutStatus === req.status
        );
        if (!notifiedTransitionKeysRef.current.has(transitionKey) && !alreadyInProvider) {
          notifiedTransitionKeysRef.current.add(transitionKey);
          const amountText = `${(req.netAmountMwk || req.grossAmountMwk || 0).toLocaleString()} MWK`;
          const tokenText = req.payoutToken ? ` (${req.payoutToken})` : '';
          void sendNotification({
            userId: currentUser.id,
            userEmail: currentUser.email,
            type: 'withdrawal_status',
            title:
              req.status === 'paid'
                ? isNy
                  ? 'Ndalama Zaperekedwa'
                  : 'Withdrawal Paid'
                : req.status === 'processing'
                ? isNy
                  ? 'Malipiro Akukonzedwa'
                  : 'Withdrawal Processing'
                : req.status === 'failed'
                ? isNy
                  ? 'Malipiro Alephera'
                  : 'Withdrawal Failed'
                : isNy
                ? 'Malipiro Asinthidwa'
                : 'Withdrawal Updated',
            message: isNy
              ? `Malipiro a ${amountText}${tokenText} asintha kuchoka pa ${formatStatus(prevStatus)} kupita pa ${formatStatus(req.status)}.`
              : `${amountText} payout${tokenText} moved from ${formatStatus(prevStatus)} to ${formatStatus(req.status)}.`,
            actionRoute: '/artistcreator?tab=withdrawals',
            payoutRequestId: req.id,
            payoutStatus: req.status,
          });
        }
      }
      nextMap[req.id] = req.status;
    }
    prevPayoutStatusMapRef.current = nextMap;
  }, [payoutRequests, currentUser, notifications, sendNotification]);

  const withdrawalNotifications = useMemo(
    () =>
      notifications.filter(
        (n) => n.type === 'withdrawal_status' || n.actionRoute?.includes('tab=withdrawals')
      ),
    [notifications]
  );

  const unreadWithdrawalNotifs = useMemo(
    () => withdrawalNotifications.filter((n) => !isNotificationRead(n)),
    [withdrawalNotifications, isNotificationRead]
  );

  const latestWithdrawalNotif = unreadWithdrawalNotifs[0] || withdrawalNotifications[0] || null;
  const activeProcessingCount = useMemo(
    () =>
      payoutRequests.filter(
        (r) =>
          (!currentUser || !r.userId || r.userId === currentUser.id) &&
          (r.status === 'processing' || r.status === 'awaiting_review')
      ).length,
    [payoutRequests, currentUser]
  );

  useEffect(() => {
    if (!isPayoutNotifOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        payoutNotifPopoverRef.current &&
        !payoutNotifPopoverRef.current.contains(e.target as Node)
      ) {
        setIsPayoutNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isPayoutNotifOpen]);

  const handleOpenWithdrawalsFromAlert = async () => {
    setIsPayoutNotifOpen(false);
    setActiveTab('withdrawals');
    for (const item of unreadWithdrawalNotifs) {
      await markAsRead(item.id);
    }
  };

  // Listener -> Artist application inputs
  const [upgradeStageName, setUpgradeStageName] = useState(currentUser?.name || '');
  const [upgradePrimaryGenre, setUpgradePrimaryGenre] = useState('Afro-Fusion');
  const [upgradeCountry, setUpgradeCountry] = useState(currentUser?.country || 'Malawi');
  const [upgradeBio, setUpgradeBio] = useState(currentUser?.bio || '');
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);

  // Strict owner-only creator artist profile resolution matching ownerId (or legacy ownerUserId)
  const currentArtist = useMemo(() => {
    if (!currentUser) return null;
    const ownedByOwnerId = artists.find((a) => a.ownerId === currentUser.id);
    if (ownedByOwnerId) return ownedByOwnerId;

    const ownedByLegacy = artists.find(
      (a) =>
        !a.ownerId &&
        (a.ownerUserId === currentUser.id || a.claimedByUserId === currentUser.id)
    );
    if (ownedByLegacy) return ownedByLegacy;

    if (currentUser.artistId) {
      const byId = artists.find(
        (a) =>
          a.id === currentUser.artistId &&
          !a.ownerId &&
          !a.ownerUserId &&
          !a.claimedByUserId
      );
      if (byId) return byId;
    }
    return null;
  }, [artists, currentUser]);

  const isVerifiedStudioOwner = Boolean(
    currentUser &&
      currentArtist &&
      (currentArtist.ownerId
        ? currentArtist.ownerId === currentUser.id
        : currentArtist.ownerUserId === currentUser.id ||
          currentArtist.claimedByUserId === currentUser.id ||
          (!currentArtist.ownerUserId &&
            !currentArtist.claimedByUserId &&
            currentUser.artistId === currentArtist.id))
  );

  // Sync deep-link shortcuts (?tab=withdrawals or ?view=artist-page from Artist WebApp)
  useEffect(() => {
    const requestedTab = searchParams.get('tab');
    const validTabs: StudioTab[] = [
      'overview',
      'upload',
      'tracks',
      'analytics',
      'monetization',
      'withdrawals',
    ];
    if (requestedTab && validTabs.includes(requestedTab as StudioTab)) {
      setActiveTab(requestedTab as StudioTab);
    }
    if (searchParams.get('view') === 'artist-page' && currentArtist) {
      navigate(`/artists/${currentArtist.slug || currentArtist.id}?standalone=artist`, {
        replace: true,
      });
    }
  }, [searchParams, currentArtist, navigate]);

  const myPayoutMethods = useMemo(() => {
    if (!currentUser) return [];
    return payoutMethods.filter((m) => m.userId === currentUser.id);
  }, [payoutMethods, currentUser]);

  const myPayoutRequests = useMemo(() => {
    if (!currentUser) return [];
    return payoutRequests.filter((r) => r.userId === currentUser.id);
  }, [payoutRequests, currentUser]);

  // Owner-only artist profile editor & photo upload state
  const [isEditingArtistProfile, setIsEditingArtistProfile] = useState(false);
  const [artistEditName, setArtistEditName] = useState('');
  const [artistEditCity, setArtistEditCity] = useState('');
  const [artistEditCountry, setArtistEditCountry] = useState('Malawi');
  const [artistEditBio, setArtistEditBio] = useState('');
  const [artistEditInstagram, setArtistEditInstagram] = useState('');
  const [artistEditTiktok, setArtistEditTiktok] = useState('');
  const [artistEditYoutube, setArtistEditYoutube] = useState('');
  const [isSavingArtistProfile, setIsSavingArtistProfile] = useState(false);
  const [artistProfileError, setArtistProfileError] = useState<string | null>(null);
  const artistAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const artistBannerInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingArtistAvatar, setIsUploadingArtistAvatar] = useState(false);
  const [isUploadingArtistBanner, setIsUploadingArtistBanner] = useState(false);
  const [artistAvatarProgress, setArtistAvatarProgress] = useState(0);
  const [artistBannerProgress, setArtistBannerProgress] = useState(0);
  const [optimisticArtistAvatar, setOptimisticArtistAvatar] = useState<string | null>(null);
  const [optimisticArtistBanner, setOptimisticArtistBanner] = useState<string | null>(null);

  const myTracks = useMemo(() => {
    if (!currentUser) return [];
    const artistId = currentArtist?.id;
    return tracks.filter(
      (t) =>
        t.uploadedByUserId === currentUser.id ||
        (Boolean(artistId) &&
          t.artistId === artistId &&
          (!t.uploadedByUserId || t.uploadedByUserId === currentUser.id))
    );
  }, [tracks, currentArtist?.id, currentUser]);

  // Strict Monetization Gate
  const monetizationStatus = currentArtist?.monetizationStatus || 'locked';
  const isMonetized = Boolean(
    currentArtist &&
      currentArtist.isMonetized === true &&
      monetizationStatus === 'approved'
  );

  // Real-time Firestore playback metrics & per-track earnings shared across Studio
  const liveTrackMetrics = useStudioLiveTrackMetrics({
    artistId: currentArtist?.id,
    userId: currentUser?.id,
    isMonetized,
    ratePerPlayMwk: monetizationConfig.ratePerPlayMwk,
    fallbackTracks: myTracks,
  });

  const publishedTracks = useMemo(
    () =>
      (liveTrackMetrics.songs.length > 0 ? liveTrackMetrics.songs.map((s) => s.track) : myTracks).filter(
        (t) => !t.isDraft && !t.isDeranked
      ),
    [liveTrackMetrics.songs, myTracks]
  );

  const totalPlays = liveTrackMetrics.isSynced
    ? liveTrackMetrics.totalLivePlays
    : myTracks.reduce((sum, t) => sum + (t.plays || 0), 0);

  const totalLikes = liveTrackMetrics.isSynced
    ? liveTrackMetrics.totalLikes
    : myTracks.reduce((sum, t) => sum + (t.likes || 0), 0);

  const activeStrikes = currentArtist?.copyrightStrikes || 0;
  const followersCount = currentArtist?.followersCount || 0;

  const eligibilityChecks = [
    {
      label: isNy
        ? `Nyimbo zotulutsidwa (${publishedTracks.length}/${monetizationConfig.requiredPublishedTracks})`
        : `Published tracks (${publishedTracks.length}/${monetizationConfig.requiredPublishedTracks})`,
      met: publishedTracks.length >= monetizationConfig.requiredPublishedTracks,
      current: publishedTracks.length,
      target: monetizationConfig.requiredPublishedTracks,
    },
    {
      label: isNy
        ? `Kuwerenga kwenikweni (${totalPlays.toLocaleString()}/${monetizationConfig.requiredPlays30d.toLocaleString()})`
        : `Real plays (${totalPlays.toLocaleString()}/${monetizationConfig.requiredPlays30d.toLocaleString()})`,
      met: totalPlays >= monetizationConfig.requiredPlays30d,
      current: totalPlays,
      target: monetizationConfig.requiredPlays30d,
    },
    {
      label: isNy
        ? `Otsatira (${followersCount}/${monetizationConfig.requiredFollowers})`
        : `Followers (${followersCount}/${monetizationConfig.requiredFollowers})`,
      met: followersCount >= monetizationConfig.requiredFollowers,
      current: followersCount,
      target: monetizationConfig.requiredFollowers,
    },
    {
      label: isNy
        ? `Palibe mlandu wa ufulu wa nyimbo (${activeStrikes}/${monetizationConfig.maxActiveStrikes})`
        : `Zero active copyright strikes (${activeStrikes}/${monetizationConfig.maxActiveStrikes})`,
      met: activeStrikes <= monetizationConfig.maxActiveStrikes,
      current: activeStrikes <= monetizationConfig.maxActiveStrikes ? 1 : 0,
      target: 1,
    },
  ];
  const allEligible = eligibilityChecks.every((c) => c.met);

  // ================== 3-STEP UPLOAD WIZARD STATE ==================
  const [uploadStep, setUploadStep] = useState<1 | 2 | 3>(1);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [extractedMeta, setExtractedMeta] = useState<ExtractedAudioMetadata | null>(null);
  const [probedUrlDuration, setProbedUrlDuration] = useState<number | null>(null);
  const [duplicateAudioMatch, setDuplicateAudioMatch] = useState<Track | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);

  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [coverOriginalName, setCoverOriginalName] = useState<string>('cover.webp');
  const [coverContentType, setCoverContentType] = useState<string>('image/webp');
  const [coverCompressionNote, setCoverCompressionNote] = useState<string>('');
  const [coverError, setCoverError] = useState<string | null>(null);
  const [artworkNoLogoConfirmed, setArtworkNoLogoConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);

  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Afro-Fusion');
  const [region, setRegion] = useState(currentUser?.country || 'Malawi');
  const [mood, setMood] = useState('');
  const [bpm, setBpm] = useState('110');
  const [lyrics, setLyrics] = useState('');
  const [story, setStory] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [isUploadPaused, setIsUploadPaused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const activeUploadControllerRef = useRef<ResumableUploadController | null>(null);

  // ================== TRACKS SEARCH / SORT / EDIT / DELETE STATE ==================
  const [tracksSearchQuery, setTracksSearchQuery] = useState('');
  const [tracksSortBy, setTracksSortBy] = useState<'newest' | 'plays' | 'earnings'>('newest');
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editMood, setEditMood] = useState('');
  const [editStory, setEditStory] = useState('');
  const [savingTrackId, setSavingTrackId] = useState<string | null>(null);
  const [togglingTrackId, setTogglingTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ================== MONETIZATION / PAYOUTS STATE ==================
  const [termsAcceptedForMonetization, setTermsAcceptedForMonetization] = useState(false);
  const [isRequestingMonetization, setIsRequestingMonetization] = useState(false);

  const [pmType, setPmType] = useState<PayoutProviderType>('airtel_money');
  const [pmIdentifier, setPmIdentifier] = useState('');
  const [pmHolderName, setPmHolderName] = useState(currentUser?.name || '');
  const [isAddingPm, setIsAddingPm] = useState(false);

  const [selectedPmId, setSelectedPmId] = useState('');
  const [withdrawAmountMwk, setWithdrawAmountMwk] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  // Compute real earnings ONLY when isMonetized === true
  const computedEarningsMwk = isMonetized
    ? Math.round(totalPlays * monetizationConfig.ratePerPlayMwk)
    : 0;
  const withdrawnOrPendingMwk = myPayoutRequests
    .filter((r) => r.status !== 'failed')
    .reduce((sum, r) => sum + (r.grossAmountMwk || 0), 0);
  const availableBalanceMwk = isMonetized
    ? Math.max(0, computedEarningsMwk - withdrawnOrPendingMwk)
    : 0;

  const monthlyEarningsChart = useMemo(() => {
    if (!isMonetized) return [];
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return [{ month: currentMonth, mwk: computedEarningsMwk }];
  }, [isMonetized, computedEarningsMwk]);

  const handleRefreshEarnings = async () => {
    setIsRefreshingEarnings(true);
    try {
      if (currentArtist?.id) {
        await getDoc(doc(db, 'artists', currentArtist.id)).catch(() => {});
      }
      setEarningsRefreshKey((k) => k + 1);
      showNotice(isNy ? 'Ndalama zonse zatsitsimutsidwa.' : 'Total earnings refreshed.');
    } finally {
      window.setTimeout(() => setIsRefreshingEarnings(false), 320);
    }
  };

  // Handlers
  const handleAudioFile = async (file: File) => {
    setUploadError(null);
    setDuplicateAudioMatch(null);
    setExtractedMeta(null);
    setAudioFile(null);
    setIsAnalyzingAudio(true);
    try {
      const validated = await validateTrack(file);
      setAudioFile(validated.file);
      setExtractedMeta(validated.metadata);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim());
      }
      const dup = tracks.find(
        (t) =>
          t.audioChecksum &&
          validated.metadata.audioChecksum &&
          t.audioChecksum === validated.metadata.audioChecksum
      );
      if (dup) {
        setDuplicateAudioMatch(dup);
      }
    } catch (err) {
      setAudioFile(null);
      setUploadError(
        err instanceof Error
          ? err.message
          : isNy
          ? 'Sitinathe kutsimikizira fayilo ya nyimboyi.'
          : 'Could not verify audio file.'
      );
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleCoverFile = async (file: File) => {
    setCoverError(null);
    try {
      const compressed = await compressImage(file, 'cover');
      if (coverPreview && coverPreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreview);
      }
      setCoverBlob(compressed.blob);
      setCoverPreview(compressed.previewUrl);
      setCoverOriginalName(file.name);
      setCoverContentType(compressed.contentType || 'image/webp');
      const kb = Math.max(1, Math.round(compressed.compressedBytes / 1024));
      setCoverCompressionNote(
        isNy
          ? `${compressed.width}×${compressed.height} · ${kb} KB yofupikitsidwa`
          : `${compressed.width}×${compressed.height} · ${kb} KB compressed`
      );
    } catch (err) {
      setCoverError(
        err instanceof Error
          ? err.message
          : isNy
          ? 'Ikani chithunzi chomveka cha chikuto (osachepera 200 × 200 px).'
          : 'Upload a clear cover photo (at least 200 × 200 px).'
      );
    }
  };

  const resetUploadWizard = () => {
    if (coverPreview && coverPreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverPreview);
    }
    setUploadStep(1);
    setAudioFile(null);
    setAudioUrlInput('');
    setExtractedMeta(null);
    setProbedUrlDuration(null);
    setDuplicateAudioMatch(null);
    setCoverBlob(null);
    setCoverPreview('');
    setCoverContentType('image/webp');
    setCoverCompressionNote('');
    setCoverError(null);
    setArtworkNoLogoConfirmed(false);
    setRightsConfirmed(false);
    setTitle('');
    setMood('');
    setLyrics('');
    setStory('');
    setUploadProgress(0);
    setIsUploadPaused(false);
    setUploadStatusText('');
    setUploadError(null);
    activeUploadControllerRef.current = null;
  };

  const handlePublishOrDraft = async (saveAsDraft: boolean) => {
    if (!currentUser) return;
    setUploadError(null);

    if (!audioFile && !isValidHttpsUrl(audioUrlInput)) {
      setUploadError(
        isNy
          ? 'Sankhani fayilo ya nyimbo kapena ikani ulalo wa HTTPS.'
          : 'Select an audio file or provide a valid HTTPS audio link.'
      );
      setUploadStep(1);
      return;
    }
    if (!title.trim()) {
      setUploadError(isNy ? 'Lembani dzina la nyimbo.' : 'Enter a track title.');
      setUploadStep(2);
      return;
    }
    if (coverBlob && !artworkNoLogoConfirmed) {
      setUploadError(
        isNy
          ? 'Chonde chongani bokosi lotsimikizira chithunzi cha nyimbo.'
          : 'Please confirm the cover artwork checkbox.'
      );
      setUploadStep(2);
      return;
    }
    if (!rightsConfirmed) {
      setUploadError(
        isNy
          ? 'Chonde tsimikizirani kuti muli ndi ufulu wofalitsa nyimboyi.'
          : 'Please confirm that you own or control the audio rights.'
      );
      setUploadStep(2);
      return;
    }

    const trackId = `track-${Date.now()}`;
    const artistId = currentArtist?.id || currentUser.artistId || `artist-${currentUser.id.slice(0, 10)}`;
    const artistName = currentArtist?.name || currentUser.name;

    setIsUploading(true);
    setIsUploadPaused(false);
    setUploadProgress(5);

    try {
      let finalAudioUrl = audioUrlInput.trim();
      let storageAudioPath: string | undefined;
      let durationSeconds = extractedMeta?.durationSeconds || probedUrlDuration || 0;

      if (!finalAudioUrl && !audioFile) {
        throw new Error('No audio source selected.');
      }

      if (audioFile) {
        await saveAudioBlob(trackId, audioFile).catch(() => {});
      }

      // Guarantee canonical Firestore artist profile exists & is owner-linked before writing track
      try {
        const artistRef = doc(db, 'artists', artistId);
        const artistSnap = await getDoc(artistRef);
        if (!artistSnap.exists()) {
          const nowIso = new Date().toISOString();
          await setDoc(artistRef, {
            id: artistId,
            name: artistName,
            handle: `@${currentUser.username || artistName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'artist'}`,
            country: currentUser.country || 'Malawi',
            city: currentUser.city || '',
            location: currentUser.city
              ? `${currentUser.city}, ${currentUser.country || 'Malawi'}`
              : currentUser.country || 'Malawi',
            genres: [genre || 'Afro-Fusion'],
            bio: currentUser.bio || '',
            avatar: currentArtist?.avatar || currentUser.avatar || DEFAULT_AVATAR_SVG,
            banner: currentArtist?.banner || '',
            followersCount: currentArtist?.followersCount || 0,
            likesCount: currentArtist?.likesCount || 0,
            likedByUserIds: [],
            monthlyListeners: currentArtist?.monthlyListeners || 0,
            verified: false,
            isCertified: false,
            isMonetized: false,
            monetizationStatus: 'locked',
            earningsBalanceMwk: 0,
            joinedDate: nowIso,
            socials: {},
            contactEmail: currentUser.email || '',
            ownerUserId: currentUser.id,
            claimedByUserId: currentUser.id,
          });
        }
      } catch (err) {
        console.warn('Artist profile preflight check:', err);
      }

      setUploadStatusText(
        coverBlob
          ? isNy
            ? 'Kukweza nyimbo ndi chithunzi chofupikitsidwa...'
            : 'Uploading audio & compressed artwork...'
          : isNy
          ? 'Kukweza nyimbo...'
          : 'Uploading audio...'
      );
      let audioPct = audioFile ? 0 : 100;
      let coverPct = coverBlob ? 0 : 100;
      const syncCombinedProgress = () => {
        const combined = Math.round(audioPct * 0.72 + coverPct * 0.22);
        setUploadProgress(Math.max(5, Math.min(94, combined)));
      };

      const audioUploadPromise = audioFile
        ? uploadValidatedTrackAudio({
            ownerId: currentUser.id,
            trackId,
            file: audioFile,
            checksum: extractedMeta?.audioChecksum,
            onControllerReady: (controller) => {
              activeUploadControllerRef.current = controller;
            },
            onProgress: (snap) => {
              audioPct = snap.percent;
              setIsUploadPaused(snap.state === 'paused');
              setUploadStatusText(
                snap.state === 'paused'
                  ? isNy
                    ? 'Kukweza kwayimitsidwa — dinani Pitirizani'
                    : 'Upload paused — tap Resume to continue'
                  : coverBlob
                  ? isNy
                    ? 'Kukweza nyimbo ndi chithunzi chofupikitsidwa...'
                    : 'Uploading audio & compressed artwork...'
                  : isNy
                  ? 'Kukweza nyimbo...'
                  : 'Uploading audio...'
              );
              syncCombinedProgress();
            },
          })
        : Promise.resolve(null);

      const urlProbePromise =
        !audioFile && !durationSeconds && finalAudioUrl
          ? probeAudioUrlMetadata(finalAudioUrl).catch(() => null)
          : Promise.resolve(null);

      const coverUploadPromise = coverBlob
        ? uploadTrackCoverArtwork({
            ownerId: currentUser.id,
            trackId,
            blob: coverBlob,
            originalFilename: coverOriginalName,
            contentType: coverContentType,
            onProgress: (snap) => {
              coverPct = snap.percent;
              syncCombinedProgress();
            },
          })
        : Promise.resolve({
            downloadUrl: LOWERVIBE_ICON_ARTWORK,
            storagePath: undefined as string | undefined,
          });

      const [audioRes, probedRes, coverRes] = await Promise.all([
        audioUploadPromise,
        urlProbePromise,
        coverUploadPromise,
      ]);

      if (audioRes) {
        finalAudioUrl = audioRes.downloadUrl;
        storageAudioPath = audioRes.storagePath;
      } else if (probedRes) {
        durationSeconds = probedRes.durationSeconds;
      }

      setUploadStatusText(isNy ? 'Kusunga zambiri za nyimbo...' : 'Saving track details...');
      setUploadProgress(96);
      const canonicalGenre = normalizeGenreCategory(genre);
      await upsertGenre(canonicalGenre, { region }).catch((err) => {
        console.warn('Genre catalog update skipped:', err);
      });

      const resolvedDuration = Math.max(1, Math.round(durationSeconds));
      const cleanBpm = Math.max(40, Math.min(240, parseInt(bpm, 10) || 110));

      const cleanMood = mood.trim();
      const savedTrack = await saveNewTrack({
        id: trackId,
        title: title.trim(),
        artistId,
        artistName,
        artistAvatar: currentArtist?.avatar || currentUser.avatar || DEFAULT_AVATAR_SVG,
        coverArt: coverRes.downloadUrl || LOWERVIBE_ICON_ARTWORK,
        audioUrl: finalAudioUrl,
        storageAudioPath,
        ...(coverRes.storagePath ? { storageCoverPath: coverRes.storagePath } : {}),
        audioChecksum: extractedMeta?.audioChecksum,
        verifiedMetadata: true,
        uploadedByUserId: currentUser.id,
        artworkRightsConfirmed: true,
        synthPreset: 'rainy_rhodes',
        durationSeconds: resolvedDuration,
        metadata: {
          Duration: resolvedDuration,
          duration: resolvedDuration,
          durationFormatted: formatTime(resolvedDuration),
          bitrate: extractedMeta?.bitrateLabel,
          sampleRate: extractedMeta ? `${extractedMeta.sampleRate} Hz` : undefined,
          bitDepth: extractedMeta?.bitDepth,
          fileSize: extractedMeta?.fileSizeFormatted,
          audioFormat: extractedMeta?.audioFormat,
          bpm: cleanBpm,
          checksum: extractedMeta?.audioChecksum,
          verifiedSource: audioFile ? 'firebase_storage' : 'https_stream',
        },
        genre: canonicalGenre,
        mood: cleanMood || undefined,
        region,
        vibeTags: [canonicalGenre, ...(cleanMood ? [cleanMood] : [])].filter(Boolean),
        bpm: cleanBpm,
        lyrics: lyrics.trim() || undefined,
        story: story.trim() || undefined,
        downloadable: true,
        isCertified: false,
        isMaster24Bit: Boolean(extractedMeta?.isMaster24Bit),
        waveformData: extractedMeta?.waveformData,
        audioFormat: extractedMeta?.audioFormat,
        fileSize: extractedMeta?.fileSizeFormatted,
        bitrate: extractedMeta?.bitrateLabel,
        isDraft: saveAsDraft,
      });

      setUploadProgress(100);
      resetUploadWizard();
      setActiveTab('tracks');
      if (saveAsDraft) {
        showNotice(isNy ? 'Zasungidwa m\'zolembedwa.' : 'Saved as draft.');
      } else {
        setPublishedCelebrationTrack(savedTrack);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : isNy ? 'Kukweza kwalephera.' : 'Upload failed.';
      setUploadError(msg);
      showNotice(msg, 'err');
    } finally {
      activeUploadControllerRef.current = null;
      setIsUploadPaused(false);
      setIsUploading(false);
    }
  };

  const handleArtistAvatarUpload = async (file: File) => {
    if (!currentUser || !currentArtist || !isVerifiedStudioOwner) {
      const msg = isNy
        ? 'Choletsedwa: mwini wa mbiri ya wojambula yekha ndiye angathe kukweza chithunzi cha mbiri.'
        : 'Permission denied: only the artist profile owner can upload a profile photo.';
      setArtistProfileError(msg);
      showNotice(msg, 'err');
      return;
    }
    setArtistProfileError(null);
    setIsUploadingArtistAvatar(true);
    setArtistAvatarProgress(10);
    let localPreview: string | null = null;
    try {
      const uploaded = await uploadCompressedAvatar({
        userId: currentUser.id,
        artistId: currentArtist.id,
        file,
        onPreviewReady: (previewUrl) => {
          localPreview = previewUrl;
          setOptimisticArtistAvatar(previewUrl);
        },
        onProgress: (snap) => setArtistAvatarProgress(snap.percent),
      });
      const oldPath = currentArtist.storageAvatarPath;
      const res = await updateArtistProfile(currentArtist.id, {
        avatar: uploaded.downloadUrl,
        storageAvatarPath: uploaded.storagePath,
      });
      if (!res.success) {
        await deleteUploadedStoragePaths([uploaded.storagePath]).catch(() => {});
        setOptimisticArtistAvatar(null);
        const msg =
          res.error ||
          (isNy ? 'Sitinathe kusunga chithunzi cha mbiri ya wojambula.' : 'Could not save artist profile photo.');
        setArtistProfileError(msg);
        showNotice(msg, 'err');
        return;
      }
      if (oldPath && oldPath !== uploaded.storagePath) {
        deleteUploadedStoragePaths([oldPath]).catch(() => {});
      }
      setOptimisticArtistAvatar(null);
      showNotice(isNy ? 'Chithunzi cha mbiri ya wojambula chasinthidwa.' : 'Artist profile photo updated.');
    } catch (err) {
      setOptimisticArtistAvatar(null);
      const msg =
        err instanceof Error
          ? err.message
          : isNy
          ? 'Sitinathe kukweza chithunzi cha mbiri ya wojambula.'
          : 'Could not upload artist profile photo.';
      setArtistProfileError(msg);
      showNotice(msg, 'err');
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setIsUploadingArtistAvatar(false);
      setArtistAvatarProgress(0);
    }
  };

  const handleArtistBannerUpload = async (file: File) => {
    if (!currentUser || !currentArtist || !isVerifiedStudioOwner) {
      const msg = isNy
        ? 'Choletsedwa: mwini wa mbiri ya wojambula yekha ndiye angathe kukweza chithunzi chakumbuyo.'
        : 'Permission denied: only the artist profile owner can upload a cover photo.';
      setArtistProfileError(msg);
      showNotice(msg, 'err');
      return;
    }
    setArtistProfileError(null);
    setIsUploadingArtistBanner(true);
    setArtistBannerProgress(10);
    let localPreview: string | null = null;
    try {
      const uploaded = await uploadCompressedCoverBanner({
        userId: currentUser.id,
        artistId: currentArtist.id,
        file,
        onPreviewReady: (previewUrl) => {
          localPreview = previewUrl;
          setOptimisticArtistBanner(previewUrl);
        },
        onProgress: (snap) => setArtistBannerProgress(snap.percent),
      });
      const oldPath = currentArtist.storageBannerPath;
      const res = await updateArtistProfile(currentArtist.id, {
        banner: uploaded.downloadUrl,
        storageBannerPath: uploaded.storagePath,
      });
      if (!res.success) {
        await deleteUploadedStoragePaths([uploaded.storagePath]).catch(() => {});
        setOptimisticArtistBanner(null);
        const msg =
          res.error ||
          (isNy ? 'Sitinathe kusunga chithunzi chachikulu cha wojambula.' : 'Could not save artist cover photo.');
        setArtistProfileError(msg);
        showNotice(msg, 'err');
        return;
      }
      if (oldPath && oldPath !== uploaded.storagePath) {
        deleteUploadedStoragePaths([oldPath]).catch(() => {});
      }
      setOptimisticArtistBanner(null);
      showNotice(isNy ? 'Chithunzi chachikulu cha wojambula chasinthidwa.' : 'Artist cover photo updated.');
    } catch (err) {
      setOptimisticArtistBanner(null);
      const msg =
        err instanceof Error
          ? err.message
          : isNy
          ? 'Sitinathe kukweza chithunzi chachikulu cha wojambula.'
          : 'Could not upload artist cover photo.';
      setArtistProfileError(msg);
      showNotice(msg, 'err');
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setIsUploadingArtistBanner(false);
      setArtistBannerProgress(0);
    }
  };

  const handleDeleteTrackConfirm = async (track: Track) => {
    setDeletingTrackId(track.id);
    const res = await deleteTrack(track.id);
    setDeletingTrackId(null);
    if (!res.success) {
      showNotice(res.error || (isNy ? 'Sitinathe kufufuta nyimbo.' : 'Could not delete track.'), 'err');
      return;
    }
    deleteUploadedStoragePaths([track.storageAudioPath, track.storageCoverPath]).catch(() => {});
    setConfirmDeleteId(null);
    showNotice(isNy ? `Yafufutidwa "${track.title}".` : `Deleted "${track.title}".`);
  };

  const handleAddPayoutMethodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await requireReauth(
      isNy
        ? 'Tsimikizirani kuti ndi inu musanawonjezere njira yolandirira ndalama.'
        : 'Confirm it is you before adding a payout method.'
    );
    if (!ok) return;

    setIsAddingPm(true);
    const res = await addPayoutMethod({
      type: pmType,
      identifier: pmIdentifier,
      accountHolderName: pmHolderName,
      artistId: currentArtist?.id,
    });
    setIsAddingPm(false);
    if (res.success) {
      setPmIdentifier('');
      showNotice(
        isMonetized || allEligible
          ? isNy
            ? 'Njira yolandirira ndalama yavomerezedwa yokha.'
            : 'Payout method accepted automatically.'
          : isNy
          ? 'Njira yolandirira ndalama yasungidwa.'
          : 'Payout method saved.'
      );
    } else {
      showNotice(res.error || (isNy ? 'Sitinathe kuwonjezera njira yolandirira ndalama.' : 'Could not add payout method.'), 'err');
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentArtist) return;
    const amount = Number(withdrawAmountMwk);
    if (!Number.isFinite(amount) || amount < monetizationConfig.minWithdrawalMwk) {
      showNotice(
        isNy
          ? `Ndalama zochepa kwambiri zotulutsa ndi ${monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK.`
          : `Minimum withdrawal is ${monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK.`,
        'err'
      );
      return;
    }
    if (amount > availableBalanceMwk) {
      showNotice(isNy ? 'Ndalama zapyola zomwe zilipo pa akaunti yanu.' : 'Amount exceeds your available balance.', 'err');
      return;
    }
    const methodId =
      selectedPmId || myPayoutMethods.find((m) => m.isDefault)?.id || myPayoutMethods[0]?.id;
    if (!methodId) {
      showNotice(isNy ? 'Onjezerani njira yolandirira ndalama kaye.' : 'Add a payout method first.', 'err');
      return;
    }

    const ok = await requireReauth(
      isNy
        ? 'Tsimikizirani umunthu wanu musanatumize pempho lotulutsa ndalama.'
        : 'Confirm your identity before submitting a withdrawal.'
    );
    if (!ok) return;

    setIsSubmittingWithdraw(true);
    const res = await submitPayoutRequest({
      artistId: currentArtist.id,
      artistName: currentArtist.name,
      payoutMethodId: methodId,
      grossAmountMwk: amount,
    });
    setIsSubmittingWithdraw(false);
    if (res.success) {
      setWithdrawAmountMwk('');
      const tok = res.request?.payoutToken ? ` · ${isNy ? 'Chizindikiro' : 'Token'} ${res.request.payoutToken}` : '';
      showNotice(
        res.request?.settlementVerified
          ? `${isNy ? 'Kutulutsa ndalama kwatumizidwa' : 'Withdrawal dispatched'}${tok}`
          : `${isNy ? 'Kutulutsa ndalama kwatsimikiziridwa ndipo kuli pamzere' : 'Withdrawal verified & queued'}${tok}`
      );
    } else {
      showNotice(res.error || (isNy ? 'Kutulutsa ndalama kwalephera.' : 'Withdrawal failed.'), 'err');
    }
  };

  // Sign-in required
  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 pb-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
          <Music className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--text)]">{translate('studio_signin_title')}</h1>
        <p className="text-sm text-[var(--text-muted)]">{translate('studio_signin_sub')}</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer"
        >
          {translate('sign_in')}
        </button>
      </div>
    );
  }

  // Listener / Non-owner Artist Application Wait Page & Submission Gate
  // Note: Admin role does NOT bypass artist ownership in Studio; admins manage platform moderation in /administrationside.
  if (!isArtist && !isVerifiedStudioOwner) {
    if (currentUser.applicationStatus === 'pending') {
      const app = currentUser.artistApplication;
      return (
        <div className="max-w-xl mx-auto px-4 py-8 pb-6 animate-fadeIn">
          <div className="rounded-[28px] bg-[var(--surface)] border border-[var(--border-strong)] p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-[var(--violet)] block">
                  {translate('studio_pending_badge')}
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)]">
                  {translate('studio_pending_title')}
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mx-auto leading-relaxed">
                  {translate('studio_pending_sub')}
                </p>
              </div>
            </div>

            {app && (
              <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">
                    {isNy ? 'Dzina la Woimba' : 'Artist / Stage name'}
                  </span>
                  <span className="font-bold text-[var(--text)]">{app.stageName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">
                    {isNy ? 'Mtundu waukulu' : 'Primary genre'}
                  </span>
                  <span className="font-semibold text-[var(--text)]">
                    {translateGenreCategory(app.primaryGenre, language)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{isNy ? 'Dziko' : 'Country'}</span>
                  <span className="font-semibold text-[var(--text)]">{app.country}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">{isNy ? 'Tsiku' : 'Submitted'}</span>
                  <span className="font-mono tabular-nums text-[var(--text)]">
                    {new Date(app.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                <span className="text-[var(--text)] font-medium">
                  {isNy ? '1. Pempho la woimba lalandiridwa' : '1. Artist submission received'}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]/60 border border-[var(--border)]">
                <Clock className="w-4 h-4 text-[var(--violet)] shrink-0" />
                <span className="text-[var(--text)] font-medium">
                  {isNy ? '2. Tikuyang\'anira zambiri zanu' : '2. Reviewing profile & creator details'}
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-2)]/40 border border-[var(--border)] text-[var(--text-muted)]">
                <Music className="w-4 h-4 shrink-0" />
                <span>
                  {isNy
                    ? '3. Kwezani nyimbo ndi kuona ndalama mukavomerezedwa'
                    : '3. Upload tracks & track earnings once approved'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="flex-1 py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer min-h-[48px]"
              >
                {translate('studio_back_home')}
              </button>
              <button
                type="button"
                onClick={() => navigate('/account')}
                className="flex-1 py-3 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm cursor-pointer min-h-[48px]"
              >
                {translate('studio_go_profile')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const wasRejected = currentUser.applicationStatus === 'rejected';
    return (
      <div className="max-w-lg mx-auto px-4 py-8 pb-6 animate-fadeIn">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const cleanStage = upgradeStageName.trim();
            if (cleanStage.length < 2) {
              showNotice(
                isNy
                  ? 'Lembani dzina lanu la woimba (osachepera zilembo ziwiri).'
                  : 'Enter your artist or stage name (at least 2 characters).',
                'err'
              );
              return;
            }
            setIsSubmittingApplication(true);
            try {
              submitArtistApplication({
                userId: currentUser.id,
                userEmail: currentUser.email || '',
                stageName: cleanStage,
                legalName: currentUser.name || cleanStage,
                country: upgradeCountry || 'Malawi',
                primaryGenre: normalizeGenreCategory(upgradePrimaryGenre) || 'Afro-Fusion',
                bio: upgradeBio.trim(),
                avatarUrl: currentUser.avatar,
                rightsConfirmed: true,
              });
              showNotice(
                isNy
                  ? 'Pempho la woimba latumizidwa! Chonde dikirani kuvomerezedwa.'
                  : 'Artist application submitted! Please wait for approval.'
              );
            } finally {
              setIsSubmittingApplication(false);
            }
          }}
          className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 space-y-5 text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
            <UploadCloud className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold font-heading text-[var(--text)]">
              {wasRejected ? translate('studio_reapply_title') : translate('studio_apply_title')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              {translate('studio_apply_sub')}
            </p>
          </div>

          {wasRejected && currentUser.artistApplication?.adminFeedback && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)] text-left text-xs text-[var(--danger)] space-y-1">
              <div className="font-bold">
                {isNy ? 'Ndemanga yapita:' : 'Previous review note:'}
              </div>
              <div>{currentUser.artistApplication.adminFeedback}</div>
            </div>
          )}

          <div className="space-y-3 text-left">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)]">
                {isNy ? 'Dzina la Woimba' : 'Artist / Stage name'}
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={upgradeStageName}
                onChange={(e) => setUpgradeStageName(e.target.value)}
                placeholder={isNy ? 'Dzina lanu loimbira' : 'Your artist name'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Mtundu waukulu' : 'Primary genre'}
                </label>
                <GenreSelectOrCustom
                  value={upgradePrimaryGenre}
                  onChange={setUpgradePrimaryGenre}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Dziko' : 'Country'}
                </label>
                <RegionSelect
                  value={upgradeCountry}
                  onChange={setUpgradeCountry}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)]">
                {isNy ? 'Zambiri za nyimbo zanu (ngati mukufuna)' : 'About your sound (optional)'}
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={upgradeBio}
                onChange={(e) => setUpgradeBio(e.target.value)}
                placeholder={isNy ? 'Fotokozani mwachidule za nyimbo zanu...' : 'Share a short intro about your music...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingApplication}
            className="w-full py-3.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm cursor-pointer disabled:opacity-60 min-h-[48px]"
          >
            {isSubmittingApplication ? translate('studio_submitting') : translate('studio_submit_btn')}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-6 space-y-6 animate-fadeIn">
      {/* Song Upload Celebration Modal (🎊) */}
      {publishedCelebrationTrack && (
        <div
          className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
          onClick={() => setPublishedCelebrationTrack(null)}
        >
          <div
            role="dialog"
            aria-label="Song upload celebration"
            className="relative w-full max-w-md rounded-[28px] bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl p-6 sm:p-7 text-center space-y-5 text-[var(--text)] animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPublishedCelebrationTrack(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition cursor-pointer"
              aria-label="Close celebration"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mx-auto w-24 h-24 rounded-2xl overflow-hidden border-2 border-[var(--accent)] shadow-lg bg-[var(--surface-2)]">
              <img
                src={publishedCelebrationTrack.coverArt || DEFAULT_ARTWORK_SVG}
                alt={publishedCelebrationTrack.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2">
              <p className="text-3xl leading-none" aria-hidden="true">
                🎊
              </p>
              <h2 className="text-xl sm:text-2xl font-extrabold font-heading text-[var(--text)]">
                {isNy ? 'Zabwino! Nyimbo yanu yafika pa intaneti' : 'Congratulations! Your song is live'}
              </h2>
              <p className="text-sm font-bold text-[var(--accent-text)] truncate">
                “{publishedCelebrationTrack.title}”
              </p>
              <p className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
                {translateGenreCategory(publishedCelebrationTrack.genre, language)} ·{' '}
                {formatTime(publishedCelebrationTrack.durationSeconds)} · {publishedCelebrationTrack.region}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const chosen = publishedCelebrationTrack;
                  setPublishedCelebrationTrack(null);
                  playTrack(chosen);
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{translate('play_now')}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const chosen = publishedCelebrationTrack;
                  setPublishedCelebrationTrack(null);
                  setActiveShareTrack(chosen);
                }}
                className="py-3 px-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
              >
                <Share2 className="w-4 h-4" />
                <span>{translate('share')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold flex items-center gap-2 ${
            notice.type === 'err'
              ? 'bg-[var(--surface)] border-[var(--danger)] text-[var(--danger)]'
              : 'bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]'
          }`}
        >
          {notice.type === 'err' ? (
            <AlertCircle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Studio Header */}
      <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        {(optimisticArtistBanner || (currentArtist?.banner && currentArtist.banner !== DEFAULT_BANNER_SVG)) && (
          <div className="w-full h-28 sm:h-36 bg-[var(--surface-2)] border-b border-[var(--border)] overflow-hidden">
            <img
              src={optimisticArtistBanner || currentArtist?.banner || DEFAULT_BANNER_SVG}
              alt={`${currentArtist?.name || currentUser.name} cover`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={optimisticArtistAvatar || currentArtist?.avatar || currentUser.avatar || DEFAULT_AVATAR_SVG}
              alt={currentArtist?.name || currentUser.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text)] truncate">
                  {currentArtist?.name || currentUser.name}
                </h1>
                {currentArtist?.verified && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--accent-text)]">
                    {translate('verified')}
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {isNy
                  ? `Situdiyo · Nyimbo ${myTracks.length}`
                  : `Studio · ${myTracks.length} track${myTracks.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(unreadWithdrawalNotifs.length > 0 ||
              withdrawalNotifications.length > 0 ||
              activeProcessingCount > 0) && (
              <div className="relative" ref={payoutNotifPopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsPayoutNotifOpen((prev) => !prev)}
                  className={`relative px-3.5 py-2 rounded-full border text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                    unreadWithdrawalNotifs.length > 0
                      ? latestWithdrawalNotif?.payoutStatus === 'paid'
                        ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-500 shadow-sm'
                        : latestWithdrawalNotif?.payoutStatus === 'failed'
                        ? 'bg-[var(--danger)]/15 border-[var(--danger)]/45 text-[var(--danger)] shadow-sm'
                        : 'bg-[var(--violet)]/15 border-[var(--violet)]/45 text-[var(--violet)] shadow-sm'
                      : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]'
                  }`}
                  aria-label={isNy ? 'Zidziwitso za malipiro' : 'Withdrawal status notifications'}
                  title={isNy ? 'Zidziwitso za malipiro' : 'Real-time withdrawal status alerts'}
                >
                  {unreadWithdrawalNotifs.length > 0 ? (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                    </span>
                  ) : null}
                  {unreadWithdrawalNotifs.length > 0 ? (
                    <BellRing className="w-3.5 h-3.5" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {unreadWithdrawalNotifs.length > 0
                      ? latestWithdrawalNotif?.title || (isNy ? 'Uthenga wa Malipiro' : 'Payout Update')
                      : activeProcessingCount > 0
                      ? isNy
                        ? `Malipiro ${activeProcessingCount} Akukonzedwa`
                        : `${activeProcessingCount} Pending Payout`
                      : isNy
                      ? 'Zidziwitso za Malipiro'
                      : 'Payout Alerts'}
                  </span>
                  {unreadWithdrawalNotifs.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-current/15 text-[10px] font-mono tabular-nums">
                      {unreadWithdrawalNotifs.length}
                    </span>
                  )}
                </button>

                {isPayoutNotifOpen && (
                  <div
                    role="dialog"
                    aria-label={isNy ? 'Zidziwitso za malipiro' : 'Withdrawal status alerts'}
                    className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-[22px] bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden animate-slideUp"
                  >
                    <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-extrabold text-[var(--text)]">
                          {isNy ? 'Zidziwitso za Malipiro' : 'Withdrawal Status Alerts'}
                        </div>
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">
                          {unreadWithdrawalNotifs.length > 0
                            ? isNy
                              ? `Zosawerengedwa ${unreadWithdrawalNotifs.length}`
                              : `${unreadWithdrawalNotifs.length} unread update${unreadWithdrawalNotifs.length === 1 ? '' : 's'}`
                            : isNy
                            ? 'Malipiro akugwirizana panthawiyi'
                            : 'Live payout status synced'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenWithdrawalsFromAlert}
                        className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[11px] font-bold cursor-pointer"
                      >
                        {isNy ? 'Tsegulani Malipiro' : 'Open Withdrawals'}
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
                      {withdrawalNotifications.length === 0 ? (
                        <div className="p-4 text-xs text-[var(--text-muted)] text-center">
                          {activeProcessingCount > 0
                            ? isNy
                              ? `Mapempho ${activeProcessingCount} akutenga ndalama akukonzedwa.`
                              : `${activeProcessingCount} withdrawal request${activeProcessingCount === 1 ? ' is' : 's are'} currently being processed.`
                            : isNy
                            ? 'Palibe kusintha kwa malipiro pakadali pano.'
                            : 'No withdrawal status changes yet.'}
                        </div>
                      ) : (
                        withdrawalNotifications.slice(0, 6).map((item) => {
                          const read = isNotificationRead(item);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={async () => {
                                if (!read) await markAsRead(item.id);
                                setIsPayoutNotifOpen(false);
                                setActiveTab('withdrawals');
                              }}
                              className={`w-full p-3.5 text-left hover:bg-[var(--surface-2)]/70 transition cursor-pointer flex items-start gap-2.5 ${
                                !read ? 'bg-[var(--surface-2)]/40' : ''
                              }`}
                            >
                              <span
                                className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                  item.payoutStatus === 'paid'
                                    ? 'bg-emerald-500'
                                    : item.payoutStatus === 'failed'
                                    ? 'bg-[var(--danger)]'
                                    : 'bg-[var(--violet)]'
                                }`}
                              />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[var(--text)] truncate">
                                    {item.title}
                                  </span>
                                  {!read && (
                                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent-text)] font-bold">
                                      {isNy ? 'Zatsopano' : 'New'}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                                  {item.message}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => openPwaInstallPrompt('creator')}
              className="px-3.5 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--accent-text)] flex items-center gap-1.5 cursor-pointer"
              title={isNy ? 'Ikani Pulogalamu ya Woimba' : 'Install standalone LOWERVIBE Creator App (Android & iPhone)'}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{translate('creator_app')}</span>
            </button>
            {currentArtist && (
              <button
                type="button"
                onClick={() => navigate(`/artists/${currentArtist.slug || currentArtist.id}`)}
                className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{translate('view_artist_btn')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{translate('upload')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6 Studio Tabs including dedicated Withdrawals dashboard */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'overview' as const, label: translate('studio_tab_overview'), icon: ShieldCheck },
          { id: 'upload' as const, label: translate('studio_tab_upload'), icon: UploadCloud },
          { id: 'tracks' as const, label: translate('studio_tab_tracks', undefined, { count: myTracks.length }), icon: Music },
          { id: 'analytics' as const, label: translate('studio_tab_analytics'), icon: BarChart3 },
          { id: 'monetization' as const, label: translate('studio_tab_monetization'), icon: DollarSign },
          { id: 'withdrawals' as const, label: translate('studio_tab_withdrawals'), icon: Wallet },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'withdrawals' && unreadWithdrawalNotifs.length > 0) {
                  unreadWithdrawalNotifs.forEach((n) => {
                    void markAsRead(n.id);
                  });
                }
              }}
              className={`px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-2 cursor-pointer transition ${
                active
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-bold'
                  : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === 'withdrawals' && unreadWithdrawalNotifs.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-mono font-bold tabular-nums">
                  {unreadWithdrawalNotifs.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: OVERVIEW ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)]">{translate('studio_published_songs')}</div>
              <div className="text-2xl font-extrabold text-[var(--text)] mt-1 tabular-nums">
                {publishedTracks.length}
              </div>
            </div>
            <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)]">{translate('studio_real_plays')}</div>
              <div className="text-2xl font-extrabold text-[var(--text)] mt-1 tabular-nums">
                {totalPlays.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)]">{translate('studio_track_likes')}</div>
              <div className="text-2xl font-extrabold text-[var(--text)] mt-1 tabular-nums">
                {totalLikes.toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-[20px] bg-[var(--surface)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)]">{translate('followers')}</div>
              <div className="text-2xl font-extrabold text-[var(--text)] mt-1 tabular-nums">
                {followersCount.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                {translate('studio_total_earnings')}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text)] tabular-nums">
                <CountUpValue value={computedEarningsMwk} suffix=" MWK" replayKey={earningsRefreshKey} />
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                {isMonetized
                  ? isNy
                    ? `Zolipo: ${availableBalanceMwk.toLocaleString()} MWK · Mtengo: ${monetizationConfig.ratePerPlayMwk} MWK/nyimbo`
                    : `Available: ${availableBalanceMwk.toLocaleString()} MWK · Rate: ${monetizationConfig.ratePerPlayMwk} MWK/play`
                  : allEligible
                  ? isNy
                    ? 'Mwakwaniritsa zofunikira zonse! Malipiro atsegulidwa.'
                    : 'You meet every requirement! Monetization activates automatically when enabled.'
                  : monetizationStatus === 'pending'
                  ? isNy
                    ? 'Mbiri yanu ivomerezedwa ikakwaniritsa zofunikira.'
                    : 'Your profile will be automatically approved once eligibility milestones are reached.'
                  : isNy
                  ? 'Kwaniritsani zofunikira ku gawo la Malipiro kuti muyambe kupeza ndalama.'
                  : 'Meet all eligibility requirements in Monetization to unlock earnings.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleRefreshEarnings}
                disabled={isRefreshingEarnings}
                aria-label={isNy ? 'Tsitsimutsa Ndalama' : 'Refresh Total Earnings'}
                className="px-3.5 py-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEarnings ? 'animate-spin' : ''}`} />
                <span>{isNy ? 'Tsitsimutsa' : 'Refresh'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('withdrawals')}
                className="px-4 py-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-bold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                <span>{translate('studio_tab_withdrawals')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('monetization')}
                className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
              >
                {isMonetized
                  ? isNy
                    ? 'Tsegulani Ndalama'
                    : 'Open Earnings'
                  : isNy
                  ? 'Onani Zofunikira'
                  : 'View eligibility'}
              </button>
            </div>
          </div>

          <StudioSongEarningsPanel
            artistId={currentArtist?.id}
            userId={currentUser.id}
            isMonetized={isMonetized}
            ratePerPlayMwk={monetizationConfig.ratePerPlayMwk}
            fallbackTracks={myTracks}
            maxRows={5}
            replayKey={earningsRefreshKey}
            title={isNy ? 'Ndalama za nyimbo iliyonse panthawiyi' : 'Real-time earnings per song'}
            onPlayTrack={(track) =>
              currentTrack?.id === track.id ? togglePlayPause() : playTrack(track)
            }
            onOpenTrackDetails={(track) => {
              setActiveDetailTrack(track);
              onOpenTrackDetails(track);
            }}
          />

          {currentArtist && isVerifiedStudioOwner && (
            <div className="p-5 sm:p-6 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--text)]">
                    {isNy ? 'Mbiri ya wojambula ndi zithunzi' : 'Artist profile & photos'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isNy
                      ? 'Ndi inu nokha amene mungathe kukweza chithunzi cha wojambula, chithunzi chachikulu, kapena kusintha izi.'
                      : 'Only you can upload your artist profile photo, cover banner, or edit these details.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setArtistProfileError(null);
                    if (!isEditingArtistProfile) {
                      setArtistEditName(currentArtist.name || '');
                      setArtistEditCity(currentArtist.city || '');
                      setArtistEditCountry(currentArtist.country || 'Malawi');
                      setArtistEditBio(currentArtist.bio || '');
                      setArtistEditInstagram(currentArtist.socials?.instagram || '');
                      setArtistEditTiktok(currentArtist.socials?.tiktok || '');
                      setArtistEditYoutube(currentArtist.socials?.youtube || '');
                    }
                    setIsEditingArtistProfile((prev) => !prev);
                  }}
                  className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>
                    {isEditingArtistProfile
                      ? isNy
                        ? 'Tsekani mkonzi'
                        : 'Close editor'
                      : isNy
                      ? 'Sinthani za wojambula'
                      : 'Edit artist info'}
                  </span>
                </button>
              </div>

              {artistProfileError && (
                <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)] text-xs text-[var(--danger)] font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{artistProfileError}</span>
                </div>
              )}

              {/* Artist Profile Photo + Cover Photo Uploaders (1 trigger per photo) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] shrink-0">
                    <img
                      src={optimisticArtistAvatar || currentArtist.avatar || DEFAULT_AVATAR_SVG}
                      alt={currentArtist.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {isUploadingArtistAvatar && (
                      <span className="absolute inset-0 bg-black/50 text-white flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-xs font-bold text-[var(--text)]">
                      {isNy ? 'Chithunzi cha mbiri ya wojambula' : 'Artist profile photo'}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isNy
                        ? 'Chithunzi chofanana mbali zonse · chimafupikitsidwa chokha kuti chikwere msanga'
                        : 'Square avatar · auto-compressed for fast upload'}
                    </p>
                    <input
                      ref={artistAvatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleArtistAvatarUpload(f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={isUploadingArtistAvatar}
                      onClick={() => artistAvatarInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingArtistAvatar ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      )}
                      <span>
                        {isUploadingArtistAvatar
                          ? isNy
                            ? `Kukweza (${artistAvatarProgress}%)...`
                            : `Uploading (${artistAvatarProgress}%)...`
                          : isNy
                          ? 'Sinthani chithunzi cha mbiri'
                          : 'Change profile photo'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-4">
                  <div className="relative w-24 h-16 rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] shrink-0">
                    <img
                      src={
                        optimisticArtistBanner ||
                        (currentArtist.banner && currentArtist.banner !== DEFAULT_BANNER_SVG
                          ? currentArtist.banner
                          : currentArtist.avatar || DEFAULT_BANNER_SVG)
                      }
                      alt={`${currentArtist.name} cover`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    {isUploadingArtistBanner && (
                      <span className="absolute inset-0 bg-black/50 text-white flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="text-xs font-bold text-[var(--text)]">
                      {isNy ? 'Chithunzi chachikulu cha wojambula' : 'Artist cover photo'}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isNy
                        ? 'Chithunzi chachitali · osachepera 320 × 120 px'
                        : 'Wide banner · minimum 320 × 120 px'}
                    </p>
                    <input
                      ref={artistBannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleArtistBannerUpload(f);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={isUploadingArtistBanner}
                      onClick={() => artistBannerInputRef.current?.click()}
                      className="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isUploadingArtistBanner ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                      ) : (
                        <ImageIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      )}
                      <span>
                        {isUploadingArtistBanner
                          ? isNy
                            ? `Kukweza (${artistBannerProgress}%)...`
                            : `Uploading (${artistBannerProgress}%)...`
                          : isNy
                          ? 'Sinthani chithunzi chachikulu'
                          : 'Change cover photo'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {isEditingArtistProfile && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setArtistProfileError(null);
                    if (!artistEditName.trim()) {
                      const msg = isNy ? 'Dzina la wojambula silingakhale lopanda kanthu.' : 'Stage name cannot be empty.';
                      setArtistProfileError(msg);
                      showNotice(msg, 'err');
                      return;
                    }
                    setIsSavingArtistProfile(true);
                    const cleanCity = artistEditCity.trim();
                    const cleanCountry = artistEditCountry.trim();
                    const res = await updateArtistProfile(currentArtist.id, {
                      name: artistEditName.trim(),
                      city: cleanCity,
                      country: cleanCountry,
                      location: [cleanCity, cleanCountry].filter(Boolean).join(', ') || currentArtist.location,
                      bio: artistEditBio.trim(),
                      socials: {
                        ...currentArtist.socials,
                        instagram: artistEditInstagram.trim(),
                        tiktok: artistEditTiktok.trim(),
                        youtube: artistEditYoutube.trim(),
                      },
                    });
                    setIsSavingArtistProfile(false);
                    if (!res.success) {
                      const errText = res.error || (isNy ? 'Sitinathe kukonzanso zambiri za wojambula.' : 'Could not update artist details.');
                      setArtistProfileError(errText);
                      showNotice(errText, 'err');
                      return;
                    }
                    setIsEditingArtistProfile(false);
                    showNotice(isNy ? 'Zambiri za wojambula zasinthidwa.' : 'Artist details updated.');
                  }}
                  className="space-y-3 pt-2 border-t border-[var(--border)]"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Dzina la wojambula' : 'Stage name'}
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={100}
                        value={artistEditName}
                        onChange={(e) => setArtistEditName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Mzinda' : 'City'}
                      </label>
                      <input
                        type="text"
                        maxLength={60}
                        value={artistEditCity}
                        onChange={(e) => setArtistEditCity(e.target.value)}
                        placeholder="Blantyre, Lilongwe..."
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Dziko' : 'Country'}
                      </label>
                      <RegionSelect
                        value={artistEditCountry}
                        onChange={setArtistEditCountry}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--text)]">
                      {isNy ? 'Mbiri ya wojambula' : 'Artist bio'}
                    </label>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={artistEditBio}
                      onChange={(e) => setArtistEditBio(e.target.value)}
                      placeholder={isNy ? 'Fotokozerani omvera za nyimbo zanu...' : 'Tell listeners about your sound...'}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={artistEditInstagram}
                      onChange={(e) => setArtistEditInstagram(e.target.value)}
                      placeholder={isNy ? 'Dzina kapena ulalo wa Instagram' : 'Instagram handle or URL'}
                      className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={artistEditTiktok}
                      onChange={(e) => setArtistEditTiktok(e.target.value)}
                      placeholder={isNy ? 'Dzina kapena ulalo wa TikTok' : 'TikTok handle or URL'}
                      className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                    <input
                      type="text"
                      value={artistEditYoutube}
                      onChange={(e) => setArtistEditYoutube(e.target.value)}
                      placeholder={isNy ? 'Ulalo wa tchanelo ya YouTube' : 'YouTube channel URL'}
                      className="px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setArtistProfileError(null);
                        setIsEditingArtistProfile(false);
                      }}
                      className="px-4 py-2 rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)] cursor-pointer"
                    >
                      {translate('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingArtistProfile}
                      className="px-5 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {isSavingArtistProfile
                          ? isNy
                            ? 'Kusunga...'
                            : 'Saving...'
                          : isNy
                          ? 'Sungani zosintha'
                          : 'Save changes'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: UPLOAD (3-STEP WIZARD) ==================== */}
      {activeTab === 'upload' && (() => {
        const hasAudioSource = Boolean(audioFile || isValidHttpsUrl(audioUrlInput));
        const missingRequirements = [
          !hasAudioSource ? (isNy ? 'Fayilo ya nyimbo kapena ulalo wa HTTPS' : 'Audio file or HTTPS link') : null,
          !title.trim() ? (isNy ? 'Dzina la nyimbo' : 'Track title') : null,
          coverBlob && !artworkNoLogoConfirmed
            ? isNy
              ? 'Bokosi lotsimikizira chithunzi choyera'
              : 'Clean artwork checkbox'
            : null,
          !rightsConfirmed ? (isNy ? 'Bokosi la ufulu wa nyimbo' : 'Audio rights checkbox') : null,
        ].filter((item): item is string => Boolean(item));
        const isReadyForReview = missingRequirements.length === 0;

        return (
          <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 space-y-6">
            {/* Simple 3-Step Publish Overview */}
            <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="space-y-0.5">
                <div className="font-bold text-[var(--text)]">
                  {isNy ? 'Kufalitsa kosavuta m\'masitepe atatu' : 'Easy 3-step publish'}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isNy
                    ? 'Nyimbo, dzina lake, ndi kutsimikizira ufulu zokha ndi zofunika. Chithunzi, mtima wa nyimbo, BPM, nkhani, ndi mawu ndi zosankha.'
                    : 'Only audio, title, and rights confirmation are required. Cover artwork, mood, BPM, story, and lyrics are optional.'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono text-[var(--accent-text)] font-bold shrink-0 self-start sm:self-center">
                {isNy ? `Sitepe ${uploadStep} pa 3` : `Step ${uploadStep} of 3`}
              </span>
            </div>

            {/* Stepper Header */}
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border)]">
              {[
                { step: 1 as const, label: isNy ? '1. Nyimbo' : '1. Audio' },
                { step: 2 as const, label: isNy ? '2. Zambiri' : '2. Details' },
                { step: 3 as const, label: isNy ? '3. Falitsani' : '3. Publish' },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    if (
                      s.step < uploadStep ||
                      (s.step === 2 && hasAudioSource) ||
                      (s.step === 3 && isReadyForReview)
                    ) {
                      setUploadStep(s.step);
                    }
                  }}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    uploadStep === s.step
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                      : uploadStep > s.step
                      ? 'bg-[var(--surface-2)] text-[var(--accent-text)] border border-[var(--border)]'
                      : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {uploadError && (
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)] text-xs text-[var(--danger)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* STEP 1: AUDIO */}
            {uploadStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-[var(--text)]">
                    {isNy ? 'Sitepe 1: Sankhani fayilo ya nyimbo yanu' : 'Step 1: Choose your song file'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isNy ? 'MP3, WAV, FLAC, kapena M4A (osapyola 120 MB)' : 'MP3, WAV, FLAC, or M4A (max 120 MB)'}
                  </p>
                </div>

                <div
                  onClick={() => audioInputRef.current?.click()}
                  className="p-8 rounded-2xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent-text)] bg-[var(--surface-2)] text-center cursor-pointer transition space-y-2"
                >
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleAudioFile(f);
                    }}
                  />
                  {isAnalyzingAudio ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-7 h-7 text-[var(--accent-text)] animate-spin" />
                      <span className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Kuyang\'ana fayilo ya nyimbo...' : 'Checking audio file...'}
                      </span>
                    </div>
                  ) : audioFile ? (
                    <div className="space-y-1">
                      <FileAudio className="w-8 h-8 text-[var(--accent-text)] mx-auto" />
                      <div className="text-sm font-bold text-[var(--text)] truncate max-w-md mx-auto">
                        {audioFile.name}
                      </div>
                      <div className="text-xs font-mono text-[var(--text-muted)]">
                        {extractedMeta ? `${formatTime(extractedMeta.durationSeconds)} · ${extractedMeta.fileSizeFormatted}` : ''}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <UploadCloud className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {isNy ? 'Dinani kuti musankhe fayilo ya nyimbo' : 'Tap to choose an audio file'}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {isNy ? 'Osapyola 120 MB · Kukweza kwachangu' : 'Max 120 MB · Fast resumable upload'}
                      </div>
                    </div>
                  )}
                </div>

                {duplicateAudioMatch && (
                  <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-amber-500/50 text-xs text-amber-500 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {isNy
                        ? `Chenjezo: fayilo yeniyeniyi ikufanana ndi nyimbo yomwe ilipo kale ("${duplicateAudioMatch.title}"). Kukweza mobwereza kungayambitse zovuta za ufulu.`
                        : `Warning: this exact audio file matches an existing track ("${duplicateAudioMatch.title}"). Uploading duplicates can cause copyright flags.`}
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    {isNy
                      ? 'Kapena ikani ulalo wachindunji wa HTTPS wa nyimbo (zosankha ngati mukukweza fayilo)'
                      : 'Or paste a direct HTTPS audio link (optional if uploading a file)'}
                  </label>
                  <input
                    type="url"
                    value={audioUrlInput}
                    onChange={(e) => setAudioUrlInput(e.target.value)}
                    onBlur={async () => {
                      if (!audioFile && isValidHttpsUrl(audioUrlInput)) {
                        try {
                          const res = await probeAudioUrlMetadata(audioUrlInput.trim());
                          setProbedUrlDuration(res.durationSeconds);
                        } catch {}
                      }
                    }}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {hasAudioSource
                      ? isNy
                        ? 'Nyimbo yakonzeka — pitani ku zambiri.'
                        : 'Audio ready — continue to details.'
                      : isNy
                      ? 'Sankhani fayilo ya nyimbo kapena ulalo kuti mupitirize.'
                      : 'Select an audio file or link to continue.'}
                  </span>
                  <button
                    type="button"
                    disabled={!hasAudioSource}
                    onClick={() => setUploadStep(2)}
                    className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isNy ? 'Tsatira: Zambiri' : 'Next: Details'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DETAILS & SQUARE COVER */}
            {uploadStep === 2 && (
              <div className="space-y-5">
                {/* Required Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-text)]">
                      {isNy ? 'Zofunika kuti mufalitse' : 'Required to publish'}
                    </h3>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isNy ? 'Zolembedwa * ndi zofunika' : 'Fields marked * are needed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Dzina la nyimbo *' : 'Track title *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={isNy ? 'Lembani dzina la nyimbo' : 'Enter song title'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Mtundu wa nyimbo' : 'Genre'}
                      </label>
                      <GenreSelectOrCustom
                        value={genre}
                        onChange={setGenre}
                        onCustomGenreCreated={(name: string) => {
                          upsertGenre(name, { region }).catch(() => {});
                        }}
                      />
                    </div>
                  </div>

                  {/* Cover Art Upload (Optional — uses LOWERVIBE icon logo automatically if omitted) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text)]">
                      {isNy
                        ? 'Chithunzi cha nyimbo (Chosankha · Chigwiritsa chizindikiro cha LOWERVIBE ngati musiye)'
                        : 'Cover artwork (Optional · Auto-uses LOWERVIBE icon if skipped)'}
                    </label>
                    <div
                      onClick={() => coverInputRef.current?.click()}
                      className="p-4 rounded-2xl border border-dashed border-[var(--border)] hover:border-[var(--accent-text)] bg-[var(--surface-2)] flex items-center gap-4 cursor-pointer"
                    >
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleCoverFile(f);
                        }}
                      />
                      <div className="w-16 h-16 rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={coverPreview || LOWERVIBE_ICON_ARTWORK}
                          alt={
                            coverPreview
                              ? isNy
                                ? 'Chithunzi chosankhidwa'
                                : 'Cover preview'
                              : isNy
                              ? 'Chizindikiro cha LOWERVIBE'
                              : 'Default LOWERVIBE cover logo'
                          }
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text)] truncate">
                          {coverPreview
                            ? coverOriginalName
                            : isNy
                            ? 'Dinani kuti mukweze chithunzi chanu (kapena siyani chizindikiro cha LOWERVIBE)'
                            : 'Tap to upload custom cover (or leave default LOWERVIBE icon)'}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {coverCompressionNote ||
                            (isNy
                              ? 'Chithunzi cha 1:1 chosankha. Ngati musiya, LOWERVIBE imayika chizindikiro chake yokha.'
                              : 'Optional 1:1 WebP cover. If skipped, LOWERVIBE applies your official icon artwork automatically.')}
                        </p>
                      </div>
                    </div>
                    {coverError && (
                      <p className="text-xs text-[var(--danger)] font-medium">{coverError}</p>
                    )}
                  </div>

                  {/* Required Checkboxes */}
                  <div className="space-y-2">
                    {coverBlob && (
                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer text-xs text-[var(--text)]">
                        <input
                          type="checkbox"
                          checked={artworkNoLogoConfirmed}
                          onChange={(e) => setArtworkNoLogoConfirmed(e.target.checked)}
                          className="mt-0.5 accent-[var(--accent)]"
                        />
                        <span>
                          {isNy
                            ? 'Chithunzichi chilibe chizindikiro cha nsanja ina ndipo ndili ndi ufulu wake *'
                            : "This artwork has no other platform's logo and I own the rights *"}
                        </span>
                      </label>
                    )}

                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer text-xs text-[var(--text)]">
                      <input
                        type="checkbox"
                        checked={rightsConfirmed}
                        onChange={(e) => setRightsConfirmed(e.target.checked)}
                        className="mt-0.5 accent-[var(--accent)]"
                      />
                      <span>
                        {isNy
                          ? 'Ndili ndi ufulu wofalitsa nyimboyi *'
                          : 'I own or control the rights to publish this audio recording *'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Optional Details Section */}
                <div className="pt-4 border-t border-[var(--border)] space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {isNy ? 'Zambiri zosankha (mukhoza kudumpha)' : 'Optional details (you can skip)'}
                    </h3>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {isNy ? 'Sankhani, lembani, kapena dumphani' : 'Pick preset, write custom, or skip'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Dziko' : 'Country'}
                      </label>
                      <RegionSelect
                        value={region}
                        onChange={setRegion}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Mtima wa nyimbo' : 'Mood'}{' '}
                        <span className="text-[var(--text-muted)] font-normal">
                          {isNy ? '(zosankha · pezani kapena dumphani)' : '(optional · preset, custom, or skip)'}
                        </span>
                      </label>
                      <MoodSelectOrCustom
                        value={mood}
                        onChange={setMood}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Liwiro la BPM (zosankha)' : 'BPM (optional)'}
                      </label>
                      <input
                        type="number"
                        min={40}
                        max={240}
                        value={bpm}
                        onChange={(e) => setBpm(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-[var(--text)]">
                        {isNy ? 'Za nyimboyi (zosankha)' : 'About this song (optional)'}
                      </label>
                      <input
                        type="text"
                        value={story}
                        onChange={(e) => setStory(e.target.value)}
                        placeholder={isNy ? 'Fotokozani mbiri kapena opanga nyimboyi...' : 'Share credits or story behind the track...'}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[var(--text)]">
                      {isNy ? 'Mawu a nyimbo (zosankha)' : 'Lyrics (optional)'}
                    </label>
                    <textarea
                      rows={3}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      placeholder={isNy ? 'Ikani mawu a nyimbo...' : 'Paste song lyrics...'}
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                  </div>
                </div>

                {/* Publish Readiness Indicator */}
                <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
                  {isReadyForReview ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-[var(--accent-text)]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {isNy
                          ? 'Zofunika zonse zakonzeka — dinani Tsatira: Yang\'anani kuti mufalitse.'
                          : 'All required fields ready — tap Next: Review to publish.'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[var(--text-muted)]">
                      <strong className="text-[var(--text)]">
                        {isNy ? 'Chotsala:' : 'Still needed:'}
                      </strong>{' '}
                      {missingRequirements.join(' · ')}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setUploadStep(1)}
                    className="px-4 py-2 rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{translate('back')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!isReadyForReview}
                    onClick={() => setUploadStep(3)}
                    className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span>{isNy ? 'Tsatira: Yang\'anani & Falitsani' : 'Next: Review & Publish'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: REVIEW & PUBLISH / SAVE DRAFT */}
            {uploadStep === 3 && (
              <div className="space-y-5">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                  <img
                    src={coverPreview || LOWERVIBE_ICON_ARTWORK}
                    alt={title}
                    className="w-20 h-20 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="text-base font-extrabold text-[var(--text)] truncate">{title}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {currentArtist?.name || currentUser.name} · {translateGenreCategory(genre, language)} · {region}
                      {mood.trim() ? ` · ${mood.trim()}` : ''}
                    </div>
                    <div className="text-xs font-mono text-[var(--text-muted)]">
                      {extractedMeta
                        ? `${formatTime(extractedMeta.durationSeconds)} · ${bpm} BPM · ${extractedMeta.fileSizeFormatted}`
                        : probedUrlDuration
                        ? `${formatTime(probedUrlDuration)} · ${bpm} BPM`
                        : `${bpm} BPM`}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-0.5">
                    <div className="font-bold text-[var(--text)]">
                      {isNy ? 'Falitsani nyimbo (Pa mpweya)' : 'Publish track (Live now)'}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isNy
                        ? 'Imaonekera nthawi yomweyo pa Nyumba, Pezani, ndi tsamba lanu la wojambula.'
                        : 'Appears immediately on Home, Discover, and your Artist page for streaming and sharing.'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-0.5">
                    <div className="font-bold text-[var(--text)]">
                      {isNy ? 'Sungani m\'zolembedwa (Zobisika)' : 'Save draft (Private)'}
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {isNy
                        ? 'Imasungidwa m\'Situdiyo yanu mokha — mutha kufalitsa nthawi ina iliyonse.'
                        : 'Uploads and saves securely inside Studio Tracks only — tap Publish anytime later.'}
                    </p>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--accent-text)]">
                      <span>{uploadStatusText || (isNy ? 'Kukweza...' : 'Uploading...')}</span>
                      <span className="font-mono tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    {activeUploadControllerRef.current && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isUploadPaused) {
                              activeUploadControllerRef.current?.resume();
                              setIsUploadPaused(false);
                            } else {
                              activeUploadControllerRef.current?.pause();
                              setIsUploadPaused(true);
                            }
                          }}
                          className="px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)] cursor-pointer"
                        >
                          {isUploadPaused
                            ? isNy
                              ? 'Pitirizani kukweza'
                              : 'Resume upload'
                            : isNy
                            ? 'Imitsani kukweza'
                            : 'Pause upload'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            activeUploadControllerRef.current?.cancel();
                          }}
                          className="px-3 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[11px] font-semibold text-[var(--danger)] cursor-pointer"
                        >
                          {translate('cancel')}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => setUploadStep(2)}
                    className="px-4 py-2.5 rounded-full bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{isNy ? 'Bwererani ku zambiri' : 'Back to details'}</span>
                  </button>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => handlePublishOrDraft(true)}
                      className="px-5 py-2.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer disabled:opacity-50"
                    >
                      {isNy ? 'Sungani zolembedwa' : 'Save draft'}
                    </button>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => handlePublishOrDraft(false)}
                      className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isUploading
                        ? isNy
                          ? 'Kufalitsa...'
                          : 'Publishing...'
                        : isNy
                        ? 'Falitsani nyimbo'
                        : 'Publish track'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== TAB 3: TRACKS (REAL-TIME FIRESTORE METRICS & EARNINGS) ==================== */}
      {activeTab === 'tracks' && (
        <div className="space-y-4">
          {/* Real-time Tracks Summary & Controls Bar */}
          <div className="p-4 sm:p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-[var(--text)]">
                    {isNy ? 'Nyimbo zanu ndi ziwerengero zamoyo' : 'Your tracks & live metrics'}
                  </h2>
                  {liveTrackMetrics.isSynced && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-mono text-[var(--accent-text)]">
                      <Radio className="w-3 h-3" />
                      <span>{isNy ? 'Pamoyo' : 'Live'}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {isNy
                    ? 'Kuseweredwa kwenikweni, zowona za masekondi 30+, zokonda, ndi ndalama za MWK'
                    : 'Real-time plays, verified 30s+ streams, likes, and MWK earnings synced from Firestore'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isNy ? 'Kwezani nyimbo' : 'Upload track'}</span>
              </button>
            </div>

            {liveTrackMetrics.listenerError && (
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)] text-xs text-[var(--danger)] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{liveTrackMetrics.listenerError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isNy ? 'Kuseweredwa konse' : 'Total live plays'}
                </div>
                <div className="text-base font-mono font-extrabold text-[var(--text)] tabular-nums mt-0.5">
                  {totalPlays.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isNy ? 'Zotsimikizika 30s+' : 'Verified 30s+'}
                </div>
                <div className="text-base font-mono font-extrabold text-[var(--text)] tabular-nums mt-0.5">
                  {liveTrackMetrics.totalVerifiedLedgerPlays.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isNy ? 'Zokonda · Zosunga' : 'Likes · Saves'}
                </div>
                <div className="text-base font-mono font-extrabold text-[var(--text)] tabular-nums mt-0.5">
                  {totalLikes.toLocaleString()} · {liveTrackMetrics.totalDownloads.toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isNy ? 'Zopeza m\'nyimbo' : 'Catalog earned'}
                </div>
                <div className="text-base font-mono font-extrabold text-[var(--accent-text)] tabular-nums mt-0.5">
                  {liveTrackMetrics.totalEarningsMwk.toLocaleString()} MWK
                </div>
              </div>
            </div>

            {liveTrackMetrics.songs.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={tracksSearchQuery}
                    onChange={(e) => setTracksSearchQuery(e.target.value)}
                    placeholder={isNy ? 'Sefani nyimbo zanu ndi dzina kapena mtundu...' : 'Filter your songs by title or genre...'}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTracksSortBy((prev) =>
                      prev === 'newest' ? 'plays' : prev === 'plays' ? 'earnings' : 'newest'
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>
                    {isNy ? 'Sankhani:' : 'Sort:'}{' '}
                    {tracksSortBy === 'newest'
                      ? isNy
                        ? 'Zatsopano'
                        : 'Newest'
                      : tracksSortBy === 'plays'
                      ? isNy
                        ? 'Zoseweredwa kwambiri'
                        : 'Most Played'
                      : isNy
                      ? 'Zobweretsa ndalama zambiri'
                      : 'Top Earning'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
            {liveTrackMetrics.songs.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <Music className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
                <div className="text-sm font-bold text-[var(--text)]">
                  {isNy ? 'Palibe nyimbo zokwezedwa pano' : 'No songs uploaded yet'}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                >
                  {isNy ? 'Kwezani nyimbo yanu yoyamba' : 'Upload your first track'}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {(() => {
                  const q = tracksSearchQuery.trim().toLowerCase();
                  const filtered = liveTrackMetrics.songs.filter(({ track }) => {
                    if (!q) return true;
                    return (
                      track.title.toLowerCase().includes(q) ||
                      (track.genre || '').toLowerCase().includes(q) ||
                      translateGenreCategory(track.genre, language).toLowerCase().includes(q)
                    );
                  });

                  const sorted = [...filtered].sort((a, b) => {
                    if (tracksSortBy === 'plays') return b.effectivePlays - a.effectivePlays;
                    if (tracksSortBy === 'earnings') {
                      return b.earnedMwk - a.earnedMwk || b.effectivePlays - a.effectivePlays;
                    }
                    return (
                      new Date(b.track.releaseDate || b.track.createdAt || 0).getTime() -
                      new Date(a.track.releaseDate || a.track.createdAt || 0).getTime()
                    );
                  });

                  if (sorted.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        {isNy ? `Palibe nyimbo zofanana ndi “${tracksSearchQuery}”.` : `No songs match “${tracksSearchQuery}”.`}
                      </div>
                    );
                  }

                  return sorted.map((metric) => {
                    const { track, effectivePlays, verifiedLedgerPlays, totalLikes: rowLikes, totalDownloads: rowDownloads, earnedMwk, sharePct } = metric;
                    const isTrackActive = currentTrack?.id === track.id;
                    const isEditing = editingTrackId === track.id;
                    const isConfirmingDel = confirmDeleteId === track.id;
                    const isSavingRow = savingTrackId === track.id;
                    const isTogglingRow = togglingTrackId === track.id;
                    const isDeletingRow = deletingTrackId === track.id;

                    return (
                      <div key={track.id} className="p-4 sm:p-5 space-y-3 hover:bg-[var(--surface-2)]/35 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-[var(--border)] bg-[var(--surface-2)]">
                              <img
                                src={track.coverArt || LOWERVIBE_ICON_ARTWORK}
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => (isTrackActive ? togglePlayPause() : playTrack(track))}
                                aria-label={isTrackActive && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                                className="absolute inset-0 bg-black/45 flex items-center justify-center text-white opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                              >
                                {isTrackActive && isPlaying ? (
                                  <Pause className="w-4 h-4 fill-current" />
                                ) : (
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                )}
                              </button>
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  onClick={() => {
                                    setActiveDetailTrack(track);
                                    onOpenTrackDetails(track);
                                  }}
                                  className="text-sm font-bold text-[var(--text)] truncate cursor-pointer hover:underline"
                                >
                                  {track.title}
                                </span>
                                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                                  · {track.isDraft ? (isNy ? 'Zolembedwa' : 'Draft') : isNy ? 'Yafalitsidwa' : 'Published'} ·{' '}
                                  {translateGenreCategory(track.genre, language)}
                                </span>
                              </div>

                              {/* Real-time Firestore Playback Metrics Strip */}
                              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-[var(--text-muted)]">
                                <span className="inline-flex items-center gap-1 text-[var(--text)] font-semibold">
                                  <Play className="w-3 h-3 text-[var(--accent-text)]" />
                                  {effectivePlays.toLocaleString()} {isNy ? 'kuseweredwa' : 'plays'}
                                </span>
                                {verifiedLedgerPlays > 0 && (
                                  <span>
                                    {verifiedLedgerPlays.toLocaleString()} {isNy ? 'zotsimikizika 30s+' : 'verified 30s+'}
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  {rowLikes.toLocaleString()}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Download className="w-3 h-3" />
                                  {rowDownloads.toLocaleString()}
                                </span>
                                {sharePct > 0 && (
                                  <span>
                                    {sharePct}% {isNy ? 'gawo la nyimbo' : 'catalog share'}
                                  </span>
                                )}
                              </div>

                              {totalPlays > 0 && (
                                <div className="w-full max-w-[240px] h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                                  <div
                                    className="h-full bg-[var(--accent)] transition-all duration-300"
                                    style={{ width: `${Math.max(3, sharePct)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Real-time Attached Track Earnings + Quick Actions */}
                          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
                            <div className="px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left lg:text-right min-w-[140px]">
                              {isMonetized ? (
                                <>
                                  <div className="text-sm font-mono font-extrabold text-[var(--accent-text)] tabular-nums">
                                    {earnedMwk.toLocaleString()} MWK
                                  </div>
                                  <div className="text-[10px] font-mono text-[var(--text-muted)]">
                                    @{monetizationConfig.ratePerPlayMwk} MWK/{isNy ? 'kusewera · Pamoyo' : 'play · Live'}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="text-xs font-mono font-bold text-[var(--text-muted)] tabular-nums flex items-center lg:justify-end gap-1">
                                    <Lock className="w-3 h-3" />
                                    <span>0 MWK</span>
                                  </div>
                                  <div className="text-[10px] text-[var(--text-muted)]">
                                    {isNy ? 'Imatseguka mukavomerezedwa' : 'Unlocks on eligibility'}
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                  onClick={() => {
                                    if (isEditing) {
                                      setEditingTrackId(null);
                                    } else {
                                      setEditingTrackId(track.id);
                                      setEditTitle(track.title);
                                      setEditGenre(track.genre);
                                      setEditMood(track.mood || '');
                                      setEditStory(track.story || '');
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer flex items-center gap-1 hover:border-[var(--accent)] transition-colors"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>{isNy ? 'Sinthani' : 'Edit'}</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isTogglingRow}
                                  onClick={async () => {
                                    setTogglingTrackId(track.id);
                                    const res = await toggleDraftTrack(track.id);
                                    setTogglingTrackId(null);
                                    if (!res.success) {
                                      showNotice(
                                        res.error || (isNy ? 'Sitinathe kusintha mkhalidwe wa nyimbo.' : 'Could not update track status.'),
                                        'err'
                                      );
                                      return;
                                    }
                                    showNotice(
                                      track.isDraft
                                        ? isNy
                                          ? 'Nyimbo yafalitsidwa.'
                                          : 'Track published.'
                                        : isNy
                                        ? 'Yasunthidwa ku zolembedwa.'
                                        : 'Moved to drafts.'
                                    );
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer hover:border-[var(--accent)] transition-colors disabled:opacity-50"
                                >
                                  {isTogglingRow
                                    ? isNy
                                      ? 'Kusintha...'
                                      : 'Updating...'
                                    : track.isDraft
                                    ? isNy
                                      ? 'Falitsani'
                                      : 'Publish'
                                    : isNy
                                    ? 'Chotsani poyera'
                                    : 'Unpublish'}
                                </button>

                                {!isConfirmingDel ? (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(track.id)}
                                    className="p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer transition-colors"
                                    title={isNy ? 'Fufutani nyimbo' : 'Delete track'}
                                    aria-label={`Delete ${track.title}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)]/40">
                                    <span className="text-[11px] text-[var(--text)]">
                                      {isNy ? 'Mutsimikiza?' : 'Are you sure?'}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isDeletingRow}
                                      onClick={() => handleDeleteTrackConfirm(track)}
                                      className="px-2 py-0.5 rounded-lg bg-[var(--danger)] text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                    >
                                      {isDeletingRow ? '...' : isNy ? 'Fufutani' : 'Delete'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-[11px] text-[var(--text-muted)] cursor-pointer"
                                    >
                                      {translate('cancel')}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder={isNy ? 'Dzina la nyimbo' : 'Title'}
                                  className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                                />
                                <GenreSelectOrCustom value={editGenre} onChange={setEditGenre} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-semibold text-[var(--text-muted)]">
                                  {isNy ? 'Mtima wa nyimbo (zosankha)' : 'Mood (optional)'}
                                </label>
                                <MoodSelectOrCustom
                                  value={editMood}
                                  onChange={setEditMood}
                                  className="flex-1 min-w-0 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                                />
                              </div>
                              <textarea
                                rows={2}
                                value={editStory}
                                onChange={(e) => setEditStory(e.target.value)}
                                placeholder={isNy ? 'Za nyimboyi' : 'About this track'}
                                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingTrackId(null)}
                                  className="px-3 py-1.5 text-xs text-[var(--text-muted)] cursor-pointer"
                                >
                                  {translate('cancel')}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingRow}
                                  onClick={async () => {
                                    setSavingTrackId(track.id);
                                    try {
                                      const nextGenre = normalizeGenreCategory(editGenre || track.genre);
                                      const nextMood = editMood.trim();
                                      await updateTrack(track.id, {
                                        title: editTitle.trim() || track.title,
                                        genre: nextGenre,
                                        mood: nextMood,
                                        vibeTags: [nextGenre, ...(nextMood ? [nextMood] : [])].filter(Boolean),
                                        story: editStory.trim(),
                                      });
                                      setEditingTrackId(null);
                                      showNotice(isNy ? 'Nyimbo yasinthidwa.' : 'Track updated.');
                                    } catch (err) {
                                      showNotice(
                                        err instanceof Error
                                          ? err.message
                                          : isNy
                                          ? 'Sitinathe kusintha nyimbo.'
                                          : 'Could not update track.',
                                        'err'
                                      );
                                    } finally {
                                      setSavingTrackId(null);
                                    }
                                  }}
                                  className="px-4 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                  {isSavingRow ? (isNy ? 'Kusunga...' : 'Saving...') : translate('save')}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 4: ANALYTICS ==================== */}
      {activeTab === 'analytics' && (
        <StudioStatsTab
          artistId={currentArtist?.id}
          artistName={currentArtist?.name}
          userArtistId={currentUser.artistId}
          userName={currentUser.name}
          isAdmin={Boolean(isAdmin)}
          isMonetized={isMonetized}
          ratePerPlayMwk={monetizationConfig.ratePerPlayMwk}
          fallbackTracks={tracks}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          onPlayTrack={playTrack}
          onTogglePlayPause={togglePlayPause}
          onOpenTrackDetails={(track) => {
            setActiveDetailTrack(track);
            onOpenTrackDetails(track);
          }}
          onGoToUpload={() => setActiveTab('upload')}
        />
      )}

      {/* ==================== TAB 5: MONETIZATION (STRICTLY GATED) ==================== */}
      {activeTab === 'monetization' && (
        <div className="space-y-6">
          {!isMonetized ? (
            /* LOCKED / PENDING / REJECTED / SUSPENDED SCREEN — ZERO EARNINGS SHOWN */
            <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-extrabold text-[var(--text)]">
                      {monetizationStatus === 'pending'
                        ? isNy
                          ? 'Kulipira kuli m\'ndondomeko yowunikira'
                          : 'Monetization under review'
                        : monetizationStatus === 'rejected'
                        ? isNy
                          ? 'Kulipira sikunavomerezedwe'
                          : 'Monetization not approved'
                        : monetizationStatus === 'suspended'
                        ? isNy
                          ? 'Kulipira kwayimitsidwa'
                          : 'Monetization paused'
                        : isNy
                        ? 'Kulipira kwatsekedwa'
                        : 'Monetization locked'}
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    {monetizationStatus === 'pending'
                      ? isNy
                        ? 'Talandira pempho lanu. Mudzalandira chidziwitso woyang\'anira akamaliza kuwunika.'
                        : 'We received your application. You will get a notification when an admin completes the review.'
                      : monetizationStatus === 'rejected'
                      ? isNy
                        ? `${currentArtist?.monetizationRejectionReason || 'Mbiri yanu sinapambane kuunikidwa pano.'} Mukhoza kuyesanso pakadutsa masiku ${monetizationConfig.reapplyCooldownDays}.`
                        : `${currentArtist?.monetizationRejectionReason || 'Your profile did not pass review yet.'} You can re-apply after ${monetizationConfig.reapplyCooldownDays} days.`
                      : monetizationStatus === 'suspended'
                      ? currentArtist?.monetizationRevokedReason ||
                        (isNy ? 'Kulipira kwayimitsidwa pakali pano.' : 'Monetization is currently paused.')
                      : isNy
                      ? 'Kwaniritsani zolinga zonse pansipa ndipo pemphani kuunikidwa kuti ndalama ndi kutulutsa ndalama zitseguke.'
                      : 'Meet every goal below and request review before earnings and withdrawals unlock.'}
                  </p>
                </div>
              </div>

              {/* Live Progress Bars */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-[var(--text)]">
                  {isNy ? 'Mndandanda wa zoyenereza' : 'Eligibility checklist'}
                </div>
                {eligibilityChecks.map((check) => {
                  const pct = Math.min(100, Math.round((check.current / Math.max(1, check.target)) * 100));
                  return (
                    <div
                      key={check.label}
                      className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text)]">{check.label}</span>
                        <span className={check.met ? 'text-[var(--accent-text)] font-bold' : 'text-[var(--text-muted)]'}>
                          {check.met ? (isNy ? 'Zatheka' : 'Done') : `${pct}%`}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Request Review Action */}
              {currentArtist && monetizationStatus !== 'pending' && monetizationStatus !== 'suspended' && (
                <div className="pt-2 border-t border-[var(--border)] space-y-3">
                  <label className="flex items-start gap-2.5 text-xs text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={termsAcceptedForMonetization}
                      onChange={(e) => setTermsAcceptedForMonetization(e.target.checked)}
                      className="mt-0.5 accent-[var(--accent)]"
                    />
                    <span>
                      {isNy
                        ? 'Ndawerenga ndi kuvomereza Malamulo a Kulipira kwa Opanga a LOWERVIBE. Kusewera wekha kapena ndi makina sikulipidwa.'
                        : 'I have read and accept the LOWERVIBE Creator Monetization Terms. Self-plays and automated plays do not qualify.'}
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!allEligible || !termsAcceptedForMonetization || isRequestingMonetization}
                    onClick={async () => {
                      if (!currentArtist) return;
                      setIsRequestingMonetization(true);
                      const res = await requestArtistMonetization(currentArtist.id, true);
                      setIsRequestingMonetization(false);
                      if (!res.success) {
                        showNotice(res.error || (isNy ? 'Sitinathe kupempha kulipira.' : 'Could not request monetization.'), 'err');
                        return;
                      }
                      showNotice(
                        res.autoApproved
                          ? isNy
                            ? 'Kulipira kwavomerezedwa kokha!'
                            : 'Monetization approved automatically!'
                          : isNy
                          ? 'Pempho la kuwunika kulipira latumizidwa.'
                          : 'Monetization review submitted.'
                      );
                    }}
                    className="px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-45"
                  >
                    {isRequestingMonetization
                      ? isNy
                        ? 'Kuyang\'ana kuyenerera...'
                        : 'Checking eligibility...'
                      : allEligible
                      ? isNy
                        ? 'Tsegulani kulipira kokha'
                        : 'Activate monetization automatically'
                      : isNy
                      ? 'Pemphani kuwunika kulipira'
                      : 'Request monetization review'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* APPROVED MONETIZATION DASHBOARD */
            <div className="space-y-6">
              {/* Balance, Total Earnings Count-Up & Payout Status */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[var(--text)]">
                    {isNy ? 'Chidule cha ndalama' : 'Earnings overview'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isNy
                      ? 'Ndalama zenizeni zowerengedwa pa kusewera kulikonse koyenera'
                      : 'Real-time royalties calculated per qualifying play'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('withdrawals')}
                    className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{isNy ? 'Tsegulani Kutulutsa' : 'Open Withdrawals'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshEarnings}
                    disabled={isRefreshingEarnings}
                    className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs font-semibold text-[var(--text)] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingEarnings ? 'animate-spin' : ''}`} />
                    <span>{isNy ? 'Tsitsimutsa ndalama' : 'Refresh earnings'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">
                    {isNy ? 'Ndalama zomwe zilipo' : 'Available balance'}
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--text)] tabular-nums">
                    <CountUpValue value={availableBalanceMwk} suffix=" MWK" replayKey={earningsRefreshKey} />
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {isNy ? 'Zochepa zotulutsa:' : 'Minimum withdrawal:'}{' '}
                    {monetizationConfig.minWithdrawalMwk.toLocaleString()} MWK
                  </div>
                </div>

                <div className="p-5 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">
                    {isNy ? 'Ndalama Zonse' : 'Total Earnings'}
                  </div>
                  <div className="text-2xl font-extrabold text-[var(--accent-text)] tabular-nums">
                    <CountUpValue value={computedEarningsMwk} suffix=" MWK" replayKey={earningsRefreshKey} />
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {isNy
                      ? `Zowerengedwa pa ${monetizationConfig.ratePerPlayMwk} MWK / kusewera koyenera`
                      : `Calculated at ${monetizationConfig.ratePerPlayMwk} MWK / qualifying play`}
                  </div>
                </div>

                <div className="p-5 rounded-[20px] bg-[var(--surface)] border border-[var(--border)] space-y-1.5">
                  <div className="text-xs text-[var(--text-muted)]">
                    {isNy ? 'Mkhalidwe wa malipiro & Chizindikiro chovomerezeka' : 'Payout status & Approval token'}
                  </div>
                  <div className="text-base font-bold text-[var(--text)]">
                    {myPayoutMethods.length === 0
                      ? isNy
                        ? 'Zavomerezedwa — Onjezerani njira'
                        : 'Approved — Add method'
                      : myPayoutMethods.some((m) => m.status === 'accepted') ||
                        monetizationConfig.payoutProviderConfigured
                      ? isNy
                        ? 'Zavomerezedwa (Zatsimikizika zokha)'
                        : 'Accepted (Auto-verified)'
                      : isNy
                      ? 'Zalumikizidwa'
                      : 'Connected'}
                  </div>
                  {currentArtist?.monetizationApprovalToken ? (
                    <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--accent)]/40 text-[10px] font-mono font-bold text-[var(--accent-text)]">
                        {currentArtist.monetizationApprovalToken}
                      </span>
                      {currentArtist.monetizationTokenSignature && (
                        <button
                          type="button"
                          onClick={async () => {
                            const v = await verifyServerToken(currentArtist.monetizationTokenSignature!);
                            if (v.valid) {
                              showNotice(
                                isNy
                                  ? 'Chizindikiro chovomerezeka chatsimikizika bwino pa seva.'
                                  : 'Approval token signature verified cleanly on server.'
                              );
                            } else {
                              showNotice(v.error || (isNy ? 'Kutsimikizira chizindikiro kwalephera.' : 'Token verification failed.'), 'err');
                            }
                          }}
                          className="text-[10px] font-semibold text-[var(--violet)] underline cursor-pointer"
                        >
                          {isNy ? 'Tsimikizirani chizindikiro' : 'Verify token'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {myPayoutMethods.length === 0
                        ? isNy
                          ? 'Onjezerani Airtel Money, Mpamba, kapena USDT pansipa'
                          : 'Add Airtel Money, Mpamba, or USDT below'
                        : isNy
                        ? `Njira ${myPayoutMethods.length} zolandirira ndalama zavomerezedwa`
                        : `${myPayoutMethods.length} payout method(s) accepted`}
                    </div>
                  )}
                </div>
              </div>

              {/* Real-time Song-by-song Earnings Breakdown */}
              <StudioSongEarningsPanel
                artistId={currentArtist?.id}
                userId={currentUser.id}
                isMonetized={isMonetized}
                ratePerPlayMwk={monetizationConfig.ratePerPlayMwk}
                fallbackTracks={myTracks}
                replayKey={earningsRefreshKey}
                title={isNy ? 'Zopeza nyimbo iliyonse' : 'Song-by-song earnings'}
                onPlayTrack={(track) =>
                  currentTrack?.id === track.id ? togglePlayPause() : playTrack(track)
                }
                onOpenTrackDetails={(track) => {
                  setActiveDetailTrack(track);
                  onOpenTrackDetails(track);
                }}
              />

              {/* Monthly Earnings Bar Chart */}
              <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-3">
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {isNy ? 'Zopeza pamwezi (MWK)' : 'Monthly earnings (MWK)'}
                </h3>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyEarningsChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                      <Tooltip />
                      <Bar
                        dataKey="mwk"
                        name={isNy ? 'Zoyerekeza za MWK' : 'Estimated MWK'}
                        fill="#C6FF3D"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Payout Methods (Airtel Money / TNM Mpamba / USDT TRC-20 & BEP-20) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[var(--accent-text)]" />
                    <span>{isNy ? 'Njira zolandirira ndalama' : 'Payout methods'}</span>
                  </h3>

                  {myPayoutMethods.length > 0 && (
                    <div className="space-y-2">
                      {myPayoutMethods.map((pm) => {
                        const isAccepted =
                          pm.status === 'accepted' ||
                          new Date(pm.payoutHoldUntil).getTime() <= Date.now();
                        return (
                          <div
                            key={pm.id}
                            className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[var(--text)] flex items-center gap-2 flex-wrap">
                                <span>{pm.label}</span>
                                {pm.isDefault && (
                                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-[10px]">
                                    {isNy ? 'Yoyamba' : 'Default'}
                                  </span>
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] border ${
                                    isAccepted
                                      ? 'bg-[var(--surface)] border-[var(--accent)]/40 text-[var(--accent-text)]'
                                      : 'bg-[var(--surface)] border-[var(--border)] text-amber-500'
                                  }`}
                                >
                                  {isAccepted
                                    ? isNy
                                      ? 'Yavomerezedwa'
                                      : 'Accepted'
                                    : isNy
                                    ? 'Ikudikirira'
                                    : 'Pending hold'}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-[var(--text-muted)]">
                                {pm.maskedIdentifier} · {pm.accountHolderName}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!pm.isDefault && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await setDefaultPayoutMethod(pm.id);
                                    if (!res.success) {
                                      showNotice(
                                        res.error ||
                                          (isNy ? 'Sitinathe kusintha njira yoyamba.' : 'Could not update default payout method.'),
                                        'err'
                                      );
                                    } else {
                                      showNotice(isNy ? 'Njira yoyamba yasinthidwa.' : 'Default payout method updated.');
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] text-[var(--text)] cursor-pointer"
                                >
                                  {isNy ? 'Ikani ngati yoyamba' : 'Set default'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await removePayoutMethod(pm.id);
                                  if (!res.success) {
                                    showNotice(
                                      res.error || (isNy ? 'Sitinathe kuchotsa njira yolandirira ndalama.' : 'Could not remove payout method.'),
                                      'err'
                                    );
                                  } else {
                                    showNotice(isNy ? 'Njira yolandirira ndalama yachotsedwa.' : 'Payout method removed.');
                                  }
                                }}
                                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <form onSubmit={handleAddPayoutMethodSubmit} className="space-y-3 pt-2 border-t border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--text)]">
                      {isNy ? 'Onjezerani njira yolandirira ndalama' : 'Add payout method'}
                    </div>
                    <select
                      value={pmType}
                      onChange={(e) => setPmType(e.target.value as PayoutProviderType)}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    >
                      <option value="airtel_money">Airtel Money (+265 99 / 98)</option>
                      <option value="tnm_mpamba">TNM Mpamba (+265 88 / 89)</option>
                      <option value="usdt_trc20">USDT (TRON / TRC-20)</option>
                      <option value="usdt_bep20">USDT (BNB Smart Chain / BEP-20)</option>
                    </select>

                    {(pmType === 'usdt_trc20' || pmType === 'usdt_bep20') && (
                      <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-amber-500/40 text-[11px] text-amber-500">
                        {isNy
                          ? `Onani mosamala netiweki yanu (${pmType === 'usdt_trc20' ? 'TRC-20 imayamba ndi T' : 'BEP-20 imayamba ndi 0x'}). Ndalama zatumizidwa ku netiweki yolakwika sizingabwerere.`
                          : `Check your wallet network carefully (${pmType === 'usdt_trc20' ? 'TRC-20 starts with T' : 'BEP-20 starts with 0x'}). Wrong-network crypto transfers cannot be recovered.`}
                      </div>
                    )}

                    <input
                      type="text"
                      required
                      value={pmIdentifier}
                      onChange={(e) => setPmIdentifier(e.target.value)}
                      placeholder={
                        pmType === 'airtel_money'
                          ? '+265991234567'
                          : pmType === 'tnm_mpamba'
                          ? '+265881234567'
                          : pmType === 'usdt_trc20'
                          ? 'T... (34 chars)'
                          : '0x... (42 chars)'
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />
                    <input
                      type="text"
                      required
                      value={pmHolderName}
                      onChange={(e) => setPmHolderName(e.target.value)}
                      placeholder={isNy ? 'Dzina lonse la mwini akaunti' : 'Full account holder name'}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                    />
                    <button
                      type="submit"
                      disabled={isAddingPm}
                      className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                    >
                      {isAddingPm
                        ? isNy
                          ? 'Kusunga...'
                          : 'Saving...'
                        : isNy
                        ? 'Sungani njira yolandirira ndalama'
                        : 'Save payout method'}
                    </button>
                  </form>
                </div>

                {/* Request Withdrawal Form */}
                <div className="p-5 rounded-[24px] bg-[var(--surface)] border border-[var(--border)] space-y-4">
                  <h3 className="text-sm font-bold text-[var(--text)]">
                    {isNy ? 'Pemphani kutulutsa ndalama' : 'Request withdrawal'}
                  </h3>
                  <form onSubmit={handleWithdrawSubmit} className="space-y-3">
                    {myPayoutMethods.length > 0 && (
                      <select
                        value={selectedPmId || myPayoutMethods.find((m) => m.isDefault)?.id || myPayoutMethods[0]?.id}
                        onChange={(e) => setSelectedPmId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      >
                        {myPayoutMethods.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.maskedIdentifier})
                          </option>
                        ))}
                      </select>
                    )}

                    <input
                      type="number"
                      min={monetizationConfig.minWithdrawalMwk}
                      step={500}
                      value={withdrawAmountMwk}
                      onChange={(e) => setWithdrawAmountMwk(e.target.value)}
                      placeholder={
                        isNy
                          ? `Ndalama mu MWK (osachepera ${monetizationConfig.minWithdrawalMwk.toLocaleString()})`
                          : `Amount in MWK (min ${monetizationConfig.minWithdrawalMwk.toLocaleString()})`
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                    />

                    {Number(withdrawAmountMwk) > 0 && (
                      <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1">
                        <div className="flex justify-between text-[var(--text-muted)]">
                          <span>
                            {isNy ? 'Chindapusa' : 'Fee'} ({monetizationConfig.payoutFeePercent}%)
                          </span>
                          <span className="font-mono">
                            {Math.round(
                              (Number(withdrawAmountMwk) * monetizationConfig.payoutFeePercent) / 100
                            ).toLocaleString()}{' '}
                            MWK
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-[var(--text)]">
                          <span>{isNy ? 'Ndalama zonse zolandira' : 'Net payout'}</span>
                          <span className="font-mono">
                            {Math.max(
                              0,
                              Number(withdrawAmountMwk) -
                                Math.round(
                                  (Number(withdrawAmountMwk) * monetizationConfig.payoutFeePercent) / 100
                                )
                            ).toLocaleString()}{' '}
                            MWK
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingWithdraw || myPayoutMethods.length === 0}
                      className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingWithdraw
                        ? isNy
                          ? 'Kutumiza...'
                          : 'Submitting...'
                        : isNy
                        ? 'Pemphani kutulutsa ndalama'
                        : 'Request withdrawal'}
                    </button>
                  </form>

                  {/* Payout Request History */}
                  {myPayoutRequests.length > 0 && (
                    <div className="pt-3 border-t border-[var(--border)] space-y-2">
                      <div className="text-xs font-bold text-[var(--text)]">
                        {isNy ? 'Zotulutsa zaposachedwa' : 'Recent withdrawals'}
                      </div>
                      {myPayoutRequests.slice(0, 5).map((req) => (
                        <div
                          key={req.id}
                          className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-[var(--text)] flex items-center gap-1.5 flex-wrap">
                              <span>{req.netAmountMwk.toLocaleString()} MWK</span>
                              {req.payoutToken && (
                                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--accent)]/40 text-[10px] font-mono text-[var(--accent-text)]">
                                  {req.payoutToken}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate">
                              {req.payoutMethodLabel} · {req.payoutDestinationMasked}
                              {req.txRef ? ` · ${req.txRef}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {req.payoutTokenSignature && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const v = await verifyServerToken(req.payoutTokenSignature!);
                                  if (v.valid) {
                                    showNotice(
                                      isNy
                                        ? `Chizindikiro cholipira ${req.payoutToken} ndi chovomerezeka.`
                                        : `Settlement token ${req.payoutToken} is cryptographically valid.`
                                    );
                                  } else {
                                    showNotice(
                                      v.error || (isNy ? 'Chizindikiro chosavomerezeka.' : 'Invalid settlement token.'),
                                      'err'
                                    );
                                  }
                                }}
                                className="px-2 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[10px] font-semibold text-[var(--violet)] cursor-pointer"
                              >
                                {isNy ? 'Tsimikizirani' : 'Verify'}
                              </button>
                            )}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] capitalize">
                              {req.status === 'awaiting_review'
                                ? isNy
                                  ? 'Kudikirira kuwunika'
                                  : 'Awaiting manual review'
                                : req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 6: WITHDRAWALS DASHBOARD ==================== */}
      {activeTab === 'withdrawals' && (
        <StudioWithdrawalsTab
          currentArtist={currentArtist}
          isMonetized={isMonetized}
          monetizationStatus={monetizationStatus}
          allEligible={allEligible}
          monetizationConfig={monetizationConfig}
          availableBalanceMwk={availableBalanceMwk}
          computedEarningsMwk={computedEarningsMwk}
          payoutMethods={myPayoutMethods}
          payoutRequests={myPayoutRequests}
          earningsRefreshKey={earningsRefreshKey}
          isRefreshingEarnings={isRefreshingEarnings}
          onRefreshEarnings={handleRefreshEarnings}
          onOpenMonetizationTab={() => setActiveTab('monetization')}
          onAddPayoutMethod={addPayoutMethod}
          onSubmitWithdrawal={submitPayoutRequest}
          onRequireReauth={requireReauth}
          onShowNotice={showNotice}
        />
      )}
    </div>
  );
};
