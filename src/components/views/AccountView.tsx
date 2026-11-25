import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Bug,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  HardDrive,
  Headphones,
  HelpCircle,
  Image as ImageIcon,
  KeyRound,
  Link2,
  ListMusic,
  LogOut,
  Mail,
  MessageSquare,
  Monitor,
  Moon,
  Music,
  Palette,
  Play,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Sliders,
  Smartphone,
  Star,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  Users,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAudio } from '../../context/AudioContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRouter } from '../../context/RouterContext';
import { useTheme } from '../../context/ThemeContext';
import { AudioQualityPreference } from '../../context/AudioContext';
import { COUNTRIES_LIST } from '../../data/regions';
import {
  clearOfflineCache,
  getOfflineCacheStats,
  OfflineCacheStats,
  removeTrackOfflineCache,
} from '../../services/audioStorage';
import {
  deleteUploadedStoragePaths,
  uploadCompressedAvatar,
  uploadCompressedCoverBanner,
} from '../../services/uploadService';
import { getShortArtistShareUrl, getTrustedShareOrigin } from '../../utils/shareLinks';
import { EqPreset } from '../../types';
import { DEFAULT_ARTWORK_SVG, DEFAULT_AVATAR_SVG, DEFAULT_BANNER_SVG } from '../../utils/artworkFallback';
import { playNotificationSound } from '../../utils/notificationSound';
import { openPwaInstallPrompt } from '../../utils/pwaManifest';

function maskEmailAddress(email?: string): string {
  if (!email || !email.includes('@')) return 'Not added';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getHelpTopics(isNy: boolean) {
  if (isNy) {
    return [
      {
        q: 'Ndingakweze bwanji nyimbo yanga pa LOWERVIBE?',
        a: 'Dinani "Lembani ngati woimba" mu Zida za Woimba (kapena tsegulani Situdiyo ngati ndinu kale woimba), sankhani nyimbo yanu (MP3, WAV, FLAC, kapena M4A) ndi chithunzi chachikulu cha sikweya (osachepera 1400×1400 px), kenako kwezani.',
      },
      {
        q: 'Chifukwa chiyani chithunzi cha nyimbo chikufunika kukhala sikweya ndi 1400×1400?',
        a: 'Chithunzi choyera ndi chakulu chimaletsa kusafooka pa mafoni ndi ma TV ndipo chimaonekera bwino mukagawana ulalo wa nyimbo.',
      },
      {
        q: 'Kodi kuwerenga nyimbo ndi zokonda zimaikidwa bwanji?',
        a: 'Nyimbo imawerengedwa pambuyo pomvera masekondi 30+ ndipo imayikidwa kamodzi pa mphindi 30 kwa womvera aliyense. Kukonda ndi kamodzi pa akaunti iliyonse.',
      },
      {
        q: 'Kodi oimba amayamba liti kupeza ndalama ndi kuzitenga?',
        a: 'Malipiro amatseguka mukakwaniritsa zofunikira za nyimbo, kuwerengedwa ndi otsatira mu Situdiyo → Malipiro ndipo oyang\'anira atavomereza. Kudziliza nokha sikulipiritsa.',
      },
      {
        q: 'Ndi njira ziti zolandirira ndalama zomwe zilipo ku Malawi?',
        a: 'Oimba ovomerezedwa angawonjezere Airtel Money (+265 99/98), TNM Mpamba (+265 88/89), kapena USDT (TRC-20 / BEP-20). Njira zatsopano zimadikira maola 24 pachitetezo.',
      },
      {
        q: 'Chifukwa chiyani ndalama zochepa zotengera ndi 20,000 MWK?',
        a: 'Ndondomeko za m\'manja zimakhala ndi ndalama zotumizira. Kusunga malire a 20,000 MWK kumateteza phindu la woimba.',
      },
      {
        q: 'Kodi ndingamvere nyimbo popanda ma bando a intaneti?',
        a: 'Inde. Dinani Tsitsani pa nyimbo iliyonse kuti musunge pa chipangizo chanu. Mutha kuyang\'anira kapena kufufuta mafayilo nthawi iliyonse mu Deta & Malo Osungira.',
      },
      {
        q: 'Ndingasinthe @dzina langa kangati?',
        a: 'Mutha kusintha @dzina lanu kamodzi masiku 30 aliwonse kuti maulalo a oimba asamasokonezeke.',
      },
      {
        q: 'Chimachitika ndi chiyani ndikatsegula Kusunga Deta?',
        a: 'Kusunga Deta kumachepetsa liwiro la phokoso (~0.6 MB/mphindi) kuti ma bando anu a Airtel kapena TNM akhale nthawi yaitali.',
      },
      {
        q: 'Ndingatsimikizire bwanji imelo yanga kapena kulumikiza Google?',
        a: 'Yang\'anani m\'bokosi lanu la imelo ulalo wotsimikizira (onani ndi ku Spam/Promotions), kapena lumikizani Google mu Akaunti → Njira zolowera.',
      },
      {
        q: 'Ndinganene bwanji za nyimbo zakuba kapena kuphwanya ufulu?',
        a: 'Dinani madontho atatu pa nyimbo kapena woimba aliyense ndikudina Nena, kapena werengani malamulo athu pa /copyright.',
      },
      {
        q: 'Kodi ndingatulutse kapena kufufuta deta yanga?',
        a: 'Inde. Pitani ku Chinsinsi & Chitetezo → Tsitsani deta yanga (JSON), kapena fufutani akaunti yanu nthawi iliyonse mu Akaunti.',
      },
    ];
  }
  return [
    {
      q: 'How do I upload my music to LOWERVIBE?',
      a: 'Tap "Become an artist" in Creator Tools (or open Studio if you are already an artist), pick an audio file (MP3, WAV, FLAC, or M4A) and a square cover image (at least 1400×1400 px), then publish.',
    },
    {
      q: 'Why does cover art need to be square and at least 1400×1400?',
      a: 'Clean square high-resolution artwork prevents blurry thumbnails across phones, TVs, and share cards, and avoids cut-off text or third-party app banners.',
    },
    {
      q: 'How do plays and likes count?',
      a: 'Every play counts only after 30+ seconds of real listening and is deduplicated per listener every 30 minutes. Likes are 1 per signed-in listener.',
    },
    {
      q: 'When can artists earn money and withdraw?',
      a: 'Monetization unlocks only after you meet the catalog, plays, and follower requirements in Studio → Monetization and an admin approves your request. Self-plays never earn revenue.',
    },
    {
      q: 'What payout methods are supported in Malawi?',
      a: 'Approved artists can add Airtel Money (+265 99/98), TNM Mpamba (+265 88/89), or USDT (TRC-20 / BEP-20). Newly added methods have a 24-hour security hold.',
    },
    {
      q: 'Why is the minimum withdrawal 20,000 MWK?',
      a: 'Mobile money and transfer fees make smaller payouts costly. Keeping the minimum at 20,000 MWK protects artist net earnings.',
    },
    {
      q: 'Can I listen offline without mobile bundles?',
      a: 'Yes. Tap Download on any downloadable track to save it in your device storage. You can manage or clear downloaded files anytime under Data & Storage.',
    },
    {
      q: 'How often can I change my @username?',
      a: 'You can update your @username once every 30 days to keep artist links and mentions stable.',
    },
    {
      q: 'What happens when I turn on Data Saver?',
      a: 'Data Saver switches streaming to lower-bandwidth bitrate (~0.6 MB/min) to help stretch Airtel or TNM bundles.',
    },
    {
      q: 'How do I verify my email or link Google?',
      a: 'Check your inbox for our verification link (remember Spam/Promotions), or link Google under Account → Linked sign-in methods.',
    },
    {
      q: 'How do I report stolen music or copyright infringement?',
      a: 'Open the three-dot menu on any track or artist and tap Report, or review our Copyright Policy at /copyright.',
    },
    {
      q: 'Can I export or delete my personal data?',
      a: 'Yes. Go to Privacy & Safety → Download my data for a JSON export, or delete your account anytime under Account → Danger zone.',
    },
  ];
}

export const AccountView: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    isArtist,
    isGuestMode,
    firebaseProviders,
    emailVerified,
    userSettings,
    updateUserSettings,
    updateCurrentUser,
    updateHandleWithCooldown,
    requireReauth,
    changePassword,
    linkGoogle,
    unlinkProvider,
    signOutOtherSessions,
    deleteAccount,
    logout,
    resendVerification,
    refreshEmailVerification,
    openAuthGateModal,
  } = useAuth();

  const {
    tracks,
    artists,
    savedTrackIds,
    playHistory,
    clearHistory,
    setAudioQuality,
    setCrossfadeSeconds,
    setEqPreset,
    submitSupportTicket,
    submitContentReportRecord,
    setSelectedCountry,
    playTrack,
  } = useAudio();

  const { navigate } = useRouter();
  const { themeMode, setThemeMode } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const isNy = language === 'ny';

  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'err' } | null>(null);
  const showNotice = (text: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ text, type });
    window.setTimeout(() => setToast(null), 4200);
  };

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editCity, setEditCity] = useState(currentUser?.city || '');
  const [editCountry, setEditCountry] = useState(currentUser?.country || 'Malawi');
  const [editGender, setEditGender] = useState<'' | 'male' | 'female' | 'non-binary' | 'prefer_not_to_say'>(
    currentUser?.gender || ''
  );
  const [editAge, setEditAge] = useState<string>(
    typeof currentUser?.age === 'number' ? String(currentUser.age) : ''
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Avatar & Cover Photo Uploads
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [coverProgress, setCoverProgress] = useState(0);
  const [optimisticAvatar, setOptimisticAvatar] = useState<string | null>(null);
  const [optimisticCover, setOptimisticCover] = useState<string | null>(null);

  // Email reveal & Change Password
  const [emailRevealed, setEmailRevealed] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Danger zone delete account & clear history inline confirm
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Offline Cache Drawer
  const [offlineStats, setOfflineStats] = useState<OfflineCacheStats>({ totalBytes: 0, count: 0, entries: [] });
  const [isManageDownloadsOpen, setIsManageDownloadsOpen] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);

  // Accordion sections state (default open Account & Playback)
  const [openSection, setOpenSection] = useState<string>('account');

  // Support & About Modals
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpQuery, setHelpQuery] = useState('');
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportCategory, setSupportCategory] = useState<'account' | 'playback' | 'uploads' | 'payouts' | 'other'>('account');
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const [isBugOpen, setIsBugOpen] = useState(false);
  const [bugSummary, setBugSummary] = useState('');
  const [bugDetails, setBugDetails] = useState('');
  const [isSendingBug, setIsSendingBug] = useState(false);

  const [isLicensesOpen, setIsLicensesOpen] = useState(false);
  const [isRateOpen, setIsRateOpen] = useState(false);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || '');
      setEditUsername(currentUser.username || '');
      setEditBio(currentUser.bio || '');
      setEditCity(currentUser.city || '');
      setEditCountry(currentUser.country || 'Malawi');
      setEditGender(currentUser.gender || '');
      setEditAge(typeof currentUser.age === 'number' ? String(currentUser.age) : '');
    }
  }, [currentUser?.id, currentUser?.gender, currentUser?.age]);

  // Anchor scroll support (#privacy-data, #danger-zone)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#privacy-data') {
      setOpenSection('privacy');
      setTimeout(() => document.getElementById('privacy-data')?.scrollIntoView({ behavior: 'smooth' }), 100);
    } else if (hash === '#danger-zone') {
      setOpenSection('account');
      setTimeout(() => document.getElementById('danger-zone')?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, []);

  const refreshCacheStats = async () => {
    const stats = await getOfflineCacheStats();
    setOfflineStats(stats);
  };

  useEffect(() => {
    refreshCacheStats();
  }, [savedTrackIds.length]);

  const linkedArtist = useMemo(() => {
    if (!currentUser?.artistId) return null;
    return artists.find((a) => a.id === currentUser.artistId) || null;
  }, [artists, currentUser?.artistId]);

  const myPlaylistsCount = currentUser?.playlists?.length || 0;
  const followingCount = currentUser?.followingArtistIds?.length || 0;
  const followersCount = linkedArtist?.followersCount || 0;

  const helpTopics = useMemo(() => getHelpTopics(isNy), [isNy]);

  const filteredHelpTopics = useMemo(() => {
    const q = helpQuery.trim().toLowerCase();
    if (!q) return helpTopics;
    return helpTopics.filter(
      (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
    );
  }, [helpQuery, helpTopics]);

  // Handlers
  const handleAvatarUpload = async (file: File) => {
    if (!currentUser) return;
    setIsUploadingAvatar(true);
    setAvatarProgress(10);
    let localPreview: string | null = null;
    try {
      const uploaded = await uploadCompressedAvatar({
        userId: currentUser.id,
        file,
        onPreviewReady: (previewUrl) => {
          localPreview = previewUrl;
          setOptimisticAvatar(previewUrl);
        },
        onProgress: (snap) => setAvatarProgress(snap.percent),
      });
      const oldPath = currentUser.storageAvatarPath;
      const saveRes = await updateCurrentUser({
        avatar: uploaded.downloadUrl,
        storageAvatarPath: uploaded.storagePath,
      });
      if (!saveRes.success) {
        await deleteUploadedStoragePaths([uploaded.storagePath]).catch(() => {});
        setOptimisticAvatar(null);
        showNotice(
          saveRes.error || (isNy ? 'Sitinathe kusunga chithunzi chatsopano.' : 'Could not save new profile photo.'),
          'err'
        );
        return;
      }
      if (oldPath && oldPath !== uploaded.storagePath) {
        deleteUploadedStoragePaths([oldPath]).catch(() => {});
      }
      setOptimisticAvatar(null);
      showNotice(isNy ? 'Chithunzi cha mbiri chasinthidwa.' : 'Profile photo updated.');
    } catch (err) {
      setOptimisticAvatar(null);
      showNotice(
        err instanceof Error ? err.message : isNy ? 'Sitinathe kukweza chithunzi.' : 'Could not upload profile photo.',
        'err'
      );
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setIsUploadingAvatar(false);
      setAvatarProgress(0);
    }
  };

  const handleCoverPhotoUpload = async (file: File) => {
    if (!currentUser) return;
    setIsUploadingCover(true);
    setCoverProgress(10);
    let localPreview: string | null = null;
    try {
      const uploaded = await uploadCompressedCoverBanner({
        userId: currentUser.id,
        file,
        onPreviewReady: (previewUrl) => {
          localPreview = previewUrl;
          setOptimisticCover(previewUrl);
        },
        onProgress: (snap) => setCoverProgress(snap.percent),
      });
      const oldPath = currentUser.storageBannerPath;
      const saveRes = await updateCurrentUser({
        banner: uploaded.downloadUrl,
        storageBannerPath: uploaded.storagePath,
      });
      if (!saveRes.success) {
        await deleteUploadedStoragePaths([uploaded.storagePath]).catch(() => {});
        setOptimisticCover(null);
        showNotice(
          saveRes.error || (isNy ? 'Sitinathe kusunga chithunzi cha kumbuyo.' : 'Could not save cover photo.'),
          'err'
        );
        return;
      }
      if (oldPath && oldPath !== uploaded.storagePath) {
        deleteUploadedStoragePaths([oldPath]).catch(() => {});
      }
      setOptimisticCover(null);
      showNotice(isNy ? 'Chithunzi cha kumbuyo chasinthidwa.' : 'Cover photo updated.');
    } catch (err) {
      setOptimisticCover(null);
      showNotice(
        err instanceof Error ? err.message : isNy ? 'Sitinathe kukweza chithunzi cha kumbuyo.' : 'Could not upload cover photo.',
        'err'
      );
    } finally {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setIsUploadingCover(false);
      setCoverProgress(0);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const cleanName = editName.trim();
    if (cleanName.length < 2) {
      showNotice(
        isNy ? 'Dzina likuyenera kukhala ndi zilembo zosachepera ziwiri.' : 'Display name must be at least 2 characters.',
        'err'
      );
      return;
    }

    const parsedAge = editAge.trim() ? Math.floor(Number(editAge)) : undefined;
    if (editAge.trim() && (!Number.isFinite(parsedAge) || (parsedAge as number) < 13 || (parsedAge as number) > 120)) {
      showNotice(isNy ? 'Zaka zikuyenera kukhala pakati pa 13 ndi 120.' : 'Age must be between 13 and 120.', 'err');
      return;
    }

    setIsSavingProfile(true);
    try {
      const cleanedTargetHandle = editUsername.replace(/^@/, '').trim().toLowerCase();
      if (cleanedTargetHandle && cleanedTargetHandle !== currentUser.username) {
        const res = await updateHandleWithCooldown(cleanedTargetHandle);
        if (!res.success) {
          showNotice(res.error || (isNy ? 'Sitinathe kusintha @dzina.' : 'Could not update @username.'), 'err');
          setIsSavingProfile(false);
          return;
        }
      }

      const saveRes = await updateCurrentUser({
        name: cleanName,
        bio: editBio.trim().slice(0, 500),
        city: editCity.trim(),
        country: editCountry || 'Malawi',
        ...(editGender ? { gender: editGender } : {}),
        ...(typeof parsedAge === 'number' ? { age: parsedAge } : {}),
      });
      if (!saveRes.success) {
        showNotice(
          saveRes.error || (isNy ? 'Sitinathe kusunga zosintha.' : 'Could not save profile changes.'),
          'err'
        );
        return;
      }
      setSelectedCountry(editCountry || 'Malawi');
      setIsEditingProfile(false);
      showNotice(isNy ? 'Mbiri yasungidwa.' : 'Profile saved.');
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : isNy ? 'Sitinathe kusunga zosintha.' : 'Could not save profile changes.',
        'err'
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleRevealEmail = async () => {
    if (emailRevealed) {
      setEmailRevealed(false);
      return;
    }
    const ok = await requireReauth(
      isNy ? 'Tsimikizirani kuti ndinu kuti muwone imelo yanu yonse.' : 'Confirm it is you to view your full email address.'
    );
    if (ok) {
      setEmailRevealed(true);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showNotice(
        isNy ? 'Mawu achinsinsi atsopano akhale osachepera zilembo 8.' : 'New password must be at least 8 characters.',
        'err'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotice(isNy ? 'Mawu achinsinsi sakufanana.' : 'Passwords do not match.', 'err');
      return;
    }

    const ok = await requireReauth(
      isNy ? 'Tsimikizirani akaunti yanu musanasinthe mawu achinsinsi.' : 'Confirm your current sign-in before changing your password.'
    );
    if (!ok) return;

    setIsChangingPassword(true);
    const res = await changePassword(newPassword);
    setIsChangingPassword(false);
    if (res.success) {
      setNewPassword('');
      setConfirmPassword('');
      setIsChangePasswordOpen(false);
      showNotice(isNy ? 'Mawu achinsinsi asinthidwa.' : 'Password updated.');
    } else {
      showNotice(res.error || (isNy ? 'Sitinathe kusintha mawu achinsinsi.' : 'Could not update password.'), 'err');
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') return;
    const ok = await requireReauth(
      isNy ? 'Tsimikizirani kuti ndinu musanafufute akaunti yanu.' : 'Confirm your identity before permanently deleting your account.'
    );
    if (!ok) return;

    setIsDeletingAccount(true);
    const res = await deleteAccount();
    setIsDeletingAccount(false);
    if (res.success) {
      setIsDeleteModalOpen(false);
      navigate('/');
    } else {
      showNotice(res.error || (isNy ? 'Sitinathe kufufuta akaunti.' : 'Could not delete account.'), 'err');
    }
  };

  const handleDownloadMyData = () => {
    if (!currentUser) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      account: {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email,
        country: currentUser.country,
        city: currentUser.city,
        role: currentUser.role,
        termsAcceptedAt: currentUser.termsAcceptedAt,
      },
      settings: userSettings,
      likedTrackIds: currentUser.likedTrackIds,
      followingArtistIds: currentUser.followingArtistIds,
      playlists: currentUser.playlists,
      listeningHistory: playHistory.map((h) => ({
        trackId: h.trackId,
        title: h.track.title,
        artistName: h.track.artistName,
        playedAt: h.playedAt,
        listenedSeconds: h.listenedDurationSeconds,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lowervibe-data-${currentUser.username || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(isNy ? 'Deta yanu ikutsitsidwa.' : 'Your data export is downloading.');
  };

  const handleRequestPushPermission = async (key: keyof typeof userSettings.notifications, nextVal: boolean) => {
    if (nextVal && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {}
    }
    await updateUserSettings({ notifications: { [key]: nextVal } });
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSubject.trim() || !supportMessage.trim()) return;
    setIsSendingSupport(true);
    const res = await submitSupportTicket({
      subject: supportSubject,
      category: supportCategory,
      message: supportMessage,
    });
    setIsSendingSupport(false);
    if (res.success) {
      setSupportSubject('');
      setSupportMessage('');
      setIsSupportOpen(false);
      showNotice(isNy ? 'Pempho lathandizo latumizidwa. Tikuyankhani pa imelo.' : 'Support request sent. We will reply by email.');
    } else {
      showNotice(res.error || (isNy ? 'Sitinathe kutumiza pempho.' : 'Could not send request.'), 'err');
    }
  };

  const handleSendBugReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugSummary.trim()) return;
    setIsSendingBug(true);
    const res = await submitContentReportRecord({
      type: 'bug_report',
      reason: bugSummary.trim(),
      details: bugDetails.trim(),
    });
    setIsSendingBug(false);
    if (res.success) {
      setBugSummary('');
      setBugDetails('');
      setIsBugOpen(false);
      showNotice(isNy ? 'Lipoti la vuto lalandilidwa. Zikomo.' : 'Bug report received. Thank you.');
    } else {
      showNotice(res.error || (isNy ? 'Sitinathe kutumiza lipoti.' : 'Could not submit bug report.'), 'err');
    }
  };

  const handleShareProfile = () => {
    if (!currentUser) return;
    const shareUrl = currentUser.artistId
      ? getShortArtistShareUrl({ id: currentUser.artistId })
      : `${getTrustedShareOrigin()}/account`;
    if (navigator.share) {
      navigator.share({ title: `${currentUser.name} on LOWERVIBE`, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(shareUrl);
      showNotice(isNy ? 'Ulalo wa mbiri wakopedwa.' : 'Profile link copied.');
    }
  };

  // Guest state screen (clean sign in CTA + Appearance/Language preferences still work!)
  if (!currentUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 pb-6 space-y-6">
        <div className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--accent-text)]">
            <UserIcon className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)]">
              {isGuestMode ? t('browsing_as_guest') : t('sign_in_profile')}
            </h1>
            <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
              {t('guest_profile_sub')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-6 py-3 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] font-bold text-sm hover:brightness-95 transition cursor-pointer"
            >
              {t('sign_in')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="px-6 py-3 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:opacity-90 transition cursor-pointer"
            >
              {t('create_account')}
            </button>
          </div>
        </div>

        {/* Appearance & Language for guests */}
        <div className="rounded-[20px] bg-[var(--surface)] border border-[var(--border)] p-5 space-y-4">
          <h2 className="text-sm font-bold text-[var(--text)]">{t('appearance_language')}</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'system' as const, label: isNy ? 'Makina' : 'System' },
              { id: 'light' as const, label: isNy ? 'Kuwala' : 'Light' },
              { id: 'dark' as const, label: isNy ? 'Mdima' : 'Dark' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setThemeMode(mode.id);
                  updateUserSettings({ appearance: { theme: mode.id } });
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition ${
                  themeMode === mode.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-bold'
                    : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[
              { id: 'en' as const, label: 'English' },
              { id: 'ny' as const, label: 'Chichewa' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => {
                  setLanguage(lang.id);
                  updateUserSettings({ appearance: { language: lang.id } });
                }}
                className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  language === lang.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-bold'
                    : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasPasswordProvider = firebaseProviders.includes('password');
  const hasGoogleProvider = firebaseProviders.includes('google.com');
  const hasPhoneProvider = firebaseProviders.includes('phone');

  const handleCooldownDays = currentUser.handleUpdatedAt
    ? Math.max(
        0,
        Math.ceil(30 - (Date.now() - new Date(currentUser.handleUpdatedAt).getTime()) / (1000 * 60 * 60 * 24))
      )
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 pb-6 space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed top-20 right-4 z-50 px-4 py-3 rounded-2xl border shadow-xl text-xs font-semibold flex items-center gap-2 ${
            toast.type === 'err'
              ? 'bg-[var(--surface)] border-[var(--danger)] text-[var(--danger)]'
              : 'bg-[var(--surface)] border-[var(--border-strong)] text-[var(--text)]'
          }`}
        >
          {toast.type === 'err' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-[var(--accent-text)] shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Email Verification Prompt if unverified */}
      {!emailVerified && currentUser.email && !hasPhoneProvider && (
        <div className="p-4 rounded-2xl bg-[var(--surface)] border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-[var(--text)]">
                {isNy ? 'Tsimikizirani imelo yanu' : 'Verify your email address'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)]">
                {isNy
                  ? `Tinatumiza ulalo wotsimikizira ku ${maskEmailAddress(currentUser.email)}. Yang'anani ndi mu Spam/Promotions.`
                  : `We sent a verification link to ${maskEmailAddress(currentUser.email)}. Check Spam/Promotions too.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                const res = await refreshEmailVerification();
                showNotice(
                  res.verified
                    ? isNy ? 'Imelo yatsimikizika!' : 'Email verified!'
                    : isNy ? 'Sitinatsimikizirebe. Tsegulani ulalo mu imelo yanu.' : 'Not verified yet. Open the link in your inbox.'
                );
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
            >
              {isNy ? 'Ndatsimikizira' : 'I verified'}
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await resendVerification();
                showNotice(
                  res.success
                    ? isNy ? 'Imelo yotsimikizira yatumizidwa.' : 'Verification email sent.'
                    : res.error || (isNy ? 'Dikirani pang\'ono ndi kuyesanso.' : 'Wait a moment and try again.'),
                  res.success ? 'ok' : 'err'
                );
              }}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold cursor-pointer"
            >
              {isNy ? 'Tumizaninso' : 'Resend'}
            </button>
          </div>
        </div>
      )}

      {/* TOP PROFILE CARD */}
      <section className="rounded-[24px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        {/* User Cover Banner + Upload Button */}
        <div className="relative h-28 sm:h-40 w-full bg-[var(--surface-2)] border-b border-[var(--border)] overflow-hidden">
          <img
            src={
              optimisticCover ||
              (currentUser.banner && currentUser.banner !== DEFAULT_BANNER_SVG
                ? currentUser.banner
                : DEFAULT_BANNER_SVG)
            }
            alt={`${currentUser.name} cover`}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={isUploadingCover}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-[var(--surface)]/90 backdrop-blur-md border border-[var(--border-strong)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 shadow-md cursor-pointer hover:border-[var(--accent)] transition disabled:opacity-60"
          >
            {isUploadingCover ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
            )}
            <span>
              {isUploadingCover
                ? `${isNy ? 'Ikukweza' : 'Uploading'} ${coverProgress}%`
                : isNy ? 'Kwezani chithunzi cha kumbuyo' : 'Upload cover'}
            </span>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCoverPhotoUpload(file);
              e.target.value = '';
            }}
          />
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Single Avatar Upload Control — Tap avatar photo to update */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 -mt-12 sm:-mt-14">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                aria-label="Change profile photo"
                className="relative w-full h-full rounded-2xl overflow-visible border-2 border-[var(--surface)] bg-[var(--surface-2)] shadow-lg group cursor-pointer block"
              >
                <div className="w-full h-full rounded-2xl overflow-hidden">
                  <img
                    src={optimisticAvatar || currentUser.avatar || DEFAULT_AVATAR_SVG}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                {isUploadingAvatar && (
                  <span className="absolute inset-0 rounded-2xl bg-black/55 text-white flex flex-col items-center justify-center text-[10px] font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin mb-0.5" />
                    <span>{avatarProgress}%</span>
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] flex items-center justify-center shadow-md"
                >
                  {isUploadingAvatar ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
            </div>

          {/* Identity Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text)] truncate">
                {currentUser.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] capitalize">
                {isAdmin ? t('admin') : isArtist ? t('artist') : t('listener')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-muted)]">
              <span className="font-mono text-[var(--accent-text)]">@{currentUser.username}</span>
              <span>•</span>
              <span>{[currentUser.city, currentUser.country || 'Malawi'].filter(Boolean).join(', ')}</span>
            </div>

            {/* Masked Email + Reauth Reveal */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
              <span>{emailRevealed ? currentUser.email : maskEmailAddress(currentUser.email)}</span>
              {currentUser.email && (
                <button
                  type="button"
                  onClick={handleRevealEmail}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-text)] hover:underline cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>{emailRevealed ? (isNy ? 'Bisani' : 'Hide') : (isNy ? 'Onetsani' : 'Reveal')}</span>
                </button>
              )}
            </div>

            {currentUser.bio && (
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 pt-0.5">{currentUser.bio}</p>
            )}
          </div>
        </div>

        {/* Real Profile Counters */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)]">
          <div className="p-3 rounded-xl bg-[var(--surface-2)] text-center">
            <div className="text-base font-extrabold text-[var(--text)] tabular-nums">{followersCount}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('followers')}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)] text-center">
            <div className="text-base font-extrabold text-[var(--text)] tabular-nums">{followingCount}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('following')}</div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-2)] text-center">
            <div className="text-base font-extrabold text-[var(--text)] tabular-nums">{myPlaylistsCount}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('playlists_label')}</div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold hover:brightness-95 transition cursor-pointer"
          >
            {isEditingProfile ? t('close_editor') : t('edit_profile')}
          </button>

          {currentUser.artistId && (
            <button
              type="button"
              onClick={() => navigate(`/artists/${currentUser.artistId}`)}
              className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('view_public_profile')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleShareProfile}
            className="px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-xs font-semibold hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t('share_profile')}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="ml-auto px-4 py-2 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('sign_out')}</span>
          </button>
        </div>

        {/* Inline Edit Profile Form */}
        {isEditingProfile && (
          <form onSubmit={handleSaveProfile} className="pt-4 border-t border-[var(--border)] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Dzina loonekera' : 'Display name'}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)] flex items-center justify-between">
                  <span>{isNy ? '@dzina' : '@username'}</span>
                  {handleCooldownDays > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {isNy ? `Kwadikira: masiku ${handleCooldownDays}` : `Cooldown: ${handleCooldownDays}d left`}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  disabled={handleCooldownDays > 0}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)] disabled:opacity-60"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Mzinda' : 'City'}
                </label>
                <input
                  type="text"
                  placeholder={isNy ? 'mwachitsanzo, Blantyre, Lilongwe, Lagos' : 'e.g. Blantyre, Lilongwe, Lagos'}
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Dziko' : 'Country'}
                </label>
                <select
                  value={editCountry}
                  onChange={(e) => setEditCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                >
                  {COUNTRIES_LIST.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Umuna / Ukazi' : 'Gender'}
                </label>
                <select
                  value={editGender}
                  onChange={(e) =>
                    setEditGender(
                      e.target.value as '' | 'male' | 'female' | 'non-binary' | 'prefer_not_to_say'
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                >
                  <option value="">{isNy ? 'Osasankhidwa' : 'Not specified'}</option>
                  <option value="male">{isNy ? 'Mwamuna' : 'Male'}</option>
                  <option value="female">{isNy ? 'Mkazi' : 'Female'}</option>
                  <option value="non-binary">{isNy ? 'Zina' : 'Non-binary'}</option>
                  <option value="prefer_not_to_say">{isNy ? 'Ndisanene' : 'Prefer not to say'}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Zaka' : 'Age'}
                </label>
                <input
                  type="number"
                  min={13}
                  max={120}
                  inputMode="numeric"
                  placeholder="13 - 120"
                  value={editAge}
                  onChange={(e) => setEditAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text)]">
                {isNy ? 'Mbiri yanu' : 'Bio'}
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder={isNy ? 'Uzani omvera zomwe mumakonda...' : 'Tell listeners what you love...'}
                className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                {isSavingProfile ? t('saving') : (isNy ? 'Sungani zosintha' : 'Save changes')}
              </button>
            </div>
          </form>
        )}
        </div>
      </section>

      {/* SETTINGS SECTIONS (8 Grouped Interactive Categories) */}
      <div className="space-y-3">
        {/* 1. ACCOUNT */}
        <SettingsGroup
          id="account"
          icon={KeyRound}
          title={t('account')}
          subtitle={
            isNy
              ? 'Mawu achinsinsi, maakaunti olumikizidwa, zipangizo ndi kufufuta akaunti'
              : 'Password, linked accounts, devices, and danger zone'
          }
          isOpen={openSection === 'account'}
          onToggle={() => setOpenSection(openSection === 'account' ? '' : 'account')}
        >
          <div className="space-y-4">
            {/* Change Password */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
              <div>
                <div className="text-xs font-bold text-[var(--text)]">{t('auth_password')}</div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {hasPasswordProvider
                    ? isNy ? 'Sinthani mawu achinsinsi olowera ndi imelo' : 'Update your email sign-in password'
                    : isNy ? 'Ikani mawu achinsinsi kuti mulowenso ndi imelo' : 'Add a password to sign in with email as well'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(!isChangePasswordOpen)}
                className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer self-start sm:self-auto"
              >
                {isChangePasswordOpen ? t('close') : (isNy ? 'Sinthani mawu achinsinsi' : 'Change password')}
              </button>
            </div>

            {isChangePasswordOpen && (
              <form onSubmit={handleChangePassword} className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder={isNy ? 'Mawu achinsinsi atsopano (zilembo 8+)' : 'New password (8+ chars)'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                  />
                  <input
                    type="password"
                    required
                    placeholder={isNy ? 'Tsimikizirani mawu achinsinsi' : 'Confirm new password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent-text)]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
                >
                  {isChangingPassword
                    ? isNy ? 'Ikusintha...' : 'Updating...'
                    : isNy ? 'Sungani mawu achinsinsi' : 'Save new password'}
                </button>
              </form>
            )}

            {/* Linked Sign-in Methods */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
              <div className="text-xs font-bold text-[var(--text)]">
                {isNy ? 'Njira zolowera zolumikizidwa' : 'Linked sign-in methods'}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs flex items-center gap-2 text-[var(--text)]">
                  <span>
                    {isNy ? 'Imelo:' : 'Email:'}{' '}
                    {hasPasswordProvider ? (isNy ? 'Zalumikizidwa' : 'Connected') : (isNy ? 'Zinaikidwabe' : 'Not set')}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs flex items-center gap-2 text-[var(--text)]">
                  <span>
                    Google:{' '}
                    {hasGoogleProvider ? (isNy ? 'Zalumikizidwa' : 'Connected') : (isNy ? 'Sizinaphatikizidwe' : 'Not linked')}
                  </span>
                  {hasGoogleProvider ? (
                    firebaseProviders.length > 1 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await unlinkProvider('google.com');
                          showNotice(
                            res.success
                              ? isNy ? 'Google yachotsedwa.' : 'Google unlinked.'
                              : res.error || (isNy ? 'Sitinathe kuchotsa.' : 'Could not unlink.'),
                            res.success ? 'ok' : 'err'
                          );
                        }}
                        className="text-[11px] font-semibold text-[var(--danger)] cursor-pointer"
                      >
                        {isNy ? 'Chotsani' : 'Unlink'}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await linkGoogle();
                        showNotice(
                          res.success
                            ? isNy ? 'Google yalumikizidwa.' : 'Google linked.'
                            : res.error || (isNy ? 'Sitinathe kulumikiza.' : 'Could not link.'),
                          res.success ? 'ok' : 'err'
                        );
                      }}
                      className="text-[11px] font-semibold text-[var(--accent-text)] cursor-pointer"
                    >
                      {isNy ? 'Lumikizani' : 'Link'}
                    </button>
                  )}
                </div>
                {hasPhoneProvider && (
                  <div className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)]">
                    {isNy ? 'Foni:' : 'Phone:'} {currentUser.phoneNumber || (isNy ? 'Zalumikizidwa' : 'Connected')}
                  </div>
                )}
              </div>
            </div>

            {/* Active Sessions */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">
                    {isNy ? 'Zipangizo zomwe zilimo' : 'Active devices'}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {isNy
                      ? `Zipangizo ${(currentUser.sessions || []).length || 1} zaposachedwa`
                      : `${(currentUser.sessions || []).length || 1} recent session(s)`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await signOutOtherSessions();
                      showNotice(isNy ? 'Zipangizo zina zatulutsidwa.' : 'Other device sessions cleared.');
                    } catch (err) {
                      showNotice(
                        err instanceof Error ? err.message : isNy ? 'Sitinathe kutulutsa zipangizo zina.' : 'Could not clear sessions.',
                        'err'
                      );
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer"
                >
                  {isNy ? 'Tulutsani zipangizo zina' : 'Sign out other devices'}
                </button>
              </div>
              <div className="space-y-1.5">
                {(currentUser.sessions || []).map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between text-[11px] px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
                  >
                    <span className="text-[var(--text)] font-medium">
                      {sess.deviceLabel} • {sess.browser}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {sess.isCurrent ? (isNy ? 'Chipangizo ichi' : 'This device') : new Date(sess.lastActiveAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            <div
              id="danger-zone"
              className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-bold text-[var(--danger)]">
                  {isNy ? 'Fufutani akaunti' : 'Delete account'}
                </div>
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isNy
                    ? 'Fufutani akaunti yanu, mindandanda ndi zosankha zonse kotheratu.'
                    : 'Permanently remove your account, playlists, and saved preferences.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer self-start sm:self-auto"
              >
                {isNy ? 'Fufutani akaunti' : 'Delete account'}
              </button>
            </div>
          </div>
        </SettingsGroup>

        {/* 2. PLAYBACK */}
        <SettingsGroup
          id="playback"
          icon={Headphones}
          title={t('playback')}
          subtitle={
            isNy
              ? 'Ubwino wa phokoso, kusakaniza, kukonza phokoso ndi mawu a nyimbo'
              : 'Audio quality, crossfade, equalizer, and lyrics'
          }
          isOpen={openSection === 'playback'}
          onToggle={() => setOpenSection(openSection === 'playback' ? '' : 'playback')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Ubwino wa phokoso poliza' : 'Streaming quality'}
                </label>
                <select
                  value={userSettings.playback.streamingQuality}
                  onChange={(e) => {
                    const val = e.target.value as AudioQualityPreference;
                    setAudioQuality(val);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                >
                  <option value="auto">{isNy ? 'Zokha (kutengera netiweki)' : 'Auto (adjusts to network)'}</option>
                  <option value="high">{isNy ? 'Chokwera (~1.8 MB/min)' : 'High (~1.8 MB/min)'}</option>
                  <option value="saver">{isNy ? 'Kusunga Deta (~0.6 MB/min)' : 'Data Saver (~0.6 MB/min)'}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text)]">
                  {isNy ? 'Ubwino wa phokoso potsitsa' : 'Download quality'}
                </label>
                <select
                  value={userSettings.playback.downloadQuality}
                  onChange={(e) =>
                    updateUserSettings({ playback: { downloadQuality: e.target.value as 'high' | 'saver' } })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
                >
                  <option value="high">{isNy ? 'Chokwera (Fayilo yeniyeni)' : 'High (Original file)'}</option>
                  <option value="saver">{isNy ? 'Kusunga Deta' : 'Data Saver'}</option>
                </select>
              </div>
            </div>

            {/* Crossfade Slider 0-12s */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text)]">
                  {isNy ? 'Kulumikiza nyimbo pang\'onopang\'ono' : 'Crossfade between songs'}
                </span>
                <span className="font-mono font-bold text-[var(--accent-text)]">
                  {userSettings.playback.crossfadeSeconds === 0
                    ? t('timer_off')
                    : `${userSettings.playback.crossfadeSeconds}s`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={userSettings.playback.crossfadeSeconds}
                onChange={(e) => setCrossfadeSeconds(Number(e.target.value))}
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
            </div>

            {/* Equalizer Preset */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">{t('equalizer')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'flat' as const, label: isNy ? 'Choyenerera' : 'Flat' },
                  { id: 'bass_boost' as const, label: isNy ? 'Besi Yambiri' : 'Bass Boost' },
                  { id: 'vocal' as const, label: isNy ? 'Mawu' : 'Vocal' },
                  { id: 'treble' as const, label: isNy ? 'Phokoso Lalikulu' : 'Treble' },
                ].map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    onClick={() => setEqPreset(eq.id as EqPreset)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      userSettings.playback.eqPreset === eq.id
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-bold'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <ToggleRow
                label={isNy ? 'Kuliza mosadukiza' : 'Gapless playback'}
                description={isNy ? 'Konzerani nyimbo yotsatira pasadakhale kuti isadukize' : 'Preload the next track for seamless transitions'}
                checked={userSettings.playback.gapless}
                onChange={(v) => updateUserSettings({ playback: { gapless: v } })}
              />
              <ToggleRow
                label={isNy ? 'Kulinganiza phokoso' : 'Normalize volume'}
                description={isNy ? 'Sungani phokoso lofanana pa nyimbo zonse' : 'Keep volume steady across tracks using live audio compression'}
                checked={userSettings.playback.normalizeVolume}
                onChange={(v) => updateUserSettings({ playback: { normalizeVolume: v } })}
              />
              <ToggleRow
                label={isNy ? 'Pitilizani kuliza nyimbo zofanana' : 'Autoplay similar tracks'}
                description={isNy ? 'Nyimbo zina zizilira mndandanda ukatha' : 'Keep music playing when your queue ends'}
                checked={userSettings.playback.autoplaySimilar}
                onChange={(v) => updateUserSettings({ playback: { autoplaySimilar: v } })}
              />
              <ToggleRow
                label={isNy ? 'Phokoso limodzi (Mono)' : 'Mono audio'}
                description={isNy ? 'Phatikizani makutu onse awiri kukhala njira imodzi' : 'Combine left and right channels into one signal'}
                checked={userSettings.playback.monoAudio}
                onChange={(v) => updateUserSettings({ playback: { monoAudio: v } })}
              />
              <ToggleRow
                label={isNy ? 'Onetsani mawu a nyimbo ngati alipo' : 'Show lyrics when available'}
                description={isNy ? 'Onetsani mawu a nyimbo mu choleretsa' : 'Display track lyrics in the player drawer'}
                checked={userSettings.playback.showLyrics}
                onChange={(v) => updateUserSettings({ playback: { showLyrics: v } })}
              />
            </div>
          </div>
        </SettingsGroup>

        {/* 3. DATA & STORAGE */}
        <SettingsGroup
          id="storage"
          icon={HardDrive}
          title={t('data_storage')}
          subtitle={
            isNy
              ? `Zotsitsidwa ${formatBytes(offlineStats.totalBytes)} · Kusunga deta ndi ma bando`
              : `${formatBytes(offlineStats.totalBytes)} downloaded · Data saver & bundle controls`
          }
          isOpen={openSection === 'storage'}
          onToggle={() => setOpenSection(openSection === 'storage' ? '' : 'storage')}
        >
          <div className="space-y-3">
            <ToggleRow
              label={isNy ? 'Kusunga Deta (Data Saver)' : 'Data Saver'}
              description={isNy ? 'Kumachepetsa kugwiritsa ntchito ma bando (~0.6 MB/mphindi)' : 'Reduces streaming audio bitrate (~0.6 MB/min) to save bundles'}
              checked={userSettings.dataSaver.enabled}
              onChange={(v) => updateUserSettings({ dataSaver: { enabled: v } })}
            />
            <ToggleRow
              label={isNy ? 'Mverani pa Wi-Fi yokha' : 'Stream over Wi-Fi only'}
              description={isNy ? 'Pewani kugwiritsa ntchito deta ya pafoni pomvera' : 'Avoid mobile data while streaming'}
              checked={userSettings.dataSaver.streamWifiOnly}
              onChange={(v) => updateUserSettings({ dataSaver: { streamWifiOnly: v } })}
            />
            <ToggleRow
              label={isNy ? 'Tsitsani pa Wi-Fi yokha' : 'Download over Wi-Fi only'}
              description={isNy ? 'Dikirani Wi-Fi musanasunge nyimbo pafoni' : 'Wait for Wi-Fi before saving tracks offline'}
              checked={userSettings.dataSaver.downloadWifiOnly}
              onChange={(v) => updateUserSettings({ dataSaver: { downloadWifiOnly: v } })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                <div className="text-[11px] text-[var(--text-muted)]">
                  {isNy ? 'Deta yomwe yagwiritsidwa mwezi uno' : 'Estimated data used this month'}
                </div>
                <div className="text-base font-bold text-[var(--text)] mt-0.5 tabular-nums">
                  {formatBytes(userSettings.dataSaver.estimatedDataUsedBytesThisMonth)}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {isNy ? 'Malo osungira pafoni' : 'Offline storage'}
                  </div>
                  <div className="text-base font-bold text-[var(--text)] mt-0.5 tabular-nums">
                    {formatBytes(offlineStats.totalBytes)} ({offlineStats.count})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    refreshCacheStats();
                    setIsManageDownloadsOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] cursor-pointer"
                >
                  {isNy ? 'Yang\'anirani' : 'Manage'}
                </button>
              </div>
            </div>
          </div>
        </SettingsGroup>

        {/* 4. NOTIFICATIONS */}
        <SettingsGroup
          id="notifications"
          icon={Bell}
          title={t('notifications')}
          subtitle={
            isNy
              ? 'Sankhani zidziwitso zomwe zifika mu pulogalamu ndi pafoni'
              : 'Choose what updates arrive in the app and by browser push'
          }
          isOpen={openSection === 'notifications'}
          onToggle={() => setOpenSection(openSection === 'notifications' ? '' : 'notifications')}
        >
          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
                  <Volume2 className="w-4 h-4 text-[var(--accent-text)]" />
                  <span>{isNy ? 'Phokoso la zidziwitso panthawi yake' : 'Real-time notification sound'}</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isNy
                    ? 'Lizani belu nthawi yomweyo mukakhala mu pulogalamu pakakhala nyimbo zatsopano kapena zosintha.'
                    : 'Play an instant chime inside the installed app for artist releases & administration updates.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    void playNotificationSound('artist').then((played) => {
                      showNotice(
                        played
                          ? isNy ? 'Phokoso la chidziwitso lalira.' : 'Notification chime played.'
                          : isNy ? 'Dinani penapake kaye kuti mutsegule phokoso.' : 'Tap anywhere in the app first to unlock audio playback.',
                        played ? 'ok' : 'err'
                      );
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[11px] font-semibold text-[var(--text)] hover:border-[var(--accent)] cursor-pointer"
                >
                  {isNy ? 'Yesani Phokoso' : 'Test Sound'}
                </button>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-[var(--text)] px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                  <input
                    type="checkbox"
                    checked={userSettings.notifications.soundEnabled !== false}
                    onChange={(e) =>
                      updateUserSettings({ notifications: { soundEnabled: e.target.checked } })
                    }
                    className="accent-[var(--accent)]"
                  />
                  <span>
                    {userSettings.notifications.soundEnabled !== false
                      ? isNy ? 'Yoyatsidwa' : 'On'
                      : isNy ? 'Yozimitsidwa' : 'Muted'}
                  </span>
                </label>
              </div>
            </div>

            {typeof Notification !== 'undefined' && (
              <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[var(--text)]">
                    {isNy ? 'Zidziwitso za pafoni:' : 'Device alerts:'}{' '}
                    <span
                      className={
                        Notification.permission === 'granted'
                          ? 'text-[var(--accent-text)] font-bold'
                          : Notification.permission === 'denied'
                          ? 'text-[var(--danger)] font-bold'
                          : 'text-[var(--text-muted)] font-bold'
                      }
                    >
                      {Notification.permission === 'granted'
                        ? isNy ? 'Zayatsidwa' : 'Enabled'
                        : Notification.permission === 'denied'
                        ? isNy ? 'Zatsekedwa mu bulawuza' : 'Blocked in browser'
                        : isNy ? 'Sizinayatsidwe' : 'Not enabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {isNy
                      ? 'Landirani mauthenga pafoni yanu oimba akatulutsa nyimbo kapena oyang\'anira akasintha akaunti yanu.'
                      : 'Receive system banners on your phone or computer when artists drop music or admin updates your account.'}
                  </p>
                </div>
                {Notification.permission !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => {
                      Notification.requestPermission()
                        .then((perm) => {
                          showNotice(
                            perm === 'granted'
                              ? isNy ? 'Zidziwitso za pafoni zayatsidwa!' : 'Device alerts enabled!'
                              : isNy
                              ? 'Yatsani zidziwitso mu zokonda za bulawuza yanu.'
                              : 'Enable notifications in your browser/app settings to receive alerts.',
                            perm === 'granted' ? 'ok' : 'err'
                          );
                        })
                        .catch(() => {});
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer self-start sm:self-auto shrink-0"
                  >
                    {isNy ? 'Yatsani Zidziwitso' : 'Enable Device Alerts'}
                  </button>
                )}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text)]">
                <Shield className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                <span>
                  {isNy
                    ? 'Zidziwitso zofunikira za akaunti ndi chitetezo (Zimakhala zoyatsidwa nthawi zonse)'
                    : 'Essential account, security & upload alerts (Always enabled)'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {isNy
                  ? 'Zidziwitso za chitetezo, kukonza nsanja, kupambana kapena kulephera kwa kukweza nyimbo, ndi zisankho za pempho la woimba sizimitsidwa.'
                  : 'Security warnings, upload processing status, artist application decisions, and critical maintenance notices stay active to protect your account.'}
              </p>
            </div>

            <ToggleRow
              label={t('promo_banner_toggle_label', 'Promotional banners & feature announcements')}
              description={t(
                'promo_banner_toggle_desc',
                'Show optional release highlights, new platform features, and community announcements.'
              )}
              checked={userSettings.notifications.promotionalBanners !== false}
              onChange={(v) => updateUserSettings({ notifications: { promotionalBanners: v } })}
            />

            <div className="space-y-2">
              {[
                {
                  title: isNy ? 'Nyimbo zatsopano za oimba omwe mumawatsatira' : 'New releases from followed artists',
                  inApp: 'newReleasesInApp' as const,
                  push: 'newReleasesPush' as const,
                },
                {
                  title: isNy ? 'Okonda nyimbo & otsatira atsopano' : 'Likes & new followers',
                  inApp: 'likesFollowsInApp' as const,
                  push: 'likesFollowsPush' as const,
                },
                {
                  title: isNy ? 'Zosintha za mindandanda' : 'Playlist updates',
                  inApp: 'playlistUpdatesInApp' as const,
                  push: 'playlistUpdatesPush' as const,
                },
                {
                  title: isNy ? 'Chidule cha mlungu ndi mlungu' : 'Weekly listening recap',
                  inApp: 'weeklyRecapInApp' as const,
                  push: 'weeklyRecapPush' as const,
                },
                {
                  title: isNy ? 'Malipiro a woimba & kutenga ndalama' : 'Artist monetization & payout updates',
                  inApp: 'payoutUpdatesInApp' as const,
                  push: 'payoutUpdatesPush' as const,
                },
                {
                  title: isNy ? 'Nkhani za nsanja & malangizo' : 'Platform news & tips',
                  inApp: 'productNewsInApp' as const,
                  push: 'productNewsPush' as const,
                },
              ].map((row) => (
                <div
                  key={row.inApp}
                  className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <span className="text-xs font-semibold text-[var(--text)]">{row.title}</span>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={userSettings.notifications[row.inApp] !== false}
                        onChange={(e) => updateUserSettings({ notifications: { [row.inApp]: e.target.checked } })}
                        className="accent-[var(--accent)]"
                      />
                      <span>{isNy ? 'M\'pulogalamu' : 'In-App'}</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-muted)]">
                      <input
                        type="checkbox"
                        checked={Boolean(userSettings.notifications[row.push])}
                        onChange={(e) => handleRequestPushPermission(row.push, e.target.checked)}
                        className="accent-[var(--accent)]"
                      />
                      <span>{isNy ? 'Pafoni' : 'Push'}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SettingsGroup>

        {/* 5. PRIVACY & SAFETY (#privacy-data) */}
        <SettingsGroup
          id="privacy"
          domId="privacy-data"
          icon={Shield}
          title={t('privacy_safety')}
          subtitle={
            isNy
              ? 'Maonekedwe a mbiri, zomwe mumamvera ndi kutenga deta yanu'
              : 'Profile visibility, listening activity, and personal data export'
          }
          isOpen={openSection === 'privacy'}
          onToggle={() => setOpenSection(openSection === 'privacy' ? '' : 'privacy')}
        >
          <div className="space-y-3">
            <ToggleRow
              label={isNy ? 'Mbiri ya aliyense' : 'Public profile'}
              description={isNy ? 'Lolani ena kuwona mbiri yanu ndi tsamba la woimba' : 'Let others discover your profile and creator page'}
              checked={userSettings.privacy.publicProfile}
              onChange={(v) => updateUserSettings({ privacy: { publicProfile: v } })}
            />
            <ToggleRow
              label={isNy ? 'Onetsani zomwe mukumvera' : 'Show listening activity'}
              description={isNy ? 'Lolani oimba omwe mumatsatira awone chiwerengero chanu' : 'Allow followed creators to see aggregated play counts'}
              checked={userSettings.privacy.showListeningActivity}
              onChange={(v) => updateUserSettings({ privacy: { showListeningActivity: v } })}
            />
            <ToggleRow
              label={isNy ? 'Onetsani mindandanda kwa aliyense' : 'Show playlists publicly'}
              description={isNy ? 'Onetsani mindandanda yanu ya aliyense pa Kusaka ndi Fufuzani' : 'Display your public playlists in Search and Discover'}
              checked={userSettings.privacy.showPlaylistsPublicly}
              onChange={(v) => updateUserSettings({ privacy: { showPlaylistsPublicly: v } })}
            />
            <ToggleRow
              label={isNy ? 'Bisani nyimbo za mawu achipongwe' : 'Hide explicit content'}
              description={isNy ? 'Dumphani nyimbo zolembedwa kuti zili ndi mawu oopsa' : 'Skip or blur tracks marked explicit'}
              checked={userSettings.privacy.explicitContentFilter}
              onChange={(v) => updateUserSettings({ privacy: { explicitContentFilter: v } })}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadMyData}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isNy ? 'Tsitsani deta yanga (JSON)' : 'Download my data (JSON)'}</span>
              </button>

              {!confirmClearHistory ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearHistory(true)}
                  className="px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                >
                  {isNy ? 'Fufutani mbiri ya zomveredwa' : 'Clear listening history'}
                </button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--danger)]/40">
                  <span className="text-xs text-[var(--text)]">
                    {isNy ? `Fufutani zinthu ${playHistory.length}?` : `Clear ${playHistory.length} items?`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      setConfirmClearHistory(false);
                      showNotice(isNy ? 'Mbiri ya zomveredwa yafufutidwa.' : 'Listening history cleared.');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                  >
                    {isNy ? 'Inde, fufutani' : 'Yes, clear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearHistory(false)}
                    className="px-2 py-1 text-xs text-[var(--text-muted)] cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </SettingsGroup>

        {/* 6. APPEARANCE & LANGUAGE */}
        <SettingsGroup
          id="appearance"
          icon={Palette}
          title={t('appearance_language')}
          subtitle={
            isNy
              ? 'Mtundu wa tsamba (Makina / Kuwala / Mdima), chilankhulo ndi kachulukidwe'
              : 'Theme (System / Light / Dark), language, and layout density'
          }
          isOpen={openSection === 'appearance'}
          onToggle={() => setOpenSection(openSection === 'appearance' ? '' : 'appearance')}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">
                {isNy ? 'Maonekedwe a tsamba' : 'Theme appearance'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'system' as const, label: isNy ? 'Makina' : 'System', icon: Monitor },
                  { id: 'light' as const, label: isNy ? 'Kuwala' : 'Light', icon: Sun },
                  { id: 'dark' as const, label: isNy ? 'Mdima' : 'Dark', icon: Moon },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = themeMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setThemeMode(opt.id);
                        updateUserSettings({ appearance: { theme: opt.id } });
                      }}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${
                        active
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-bold'
                          : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">{t('language')}</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'en' as const, label: 'English' },
                  { id: 'ny' as const, label: 'Chichewa' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setLanguage(l.id);
                      updateUserSettings({ appearance: { language: l.id } });
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      language === l.id
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-bold'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text)]">
                {isNy ? 'Makulidwe a makadi' : 'Card density'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'comfortable' as const, label: isNy ? 'Otambasuka' : 'Comfortable' },
                  { id: 'compact' as const, label: isNy ? 'Ochepa malo' : 'Compact' },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => updateUserSettings({ appearance: { density: d.id } })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                      userSettings.appearance.density === d.id
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)] border-transparent font-bold'
                        : 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <ToggleRow
              label={t('reduced_motion_label', 'Reduced animations')}
              description={t(
                'reduced_motion_desc',
                'Minimize motion transitions for smoother performance on Android and reduced eye strain.'
              )}
              checked={Boolean(userSettings.appearance.reducedMotion)}
              onChange={(v) => updateUserSettings({ appearance: { reducedMotion: v } })}
            />
          </div>
        </SettingsGroup>

        {/* 7. CREATOR TOOLS */}
        <SettingsGroup
          id="creator"
          icon={Music}
          title={t('creator_tools')}
          subtitle={
            isNy
              ? 'Kwezani nyimbo zanu, onani ziwerengero ndi kutenga ndalama'
              : 'Upload your songs, check analytics, and manage monetization'
          }
          isOpen={openSection === 'creator'}
          onToggle={() => setOpenSection(openSection === 'creator' ? '' : 'creator')}
        >
          <div className="space-y-3">
            {isArtist || isAdmin ? (
              <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">{t('artist_creator')}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {isNy
                      ? 'Kwezani nyimbo, onani ziwerengero zenizeni ndi kuyang\'anira malipiro.'
                      : 'Upload tracks, review real stats, and manage your payouts.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/artistcreator')}
                  className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer self-start sm:self-auto"
                >
                  {t('go_to_studio')}
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text)]">
                    {currentUser.applicationStatus === 'pending'
                      ? isNy ? 'Pempho lanu la woimba likuyang\'aniridwa' : 'Artist application under review'
                      : isNy ? 'Mwakonzeka kutulutsa nyimbo?' : 'Ready to release music?'}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {currentUser.applicationStatus === 'pending'
                      ? isNy
                        ? 'Pempho lanu lili m\'ndandanda woyang\'anira. Onani mmene lilili mu Situdiyo.'
                        : 'Your creator request is queued for review. View your status in Artist Creator.'
                      : isNy
                        ? 'Tumizani zambiri zanu kuti mutsegule Situdiyo ya Woimba ndi kukweza nyimbo.'
                        : 'Submit your artist details to unlock Artist Creator and upload music.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/artistcreator')}
                  className="px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer self-start sm:self-auto"
                >
                  {currentUser.applicationStatus === 'pending'
                    ? isNy ? 'Onani tsamba lodikira' : 'View wait page'
                    : isNy ? 'Lembani ngati woimba' : 'Apply as artist'}
                </button>
              </div>
            )}
          </div>
        </SettingsGroup>

        {/* 8. SUPPORT & ABOUT */}
        <SettingsGroup
          id="support"
          icon={HelpCircle}
          title={t('support_about')}
          subtitle={
            isNy
              ? 'Malo a thandizo, lumikizanani nafe, malamulo ndi zambiri za pulogalamu'
              : 'Help center, contact support, legal policies, and app info'
          }
          isOpen={openSection === 'support'}
          onToggle={() => setOpenSection(openSection === 'support' ? '' : 'support')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setIsHelpOpen(true)}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--accent-text)]" />
                {isNy ? 'Malo a Thandizo' : 'Help Center'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => setIsSupportOpen(true)}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--accent-text)]" />
                {isNy ? 'Lumikizanani ndi Thandizo' : 'Contact support'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => setIsBugOpen(true)}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                <Bug className="w-4 h-4 text-[var(--accent-text)]" />
                {isNy ? 'Nenani za vuto' : 'Report a bug'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => setIsRateOpen(true)}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                <Star className="w-4 h-4 text-[var(--accent-text)]" />
                {isNy ? 'Perekani ndemanga pa LOWERVIBE' : 'Rate LOWERVIBE'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/terms')}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)]">{t('footer_terms')}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/privacy')}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)]">{t('footer_privacy')}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/copyright')}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)]">{t('footer_copyright')}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => setIsLicensesOpen(true)}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between"
            >
              <span className="text-xs font-semibold text-[var(--text)]">
                {isNy ? 'Zilolezo za pulogalamu' : 'Open-source licenses'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => openPwaInstallPrompt('main')}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between sm:col-span-2"
            >
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[var(--accent-text)]" />
                {isNy
                  ? 'Ikani LOWERVIBE Main App (Android, iPhone & Kompyuta)'
                  : 'Install LOWERVIBE Main App (Android, iPhone & Desktop)'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>

            <button
              type="button"
              onClick={() => openPwaInstallPrompt('creator')}
              className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-left hover:border-[var(--border-strong)] transition cursor-pointer flex items-center justify-between sm:col-span-2"
            >
              <span className="text-xs font-semibold text-[var(--text)] flex items-center gap-2">
                <Music className="w-4 h-4 text-[var(--violet)]" />
                {isArtist || isAdmin
                  ? isNy ? 'Ikani LOWERVIBE Creator App (Situdiyo Yokha)' : 'Install LOWERVIBE Creator App (Standalone Studio)'
                  : isNy ? 'LOWERVIBE Creator App (Imatseguka Mukavomerezedwa)' : 'LOWERVIBE Creator App (Unlocks After Artist Approval)'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          <div className="pt-2 text-center text-xs text-[var(--text-muted)]">
            LOWERVIBE Web Platform
          </div>
        </SettingsGroup>
      </div>

      {/* MANAGE DOWNLOADS MODAL */}
      {isManageDownloadsOpen && (
        <ModalShell title={isNy ? 'Nyimbo Zopanda Intaneti' : 'Offline Downloads'} onClose={() => setIsManageDownloadsOpen(false)}>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>{isNy ? `Mafayilo ${offlineStats.count} osungidwa` : `${offlineStats.count} cached file(s)`}</span>
              <span className="font-mono font-bold text-[var(--text)]">{formatBytes(offlineStats.totalBytes)}</span>
            </div>

            {offlineStats.entries.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                {isNy ? 'Palibe nyimbo zotsitsidwa pa foni pakadali pano.' : 'No songs downloaded to device storage yet.'}
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {offlineStats.entries.map((entry) => {
                  const trItem = tracks.find((tr) => tr.id === entry.trackId);
                  return (
                    <div
                      key={entry.trackId}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={trItem?.coverArt || DEFAULT_ARTWORK_SVG}
                          alt={trItem?.title || 'Track'}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[var(--text)] truncate">
                            {trItem?.title || entry.trackId}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {formatBytes(entry.sizeBytes)}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await removeTrackOfflineCache(entry.trackId);
                          await refreshCacheStats();
                        }}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                        title={isNy ? 'Chotsani pafoni' : 'Remove from offline cache'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {offlineStats.entries.length > 0 && (
              <div className="pt-2 border-t border-[var(--border)] flex justify-end">
                {!confirmClearCache ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearCache(true)}
                    className="px-4 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold text-[var(--danger)] cursor-pointer"
                  >
                    {isNy ? 'Fufutani zonse zopanda intaneti' : 'Clear all offline files'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmClearCache(false)}
                      className="px-3 py-1.5 text-xs text-[var(--text-muted)] cursor-pointer"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await clearOfflineCache();
                        await refreshCacheStats();
                        setConfirmClearCache(false);
                        showNotice(isNy ? 'Zosungidwa pafoni zafufutidwa.' : 'Offline storage cleared.');
                      }}
                      className="px-4 py-1.5 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer"
                    >
                      {isNy ? 'Tsimikizirani kufufuta' : 'Confirm clear'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalShell>
      )}

      {/* DELETE ACCOUNT CONFIRM MODAL */}
      {isDeleteModalOpen && (
        <ModalShell title={isNy ? 'Fufutani akaunti' : 'Delete account'} onClose={() => setIsDeleteModalOpen(false)}>
          <div className="space-y-4">
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {isNy ? (
                <>
                  Izi zichotsa mbiri yanu, zokonda ndi mindandanda yanu kotheratu. Lembani{' '}
                  <strong className="text-[var(--text)]">DELETE</strong> pansipa kuti mutsimikizire.
                </>
              ) : (
                <>
                  This removes your profile, settings, and playlists permanently. Type{' '}
                  <strong className="text-[var(--text)]">DELETE</strong> below to confirm.
                </>
              )}
            </p>
            <input
              type="text"
              placeholder={isNy ? 'Lembani DELETE' : 'Type DELETE'}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] focus:outline-none focus:border-[var(--danger)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-xs font-semibold text-[var(--text)] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE' || isDeletingAccount}
                onClick={handleDeleteAccountConfirm}
                className="px-4 py-2 rounded-xl bg-[var(--danger)] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isDeletingAccount
                  ? isNy ? 'Ikufufuta...' : 'Deleting...'
                  : isNy ? 'Fufutani kotheratu' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* HELP CENTER MODAL */}
      {isHelpOpen && (
        <ModalShell title={isNy ? 'Malo a Thandizo' : 'Help Center'} onClose={() => setIsHelpOpen(false)}>
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-3" />
              <input
                type="text"
                placeholder={isNy ? 'Sakani mafunso...' : 'Search questions...'}
                value={helpQuery}
                onChange={(e) => setHelpQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
              />
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {filteredHelpTopics.map((item) => (
                <div key={item.q} className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
                  <div className="text-xs font-bold text-[var(--text)]">{item.q}</div>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {/* CONTACT SUPPORT MODAL */}
      {isSupportOpen && (
        <ModalShell title={isNy ? 'Lumikizanani ndi Thandizo' : 'Contact Support'} onClose={() => setIsSupportOpen(false)}>
          <form onSubmit={handleSendSupport} className="space-y-3">
            <select
              value={supportCategory}
              onChange={(e) => setSupportCategory(e.target.value as typeof supportCategory)}
              className="w-full px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
            >
              <option value="account">{isNy ? 'Akaunti & Kulowa' : 'Account & Sign-in'}</option>
              <option value="playback">{isNy ? 'Kuliza Nyimbo & Kutsitsa' : 'Playback & Downloads'}</option>
              <option value="uploads">{isNy ? 'Kukweza Nyimbo' : 'Music Uploads'}</option>
              <option value="payouts">{isNy ? 'Malipiro & Kutenga Ndalama' : 'Payouts & Monetization'}</option>
              <option value="other">{isNy ? 'Zina' : 'Other'}</option>
            </select>
            <input
              type="text"
              required
              placeholder={isNy ? 'Mutu wa nkhani' : 'Subject'}
              value={supportSubject}
              onChange={(e) => setSupportSubject(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
            />
            <textarea
              rows={4}
              required
              placeholder={isNy ? 'Fotokozani momwe tingakuthandizireni...' : 'Describe how we can help...'}
              value={supportMessage}
              onChange={(e) => setSupportMessage(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsSupportOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-xs text-[var(--text-muted)] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSendingSupport}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
              >
                {isSendingSupport ? (isNy ? 'Ikutumiza...' : 'Sending...') : (isNy ? 'Tumizani uthenga' : 'Send message')}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* REPORT A BUG MODAL */}
      {isBugOpen && (
        <ModalShell title={isNy ? 'Nenani za Vuto' : 'Report a Bug'} onClose={() => setIsBugOpen(false)}>
          <form onSubmit={handleSendBugReport} className="space-y-3">
            <input
              type="text"
              required
              placeholder={isNy ? 'Chalakwika chiyani?' : 'What went wrong?'}
              value={bugSummary}
              onChange={(e) => setBugSummary(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
            />
            <textarea
              rows={3}
              placeholder={isNy ? 'Njira zobwereza vutolo (osakakamizidwa)' : 'Steps to reproduce (optional)'}
              value={bugDetails}
              onChange={(e) => setBugDetails(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
            />
            <p className="text-[11px] text-[var(--text-muted)]">
              {isNy
                ? 'Zimaphatikizapo zambiri za foni kapena bulawuza kuti tifufuze mwachangu.'
                : 'Includes basic browser and device context so we can investigate faster.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBugOpen(false)}
                className="px-4 py-2 rounded-xl bg-[var(--surface-2)] text-xs text-[var(--text-muted)] cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSendingBug}
                className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
              >
                {isSendingBug ? (isNy ? 'Ikutumiza...' : 'Sending...') : (isNy ? 'Tumizani lipoti' : 'Submit bug')}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {/* OPEN-SOURCE LICENSES MODAL */}
      {isLicensesOpen && (
        <ModalShell title={isNy ? 'Zilolezo za Pulogalamu' : 'Open-Source Licenses'} onClose={() => setIsLicensesOpen(false)}>
          <div className="space-y-2 text-xs text-[var(--text-muted)] max-h-72 overflow-y-auto">
            <p className="font-semibold text-[var(--text)]">
              {isNy ? 'LOWERVIBE imagwiritsa ntchito zida izi:' : 'LOWERVIBE uses these open-source packages:'}
            </p>
            <ul className="space-y-1.5 list-disc pl-5">
              <li>React &amp; React DOM (MIT License)</li>
              <li>Firebase Web SDK (Apache 2.0 License)</li>
              <li>Lucide Icons (ISC License)</li>
              <li>Recharts (MIT License)</li>
              <li>Tailwind CSS (MIT License)</li>
            </ul>
          </div>
        </ModalShell>
      )}

      {/* RATE LOWERVIBE MODAL */}
      {isRateOpen && (
        <ModalShell title={isNy ? 'Perekani Ndemanga pa LOWERVIBE' : 'Rate LOWERVIBE'} onClose={() => setIsRateOpen(false)}>
          <div className="space-y-4 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              {isNy ? 'Kodi mukugwiritsa ntchito bwanji LOWERVIBE pakadali pano?' : 'How is your experience so far?'}
            </p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingStars(star)}
                  className="p-1.5 cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 ${
                      star <= ratingStars ? 'text-[var(--accent-text)] fill-current' : 'text-[var(--text-muted)]'
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              placeholder={isNy ? 'Ndemanga zanu (osakakamizidwa)...' : 'Optional feedback...'}
              value={ratingFeedback}
              onChange={(e) => setRatingFeedback(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)]"
            />
            <button
              type="button"
              onClick={async () => {
                const res = await submitSupportTicket({
                  subject: `App Rating: ${ratingStars}/5 stars`,
                  category: 'other',
                  message: ratingFeedback.trim() || `Rated ${ratingStars} stars`,
                });
                if (!res.success) {
                  showNotice(res.error || (isNy ? 'Sitinathe kutumiza ndemanga.' : 'Could not send feedback.'), 'err');
                  return;
                }
                setRatingFeedback('');
                setIsRateOpen(false);
                showNotice(isNy ? 'Zikomo chifukwa cha ndemanga zanu!' : 'Thank you for your feedback!');
              }}
              className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-bold cursor-pointer"
            >
              {isNy ? 'Tumizani ndemanga' : 'Send feedback'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

// Helper UI Sub-components
const SettingsGroup: React.FC<{
  id: string;
  domId?: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ domId, icon: Icon, title, subtitle, isOpen, onToggle, children }) => (
  <section id={domId} className="rounded-[20px] bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-[var(--surface-2)]/60 transition cursor-pointer"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent-text)] shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[var(--text)]">{title}</h2>
          <p className="text-[11px] text-[var(--text-muted)] truncate">{subtitle}</p>
        </div>
      </div>
      <ChevronDown
        className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
    {isOpen && <div className="px-5 pb-5 pt-2 border-t border-[var(--border)]">{children}</div>}
  </section>
);

const ToggleRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] cursor-pointer">
    <div className="min-w-0">
      <div className="text-xs font-semibold text-[var(--text)]">{label}</div>
      <div className="text-[11px] text-[var(--text-muted)]">{description}</div>
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 accent-[var(--accent)] shrink-0 cursor-pointer"
    />
  </label>
);

const ModalShell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({
  title,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
    <div className="w-full max-w-md rounded-[24px] bg-[var(--surface)] border border-[var(--border)] p-5 shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[var(--text)]">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);
