import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  FileAudio,
  FileCheck,
  HelpCircle,
  Image as ImageIcon,
  Lock,
  LogOut,
  Music,
  Play,
  Save,
  Search,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, formatFirebaseError } from '../services/firebase';
import { useAudio } from '../context/AudioContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useRouter } from '../context/RouterContext';
import { useToast } from '../context/ToastContext';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG, DEFAULT_BANNER_SVG } from '../utils/artworkFallback';
import {
  AdminConfig,
  DEFAULT_MONETIZATION_CONFIG,
  FirestoreGenre,
  MonetizationConfig,
  Track,
  User,
} from '../types';
import { formatNumber, formatTime, parseDurationInput } from '../utils/formatters';
import { isVerifiedAdminGoogleSession, PRIMARY_ADMIN_EMAIL } from '../services/authService';
import { extractAudioMetadata, ExtractedAudioMetadata, saveAudioBlob } from '../services/audioStorage';
import {
  uploadTrackAudioToFirebaseStorage,
  uploadTrackCoverToFirebaseStorage,
} from '../services/firebaseStorage';
import { CANONICAL_GENRES, subscribeToFirestoreGenres } from '../services/genresService';
import { detectDefaultCountry } from '../data/regions';
import { GenreSelectOrCustom } from './common/GenreSelectOrCustom';
import { RegionSelect } from './common/RegionSelect';

interface AdminPortalProps {
  onBackToExplore: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToExplore }) => {
  const {
    tracks,
    artists,
    addNewTrack,
    deleteTrack,
    playTrack,
    auditLogs,
    toggleDerankTrack,
    selectedCountry,
    upsertGenre,
    monetizationConfig,
    updateMonetizationConfig,
    payoutMethods,
    payoutRequests,
    updatePayoutRequestStatus,
    supportTickets,
    approveArtistMonetization,
    rejectArtistMonetization,
    suspendArtistMonetization,
  } = useAudio();

  const {
    currentUser,
    emailVerified,
    resendVerification,
    refreshEmailVerification,
    applications,
    approveArtistApplication,
    rejectArtistApplication,
    signInAdminWithGoogle,
    logout,
  } = useAuth();

  const { sendNotification } = useNotifications();
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'applications' | 'catalog' | 'reports' | 'royalties' | 'support' | 'audit' | 'settings'
  >('overview');

  // Firestore Real-time Users & Reports
  const [dbUsers, setDbUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState<'all' | 'listener' | 'artist' | 'admin'>('all');
  const [confirmDeactivateUserId, setConfirmDeactivateUserId] = useState<string | null>(null);

  const [reports, setReports] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedGenreFilter, setSelectedGenreFilter] = useState('all');
  const [confirmDeleteTrackId, setConfirmDeleteTrackId] = useState<string | null>(null);
  const [confirmPurgeCatalog, setConfirmPurgeCatalog] = useState(false);

  // Platform settings
  const [platformConfig, setPlatformConfig] = useState<AdminConfig>({
    id: 'setup',
    adminEmail: PRIMARY_ADMIN_EMAIL,
    isInitialized: true,
    royaltyPerStream: 0.0025,
    maintenanceMode: false,
    updatedAt: new Date().toISOString(),
  });
  const [monConfigForm, setMonConfigForm] = useState<MonetizationConfig>({
    ...DEFAULT_MONETIZATION_CONFIG,
    ...monetizationConfig,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    setMonConfigForm({ ...DEFAULT_MONETIZATION_CONFIG, ...monetizationConfig });
  }, [monetizationConfig]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'LOWERVIBE — Administration';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Real Certified Track Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioStreamUrl, setAudioStreamUrl] = useState('');
  const [announceNewRelease, setAnnounceNewRelease] = useState(true);
  const [extractedMeta, setExtractedMeta] = useState<ExtractedAudioMetadata | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadGenre, setUploadGenre] = useState('Afro Chillout');
  const [uploadMood, setUploadMood] = useState('Lake Breeze');
  const [uploadRegion, setUploadRegion] = useState(() => {
    const detected = detectDefaultCountry();
    return detected && detected !== 'Global'
      ? detected
      : selectedCountry && selectedCountry !== 'Global'
      ? selectedCountry
      : 'Malawi';
  });
  const [uploadStory, setUploadStory] = useState('');
  const [uploadBpm, setUploadBpm] = useState(90);
  const [uploadDuration, setUploadDuration] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [coverWarning, setCoverWarning] = useState<string | null>(null);
  const [artworkRightsChecked, setArtworkRightsChecked] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isPurgingDemoData, setIsPurgingDemoData] = useState(false);
  const [firestoreGenres, setFirestoreGenres] = useState<FirestoreGenre[]>([]);

  // Notification Broadcast State
  const [broadcastType, setBroadcastType] = useState<'news' | 'system'>('news');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Inline Reject / Suspend / Ticket Reply state
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [monActionArtistId, setMonActionArtistId] = useState<string | null>(null);
  const [monActionMode, setMonActionMode] = useState<'reject' | 'suspend'>('reject');
  const [monActionReason, setMonActionReason] = useState('');
  const [payoutFailId, setPayoutFailId] = useState<string | null>(null);
  const [payoutFailReason, setPayoutFailReason] = useState('');
  const [ticketReplyId, setTicketReplyId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');

  const resetUploadForm = () => {
    const detected = detectDefaultCountry();
    const defaultReg =
      detected && detected !== 'Global'
        ? detected
        : selectedCountry && selectedCountry !== 'Global'
        ? selectedCountry
        : 'Malawi';
    setAudioFile(null);
    setAudioStreamUrl('');
    setAnnounceNewRelease(true);
    setExtractedMeta(null);
    setUploadTitle('');
    setUploadArtist('');
    setUploadGenre('Afro Chillout');
    setUploadMood('Lake Breeze');
    setUploadRegion(defaultReg);
    setUploadStory('');
    setUploadBpm(90);
    setUploadDuration('');
    setCoverFile(null);
    setCoverPreview('');
    setCoverWarning(null);
    setArtworkRightsChecked(false);
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleAudioSelect = async (file: File) => {
    setAudioFile(file);
    setIsAnalyzingAudio(true);
    try {
      const meta = await extractAudioMetadata(file);
      setExtractedMeta(meta);
      if (meta.durationSeconds > 0) {
        setUploadDuration(formatTime(meta.durationSeconds));
      }
      if (!uploadTitle.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setUploadTitle(cleanName);
      }
      showToast(`Audio analyzed: ${meta.durationSeconds}s (${meta.fileSizeFormatted})`);
    } catch (err) {
      console.warn('Audio metadata analysis note:', err);
      const ext = file.name.split('.').pop()?.toUpperCase() || 'AUDIO';
      setExtractedMeta({
        durationSeconds: 0,
        sampleRate: 44100,
        bitDepth: '16-bit',
        isMaster24Bit: false,
        waveformData: Array.from({ length: 48 }, (_, idx) => Number((0.35 + (idx % 5) * 0.08).toFixed(2))),
        fileSizeFormatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        fileSizeBytes: file.size,
        bitrateLabel: 'Variable',
        audioFormat: ext,
        audioChecksum: `size-${file.size}`,
      });
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  const handleCoverSelect = (file: File) => {
    setCoverFile(file);
    setCoverWarning(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setCoverPreview(dataUrl);
      const img = new Image();
      img.onload = () => {
        if (img.width < 1400 || img.height < 1400) {
          setCoverWarning(`Artwork is ${img.width}x${img.height}px. Recommended square 1400x1400px or larger.`);
        } else if (Math.abs(img.width - img.height) > 20) {
          setCoverWarning(`Artwork is ${img.width}x${img.height}px. A square image (1:1) crops cleanly.`);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handlePurgeAllDemoData = async () => {
    setIsPurgingDemoData(true);
    try {
      for (const colName of ['tracks', 'artists', 'activities', 'claims']) {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      }
      localStorage.removeItem('lowervibe_tracks_v3');
      localStorage.removeItem('lowervibe_artists_v3');
      localStorage.removeItem('lowervibe_events_v3');
      localStorage.removeItem('lowervibe_claims_v3');
      localStorage.removeItem('lowervibe_featured_vibe_v3');
      localStorage.removeItem('lowervibe_history_v3');
      showToast('Catalog cleared. Ready for real uploads.');
    } catch (err: any) {
      showToast(err?.message || 'Could not clear catalog.');
    } finally {
      setIsPurgingDemoData(false);
      setConfirmPurgeCatalog(false);
    }
  };

  const handleAdminUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStreamUrl = audioStreamUrl.trim();
    if (!audioFile && !cleanStreamUrl) {
      showToast('Select an audio file or provide an HTTPS audio URL.');
      return;
    }
    if (!uploadTitle.trim()) {
      showToast('Enter a track title.');
      return;
    }
    if (!artworkRightsChecked) {
      showToast('Confirm that your artwork has no third-party platform logos and you own the rights.');
      return;
    }
    const cleanArtist = uploadArtist.trim() || 'Independent Artist';

    setIsUploading(true);
    setUploadProgress(15);

    try {
      const trackId = `track-${Date.now()}`;
      const ownerId = currentUser?.id || 'admin';
      let audioUrl = cleanStreamUrl;
      let storageAudioPath: string | undefined;

      if (audioFile) {
        await saveAudioBlob(trackId, audioFile);
        const uploadedAudio = await uploadTrackAudioToFirebaseStorage({
          ownerId,
          trackId,
          file: audioFile,
          checksum: extractedMeta?.audioChecksum,
          onProgress: (pct) => setUploadProgress(Math.max(20, Math.round(pct * 0.65))),
        });
        audioUrl = uploadedAudio.downloadUrl;
        storageAudioPath = uploadedAudio.storagePath;
      }

      setUploadProgress(75);

      let finalArtwork = DEFAULT_ARTWORK_SVG;
      let storageCoverPath: string | undefined;
      if (coverFile) {
        const uploadedCover = await uploadTrackCoverToFirebaseStorage({
          ownerId,
          trackId,
          blob: coverFile,
          originalFilename: coverFile.name,
          contentType: coverFile.type || 'image/jpeg',
        });
        finalArtwork = uploadedCover.downloadUrl;
        storageCoverPath = uploadedCover.storagePath;
      }

      const targetArtist = artists.find((a) => a.name.toLowerCase() === cleanArtist.toLowerCase());
      const artistId = targetArtist?.id || `artist-${Date.now()}`;

      if (!targetArtist) {
        const cleanHandle = `@${cleanArtist.toLowerCase().replace(/[^a-z0-9]/g, '') || 'artist'}`;
        const newArtistObj = {
          id: artistId,
          name: cleanArtist,
          handle: cleanHandle,
          genres: [uploadGenre.trim() || 'Afro Chillout'],
          location: uploadRegion || 'Malawi',
          country: uploadRegion || 'Malawi',
          avatar: finalArtwork,
          banner: DEFAULT_BANNER_SVG,
          bio: 'Independent artist on LOWERVIBE.',
          verified: true,
          isCertified: true,
          isMonetized: false,
          monetizationStatus: 'locked' as const,
          earningsBalance: 0,
          earningsBalanceMwk: 0,
          likesCount: 0,
          likedByUserIds: [],
          followersCount: 0,
          monthlyListeners: 0,
          joinedDate: new Date().toISOString(),
          socials: {},
          gearAndSetup: [],
          endorsedBy: [],
        };
        try {
          await setDoc(doc(db, 'artists', artistId), newArtistObj);
        } catch {}
      }

      const finalGenre = uploadGenre.trim() || 'Afro Chillout';
      await upsertGenre(finalGenre, { region: uploadRegion || 'Global' });

      const parsedDuration = parseDurationInput(uploadDuration);
      const resolvedDuration = parsedDuration > 0 ? parsedDuration : extractedMeta?.durationSeconds || 198;
      const sampleRateLabel = extractedMeta?.sampleRate ? `${extractedMeta.sampleRate} Hz` : '44100 Hz';
      const fileSizeLabel =
        extractedMeta?.fileSizeFormatted ||
        (audioFile ? `${(audioFile.size / (1024 * 1024)).toFixed(1)} MB` : 'HTTPS Stream');
      const formatLabel = extractedMeta?.audioFormat || (audioFile ? 'Audio Upload' : 'HTTPS Stream');

      const newTrackObj: Track = {
        id: trackId,
        title: uploadTitle.trim(),
        artistName: cleanArtist,
        artistId,
        artistAvatar: finalArtwork,
        coverArt: finalArtwork,
        audioUrl,
        storageAudioPath,
        storageCoverPath,
        audioChecksum: extractedMeta?.audioChecksum,
        verifiedMetadata: true,
        uploadedByUserId: ownerId,
        artworkRightsConfirmed: true,
        synthPreset: 'tape_warmth',
        durationSeconds: resolvedDuration,
        metadata: {
          Duration: resolvedDuration,
          duration: resolvedDuration,
          durationFormatted: formatTime(resolvedDuration),
          sampleRate: sampleRateLabel,
          fileSize: fileSizeLabel,
          audioFormat: formatLabel,
          bpm: uploadBpm || 105,
          composer: cleanArtist,
          checksum: extractedMeta?.audioChecksum,
          verifiedSource: audioFile ? 'firebase_storage' : 'https_stream',
        },
        genre: finalGenre,
        mood: uploadMood,
        region: uploadRegion || 'Malawi',
        vibeTags: [finalGenre, uploadMood, uploadRegion || 'Malawi'],
        bpm: uploadBpm || 105,
        keySignature: 'C Min',
        plays: 0,
        downloads: 0,
        likes: 0,
        likedByUserIds: [],
        reposts: 0,
        releaseDate: new Date().toISOString().split('T')[0],
        isDraft: false,
        isCertified: true,
        waveformData:
          extractedMeta?.waveformData ||
          Array.from({ length: 48 }, (_, idx) => Number((0.35 + (idx % 5) * 0.08).toFixed(2))),
        sampleRate: sampleRateLabel,
        fileSize: fileSizeLabel,
        audioQuality: formatLabel,
        story: uploadStory.trim() || '',
        comments: [],
        reactions: {},
      };

      setUploadProgress(92);
      addNewTrack(newTrackObj);

      if (announceNewRelease) {
        await sendNotification({
          userId: 'all',
          type: 'news',
          title: `New release: ${newTrackObj.title}`,
          message: `${cleanArtist} just released "${newTrackObj.title}" (${finalGenre}).`,
          actionRoute: `/tracks/${trackId}`,
        });
      }

      setUploadProgress(100);
      showToast(`Uploaded "${newTrackObj.title}"!`);

      setTimeout(() => {
        setIsUploadModalOpen(false);
        resetUploadForm();
        playTrack(newTrackObj);
      }, 300);
    } catch (err: any) {
      console.error('Upload error:', err);
      showToast(err?.message || 'Upload failed. Check audio file or URL.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('Enter a title and message.');
      return;
    }
    setIsSendingBroadcast(true);
    try {
      await sendNotification({
        userId: 'all',
        type: broadcastType,
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        actionRoute: broadcastType === 'news' ? '/discover' : '/',
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      showToast('Notification sent to all users.');
    } catch {
      showToast('Could not send notification.');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const isVerifiedAdminSession = Boolean(
    isVerifiedAdminGoogleSession(auth.currentUser) && (auth.currentUser?.emailVerified || emailVerified)
  );

  useEffect(() => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setDbUsers([]);
      setReports([]);
      return;
    }

    let unsubUsers = () => {};
    let unsubReports = () => {};
    let unsubConfig = () => {};
    let unsubGenres = () => {};

    try {
      if (isVerifiedAdminSession) {
        unsubUsers = onSnapshot(
          collection(db, 'users'),
          (snapshot) => {
            setDbUsers(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as User)));
          },
          (err) => {
            console.warn('Admin users listener error:', formatFirebaseError(err));
          }
        );

        unsubReports = onSnapshot(
          collection(db, 'reports'),
          (snapshot) => {
            setReports(snapshot.docs.map((d) => ({ ...d.data(), id: d.id })));
          },
          (err) => {
            console.warn('Admin reports listener error:', formatFirebaseError(err));
          }
        );
      } else {
        setDbUsers([]);
        setReports([]);
      }

      unsubConfig = onSnapshot(
        doc(db, 'admin_config', 'setup'),
        (snap) => {
          if (snap.exists()) {
            setPlatformConfig(snap.data() as AdminConfig);
          }
        },
        (err) => {
          console.warn('Admin config listener error:', formatFirebaseError(err));
        }
      );

      unsubGenres = subscribeToFirestoreGenres((loaded) => {
        setFirestoreGenres(loaded);
      });

      return () => {
        unsubUsers();
        unsubReports();
        unsubConfig();
        unsubGenres();
      };
    } catch (e) {
      console.warn('Admin portal subscription notice:', e);
    }
  }, [currentUser?.id, currentUser?.email, emailVerified, isVerifiedAdminSession]);

  const pendingApplicationsCount = applications.filter((a) => a.status === 'pending').length;
  const pendingMonetizationCount = artists.filter((a) => a.monetizationStatus === 'pending').length;
  const pendingPayoutsCount = payoutRequests.filter(
    (p) => p.status === 'awaiting_review' || p.status === 'processing'
  ).length;
  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;
  const openTicketsCount = supportTickets.filter((t) => t.status === 'open').length;

  const totalStreams = tracks.reduce((acc, t) => acc + (t.plays || 0), 0);
  const rateMwk = monetizationConfig.ratePerPlayMwk || 4.5;
  const totalRoyaltiesMwk = artists
    .filter((a) => a.monetizationStatus === 'approved')
    .reduce((sum, a) => {
      const plays = tracks
        .filter((t) => t.artistId === a.id)
        .reduce((s, t) => s + (t.plays || 0), 0);
      return sum + (a.earningsBalanceMwk ?? plays * rateMwk);
    }, 0);

  const dynamicCatalogGenres = Array.from(
    new Set([
      ...CANONICAL_GENRES.map((g) => g.name),
      ...firestoreGenres.map((g) => g.name),
      ...tracks.map((t) => t.genre).filter(Boolean),
    ])
  );

  const filteredCatalog = tracks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      t.artistName.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesGenre = selectedGenreFilter === 'all' || t.genre === selectedGenreFilter;
    return matchesSearch && matchesGenre;
  });

  const filteredUsers = dbUsers.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.username.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = selectedUserFilter === 'all' || u.role === selectedUserFilter;
    return matchesSearch && matchesRole;
  });

  const handleResolveReport = async (reportId: string, resolution: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status: resolution,
        resolvedAt: new Date().toISOString(),
        resolvedBy: currentUser?.email || PRIMARY_ADMIN_EMAIL,
      });
      showToast(`Report marked as ${resolution}`);
    } catch {
      showToast('Could not update report');
    }
  };

  const handleSavePlatformSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    try {
      await setDoc(
        doc(db, 'admin_config', 'setup'),
        {
          ...platformConfig,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await updateMonetizationConfig(monConfigForm);
      showToast('Platform settings saved to Firestore.');
    } catch {
      showToast('Failed to save settings.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleAnswerTicket = async (ticketId: string) => {
    if (!ticketReplyText.trim()) return;
    try {
      await updateDoc(doc(db, 'tickets', ticketId), {
        status: 'answered',
        adminReply: ticketReplyText.trim(),
        updatedAt: new Date().toISOString(),
      });
      setTicketReplyId(null);
      setTicketReplyText('');
      showToast('Reply saved to ticket.');
    } catch {
      showToast('Could not save reply.');
    }
  };

  const handleAdminLogout = async () => {
    await logout();
    showToast('Signed out.');
    navigate('/administration/login');
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-24">
      {/* Top Staff Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--accent)]/15 text-[var(--accent-text)] border border-[var(--accent)]/30">
              Standalone Administration
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-2)] border border-[var(--border)]">
              /administration
            </span>
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              Admin: <span className="text-[var(--text)] font-bold">{PRIMARY_ADMIN_EMAIL}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-[var(--text)]">
            LOWERVIBE Administration
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Independent administration workspace for users, artist approvals, tracks, moderation, payouts, and platform rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-contrast)] transition flex items-center gap-1.5 cursor-pointer min-h-[44px]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Song</span>
          </button>

          <button
            type="button"
            onClick={onBackToExplore}
            className="px-4 py-2 rounded-full bg-[var(--surface-2)] hover:border-[var(--border-strong)] text-xs font-medium text-[var(--text)] border border-[var(--border)] transition cursor-pointer min-h-[44px]"
          >
            Open Main App
          </button>

          <button
            type="button"
            onClick={handleAdminLogout}
            className="px-4 py-2 rounded-full bg-[var(--danger)]/15 text-xs font-bold text-[var(--danger)] border border-[var(--danger)]/30 transition cursor-pointer flex items-center gap-1.5 min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {!isVerifiedAdminSession && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[var(--accent-text)] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-[var(--text)]">
                Google Login Auth session required for {PRIMARY_ADMIN_EMAIL}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Firestore rules strictly require a verified Google Login Auth token for {PRIMARY_ADMIN_EMAIL}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const res = await signInAdminWithGoogle();
                showToast(res.success ? 'Verified Google Admin session active.' : res.error || 'Google sign-in required.');
              }}
              className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer min-h-[40px]"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      )}

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Users</span>
          <div className="text-xl font-black text-[var(--text)]">{Math.max(dbUsers.length, 1)}</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Artist Requests</span>
          <div className={`text-xl font-black ${pendingApplicationsCount > 0 ? 'text-[var(--accent-text)]' : 'text-[var(--text)]'}`}>
            {pendingApplicationsCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Songs</span>
          <div className="text-xl font-black text-[var(--text)]">{tracks.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Total Plays</span>
          <div className="text-xl font-black text-[var(--accent-text)]">{formatNumber(totalStreams)}</div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Payout Queue</span>
          <div className={`text-xl font-black ${pendingPayoutsCount > 0 ? 'text-[var(--violet)]' : 'text-[var(--text)]'}`}>
            {pendingPayoutsCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Reports</span>
          <div className={`text-xl font-black ${pendingReportsCount > 0 ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
            {pendingReportsCount}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-[var(--border)]">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'users', label: `Users (${dbUsers.length})`, icon: Users },
          { id: 'applications', label: `Artist Requests (${pendingApplicationsCount})`, icon: FileCheck },
          { id: 'catalog', label: `Songs (${tracks.length})`, icon: Music },
          { id: 'royalties', label: `Monetization & Payouts (${pendingMonetizationCount + pendingPayoutsCount})`, icon: DollarSign },
          { id: 'reports', label: `Reports (${pendingReportsCount})`, icon: ShieldAlert },
          { id: 'support', label: `Support (${openTicketsCount})`, icon: HelpCircle },
          { id: 'audit', label: `Activity Log (${auditLogs.length})`, icon: Clock },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer min-h-[44px] ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                  : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
              <h3 className="text-base font-bold font-heading text-[var(--text)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
                <span>Action Items</span>
              </h3>

              <div className="space-y-2.5">
                <div
                  onClick={() => setActiveTab('applications')}
                  className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 text-[var(--accent-text)] flex items-center justify-center font-bold">
                      {pendingApplicationsCount}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text)]">Artist Applications</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Approve or decline studio requests</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>

                <div
                  onClick={() => setActiveTab('royalties')}
                  className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--violet)]/15 text-[var(--violet)] flex items-center justify-center font-bold">
                      {pendingMonetizationCount + pendingPayoutsCount}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text)]">Monetization &amp; Payout Requests</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {pendingMonetizationCount} eligibility reviews · {pendingPayoutsCount} payouts waiting
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>

                <div
                  onClick={() => setActiveTab('reports')}
                  className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--border-strong)] flex items-center justify-between cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--danger)]/15 text-[var(--danger)] flex items-center justify-center font-bold">
                      {pendingReportsCount}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text)]">Copyright &amp; Content Reports</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Review flagged tracks and bug reports</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
              <h3 className="text-base font-bold font-heading text-[var(--text)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--violet)]" />
                <span>Platform Summary</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Monetized Balances</span>
                  <div className="text-xl font-black text-[var(--accent-text)]">
                    MWK {Math.round(totalRoyaltiesMwk).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">At MWK {rateMwk.toFixed(2)} / play</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
                  <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Open Support Tickets</span>
                  <div className="text-xl font-black text-[var(--text)]">{openTicketsCount}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">From Help &amp; Support form</div>
                </div>
              </div>
            </div>
          </div>

          {/* Broadcast Notification */}
          <form onSubmit={handleSendBroadcast} className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold font-heading text-[var(--text)] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[var(--accent-text)]" />
                  <span>Send Notification to All Users</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Appears in the header notification bell for every listener and artist.
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1 rounded-full border border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setBroadcastType('news')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    broadcastType === 'news' ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  News
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcastType('system')}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                    broadcastType === 'system' ? 'bg-[var(--violet)] text-white' : 'text-[var(--text-muted)]'
                  }`}
                >
                  System Alert
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="Headline..."
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
              <input
                type="text"
                required
                placeholder="Message visible to listeners and artists..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="md:col-span-2 px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSendingBroadcast}
                className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingBroadcast ? 'Sending...' : 'Send Notification'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search users by name, email, or handle..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value as any)}
              className="px-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All Roles</option>
              <option value="listener">Listeners</option>
              <option value="artist">Artists</option>
              <option value="admin">Admins</option>
            </select>
          </div>

          <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] font-mono text-[10px] uppercase border-b border-[var(--border)]">
                  <tr>
                    <th className="p-3.5 pl-4">User</th>
                    <th className="p-3.5">Role</th>
                    <th className="p-3.5">Email</th>
                    <th className="p-3.5">Liked Songs</th>
                    <th className="p-3.5 text-right pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-[var(--surface-2)] transition">
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={user.avatar || DEFAULT_AVATAR_SVG}
                              alt={user.name}
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                              }}
                              className="w-9 h-9 rounded-xl object-cover shrink-0 border border-[var(--border)]"
                            />
                            <div>
                              <div className="font-bold text-[var(--text)]">{user.name}</div>
                              <div className="text-[11px] text-[var(--text-muted)]">@{user.username}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
                            {user.role}
                          </span>
                        </td>

                        <td className="p-3.5 text-[var(--text-muted)] font-mono text-[11px]">{user.email}</td>

                        <td className="p-3.5 font-mono text-[11px] text-[var(--text-muted)]">
                          {user.likedTrackIds?.length || 0} songs
                        </td>

                        <td className="p-3.5 text-right pr-4">
                          {user.email !== PRIMARY_ADMIN_EMAIL && (
                            <div className="inline-flex items-center gap-1.5">
                              {confirmDeactivateUserId === user.id ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await updateDoc(doc(db, 'users', user.id), { isDeactivated: true });
                                      setConfirmDeactivateUserId(null);
                                      showToast(`${user.name} deactivated.`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-[var(--danger)] text-white text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeactivateUserId(null)}
                                    className="px-2 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] text-[10px] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeactivateUserId(user.id)}
                                  className="p-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--danger)] transition cursor-pointer"
                                  title="Deactivate user"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ARTIST APPLICATIONS */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-heading text-[var(--text)]">Artist Applications</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Approve or decline listener requests to open an artist profile.
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--accent-text)]">{pendingApplicationsCount} pending</span>
          </div>

          {applications.length === 0 ? (
            <div className="p-10 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-2">
              <FileCheck className="w-8 h-8 text-[var(--accent-text)] mx-auto" />
              <h3 className="text-sm font-bold text-[var(--text)]">No Applications Yet</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="p-5 sm:p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={app.avatarUrl || DEFAULT_AVATAR_SVG}
                        alt={app.stageName}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                        }}
                        className="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] shrink-0"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-[var(--text)]">{app.stageName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]">
                            {app.status}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-[var(--surface-2)] text-[var(--text-muted)]">
                            {app.country}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-[var(--violet)]/15 text-[var(--violet)]">
                            {app.primaryGenre}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          Name: <span className="text-[var(--text)] font-medium">{app.legalName}</span> · Email:{' '}
                          <span className="text-[var(--text)] font-medium">{app.userEmail}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-[10px] font-mono text-[var(--text-muted)]">
                      Submitted {new Date(app.submittedAt).toLocaleDateString()}
                    </div>
                  </div>

                  {app.bio && (
                    <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]">
                      "{app.bio}"
                    </div>
                  )}

                  {app.status === 'pending' && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                          type="button"
                          onClick={async () => {
                            await approveArtistApplication(app.id);
                            showToast(`Approved ${app.stageName} as Artist.`);
                          }}
                          className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Approve Artist</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (rejectingAppId === app.id) {
                              setRejectingAppId(null);
                              setRejectFeedback('');
                            } else {
                              setRejectingAppId(app.id);
                              setRejectFeedback('');
                            }
                          }}
                          className="px-4 py-2.5 rounded-full bg-[var(--surface-2)] text-[var(--danger)] text-xs font-bold cursor-pointer border border-[var(--border)]"
                        >
                          {rejectingAppId === app.id ? 'Cancel' : 'Decline'}
                        </button>
                      </div>

                      {rejectingAppId === app.id && (
                        <div className="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--danger)]/40 space-y-2.5">
                          <label className="text-[11px] font-mono font-bold text-[var(--danger)] block">
                            Reason (sent to applicant):
                          </label>
                          <input
                            type="text"
                            value={rejectFeedback}
                            onChange={(e) => setRejectFeedback(e.target.value)}
                            placeholder="Reason for declining..."
                            className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await rejectArtistApplication(
                                  app.id,
                                  rejectFeedback.trim() || 'Does not meet current upload requirements.'
                                );
                                setRejectingAppId(null);
                                setRejectFeedback('');
                                showToast(`Decline notice sent to ${app.stageName}.`);
                              }}
                              className="px-4 py-1.5 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                            >
                              Confirm Decline
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SONGS CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex flex-1 flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search songs or artists..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <select
                value={selectedGenreFilter}
                onChange={(e) => setSelectedGenreFilter(e.target.value)}
                className="px-4 py-2.5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Genres</option>
                {dynamicCatalogGenres.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Song</span>
              </button>

              {confirmPurgeCatalog ? (
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--danger)]/15 border border-[var(--danger)]/40">
                  <button
                    type="button"
                    onClick={handlePurgeAllDemoData}
                    disabled={isPurgingDemoData}
                    className="px-3 py-1.5 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                  >
                    {isPurgingDemoData ? 'Clearing...' : 'Confirm Clear All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPurgeCatalog(false)}
                    className="px-2.5 py-1.5 text-xs text-[var(--text)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPurgeCatalog(true)}
                  className="px-4 py-2.5 rounded-2xl bg-[var(--surface)] hover:text-[var(--danger)] text-[var(--text-muted)] border border-[var(--border)] text-xs font-mono transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Catalog</span>
                </button>
              )}
            </div>
          </div>

          {tracks.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
              <Music className="w-8 h-8 text-[var(--accent-text)] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-heading text-[var(--text)]">No songs uploaded yet</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                  Upload a song to test streaming and downloads.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload Song</span>
              </button>
            </div>
          ) : (
            <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] font-mono text-[10px] uppercase border-b border-[var(--border)]">
                    <tr>
                      <th className="p-3.5 pl-4">Song</th>
                      <th className="p-3.5">Genre</th>
                      <th className="p-3.5">Duration</th>
                      <th className="p-3.5">Plays</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredCatalog.map((track) => (
                      <tr key={track.id} className="hover:bg-[var(--surface-2)] transition">
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => playTrack(track)}
                              className="w-10 h-10 rounded-xl overflow-hidden relative group/cover shrink-0 cursor-pointer border border-[var(--border)]"
                              title="Play"
                            >
                              <img
                                src={track.coverArt || DEFAULT_ARTWORK_SVG}
                                alt={track.title}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = DEFAULT_ARTWORK_SVG;
                                }}
                                className="w-full h-full object-cover"
                              />
                            </button>
                            <div className="min-w-0 max-w-[200px]">
                              <div className="font-bold text-[var(--text)] truncate">{track.title}</div>
                              <div className="text-[11px] text-[var(--text-muted)] truncate">{track.artistName}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5 text-[var(--text-muted)] font-mono">{track.genre}</td>
                        <td className="p-3.5 text-[var(--text-muted)] font-mono">{formatTime(track.durationSeconds)}</td>
                        <td className="p-3.5 font-mono text-[var(--text)] font-bold">{track.plays || 0}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
                            {track.isDeranked ? 'Hidden' : track.isDraft ? 'Draft' : 'Live'}
                          </span>
                        </td>

                        <td className="p-3.5 text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => playTrack(track)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--accent)]/15 text-[var(--accent-text)] text-[10px] font-mono font-bold cursor-pointer"
                            >
                              Play
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleDerankTrack(track.id)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-mono text-[var(--text)] cursor-pointer"
                            >
                              {track.isDeranked ? 'Restore' : 'Hide'}
                            </button>
                            {confirmDeleteTrackId === track.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await deleteTrack(track.id);
                                    if (!res.success) {
                                      showToast(res.error || 'Could not delete track');
                                      return;
                                    }
                                    setConfirmDeleteTrackId(null);
                                    showToast(`Deleted "${track.title}"`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--danger)] text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Confirm Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTrackId(null)}
                                  className="px-2 py-1 text-[10px] text-[var(--text-muted)] cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTrackId(track.id)}
                                className="p-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MONETIZATION & PAYOUT REQUESTS */}
      {activeTab === 'royalties' && (
        <div className="space-y-6">
          {/* Auto-Acceptance Status Banner */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-[var(--text)]">
                Automatic Payout &amp; Eligibility Acceptance Active
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Eligible artists ({monetizationConfig.requiredPublishedTracks}+ tracks, {monetizationConfig.requiredPlays30d.toLocaleString()}+ plays, {monetizationConfig.requiredFollowers}+ followers, 0 strikes) and verified payout methods are accepted automatically.
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--accent-text)] shrink-0">
              {payoutMethods.filter((m) => m.status === 'accepted' || new Date(m.payoutHoldUntil).getTime() <= Date.now()).length} accepted payout method(s)
            </div>
          </div>

          {/* Payout Requests Queue */}
          <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text)] font-heading">
                  Payout Requests ({payoutRequests.length})
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Provider mode: {monetizationConfig.payoutProviderConfigured ? 'Automated provider' : 'Manual transfer settlement'}
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--violet)]">
                {pendingPayoutsCount} waiting
              </span>
            </div>

            {payoutRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No withdrawal requests submitted yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {payoutRequests.map((req) => (
                  <div key={req.id} className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-[var(--text)]">{req.artistName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
                            {req.status === 'awaiting_review' ? 'Awaiting manual review' : req.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {req.payoutMethodLabel} ({req.payoutDestinationMasked}) · Net: MWK {req.netAmountMwk.toLocaleString()} (Fee: MWK {req.feeMwk.toLocaleString()})
                        </p>
                        {(req.payoutToken || req.txRef) && (
                          <p className="text-[10px] font-mono text-[var(--accent-text)] mt-1">
                            {req.payoutToken ? `Token: ${req.payoutToken}` : ''}
                            {req.payoutToken && req.txRef ? ' · ' : ''}
                            {req.txRef ? `Ref: ${req.txRef}` : ''}
                          </p>
                        )}
                      </div>

                      {(req.status === 'awaiting_review' || req.status === 'processing') && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              updatePayoutRequestStatus(req.id, 'paid');
                              showToast(`Marked payout for ${req.artistName} as Paid.`);
                            }}
                            className="px-3.5 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                          >
                            Mark Paid
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPayoutFailId(payoutFailId === req.id ? null : req.id);
                              setPayoutFailReason('');
                            }}
                            className="px-3.5 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--danger)] text-xs font-bold cursor-pointer"
                          >
                            Mark Failed
                          </button>
                        </div>
                      )}
                    </div>

                    {payoutFailId === req.id && (
                      <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--danger)]/40 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={payoutFailReason}
                          onChange={(e) => setPayoutFailReason(e.target.value)}
                          placeholder="Reason for failure..."
                          className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updatePayoutRequestStatus(req.id, 'failed', payoutFailReason.trim() || 'Transfer rejected');
                            setPayoutFailId(null);
                            setPayoutFailReason('');
                            showToast('Payout marked failed.');
                          }}
                          className="px-4 py-2 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                        >
                          Save Failed Status
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Creator Monetization Approval Roster */}
          <div className="rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--text)] font-heading">
                Artist Monetization ({artists.length})
              </h3>
              <span className="text-xs font-mono text-[var(--accent-text)]">
                {pendingMonetizationCount} awaiting review
              </span>
            </div>

            {artists.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">No artists registered yet.</div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {artists.map((artist) => {
                  const status = artist.monetizationStatus || 'locked';
                  const isMon = status === 'approved';
                  const artistStreams = tracks
                    .filter((t) => t.artistId === artist.id)
                    .reduce((sum, t) => sum + (t.plays || 0), 0);

                  return (
                    <div key={artist.id} className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={artist.avatar || DEFAULT_AVATAR_SVG}
                            alt={artist.name}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_SVG;
                            }}
                            className="w-11 h-11 rounded-xl object-cover border border-[var(--border)] shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[var(--text)] truncate">{artist.name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
                                {status}
                              </span>
                              {artist.monetizationApprovalToken && (
                                <span className="px-2 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--accent)]/40 text-[9px] font-mono text-[var(--accent-text)]">
                                  {artist.monetizationApprovalToken}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                              {artist.country || artist.location || 'Malawi'} · {artistStreams} plays · {artist.followersCount || 0} followers
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {!isMon && (
                            <button
                              type="button"
                              onClick={() => {
                                approveArtistMonetization(artist.id);
                                showToast(`Approved monetization for ${artist.name}`);
                              }}
                              className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                          )}

                          {status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => {
                                setMonActionArtistId(artist.id);
                                setMonActionMode('reject');
                                setMonActionReason('');
                              }}
                              className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--danger)] text-xs font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          )}

                          {isMon && (
                            <button
                              type="button"
                              onClick={() => {
                                setMonActionArtistId(artist.id);
                                setMonActionMode('suspend');
                                setMonActionReason('');
                              }}
                              className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--danger)] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Suspend</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {monActionArtistId === artist.id && (
                        <div className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--danger)]/40 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={monActionReason}
                            onChange={(e) => setMonActionReason(e.target.value)}
                            placeholder={`Reason to ${monActionMode} monetization...`}
                            className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const reason = monActionReason.trim() || 'Policy requirements not met.';
                              if (monActionMode === 'reject') {
                                await rejectArtistMonetization(artist.id, reason);
                              } else {
                                await suspendArtistMonetization(artist.id, reason);
                              }
                              setMonActionArtistId(null);
                              setMonActionReason('');
                              showToast(`Updated monetization for ${artist.name}`);
                            }}
                            className="px-4 py-2 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                          >
                            Confirm {monActionMode === 'reject' ? 'Reject' : 'Suspend'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold font-heading text-[var(--text)]">Reports &amp; Takedowns</h2>
              <p className="text-xs text-[var(--text-muted)]">Copyright claims, content flags, and bug reports.</p>
            </div>
            <span className="text-xs font-mono text-[var(--danger)]">{pendingReportsCount} pending</span>
          </div>

          {reports.length === 0 ? (
            <div className="p-10 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[var(--accent-text)] mx-auto" />
              <h3 className="text-sm font-bold text-[var(--text)]">No active reports</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div key={rep.id} className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-[var(--danger)] uppercase">{rep.reason}</span>
                      <h4 className="text-sm font-bold text-[var(--text)]">{rep.trackTitle || rep.type}</h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        From: {rep.reporterEmail} · {new Date(rep.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
                      {rep.status}
                    </span>
                  </div>
                  {rep.details && (
                    <div className="p-3 rounded-2xl bg-[var(--surface-2)] text-xs text-[var(--text)]">"{rep.details}"</div>
                  )}
                  {rep.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleResolveReport(rep.id, 'resolved')}
                        className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveReport(rep.id, 'dismissed')}
                        className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text-muted)] cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold font-heading text-[var(--text)]">Support Tickets</h2>
            <p className="text-xs text-[var(--text-muted)]">Questions and help requests submitted from Account &gt; Support.</p>
          </div>
          {supportTickets.length === 0 ? (
            <div className="p-10 rounded-3xl bg-[var(--surface)] border border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
              No support tickets yet.
            </div>
          ) : (
            <div className="space-y-3">
              {supportTickets.map((t) => (
                <div key={t.id} className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[var(--accent-text)]">{t.category}</span>
                      <h4 className="text-sm font-bold text-[var(--text)]">{t.subject}</h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t.userName} ({t.userEmail}) · {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]">
                      {t.status}
                    </span>
                  </div>
                  <p className="p-3 rounded-2xl bg-[var(--surface-2)] text-xs text-[var(--text)]">{t.message}</p>
                  {t.adminReply && (
                    <p className="p-3 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-xs text-[var(--text)]">
                      Reply: {t.adminReply}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTicketReplyId(ticketReplyId === t.id ? null : t.id);
                        setTicketReplyText(t.adminReply || '');
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-xs font-bold text-[var(--text)] cursor-pointer"
                    >
                      {t.adminReply ? 'Edit Reply' : 'Reply'}
                    </button>
                  </div>
                  {ticketReplyId === t.id && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ticketReplyText}
                        onChange={(e) => setTicketReplyText(e.target.value)}
                        placeholder="Type response..."
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAnswerTicket(t.id)}
                        className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold font-heading text-[var(--text)]">Activity Log</h2>
            <p className="text-xs text-[var(--text-muted)]">Recent admin actions recorded on the platform.</p>
          </div>
          <div className="divide-y divide-[var(--border)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)]">{log.action}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-muted)] uppercase">
                      {log.targetType}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] text-[11px] truncate">{log.details}</p>
                </div>
                <div className="text-right font-mono text-[10px] text-[var(--text-muted)] shrink-0">
                  <div>{log.adminEmail}</div>
                  <div>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSavePlatformSettings} className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-5 max-w-2xl">
          <div>
            <h2 className="text-base font-bold font-heading text-[var(--text)]">Monetization &amp; Platform Settings</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Configure real payout rates, eligibility thresholds, and payout provider mode.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[var(--text)]">Rate per qualifying play (MWK)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={monConfigForm.ratePerPlayMwk}
                onChange={(e) =>
                  setMonConfigForm({ ...monConfigForm, ratePerPlayMwk: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[var(--text)]">Minimum withdrawal (MWK)</label>
              <input
                type="number"
                step="500"
                min="1000"
                value={monConfigForm.minWithdrawalMwk}
                onChange={(e) =>
                  setMonConfigForm({ ...monConfigForm, minWithdrawalMwk: parseInt(e.target.value, 10) || 20000 })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[var(--text)]">Payout processing fee (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={monConfigForm.payoutFeePercent}
                onChange={(e) =>
                  setMonConfigForm({ ...monConfigForm, payoutFeePercent: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[var(--text)]">Required published songs</label>
              <input
                type="number"
                min="1"
                value={monConfigForm.requiredPublishedTracks}
                onChange={(e) =>
                  setMonConfigForm({ ...monConfigForm, requiredPublishedTracks: parseInt(e.target.value, 10) || 3 })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[var(--text)]">Required plays (30 days)</label>
              <input
                type="number"
                min="0"
                value={monConfigForm.requiredPlays30d}
                onChange={(e) =>
                  setMonConfigForm({ ...monConfigForm, requiredPlays30d: parseInt(e.target.value, 10) || 500 })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[var(--text)]">Required followers</label>
              <input
                type="number"
                min="0"
                value={monConfigForm.requiredFollowers}
                onChange={(e) =>
                  setMonConfigForm({ ...monConfigForm, requiredFollowers: parseInt(e.target.value, 10) || 50 })
                }
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>
          </div>

          <label className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[var(--text)]">Automated Payout Provider Configured</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Enable only when Flutterwave/PayChangu/USDT keys are configured on Cloud Functions.
              </div>
            </div>
            <input
              type="checkbox"
              checked={monConfigForm.payoutProviderConfigured}
              onChange={(e) =>
                setMonConfigForm({ ...monConfigForm, payoutProviderConfigured: e.target.checked })
              }
              className="w-5 h-5 accent-[var(--accent)]"
            />
          </label>

          <label className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer">
            <div>
              <div className="text-xs font-bold text-[var(--text)]">Maintenance Mode</div>
              <div className="text-[11px] text-[var(--text-muted)]">Pause new uploads during maintenance</div>
            </div>
            <input
              type="checkbox"
              checked={platformConfig.maintenanceMode}
              onChange={(e) => setPlatformConfig({ ...platformConfig, maintenanceMode: e.target.checked })}
              className="w-5 h-5 accent-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            disabled={isSavingConfig}
            className="px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingConfig ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </form>
      )}

      {/* MODAL: UPLOAD SONG */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-7 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl sm:text-2xl font-black font-heading text-[var(--text)]">
                  Upload Song
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Files upload directly to Firebase Storage and publish to the catalog.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="p-2 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminUploadSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-[var(--text)] flex items-center justify-between">
                  <span>Audio file (.mp3, .wav, .m4a) *</span>
                  {extractedMeta && (
                    <span className="text-[var(--accent-text)] text-[10px]">
                      {extractedMeta.durationSeconds}s · {extractedMeta.fileSizeFormatted}
                    </span>
                  )}
                </label>
                <label className="relative flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] bg-[var(--surface-2)] transition cursor-pointer">
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleAudioSelect(e.target.files[0]);
                    }}
                    className="sr-only"
                  />
                  <div className="flex flex-col items-center gap-2 text-center">
                    <FileAudio className="w-6 h-6 text-[var(--accent-text)]" />
                    {audioFile ? (
                      <div className="text-xs font-bold text-[var(--text)] truncate max-w-sm">
                        {audioFile.name} {isAnalyzingAudio ? '(Reading audio...)' : ''}
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--text-muted)]">Click to choose an audio file (max 120MB)</div>
                    )}
                  </div>
                </label>

                <input
                  type="url"
                  value={audioStreamUrl}
                  onChange={(e) => setAudioStreamUrl(e.target.value)}
                  placeholder="Or paste an HTTPS audio file URL"
                  className="w-full px-3.5 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">Title *</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">Artist name *</label>
                  <input
                    type="text"
                    required
                    value={uploadArtist}
                    onChange={(e) => setUploadArtist(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">Genre *</label>
                  <GenreSelectOrCustom
                    value={uploadGenre}
                    onChange={setUploadGenre}
                    onCustomGenreCreated={(name) => upsertGenre(name, { region: uploadRegion })}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">Country / Region *</label>
                  <RegionSelect
                    value={uploadRegion}
                    onChange={setUploadRegion}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">Mood</label>
                  <select
                    value={uploadMood}
                    onChange={(e) => setUploadMood(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  >
                    <option value="Lake Breeze">Lake Breeze</option>
                    <option value="Midnight">Midnight</option>
                    <option value="Golden Hour">Golden Hour</option>
                    <option value="Focus">Focus</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">BPM</label>
                  <input
                    type="number"
                    min="40"
                    max="220"
                    value={uploadBpm}
                    onChange={(e) => setUploadBpm(parseInt(e.target.value, 10) || 90)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono font-bold text-[var(--text)]">Duration</label>
                  <input
                    type="text"
                    placeholder="3:45"
                    value={uploadDuration}
                    onChange={(e) => setUploadDuration(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono text-[var(--text)]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-[var(--text)] block">
                  Cover artwork (square 1400x1400 recommended)
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] cursor-pointer">
                    <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
                    <span>Upload Cover Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleCoverSelect(e.target.files[0]);
                      }}
                      className="sr-only"
                    />
                  </label>
                  {coverPreview && (
                    <img src={coverPreview} alt="Cover preview" className="w-12 h-12 rounded-xl object-cover border border-[var(--border)]" />
                  )}
                </div>
                {coverWarning && (
                  <p className="text-[11px] text-amber-500 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{coverWarning}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold text-[var(--text)]">Description</label>
                <textarea
                  rows={2}
                  value={uploadStory}
                  onChange={(e) => setUploadStory(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer text-xs text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={artworkRightsChecked}
                    onChange={(e) => setArtworkRightsChecked(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span>This artwork has no other platform&apos;s logo and I own the rights *</span>
                </label>

                <label className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer text-xs text-[var(--text)]">
                  <input
                    type="checkbox"
                    checked={announceNewRelease}
                    onChange={(e) => setAnnounceNewRelease(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  <span>Notify listeners about this release</span>
                </label>
              </div>

              {isUploading && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-[var(--accent-text)]">
                    <span>Uploading to Firebase Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    resetUploadForm();
                  }}
                  className="px-5 py-2.5 rounded-full bg-[var(--surface-2)] text-xs text-[var(--text)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || isAnalyzingAudio}
                  className="px-6 py-2.5 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Publishing...' : 'Publish Song'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
